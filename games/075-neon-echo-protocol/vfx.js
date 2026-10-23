class FloatingText {
    constructor(x, y, text, color) {
        this.pos = new Vector2(x, y);
        this.startPos = new Vector2(x, y);
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.active = true;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
        }
        // Ease out quad
        let t = 1.0 - (this.life / this.maxLife);
        let ease = 1 - (1 - t) * (1 - t);
        this.pos.y = this.startPos.y - ease * 30;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Courier New';
        ctx.fillText(this.text, this.pos.x, this.pos.y);
        ctx.restore();
    }
}

class DirectionalParticle {
    constructor(x, y, vx, vy, color, life) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2(vx, vy);
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.active = true;
    }
    update(dt) {
        this.pos = this.pos.add(this.vel.mul(dt));
        this.vel = this.vel.mul(0.9); // drag
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        let ratio = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = ratio;
        ctx.fillStyle = this.color;
        let size = 2 + ratio * 3;
        ctx.fillRect(this.pos.x - size/2, this.pos.y - size/2, size, size);
        ctx.restore();
    }
}

class MotionTrail {
    constructor(x, y, radius, color, life) {
        this.pos = new Vector2(x, y);
        this.radius = radius;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.active = true;
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, (this.life / this.maxLife) * 0.5);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class VFXManager {
    constructor() {
        this.particles = [];
        this.texts = [];
        this.trails = [];
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.hitStopTimer = 0;
    }

    update(dt, game) {
        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.active);

        this.texts.forEach(t => t.update(dt));
        this.texts = this.texts.filter(t => t.active);

        this.trails.forEach(t => t.update(dt));
        this.trails = this.trails.filter(t => t.active);

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
        }
    }

    draw(ctx, game) {
        this.trails.forEach(t => t.draw(ctx));
        this.particles.forEach(p => p.draw(ctx));
        this.texts.forEach(t => t.draw(ctx));
    }

    applyShake(ctx) {
        if (this.shakeTimer > 0) {
            // Apply scale logic if options present, otherwise default to 1
            let optionScale = 1.0;
            if (window.game && window.game.saveManager && window.game.saveManager.data.options) {
                if (window.game.saveManager.data.options.screenShake !== undefined) {
                    optionScale = window.game.saveManager.data.options.screenShake;
                }
            }
            let intensity = this.shakeIntensity * optionScale * (this.shakeTimer > 0.1 ? 1 : this.shakeTimer * 10);
            let dx = (Math.random() - 0.5) * 2 * intensity;
            let dy = (Math.random() - 0.5) * 2 * intensity;
            ctx.translate(dx, dy);
        }
    }

    hitStop(duration) {
        this.hitStopTimer = Math.max(this.hitStopTimer, duration);
    }

    shakeScreen(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTimer = Math.max(this.shakeTimer, duration);
    }

    spawnFloatingText(x, y, text, color) {
        this.texts.push(new FloatingText(x, y, text, color));
    }

    spawnHitSparks(x, y, vx, vy, count, color) {
        for(let i=0; i<count; i++) {
            let speed = 50 + Math.random() * 100;
            let dir = (new Vector2(vx, vy)).norm();
            if (dir.mag() === 0) dir = new Vector2(1, 0); // fallback
            // spread
            let angle = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 1.5;
            let pvx = Math.cos(angle) * speed;
            let pvy = Math.sin(angle) * speed;
            this.particles.push(new DirectionalParticle(x, y, pvx, pvy, color, 0.2 + Math.random()*0.3));
        }
    }

    spawnExplosion(x, y, color, count) {
        if (window.game && window.game.saveManager && window.game.saveManager.data.options) {
            if (window.game.saveManager.data.options.particleDensity === 'Low') {
                count = Math.max(1, Math.floor(count / 2));
            }
        }
        for(let i=0; i<count; i++) {
            let speed = 50 + Math.random() * 150;
            let angle = Math.random() * Math.PI * 2;
            let pvx = Math.cos(angle) * speed;
            let pvy = Math.sin(angle) * speed;
            this.particles.push(new DirectionalParticle(x, y, pvx, pvy, color, 0.4 + Math.random()*0.4));
        }
    }

    spawnTrail(entity) {
        this.trails.push(new MotionTrail(entity.pos.x, entity.pos.y, entity.radius, entity.color, 0.3));
    }
}
