class Particle {
    constructor(x, y, vx, vy, color, life, size) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.life = life; this.maxLife = life;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class FloatingText {
    constructor(x, y, text, color, life) {
        this.x = x; this.y = y; this.text = text; this.color = color;
        this.life = life; this.maxLife = life; this.vy = -30;
    }
    update(dt) {
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        let p = this.life / this.maxLife;
        let alpha = p * (2 - p);
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1;
    }
}

class Trail {
    constructor(x, y, radius, color, life) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.life = life; this.maxLife = life;
    }
    update(dt) { this.life -= dt; }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.globalAlpha = (this.life / this.maxLife) * 0.5;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class VFXManager {
    constructor() {
        this.particles = [];
        this.texts = [];
        this.trails = [];
        this.shakeTimer = 0;
        this.shakeMag = 0;
        this.shakeDir = {x: 0, y: 0};
        this.hitStopTimer = 0;
    }
    emit(x, y, count, color, speed, spreadAngle, dirAngle) {
        for (let i = 0; i < count; i++) {
            let angle = dirAngle !== undefined ? dirAngle + (Math.random() - 0.5) * spreadAngle : Math.random() * Math.PI * 2;
            let spd = Math.random() * speed + speed * 0.5;
            this.particles.push(new Particle(x, y, Math.cos(angle) * spd, Math.sin(angle) * spd, color, 0.3 + Math.random() * 0.3, 2 + Math.random() * 3));
        }
    }
    addText(x, y, text, color) {
        this.texts.push(new FloatingText(x, y, text, color, 1.0));
    }
    addTrail(x, y, radius, color) {
        this.trails.push(new Trail(x, y, radius, color, 0.2));
    }
    addShake(mag, time, dirX = Math.random() - 0.5, dirY = Math.random() - 0.5) {
        this.shakeMag = mag;
        this.shakeTimer = time;
        let len = Math.hypot(dirX, dirY);
        if (len === 0) { dirX = 1; dirY = 0; len = 1; }
        this.shakeDir = {x: dirX / len, y: dirY / len};
    }
    getShakeOffset() {
        if (this.shakeTimer <= 0) return {x: 0, y: 0};
        let t = this.shakeTimer * 20;
        let decay = this.shakeTimer;
        return {
            x: Math.sin(t) * this.shakeMag * decay * this.shakeDir.x,
            y: Math.sin(t * 1.3) * this.shakeMag * decay * this.shakeDir.y
        };
    }
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            return true;
        }
        if (this.shakeTimer > 0) this.shakeTimer -= dt;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.texts.length - 1; i >= 0; i--) {
            this.texts[i].update(dt);
            if (this.texts[i].life <= 0) this.texts.splice(i, 1);
        }
        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].update(dt);
            if (this.trails[i].life <= 0) this.trails.splice(i, 1);
        }
        return false;
    }
    draw(ctx) {
        for (let t of this.trails) t.draw(ctx);
        for (let p of this.particles) p.draw(ctx);
    }
    drawUI(ctx, cx, cy) {
        ctx.save();
        ctx.translate(-cx, -cy);
        for (let t of this.texts) t.draw(ctx);
        ctx.restore();
    }
}
