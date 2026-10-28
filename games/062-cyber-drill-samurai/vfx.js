class VFXManager {
    constructor() {
        this.particles = [];
        this.popups = [];
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.hitStopTimer = 0;
        this.trails = [];
    }

    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            return;
        }

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        this.particles = this.particles.filter(p => {
            p.update(dt);
            return p.life > 0;
        });

        this.popups = this.popups.filter(p => {
            p.update(dt);
            return p.life > 0;
        });

        this.trails = this.trails.filter(t => {
            t.update(dt);
            return t.life > 0;
        });
    }

    draw(ctx, cameraY) {
        if (this.shakeTimer > 0) {
            const sx = (Math.random() - 0.5) * this.shakeIntensity;
            const sy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(sx, sy);
        }

        this.trails.forEach(t => t.draw(ctx, cameraY));
        this.particles.forEach(p => p.draw(ctx, cameraY));
        this.popups.forEach(p => p.draw(ctx, cameraY));

        if (this.shakeTimer > 0) {
            ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform
        }
    }

    addHitStop(duration) {
        this.hitStopTimer = duration;
    }

    addShake(duration, intensity) {
        this.shakeTimer = duration;
        let mult = 1;
        if (window.engine && window.engine.uiManager) {
           const opt = window.engine.uiManager.options.screenShake;
           if (opt === 'Off') mult = 0;
           else if (opt === '50%') mult = 0.5;
        }
        this.shakeTimer = duration;
        this.shakeIntensity = intensity * mult;
    }

    spawnDirectionalParticles(x, y, color, count, dx, dy, speed, spread) {
        let spawnCount = count;
        if (window.engine && window.engine.uiManager) {
           if (window.engine.uiManager.options.particleDensity === 'Low') spawnCount = Math.ceil(count / 3);
        }
        for (let i = 0; i < spawnCount; i++) {
            const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * spread;
            const curSpeed = speed * (0.5 + Math.random() * 0.5);
            this.particles.push(new AdvancedParticle(x, y, color, Math.cos(angle) * curSpeed, Math.sin(angle) * curSpeed));
        }
    }

    spawnExplosion(x, y, color, count) {
        let spawnCount = count;
        if (window.engine && window.engine.uiManager) {
           if (window.engine.uiManager.options.particleDensity === 'Low') spawnCount = Math.ceil(count / 3);
        }
        for (let i = 0; i < spawnCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            this.particles.push(new AdvancedParticle(x, y, color, Math.cos(angle) * speed, Math.sin(angle) * speed));
        }
    }

    addPopup(x, y, text, color) {
        this.popups.push(new DamagePopup(x, y, text, color));
    }

    addTrail(x, y, color, size, life) {
        this.trails.push(new Trail(x, y, color, size, life));
    }
}

class AdvancedParticle {
    constructor(x, y, color, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.color = color;
        this.size = Math.random() * 4 + 2;
        this.drag = 0.95;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= this.drag;
        this.vy *= this.drag;
        this.life -= dt * 2;
    }
    draw(ctx, cameraY) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2 - cameraY, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

class DamagePopup {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.vy = -50;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx, cameraY) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.font = 'bold 20px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y - cameraY);
        ctx.globalAlpha = 1.0;
    }
}

class Trail {
    constructor(x, y, color, size, life) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx, cameraY) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y - cameraY, this.size/2, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}
