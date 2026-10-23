class Pickup {
    constructor(x, y, type) {
        this.pos = new Vector2(x, y);
        this.type = type; // 'health', 'score', 'combo'
        this.radius = 10;
        this.active = true;
        this.lifeTimer = 10;
    }
    update(dt) {
        this.lifeTimer -= dt;
        if (this.lifeTimer <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.globalAlpha = Math.min(1, this.lifeTimer);
        ctx.beginPath();
        if (this.type === 'health') {
            ctx.fillStyle = '#00ff00';
            ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        } else if (this.type === 'score') {
            ctx.fillStyle = '#ffff00';
            ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        } else if (this.type === 'combo') {
            ctx.fillStyle = '#ff00ff';
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, 0);
            ctx.lineTo(0, this.radius);
            ctx.lineTo(-this.radius, 0);
        }
        ctx.fill();
        ctx.restore();
    }
}

class ProgressionManager {
    constructor() {
        this.combo = 0;
        this.comboTimer = 0;
        this.maxComboTimer = 5;
        this.pickups = [];

        this.upgrades = [
            { id: 'hp', name: 'Core Reinforcement', desc: 'Max Core HP +50', apply: (g) => { g.core.maxHp += 50; g.core.hp += 50; } },
            { id: 'dmg', name: 'Overcharge Rounds', desc: 'Damage Multiplier +20%', apply: (g) => { g.player.dmgMult = (g.player.dmgMult || 1) + 0.2; } },
            { id: 'echo', name: 'Echo Efficiency', desc: 'Echo Cooldown -2s', apply: (g) => { g.player.echoCooldownReduction = (g.player.echoCooldownReduction || 0) + 2; } },
            { id: 'speed', name: 'Agility Protocol', desc: 'Player Speed +20%', apply: (g) => { g.player.speed *= 1.2; } },
            { id: 'dash', name: 'Dash Capacitor', desc: 'Dash Cooldown -1s', apply: (g) => { g.player.dashCooldownReduction = (g.player.dashCooldownReduction || 0) + 1; } },
            { id: 'regen', name: 'Nano-Repair', desc: 'Core Regens 1 HP/sec', apply: (g) => { g.core.regenRate = (g.core.regenRate || 0) + 1; } },
            { id: 'fireRate', name: 'Rapid Fire', desc: 'Fire Rate +15%', apply: (g) => { g.player.fireRateMult = (g.player.fireRateMult || 1) + 0.15; } },
            { id: 'spread', name: 'Scatter Shot', desc: 'Add 2 projectiles', apply: (g) => { g.player.extraProjectiles = (g.player.extraProjectiles || 0) + 2; } }
        ];

        this.draftChoices = [];
    }

    triggerDraft() {
        let pool = [...this.upgrades];
        this.draftChoices = [];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            this.draftChoices.push(pool.splice(idx, 1)[0]);
        }
    }

    selectUpgrade(game, index) {
        if (this.draftChoices[index]) {
            this.draftChoices[index].apply(game);
            return true;
        }
        return false;
    }

    addCombo(amount) {
        this.combo += amount;
        this.comboTimer = this.maxComboTimer;
        if (window.game && window.game.vfx && window.game.player) {
            window.game.vfx.spawnFloatingText(window.game.player.pos.x, window.game.player.pos.y - 30, `COMBO x${this.combo}`, "#ff62ac");
        }
    }

    spawnPickup(x, y) {
        let r = Math.random();
        if (r < 0.1) this.pickups.push(new Pickup(x, y, 'health'));
        else if (r < 0.3) this.pickups.push(new Pickup(x, y, 'combo'));
        else if (r < 0.5) this.pickups.push(new Pickup(x, y, 'score'));
    }

    update(dt, game) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0; // reset
            }
        }

        this.pickups.forEach(p => p.update(dt));

        // Collect pickups
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];
            if (p.active && p.pos.dist(game.player.pos) < p.radius + game.player.radius) {
                if (p.type === 'health') {
                    game.core.hp = Math.min(game.core.maxHp, game.core.hp + 20);
                } else if (p.type === 'score') {
                    game.score += 50 * (1 + this.combo * 0.1);
                } else if (p.type === 'combo') {
                    this.addCombo(1);
                }
                p.active = false;
                game.sound.hit(); // reuse sound
            }
        }

        this.pickups = this.pickups.filter(p => p.active);
    }

    draw(ctx, game) {
        // Combo UI
        if (game.state === 'PLAYING') {
            ctx.fillStyle = '#ff00ff';
            ctx.font = '20px Courier New';
            ctx.fillText(`COMBO: x${1 + this.combo * 0.1}`, 10, 120);
            ctx.fillRect(10, 130, 100 * (this.comboTimer / this.maxComboTimer), 5);
        }

        this.pickups.forEach(p => p.draw(ctx));

        // Draft UI
        if (game.state === 'UPGRADE') {
            ctx.fillStyle = 'rgba(11, 11, 26, 0.9)';
            ctx.fillRect(0, 0, game.width, game.height);

            ctx.fillStyle = '#ff62ac';
            ctx.textAlign = 'center';
            ctx.font = '30px Courier New';
            ctx.fillText('WAVE CLEARED! SELECT UPGRADE', game.width/2, 100);

            for (let i = 0; i < this.draftChoices.length; i++) {
                let choice = this.draftChoices[i];
                let y = 200 + i * 100;

                ctx.fillStyle = '#222244';
                ctx.fillRect(game.width/2 - 250, y - 40, 500, 80);

                ctx.fillStyle = '#00ff00';
                ctx.font = '24px Courier New';
                ctx.fillText(`[${i+1}] ${choice.name}`, game.width/2, y - 5);
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '16px Courier New';
                ctx.fillText(choice.desc, game.width/2, y + 20);
            }

            ctx.textAlign = 'left';
        }
    }
}