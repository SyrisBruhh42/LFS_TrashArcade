class VFXManager {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.floatingTexts = [];
        this.shakeTimer = 0;
        this.shakeMagnitude = 0;
    }

    update(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let t = this.floatingTexts[i];
            t.y += t.vy * dt;
            t.life -= dt;
            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        if (this.shakeTimer > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            let dx = (Math.random() - 0.5) * this.shakeMagnitude;
            let dy = (Math.random() - 0.5) * this.shakeMagnitude;
            ctx.translate(dx, dy);
        }

        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        for (let t of this.floatingTexts) {
            ctx.fillStyle = t.color;
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(t.text, t.x, t.y);
            ctx.globalAlpha = 1;
        }

        if (this.shakeTimer > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }

    addShake(magnitude, duration) {
        this.shakeMagnitude = magnitude;
        this.shakeTimer = duration;
    }

    burst(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 100 + 50;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: 1.0,
                size: Math.random() * 3 + 2,
                color: color
            });
        }
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push({
            x: x,
            y: y,
            vy: -50,
            text: text,
            color: color,
            life: 1.5,
            maxLife: 1.5
        });
    }
}
