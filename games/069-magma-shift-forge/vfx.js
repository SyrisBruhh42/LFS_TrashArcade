class VFXManager {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.hitstopTime = 0;
        this.shakeIntensity = 0;
        this.shakeTime = 0;
        this.particles = [];
        this.texts = [];
        this.afterimages = [];
    }

    triggerHitstop(duration) {
        this.hitstopTime = duration;
    }

    triggerShake(intensity, duration) {
        if (intensity > this.shakeIntensity || this.shakeTime <= 0) {
            this.shakeIntensity = intensity;
            this.shakeTime = duration;
        }
    }

    emitParticles(x, y, color, speed, count, angleBase, spread) {
        for(let i=0; i<count; i++) {
            const angle = angleBase + (Math.random() - 0.5) * spread;
            const spd = speed * (0.5 + Math.random() * 0.5);
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life: 0.5 + Math.random() * 0.5,
                color
            });
        }
    }

    addFloatingText(x, y, text, color) {
        this.texts.push({
            x, y, text, color, life: 1.0, maxLife: 1.0,
            vy: -30
        });
    }

    addAfterimage(x, y, angle, thrust, color, life, scale=1) {
        this.afterimages.push({
            x, y, angle, thrust, color, life, maxLife: life, scale
        });
    }

    update(dt) {
        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
            if (this.shakeTime <= 0) this.shakeIntensity = 0;
        }

        // Texts
        for(let i = this.texts.length-1; i>=0; i--) {
            let t = this.texts[i];
            t.life -= dt;
            t.y += t.vy * dt;
            if (t.life <= 0) this.texts.splice(i, 1);
        }

        // Afterimages
        for(let i = this.afterimages.length-1; i>=0; i--) {
            let a = this.afterimages[i];
            a.life -= dt;
            if (a.life <= 0) this.afterimages.splice(i, 1);
        }

        // Particles
        for(let i = this.particles.length-1; i>=0; i--) {
            let p = this.particles[i];
            p.life -= dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        if (this.hitstopTime > 0) {
            this.hitstopTime -= dt;
            return true; // Skip regular game updates
        }
        return false;
    }

    applyShake(ctx, userIntensityMultiplier = 1.0) {
        if (this.shakeTime > 0) {
            const actualIntensity = this.shakeIntensity * userIntensityMultiplier;
            const dx = (Math.random() - 0.5) * actualIntensity;
            const dy = (Math.random() - 0.5) * actualIntensity;
            ctx.translate(dx, dy);
        }
    }

    draw(ctx) {
        // Afterimages
        for (let a of this.afterimages) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, (a.life / a.maxLife) * 0.5);
            ctx.translate(a.x, a.y);
            ctx.rotate(a.angle);
            ctx.scale(a.scale, a.scale);

            // Draw hull shape identical to player's
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(-10, -12);
            ctx.lineTo(-5, 0);
            ctx.lineTo(-10, 12);
            ctx.closePath();
            ctx.fillStyle = a.color;
            ctx.fill();

            if (a.thrust > 0) {
                ctx.beginPath();
                ctx.moveTo(-10, -5);
                ctx.lineTo(-10 - 15 * a.thrust * (0.8 + Math.random()*0.4), 0);
                ctx.lineTo(-10, 5);
                ctx.closePath();
                ctx.fillStyle = '#f50';
                ctx.fill();
            }

            ctx.restore();
        }

        // Particles
        for(let p of this.particles) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }

        // Texts
        ctx.textAlign = 'center';
        for(let t of this.texts) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
            ctx.fillStyle = t.color;
            ctx.font = '20px sans-serif';
            // Easing up
            ctx.fillText(t.text, t.x, t.y - (1 - t.life/t.maxLife) * 20);
            ctx.restore();
        }
    }

    clearVFX() {
        this.hitstopTime = 0;
        this.shakeIntensity = 0;
        this.shakeTime = 0;
        this.particles = [];
        this.texts = [];
        this.afterimages = [];
        return true;
    }
}
