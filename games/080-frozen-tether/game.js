
class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_080_080-frozen-tether_v1';
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterVolume: 1.0,
                sfxVolume: 1.0,
                musicVolume: 1.0,
                screenShake: 1.0,
                particleDensity: 1.0,
                highContrast: false,
                showFPS: false,
                touchControls: 'auto',
                touchSwap: false
            }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(this.saveKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                if (parsed.options) {
                    this.data.options = { ...this.data.options, ...parsed.options };
                }
            }
        } catch (e) {
            console.error('SaveLoad error:', e);
        }
    }
    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.error('SaveWrite error:', e);
        }
    }
    updateScore(score) {
        if (score > this.data.highScore) {
            this.data.highScore = score;
        }
        this.data.totalScoreAccumulated += score;
        this.save();
    }
    incrementGamesPlayed() {
        this.data.totalGamesPlayed++;
        this.save();
    }
}


class InputManager {
    constructor(canvas, soundEngine) {
        this.canvas = canvas;
        this.soundEngine = soundEngine;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, justPressed: false };
        this.touch = { active: false, x: 0, y: 0 };

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.justPressed = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        });
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouse.down = false;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touch.active = true;
            this.updateTouch(e.touches[0]);
            this.mouse.down = true;
            this.mouse.justPressed = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.updateTouch(e.touches[0]);
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.active = false;
            this.mouse.down = false;
        }, { passive: false });
    }
    updateTouch(touchObj) {
        if (!touchObj) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouse.x = (touchObj.clientX - rect.left) * scaleX;
        this.mouse.y = (touchObj.clientY - rect.top) * scaleY;
    }
    update() {
        this.mouse.justPressed = false;
    }
    isKeyDown(code) {
        return !!this.keys[code];
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.color = '#769a87';
        this.speed = 300;
        this.jumpForce = -500;
        this.gravity = 1200;
        this.grounded = false;

        this.grapple = {
            active: false,
            x: 0,
            y: 0,
            length: 0,
            maxLength: 400,
            pullForce: 800
        };
        this.movementThreshold = 10;
        this.stillTime = 0;
        this.timeDilationFactor = 1.0;

        this.comboCount = 0;
        this.comboTimer = 0;
        this.comboMaxTimer = 3.0;

        // Dash & Reactive Vector Rig
        this.dashCooldown = 3.0;
        this.dashTimer = 0;
        this.dashActive = false;
        this.dashDuration = 0.2;
        this.invulnTime = 0;
        this.aimX = 0;
        this.aimY = 0;
        this.recoilX = 0;
        this.recoilY = 0;
        this.thrustIntensity = 0;
    }

    update(dt, input, platforms, sound) {
        const isLeftDown = window.game ? window.game.uiManager.isActionDown('left') : (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft'));
        const isRightDown = window.game ? window.game.uiManager.isActionDown('right') : (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight'));
        const isJumpDown = window.game ? window.game.uiManager.isActionDown('jump') : (input.isKeyDown('Space') || input.isKeyDown('ArrowUp') || input.isKeyDown('KeyW'));
        const isGrappleDown = window.game ? window.game.uiManager.isActionDown('grapple') : input.mouse.down;
        const isGrappleJustPressed = window.game ? (isGrappleDown && !this.lastGrappleDown) : input.mouse.justPressed;

        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq < this.movementThreshold * this.movementThreshold && !isLeftDown && !isRightDown && !this.grapple.active) {
            this.stillTime += dt;
            this.timeDilationFactor = Math.max(0.1, 1.0 - this.stillTime * 2);
        } else {
            this.stillTime = 0;
            this.timeDilationFactor = 1.0;
        }

        if (this.timeDilationFactor < 0.3 && window.game) window.game.uiManager.unlockMilestone('time_lord');

        let ax = 0;
        if (isLeftDown) ax -= 1;
        if (isRightDown) ax += 1;

        this.vx += ax * this.speed * dt * (this.grounded ? 2 : 1);

        // Tighter momentum/collision logic via enhanced friction
        if (this.grounded) {
            this.vx *= 0.80; // slightly tighter ground friction
        } else {
            this.vx *= 0.95; // slightly tighter air friction
        }

        // Recoil decay
        this.recoilX *= 0.9;
        this.recoilY *= 0.9;
        this.vx += this.recoilX * dt * 10;
        this.vy += this.recoilY * dt * 10;

        // Thrust logic for visuals
        if (Math.abs(ax) > 0) {
            this.thrustIntensity = Math.min(1, this.thrustIntensity + dt * 5);
            if (this.thrustIntensity > 0 && Math.random() < 0.3 && window.game) {
                 window.game.vfxManager.addParticle(this.x - ax * 5, this.y + this.radius, '#ffff00', -ax * 100, 50, 0.5, 3);
            }
        } else {
            this.thrustIntensity = Math.max(0, this.thrustIntensity - dt * 5);
        }

        // Update aim
        this.aimX = input.mouse.x;
        this.aimY = input.mouse.y;

        this.vy += this.gravity * dt;

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.comboCount = 0;
        }

        // Dash logic
        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.invulnTime > 0) this.invulnTime -= dt;

        if (this.dashActive) {
            if (this.dashTimer > this.dashCooldown - this.dashDuration) {
                this.vy = 0; // lock y during dash
                if (Math.random() < 0.5 && window.game) {
                    window.game.vfxManager.addAfterimage(this.x, this.y, this.radius, '#00ffff', 0.2);
                }
            } else {
                this.dashActive = false;
            }
        } else if ((input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) && this.dashTimer <= 0) {
            this.dashActive = true;
            this.dashTimer = this.dashCooldown;
            this.invulnTime = this.dashDuration + 0.1;

            // Dash towards mouse
            let angle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
            let dashSpeed = 1200;
            this.vx = Math.cos(angle) * dashSpeed;
            this.vy = Math.sin(angle) * dashSpeed;
            sound.playDash();
        }

        if (isGrappleJustPressed && !this.dashActive) {
            let tx = input.mouse.x;
            let ty = input.mouse.y;

            // If using touch grapple button, shoot straight up or towards nearest platform
            if (window.game && window.game.uiManager.isTouchInZone(tx, ty, 'grapple') && input.touch.active) {
               tx = this.x;
               ty = this.y - 300; // shoot straight up as fallback
            }

            this.shootGrapple(tx, ty, platforms, sound);
        } else if (!isGrappleDown && this.grapple.active) {
            this.grapple.active = false;
        }

        if (this.grapple.active) {
            const dx = this.grapple.x - this.x;
            const dy = this.grapple.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist > this.grapple.length) {
                const pullX = (dx / dist) * this.grapple.pullForce * dt;
                const pullY = (dy / dist) * this.grapple.pullForce * dt;
                this.vx += pullX;
                this.vy += pullY;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.grounded = false;
        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {

                const overlapX = Math.min(this.x + this.radius - p.x, p.x + p.w - (this.x - this.radius));
                const overlapY = Math.min(this.y + this.radius - p.y, p.y + p.h - (this.y - this.radius));

                if (overlapX < overlapY) {
                    if (this.x < p.x + p.w / 2) {
                        this.x = p.x - this.radius;
                        this.vx = Math.min(this.vx, 0);
                    } else {
                        this.x = p.x + p.w + this.radius;
                        this.vx = Math.max(this.vx, 0);
                    }
                } else {
                    if (this.y < p.y + p.h / 2) {
                        this.y = p.y - this.radius;
                        this.vy = 0;
                        this.grounded = true;
                    } else {
                        this.y = p.y + p.h + this.radius;
                        this.vy = Math.max(this.vy, 0);
                    }
                }
            }
        }

        if (this.grounded && isJumpDown) {
            this.vy = this.jumpForce;
            this.grounded = false;
            sound.playJump();
            if (window.game) window.game.uiManager.unlockMilestone('first_jump');
        }

        // Limits
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
        if (this.x > 800 - this.radius) { this.x = 800 - this.radius; this.vx *= -0.5; }
        if (this.y > 600 - this.radius) { this.y = 600 - this.radius; this.vy = 0; this.grounded = true; }

        this.lastGrappleDown = isGrappleDown;
    }

    shootGrapple(tx, ty, platforms, sound) {
        sound.playGrappleShoot();
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.grapple.maxLength) return;

        // Simple raycast against platforms
        const steps = Math.floor(dist / 5);
        const stepX = dx / steps;
        const stepY = dy / steps;

        let cx = this.x;
        let cy = this.y;

        for (let i = 0; i < steps; i++) {
            cx += stepX;
            cy += stepY;
            for (let p of platforms) {
                if (cx > p.x && cx < p.x + p.w && cy > p.y && cy < p.y + p.h) {
                    this.grapple.active = true;
                    this.grapple.x = cx;
                    this.grapple.y = cy;
                    this.grapple.length = Math.hypot(cx - this.x, cy - this.y) * 0.8; // pull slightly

                    // Apply recoil
                    const rAngle = Math.atan2(this.y - cy, this.x - cx);
                    this.recoilX = Math.cos(rAngle) * 300;
                    this.recoilY = Math.sin(rAngle) * 300;

                    sound.playGrappleHit();

                    if (!this.grappleCount) this.grappleCount = 0;
                    this.grappleCount++;
                    if (this.grappleCount >= 10 && window.game) window.game.uiManager.unlockMilestone('grapple_king');

                    return;
                }
            }
        }
    }

    draw(ctx) {
        // Blink if invulnerable
        if (this.invulnTime > 0 && Math.floor(this.invulnTime * 20) % 2 === 0) return;

        // Draw Grapple Line & Hook
        if (this.grapple.active) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.grapple.x, this.grapple.y);
            // Dynamic tension color
            const curDist = Math.hypot(this.grapple.x - this.x, this.grapple.y - this.y);
            ctx.strokeStyle = curDist > this.grapple.length ? '#ffaa00' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.grapple.x, this.grapple.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ff5555';
            ctx.fill();
        }

        // Aim Telegraph
        let aimAngle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
        if (!this.grapple.active && this.dashTimer <= 0) {
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(aimAngle)*this.radius, this.y + Math.sin(aimAngle)*this.radius);
            ctx.lineTo(this.x + Math.cos(aimAngle)*(this.radius + 15), this.y + Math.sin(aimAngle)*(this.radius + 15));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Recoil offset visual
        ctx.translate(-this.recoilX * 0.02, -this.recoilY * 0.02);

        // Thrust flame
        if (this.thrustIntensity > 0 || this.dashActive) {
            let thrustAngle = this.dashActive ? aimAngle + Math.PI : Math.atan2(-this.vy, -this.vx);
            let thrustLen = this.dashActive ? 25 : 10 + this.thrustIntensity * 10;
            ctx.save();
            ctx.rotate(thrustAngle);
            ctx.beginPath();
            ctx.moveTo(-this.radius, 0);
            ctx.lineTo(-this.radius - thrustLen, 5);
            ctx.lineTo(-this.radius - thrustLen * 1.2, 0);
            ctx.lineTo(-this.radius - thrustLen, -5);
            ctx.closePath();
            ctx.fillStyle = this.dashActive ? '#00ffff' : '#ffaa00';
            ctx.fill();
            ctx.restore();
        }

        // Multi-part procedural body (Hexagon)
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let a = (i * Math.PI) / 3;
            let hx = Math.cos(a) * this.radius;
            let hy = Math.sin(a) * this.radius;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fillStyle = this.dashActive ? '#aaaaaa' : this.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Visor
        ctx.rotate(aimAngle);
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.radius * 0.2, -this.radius * 0.4, this.radius * 0.6, this.radius * 0.8);
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.radius * 0.4, -this.radius * 0.2, this.radius * 0.3, this.radius * 0.4);

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 400;
        this.vy = (Math.random() - 0.5) * 400;
        this.life = 1.0;
        this.color = color;
        this.radius = Math.random() * 4 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2.0;
        if (this.life < 0) {
            this.life = 0;
        }
    }
    draw(ctx) {
        if (this.life <= 0) {
            return;
        }
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class BaseEnemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
        this.color = '#ff4444';
        this.type = 'base';
    }
    update(dt, platforms, player, game) {
        this.vy += 600 * dt; // Gravity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        let grounded = false;
        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {

                const overlapX = Math.min(this.x + this.radius - p.x, p.x + p.w - (this.x - this.radius));
                const overlapY = Math.min(this.y + this.radius - p.y, p.y + p.h - (this.y - this.radius));

                if (overlapX < overlapY) {
                    this.vx *= -1;
                    if (this.x < p.x + p.w / 2) this.x = p.x - this.radius;
                    else this.x = p.x + p.w + this.radius;
                } else {
                    this.vy = 0;
                    if (this.y < p.y + p.h / 2) {
                        this.y = p.y - this.radius;
                        grounded = true;
                    } else {
                        this.y = p.y + p.h + this.radius;
                    }
                }
            }
        }

        if (this.x < this.radius || this.x > 800 - this.radius) this.vx *= -1;
        if (this.y > 600 - this.radius) { this.y = 600 - this.radius; this.vy = 0; }

        return grounded;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class SwarmerEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'swarmer';
        this.color = '#ff8800';
        this.radius = 12;
        this.speed = 150;
    }
    update(dt, platforms, player, game) {
        let grounded = super.update(dt, platforms, player, game);
        if (player) {
            let dx = player.x - this.x;
            if (Math.abs(dx) > 10) {
                this.vx = Math.sign(dx) * this.speed;
            } else {
                this.vx = 0;
            }
        }
        if (grounded && Math.random() < 0.05) {
            this.vy = -350;
        }
        return grounded;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class BruiserEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'bruiser';
        this.color = '#4444ff';
        this.radius = 25;
        this.vx = (Math.random() - 0.5) * 50;
        this.shielded = true;
    }
    update(dt, platforms, player, game) {
        let grounded = super.update(dt, platforms, player, game);
        if (grounded && Math.random() < 0.01) {
            this.vy = -200;
        }
        return grounded;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        if (this.shielded) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}

class SniperEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'sniper';
        this.color = '#ff00ff';
        this.radius = 15;
        this.attackTimer = 0;
        this.telegraphing = false;
        this.vx = (Math.random() - 0.5) * 30;
    }
    update(dt, platforms, player, game) {
        let grounded = super.update(dt, platforms, player, game);
        this.attackTimer += dt;

        if (this.attackTimer > 2.0 && player) {
            this.telegraphing = true;
            if (this.attackTimer > 3.0) {
                this.telegraphing = false;
                this.attackTimer = 0;

                let dx = player.x - this.x;
                let dy = player.y - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    let projVx = (dx / dist) * 300;
                    let projVy = (dy / dist) * 300;
                    game.particles.push(new SniperProjectile(this.x, this.y, projVx, projVy));
                }
            }
        }
        return grounded;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        if (this.telegraphing) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

class SniperProjectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 5;
        this.active = true;
        this.color = '#ff00ff';
        this.type = 'projectile';
    }
    update(dt, platforms, player, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < 0 || this.x > 800 || this.y < 0 || this.y > 600) {
            this.active = false;
        }

        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {
                this.active = false;
            }
        }

        if (player && this.active) {
            const dist = Math.hypot(this.x - player.x, this.y - player.y);
            if (dist < this.radius + player.radius) {
                if (player.invulnTime <= 0) {
                    game.state = 'GAME_OVER';
                    game.sound.playGameOver();
                    game.saveManager.updateScore(game.score);
                }
                this.active = false;
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class SpawnerEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'spawner';
        this.color = '#00ff00';
        this.radius = 20;
        this.spawnTimer = 0;
        this.vx = (Math.random() - 0.5) * 80;
    }
    update(dt, platforms, player, game) {
        let grounded = super.update(dt, platforms, player, game);
        this.spawnTimer += dt;
        if (this.spawnTimer > 4.0) {
            this.spawnTimer = 0;
            // Spawn a small minion
            game.enemies.push(new SwarmerEnemy(this.x, this.y - 20));
        }
        if (grounded && Math.random() < 0.02) {
            this.vy = -250;
        }
        return grounded;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class HazardEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'hazard';
        this.color = '#ffff00';
        this.radius = 18;
        this.vx = (Math.random() - 0.5) * 200;
        this.trailTimer = 0;
    }
    update(dt, platforms, player, game) {
        let grounded = super.update(dt, platforms, player, game);
        this.trailTimer += dt;
        if (this.trailTimer > 0.5) {
            this.trailTimer = 0;
            game.particles.push(new HazardTrail(this.x, this.y));
        }
        return grounded;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y + this.radius / 2, this.radius / 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
    }
}

