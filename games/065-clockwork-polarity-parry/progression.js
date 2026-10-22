class UpgradeManager {
    constructor() {
        this.availableUpgrades = [
            { id: 'dash_cooldown', name: 'Rapid Pistons', desc: 'Reduces dash cooldown by 20%' },
            { id: 'slash_range', name: 'Extended Blade', desc: 'Increases parry/slash range by 15%' },
            { id: 'max_hp', name: 'Reinforced Plating', desc: 'Increases Max HP by 25 and heals you' },
            { id: 'move_speed', name: 'Overclocked Motors', desc: 'Increases movement speed by 10%' },
            { id: 'combo_duration', name: 'Capacitor Bank', desc: 'Combo multiplier takes longer to decay' },
            { id: 'magnet_range', name: 'Polarized Coil', desc: 'Increases pickup collection range' },
            { id: 'heal_on_parry', name: 'Siphon Matrix', desc: 'Perfect parries heal 1 HP' },
            { id: 'dash_damage', name: 'Thermic Exhaust', desc: 'Dashing through enemies deals damage' },
        ];
        this.currentChoices = [];
    }

    generateChoices() {
        // Pick 3 unique upgrades
        const pool = [...this.availableUpgrades];
        this.currentChoices = [];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            this.currentChoices.push(pool.splice(idx, 1)[0]);
        }
    }

    applyUpgrade(upgradeId, player) {
        if (!player.upgrades) player.upgrades = {};
        player.upgrades[upgradeId] = (player.upgrades[upgradeId] || 0) + 1;

        // Apply instant effects
        if (upgradeId === 'max_hp') {
            player.maxHp = Math.floor(player.maxHp * 1.25);
            player.hp = player.maxHp;
        }
    }

    draw(ctx, width, height, input, onSelect) {
        // Draw UPGRADE overlay
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#fff';
        ctx.font = '36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEARED - UPGRADE DRAFT', width / 2, height / 4);

        const cardW = 220;
        const cardH = 300;
        const startX = width / 2 - (cardW * 1.5) - 20;

        for (let i = 0; i < this.currentChoices.length; i++) {
            const choice = this.currentChoices[i];
            const x = startX + i * (cardW + 20) + cardW / 2;
            const y = height / 2;

            // Simple click detection
            let hovered = false;
            if (input.mouse && input.mouse.x > x - cardW/2 && input.mouse.x < x + cardW/2 &&
                input.mouse.y > y - cardH/2 && input.mouse.y < y + cardH/2) {
                hovered = true;
                if (input.mouse.down) {
                    onSelect(choice.id);
                    input.mouse.down = false; // consume click
                }
            }

            // Keyboard detection (1, 2, 3)
            if (input.keys && input.keys['Digit' + (i+1)]) {
                 onSelect(choice.id);
                 input.keys['Digit' + (i+1)] = false;
            }

            ctx.fillStyle = hovered ? '#443' : '#222';
            ctx.strokeStyle = hovered ? '#dda' : '#666';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(x - cardW/2, y - cardH/2, cardW, cardH, 10);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#dda';
            ctx.font = '20px monospace';
            ctx.fillText(choice.name, x, y - cardH/2 + 40);

            ctx.fillStyle = '#aaa';
            ctx.font = '14px monospace';
            // Simple word wrap
            const words = choice.desc.split(' ');
            let line = '';
            let lineY = y - 20;
            for (let w of words) {
                const test = line + w + ' ';
                if (ctx.measureText(test).width > cardW - 20) {
                    ctx.fillText(line, x, lineY);
                    line = w + ' ';
                    lineY += 20;
                } else {
                    line = test;
                }
            }
            ctx.fillText(line, x, lineY);

            ctx.fillStyle = '#666';
            ctx.fillText(`Press ${i+1}`, x, y + cardH/2 - 20);
        }
    }
}
class PickupManager {
    constructor() {
        this.pickups = [];
    }

    spawn(x, y, type) {
        this.pickups.push({
            x, y, type,
            vx: (Math.random() - 0.5) * 100,
            vy: (Math.random() - 0.5) * 100 - 50,
            life: 10, // 10 seconds before despawn
            radius: 8
        });
    }

    update(dt, player, soundEngine, comboManager) {
        const magnetRange = player.upgrades && player.upgrades['magnet_range'] ? 150 : 80;

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];

            // Friction and gravity
            p.vx *= 0.95;
            p.vy += 300 * dt; // gravity

            // Floor collision (simple)
            if (p.y > 500) {
                p.y = 500;
                p.vy *= -0.5;
            }

            p.x += p.vx * dt;
            p.y += p.vy * dt;

            // Magnet logic
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const distSq = dx*dx + dy*dy;

            if (distSq < magnetRange * magnetRange) {
                const dist = Math.sqrt(distSq);
                p.x += (dx / dist) * 300 * dt;
                p.y += (dy / dist) * 300 * dt;
            }

            // Collection
            if (distSq < (player.radius + p.radius) * (player.radius + p.radius)) {
                if (p.type === 'health') {
                    player.hp = Math.min(player.maxHp, player.hp + 20);
                    soundEngine.playHit(); // Temp collect sound
                } else if (p.type === 'energy') {
                    comboManager.addCombo(1);
                    soundEngine.playHit();
                }
                this.pickups.splice(i, 1);
                continue;
            }

            p.life -= dt;
            if (p.life <= 0) {
                this.pickups.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.pickups.forEach(p => {
            // Blink if about to despawn
            if (p.life < 3 && Math.floor(p.life * 10) % 2 === 0) return;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            if (p.type === 'health') {
                ctx.fillStyle = '#f44';
                ctx.strokeStyle = '#fff';
            } else {
                ctx.fillStyle = '#44f';
                ctx.strokeStyle = '#fff';
            }
            ctx.fill();
            ctx.stroke();
        });
    }
}

class ComboManager {
    constructor() {
        this.multiplier = 1.0;
        this.comboMeter = 0.0; // 0.0 to 1.0
        this.decayRate = 0.1; // per second
    }

    addCombo(amount, player) {
        this.comboMeter += amount * 0.2;
        if (this.comboMeter >= 1.0) {
            this.multiplier += 0.5;
            this.comboMeter -= 1.0;
        }
    }

    update(dt, player) {
        let decay = this.decayRate;
        if (player.upgrades && player.upgrades['combo_duration']) {
            decay *= 0.5; // decays slower
        }

        if (this.multiplier > 1.0 || this.comboMeter > 0) {
            this.comboMeter -= decay * dt;
            if (this.comboMeter < 0) {
                if (this.multiplier > 1.0) {
                    this.multiplier -= 0.5;
                    this.comboMeter = 1.0;
                } else {
                    this.comboMeter = 0;
                }
            }
        }
    }

    draw(ctx, width) {
        // Draw combo bar
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`x${this.multiplier.toFixed(1)}`, width - 20, 30);

        ctx.fillStyle = '#333';
        ctx.fillRect(width - 120, 40, 100, 10);
        ctx.fillStyle = '#dda';
        ctx.fillRect(width - 120, 40, 100 * this.comboMeter, 10);
    }
}
