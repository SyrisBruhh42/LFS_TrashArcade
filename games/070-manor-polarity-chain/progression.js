class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'COMBO', 'SCORE', 'SHIELD'
        this.radius = 12;
        this.active = true;
        this.lifeTimer = 10;
        this.pulse = 0;
    }
    update(dt) {
        this.lifeTimer -= dt;
        if (this.lifeTimer <= 0) this.active = false;
        this.pulse += dt * 5;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(1 + Math.sin(this.pulse) * 0.2, 1 + Math.sin(this.pulse) * 0.2);
        if (this.type === 'COMBO') ctx.fillStyle = '#00ffff';
        else if (this.type === 'SCORE') ctx.fillStyle = '#ffff00';
        else ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.restore();
    }
}

class ProgressionManager {
    constructor(game) {
        this.game = game;
        this.comboMultiplier = 1;
        this.comboBar = 100;
        this.comboDecayRate = 10;
        this.pickups = [];
        this.draftOptions = [];

        this.perkPool = [
            { id: 'SPEED', name: 'Speed Boost', desc: 'Increase move speed.' },
            { id: 'DASH_CD', name: 'Swift Dash', desc: 'Reduce dash cooldown.' },
            { id: 'EXP_RAD', name: 'Huge Booms', desc: 'Increase explosion radius.' },
            { id: 'SCORE_MULT', name: 'Greed', desc: 'Base score x1.5.' },
            { id: 'SHIELD', name: 'Ghost Shield', desc: 'Grants an extra hit point.' },
            { id: 'INVULN', name: 'Ethereal', desc: 'Longer dash invulnerability.' },
            { id: 'SPAWN_SLOW', name: 'Time Dilation', desc: 'Enemies spawn slightly slower.' },
            { id: 'COMBO_RET', name: 'Combo Master', desc: 'Combo decays slower.' }
        ];
    }

    reset() {
        this.comboMultiplier = 1;
        this.comboBar = 100;
        this.pickups = [];
        this.draftOptions = [];
        this.game.player.maxHp = this.game.player.maxHp || 1;
        this.game.player.hp = this.game.player.maxHp;
        this.game.player.baseScoreMult = 1;
        this.game.player.expRadMult = 1;
        this.comboDecayRate = 10;
    }

    addCombo() {
        this.comboMultiplier = Math.min(10, this.comboMultiplier + 0.1);
        this.comboBar = 100;
    }

    breakCombo() {
        this.comboMultiplier = 1;
        this.comboBar = 0;
    }

    spawnPickup(x, y) {
        if (Math.random() < 0.2) {
            const types = ['COMBO', 'SCORE', 'SHIELD'];
            this.pickups.push(new Pickup(x, y, types[Math.floor(Math.random() * types.length)]));
        }
    }

    update(dt) {
        if (this.comboMultiplier > 1) {
            this.comboBar -= this.comboDecayRate * dt;
            if (this.comboBar <= 0) {
                this.comboMultiplier = Math.max(1, this.comboMultiplier - 0.5);
                if (this.comboMultiplier > 1) this.comboBar = 100;
                else this.comboBar = 0;
            }
        }

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];
            p.update(dt);
            if (this.game.player && p.active) {
                let dx = p.x - this.game.player.x;
                let dy = p.y - this.game.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < p.radius + this.game.player.radius) {
                    p.active = false;
                    if (p.type === 'COMBO') this.comboBar = 100;
                    else if (p.type === 'SCORE') this.game.score += 500 * Math.floor(this.comboMultiplier);
                    else if (p.type === 'SHIELD') this.game.player.hp = Math.min(this.game.player.maxHp + 1, this.game.player.hp + 1);
                }
            }
        }
        this.pickups = this.pickups.filter(p => p.active);
    }

    startDraft() {
        this.draftOptions = [];
        let pool = [...this.perkPool];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            this.draftOptions.push(pool[idx]);
            pool.splice(idx, 1);
        }
    }

    applyUpgrade(id) {
        if (id === 'SPEED') this.game.player.speed += 50;
        else if (id === 'DASH_CD') this.game.player.maxDashCooldown = Math.max(1, this.game.player.maxDashCooldown - 0.5);
        else if (id === 'EXP_RAD') this.game.player.expRadMult += 0.5;
        else if (id === 'SCORE_MULT') this.game.player.baseScoreMult += 0.5;
        else if (id === 'SHIELD') { this.game.player.maxHp++; this.game.player.hp++; }
        else if (id === 'INVULN') this.game.player.invulnTime += 0.5;
        else if (id === 'SPAWN_SLOW') this.game.spawnInterval += 0.5;
        else if (id === 'COMBO_RET') this.comboDecayRate = Math.max(2, this.comboDecayRate - 2);
    }

    draw(ctx, canvas) {
        for (let p of this.pickups) p.draw(ctx);

        // Combo UI
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`COMBO: x${this.comboMultiplier.toFixed(1)}`, canvas.width - 20, 20);

        ctx.fillStyle = '#444';
        ctx.fillRect(canvas.width - 120, 50, 100, 10);
        ctx.fillStyle = this.comboMultiplier > 1 ? '#00ff88' : '#888';
        ctx.fillRect(canvas.width - 120, 50, this.comboBar, 10);

        if (this.game.state === 'UPGRADE') {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '40px monospace';
            ctx.fillText('WAVE CLEARED - CHOOSE UPGRADE', canvas.width/2, 100);

            this.draftOptions.forEach((opt, idx) => {
                let y = 250 + idx * 100;
                ctx.fillStyle = '#222';
                ctx.strokeStyle = '#5544e7';
                ctx.lineWidth = 2;
                ctx.fillRect(canvas.width/2 - 200, y - 40, 400, 80);
                ctx.strokeRect(canvas.width/2 - 200, y - 40, 400, 80);

                ctx.fillStyle = '#fff';
                ctx.font = '24px monospace';
                ctx.fillText(`[${idx + 1}] ${opt.name}`, canvas.width/2, y - 5);
                ctx.font = '14px monospace';
                ctx.fillStyle = '#aaa';
                ctx.fillText(opt.desc, canvas.width/2, y + 20);
            });

            ctx.fillStyle = '#fff';
            ctx.font = '16px monospace';
            ctx.fillText('Press 1, 2, or 3 to select', canvas.width/2, canvas.height - 50);
        }
    }
}
