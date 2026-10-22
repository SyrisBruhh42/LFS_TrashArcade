class Pickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 50;
        this.vy = (Math.random() - 0.5) * 50;
        this.life = 10;
        this.radius = 8;
        this.type = Math.random() > 0.8 ? 'health' : 'score';
    }

    update(dt, player) {
        this.life -= dt;

        // Friction
        this.vx *= 0.95;
        this.vy *= 0.95;

        // Magnet effect
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < player.magnetRadius) {
            const pullStrength = 500 * (1 - dist / player.magnetRadius);
            this.vx += (dx / dist) * pullStrength * dt;
            this.vy += (dy / dist) * pullStrength * dt;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.type === 'health' ? '#0f0' : '#ff0';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

class ProgressionManager {
    constructor() {
        this.combo = 0;
        this.comboTimer = 0;
        this.comboMaxTime = 3; // seconds before combo drops
        this.wave = 1;
        this.draftChoices = [];
        this.availableUpgrades = [
            "Damage Boost",
            "Speed Overdrive",
            "Rapid Fire",
            "Dash Stabilizer",
            "Arena Expander",
            "Piercing Plasma",
            "Multishot",
            "Magnetic Hull"
        ];
    }

    update(dt) {
        if (this.combo > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }
    }

    incrementCombo() {
        this.combo++;
        this.comboTimer = this.comboMaxTime;
    }

    getComboMultiplier() {
        return 1 + Math.min(this.combo * 0.1, 5); // Max 5x multiplier
    }

    generateDraftChoices() {
        // Shuffle and pick 3 unique
        let shuffled = [...this.availableUpgrades].sort(() => 0.5 - Math.random());
        this.draftChoices = shuffled.slice(0, 3);
    }

    applyUpgrade(upgradeName, game) {
        switch(upgradeName) {
            case "Damage Boost":
                game.player.damage += 1;
                break;
            case "Speed Overdrive":
                game.player.maxSpeed += 50;
                break;
            case "Rapid Fire":
                game.player.fireCooldown = Math.max(0.05, game.player.fireCooldown - 0.05);
                break;
            case "Dash Stabilizer":
                game.player.dashCooldownMax = Math.max(0.2, game.player.dashCooldownMax - 0.2);
                break;
            case "Arena Expander":
                game.arena.maxRadius += 50;
                game.arena.minRadius += 25;
                game.arena.radius = game.arena.maxRadius;
                break;
            case "Piercing Plasma":
                game.player.pierce += 1;
                break;
            case "Multishot":
                game.player.multishot += 1;
                break;
            case "Magnetic Hull":
                game.player.magnetRadius += 100;
                break;
        }
    }
}
