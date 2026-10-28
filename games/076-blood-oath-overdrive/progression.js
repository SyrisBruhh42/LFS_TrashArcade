class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'health' or 'score'
        this.size = 10;
        this.life = 10; // seconds
        this.maxLife = 10;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'health' ? '#0f0' : '#ff0';
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}
class ProgressionManager {
    constructor() {
        this.wave = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxComboTimer = 3;
        this.pickups = [];
        this.perks = [];
        this.perkPool = [
            { id: 'max_hp', name: 'Max HP +50', desc: 'Increases maximum health' },
            { id: 'heal', name: 'Full Heal', desc: 'Restores health to max' },
            { id: 'dash_cd', name: 'Dash Cooldown -20%', desc: 'Dash recovers faster' },
            { id: 'speed', name: 'Move Speed +20%', desc: 'Move faster' },
            { id: 'range', name: 'Attack Range +10%', desc: 'Hit from further away' },
            { id: 'overdrive_dur', name: 'Overdrive Dur +1s', desc: 'Overdrive lasts longer' },
            { id: 'overdrive_cost', name: 'Overdrive Cost -10', desc: 'Overdrive costs less HP' },
            { id: 'pickup_life', name: 'Pickup Life +5s', desc: 'Pickups last longer' }
        ];
        this.draftChoices = [];
        this.draftActive = false;
        this.killsInWave = 0;
        this.targetKills = 10;

        // Stats modified by perks
        this.statMaxHpBonus = 0;
        this.statDashCdMult = 1;
        this.statSpeedMult = 1;
        this.statRangeMult = 1;
        this.statOverdriveDurBonus = 0;
        this.statOverdriveCostReduction = 0;
        this.statPickupLifeBonus = 0;
    }
    reset() {
        this.wave = 1;
        this.combo = 0;
        this.comboTimer = 0;
        this.pickups = [];
        this.perks = [];
        this.draftActive = false;
        this.killsInWave = 0;
        this.targetKills = 10;
        this.statMaxHpBonus = 0;
        this.statDashCdMult = 1;
        this.statSpeedMult = 1;
        this.statRangeMult = 1;
        this.statOverdriveDurBonus = 0;
        this.statOverdriveCostReduction = 0;
        this.statPickupLifeBonus = 0;
    }
    spawnPickup(x, y) {
        if (Math.random() < 0.2) {
            const type = Math.random() < 0.3 ? 'health' : 'score';
            let p = new Pickup(x, y, type);
            p.life += this.statPickupLifeBonus;
            p.maxLife += this.statPickupLifeBonus;
            this.pickups.push(p);
        }
    }
    addKill(game) {
        this.combo++;
        this.comboTimer = this.maxComboTimer;
        this.killsInWave++;
        if (this.killsInWave >= this.targetKills) {
            this.startDraft(game);
        }
    }
    startDraft(game) {
        game.state = 'UPGRADE';
        this.draftActive = true;
        this.draftChoices = [];
        let pool = [...this.perkPool];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            this.draftChoices.push(pool[idx]);
            pool.splice(idx, 1);
        }
    }
    selectPerk(idx, game) {
        if (idx >= 0 && idx < this.draftChoices.length) {
            const perk = this.draftChoices[idx];
            this.perks.push(perk.id);
            this.applyPerk(perk.id, game.player);
        }
        this.draftActive = false;
        this.wave++;
        this.killsInWave = 0;

        // Balance Tuning: Upgrade scaling so late waves require more kills but not overwhelmingly so.
        // Base is 10, then increases by a slightly exponential factor for late game.
        const waveScaling = Math.floor(Math.pow(this.wave, 1.2) * 5);
        this.targetKills = 10 + waveScaling;

        game.state = 'PLAYING';
    }
    applyPerk(id, player) {
        if (id === 'max_hp') { this.statMaxHpBonus += 50; player.maxHp += 50; player.hp += 50; }
        if (id === 'heal') { player.hp = player.maxHp; }
        if (id === 'dash_cd') { this.statDashCdMult *= 0.8; }
        if (id === 'speed') { this.statSpeedMult *= 1.2; }
        if (id === 'range') { this.statRangeMult *= 1.1; }
        if (id === 'overdrive_dur') { this.statOverdriveDurBonus += 1; }
        if (id === 'overdrive_cost') { this.statOverdriveCostReduction += 10; }
        if (id === 'pickup_life') { this.statPickupLifeBonus += 5; }
    }
    update(dt, game) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboTimer = 0;
                this.combo = 0;
            }
        }
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];
            p.update(dt);
            if (p.life <= 0) {
                this.pickups.splice(i, 1);
                continue;
            }
            if (game.player) {
                const dx = p.x - game.player.x;
                const dy = p.y - game.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < game.player.size + p.size) {
                    if (p.type === 'health') {
                        game.player.hp = Math.min(game.player.maxHp, game.player.hp + 20);
                        game.sound.playTone(600, 'sine', 0.1, 0.5);
                    } else if (p.type === 'score') {
                        game.score += 50 * (1 + this.combo * 0.1);
                        game.sound.playTone(800, 'square', 0.1, 0.5);
                    }
                    this.pickups.splice(i, 1);
                }
            }
        }
    }
    draw(ctx, canvas, game) {
        for (let p of this.pickups) p.draw(ctx);

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('Combo: x' + this.combo, canvas.width - 10, 30);
        ctx.fillText('Wave: ' + this.wave, canvas.width - 10, 60);

        // Combo Bar
        if (this.combo > 0) {
            ctx.fillStyle = '#444';
            ctx.fillRect(canvas.width - 110, 35, 100, 10);
            ctx.fillStyle = '#ff0';
            const ratio = this.comboTimer / this.maxComboTimer;
            ctx.fillRect(canvas.width - 110, 35, 100 * ratio, 10);
        }
        ctx.restore();

        if (game.state === 'UPGRADE' && this.draftActive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '40px monospace';
            ctx.fillText('WAVE CLEARED!', canvas.width/2, canvas.height/2 - 150);
            ctx.font = '20px monospace';
            ctx.fillText('Select an Upgrade (Press 1, 2, or 3, or Click)', canvas.width/2, canvas.height/2 - 100);

            for (let i = 0; i < this.draftChoices.length; i++) {
                let choice = this.draftChoices[i];
                let y = canvas.height/2 - 40 + i * 80;
                ctx.fillStyle = '#333';
                ctx.fillRect(canvas.width/2 - 200, y - 30, 400, 60);
                ctx.fillStyle = '#fff';
                ctx.font = '16px monospace';
                ctx.fillText(`[${i+1}] ${choice.name}`, canvas.width/2, y - 5);
                ctx.fillStyle = '#aaa';
                ctx.font = '12px monospace';
                ctx.fillText(choice.desc, canvas.width/2, y + 15);
            }
        }
    }
}