class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color, life, size) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.vy = -50;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = `bold ${this.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

class Trail {
    constructor(x, y, w, h, color, life, shape) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.shape = shape; // 'circle', 'rect'
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife) * 0.5;
        ctx.fillStyle = this.color;
        if (this.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.w, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        }
        ctx.globalAlpha = 1;
    }
}

class VFXManager {
    constructor(engine) {
        this.engine = engine;
        this.particles = [];
        this.texts = [];
        this.trails = [];
        this.hitStopTimer = 0;

        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeDirX = 0;
        this.shakeDirY = 0;
    }

    triggerHitStop(duration) {
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }

    triggerScreenShake(duration, intensity, dirX = 0, dirY = 0) {
        // Respect options intensity
        let userIntensity = 1;
        if (this.engine.saveManager && this.engine.saveManager.data.options && this.engine.saveManager.data.options.screenShake !== undefined) {
            userIntensity = this.engine.saveManager.data.options.screenShake;
        }

        this.shakeTimer = duration;
        this.shakeIntensity = intensity * userIntensity;

        const mag = Math.hypot(dirX, dirY);
        if (mag > 0) {
            this.shakeDirX = dirX / mag;
            this.shakeDirY = dirY / mag;
        } else {
            this.shakeDirX = 0;
            this.shakeDirY = 0;
        }
    }

        emitParticles(x, y, count, baseColor, speed, dirX = 0, dirY = 0, spread = Math.PI * 2) {
        let actualCount = count;
        if (this.engine.saveManager && this.engine.saveManager.data.options && this.engine.saveManager.data.options.particles === 'low') {
            actualCount = Math.max(1, Math.floor(count * 0.3));
        }

        for (let i = 0; i < actualCount; i++) {
            let angle = 0;
            if (spread >= Math.PI * 2) {
                angle = Math.random() * Math.PI * 2;
            } else {
                const baseAngle = Math.atan2(dirY, dirX);
                angle = baseAngle + (Math.random() - 0.5) * spread;
            }
            const v = speed * (0.5 + Math.random() * 0.5);
            const vx = Math.cos(angle) * v;
            const vy = Math.sin(angle) * v;
            const life = 0.3 + Math.random() * 0.5;
            const size = 2 + Math.random() * 4;
            this.particles.push(new Particle(x, y, vx, vy, baseColor, life, size));
        }
    }

    spawnFloatingText(x, y, text, color, size = 20) {
        this.texts.push(new FloatingText(x, y, text, color, 1.0, size));
    }

    spawnTrail(x, y, w, h, color, life = 0.2, shape = 'circle') {
        this.trails.push(new Trail(x, y, w, h, color, life, shape));
    }

    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            // When hitstop is active, do not update particles or shake timers
            return;
        }

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.texts.length - 1; i >= 0; i--) {
            this.texts[i].update(dt);
            if (this.texts[i].life <= 0) {
                this.texts.splice(i, 1);
            }
        }

        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].update(dt);
            if (this.trails[i].life <= 0) {
                this.trails.splice(i, 1);
            }
        }
    }

    applyShake(ctx) {
        if (this.shakeTimer > 0 && this.shakeIntensity > 0) {
            const mag = this.shakeIntensity * (this.shakeTimer > 0.1 ? 1 : this.shakeTimer * 10);
            let dx, dy;
            if (this.shakeDirX !== 0 || this.shakeDirY !== 0) {
                // Directional shake
                const factor = Math.sin(this.shakeTimer * 50);
                dx = this.shakeDirX * mag * factor;
                dy = this.shakeDirY * mag * factor;
            } else {
                // Random shake
                dx = (Math.random() - 0.5) * mag;
                dy = (Math.random() - 0.5) * mag;
            }
            ctx.translate(dx, dy);
        }
    }

    draw(ctx) {
        for (const t of this.trails) t.draw(ctx);
        for (const p of this.particles) p.draw(ctx);
        for (const txt of this.texts) txt.draw(ctx);
    }
}
