class VFXManager {
    constructor() {
        this.floatingTexts = [];
        this.shakeTime = 0;
        this.shakeMagnitude = 0;
        this.shakeDirX = 0;
        this.shakeDirY = 0;
        this.hitStopTime = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    addFloatingText(x, y, text, color, isCrit) {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 1.0,
            maxLife: 1.0,
            vy: -50,
            scale: isCrit ? 1.5 : 1.0
        });
    }

    addScreenShake(magnitude, duration, dirX = 0, dirY = 0) {
        let intensityMult = 1.0;
        if (window.game && window.game.save && window.game.save.data && window.game.save.data.options) {
            if (window.game.save.data.options.screenShake === '50%') intensityMult = 0.5;
            if (window.game.save.data.options.screenShake === 'Off') intensityMult = 0;
        }
        this.shakeMagnitude = magnitude * intensityMult;
        this.shakeTime = duration;
        if (dirX !== 0 || dirY !== 0) {
            let len = Math.sqrt(dirX*dirX + dirY*dirY);
            this.shakeDirX = dirX / len;
            this.shakeDirY = dirY / len;
        } else {
            this.shakeDirX = 0;
            this.shakeDirY = 0;
        }
    }

    addHitStop(duration) {
        this.hitStopTime = Math.max(this.hitStopTime, duration);
    }

    emitParticles(x, y, color, count, speed, dirX = 0, dirY = 0, spread = Math.PI*2) {
        if (!window.game) return;
        let intensityMult = 1.0;
        if (window.game.save && window.game.save.data && window.game.save.data.options) {
            if (window.game.save.data.options.particles === 'Low') intensityMult = 0.3;
        }
        let actualCount = Math.ceil(count * intensityMult);

        let baseAngle = 0;
        if (dirX !== 0 || dirY !== 0) {
            baseAngle = Math.atan2(dirY, dirX);
        }

        for (let i = 0; i < actualCount; i++) {
            let p = new Particle(x, y, color);
            let angle = baseAngle + (Math.random() - 0.5) * spread;
            let s = speed * (0.5 + Math.random() * 0.5);
            p.vx = Math.cos(angle) * s;
            p.vy = Math.sin(angle) * s;
            window.game.particles.push(p);
        }
    }

    addThrusterParticles(x, y, dx, dy) {
        if (!window.game) return;
        let intensityMult = 1.0;
        if (window.game.save && window.game.save.data && window.game.save.data.options) {
            if (window.game.save.data.options.particles === 'Low') intensityMult = 0.3;
        }
        let actualCount = Math.ceil(3 * intensityMult);
        for (let i = 0; i < actualCount; i++) {
            let p = new Particle(x, y, '#ffaa00');
            p.life = 0.2 + Math.random() * 0.2;
            p.maxLife = p.life;
            p.vx = dx * (100 + Math.random() * 50) + (Math.random() - 0.5) * 50;
            p.vy = dy * (100 + Math.random() * 50) + (Math.random() - 0.5) * 50;
            window.game.particles.push(p);
        }
    }

    update(dt) {
        // Enforce maximum float text capacity to prevent extreme memory leak during long sessions
        if (this.floatingTexts.length > 100) {
            this.floatingTexts.splice(0, this.floatingTexts.length - 100);
        }
        // Also cleanup trails if trail manager exists
        if (window.game && window.game.trailManager && window.game.trailManager.trails.length > 200) {
            window.game.trailManager.trails.splice(0, window.game.trailManager.trails.length - 200);
        }
        // Cleanup particles if excessive
        if (window.game && window.game.particles && window.game.particles.length > 500) {
            window.game.particles.splice(0, window.game.particles.length - 500);
        }

        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            let currentMag = this.shakeMagnitude * (this.shakeTime / 0.5); // decay
            if (this.shakeDirX !== 0 || this.shakeDirY !== 0) {
                let osc = Math.sin(this.shakeTime * 40);
                this.offsetX = this.shakeDirX * currentMag * osc;
                this.offsetY = this.shakeDirY * currentMag * osc;
            } else {
                this.offsetX = (Math.random() - 0.5) * 2 * currentMag;
                this.offsetY = (Math.random() - 0.5) * 2 * currentMag;
            }
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
            this.shakeTime = 0;
        }

        for (let t of this.floatingTexts) {
            t.y += t.vy * dt;
            t.life -= dt;
        }
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
    }

    draw(ctx, cameraY) {
        ctx.save();
        for (let t of this.floatingTexts) {
            let alpha = t.life / t.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = t.color;
            ctx.font = `bold ${20 * t.scale}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y - cameraY);
        }
        ctx.restore();
    }
}
