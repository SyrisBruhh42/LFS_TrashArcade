class VFXManager {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.floatingTexts = [];
        this.trails = [];
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeX = 0;
        this.shakeY = 0;
        this.hitStopTimer = 0;
    }
    shakeScreen(intensity, duration) {
        const optionsIntensity = this.game.saves.data.options && this.game.saves.data.options.shakeIntensity !== undefined ? this.game.saves.data.options.shakeIntensity : 1;
        this.shakeIntensity = intensity * optionsIntensity;
        this.shakeTimer = duration;
    }
    hitStop(duration) {
        this.hitStopTimer = duration;
    }
    addFloatingText(x, y, text, color) {
        this.floatingTexts.push({
            x: x, y: y,
            text: text,
            color: color,
            life: 1.0,
            maxLife: 1.0,
            vy: -30
        });
    }
    addTrail(x, y, radius, color, life, alpha = 0.5) {
        this.trails.push({
            x: x, y: y,
            radius: radius,
            color: color,
            life: life,
            maxLife: life,
            alpha: alpha
        });
    }
    spawnDirectionalParticles(x, y, count, color, baseAngle, spread, minSpeed, maxSpeed) {
        for(let i=0; i<count; i++) {
            let angle = baseAngle + (Math.random() - 0.5) * spread;
            let speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0,
                color: color
            });
        }
    }
    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
        }
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            this.shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
            this.shakeIntensity *= 0.9;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
            this.shakeIntensity = 0;
        }
        for (let p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);
        for (let ft of this.floatingTexts) {
            ft.x += (Math.random() - 0.5) * 10 * dt;
            ft.y += ft.vy * dt;
            ft.life -= dt;
        }
        this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);
        for (let tr of this.trails) {
            tr.life -= dt;
        }
        this.trails = this.trails.filter(tr => tr.life > 0);
    }
    drawUnder(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let tr of this.trails) {
            ctx.globalAlpha = Math.max(0, (tr.life / tr.maxLife)) * tr.alpha;
            ctx.fillStyle = tr.color;
            ctx.beginPath();
            ctx.arc(tr.x, tr.y, tr.radius, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
    drawOver(ctx) {
        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px monospace';
        for (let ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            const progress = 1 - (ft.life / ft.maxLife);
            ctx.globalAlpha = Math.max(0, 1 - Math.pow(progress, 3));
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1;
    }
}
