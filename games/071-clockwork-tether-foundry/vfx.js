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
        this.x += this.vx * dt * 60;
        this.y += this.vy * dt * 60;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
        ctx.globalAlpha = 1;
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
        this.vy = -30;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }
}
class Afterimage {
    constructor(x, y, radius, color, life) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life / this.maxLife) * 0.5;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
class VFXManager {
    constructor() {
        this.particles = [];
        this.floatingTexts = [];
        this.afterimages = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.hitStop = 0;
    }
    update(dt, game) {
        if (this.hitStop > 0) {
            this.hitStop -= dt;
            return;
        }
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
        }
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            this.afterimages[i].update(dt);
            if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
        }
    }
    draw(ctx, game) {
        for (const ai of this.afterimages) ai.draw(ctx);
        for (const p of this.particles) p.draw(ctx);
        for (const ft of this.floatingTexts) ft.draw(ctx);
    }
    applyShake(ctx, options) {
        if (this.shakeTime > 0) {
            let multiplier = 1;
            if (options && options.shakeIntensity !== undefined) {
                multiplier = options.shakeIntensity / 100;
            }
            const mag = this.shakeIntensity * multiplier;
            if (mag > 0) {
                const dx = (Math.random() - 0.5) * mag;
                const dy = (Math.random() - 0.5) * mag;
                ctx.save();
                ctx.translate(dx, dy);
                return;
            }
        }
        ctx.save();
    }
    restoreShake(ctx) {
        ctx.restore();
    }
    emit(x, y, count, color, speedBase = 5) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * speedBase;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = 0.2 + Math.random() * 0.4;
            const size = 2 + Math.random() * 4;
            this.particles.push(new Particle(x, y, vx, vy, color, life, size));
        }
    }
    emitDirectional(x, y, count, color, dirX, dirY, spread = 0.5, speedBase = 5) {
        const baseAngle = Math.atan2(dirY, dirX);
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (Math.random() - 0.5) * spread;
            const speed = (0.5 + Math.random()) * speedBase;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const life = 0.2 + Math.random() * 0.4;
            const size = 2 + Math.random() * 4;
            this.particles.push(new Particle(x, y, vx, vy, color, life, size));
        }
    }
    addText(x, y, text, color) {
        this.floatingTexts.push(new FloatingText(x, y, text, color, 1.0));
    }
    addAfterimage(x, y, radius, color) {
        this.afterimages.push(new Afterimage(x, y, radius, color, 0.3));
    }
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTime = duration;
    }
    freeze(duration) {
        this.hitStop = duration;
    }
}