class HazardTrail {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.life = 3.0; // Area denial for 3 seconds
        this.active = true;
        this.type = 'hazard_trail';
    }
    update(dt, platforms, player, game) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
        }
        if (player && this.active && player.invulnTime <= 0) {
            const dist = Math.hypot(this.x - player.x, this.y - player.y);
            if (dist < this.radius + player.radius) {
                game.state = 'GAME_OVER';
                game.sound.playGameOver();
                game.saveManager.updateScore(game.score);
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 0, ${this.life / 3.0})`;
        ctx.fill();
    }
}

function createRandomEnemy(x, y) {
    let r = Math.random();
    if (r < 0.2) return new SwarmerEnemy(x, y);
    if (r < 0.4) return new BruiserEnemy(x, y);
    if (r < 0.6) return new SniperEnemy(x, y);
    if (r < 0.8) return new SpawnerEnemy(x, y);
    return new HazardEnemy(x, y);
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(canvas, this.sound);
        this.uiManager = new UIManager(this);

        this.state = 'TITLE';
        this.lastTime = performance.now();

        this.player = null;
        this.enemies = [];
        this.platforms = [];
        this.particles = [];
        this.score = 0;

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.resize();
        window.game = this;

        this.logicalWidth = 800;
        this.logicalHeight = 600;

        this.worldEnv = new WorldEnvironment(this.logicalWidth, this.logicalHeight);
        this.vfxManager = new VFXManager(this.saveManager);

        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    start() {
        this.player = new Player(400, 300);
        this.score = 0;
        this.enemies = [];
        this.particles = [];
        this.pickups = [];
        this.upgradeChoices = [];
        this.platforms = [
            { x: 0, y: 580, w: 800, h: 20 },
            { x: 100, y: 450, w: 200, h: 20 },
            { x: 500, y: 400, w: 200, h: 20 },
            { x: 300, y: 250, w: 200, h: 20 },
            { x: 50, y: 150, w: 150, h: 20 },
            { x: 600, y: 150, w: 150, h: 20 }
        ];

        // Add hazards to platforms for collision
        for (let v of this.worldEnv.vents) {
            this.platforms.push({x: v.x, y: v.y, w: v.w, h: v.h, isHazard: true});
        }
        for (let c of this.worldEnv.conveyors) {
            this.platforms.push({x: c.x, y: c.y, w: c.w, h: c.h, isHazard: true});
        }

        for(let i = 0; i < 5; i++) {
            this.enemies.push(createRandomEnemy(100 + Math.random() * 600, 50 + Math.random() * 300));
        }

        this.nextBossScore = 500;
        this.bossActive = false;
        this.bossWarningTimer = 0;
        this.bossCount = 0;

        this.state = 'PLAYING';
        this.saveManager.incrementGamesPlayed();
    }

    update(dt) {
        this.lastDt = dt;
        this.uiManager.update(dt);

        if (this.state === 'TITLE') {
            if (this.input.isKeyDown('Enter') || (this.input.mouse.justPressed && !this.input.touch.active)) {
                this.sound.playUI();
                this.sound.playSpawn();
                this.start();
            }
        } else if (this.state === 'PLAYING') {
            this.vfxManager.update(dt);
            if (this.vfxManager.hitStopTimer > 0) {
                this.vfxManager.hitStopTimer -= dt;
                this.input.update();
                return;
            }
            if (this.input.isKeyDown('Escape')) {
                this.state = 'PAUSED';
                this.input.keys['Escape'] = false; // consume to prevent rapid toggle
                return;
            }

            this.sound.update(dt, this);

            // Time dilation twist
            let timeScale = this.player ? this.player.timeDilationFactor : 1.0;
            let effectiveDt = dt * timeScale;

            this.worldEnv.update(effectiveDt, [this.player, ...this.enemies]);

            this.player.update(effectiveDt, this.input, this.platforms, this.sound);

            // Boss Spawning Logic
            if (!this.bossActive && this.score >= this.nextBossScore) {
                this.bossWarningTimer = 3.0; // 3 seconds warning
                this.bossActive = true;
                this.nextBossScore += 1000 + (this.bossCount * 500); // Scale up next boss requirement

                // Clear regular enemies when boss approaches
                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    for (let k = 0; k < 5; k++) {
                        this.particles.push(new Particle(this.enemies[i].x, this.enemies[i].y, this.enemies[i].color));
                    }
                }
                this.enemies = [];
            }

            if (this.bossWarningTimer > 0) {
                this.bossWarningTimer -= effectiveDt;
                if (this.bossWarningTimer <= 0) {
                    this.bossCount++;
                    if (this.bossCount % 2 === 1) {
                        this.enemies.push(new CryoWardenBoss(400, 100));
                    } else {
                        this.enemies.push(new FrostMechanicBoss(400, 100));
                    }
                }
            }

            for (let i = this.enemies.length - 1; i >= 0; i--) {
                let e = this.enemies[i];
                e.update(effectiveDt, this.platforms, this.player, this);

                // Collision with player
                const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
                if (dist < e.radius + this.player.radius) {
                    if (this.player.dashActive || (this.player.vy > 0 && this.player.y < e.y)) {
                        // Kill enemy if dashing or falling on top

                        if (e.isBoss) {
                            if (this.player.invulnTime <= 0) {
                                e.takeDamage(100);
                                this.sound.playBossHit();
                                this.player.invulnTime = 0.5; // IFrames after hitting boss
                                if (!this.player.dashActive) {
                                    this.player.vy = this.player.jumpForce * 1.2; // Higher bounce on boss
                                }
                                this.vfxManager.triggerShake(10, 0, 1);
                                this.vfxManager.emitDirectional(e.x, e.y, '#ffffff', 0, 1, 0.5, 15, 200);
                                this.vfxManager.addFloatingText(e.x, e.y, 100, '#ff0000', true);
                                this.vfxManager.triggerHitStop(0.1);
                                this.sound.playEnemyHit();

                                if (e.hp <= 0) {
                                    e.active = false;
                                    this.score += 500 * (1 + this.player.comboCount * 0.1);
                                    this.player.comboCount++;
                                    this.player.comboTimer = this.player.comboMaxTimer;
                                    this.vfxManager.triggerHitStop(0.5);
                                    this.vfxManager.triggerShake(30, 0, -1);
                                    this.vfxManager.emitExplosion(e.x, e.y, e.color, 40, 500);
                                    this.vfxManager.addFloatingText(e.x, e.y, "BOSS DEFEATED", "#ffff00", true);
                                    this.sound.playScore();
                                    this.enemies.splice(i, 1);
                                    this.bossActive = false;

                                    if (window.game) window.game.uiManager.unlockMilestone('boss_slayer');

                                    this.state = 'UPGRADE';
                                    this.upgradeChoices = WaveDirector.getUpgrades(3);
                                    this.player.vx = 0;
                                    this.player.vy = 0;
                                }
                            }
                        } else if (e.type === 'bruiser' && e.shielded) {
                            e.shielded = false; // Break shield first
                            if (!this.player.dashActive) {
                                this.player.vy = this.player.jumpForce * 0.8;
                            }
                            this.vfxManager.triggerShake(5, 0, -1);
                            this.vfxManager.emitDirectional(e.x, e.y, '#00ffff', 0, -1, 1.0, 10, 150);
                            this.sound.playEnemyHit();
                        } else {
                            e.active = false;
                            if (!this.player.dashActive) {
                                 this.player.vy = this.player.jumpForce * 0.8; // Bounce
                            }
                            this.score += 100 * (1 + this.player.comboCount * 0.1);

                            if (this.score >= 1000 && window.game) window.game.uiManager.unlockMilestone('high_score_1k');

                            this.player.comboCount++;
                            if (this.player.comboCount >= 5 && window.game) window.game.uiManager.unlockMilestone('combo_master');

                            this.player.comboTimer = this.player.comboMaxTimer;
                            this.vfxManager.triggerShake(10, 0, -1);
                            this.vfxManager.triggerHitStop(0.1);
                            this.vfxManager.emitExplosion(e.x, e.y, e.color, 20, 300);
                            this.vfxManager.addFloatingText(e.x, e.y, 100, '#ffffff', false);
                            this.sound.playEnemyHit();
                            this.sound.playScore();
                            this.enemies.splice(i, 1);

                            if (Math.random() < 0.3) {
                                this.pickups.push(new Pickup(e.x, e.y));
                            }

                            // Spawner logic: spawns 2 swarmers on death
                            if (e.type === 'spawner') {
                                this.enemies.push(new SwarmerEnemy(e.x - 20, e.y));
                                this.enemies.push(new SwarmerEnemy(e.x + 20, e.y));
                            }

                            // Spawn new enemy to keep game going if not boss mode
                            if (!this.bossActive) {
                                this.enemies.push(createRandomEnemy(100 + Math.random() * 600, 50));
                            }
                        }
                    } else if (this.player.invulnTime <= 0) {
                        for (let k = 0; k < 20; k++) {
                            this.particles.push(new Particle(this.player.x, this.player.y, this.player.color));
                        }
                        // Game Over
                        this.state = 'GAME_OVER';
                        this.sound.playGameOver();
                        this.saveManager.updateScore(this.score);
                    }
                }
            }

            if (this.player.dashActive) {
                this.particles.push(new Particle(this.player.x, this.player.y, '#00ffff'));
            }

            for (let i = this.particles.length - 1; i >= 0; i--) {
                if (this.particles[i].type === 'projectile' || this.particles[i].type === 'hazard_trail') {
                     this.particles[i].update(effectiveDt, this.platforms, this.player, this);
                     if (!this.particles[i].active) this.particles.splice(i, 1);
                } else {
                    this.particles[i].update(effectiveDt);
                    if (this.particles[i].life <= 0) {
                        this.particles.splice(i, 1);
                    }
                }
            }

            for (let i = this.pickups.length - 1; i >= 0; i--) {
                let p = this.pickups[i];
                p.update(effectiveDt, this.platforms);
                let dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
                if (dist < p.radius + this.player.radius) {
                    if (p.type === 'combo') {
                        this.player.comboTimer = this.player.comboMaxTimer;
                        this.vfxManager.addFloatingText(this.player.x, this.player.y - 20, "COMBO MAX", "#00ffff", false);
                    } else {
                        let gain = Math.floor(50 * (1 + this.player.comboCount * 0.1));
                        this.score += gain;
                        this.vfxManager.addFloatingText(this.player.x, this.player.y - 20, `+${gain}`, "#ffff00", false);
                    }
                    this.sound.playScore();
                    this.pickups.splice(i, 1);
                } else if (!p.active) {
                    this.pickups.splice(i, 1);
                }
            }

        } else if (this.state === 'UPGRADE') {
            if (this.input.mouse.justPressed) {
                const mx = this.input.mouse.x;
                const my = this.input.mouse.y;
                const boxWidth = 200;
                const boxHeight = 100;
                const spacing = 20;
                const totalWidth = 3 * boxWidth + 2 * spacing;
                const startX = this.logicalWidth / 2 - totalWidth / 2;
                const startY = this.logicalHeight / 2 - boxHeight / 2;

                for (let i = 0; i < this.upgradeChoices.length; i++) {
                    let bx = startX + i * (boxWidth + spacing);
                    if (mx > bx && mx < bx + boxWidth && my > startY && my < startY + boxHeight) {
                        this.upgradeChoices[i].apply(this.player);
                        this.sound.playUpgrade();
                        this.state = 'PLAYING';
                        for(let j = 0; j < 5; j++) {
                            this.enemies.push(createRandomEnemy(100 + Math.random() * 600, 50));
                        }
                        break;
                    }
                }
            }
        } else if (this.state === 'PAUSED') {
            this.uiManager.handleInput(this.input);

            // Only unpause if Escape is pressed, or mouse is clicked OUTSIDE the UI bounds.
            if (this.input.isKeyDown('Escape')) {
                this.sound.playUI();
                this.state = 'PLAYING';
                this.input.keys['Escape'] = false; // consume
            } else if (this.input.mouse.justPressed) {
                // If it was a touch OR mouse click outside the UI, resume
                if (!this.uiManager.isClickInUI(this.input.mouse.x, this.input.mouse.y)) {
                    this.sound.playUI();
                    this.state = 'PLAYING';
                }
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.input.isKeyDown('Enter') || (this.input.mouse.justPressed && !this.input.touch.active)) {
                this.sound.playUI();
                this.sound.playSpawn();
                this.start();
            }
        }

        this.input.update();
    }

    draw() {
        if (this.saveManager.data.options.highContrast) {
            this.canvas.style.filter = "contrast(150%) hue-rotate(180deg) grayscale(20%)";
        } else {
            this.canvas.style.filter = "none";
        }

        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        const scaleX = this.canvas.width / this.logicalWidth;
        const scaleY = this.canvas.height / this.logicalHeight;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (this.canvas.width - this.logicalWidth * scale) / 2;
        const offsetY = (this.canvas.height - this.logicalHeight * scale) / 2;

        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        // Draw frame for logical area
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.logicalWidth, this.logicalHeight);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#769a87';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('FROZEN TETHER', this.logicalWidth / 2, this.logicalHeight / 3);
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Click or Press Enter to Start', this.logicalWidth / 2, this.logicalHeight / 2);
            this.ctx.fillText('A/D or Arrows to move. Click to Grapple.', this.logicalWidth / 2, this.logicalHeight / 2 + 40);
            this.ctx.fillText('Stand still to dilate time.', this.logicalWidth / 2, this.logicalHeight / 2 + 80);

            // Back to Arcade link (simulated UI)
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade: ../../index.html', this.logicalWidth / 2, this.logicalHeight - 30);

        } else if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            this.ctx.save();
            if (this.state === 'PLAYING' && this.vfxManager) {
                this.vfxManager.applyShake(this.ctx);
            }

            let camX = this.player ? this.player.x - this.logicalWidth / 2 : 0;
            this.worldEnv.drawBackground(this.ctx, camX);
            this.worldEnv.drawHazards(this.ctx);

            // Draw time dilation effect
            if (this.player && this.player.timeDilationFactor < 1.0) {
                this.ctx.fillStyle = `rgba(118, 154, 135, ${0.1 * (1.0 - this.player.timeDilationFactor)})`;
                this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
            }

            this.ctx.fillStyle = '#445566';
            for (let p of this.platforms) {
                if (!p.isHazard) { // hazards are drawn by worldEnv
                    this.ctx.fillRect(p.x, p.y, p.w, p.h);
                }
            }

            for (let e of this.enemies) {
                e.draw(this.ctx);
            }

            for (let p of this.pickups) {
                p.draw(this.ctx);
            }

            if (this.player && this.state !== 'GAME_OVER') {
                this.player.draw(this.ctx);
            }

            for (let p of this.particles) {
                p.draw(this.ctx);
            }

            if (this.vfxManager) {
                this.vfxManager.draw(this.ctx);
            }
            this.ctx.restore();

            // Draw Boss Warning
            if (this.bossWarningTimer > 0) {
                if (Math.floor(this.bossWarningTimer * 10) % 2 === 0) {
                    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    this.ctx.fillRect(0, this.logicalHeight / 2 - 40, this.logicalWidth, 80);
                    this.ctx.fillStyle = '#ff0000';
                    this.ctx.font = '36px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('WARNING: BOSS APPROACHING', this.logicalWidth / 2, this.logicalHeight / 2 + 10);
                }
            }

            // Draw Boss HP Bar
            let activeBoss = this.enemies.find(e => e.isBoss);
            if (activeBoss && activeBoss.hp > 0) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(this.logicalWidth / 2 - 200, 20, 400, 20);

                let hpPct = Math.max(0, activeBoss.hp / activeBoss.maxHp);
                if (hpPct > 0.5) {
                    this.ctx.fillStyle = '#00ff00';
                } else {
                    this.ctx.fillStyle = '#ff8800'; // Phase 2 color
                }
                this.ctx.fillRect(this.logicalWidth / 2 - 200, 20, 400 * hpPct, 20);

                this.ctx.fillStyle = '#fff';
                this.ctx.font = '16px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(activeBoss.bossName, this.logicalWidth / 2, 15);
            }

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${Math.floor(this.score)}`, 20, 30);
            this.ctx.fillText(`High Score: ${Math.floor(this.saveManager.data.highScore)}`, 20, 60);
            if (this.player) {
                this.ctx.fillText(`Time Dilation: ${this.player.timeDilationFactor.toFixed(2)}x`, 20, 90);
                if (this.player.comboCount > 0) {
                    this.ctx.fillStyle = '#ffff00';
                    this.ctx.fillText(`Combo x${this.player.comboCount}`, 20, 120);
                    this.ctx.fillRect(20, 125, 100 * (this.player.comboTimer / this.player.comboMaxTimer), 5);
                }

                // Dash Cooldown HUD
                this.ctx.fillText(`Dash: `, 20, 150);
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(80, 135, 100, 15);
                if (this.player.dashTimer <= 0) {
                    this.ctx.fillStyle = '#00ffff';
                    this.ctx.fillRect(80, 135, 100, 15);
                } else {
                    this.ctx.fillStyle = '#ff5555';
                    let pct = 1.0 - (this.player.dashTimer / this.player.dashCooldown);
                    this.ctx.fillRect(80, 135, 100 * pct, 15);
                }
            }

            if (this.state === 'UPGRADE') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '36px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('WAVE CLEARED - SELECT UPGRADE', this.logicalWidth / 2, this.logicalHeight / 4);

                const boxWidth = 200;
                const boxHeight = 100;
                const spacing = 20;
                const totalWidth = 3 * boxWidth + 2 * spacing;
                const startX = this.logicalWidth / 2 - totalWidth / 2;
                const startY = this.logicalHeight / 2 - boxHeight / 2;

                for (let i = 0; i < this.upgradeChoices.length; i++) {
                    let bx = startX + i * (boxWidth + spacing);
                    let choice = this.upgradeChoices[i];

                    this.ctx.fillStyle = '#2c3e50';
                    this.ctx.fillRect(bx, startY, boxWidth, boxHeight);
                    this.ctx.strokeStyle = '#769a87';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(bx, startY, boxWidth, boxHeight);

                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '18px sans-serif';
                    this.ctx.fillText(choice.name, bx + boxWidth / 2, startY + 40);
                    this.ctx.font = '14px sans-serif';
                    this.ctx.fillStyle = '#aaa';
                    this.ctx.fillText(choice.desc, bx + boxWidth / 2, startY + 70);
                }
            } else if (this.state === 'GAME_OVER') {
                this.ctx.fillStyle = 'rgba(100, 0, 0, 0.7)';
                this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '48px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('GAME OVER', this.logicalWidth / 2, this.logicalHeight / 2);
                this.ctx.font = '24px sans-serif';
                this.ctx.fillText(`Final Score: ${this.score}`, this.logicalWidth / 2, this.logicalHeight / 2 + 50);
                this.ctx.fillText('Click to Restart', this.logicalWidth / 2, this.logicalHeight / 2 + 90);
            }
        }

        this.uiManager.draw(this.ctx);
        this.ctx.restore();
    }

    loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    window.game = game; // For debugging and playtesting script
};

