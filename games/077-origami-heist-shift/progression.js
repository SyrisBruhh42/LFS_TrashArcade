class UpgradeManager {
    constructor() {
        this.availableUpgrades = [
            { id: 'speed', name: 'Dash Speed', desc: 'Increase dash velocity', apply: (p) => { p.dashSpeed += 100; } },
            { id: 'cd', name: 'Quick Dash', desc: 'Reduce dash cooldown', apply: (p) => { p.dashCooldownMax = Math.max(0.5, p.dashCooldownMax - 0.2); } },
            { id: 'accel', name: 'Light Paper', desc: 'Increase movement speed', apply: (p) => { p.speed += 100; } },
            { id: 'combo', name: 'Combo Master', desc: 'Slower combo decay', apply: (p, g) => { g.comboManager.decayRate *= 0.8; } },
            { id: 'arena', name: 'Strong Folds', desc: 'Arena shrinks slower', apply: (p, g) => { g.arenaShrinkRate *= 0.8; } },
            { id: 'points', name: 'Origami Collector', desc: 'Base treasure points +5', apply: (p, g) => { g.treasureBasePoints = (g.treasureBasePoints || 10) + 5; } },
            { id: 'heal', name: 'Patch Up', desc: 'Recover an extra combo level', apply: (p, g) => { g.comboManager.combo = Math.min(g.comboManager.maxCombo, g.comboManager.combo + 1); } },
            { id: 'small', name: 'Miniature Fold', desc: 'Reduce player hitbox', apply: (p) => { p.radius = Math.max(8, p.radius - 2); } }
        ];
        this.currentChoices = [];
    }

    generateChoices() {
        let pool = [...this.availableUpgrades];
        this.currentChoices = [];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            this.currentChoices.push(pool[idx]);
            pool.splice(idx, 1);
        }
    }

    applyUpgrade(index, game) {
        if (this.currentChoices[index]) {
            this.currentChoices[index].apply(game.player, game);
        }
        this.currentChoices = [];
    }

    draw(ctx, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEARED! CHOOSE UPGRADE', w/2, h/4);

        const boxW = 200;
        const boxH = 150;
        const startX = w/2 - (boxW * 1.5) - 20;

        this.currentChoices.forEach((choice, i) => {
            const bx = startX + i * (boxW + 40);
            const by = h/2 - boxH/2;
            ctx.fillStyle = '#444';
            ctx.fillRect(bx, by, boxW, boxH);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(bx, by, boxW, boxH);

            ctx.fillStyle = '#ffdf00';
            ctx.font = '20px sans-serif';
            ctx.fillText(choice.name, bx + boxW/2, by + 40);

            ctx.fillStyle = '#ccc';
            ctx.font = '14px sans-serif';
            // Simple word wrap simulation for description
            let words = choice.desc.split(' ');
            let line = '';
            let y = by + 80;
            for(let n = 0; n < words.length; n++) {
                let testLine = line + words[n] + ' ';
                let metrics = ctx.measureText(testLine);
                if(metrics.width > boxW - 20 && n > 0) {
                    ctx.fillText(line, bx + boxW/2, y);
                    line = words[n] + ' ';
                    y += 20;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, bx + boxW/2, y);

            ctx.fillStyle = '#888';
            ctx.fillText(`Press ${i+1}`, bx + boxW/2, by + boxH - 15);
        });
    }
}

class ComboManager {
    constructor() {
        this.combo = 1.0;
        this.maxCombo = 5.0;
        this.comboTimer = 0;
        this.comboTimerMax = 5.0;
        this.decayRate = 1.0;
        this.comboTokens = [];
    }

    reset() {
        this.combo = 1.0;
        this.comboTimer = 0;
        this.comboTokens = [];
    }

    addCombo(amount) {
        this.combo = Math.min(this.maxCombo, this.combo + amount);
        this.comboTimer = this.comboTimerMax;
    }

    spawnToken(x, y) {
        this.comboTokens.push({ x: x, y: y, life: 10.0, radius: 6, active: true });
    }

    update(dt, game) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt * this.decayRate;
            if (this.comboTimer <= 0) {
                this.comboTimer = 0;
                this.combo = 1.0;
            }
        }

        this.comboTokens.forEach(t => {
            if (!t.active) return;
            t.life -= dt;
            if (t.life <= 0) t.active = false;

            const dx = game.player.x - t.x;
            const dy = game.player.y - t.y;
            if (Math.hypot(dx, dy) < game.player.radius + t.radius) {
                t.active = false;
                if (game.sound) game.sound.playPickup();
                this.addCombo(0.5);
                game.score += Math.floor(5 * this.combo);
            }
        });
        this.comboTokens = this.comboTokens.filter(t => t.active);
    }

    draw(ctx, w, h) {
        // Draw combo bar
        if (this.combo > 1.0) {
            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`COMBO x${this.combo.toFixed(1)}`, w - 20, 40);

            const barW = 100;
            const barH = 10;
            const ratio = this.comboTimer / this.comboTimerMax;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(w - 20 - barW, 50, barW, barH);
            ctx.fillStyle = `hsl(${120 * ratio}, 100%, 50%)`;
            ctx.fillRect(w - 20 - barW, 50, barW * ratio, barH);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(w - 20 - barW, 50, barW, barH);
        }

        // Draw tokens
        this.comboTokens.forEach(t => {
            if (!t.active) return;
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.globalAlpha = Math.min(1.0, t.life);
            ctx.fillStyle = '#0ff';
            ctx.beginPath();
            ctx.moveTo(0, -t.radius);
            ctx.lineTo(t.radius, 0);
            ctx.lineTo(0, t.radius);
            ctx.lineTo(-t.radius, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        });
    }
}
