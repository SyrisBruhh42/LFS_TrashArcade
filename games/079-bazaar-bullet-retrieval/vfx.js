class VFXSystem {
    constructor() {
        this.particles = [];
        this.trails = [];
        this.floatingTexts = [];
        this.hitStopTimer = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    triggerHitStop(duration) {
        if (duration > this.hitStopTimer) {
            this.hitStopTimer = duration;
        }
    }

    triggerShake(duration, intensity) {
        if (intensity >= this.shakeIntensity) {
            this.shakeTimer = duration;
            this.shakeIntensity = intensity;
        }
    }

    addTrail(x, y, radius, color, life) {
        this.trails.push({ x, y, radius, color, life, maxLife: life });
    }

    emitParticles(x, y, count, color, speed, dirX, dirY, spread) {
        for (let i = 0; i < count; i++) {
            let angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * spread;
            let currentSpeed = speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * currentSpeed,
                vy: Math.sin(angle) * currentSpeed,
                color,
                life: Math.random() * 0.5 + 0.2,
                maxLife: 1,
                radius: Math.random() * 3 + 1
            });
        }
    }

    addFloatingText(x, y, text, color, life, size = 16) {
        this.floatingTexts.push({
            x, y, text, color, life, maxLife: life, size, vy: -50
        });
    }

    updateHitStop(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            return true; // Game should skip update
        }
        return false;
    }

    update(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            if (this.shakeTimer <= 0) {
                this.shakeX = 0;
                this.shakeY = 0;
                this.shakeIntensity = 0;
            }
        }

        for (let i = this.trails.length - 1; i >= 0; i--) {
            let t = this.trails[i];
            t.life -= dt;
            if (t.life <= 0) this.trails.splice(i, 1);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    drawBottom(ctx) {
        ctx.globalCompositeOperation = 'lighter';
        for (let t of this.trails) {
            ctx.fillStyle = t.color;
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife) * 0.5;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
    }

    drawTop(ctx) {
        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        ctx.textAlign = 'center';
        for (let ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
            ctx.font = `${ft.size}px monospace`;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1.0;
    }
}
