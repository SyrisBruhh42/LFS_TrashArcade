class VFXManager {
    constructor(engine) {
        this.engine = engine;
        this.screenShakeTime = 0;
        this.screenShakeMagnitude = 0;
        this.floatingTexts = [];
        this.hitStopTimer = 0;
    }

    addScreenShake(magnitude, duration) {
        let intensity = 1.0;
        if(this.engine && this.engine.saveManager && this.engine.saveManager.data && this.engine.saveManager.data.options && this.engine.saveManager.data.options.shakeIntensity !== undefined) {
            intensity = this.engine.saveManager.data.options.shakeIntensity;
        }
        if(intensity === 0) return;

        if(magnitude * intensity > this.screenShakeMagnitude) {
             this.screenShakeMagnitude = magnitude * intensity;
             this.screenShakeTime = duration;
        }
    }

    addFloatingText(x, y, text, color, size = 20) {
        this.floatingTexts.push({
            x: x, y: y,
            text: text,
            color: color,
            size: size,
            life: 1.0,
            maxLife: 1.0,
            vy: -30 - Math.random() * 20
        });
    }

    triggerHitStop(duration) {
        if (duration > this.hitStopTimer) {
            this.hitStopTimer = duration;
        }
    }

    update(dt) {
        if(this.screenShakeTime > 0) {
            this.screenShakeTime -= dt;
            if(this.screenShakeTime <= 0) {
                this.screenShakeMagnitude = 0;
            }
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let ft = this.floatingTexts[i];
            ft.x += (Math.random() - 0.5) * 5 * dt; // slight drift
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if(ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    applyScreenShake(ctx) {
        if(this.screenShakeTime > 0) {
            let dx = (Math.random() - 0.5) * 2 * this.screenShakeMagnitude;
            let dy = (Math.random() - 0.5) * 2 * this.screenShakeMagnitude;
            ctx.translate(dx, dy);
        }
    }

    drawFloatingTexts(ctx) {
        for(let ft of this.floatingTexts) {
            ctx.globalAlpha = ft.life / ft.maxLife;
            ctx.fillStyle = ft.color;
            ctx.font = `bold ${ft.size}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1.0;
    }

    // Additional particle utility for directional particles
    addDirectionalParticles(x, y, dx, dy, count, color, speedBase=100) {
        for(let i=0; i<count; i++) {
            let spreadX = (Math.random() - 0.5) * 50;
            let spreadY = (Math.random() - 0.5) * 50;
            this.engine.particles.push({
                x: x, y: y,
                vx: dx * speedBase + spreadX,
                vy: dy * speedBase + spreadY,
                life: 0.5 + Math.random() * 0.5,
                maxLife: 1.0,
                color: color
            });
        }
    }


    // Motion trails / afterimages
    addAfterimage(x, y, radius, color, isDashing) {
        this.engine.particles.push({
            x: x, y: y,
            vx: 0, vy: 0,
            life: 0.3, maxLife: 0.3,
            color: color,
            isAfterimage: true,
            radius: radius,
            isDashing: isDashing
        });
    }

    // High impact hit flash
    addHitFlash(x, y, radius, color) {
        this.engine.ctx.beginPath();
        this.engine.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.engine.ctx.fillStyle = color;
        this.engine.ctx.fill();
    }

}
