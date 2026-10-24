class VFXManager {
    constructor() {
        this.particles = [];
        this.floatingTexts = [];
        this.shockwaves = [];
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        this.hitStopFrames = 0;
    }

    createShockwave(x, y, color) {
        this.shockwaves.push(new Shockwave(x, y, color));
    }
    addParticle(x, y, color, speed, angle, life, size=3) {
        const set = window.game && window.game.saveManager && window.game.saveManager.data ? window.game.saveManager.data.settings : {particleDensity: 'High'};
        if (set && set.particleDensity === 'Low' && Math.random() < 0.5) return;
        this.particles.push({
            x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            color, life, maxLife: life, size
        });
    }
    createExplosion(x, y, color, count=20, speed=100) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * speed;
            this.addParticle(x, y, color, spd, angle, 0.5 + Math.random()*0.5);
        }
    }
    addFloatingText(x, y, text, color='#fff', size=20) {
        this.floatingTexts.push({
            x, y, text, color, size, life: 1.0, maxLife: 1.0, vy: -30
        });
    }
    shake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTime = duration;
    }
    triggerHitStop(durationMs) {
        this.hitStopFrames = durationMs;
    }
    update(dt) {
        if (this.hitStopFrames > 0) {
            this.hitStopFrames -= dt;
            return true;
        }
        if (this.shakeTime > 0) this.shakeTime -= dt;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * (dt / 1000); p.y += p.vy * (dt / 1000);
            p.life -= dt / 1000;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let ft = this.floatingTexts[i];
            ft.y += ft.vy * (dt / 1000); ft.life -= dt / 1000;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
        for (let i = this.shockwaves.length - 1; i >= 0; i--) {
            this.shockwaves[i].update(dt);
            if (!this.shockwaves[i].active) this.shockwaves.splice(i, 1);
        }
        return false;
    }
    applyShake(ctx) {
        if (this.shakeTime > 0) {
            const set = window.game && window.game.saveManager && window.game.saveManager.data ? window.game.saveManager.data.settings : {screenShake: 1.0};
            const shakeMult = set ? set.screenShake : 1.0;
            const dx = (Math.random() - 0.5) * this.shakeIntensity * shakeMult;
            const dy = (Math.random() - 0.5) * this.shakeIntensity * shakeMult;
            ctx.translate(dx, dy);
        }
    }
    draw(ctx) {
        for (let p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let ft of this.floatingTexts) {
            const progress = 1.0 - (ft.life / ft.maxLife);
            ctx.globalAlpha = ft.life / ft.maxLife;
            ctx.font = `bold ${ft.size + progress * 5}px sans-serif`;
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillStyle = ft.color; ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1.0;

        for (let s of this.shockwaves) {
            s.draw(ctx);
        }
    }
}

class Shockwave {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.maxRadius = 100;
        this.thickness = 10;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.active = true;
    }

    update(dt) {
        if (!this.active) return;
        this.radius += 150 * (dt / 1000);
        this.life -= dt / 1000;
        if (this.life <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.lineWidth = this.thickness * (this.life / this.maxLife);
        ctx.strokeStyle = this.color;
        ctx.stroke();
        ctx.restore();
    }
}
