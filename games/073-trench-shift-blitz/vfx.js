class VFXManager {
    constructor(engine) {
        this.engine = engine;
        this.particles = [];
        this.floatingTexts = [];
        this.shakeTimer = 0;
        this.shakeMag = 0;
        this.hitStopTimer = 0;
        this.trails = [];
    }
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            return true;
        }
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= 0.95;
                p.vy *= 0.95;
            }
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let ft = this.floatingTexts[i];
            ft.life -= dt;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            } else {
                ft.y += ft.vy * dt;
                ft.vy *= 0.9;
            }
        }
        for (let i = this.trails.length - 1; i >= 0; i--) {
            let t = this.trails[i];
            t.life -= dt;
            if (t.life <= 0) {
                this.trails.splice(i, 1);
            }
        }
        return false;
    }
    applyShake(ctx) {
        if (this.shakeTimer > 0) {
            let intensity = this.engine.saveManager.data.options.shakeIntensity !== undefined ? this.engine.saveManager.data.options.shakeIntensity : 1.0;
            let sx = (Math.random() - 0.5) * this.shakeMag * intensity;
            let sy = (Math.random() - 0.5) * this.shakeMag * intensity;
            ctx.translate(sx, sy);
        }
    }
    draw(ctx, cellSize, offset) {
        for (let t of this.trails) {
            ctx.globalAlpha = t.life / t.maxLife * 0.5;
            ctx.fillStyle = t.color;
            ctx.fillRect(offset.x + t.x * cellSize + cellSize*0.1, offset.y + t.y * cellSize + cellSize*0.1, cellSize*0.8, cellSize*0.8);
        }
        ctx.globalAlpha = 1.0;
        for (let p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        for (let ft of this.floatingTexts) {
            let alpha = Math.min(1.0, ft.life / 0.3);
            ctx.fillStyle = `rgba(${ft.colorR}, ${ft.colorG}, ${ft.colorB}, ${alpha})`;
            ctx.font = `bold ${ft.size}px monospace`;
            ctx.textAlign = "center";
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = 2;
            ctx.strokeText(ft.text, ft.x, ft.y);
        }
    }
    emitParticles(x, y, color, count, speed, isBurst) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let vel = speed * (0.5 + Math.random() * 0.5);
            if (!isBurst) angle += (Math.random() - 0.5);
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * vel,
                vy: Math.sin(angle) * vel,
                color: color,
                size: 2 + Math.random() * 3,
                life: 0.3 + Math.random() * 0.4,
                maxLife: 0.7
            });
        }
    }
    spawnFloatingText(x, y, text, colorR, colorG, colorB, size = 20) {
        this.floatingTexts.push({
            x: x, y: y,
            text: text,
            vy: -40 - Math.random() * 20,
            colorR: colorR, colorG: colorG, colorB: colorB,
            size: size,
            life: 1.0,
            maxLife: 1.0
        });
    }
    triggerShake(mag, time) {
        if (mag > this.shakeMag || this.shakeTimer <= 0) {
            this.shakeMag = mag;
            this.shakeTimer = time;
        }
    }
    triggerHitStop(time) {
        if (time > this.hitStopTimer) {
            this.hitStopTimer = time;
        }
    }
    addTrail(x, y, color) {
        this.trails.push({
            x: x, y: y, color: color, life: 0.3, maxLife: 0.3
        });
    }
}