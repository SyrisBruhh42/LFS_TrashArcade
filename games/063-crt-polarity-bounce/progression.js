class ComboManager {
    constructor(game) {
        this.game = game;
        this.multiplier = 1.0;
        this.decayTimer = 0;
        this.decayMax = 3.0; // Seconds until combo resets
        this.decayRate = 1.0; // Can be slowed by upgrades
    }

    addHit() {
        this.multiplier = Math.min(10.0, this.multiplier + 0.1);
        this.decayTimer = this.decayMax;
    }

    update(dt) {
        if (this.multiplier > 1.0) {
            this.decayTimer -= dt * this.decayRate;
            if (this.decayTimer <= 0) {
                this.multiplier = 1.0;
                this.decayTimer = 0;
            }
        }
    }

    reset() {
        this.multiplier = 1.0;
        this.decayTimer = 0;
        this.decayRate = 1.0;
    }

    draw(ctx, width, height) {
        if (this.multiplier > 1.0) {
            // Draw multiplier text
            ctx.fillStyle = COLORS.text;
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`x${this.multiplier.toFixed(1)} COMBO`, width - 20, 40);

            // Draw decay bar
            const barWidth = 150;
            const barHeight = 10;
            const barX = width - 20 - barWidth;
            const barY = 50;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            const fillPct = Math.max(0, this.decayTimer / this.decayMax);
            ctx.fillStyle = `hsl(${fillPct * 120}, 100%, 50%)`;
            ctx.fillRect(barX, barY, barWidth * fillPct, barHeight);

            ctx.strokeStyle = COLORS.text;
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }
}

class Pickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.life = 10.0; // Disappears after 10s
        this.time = 0;
    }

    update(dt) {
        this.life -= dt;
        this.time += dt;
    }

    draw(ctx) {
        // Base draw, overridden by subclasses
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.restore();
    }

    apply(game) {
        // Overridden
    }
}

class HealthPickup extends Pickup {
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Bobbing effect
        const scale = 1.0 + Math.sin(this.time * 5) * 0.1;
        ctx.scale(scale, scale);

        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.radius/2, -2, this.radius, 4);
        ctx.fillRect(-2, -this.radius/2, 4, this.radius);

        ctx.restore();
    }

    apply(game) {
        game.health++;
        game.sound.playShoot(); // Reuse sound
        game.spawnParticles(this.x, this.y, '#ff3333', 10);
    }
}

class ComboPickup extends Pickup {
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const scale = 1.0 + Math.sin(this.time * 10) * 0.1;
        ctx.scale(scale, scale);

        ctx.fillStyle = '#ffff33';
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    apply(game) {
        game.comboManager.addHit();
        game.comboManager.addHit();
        game.comboManager.addHit();
        game.sound.playShoot();
        game.spawnParticles(this.x, this.y, '#ffff33', 10);
    }
}

class ShieldPickup extends Pickup {
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const scale = 1.0 + Math.sin(this.time * 3) * 0.1;
        ctx.scale(scale, scale);

        ctx.strokeStyle = '#33ccff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(51, 204, 255, 0.5)';
        ctx.fill();

        ctx.restore();
    }

    apply(game) {
        if (!game.player.shields) game.player.shields = 0;
        game.player.shields++;
        game.sound.playShoot();
        game.spawnParticles(this.x, this.y, '#33ccff', 10);
    }
}

class UpgradeManager {
    constructor(game) {
        this.game = game;
        this.perks = [
            { id: 'health_up', name: 'Max Health +1', desc: 'Increases health by 1.', apply: (g) => { g.maxHealth = (g.maxHealth || 3) + 1; g.health = g.maxHealth; } },
            { id: 'speed_up', name: 'Move Speed +10%', desc: 'Move faster across the grid.', apply: (g) => g.player.speed *= 1.1 },
            { id: 'magnet_up', name: 'Magnet Range +20%', desc: 'Attract/repel from further away.', apply: (g) => g.nodes.forEach(n => n.radius *= 1.2) },
            { id: 'combo_time', name: 'Combo Decay Slower', desc: 'Combo bar decays slower.', apply: (g) => g.comboManager.decayRate *= 0.8 },
            { id: 'dash_cooldown', name: 'Dash Cooldown -0.2s', desc: 'Dash recharge time reduced.', apply: (g) => g.player.dashCooldownMax = Math.max(0.5, g.player.dashCooldownMax - 0.2) },
            { id: 'shield', name: 'Shield Stack', desc: 'Gain 1 temporary shield hit.', apply: (g) => { if(!g.player.shields) g.player.shields=0; g.player.shields += (g.wave > 5 ? 2 : 1); } },
            { id: 'damage_up', name: 'Ricochet Damage +1', desc: 'Deal more damage on bounce.', apply: (g) => { if(!g.player.bonusDamage) g.player.bonusDamage=0; g.player.bonusDamage++; } },
            { id: 'blast_radius', name: 'Explosion Radius +20%', desc: 'Bigger explosions on enemy kill.', apply: (g) => { if(!g.player.blastBonus) g.player.blastBonus=1; g.player.blastBonus *= 1.2; } }
        ];
        this.options = [];
        this.cardWidth = 200;
        this.cardHeight = 300;
        this.cardPadding = 40;
    }

    generateDraft() {
        // Pick 3 random distinct perks
        const shuffled = [...this.perks].sort(() => 0.5 - Math.random());
        this.options = shuffled.slice(0, 3);
    }

    draw(ctx, width, height) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = COLORS.text;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEARED - SELECT UPGRADE', width / 2, height * 0.2);

        const totalWidth = (this.cardWidth * 3) + (this.cardPadding * 2);
        const startX = (width - totalWidth) / 2;
        const startY = height / 2 - this.cardHeight / 2;

        this.options.forEach((opt, index) => {
            const x = startX + index * (this.cardWidth + this.cardPadding);
            const y = startY;

            ctx.fillStyle = '#112';
            ctx.fillRect(x, y, this.cardWidth, this.cardHeight);

            ctx.strokeStyle = COLORS.accent;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, this.cardWidth, this.cardHeight);

            ctx.fillStyle = COLORS.accent;
            ctx.font = 'bold 18px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(opt.name, x + this.cardWidth / 2, y + 40);

            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            // Simple word wrap
            const words = opt.desc.split(' ');
            let line = '';
            let lineY = y + 100;
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = ctx.measureText(testLine);
                if (metrics.width > this.cardWidth - 20 && n > 0) {
                    ctx.fillText(line, x + this.cardWidth / 2, lineY);
                    line = words[n] + ' ';
                    lineY += 20;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x + this.cardWidth / 2, lineY);

            ctx.fillStyle = '#555';
            ctx.font = '12px monospace';
            ctx.fillText('CLICK TO SELECT', x + this.cardWidth / 2, y + this.cardHeight - 20);
        });
    }

    handleClick(x, y, width, height) {
        if (!this.options || this.options.length === 0) return false;

        const totalWidth = (this.cardWidth * 3) + (this.cardPadding * 2);
        const startX = (width - totalWidth) / 2;
        const startY = height / 2 - this.cardHeight / 2;

        for (let i = 0; i < this.options.length; i++) {
            const cardX = startX + i * (this.cardWidth + this.cardPadding);
            const cardY = startY;

            if (x >= cardX && x <= cardX + this.cardWidth &&
                y >= cardY && y <= cardY + this.cardHeight) {

                // Apply perk
                this.options[i].apply(this.game);
                this.game.sound.playShoot();

                // Clear options
                this.options = [];

                // Return to playing
                this.game.state = 'PLAYING';
                return true;
            }
        }
        return false;
    }
}
