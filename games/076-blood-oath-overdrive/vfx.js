class FloatingText {
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
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Afterimage {
    constructor(x, y, size, color, life) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife) * 0.5;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class DirectionalParticle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.9;
        this.vy *= 0.9;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.restore();
    }
}

class VFXManager {
    constructor() {
        this.texts = [];
        this.afterimages = [];
        this.directionalParticles = [];
    }
    spawnText(x, y, text, color) {
        this.texts.push(new FloatingText(x, y, text, color));
    }
    spawnAfterimage(x, y, size, color, life) {
        this.afterimages.push(new Afterimage(x, y, size, color, life));
    }
    emitSparks(x, y, dirX, dirY, count, color) {
        for (let i = 0; i < count; i++) {
            const spread = 0.5;
            const vx = dirX * 300 + (Math.random() - 0.5) * spread * 300;
            const vy = dirY * 300 + (Math.random() - 0.5) * spread * 300;
            this.directionalParticles.push(new DirectionalParticle(x, y, vx, vy, 0.5 + Math.random() * 0.5, color, 3 + Math.random() * 3));
        }
    }
    emitExplosion(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 100 + Math.random() * 200;
            this.directionalParticles.push(new DirectionalParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.5 + Math.random() * 0.5, color, 4 + Math.random() * 4));
        }
    }
    update(dt) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            this.texts[i].update(dt);
            if (this.texts[i].life <= 0) this.texts.splice(i, 1);
        }
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            this.afterimages[i].update(dt);
            if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
        }
        for (let i = this.directionalParticles.length - 1; i >= 0; i--) {
            this.directionalParticles[i].update(dt);
            if (this.directionalParticles[i].life <= 0) this.directionalParticles.splice(i, 1);
        }
    }
    draw(ctx) {
        for (let p of this.directionalParticles) p.draw(ctx);
        for (let a of this.afterimages) a.draw(ctx);
        for (let t of this.texts) t.draw(ctx);
    }
}
