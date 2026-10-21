class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
    }
    collides(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        return dist < this.radius + other.radius;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.baseSpeed = 300;
        this.speed = 300;
        this.history = [];
        this.recording = true;
        this.color = '#c6f8c8';

        this.friction = 0.85;
        this.dashCooldown = 0;
        this.dashMaxCooldown = 2.0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDuration = 0.2;
        this.dashSpeed = 900;

        this.recoil = 0;
        this.blinkTimer = 0;
        this.aimX = 0;
        this.aimY = -1;
    }
    update(dt, input) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.recoil > 0) this.recoil -= dt * 5;
        if (this.recoil < 0) this.recoil = 0;
        if (this.blinkTimer > 0) this.blinkTimer -= dt;

        if (input.dash && this.dashCooldown <= 0 && !this.isDashing) {
            this.isDashing = true;
            this.dashTimer = this.dashDuration;
            this.dashCooldown = this.dashMaxCooldown;

            let dx = input.x; let dy = input.y;
            if (dx === 0 && dy === 0) { dx = this.aimX; dy = this.aimY; }
            if (dx === 0 && dy === 0) { dy = -1; }

            this.vx = dx * this.dashSpeed;
            this.vy = dy * this.dashSpeed;

            if (game && game.sound) game.sound.playJump();
            this.blinkTimer = this.dashDuration;

            if (game && game.vfx) game.vfx.spawnDashTrail(this.x, this.y, this.radius, '#fff');
        }

        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            if (input.x !== 0 || input.y !== 0) {
                this.vx += input.x * this.baseSpeed * 10 * dt;
                this.vy += input.y * this.baseSpeed * 10 * dt;
                this.aimX = input.x;
                this.aimY = input.y;
            }
            this.vx *= this.friction;
            this.vy *= this.friction;

            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            if (speed > this.baseSpeed) {
                this.vx = (this.vx / speed) * this.baseSpeed;
                this.vy = (this.vy / speed) * this.baseSpeed;
            }
        }

        super.update(dt);

        if (this.x < this.radius) { this.x = this.radius; this.vx = 0; }
        if (this.y < this.radius) { this.y = this.radius; this.vy = 0; }
        if (game) {
            if (this.x > game.width - this.radius) { this.x = game.width - this.radius; this.vx = 0; }
            if (this.y > game.height - this.radius) { this.y = game.height - this.radius; this.vy = 0; }
        }

        if (this.recording && game) {
            this.history.push({
                x: this.x, y: this.y,
                aimX: this.aimX, aimY: this.aimY,
                isDashing: this.isDashing,
                recoil: this.recoil,
                time: game.time
            });
        }
    }
    triggerRecoil() {
        this.recoil = 1.0;
    }
    draw(ctx) {
        if (this.blinkTimer > 0 && Math.floor(this.blinkTimer * 20) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const angle = Math.atan2(this.aimY, this.aimX);
        ctx.rotate(angle);

        const recoilOffset = -this.recoil * 10;
        ctx.translate(recoilOffset, 0);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const speedSq = this.vx*this.vx + this.vy*this.vy;
        if (speedSq > 1000) {
            ctx.fillStyle = this.isDashing ? '#fff' : '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius * 1.5 - Math.random() * (this.isDashing ? 15 : 5), 0);
            ctx.stroke();
        }

        ctx.strokeStyle = `rgba(198, 248, 200, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(this.radius + 5, 0);
        ctx.lineTo(this.radius + 20, 0);
        ctx.stroke();

        ctx.restore();
    }
}

class Ghost extends Entity {
    constructor(history, delay) {
        super(history[0]?.x || 0, history[0]?.y || 0, 15);
        this.history = history;
        this.delay = delay;
        this.index = 0;
        this.color = 'rgba(198, 248, 200, 0.5)';
        this.tetherRange = 150;

        this.aimX = 0;
        this.aimY = -1;
        this.isDashing = false;
        this.recoil = 0;
    }
    update(dt) {
        if (!game) return;
        const targetTime = game.time - this.delay;

        while (this.index < this.history.length - 1 && this.history[this.index+1].time < targetTime) {
            this.index++;
        }

        if (this.index < this.history.length) {
            const h = this.history[this.index];
            this.x = h.x;
            this.y = h.y;
            this.aimX = h.aimX;
            this.aimY = h.aimY;
            this.isDashing = h.isDashing;
            this.recoil = h.recoil;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const angle = Math.atan2(this.aimY, this.aimX);
        ctx.rotate(angle);

        const recoilOffset = -this.recoil * 10;
        ctx.translate(recoilOffset, 0);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.fill();

        if (this.isDashing) {
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius * 1.5 - 10, 0);
            ctx.stroke();
        }

        ctx.restore();

        if (game && game.player) {
            const dx = this.x - game.player.x;
            const dy = this.y - game.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < this.tetherRange) {
                ctx.strokeStyle = `rgba(198, 248, 200, ${0.5 * (1 - dist/this.tetherRange)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(game.player.x, game.player.y);
                ctx.stroke();
            }
        }
    }
}
class Enemy extends Entity {
    constructor(x, y, speed, target) {
        super(x, y, 12);
        this.speed = speed;
        this.target = target;
        this.color = '#ff5555';
    }
    update(dt) {
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y - this.radius);
        ctx.fill();
    }
}

