class VFXManager {
    constructor(game) {
        this.game = game;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeDirX = 0;
        this.shakeDirY = 0;
        this.hitStopTimer = 0;
        this.popups = [];
        this.trails = [];
    }
    triggerShake(intensity, duration, dirX = 0, dirY = 0) {
        let factor = 1;
        if (this.game.saveManager && this.game.saveManager.data.options && this.game.saveManager.data.options.shakeIntensity !== undefined) {
            factor = this.game.saveManager.data.options.shakeIntensity;
        }
        this.shakeIntensity = intensity * factor;
        this.shakeTimer = duration;
        this.shakeDirX = dirX;
        this.shakeDirY = dirY;
    }
    triggerHitStop(duration) {
        this.hitStopTimer = duration;
    }
    addPopup(x, y, text, colorCode, isCombo = false) {
        this.popups.push({
            x: x,
            y: y,
            text: text,
            color: colorCode === 1 ? '#ff3366' : (colorCode === -1 ? '#33ccff' : '#ffffff'),
            life: 1.0,
            maxLife: 1.0,
            isCombo: isCombo,
            velY: -50
        });
    }
    addTrail(x, y, radius, colorCode, life, alpha = 0.5) {
        this.trails.push({
            x: x,
            y: y,
            radius: radius,
            color: colorCode === 1 ? '#ff3366' : (colorCode === -1 ? '#33ccff' : '#ffffff'),
            life: life,
            maxLife: life,
            initialAlpha: alpha
        });
    }
    update(dt) {
        if (this.shakeTimer > 0) this.shakeTimer -= dt;
        for (let i = this.popups.length - 1; i >= 0; i--) {
            let p = this.popups[i];
            p.life -= dt;
            p.y += p.velY * dt;
            if (p.life <= 0) this.popups.splice(i, 1);
        }
        for (let i = this.trails.length - 1; i >= 0; i--) {
            let t = this.trails[i];
            t.life -= dt;
            if (t.life <= 0) this.trails.splice(i, 1);
        }
    }
    applyShake(ctx) {
        if (this.shakeTimer > 0) {
            const mag = this.shakeIntensity * (this.shakeTimer / 0.5);
            let dx = (Math.random() - 0.5) * 2 * mag;
            let dy = (Math.random() - 0.5) * 2 * mag;
            if (this.shakeDirX !== 0 || this.shakeDirY !== 0) {
                dx = this.shakeDirX * mag * (Math.random() > 0.5 ? 1 : -1);
                dy = this.shakeDirY * mag * (Math.random() > 0.5 ? 1 : -1);
            }
            ctx.translate(dx, dy);
        }
    }
    drawPopups(ctx) {
        ctx.save();
        ctx.textAlign = 'center';
        for (let p of this.popups) {
            const alpha = Math.max(0, p.life / p.maxLife);
            const ease = 1 - Math.pow(1 - alpha, 3);
            const scale = p.isCombo ? 1.5 + (1 - ease) : 1.0 + (1 - ease) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.font = `bold ${Math.floor(20 * scale)}px sans-serif`;
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(p.text, p.x, p.y);
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.restore();
    }
    drawTrails(ctx) {
        ctx.save();
        for (let t of this.trails) {
            const alpha = Math.max(0, t.life / t.maxLife) * t.initialAlpha;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius * (t.life / t.maxLife), 0, Math.PI * 2);
            ctx.fillStyle = t.color;
            ctx.fill();
        }
        ctx.restore();
    }
}
