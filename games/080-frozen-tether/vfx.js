class FloatingText {
    constructor(x, y, text, color, isCritical) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.targetY = y - 40 - Math.random() * 20;
        this.isCritical = isCritical;
        this.scale = isCritical ? 2.0 : 1.0;
        this.vx = (Math.random() - 0.5) * 50;
    }
    update(dt) {
        this.life -= dt * 1.5;
        this.y += (this.targetY - this.y) * 10 * dt;
        this.x += this.vx * dt;
        if (this.scale > 1.0) {
            this.scale -= dt * 3;
            if (this.scale < 1.0) this.scale = 1.0;
        }
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.fillStyle = this.color;
        ctx.font = this.isCritical ? 'bold 24px sans-serif' : 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, 0, 0);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText(this.text, 0, 0);
        ctx.restore();
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
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife) * 0.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class DirectionalParticle {
    constructor(x, y, color, vx, vy, life = 1.0, size = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.radius = size || (Math.random() * 4 + 2);
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * (1.0 / this.maxLife);
        this.vx *= 0.95;
        this.vy *= 0.95;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class VFXManager {
    constructor(saveManager) {
        this.saveManager = saveManager;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeDirX = 0;
        this.shakeDirY = 0;
        this.hitStopTimer = 0;
        this.floatingTexts = [];
        this.afterimages = [];
        this.particles = [];

        if (!this.saveManager.data.options) {
            this.saveManager.data.options = { shakeIntensity: 1.0 };
        }
        if (this.saveManager.data.options.shakeIntensity === undefined) {
             this.saveManager.data.options.shakeIntensity = 1.0;
        }
    }

    triggerShake(intensity, dirX = 0, dirY = 0) {
        let mult = this.saveManager.data.options.shakeIntensity !== undefined ? this.saveManager.data.options.shakeIntensity : 1.0;
        this.shakeIntensity = intensity * mult;
        this.shakeTimer = 0.2;
        this.shakeDirX = dirX;
        this.shakeDirY = dirY;
    }

    triggerHitStop(duration) {
        this.hitStopTimer = duration;
    }

    addFloatingText(x, y, text, color, isCritical = false) {
        this.floatingTexts.push(new FloatingText(x, y, text, color, isCritical));
    }

    addAfterimage(x, y, radius, color, life = 0.3) {
        this.afterimages.push(new Afterimage(x, y, radius, color, life));
    }

    addParticle(x, y, color, vx, vy, life = 1.0, size = null) {
        this.particles.push(new DirectionalParticle(x, y, color, vx, vy, life, size));
    }

    emitExplosion(x, y, color, count = 20, speed = 200) {
        let pd = (window.game && window.game.saveManager) ? window.game.saveManager.data.options.particleDensity : 1.0;
        let actualCount = count * (pd || 1.0);
        for(let i=0; i<actualCount; i++) {
            let angle = Math.random() * Math.PI * 2;
            let currentSpeed = speed * (0.2 + Math.random() * 0.8);
            this.addParticle(x, y, color, Math.cos(angle)*currentSpeed, Math.sin(angle)*currentSpeed);
        }
    }

    emitDirectional(x, y, color, dirX, dirY, spread = 0.5, count = 10, speed = 300) {
        let pd = (window.game && window.game.saveManager) ? window.game.saveManager.data.options.particleDensity : 1.0;
        let actualCount = count * (pd || 1.0);
        let baseAngle = Math.atan2(dirY, dirX);
        for(let i=0; i<actualCount; i++) {
            let angle = baseAngle + (Math.random() - 0.5) * spread;
            let currentSpeed = speed * (0.5 + Math.random() * 0.5);
            this.addParticle(x, y, color, Math.cos(angle)*currentSpeed, Math.sin(angle)*currentSpeed);
        }
    }

    update(dt) {
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            if (this.shakeTimer < 0) this.shakeTimer = 0;
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            this.afterimages[i].update(dt);
            if (this.afterimages[i].life <= 0) {
                this.afterimages.splice(i, 1);
            }
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    applyShake(ctx) {
        if (this.shakeTimer > 0) {
            let decay = this.shakeTimer / 0.2;
            let ss = (window.game && window.game.saveManager) ? window.game.saveManager.data.options.screenShake : 1.0;
            let mult = (ss !== undefined) ? ss : 1.0;
            let amt = this.shakeIntensity * decay * mult;
            let dx = (Math.random() - 0.5) * 2 * amt;
            let dy = (Math.random() - 0.5) * 2 * amt;
            if (this.shakeDirX !== 0 || this.shakeDirY !== 0) {
                dx += this.shakeDirX * amt;
                dy += this.shakeDirY * amt;
            }
            ctx.translate(dx, dy);
        }
    }

    draw(ctx) {
        for (let a of this.afterimages) a.draw(ctx);
        for (let p of this.particles) p.draw(ctx);
        for (let ft of this.floatingTexts) ft.draw(ctx);
    }
}
