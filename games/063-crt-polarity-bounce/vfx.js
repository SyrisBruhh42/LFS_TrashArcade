class FloatingText {
    constructor(text, x, y, color) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = 1.0;
        this.vy = -50;
    }
    update(dt) {
        this.vy *= 0.95; // Smooth easing
        this.y += this.vy * dt;
        this.life -= dt;
    }






    draw(ctx) {


        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class VFXManager {
    constructor(game) {
        this.game = game;
        this.hitStopDuration = 0;
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.floatingTexts = [];
        this.bossWarnings = [];
    }

    addHitStop(duration) {
        this.hitStopDuration = duration;
    }

    addScreenShake(intensity, duration) {
        intensity *= (this.game && this.game.saveManager && this.game.saveManager.data.options.screenShake !== undefined ? this.game.saveManager.data.options.screenShake : 1.0);
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
    }

    addBossWarning(x, y, duration) {
        this.bossWarnings.push(new BossSpawnWarning(x, y, duration));
    }

    addFloatingText(text, x, y, color) {
        this.floatingTexts.push(new FloatingText(text, x, y, color));
    }

    update(dt) {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.update(dt);
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }


        for (let i = this.bossWarnings.length - 1; i >= 0; i--) {
            const bw = this.bossWarnings[i];
            bw.update(dt);
            if (bw.duration <= 0) this.bossWarnings.splice(i, 1);
        }

        if (this.hitStopDuration > 0) {
            this.hitStopDuration -= dt; // dt might be real time dt, not game dt if we pause game dt
        }

        if (this.shakeDuration > 0) {
            this.shakeDuration -= dt;
        } else {
            this.shakeIntensity = 0;
        }
    }




    draw(ctx) {



        for (let bw of this.bossWarnings) {
            bw.draw(ctx);
        }

        for (let ft of this.floatingTexts) {
            ft.draw(ctx);
        }
    }

    applyShake(ctx) {
        if (this.shakeIntensity > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
        }
    }
}

// Additional VFX logic

class BossSpawnWarning {
    constructor(x, y, duration) {
        this.x = x;
        this.y = y;
        this.duration = duration;
        this.maxDuration = duration;
        this.rings = [];
        for(let i=0; i<3; i++) {
            this.rings.push({radius: i * 30, alpha: 1});
        }
    }

    update(dt) {
        this.duration -= dt;
        for (let r of this.rings) {
            r.radius += 100 * dt;
            if (r.radius > 200) {
                r.radius = 0;
            }
            r.alpha = 1 - (r.radius / 200);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.duration / this.maxDuration);
        for (let r of this.rings) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        ctx.fillStyle = '#ff0000';
        ctx.font = '30px monospace';
        ctx.textAlign = 'center';
        ctx.globalAlpha = (Math.sin(Date.now() / 100) + 1) / 2; // pulse
        ctx.fillText('WARNING: ANOMALY DETECTED', this.x, this.y - 100);
        ctx.restore();
    }
}

class SubParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 0;
    }
}