class Obstacle extends Entity {
    constructor(x, y, w, h) {
        super(x + w/2, y + h/2, Math.max(w,h)/2);
        this.x0 = x;
        this.y0 = y;
        this.w = w;
        this.h = h;
        this.color = '#886644';
        this.beatScale = 1.0;
    }
    update(dt) {
        if (game) {
            // Pulse on beat
            const beatTime = (game.time / game.beatInterval) % 1;
            if (beatTime < 0.1) {
                this.beatScale = 1.2;
            } else {
                this.beatScale += (1.0 - this.beatScale) * dt * 5;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        const dw = this.w * this.beatScale;
        const dh = this.h * this.beatScale;
        const dx = this.x - dw/2;
        const dy = this.y - dh/2;
        ctx.fillRect(dx, dy, dw, dh);

        ctx.strokeStyle = '#aa8855';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);
    }
    collidesEntity(ent) {
        // Simple AABB
        const dw = this.w * this.beatScale;
        const dh = this.h * this.beatScale;
        const left = this.x - dw/2 - ent.radius;
        const right = this.x + dw/2 + ent.radius;
        const top = this.y - dh/2 - ent.radius;
        const bottom = this.y + dh/2 + ent.radius;
        return ent.x > left && ent.x < right && ent.y > top && ent.y < bottom;
    }
}

class Collectible extends Entity {
    constructor(x, y) {
        super(x, y, 10);
        this.color = '#ffff00';
        this.angle = 0;
    }
    update(dt) {
        this.angle += dt * 3;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.fill();
        ctx.restore();
    }
}

class Particle extends Entity {
    constructor(x, y, vx, vy, color, duration) {
        super(x, y, 2);
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.duration = duration;
        this.time = 0;
    }
    triggerHitStop(duration) {
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            if (this.vfx) this.vfx.update(dt);
            if (this.background) this.background.update(dt);
            if (this.hitStopTimer > 0) return;
        }
        this.time += dt;
        super.update(dt);
        if (this.time > this.duration) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 1 - (this.time / this.duration);
        super.draw(ctx);
        ctx.globalAlpha = 1.0;
    }
}


