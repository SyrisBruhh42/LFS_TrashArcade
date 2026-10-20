class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 300;

        this.maxHealth = 100;
        this.health = this.maxHealth;

        this.overdrive = false;
        this.overdriveTimer = 0;
        this.overdriveDuration = 2.0; // 2 seconds of power
        this.overdriveCost = 25; // costs 25 health

        this.vx = 0;
        this.vy = 0;
    }

    update(dt, inputManager, audioEngine) {
        // Handle overdrive trigger
        if (inputManager.justPressedActions.overdrive && !this.overdrive && this.health > this.overdriveCost) {
            this.health -= this.overdriveCost;
            this.overdrive = true;
            this.overdriveTimer = this.overdriveDuration;
            audioEngine.playOverdrive();

            // Screen shake triggering (handled in engine later)
            if (window.engine) {
                window.engine.shakeScreen(0.5);
            }
        }

        if (this.overdrive) {
            this.overdriveTimer -= dt;
            if (this.overdriveTimer <= 0) {
                this.overdrive = false;
            }
        }

        // Movement
        this.vx = 0;
        this.vy = 0;

        if (inputManager.actions.left) this.vx -= 1;
        if (inputManager.actions.right) this.vx += 1;
        if (inputManager.actions.up) this.vy -= 1;
        if (inputManager.actions.down) this.vy += 1;

        // Normalize
        if (this.vx !== 0 || this.vy !== 0) {
            const len = Math.hypot(this.vx, this.vy);
            this.vx /= len;
            this.vy /= len;
        }

        const currentSpeed = this.overdrive ? this.speed * 2 : this.speed;

        this.x += this.vx * currentSpeed * dt;
        this.y += this.vy * currentSpeed * dt;

        // Clamp to logical bounds (for now)
        this.x = Math.max(this.radius, Math.min(LOGICAL_WIDTH - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(LOGICAL_HEIGHT - this.radius, this.y));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.overdrive) {
            // Overdrive glow
            ctx.shadowColor = '#85bddb';
            ctx.shadowBlur = 20;
        }

        // Draw player robot body
        ctx.fillStyle = this.overdrive ? '#85bddb' : '#666';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    takeDamage(amount, audioEngine) {
        if (this.overdrive) return; // Invulnerable during overdrive? Let's say yes for the twist
        this.health -= amount;
        audioEngine.playHit();
        if (window.engine) {
            window.engine.shakeScreen(0.3);
        }
    }
}
