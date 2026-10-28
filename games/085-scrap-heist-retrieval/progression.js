class DraftManager {
    constructor(game) {
        this.game = game;
        this.perks = [
            { id: 'cloak', name: 'Cloak Dampener', desc: 'Reduces enemy vision range.' },
            { id: 'speed', name: 'Agility Boots', desc: 'Increases player speed by 15%.' },
            { id: 'dash', name: 'Dash Capacitor', desc: 'Reduces Dash cooldown.' },
            { id: 'ammo_stun', name: 'Stun Module', desc: 'Retrieving ammo stuns nearby enemies.' },
            { id: 'combo_time', name: 'Combo Extender', desc: 'Increases time before combo drops.' },
            { id: 'score_boost', name: 'Data Extractor', desc: 'Increases base score from scrap.' }
        ];
        this.activeDraft = [];

        // Player stats/modifiers
        this.modifiers = {
            visionRadiusMult: 1.0,
            speedMult: 1.0,
            dashCooldownMult: 1.0,
            ammoStunRadius: 0,
            comboDurationMult: 1.0,
            scoreMult: 1.0
        };
    }

    generateDraft() {
        const shuffled = [...this.perks].sort(() => 0.5 - Math.random());
        this.activeDraft = shuffled.slice(0, 3);
        if (this.game.sound) this.game.sound.playScore();
    }

    handleInput(input) {
        const cardWidth = 200;
        const cardHeight = 300;
        const gap = 40;
        const startX = this.game.width / 2 - cardWidth - gap;

        // Keyboard input
        if (input.keys['Digit1']) this.selectPerk(0);
        else if (input.keys['Digit2']) this.selectPerk(1);
        else if (input.keys['Digit3']) this.selectPerk(2);

        // Mouse/Touch input
        if (input.isActionPressed()) {
            // we need actual mouse coordinates
            // Assuming this.game.input has pointers or we can check mouse/touches
            const pt = input.touches.length > 0 ? input.touches[0] : input.mouse;
            if (pt && pt.x && pt.y) {
                for (let i = 0; i < this.activeDraft.length; i++) {
                    const cx = startX + i * (cardWidth + gap);
                    const cy = this.game.height / 2 - cardHeight / 2;
                    if (pt.x >= cx && pt.x <= cx + cardWidth && pt.y >= cy && pt.y <= cy + cardHeight) {
                        this.selectPerk(i);
                        break;
                    }
                }
            }
        }
    }

    selectPerk(index) {
        if (index < 0 || index >= this.activeDraft.length) return;
        const perk = this.activeDraft[index];
        this.applyPerk(perk.id);
        this.activeDraft = [];
        this.game.state = 'PLAYING';
        this.game.input.clear();
        this.game.loadWave();
    }

    applyPerk(id) {
        if (id === 'cloak') this.modifiers.visionRadiusMult *= 0.85;
        if (id === 'speed') {
            this.modifiers.speedMult *= 1.15;
            if (this.game.player) this.game.player.speed = 150 * this.modifiers.speedMult;
        }
        if (id === 'dash') {
            this.modifiers.dashCooldownMult *= 0.8;
            if (this.game.player) this.game.player.maxDashCooldown = 2.0 * this.modifiers.dashCooldownMult;
        }
        if (id === 'ammo_stun') this.modifiers.ammoStunRadius += 60;
        if (id === 'combo_time') this.modifiers.comboDurationMult *= 1.5;
        if (id === 'score_boost') this.modifiers.scoreMult += 0.5;
        if (this.game.sound) this.game.sound.playScore();
    }

    draw(ctx, width, height) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#fff';
        ctx.font = '40px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELECT A PERK', width / 2, 100);

        const cardWidth = 200;
        const cardHeight = 300;
        const gap = 40;
        const startX = width / 2 - cardWidth - gap;

        for (let i = 0; i < this.activeDraft.length; i++) {
            const p = this.activeDraft[i];
            const cx = startX + i * (cardWidth + gap);
            const cy = height / 2 - cardHeight / 2;

            ctx.fillStyle = '#222';
            ctx.fillRect(cx, cy, cardWidth, cardHeight);
            ctx.strokeStyle = '#4ad5c0';
            ctx.lineWidth = 4;
            ctx.strokeRect(cx, cy, cardWidth, cardHeight);

            ctx.fillStyle = '#4ad5c0';
            ctx.font = '18px monospace';
            ctx.fillText(p.name, cx + cardWidth / 2, cy + 40);

            ctx.fillStyle = '#ccc';
            ctx.font = '14px monospace';
            this.wrapText(ctx, p.desc, cx + cardWidth / 2, cy + 100, cardWidth - 20, 20);

            ctx.fillStyle = '#ff7043';
            ctx.font = '16px monospace';
            ctx.fillText(`Press ${i + 1} or Click`, cx + cardWidth / 2, cy + cardHeight - 20);
        }
    }

    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        for(let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
    }
}

class BonusCollectible {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.active = true;
        this.time = 0;
    }

    update(dt) {
        this.time += dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#ffca28';
        const pulse = 1 + Math.sin(this.time * 5) * 0.2;
        ctx.scale(pulse, pulse);

        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.fill();
        ctx.restore();
    }
}
