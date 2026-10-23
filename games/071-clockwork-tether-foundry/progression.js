class UpgradeSystem {
    constructor() {
        this.availableUpgrades = [
            { id: 'tether_len', name: 'Longer Tether', desc: 'Increases max tether length safely' },
            { id: 'dash_cooldown', name: 'Quick Dash', desc: 'Reduces Overdrive cooldown' },
            { id: 'dash_speed', name: 'Hyper Overdrive', desc: 'Increases Overdrive speed' },
            { id: 'invuln_time', name: 'Shield Plating', desc: 'More i-frames after taking damage' },
            { id: 'combo_decay', name: 'Sticky Combo', desc: 'Combo multiplier decays slower' },
            { id: 'score_boost', name: 'Score Multiplier', desc: 'Increases base score gain' },
            { id: 'tail_length', name: 'Tail Extension', desc: 'Visually longer tail' },
            { id: 'pickup_magnet', name: 'Magnetic Field', desc: 'Attracts field pickups' },
            { id: 'boss_damage', name: 'Titan Slayer', desc: 'Dash deals more damage to bosses' }
        ];
    }

    getDraft(count) {
        let pool = [...this.availableUpgrades];
        let draft = [];
        for (let i = 0; i < count; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            draft.push(pool[idx]);
            pool.splice(idx, 1);
        }
        return draft;
    }

    applyUpgrade(game, upgradeId) {
        if (!game.player) return;

        switch (upgradeId) {
            case 'tether_len':
                game.player.tetherLengthBonus = (game.player.tetherLengthBonus || 0) + 50;
                break;
            case 'dash_cooldown':
                game.player.dashCooldownMax *= 0.8;
                break;
            case 'dash_speed':
                game.player.dashVelocity *= 1.2;
                break;
            case 'invuln_time':
                game.player.invulnBonus = (game.player.invulnBonus || 0) + 0.5;
                break;
            case 'combo_decay':
                game.comboDecayRate = (game.comboDecayRate || 1) * 0.8;
                break;
            case 'score_boost':
                game.baseScoreMultiplier = (game.baseScoreMultiplier || 1) + 0.2;
                break;
            case 'tail_length':
                game.player.tailMaxLength += 5;
                break;
            case 'pickup_magnet':
                game.pickupMagnetRadius = (game.pickupMagnetRadius || 0) + 150;
                break;
            case 'boss_damage':
                game.player.dashDamage = (game.player.dashDamage || 20) + 15;
                break;
        }
    }
}

class Pickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.lifetime = 15;
        this.dead = false;

        const r = Math.random();
        if (r < 0.33) {
            this.type = 'score';
            this.color = '#ffaa00';
        } else if (r < 0.66) {
            this.type = 'combo';
            this.color = '#00ffff';
        } else {
            this.type = 'overdrive';
            this.color = '#ff00ff';
        }
    }

    update(dt, game) {
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.dead = true;
            return;
        }

        let magnetRadius = game.pickupMagnetRadius || 0;
        let dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);

        if (magnetRadius > 0 && dist < magnetRadius) {
            let angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            let speed = 300 * dt;
            this.x += Math.cos(angle) * speed;
            this.y += Math.sin(angle) * speed;
            dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
        }

        if (dist < this.radius + game.player.radius) {
            this.collect(game);
        }
    }

    collect(game) {
        this.dead = true;
        try { game.sound.playGrapple(); } catch(e){} // Reusing a sound

        switch (this.type) {
            case 'score':
                game.score += 200 * (game.comboMultiplier || 1);
                break;
            case 'combo':
                game.comboMultiplier = (game.comboMultiplier || 1) + 0.5;
                game.comboTimer = 5.0; // Reset decay timer
                break;
            case 'overdrive':
                game.player.dashCooldown = 0; // Instant cooldown
                break;
        }
    }

    draw(ctx) {
        if (this.dead) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 200);
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.restore();
    }
}