class FloatingText extends Particle {
    constructor(x, y, text, color, size, duration) {
        super(x, y, 0, 0, color, duration);
        this.text = text;
        this.size = size;
        this.startY = y;
        this.distance = 40;
    }
    triggerHitStop(duration) {
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            if (this.vfx) this.vfx.update(dt);
            if (this.background) this.background.update(dt);
            if (this.hitStopTimer > 0) return;
        }
        this.time += dt;
        // Ease out quad
        const t = Math.min(this.time / this.duration, 1.0);
        const easeT = t * (2 - t);
        this.y = this.startY - easeT * this.distance;
        if (this.time > this.duration) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 1 - (this.time / this.duration);
        ctx.font = `bold ${this.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class VisualFXManager {
    spawnHitParticle(x, y, color) {
        // Generates an inward converging particle burst that stays localized
        for (let i=0; i<10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 10 + Math.random() * 20;
            const px = x + Math.cos(angle) * dist;
            const py = y + Math.sin(angle) * dist;
            const vx = (x - px) * 2;
            const vy = (y - py) * 2;
            const duration = 0.2 + Math.random() * 0.2;
            const p = new Particle(px, py, vx, vy, color, duration);
            p.draw = function(ctx) {
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 1 - (this.time / this.duration);
                ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
                ctx.globalAlpha = 1.0;
            };
            this.particles.push(p);
        }
    }

    spawnPlayerDashPoof(x, y, color) {
        // A ring of dust when the player dashes
        const numParticles = 12;
        for (let i=0; i<numParticles; i++) {
            const angle = (i / numParticles) * Math.PI * 2;
            const speed = 20 + Math.random() * 30;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const duration = 0.4 + Math.random() * 0.3;
            const p = new Particle(x, y, vx, vy, color, duration);
            p.draw = function(ctx) {
                ctx.fillStyle = this.color;
                ctx.globalAlpha = (1 - (this.time / this.duration)) * 0.8;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 3 * (1 - (this.time / this.duration)), 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
            };
            this.particles.push(p);
        }
    }

    constructor() {
        this.particles = [];
        this.screenShake = 0;
        this.flashAmount = 0;
        this.flashColor = '#fff';
    }
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (!p.active) this.particles.splice(i, 1);
        }
        if (this.screenShake > 0) {
            this.screenShake -= dt * 10;
            if (this.screenShake < 0) this.screenShake = 0;
        }
        if (this.flashAmount > 0) {
            this.flashAmount -= dt * 3;
            if (this.flashAmount < 0) this.flashAmount = 0;
        }
    }
    draw(ctx) {
        for (const p of this.particles) p.draw(ctx);
        if (this.flashAmount > 0) {
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = this.flashAmount;
            ctx.fillRect(0, 0, 1280, 720);
            ctx.globalAlpha = 1.0;
        }
    }
    spawnDirectionalExplosion(x, y, count, color, dx, dy, spread) {
        for (let i=0; i<count; i++) {
            const baseAngle = Math.atan2(dy, dx);
            const angle = baseAngle + (Math.random() - 0.5) * spread;
            const speed = 50 + Math.random() * 250;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const duration = 0.3 + Math.random() * 0.4;
            this.particles.push(new Particle(x, y, vx, vy, color, duration));
        }
    }
    spawnFloatingText(x, y, text, color, size, duration = 1.0) {
        this.particles.push(new FloatingText(x, y, text, color, size, duration));
    }
    spawnMotionTrail(x, y, radius, color, duration = 0.3) {
        const p = new Particle(x, y, 0, 0, color, duration);
        p.radius = radius;
        p.draw = function(ctx) {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = (1 - (this.time / this.duration)) * 0.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        };
        this.particles.push(p);
    }

    spawnExplosion(x, y, count, color) {
        for (let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const duration = 0.5 + Math.random() * 0.5;
            this.particles.push(new Particle(x, y, vx, vy, color, duration));
        }
    }
    triggerShake(amount) {
        let intensity = 1.0;
        if (typeof game !== 'undefined' && game && game.save && game.save.data && game.save.data.options && game.save.data.options.shakeIntensity !== undefined) {
            intensity = game.save.data.options.shakeIntensity;
        }
        this.screenShake = Math.max(this.screenShake, amount * intensity);
    }
    triggerFlash(color, amount) {
        this.flashColor = color;
        this.flashAmount = amount;
    }
    spawnDashTrail(x, y, radius, color) {
        for (let i=0; i<3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 20;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const duration = 0.2 + Math.random() * 0.2;
            this.particles.push(new Particle(x, y, vx, vy, color, duration));
        }
    }
    spawnScoreText(x, y, text) {
        const p = new Particle(x, y, 0, -30, '#fff', 1.0);
        p.text = text;
        p.draw = function(ctx) {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 1 - (this.time / this.duration);
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
            ctx.globalAlpha = 1.0;
        };
        this.particles.push(p);
    }
    spawnEnemyDeath(x, y) {
        this.spawnExplosion(x, y, 15, '#ff5555');
        this.triggerShake(0.3);
    }
    spawnPlayerHit(x, y) {
        this.spawnExplosion(x, y, 30, '#c6f8c8');
        this.triggerShake(1.0);
        this.triggerFlash('#ff0000', 0.5);
    }
    getShakeOffset() {
        if (this.screenShake <= 0) return {x:0, y:0};
        const shake = this.screenShake * 15;
        return {
            x: (Math.random() - 0.5) * shake,
            y: (Math.random() - 0.5) * shake
        };
    }
}



class Projectile extends Entity {
    constructor(x, y, vx, vy, radius, color) {
        super(x, y, radius);
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = 5.0; // seconds
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Swarmer extends Enemy {
    constructor(x, y, speed, target) {
        super(x, y, speed * 1.5, target);
        this.radius = 8;
        this.color = '#ff9999';
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.fill();
    }
}

class RangedSniper extends Enemy {
    constructor(x, y, speed, target) {
        super(x, y, speed * 0.5, target);
        this.radius = 14;
        this.color = '#ff00ff';
        this.fireCooldown = 3.0;
        this.fireTimer = 2.0;
        this.telegraphing = false;
        this.telegraphTimer = 0;
    }
    update(dt) {
        if (!this.target) return super.update(dt);

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 300) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        } else if (dist < 150) {
            this.vx = -(dx / dist) * this.speed;
            this.vy = -(dy / dist) * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        // Entity update handles x += vx * dt
        super.update(dt);

        if (!this.telegraphing) {
            this.fireTimer -= dt;
            if (this.fireTimer <= 0) {
                this.telegraphing = true;
                this.telegraphTimer = 1.0;
            }
        } else {
            this.telegraphTimer -= dt;
            if (this.telegraphTimer <= 0 && game) {
                this.telegraphing = false;
                this.fireTimer = this.fireCooldown;
                const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                const pSpeed = 200;
                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle)*pSpeed, Math.sin(angle)*pSpeed, 6, '#ff00ff'));
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        if (this.telegraphing && this.target) {
            ctx.strokeStyle = `rgba(255, 0, 255, ${1.0 - this.telegraphTimer})`;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.target.x, this.target.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

class Bruiser extends Enemy {
    constructor(x, y, speed, target) {
        super(x, y, speed * 0.4, target);
        this.radius = 20;
        this.color = '#aa0000';
        this.hp = 2;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = this.x + Math.cos(angle) * this.radius;
            const py = this.y + Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        if (this.hp === 2) {
            ctx.fillStyle = '#ffaaaa';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Splitter extends Enemy {
    constructor(x, y, speed, target) {
        super(x, y, speed * 0.7, target);
        this.radius = 16;
        this.color = '#ffff00';
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class HazardSpawner extends Enemy {
    constructor(x, y, speed, target) {
        super(x, y, speed * 0.6, target);
        this.radius = 14;
        this.color = '#ff8800';
        this.spawnTimer = 5.0;
    }
    update(dt) {
        super.update(dt);
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && game) {
            this.spawnTimer = 5.0;
            game.hazards.push(new Quicksand(this.x, this.y, 40));
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Sandstorm Echo Coop
// Rhythm/Beat-Synced Reflex, Echo/Ghost Self-Cooperation, Desert Sandstorm Bazaar
const SAVE_KEY = 'arcade_game_053_053-sandstorm-echo-coop_v1';

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {}
        };
        this.load();
    }
    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                this.data = { ...this.data, ...JSON.parse(saved) };
            }
        } catch (e) { console.warn('Save load failed', e); }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) { console.warn('Save failed', e); }
    }
}

class MultiVoiceAudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
        this.AudioContextClass = window.AudioContext || window.webkitAudioContext;

        this.bgOsc = [];
        this.percussionOsc = [];
        this.isBossPhase = false;
        this.isLowHp = false;

        this.baseTempo = 120;
        this.currentTempo = 120;
        this.time = 0;
        this.nextNoteTime = 0;
        this.currentNote = 0;
        this.arpSequence = [0, 3, 7, 10, 12, 10, 7, 3];
        this.bossSequence = [0, 1, 6, 7, 12, 7, 6, 1];
        this.filter = null;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new this.AudioContextClass();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = "lowpass";
            this.filter.frequency.value = 800;

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.filter);
            this.filter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.masterGain.gain.value = 1.0;
            this.sfxGain.gain.value = 1.0;
            this.musicGain.gain.value = 0.5;

            this.initialized = true;
            this.scheduleNextNote();
        } catch(e) { console.warn('AudioContext init failed', e); }
    }

    updatePhase(isBoss, isLowHp) {
        this.isBossPhase = isBoss;
        this.isLowHp = isLowHp;

        if (this.isLowHp) {
            this.currentTempo = this.baseTempo * 1.5;
            this.filter.frequency.setTargetAtTime(2000, this.ctx.currentTime, 0.5);
        } else if (this.isBossPhase) {
            this.currentTempo = this.baseTempo * 1.25;
            this.filter.frequency.setTargetAtTime(1500, this.ctx.currentTime, 0.5);
        } else {
            this.currentTempo = this.baseTempo;
            this.filter.frequency.setTargetAtTime(800, this.ctx.currentTime, 0.5);
        }
    }

    scheduleNextNote() {
        if (!this.initialized || !this.ctx) return;
        const secondsPerBeat = 60.0 / this.currentTempo;
        const noteLength = secondsPerBeat * 0.25; // 16th notes

        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playArpNote(this.nextNoteTime, noteLength);
            if (this.currentNote % 4 === 0) {
                this.playKick(this.nextNoteTime);
            }
            if (this.currentNote % 4 === 2) {
                this.playSnare(this.nextNoteTime);
            }
            if (this.currentNote % 2 === 0) {
                this.playHihat(this.nextNoteTime);
            }

            this.nextNoteTime += secondsPerBeat * 0.25;
            this.currentNote = (this.currentNote + 1) % 16;
        }
        setTimeout(() => this.scheduleNextNote(), 25);
    }

    playArpNote(time, duration) {
        const seq = this.isBossPhase ? this.bossSequence : this.arpSequence;
        const note = seq[this.currentNote % seq.length];
        const baseFreq = this.isBossPhase ? 110 : 220; // A2 or A3
        const freq = baseFreq * Math.pow(2, note / 12);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = this.isBossPhase ? 'sawtooth' : 'triangle';
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.1);
    }

    playSnare(time) {
        // Noise buffer for snare
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);
        noise.stop(time + 0.1);

        // Snap osc
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time);
        oscGain.gain.setValueAtTime(0.4, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        osc.connect(oscGain);
        oscGain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    playHihat(time) {
        // Simple noise burst
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 7000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);
        noise.stop(time + 0.05);
    }

    // SFX
    playTone(freq, type, duration, vol, sweep = 0) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (sweep !== 0) {
            osc.frequency.exponentialRampToValueAtTime(freq * sweep, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playJump() { this.playTone(300, 'square', 0.1, 0.5, 1.5); }
    playHit() { this.playTone(100, 'sawtooth', 0.2, 0.7, 0.5); }
    playScore() { this.playTone(600, 'sine', 0.1, 0.4, 2); }
    playBeat() { this.playTone(150, 'triangle', 0.1, 0.6); }
    playGhostSpawn() { this.playTone(400, 'sine', 0.3, 0.4, 0.8); }
    playEcho() { this.playTone(800, 'sine', 0.05, 0.2); }

    // New SFX
    playShoot() { this.playTone(800, 'square', 0.1, 0.3, 0.5); }
    playEnemyHit() { this.playTone(200, 'sawtooth', 0.1, 0.5, 0.2); }
    playEnemyDeath() { this.playTone(150, 'sawtooth', 0.3, 0.6, 0.1); }
    playUpgrade() { this.playTone(400, 'sine', 0.5, 0.5, 3); }
    playUIClick() { this.playTone(1000, 'sine', 0.05, 0.3); }
    playDash() {
        // Noise burst for dash
        if (!this.initialized || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(2000, this.ctx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
        noise.stop(this.ctx.currentTime + 0.2);
    }
    playWeaponFire(type) {
        if (type === 'rapid') this.playTone(1200, 'square', 0.05, 0.2, 0.8);
        else if (type === 'spread') {
            this.playTone(600, 'sawtooth', 0.1, 0.3, 0.5);
            setTimeout(() => this.playTone(500, 'sawtooth', 0.1, 0.3, 0.5), 20);
        }
        else if (type === 'sniper') this.playTone(400, 'triangle', 0.3, 0.6, 0.1);
        else this.playShoot();
    }
    playExplosion() {
        if (!this.initialized || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
        noise.stop(this.ctx.currentTime + 0.5);
    }
    playHeal() {
        this.playTone(600, 'sine', 0.1, 0.4, 1.5);
        setTimeout(() => this.playTone(800, 'sine', 0.2, 0.4, 1.5), 100);
    }
    playBossSpawn() {
        this.playTone(100, 'sawtooth', 1.0, 0.8, 0.5);
        this.playTone(150, 'sawtooth', 1.0, 0.8, 0.5);
    }
    playBossHit() {
        this.playTone(80, 'sawtooth', 0.1, 0.9, 0.8);
    }
}


class InputManager {
    constructor() {
        this.keys = {};
        this.pointer = { x: 0, y: 0, down: false };
        this.touchActive = false;
        this.dashPressed = false;

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.code === 'ShiftLeft') this.dashPressed = true;
            if (game && game.sound) game.sound.init();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        const canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('pointerdown', e => {
            this.pointer.down = true;
            this.updatePointer(e);
            if (game && game.sound) game.sound.init();
        });
        canvas.addEventListener('pointermove', e => {
            this.updatePointer(e);
        });
        canvas.addEventListener('pointerup', e => {
            this.pointer.down = false;
            this.updatePointer(e);
        });
        canvas.addEventListener('touchstart', e => {
            this.touchActive = true;
            if (e.touches.length > 1) this.dashPressed = true; // Two-finger tap to dash
            if (game && game.sound) game.sound.init();
        }, {passive: false});
        canvas.addEventListener('touchmove', e => {
        }, {passive: false});
    }
    updatePointer(e) {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        this.pointer.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        this.pointer.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    }
    getAxis() {
        let x = 0; let y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

        if (this.touchActive && this.pointer.down) {
            const canvas = document.getElementById('gameCanvas');
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const dx = this.pointer.x - centerX;
            const dy = this.pointer.y - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 20) {
                x = dx / dist;
                y = dy / dist;
            }
        }

        const len = Math.sqrt(x*x + y*y);
        if (len > 0) {
            x /= len;
            y /= len;
        }

        const dash = this.dashPressed;
        this.dashPressed = false;

        return { x, y, dash };
    }
}
class ParallaxBackground {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [
            { speed: 0.1, yOffset: 0, color: '#3b2f2f', pattern: null, numDunes: 3 }, // Distant
            { speed: 0.3, yOffset: 0, color: '#684d3b', pattern: null, numDunes: 4 }, // Mid
            { speed: 0.8, yOffset: 0, color: '#916744', pattern: null, numDunes: 5 }  // Near
        ];
        this.windSpeed = 100;

        // Pre-generate patterns
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.width;
        tempCanvas.height = 300;
        const tempCtx = tempCanvas.getContext('2d');

        this.layers.forEach((layer, i) => {
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.fillStyle = layer.color;
            tempCtx.beginPath();
            tempCtx.moveTo(0, tempCanvas.height);
            for (let x = 0; x <= this.width; x += this.width / layer.numDunes) {
                tempCtx.quadraticCurveTo(x - this.width/(layer.numDunes*2), tempCanvas.height - (50 + i*30), x, tempCanvas.height - Math.random() * 20 - 10);
            }
            tempCtx.lineTo(this.width, tempCanvas.height);
            tempCtx.fill();

            // Add some noise
            for(let j=0; j<500; j++) {
                tempCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
                tempCtx.fillRect(Math.random() * this.width, tempCanvas.height - 100 + Math.random() * 100, 2, 2);
            }

            layer.pattern = new Image();
            layer.pattern.src = tempCanvas.toDataURL();
        });
    }
    update(dt) {
        this.layers.forEach(layer => {
            layer.yOffset -= this.windSpeed * layer.speed * dt;
            if (layer.yOffset <= -this.width) layer.yOffset += this.width;
            if (layer.yOffset >= this.width) layer.yOffset -= this.width;
        });
    }
    draw(ctx) {
        ctx.save();
        this.layers.forEach((layer, i) => {
            if (layer.pattern && layer.pattern.complete) {
                // Draw multiple times to cover horizontal wrapping
                ctx.drawImage(layer.pattern, layer.yOffset, this.height - 300 + i*50);
                ctx.drawImage(layer.pattern, layer.yOffset + this.width, this.height - 300 + i*50);
                ctx.drawImage(layer.pattern, layer.yOffset - this.width, this.height - 300 + i*50);
            }
        });

        // Draw foreground dust overlay
        ctx.fillStyle = 'rgba(200, 180, 150, 0.15)';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.restore();
    }
}

class Hazard extends Entity {
    constructor(x, y, radius) {
        super(x, y, radius);
    }
    applyEffect(entity, dt) {}
}

class Quicksand extends Hazard {
    constructor(x, y, radius) {
        super(x, y, radius);
        this.color = '#5a4231';
    }
    applyEffect(entity, dt) {
        if (this.collides(entity)) {
            entity.vx *= 0.5; // Strong slow down
            entity.vy *= 0.5;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();

        // Swirl effect
        ctx.strokeStyle = '#423023';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let angle = (game && game.time) ? game.time : 0;
        ctx.arc(this.x, this.y, this.radius * 0.7, angle, angle + Math.PI);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, angle + Math.PI/2, angle + Math.PI*1.5);
        ctx.stroke();
    }
}

class WindZone extends Hazard {
    constructor(x, y, width, height, dirX, dirY) {
        // Approximate as a large circle for generic collides, or override
        super(x + width/2, y + height/2, Math.max(width, height)/2);
        this.w = width;
        this.h = height;
        this.dirX = dirX;
        this.dirY = dirY;
        this.force = 400;
        this.particles = [];
        for(let i=0; i<10; i++) {
            this.particles.push({
                x: Math.random() * this.w,
                y: Math.random() * this.h,
                speed: 100 + Math.random() * 200
            });
        }
    }
    collidesEntity(ent) {
        const left = this.x - this.w/2 - ent.radius;
        const right = this.x + this.w/2 + ent.radius;
        const top = this.y - this.h/2 - ent.radius;
        const bottom = this.y + this.h/2 + ent.radius;
        return ent.x > left && ent.x < right && ent.y > top && ent.y < bottom;
    }
    applyEffect(entity, dt) {
        if (this.collidesEntity(entity)) {
            entity.x += this.dirX * this.force * dt;
            entity.y += this.dirY * this.force * dt;
        }
    }
    update(dt) {
        this.particles.forEach(p => {
            p.x += this.dirX * p.speed * dt;
            p.y += this.dirY * p.speed * dt;
            if (p.x > this.w) p.x -= this.w;
            if (p.x < 0) p.x += this.w;
            if (p.y > this.h) p.y -= this.h;
            if (p.y < 0) p.y += this.h;
        });
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);

        ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
        this.particles.forEach(p => {
            ctx.fillRect(this.x - this.w/2 + p.x, this.y - this.h/2 + p.y, 10, 2);
        });
    }
}

class DestructibleCrate extends Obstacle {
    constructor(x, y, w, h) {
        super(x, y, w, h);
        this.color = '#c28b55';
        this.hp = 1;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        const dw = this.w * this.beatScale;
        const dh = this.h * this.beatScale;
        const dx = this.x - dw/2;
        const dy = this.y - dh/2;
        ctx.fillRect(dx, dy, dw, dh);

        ctx.strokeStyle = '#8a5e35';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);

        // Draw cross lines
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + dw, dy + dh);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(dx + dw, dy);
        ctx.lineTo(dx, dy + dh);
        ctx.stroke();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = 1280;
        this.height = 720;

        this.hitStopTimer = 0;

        this.save = new SaveManager();
        this.sound = new MultiVoiceAudioEngine();
        this.input = new InputManager();
        this.vfx = new VisualFXManager();

        this.state = 'TITLE';
        this.lastTime = 0;
        this.time = 0;

        this.score = 0;
        this.wave = 1;

        this.player = null;
        this.ghosts = [];
        this.enemies = [];
        this.projectiles = [];
        this.obstacles = [];
        this.collectibles = [];
        this.hazards = [];
        this.crates = [];

        this.background = new ParallaxBackground(this.width, this.height);
        this.hazards = [];
        this.crates = [];

        this.beatInterval = 0.5;
        this.lastBeat = 0;

        this.initUI();
        this.setupResizeObserver();

        requestAnimationFrame(t => this.loop(t));

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.setPause(true);
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.setPause(true);
            }
        });
        window.addEventListener('keydown', e => {
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.state === 'PLAYING') this.setPause(true);
                else if (this.state === 'PAUSED') this.setPause(false);
            }
        });
    }

    initUI() {
        document.getElementById('btnPlay').addEventListener('click', () => {
            this.sound.init();
            this.sound.playUIClick();
            this.startGame();
        });
        document.getElementById('btnResume').addEventListener('click', () => {
            this.sound.init();
            this.sound.playUIClick();
            this.setPause(false);
        });
        document.getElementById('btnRestart').addEventListener('click', () => {
            this.sound.init();
            this.sound.playUIClick();
            this.startGame();
        });
    }

    setupResizeObserver() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(document.body);
        resize();
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        if (id) {
            document.getElementById(id).classList.add('active');
        }
    }

    startGame() {
        this.state = 'PLAYING';
        this.showScreen(null);
        this.score = 0;
        this.wave = 1;
        this.time = 0;
        this.lastBeat = 0;
        this.beatInterval = 0.6;

        this.player = new Player(this.width/2, this.height/2);
        this.ghosts = [];
        this.enemies = [];
        this.projectiles = [];
        this.obstacles = [];
        this.collectibles = [];
        this.hazards = [];
        this.crates = [];

        this.background = new ParallaxBackground(this.width, this.height);
        this.hazards = [];
        this.crates = [];

        this.generateLevel();

        this.save.data.totalGamesPlayed++;
        this.save.save();
    }

    setPause(paused) {
        if (paused) {
            this.state = 'PAUSED';
            this.showScreen('pauseScreen');
        } else {
            this.state = 'PLAYING';
            this.showScreen(null);
            this.lastTime = performance.now();
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        document.getElementById('finalScore').innerText = this.score;
        this.showScreen('gameOverScreen');

        if (this.score > this.save.data.highScore) {
            this.save.data.highScore = this.score;
        }
        this.save.data.totalScoreAccumulated += this.score;
        this.save.save();
        this.sound.playBossHit();
    }

    generateLevel() {
        this.obstacles = [];
        this.enemies = [];
        this.projectiles = [];
        this.collectibles = [];
        this.hazards = [];
        this.crates = [];
        this.currentBoss = null;

        if (this.wave > 0 && this.wave % 5 === 0) {
            if (this.sound) this.sound.playBossSpawn();
            // Boss Wave
            const bossX = this.width / 2;
            const bossY = -100;
            if (this.wave % 10 === 0) {
                this.currentBoss = new MirageSerpent(bossX, bossY, this.player);
            } else {
                this.currentBoss = new SandstormDjinn(bossX, bossY, this.player);
            }
            // Spawn some crates for cover
            for (let i=0; i<5; i++) {
                const w = 40;
                const h = 40;
                const x = Math.random() * (this.width - w);
                const y = Math.random() * (this.height - h);
                if (Math.abs(x - this.player.x) > 100 && Math.abs(y - this.player.y) > 100) {
                    this.crates.push(new DestructibleCrate(x, y, w, h));
                }
            }
            if (this.player.history.length > 0) {
                this.ghosts.push(new Ghost(this.player.history, 5.0));
                this.sound.playGhostSpawn();
            }
            this.player.history = [];
            this.player.time = 0;
            return; // Don't spawn normal stuff
        }

        // Spawn Quicksand
        for (let i=0; i<2; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            this.hazards.push(new Quicksand(x, y, 60 + Math.random() * 40));
        }

        // Spawn WindZone
        if (this.wave % 2 === 0) {
            const x = this.width / 2;
            const y = this.height / 2;
            const dirX = Math.random() > 0.5 ? 1 : -1;
            this.hazards.push(new WindZone(x, y, this.width, 200, dirX, 0));
        }

        // Spawn DestructibleCrates
        for (let i=0; i<3; i++) {
            const w = 40;
            const h = 40;
            const x = Math.random() * (this.width - w);
            const y = Math.random() * (this.height - h);
            if (Math.abs(x - this.player.x) > 100 && Math.abs(y - this.player.y) > 100) {
                this.crates.push(new DestructibleCrate(x, y, w, h));
            }
        }


        for (let i=0; i<5 + this.wave; i++) {
            const w = 50 + Math.random() * 100;
            const h = 50 + Math.random() * 100;
            const x = Math.random() * (this.width - w);
            const y = Math.random() * (this.height - h);

            if (Math.abs(x - this.player.x) > 150 && Math.abs(y - this.player.y) > 150) {
                this.obstacles.push(new Obstacle(x, y, w, h));
            }
        }

        for (let i=0; i<3 + this.wave; i++) {
            this.spawnCollectible();
        }

        if (this.wave > 1 && this.player.history.length > 0) {
            this.ghosts.push(new Ghost(this.player.history, 5.0));
            this.sound.playGhostSpawn();
        }

        this.player.history = [];
        this.player.time = 0;
    }

    spawnCollectible() {
        const x = 50 + Math.random() * (this.width - 100);
        const y = 50 + Math.random() * (this.height - 100);
        this.collectibles.push(new Collectible(x, y));
    }

    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * this.width; y = -20; }
        else if (side === 1) { x = this.width + 20; y = Math.random() * this.height; }
        else if (side === 2) { x = Math.random() * this.width; y = this.height + 20; }
        else { x = -20; y = Math.random() * this.height; }

        const speed = 100 + this.wave * 10;
        const r = Math.random();

        let enemyType;
        if (r < 0.2) enemyType = new Swarmer(x, y, speed, this.player);
        else if (r < 0.4) enemyType = new RangedSniper(x, y, speed, this.player);
        else if (r < 0.6) enemyType = new Bruiser(x, y, speed, this.player);
        else if (r < 0.8) enemyType = new Splitter(x, y, speed, this.player);
        else if (r < 0.95) enemyType = new HazardSpawner(x, y, speed, this.player);
        else enemyType = new Enemy(x, y, speed, this.player);

        this.enemies.push(enemyType);
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt > 0.1) dt = 0.1;

        if (this.state === 'PLAYING') {
            this.update(dt);
        }

        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }

    triggerHitStop(duration) {
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            if (this.vfx) this.vfx.update(dt);
            if (this.background) this.background.update(dt);
            if (this.hitStopTimer > 0) return;
        }
        this.time += dt;

        if (this.vfx) this.vfx.update(dt);

        if (this.time - this.lastBeat >= this.beatInterval) {
            this.lastBeat += this.beatInterval;
            this.sound.playBeat();

            if (Math.random() < 0.3 + (this.wave * 0.05)) {
                this.spawnEnemy();
            }
        }

        const axis = this.input.getAxis();

        if (this.background) this.background.update(dt);

        for (const hazard of this.hazards) {
            hazard.update(dt);
            hazard.applyEffect(this.player, dt);
            for (const enemy of this.enemies) hazard.applyEffect(enemy, dt);
            for (const ghost of this.ghosts) hazard.applyEffect(ghost, dt);
        }



        if (this.sound && this.sound.initialized) {
            const isBoss = this.currentBoss !== null;
            const isLowHp = this.player && (this.player.hp / this.player.maxHp <= 0.3);
            this.sound.updatePhase(isBoss, isLowHp);
        }

        if (this.currentBoss) {
            this.currentBoss.update(dt);
            if (this.currentBoss.active && this.currentBoss.collides(this.player)) {
                if (this.player.isDashing) {
                    if (this.currentBoss.hitTimer <= 0) {
                        this.currentBoss.hp -= 10; // Dash damage
                        this.currentBoss.hitTimer = 0.2;
                        this.sound.playEnemyHit();
                        this.player.triggerRecoil();
                        this.triggerHitStop(0.1);
                        this.vfx.triggerShake(0.5);
                        this.vfx.spawnDirectionalExplosion(this.currentBoss.x, this.currentBoss.y, 25, '#ff0000', this.player.vx, this.player.vy, 1.0);
                        this.vfx.spawnFloatingText(this.currentBoss.x, this.currentBoss.y - 30, 'CRIT 10', '#ffff00', 24, 0.8);
                    }
                } else {
                    this.vfx.spawnPlayerHit(this.player.x, this.player.y);
                    this.gameOver();
                    return;
                }
            }

            // Ghost body-blocking projectile logic is handled if we let projectiles hit ghosts
            // Wait, we need to make sure projectiles that hit player/ghost are destroyed

            if (this.currentBoss.hp <= 0) {
                this.score += 1000;
                this.sound.playEcho(); // Boss death
                this.triggerHitStop(0.5);
                this.vfx.triggerShake(1.5);
                this.vfx.spawnDirectionalExplosion(this.currentBoss.x, this.currentBoss.y, 100, '#ffaaaa', 0, -1, Math.PI * 2);
                this.vfx.spawnFloatingText(this.currentBoss.x, this.currentBoss.y - 50, 'BOSS DEFEATED', '#ffffff', 32, 2.0);
                this.currentBoss = null;
                // Move to next wave
                this.wave++;
                this.beatInterval = Math.max(0.3, this.beatInterval - 0.05);
                this.generateLevel();
                return; // Early return to avoid issues
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (p.life <= 0 || p.x < 0 || p.x > this.width || p.y < 0 || p.y > this.height) {
                this.projectiles.splice(i, 1);
                continue;
            }

            let blocked = false;
            for (const ghost of this.ghosts) {
                if (p.collidesEntity(ghost)) {
                    blocked = true;
                    this.vfx.spawnExplosion(p.x, p.y, 5, p.color);
                    this.projectiles.splice(i, 1);
                    break;
                }
            }
            if (blocked) continue;

            if (p.collidesEntity(this.player) && !this.player.isDashing) {
                this.vfx.spawnPlayerHit(this.player.x, this.player.y);
                this.gameOver();
                return;
            }
        }

        const oldX = this.player.x;
        const oldY = this.player.y;
        this.player.update(dt, axis);
        if (this.player.isDashing) {
            this.vfx.spawnMotionTrail(this.player.x, this.player.y, this.player.radius, '#ffffff', 0.2);
            this.vfx.spawnDirectionalExplosion(this.player.x, this.player.y, 2, '#88ccff', -this.player.vx, -this.player.vy, 0.5);
        }

        for (let i = this.crates.length - 1; i >= 0; i--) {
            const crate = this.crates[i];
            crate.update(dt);
            if (crate.collidesEntity(this.player)) {
                if (this.player.isDashing) {
                    this.crates.splice(i, 1);
                    this.sound.playEnemyHit();
                    this.score += 10;
                    this.vfx.spawnExplosion(crate.x, crate.y, 20, '#c28b55');
                    this.vfx.spawnScoreText(crate.x, crate.y, "+10");
                } else {
                    this.player.x = oldX;
                    this.player.y = oldY;
                    this.player.vx = 0;
                    this.player.vy = 0;
                }
            }
        }

        for (const obs of this.obstacles) {
            if (obs.collidesEntity(this.player)) {
                this.player.x = oldX;
                this.player.y = oldY;
                this.player.vx = 0;
                this.player.vy = 0;
            }
            obs.update(dt);
        }

        for (const ghost of this.ghosts) {
            ghost.update(dt);
            if (ghost.isDashing) {
                this.vfx.spawnMotionTrail(ghost.x, ghost.y, ghost.radius, '#c6f8c8', 0.2);
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt);

            if (enemy.collides(this.player)) {
                if (this.player.isDashing) {

                    if (enemy instanceof Bruiser && enemy.hp > 1) {
                        enemy.hp--;
                        this.sound.playEnemyHit();
                        this.player.triggerRecoil();
                        continue;
                    }
                    if (enemy instanceof Splitter) {
                        this.enemies.push(new Swarmer(enemy.x - 10, enemy.y, enemy.speed, this.player));
                        this.enemies.push(new Swarmer(enemy.x + 10, enemy.y, enemy.speed, this.player));
                    }
                    this.enemies.splice(i, 1);

                    this.sound.playEnemyHit();
                    this.player.triggerRecoil();
                    this.score += 25;
                    this.vfx.spawnEnemyDeath(enemy.x, enemy.y);
                    this.vfx.spawnScoreText(enemy.x, enemy.y, "+25");
                    continue;
                } else {
                    this.vfx.spawnPlayerHit(this.player.x, this.player.y);
                    this.gameOver();
                    return;
                }
            }

            let destroyed = false;
            for (const ghost of this.ghosts) {
                if (enemy.collides(ghost)) {
                    destroyed = true;
                    this.sound.playEcho();
                    this.score += 50;
                    this.vfx.spawnScoreText(enemy.x, enemy.y, "+50");
                    if (ghost.isDashing) {
                        this.score += 25;
                        this.vfx.spawnScoreText(enemy.x, enemy.y + 20, "DASH +25");
                    }
                    this.vfx.spawnEnemyDeath(enemy.x, enemy.y);
                    break;
                }
            }

            if (destroyed) {
                    if (enemy instanceof Bruiser && enemy.hp > 1) {
                        enemy.hp--;
                        this.sound.playEnemyHit();
                        this.player.triggerRecoil();
                        continue;
                    }
                    if (enemy instanceof Splitter) {
                        this.enemies.push(new Swarmer(enemy.x - 10, enemy.y, enemy.speed, this.player));
                        this.enemies.push(new Swarmer(enemy.x + 10, enemy.y, enemy.speed, this.player));
                    }
                    this.enemies.splice(i, 1);
            }
        }

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const col = this.collectibles[i];
            col.update(dt);

            if (col.collides(this.player)) {
                this.score += 100;
                this.sound.playScore();
                this.collectibles.splice(i, 1);
                this.vfx.spawnScoreText(col.x, col.y, "+100");
                this.vfx.spawnExplosion(col.x, col.y, 10, '#ffff00');
            } else {
                for (const ghost of this.ghosts) {
                    if (col.collides(ghost)) {
                        this.score += 50;
                        this.sound.playScore();
                        this.collectibles.splice(i, 1);
                        this.vfx.spawnScoreText(col.x, col.y, "+50");
                        this.vfx.spawnExplosion(col.x, col.y, 10, '#ffff00');
                        break;
                    }
                }
            }
        }

        if (!this.currentBoss && this.collectibles.length === 0) {
            this.wave++;
            this.beatInterval = Math.max(0.3, this.beatInterval - 0.05);
            this.generateLevel();
        }
    }

    draw() {
        this.ctx.fillStyle = '#1a1311';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        const scale = Math.min(this.canvas.width / this.width, this.canvas.height / this.height);
        const offsetX = (this.canvas.width - this.width * scale) / 2;
        const offsetY = (this.canvas.height - this.height * scale) / 2;

        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.width, this.height);
        this.ctx.clip();

        const shake = this.vfx ? this.vfx.getShakeOffset() : {x:0, y:0};
        this.ctx.translate(shake.x, shake.y);

        if (this.background) this.background.draw(this.ctx);

        this.ctx.strokeStyle = 'rgba(198, 248, 200, 0.1)';
        this.ctx.lineWidth = 1;
        for(let i=0; i<this.width; i+=50) {
            this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,this.height); this.ctx.stroke();
        }
        for(let i=0; i<this.height; i+=50) {
            this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(this.width,i); this.ctx.stroke();
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            for (const hazard of this.hazards) hazard.draw(this.ctx);
            for (const obs of this.obstacles) obs.draw(this.ctx);
            for (const crate of this.crates) crate.draw(this.ctx);
            for (const col of this.collectibles) col.draw(this.ctx);
            for (const ghost of this.ghosts) ghost.draw(this.ctx);

        for (const p of this.projectiles) p.draw(this.ctx);

        for (const enemy of this.enemies) enemy.draw(this.ctx);
            if (this.currentBoss) this.currentBoss.draw(this.ctx);
            if (this.player) this.player.draw(this.ctx);

            if (this.vfx) this.vfx.draw(this.ctx);

            if (this.currentBoss) this.currentBoss.drawUI(this.ctx);


            this.ctx.fillStyle = '#c6f8c8';
            this.ctx.font = '24px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 20, 40);
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 70);

            this.ctx.textAlign = 'right';
            this.ctx.fillText(`High Score: ${this.save.data.highScore}`, this.width - 20, 40);

            const beatTime = (this.time / this.beatInterval) % 1;
            const radius = 10 + Math.sin(beatTime * Math.PI) * 10;
            this.ctx.beginPath();
            this.ctx.arc(this.width / 2, 40, radius, 0, Math.PI*2);
            this.ctx.fillStyle = `rgba(198, 248, 200, ${1 - beatTime})`;
            this.ctx.fill();

            if (this.player && typeof this.player.dashCooldown !== 'undefined') {
                const dashReady = this.player.dashCooldown <= 0;
                const dashRatio = 1.0 - (this.player.dashCooldown / this.player.dashMaxCooldown);

                this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this.ctx.fillRect(20, this.height - 40, 200, 20);

                this.ctx.fillStyle = dashReady ? '#c6f8c8' : '#888';
                this.ctx.fillRect(20, this.height - 40, 200 * Math.max(0, dashRatio), 20);

                this.ctx.strokeStyle = '#c6f8c8';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(20, this.height - 40, 200, 20);

                this.ctx.fillStyle = '#111';
                this.ctx.font = '14px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(dashReady ? "DASH READY (Space)" : "RECHARGING...", 120, this.height - 25);
            }
        }

        this.ctx.restore();
    }
}
let game = null;
window.addEventListener('DOMContentLoaded', () => {
    game = new GameEngine();
});
