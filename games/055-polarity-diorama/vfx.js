class JuiceManager {
    constructor(engine) {
        this.engine = engine;
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeIntensity = 0;
        this.hitStopTimer = 0;
        this.popups = [];
        this.particles = [];
        this.trails = [];
    }

    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            return;
        }

        if (this.shakeIntensity > 0) {
            this.shakeIntensity -= dt * 50;
            if (this.shakeIntensity < 0) this.shakeIntensity = 0;
            const angle = Math.random() * Math.PI * 2;
            this.shakeX = Math.cos(angle) * this.shakeIntensity;
            this.shakeY = Math.sin(angle) * this.shakeIntensity;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }

        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.y -= 30 * dt;
            p.life -= dt;
            if (p.life <= 0) this.popups.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.9;
            p.vy *= 0.9;
            p.life -= dt * 2;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.trails.length - 1; i >= 0; i--) {
            const t = this.trails[i];
            t.life -= dt * 3;
            if (t.life <= 0) this.trails.splice(i, 1);
        }
    }

    applyShake(ctx) {
        // Fallback for options.mute if it exists, assume no shake if true
        if (this.engine.saveManager && this.engine.saveManager.data && this.engine.saveManager.data.options && this.engine.saveManager.data.options.mute === true) {
            // we'll still allow shake, maybe reduce it, or if there's a specific screen shake option we would use it.
            // Currently options only has 'mute' according to trace. We will just use the intensity directly.
        }

        let sx = this.shakeX;
        let sy = this.shakeY;
        const maxShake = 20;
        if (sx > maxShake) sx = maxShake;
        if (sx < -maxShake) sx = -maxShake;
        if (sy > maxShake) sy = maxShake;
        if (sy < -maxShake) sy = -maxShake;

        ctx.translate(sx, sy);
    }

    draw(ctx) {
        this.trails.forEach(t => {
            ctx.save();
            ctx.globalAlpha = t.life;
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            ctx.restore();
        });

        this.popups.forEach(p => {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        });
    }

    addShake(intensity, dx, dy) {
        this.shakeIntensity += intensity;
        if (dx !== 0 || dy !== 0) {
            const angle = Math.atan2(dy, dx);
            this.shakeX = Math.cos(angle) * intensity;
            this.shakeY = Math.sin(angle) * intensity;
        }
    }

    addHitStop(duration) {
        this.hitStopTimer = duration;
    }

    addPopup(text, x, y, color) {
        this.popups.push({
            text: text,
            x: x,
            y: y,
            color: color,
            life: 1.0
        });
    }

    emitDirectionalParticles(x, y, dx, dy, color, count) {
        const baseAngle = Math.atan2(dy, dx);
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (Math.random() - 0.5) * 1.5; // Spread cone
            const speed = Math.random() * 200 + 50;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: color,
                size: Math.random() * 5 + 2,
                life: 1.0
            });
        }
    }

    emitTrail(x, y, color, radius) {
        this.trails.push({
            x: x,
            y: y,
            color: color,
            radius: radius,
            life: 1.0
        });
    }
}
