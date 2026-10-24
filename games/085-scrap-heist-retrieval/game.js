const SAVE_KEY = 'arcade_game_085_085-scrap-heist-retrieval_v1';

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { mute: false, sfxVolume: 1, musicVolume: 1 }
        };
        this.load();
    }

    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) {
            console.warn("Save load failed", e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Save failed", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.masterGain.gain.value = 1.0;
        this.sfxGain.gain.value = 1.0;
        this.musicGain.gain.value = 1.0;

        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol) {
        if (!this.initialized || !this.ctx) return;
        this.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playShoot() {
        this.playTone(400, 'square', 0.1, 0.5);
    }

    playHit() {
        this.playTone(150, 'sawtooth', 0.2, 0.7);
    }

    playScore() {
        this.playTone(800, 'sine', 0.1, 0.4);
    }

    playAlert() {
        this.playTone(600, 'square', 0.3, 0.6);
    }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, rightDown: false };
        this.touches = [];

        window.addEventListener('contextmenu', e => e.preventDefault());
        this.joystick = { active: false, startX: 0, startY: 0, moveX: 0, moveY: 0 };
        this.pointers = {};
        this.tapQueued = false;

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mousedown', e => {
            if (e.button === 2) {
                this.mouse.rightDown = true;
            } else if (e.button === 0 || e.button === undefined) {
                this.mouse.down = true;
                this.handlePointerDown(e.clientX, e.clientY, 'mouse');
            }
        });

        window.addEventListener('mouseup', e => {
            if (e.button === 2) {
                this.mouse.rightDown = false;
            } else if (e.button === 0 || e.button === undefined) {
                this.mouse.down = false;
                this.handlePointerUp('mouse');
            }
        });

        window.addEventListener('touchstart', e => {
            // e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                this.touches.push({ id: t.identifier, x: t.clientX, y: t.clientY });
                this.handlePointerDown(t.clientX, t.clientY, t.identifier);
            }
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            // e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const touch = this.touches.find(tt => tt.id === t.identifier);
                if (touch) {
                    touch.x = t.clientX;
                    touch.y = t.clientY;
                    this.handlePointerMove(t.clientX, t.clientY, t.identifier);
                }
            }
        }, { passive: false });

        window.addEventListener('touchend', e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                this.touches = this.touches.filter(tt => tt.id !== t.identifier);
                this.handlePointerMove(t.clientX, t.clientY, t.identifier);
                this.handlePointerUp(t.identifier);
            }
        });

        window.addEventListener('touchcancel', e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                this.touches = this.touches.filter(tt => tt.id !== t.identifier);
                this.handlePointerUp(t.identifier, true);
            }
        });
    }

    handlePointerDown(x, y, id) {
        this.pointers[id] = { x, y, moved: 0, started: performance.now(), suppressed: false };
        if (!this.joystick.active) {
            this.joystick.active = true;
            this.joystick.startX = x;
            this.joystick.startY = y;
            this.joystick.moveX = x;
            this.joystick.moveY = y;
            this.joystick.id = id;
        }
    }

    handlePointerMove(x, y, id) {
        const pointer = this.pointers[id];
        if (pointer) pointer.moved = Math.max(pointer.moved, Math.hypot(x - pointer.x, y - pointer.y));
        if (this.joystick.active && this.joystick.id === id) {
            this.joystick.moveX = x;
            this.joystick.moveY = y;
        }
    }

    handlePointerUp(id, cancelled = false) {
        const pointer = this.pointers[id];
        if (id !== 'mouse' && pointer && !cancelled && !pointer.suppressed &&
            pointer.moved <= 10 && performance.now() - pointer.started <= 300) {
            this.tapQueued = true;
        }
        delete this.pointers[id];
        if (this.joystick.active && this.joystick.id === id) {
            this.joystick.active = false;
        }
    }

    getAxis() {
        let dx = 0;
        let dy = 0;

        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;

        if (this.joystick.active) {
            const jx = this.joystick.moveX - this.joystick.startX;
            const jy = this.joystick.moveY - this.joystick.startY;
            const dist = Math.hypot(jx, jy);
            if (dist > 10) {
                dx += jx / dist;
                dy += jy / dist;
            }
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }
        return { x: dx, y: dy };
    }

    consumePointerAction() {
        this.tapQueued = false;
        for (const pointer of Object.values(this.pointers)) pointer.suppressed = true;
    }

    isActionPressed() {
        const tap = this.tapQueued;
        this.tapQueued = false;
        return !!(this.keys['Space'] || this.keys['Enter'] ||
            (this.mouse.down && !this.pointers.mouse?.suppressed) || tap);
    }

    isSecondaryPressed() {
        return this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.mouse.rightDown;
    }
}

