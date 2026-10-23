class VFXManager {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.popups = [];
        this.trails = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.hitStop = 0;
        this.ctx = game.ctx;
    }
    update(dt) {
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            return true;
        }
        if (this.shakeTime > 0) this.shakeTime -= dt;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) { this.particles.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.friction) { p.vx *= p.friction; p.vy *= p.friction; }
        }
        for (let i = this.popups.length - 1; i >= 0; i--) {
            let p = this.popups[i];
            p.life -= dt;
            if (p.life <= 0) { this.popups.splice(i, 1); continue; }
            p.y -= 30 * dt;
        }
        for (let i = this.trails.length - 1; i >= 0; i--) {
            let t = this.trails[i];
            t.life -= dt;
            if (t.life <= 0) this.trails.splice(i, 1);
        }
        return false;
    }
    draw(ctx) {
        for (let t of this.trails) {
            ctx.save();
            ctx.globalAlpha = (t.life / t.maxLife) * 0.5;
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
        for (let p of this.particles) {
            ctx.save();
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
        for (let p of this.popups) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, p.life * 2);
            ctx.fillStyle = p.color;
            ctx.font = `bold ${p.size}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x, p.y);
            ctx.restore();
        }
    }
    addTrail(x, y, radius, color) {
        this.trails.push({ x, y, radius, color, life: 0.3, maxLife: 0.3 });
    }
    addPopup(x, y, text, color = '#fff', size = 20) {
        this.popups.push({ x, y, text, color, size, life: 1.0, maxLife: 1.0 });
    }
    addParticles(x, y, count, color, speed, direction = null, spread = Math.PI*2) {
        for (let i = 0; i < count; i++) {
            let angle = (direction !== null) ? (direction - spread/2 + Math.random() * spread) : (Math.random() * Math.PI * 2);
            let spd = speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
                x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
                color, radius: 2 + Math.random() * 3, life: 0.3 + Math.random() * 0.4,
                maxLife: 0.7, friction: 0.95
            });
        }
    }
    addShake(intensity, duration) {
        const userIntensity = this.game.saveManager?.data?.options?.shakeIntensity ?? 1.0;
        this.shakeIntensity = intensity * userIntensity;
        this.shakeTime = duration;
    }
    applyShake(ctx) {
        if (this.shakeTime > 0 && this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            ctx.translate(dx, dy);
        }
    }
    triggerHitStop(duration) {
        this.hitStop = duration;
    }
}