class CryoWardenBoss extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'cryo_warden';
        this.bossName = 'CRYO WARDEN';
        this.isBoss = true;
        this.color = '#00aaaa';
        this.radius = 40;
        this.maxHp = 500;
        this.hp = this.maxHp;
        this.phase2 = false;

        this.moveTimer = 0;
        this.attackTimer = 0;
        this.targetX = x;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= this.maxHp / 2 && !this.phase2) {
            this.phase2 = true;
            this.color = '#ff8800'; // Change color for phase 2
        }
    }

    update(dt, platforms, player, game) {
        // Floating movement logic (doesn't use standard gravity)
        this.moveTimer += dt;
        this.attackTimer += dt;

        // Horizontal movement - slower in phase 1, faster in phase 2
        let speed = this.phase2 ? 150 : 80;
        let diffX = this.targetX - this.x;
        if (Math.abs(diffX) > 10) {
            this.vx = Math.sign(diffX) * speed;
        } else {
            this.vx = 0;
            if (this.moveTimer > 2.0) {
                this.targetX = 100 + Math.random() * 600;
                this.moveTimer = 0;
            }
        }

        this.x += this.vx * dt;

        // Hover vertically
        let hoverTarget = 100 + Math.sin(Date.now() / 500) * 30;
        this.y += (hoverTarget - this.y) * 2 * dt;

        // Attack logic
        let attackRate = this.phase2 ? 1.5 : 3.0;
        if (this.attackTimer > attackRate) {
            this.attackTimer = 0;

            // Pattern 1: Drop falling hazards
            if (Math.random() > 0.5) {
                game.enemies.push(new SniperProjectile(this.x, this.y, -100, 200));
                game.enemies.push(new SniperProjectile(this.x, this.y, 0, 200));
                game.enemies.push(new SniperProjectile(this.x, this.y, 100, 200));
            }
            // Pattern 2: Spawn swarmers (phase 2 only)
            else if (this.phase2) {
                game.enemies.push(new SwarmerEnemy(this.x - 30, this.y));
                game.enemies.push(new SwarmerEnemy(this.x + 30, this.y));
            }
        }

        return false; // Not grounded
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

class FrostMechanicBoss extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.type = 'frost_mechanic';
        this.bossName = 'FROST MECHANIC';
        this.isBoss = true;
        this.color = '#8800ff';
        this.radius = 35;
        this.maxHp = 600;
        this.hp = this.maxHp;
        this.phase2 = false;

        this.attackTimer = 0;
        this.vx = 100;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= this.maxHp / 2 && !this.phase2) {
            this.phase2 = true;
            this.color = '#ff4400';
            this.vx = Math.sign(this.vx) * 200; // Speed up
        }
    }

    update(dt, platforms, player, game) {
        let grounded = super.update(dt, platforms, player, game);
        this.attackTimer += dt;

        // Bounce off walls
        if (this.x - this.radius < 0) {
            this.x = this.radius;
            this.vx *= -1;
        } else if (this.x + this.radius > 800) {
            this.x = 800 - this.radius;
            this.vx *= -1;
        }

        // Jump occasionally
        if (grounded && Math.random() < 0.02) {
            this.vy = this.phase2 ? -500 : -350;
        }

        // Attacks
        let attackRate = this.phase2 ? 2.0 : 4.0;
        if (this.attackTimer > attackRate) {
            this.attackTimer = 0;
            // Throw hazards
            let h = new HazardEnemy(this.x, this.y);
            h.vy = -300;
            game.enemies.push(h);
        }

        return grounded;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}
