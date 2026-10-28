class VFXManager {
    constructor(game) {
        this.game = game;
        this.cameraShake = 0;
        this.floatingTexts = [];
    }

    addShake(amount) {
        // Respect reduced motion - we can assume this check is here or global
        this.cameraShake = amount;
    }

    addFloatingText(x, y, text, color) {
        this.floatingTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 1.0,
            maxLife: 1.0,
            vy: -30
        });
    }
    
    burst(x, y, color, count, speed=60) {
        if(!this.game.particles) return;
        for(let i=0; i<count; i++) {
            const p = new Particle(x, y, color, Math.random()*3 + 2, Math.random()*0.5 + 0.5);
            p.vx = (Math.random() - 0.5) * speed * 2;
            p.vy = (Math.random() - 0.5) * speed * 2;
            this.game.particles.push(p);
        }
    }

    update(dt) {
        if(this.cameraShake > 0) {
            this.cameraShake -= dt * 20;
            if(this.cameraShake < 0) this.cameraShake = 0;
        }

        for(let i=this.floatingTexts.length-1; i>=0; i--) {
            let ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if(ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    applyCamera(ctx) {
        if(this.cameraShake > 0) {
            const dx = (Math.random() - 0.5) * this.cameraShake;
            const dy = (Math.random() - 0.5) * this.cameraShake;
            ctx.translate(dx, dy);
        }
    }

    draw(ctx) {
        ctx.save();
        for(let ft of this.floatingTexts) {
            ctx.fillStyle = ft.color;
            ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.restore();
    }
}
window.VFXManager = VFXManager;
