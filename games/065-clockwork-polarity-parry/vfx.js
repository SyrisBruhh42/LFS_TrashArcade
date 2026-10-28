class VFXManager {
    constructor() {
        this.particles = [];
        this.popups = [];
        this.trails = [];
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.hitStopTimer = 0;
    }

    addHitStop(duration) {
        if (this.hitStopTimer < duration) {
            this.hitStopTimer = duration;
        }
    }

    addScreenShake(intensity, duration) {
        if (window.game && window.game.saveManager && window.game.saveManager.data.options && typeof window.game.saveManager.data.options.screenShake !== 'undefined') {
            intensity *= window.game.saveManager.data.options.screenShake;
        }
        // Respects options - to be implemented in phase 9, currently active
        // But the prompt says "respecting Options intensity", let's check options if available.
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    addParticle(x, y, vx, vy, color, life, size) {
        this.particles.push({
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            color: color,
            life: life,
            maxLife: life,
            size: size
        });
    }

    emitExplosion(x, y, color, count) {
        if (window.game && window.game.saveManager && window.game.saveManager.data.options && window.game.saveManager.data.options.particleDensity === 'Low') count = Math.ceil(count / 2);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 150 + 50;
            this.addParticle(
                x, y,
                Math.cos(angle) * speed, Math.sin(angle) * speed,
                color,
                Math.random() * 0.4 + 0.2,
                Math.random() * 4 + 2
            );
        }
    }

    emitDirectional(x, y, dx, dy, color, count, spread = 0.5) {
        if (window.game && window.game.saveManager && window.game.saveManager.data.options && window.game.saveManager.data.options.particleDensity === 'Low') count = Math.ceil(count / 2);
        const baseAngle = Math.atan2(dy, dx);
        for (let i = 0; i < count; i++) {
            const angle = baseAngle + (Math.random() - 0.5) * spread;
            const speed = Math.random() * 100 + 50;
            this.addParticle(
                x, y,
                Math.cos(angle) * speed, Math.sin(angle) * speed,
                color,
                Math.random() * 0.3 + 0.1,
                Math.random() * 3 + 2
            );
        }
    }

    addPopup(x, y, text, color, scale = 1) {
        this.popups.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 0.8,
            maxLife: 0.8,
            scale: scale,
            vy: -30
        });
    }

    addTrail(x, y, size, color, life = 0.2) {
        this.trails.push({
            x: x,
            y: y,
            size: size,
            color: color,
            life: life,
            maxLife: life
        });
    }

    update(rawDt) {
        // Update Hit Stop
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= rawDt;
        }

        // Update Screen Shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= rawDt;
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.life -= rawDt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * rawDt;
            p.y += p.vy * rawDt;
            p.vx *= 0.9; // friction
            p.vy *= 0.9;
        }

        // Update Popups
        for (let i = this.popups.length - 1; i >= 0; i--) {
            let p = this.popups[i];
            p.life -= rawDt;
            if (p.life <= 0) {
                this.popups.splice(i, 1);
                continue;
            }
            p.y += p.vy * rawDt;
            p.vy *= 0.9; // smooth easing upward
        }

        // Update Trails
        for (let i = this.trails.length - 1; i >= 0; i--) {
            let t = this.trails[i];
            t.life -= rawDt;
            if (t.life <= 0) {
                this.trails.splice(i, 1);
            }
        }
    }

    applyShake(ctx) {
        if (this.shakeTimer > 0) {
            let intensity = this.shakeIntensity * (this.shakeTimer / 0.5); // decay
            if (intensity > this.shakeIntensity) intensity = this.shakeIntensity;
            const dx = (Math.random() - 0.5) * intensity;
            const dy = (Math.random() - 0.5) * intensity;
            ctx.translate(dx, dy);
        }
    }

    draw(ctx) {
        // Draw Trails
        ctx.globalCompositeOperation = 'lighter';
        for (let t of this.trails) {
            ctx.globalAlpha = t.life / t.maxLife;
            ctx.fillStyle = t.color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        // Draw Particles
        for (let p of this.particles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Draw Popups
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let p of this.popups) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            let fontSize = (16 * p.scale) * (0.5 + 0.5 * (p.life / p.maxLife));
            ctx.font = `bold ${fontSize}px monospace`;
            ctx.fillText(p.text, p.x, p.y);
        }
        ctx.globalAlpha = 1.0;
    }
}