class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.speed = 100;
        this.active = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {}
}

class Particle extends Entity {
    constructor(x, y, color, size, lifetime) {
        super(x, y, size);
        this.color = color;
        this.life = lifetime;
        this.maxLife = lifetime;
        this.vx = (Math.random() - 0.5) * 60;
        this.vy = (Math.random() - 0.5) * 60;
    }

    update(dt) {
        super.update(dt);
        this.life = Math.max(0, this.life - dt);
        this.active = this.life > 0;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.restore();
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 12);
        this.speed = 150;
        this.hasAmmo = true;
        this.color = '#4ad5c0';
        this.facing = { x: 1, y: 0 };

        // Phase 2: Dash ability
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashSpeed = 450;
        this.maxDashCooldown = 2.0;
        this.dashDuration = 0.2;

        // Phase 2: Visual properties
        this.recoilTimer = 0;
        this.invulnTimer = 0;
        this.thrustTimer = 0;
    }

    update(dt, input, game) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.recoilTimer > 0) this.recoilTimer -= dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        const axis = input.getAxis();

        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            } else {
                this.vx = this.facing.x * this.dashSpeed;
                this.vy = this.facing.y * this.dashSpeed;
                game.particles.push(new Particle(this.x, this.y, '#4ad5c0', 3, 0.2));
            }
        } else {
            if (input.isSecondaryPressed() && this.dashCooldown <= 0) {
                this.isDashing = true;
                this.dashTimer = this.dashDuration;
                this.dashCooldown = this.maxDashCooldown;
                this.invulnTimer = this.dashDuration;
                game.sound.playShoot(); // Reuse shoot sound for dash
            }

            // Tight momentum/acceleration tuning
            const targetVx = axis.x * this.speed;
            const targetVy = axis.y * this.speed;
            const accel = 800; // Acceleration factor

            if (axis.x !== 0) {
                this.vx += Math.sign(targetVx - this.vx) * accel * dt;
                if (Math.abs(this.vx) > this.speed) this.vx = Math.sign(this.vx) * this.speed;
            } else {
                this.vx *= Math.pow(0.01, dt); // Friction
            }

            if (axis.y !== 0) {
                this.vy += Math.sign(targetVy - this.vy) * accel * dt;
                if (Math.abs(this.vy) > this.speed) this.vy = Math.sign(this.vy) * this.speed;
            } else {
                this.vy *= Math.pow(0.01, dt); // Friction
            }

            if (axis.x !== 0 || axis.y !== 0) {
                this.facing.x = axis.x;
                this.facing.y = axis.y;
                this.thrustTimer += dt;
            }
        }

        let oldX = this.x;
        let oldY = this.y;
        super.update(dt);

        // World bounds
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > game.width - this.radius) this.x = game.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > game.height - this.radius) this.y = game.height - this.radius;

        // Improved collision (sliding along walls)
        for (let obs of game.obstacles) {
            const rx = Math.max(obs.x, Math.min(this.x, obs.x + obs.width));
            const ry = Math.max(obs.y, Math.min(this.y, obs.y + obs.height));
            const dist = Math.hypot(this.x - rx, this.y - ry);

            if (dist < this.radius) {
                const overlap = this.radius - dist;
                const nx = (this.x - rx) / dist || 0;
                const ny = (this.y - ry) / dist || 0;
                this.x += nx * overlap;
                this.y += ny * overlap;

                // Adjust velocity to slide
                const dot = this.vx * nx + this.vy * ny;
                this.vx -= dot * nx;
                this.vy -= dot * ny;
            }
        }

        // Generate additional sparks and debris
        if (Math.random() < 0.05) {
            const extraSparkX = this.x + (Math.random() - 0.5) * this.radius * 2;
            const extraSparkY = this.y + (Math.random() - 0.5) * this.radius * 2;
            const size = Math.random() * 2 + 1;
            const duration = 0.3 + Math.random() * 0.2;
            game.particles.push(new Particle(extraSparkX, extraSparkY, '#ffaa00', size, duration));
        }

        // Dynamic camera tracking smoothing values
        this.cameraOffset = { x: 0, y: 0 };
        this.cameraOffset.x += (this.vx * 0.1 - this.cameraOffset.x) * dt * 5;
        this.cameraOffset.y += (this.vy * 0.1 - this.cameraOffset.y) * dt * 5;

        // Engine heat management
        if (this.isDashing) {
            this.engineHeat = Math.min(100, (this.engineHeat || 0) + 10 * dt);
        } else {
            this.engineHeat = Math.max(0, (this.engineHeat || 0) - 5 * dt);
        }


        // Shoot (cannot shoot while dashing)
        if (input.isActionPressed() && this.hasAmmo && game.shootCooldown <= 0 && !this.isDashing) {
            this.hasAmmo = false;
            game.shootCooldown = 0.5;
            this.recoilTimer = 0.1;
            game.sound.playShoot();
            game.projectiles.push(new Projectile(this.x, this.y, this.facing.x, this.facing.y));
        }
    }

    draw(ctx) {
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
            return; // Blink effect
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(this.facing.y, this.facing.x);
        ctx.rotate(angle);

        // Recoil offset
        if (this.recoilTimer > 0) {
            ctx.translate(-5 * (this.recoilTimer / 0.1), 0);
        }

        // Aim telegraph
        if (this.hasAmmo && !this.isDashing) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(200, 0);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Thrust flare
        if ((Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10) && Math.floor(this.thrustTimer * 20) % 2 === 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(-this.radius, -this.radius * 0.4);
            ctx.lineTo(-this.radius - 8 - Math.random() * 5, 0);
            ctx.lineTo(-this.radius, this.radius * 0.4);
            ctx.fill();
        }

        // Multi-part procedural body
        // 1. Treads/Legs (Dark grey)
        ctx.fillStyle = '#333';
        ctx.fillRect(-this.radius * 0.8, -this.radius, this.radius * 1.6, this.radius * 0.4);
        ctx.fillRect(-this.radius * 0.8, this.radius * 0.6, this.radius * 1.6, this.radius * 0.4);

        // 2. Main Chassis (Cyan)
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(-this.radius * 0.9, -this.radius * 0.7, this.radius * 1.8, this.radius * 1.4, 4);
        ctx.fill();

        // 3. Cockpit/Core (Darker cyan/glass)
        ctx.fillStyle = '#2a8b7c';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // 4. Gun Barrel (Grey)
        ctx.fillStyle = '#777';
        ctx.fillRect(this.radius * 0.2, -this.radius * 0.2, this.radius * 1.2, this.radius * 0.4);

        // 5. Ammo Indicator Core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.radius * 0.3, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        if (this.hasAmmo) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(this.radius * 0.8, 0, 2, 0, Math.PI * 2);
            ctx.fill();

            // Glowing chamber
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(this.radius * 0.4, -this.radius * 0.1, this.radius * 0.4, this.radius * 0.2);
        }

        ctx.restore();
    }
}
class Enemy extends Entity {
    constructor(x, y) {
        super(x, y, 14);
        this.speed = 50;
        this.patrolCenter = { x, y };
        this.patrolRadius = 50 + Math.random() * 50;
        this.angle = Math.random() * Math.PI * 2;
        this.state = 'PATROL'; // PATROL, ALERT, STUNNED
        this.stunTimer = 0;
        this.color = '#ff4444';
        this.viewRadius = 150;
        this.viewAngle = Math.PI / 3; // 60 degrees
        this.facing = { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    }

    update(dt, game) {
        if (this.state === 'STUNNED') {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) {
                this.state = 'PATROL';
            }
            return;
        }

        if (this.state === 'PATROL') {
            this.angle += dt * 0.5;
            const tx = this.patrolCenter.x + Math.cos(this.angle) * this.patrolRadius;
            const ty = this.patrolCenter.y + Math.sin(this.angle) * this.patrolRadius;

            const dx = tx - this.x;
            const dy = ty - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 1) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
                this.facing.x = dx / dist;
                this.facing.y = dy / dist;
            } else {
                this.vx = 0;
                this.vy = 0;
            }
        } else if (this.state === 'ALERT') {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 1) {
                this.vx = (dx / dist) * this.speed * 1.5;
                this.vy = (dy / dist) * this.speed * 1.5;
                this.facing.x = dx / dist;
                this.facing.y = dy / dist;
            }
        }

        let oldX = this.x;
        let oldY = this.y;
        super.update(dt);

        // World bounds
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > game.width - this.radius) this.x = game.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > game.height - this.radius) this.y = game.height - this.radius;

        // Collide with obstacles
        for (let obs of game.obstacles) {
            const rx = Math.max(obs.x, Math.min(this.x, obs.x + obs.width));
            const ry = Math.max(obs.y, Math.min(this.y, obs.y + obs.height));
            const cdist = Math.hypot(this.x - rx, this.y - ry);

            if (cdist < this.radius) {
                this.x = oldX;
                this.y = oldY;
                break;
            }
        }

        // Line of sight check
        this.checkVision(game);

        // Hit player
        if (this.state !== 'STUNNED' && this.active) {
            const pd = Math.hypot(this.x - game.player.x, this.y - game.player.y);
            if (pd < this.radius + game.player.radius) {
                game.gameOver();
            }
        }
    }

    checkVision(game) {
        if (this.state === 'STUNNED') return;

        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.viewRadius) {
            if (this.state === 'ALERT') this.state = 'PATROL';
            return;
        }

        const angleToPlayer = Math.atan2(dy, dx);
        const facingAngle = Math.atan2(this.facing.y, this.facing.x);

        let diff = Math.abs(angleToPlayer - facingAngle);
        diff = Math.min(diff, Math.PI * 2 - diff);

        if (diff > this.viewAngle / 2) {
            if (this.state === 'ALERT') this.state = 'PATROL';
            return;
        }

        // Raycast against obstacles
        let blocked = false;
        for (let obs of game.obstacles) {
            if (this.lineRectIntersect(this.x, this.y, game.player.x, game.player.y, obs.x, obs.y, obs.width, obs.height)) {
                blocked = true;
                break;
            }
        }

        if (!blocked) {
            if (this.state !== 'ALERT') {
                game.sound.playAlert();
                this.state = 'ALERT';
            }
        } else {
            this.state = 'PATROL';
        }
    }

    lineRectIntersect(x1, y1, x2, y2, rx, ry, rw, rh) {
        const left = this.lineLine(x1, y1, x2, y2, rx, ry, rx, ry + rh);
        const right = this.lineLine(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh);
        const top = this.lineLine(x1, y1, x2, y2, rx, ry, rx + rw, ry);
        const bottom = this.lineLine(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh);

        return left || right || top || bottom;
    }

    lineLine(x1, y1, x2, y2, x3, y3, x4, y4) {
        const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
        return (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const angle = Math.atan2(this.facing.y, this.facing.x);
        ctx.rotate(angle);

        // Draw vision cone
        if (this.state !== 'STUNNED') {
            ctx.fillStyle = this.state === 'ALERT' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 255, 0, 0.2)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, this.viewRadius, -this.viewAngle/2, this.viewAngle/2);
            ctx.closePath();
            ctx.fill();
        }

        ctx.fillStyle = this.state === 'STUNNED' ? '#888' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.radius * 0.4, 0, 3, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === 'STUNNED') {
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-5, -5); ctx.lineTo(5, 5);
            ctx.moveTo(5, -5); ctx.lineTo(-5, 5);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Projectile extends Entity {
    constructor(x, y, dx, dy) {
        super(x, y, 4);
        this.speed = 300;
        this.vx = dx * this.speed;
        this.vy = dy * this.speed;
        this.bounces = 0;
        this.state = 'FLYING'; // FLYING, GROUNDED
    }

    update(dt, game) {
        if (this.state === 'GROUNDED') return;

        let oldX = this.x;
        let oldY = this.y;
        super.update(dt);

        // World bounds bounce
        if (this.x < this.radius || this.x > game.width - this.radius) {
            this.vx *= -1;
            this.x = this.x < this.radius ? this.radius : game.width - this.radius;
            this.bounces++;
        }
        if (this.y < this.radius || this.y > game.height - this.radius) {
            this.vy *= -1;
            this.y = this.y < this.radius ? this.radius : game.height - this.radius;
            this.bounces++;
        }

        // Obstacle bounce
        for (let obs of game.obstacles) {
            const rx = Math.max(obs.x, Math.min(this.x, obs.x + obs.width));
            const ry = Math.max(obs.y, Math.min(this.y, obs.y + obs.height));
            const dist = Math.hypot(this.x - rx, this.y - ry);

            if (dist < this.radius) {
                // Determine collision side
                if (oldX < obs.x || oldX > obs.x + obs.width) this.vx *= -1;
                else this.vy *= -1;

                this.x = oldX;
                this.y = oldY;
                this.bounces++;
                break;
            }
        }

        if (this.bounces > 3) {
            this.state = 'GROUNDED';
            this.vx = 0;
            this.vy = 0;
        }

        // Hit enemies
        for (let e of game.enemies) {
            if (e.active && e.state !== 'STUNNED') {
                const dist = Math.hypot(this.x - e.x, this.y - e.y);
                if (dist < this.radius + e.radius) {
                    e.state = 'STUNNED';
                    e.stunTimer = 3.0;
                    this.state = 'GROUNDED';
                    this.vx = 0;
                    this.vy = 0;
                    game.sound.playHit();
                    break;
                }
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.state === 'GROUNDED' ? '#ffaa00' : '#ffff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        if (this.state === 'GROUNDED') {
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

class Obstacle {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    }
    draw(ctx) {
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#222';
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // Junk details
        ctx.fillStyle = '#555';
        ctx.fillRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
    }
}

class Collectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.active = true;
    }
    draw(ctx) {
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.closePath();
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = 800;
        this.height = 600;

        this.input = new InputManager();
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = performance.now();
        this.score = 0;

        this.player = null;
        this.enemies = [];
        this.obstacles = [];
        this.projectiles = [];
        this.collectibles = [];
        this.particles = [];

        this.shootCooldown = 0;
        this.wave = 1;

        this.initResizeObserver();
        this.bindEvents();

        requestAnimationFrame(t => this.loop(t));
    }

    initResizeObserver() {
        const resize = () => {
            const aspect = this.width / this.height;
            const windowAspect = window.innerWidth / window.innerHeight;
            if (windowAspect > aspect) {
                this.canvas.style.height = '100vh';
                this.canvas.style.width = `${100 * aspect}vh`;
            } else {
                this.canvas.style.width = '100vw';
                this.canvas.style.height = `${100 / aspect}vw`;
            }
        };
        const observer = new ResizeObserver(resize);
        observer.observe(document.body);
        resize();
    }

    bindEvents() {
        window.addEventListener('keydown', e => {
            this.sound.init();
            this.sound.resume();

            if (e.code === 'Escape') {
                if (this.state === 'PLAYING') this.state = 'PAUSED';
                else if (this.state === 'PAUSED') this.state = 'PLAYING';
            }
            if (e.code === 'Space' || e.code === 'Enter') {
                if (this.state === 'TITLE') this.startGame();
                else if (this.state === 'GAME_OVER') this.state = 'TITLE';
            }
        });

        window.addEventListener('mousedown', () => {
            this.sound.init();
            this.sound.resume();
            if (this.state === 'TITLE') this.startGame();
            else if (this.state === 'GAME_OVER') this.state = 'TITLE';
        });

        window.addEventListener('touchstart', () => {
            this.sound.init();
            this.sound.resume();
            if (this.state === 'TITLE') this.startGame();
            else if (this.state === 'GAME_OVER') this.state = 'TITLE';
        });

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
    }

    startGame() {
        this.input.consumePointerAction();
        this.state = 'PLAYING';
        this.score = 0;
        this.wave = 1;
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.save();
        this.loadWave();
    }

    loadWave() {
        this.shootCooldown = 0;
        this.player = new Player(400, 500);
        this.enemies = [];
        this.obstacles = [];
        this.projectiles = [];
        this.collectibles = [];
        this.particles = [];

        // Border obstacles
        this.obstacles.push(new Obstacle(0, 0, this.width, 20));
        this.obstacles.push(new Obstacle(0, 0, 20, this.height));
        this.obstacles.push(new Obstacle(0, this.height - 20, this.width, 20));
        this.obstacles.push(new Obstacle(this.width - 20, 0, 20, this.height));

        // Random scrap piles
        for (let i = 0; i < 5 + this.wave; i++) {
            const w = 40 + Math.random() * 80;
            const h = 40 + Math.random() * 80;
            const x = 50 + Math.random() * (this.width - 100 - w);
            const y = 50 + Math.random() * (this.height - 150 - h);
            this.obstacles.push(new Obstacle(x, y, w, h));
        }

        // Enemies
        for (let i = 0; i < Math.min(3 + this.wave, 10); i++) {
            const x = 100 + Math.random() * (this.width - 200);
            const y = 100 + Math.random() * (this.height - 300);
            this.enemies.push(new Enemy(x, y));
        }

        // Collectibles (Scrap to retrieve)
        for (let i = 0; i < 3 + this.wave; i++) {
            const x = 100 + Math.random() * (this.width - 200);
            const y = 100 + Math.random() * (this.height - 300);
            this.collectibles.push(new Collectible(x, y));
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        this.saveManager.data.totalScoreAccumulated += this.score;
        this.saveManager.save();
    }

    loop(time) {
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (dt > 0.1) dt = 0.1;

        this.update(dt);
        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.shootCooldown = Math.max(0, this.shootCooldown - dt);

        this.player.update(dt, this.input, this);
        for (const particle of this.particles) particle.update(dt);
        this.particles = this.particles.filter(particle => particle.active);

        for (let e of this.enemies) {
            e.update(dt, this);
        }

        for (let p of this.projectiles) {
            p.update(dt, this);
        }

        // Pick up grounded projectile
        if (!this.player.hasAmmo) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                if (p.state === 'GROUNDED') {
                    const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
                    if (dist < this.player.radius + p.radius + 10) {
                        this.player.hasAmmo = true;
                        this.projectiles.splice(i, 1);
                        this.sound.playScore();
                    }
                }
            }
        }

        // Pick up collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const c = this.collectibles[i];
            const dist = Math.hypot(this.player.x - c.x, this.player.y - c.y);
            if (dist < this.player.radius + c.radius) {
                this.collectibles.splice(i, 1);
                this.score += 100;
                this.sound.playScore();
            }
        }

        if (this.collectibles.length === 0) {
            this.wave++;
            this.score += 500;
            this.loadWave();
        }
    }

    draw() {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Grid pattern
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.height); this.ctx.stroke();
        }
        for (let i = 0; i < this.height; i += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(this.width, i); this.ctx.stroke();
        }

        if (this.state === 'TITLE') {
            this.drawTitle();
        } else if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            for (let c of this.collectibles) c.draw(this.ctx);
            for (let o of this.obstacles) o.draw(this.ctx);
            for (let p of this.projectiles) p.draw(this.ctx);
            for (let e of this.enemies) e.draw(this.ctx);
            for (const particle of this.particles) particle.draw(this.ctx);
            if (this.player) this.player.draw(this.ctx);

            this.drawHUD();

            if (this.state === 'PAUSED') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '40px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('PAUSED', this.width/2, this.height/2);
            } else if (this.state === 'GAME_OVER') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = '#f00';
                this.ctx.font = '50px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('GAME OVER', this.width/2, this.height/2 - 20);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '20px monospace';
                this.ctx.fillText('Score: ' + this.score, this.width/2, this.height/2 + 20);
                this.ctx.fillText('Press SPACE to restart', this.width/2, this.height/2 + 60);
            }
        }
    }

    drawHUD() {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Wave: ${this.wave}`, 20, 60);

        this.ctx.textAlign = 'right';
        this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width - 20, 30);

        if (!this.player.hasAmmo) {
            this.ctx.fillStyle = '#ff4444';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('RETRIEVE AMMO!', this.width/2, 40);
        }

        // Draw Dash Cooldown
        this.ctx.textAlign = 'left';
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px monospace';
        this.ctx.fillText('DASH', 20, this.height - 20);

        this.ctx.fillStyle = '#555';
        this.ctx.fillRect(60, this.height - 30, 100, 10);

        if (this.player.dashCooldown <= 0) {
            this.ctx.fillStyle = '#4ad5c0';
            this.ctx.fillRect(60, this.height - 30, 100, 10);
        } else {
            const ratio = 1 - (this.player.dashCooldown / this.player.maxDashCooldown);
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.fillRect(60, this.height - 30, 100 * ratio, 10);
        }
    }

    drawTitle() {
        this.ctx.fillStyle = '#4ad5c0';
        this.ctx.font = '50px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Scrap Heist Retrieval', this.width/2, this.height/3);

        this.ctx.fillStyle = '#ccc';
        this.ctx.font = '20px monospace';
        this.ctx.fillText('Collect green scrap.', this.width/2, this.height/2 - 30);
        this.ctx.fillText('Avoid red patrol bots.', this.width/2, this.height/2);
        this.ctx.fillText('Shoot to stun, but you must retrieve your ammo!', this.width/2, this.height/2 + 30);

        this.ctx.fillStyle = '#fff';
        this.ctx.fillText('Press SPACE or Click to Start', this.width/2, this.height * 0.7);
    }
}

window.onload = () => {
    window.game = new Game();
};
