class Particle {
    constructor(x, y, color, speed, dir, life, size) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = Math.cos(dir) * speed;
        this.vy = Math.sin(dir) * speed;
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
        let alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class FloatingText {
    constructor(x, y, text, color, life) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.y -= 20 * dt;
        this.life -= dt;
    }
    draw(ctx) {
        let alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class VFXManager {
    constructor() {
        this.particles = [];
        this.texts = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
    }

    addShake(intensity, duration) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        this.shakeIntensity = intensity;
        this.shakeTime = duration;
    }

    burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            let speed = 50 + Math.random() * 150;
            let dir = Math.random() * Math.PI * 2;
            let life = 0.3 + Math.random() * 0.5;
            let size = 2 + Math.random() * 3;
            this.particles.push(new Particle(x, y, color, speed, dir, life, size));
        }
    }

    addFloatingText(x, y, text, color) {
        this.texts.push(new FloatingText(x, y, text, color, 1.0));
    }

    update(dt) {
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
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
    }

    applyShake(ctx) {
        ctx.save();
        if (this.shakeTime > 0) {
            let dx = (Math.random() - 0.5) * this.shakeIntensity;
            let dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
        }
    }

    clearShake(ctx) {
        ctx.restore();
    }

    draw(ctx) {
        for (let p of this.particles) p.draw(ctx);
        for (let t of this.texts) t.draw(ctx);
    }
}
