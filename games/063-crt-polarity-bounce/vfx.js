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
    }

    addHitStop(duration) {
        this.hitStopDuration = duration;
    }

    addScreenShake(intensity, duration) {
        intensity *= (this.game && this.game.saveManager && this.game.saveManager.data.options.screenShake !== undefined ? this.game.saveManager.data.options.screenShake : 1.0);
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
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
class SubParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 0;
    }
}
