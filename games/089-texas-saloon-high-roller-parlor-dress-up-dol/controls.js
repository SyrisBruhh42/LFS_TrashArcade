class AdvancedRig {
    constructor(game) {
        this.game = game;
        this.overdriveCharge = 0;
        this.maxOverdrive = 100;
        this.isOverdriveActive = false;
        this.breathTimer = 0;
        this.blinkTimer = 0;
        this.isBlinking = false;
        this.particles = [];
    }

    addCharge(amount) {
        if (this.isOverdriveActive) return;
        this.overdriveCharge = Math.min(this.overdriveCharge + amount, this.maxOverdrive);
    }

    activateOverdrive() {
        if (this.overdriveCharge >= this.maxOverdrive) {
            this.isOverdriveActive = true;
            this.overdriveCharge = 0;
            // Overdrive effect: instant max score boost or visual flair
            this.game.score += 50;
            this.game.playSound(1200, "sine", 0.5);
            setTimeout(() => { this.isOverdriveActive = false; }, 5000);
        }
    }

    update(dt) {
        this.breathTimer += dt * 2;
        this.blinkTimer += dt;
        if (this.blinkTimer > 4) {
            this.isBlinking = true;
            if (this.blinkTimer > 4.2) {
                this.isBlinking = false;
                this.blinkTimer = 0;
            }
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.y -= p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        if (this.isOverdriveActive && Math.random() < 0.2) {
            this.particles.push({
                x: this.game.doll.x - 50 + Math.random() * 100,
                y: this.game.doll.y + Math.random() * 100,
                vy: 50 + Math.random() * 50,
                life: 1 + Math.random()
            });
        }
    }

    draw(ctx, doll) {
        const breathScale = 1 + Math.sin(this.breathTimer) * 0.02;
        const breathOffset = Math.sin(this.breathTimer) * 2;

        ctx.save();
        ctx.translate(doll.x, doll.y);
        ctx.scale(1, breathScale);
        ctx.translate(-doll.x, -doll.y + breathOffset);

        // Draw Doll Layers
        ctx.fillStyle = "#f5d0b5"; // skin
        ctx.fillRect(doll.x - 30, doll.y - 100, 60, 160);

        // Blinking
        if (this.isBlinking) {
            ctx.fillStyle = "#333";
            ctx.fillRect(doll.x - 15, doll.y - 80, 10, 2);
            ctx.fillRect(doll.x + 5, doll.y - 80, 10, 2);
        } else {
            ctx.fillStyle = "#fff";
            ctx.fillRect(doll.x - 15, doll.y - 85, 10, 10);
            ctx.fillRect(doll.x + 5, doll.y - 85, 10, 10);
            ctx.fillStyle = "#000";
            ctx.fillRect(doll.x - 12, doll.y - 82, 4, 4);
            ctx.fillRect(doll.x + 8, doll.y - 82, 4, 4);
        }

        // Hair
        ctx.fillStyle = ["#eadd6a", "#5c3a21", "#962315"][doll.hair];
        ctx.fillRect(doll.x - 40, doll.y - 120, 80, 50);

        // Top
        ctx.fillStyle = ["#333", "#fff", "#8b4513"][doll.top];
        ctx.fillRect(doll.x - 30, doll.y - 40, 60, 50);

        // Bottom
        ctx.fillStyle = ["#a020f0", "#000", "#555"][doll.bottom];
        ctx.fillRect(doll.x - 35, doll.y + 10, 70, 50);

        // Shoes
        ctx.fillStyle = ["#8b4513", "#ff0000", "#aaa"][doll.shoes];
        ctx.fillRect(doll.x - 35, doll.y + 60, 30, 20);
        ctx.fillRect(doll.x + 5, doll.y + 60, 30, 20);

        ctx.restore();

        // Overdrive Indicator & Particles
        ctx.fillStyle = this.isOverdriveActive ? "#e53935" : "#ffd700";
        ctx.fillRect(doll.x - 50, doll.y - 140, (this.overdriveCharge / this.maxOverdrive) * 100, 10);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(doll.x - 50, doll.y - 140, 100, 10);

        ctx.fillStyle = "#ffd700";
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}
