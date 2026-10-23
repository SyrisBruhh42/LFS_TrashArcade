class Pickup extends Entity {
    constructor(x, y, type) {
        super(x, y, 8);
        this.type = type;
        this.vy = 50;
        this.life = 15;
    }
    update(dt) {
        this.pos.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        if (this.type === 'heal') ctx.fillStyle = '#0f0';
        else if (this.type === 'score') ctx.fillStyle = '#ff0';
        else ctx.fillStyle = '#f0f';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

class ComboManager {
    constructor() {
        this.combo = 0;
        this.multiplier = 1;
        this.decayTimer = 0;
        this.maxDecayTime = 5;
    }
    addCombo(amount) {
        this.combo += amount;
        this.multiplier = 1 + Math.floor(this.combo / 10) * 0.5;
        this.decayTimer = this.maxDecayTime;
    }
    update(dt) {
        if (this.combo > 0) {
            this.decayTimer -= dt;
            if (this.decayTimer <= 0) {
                this.combo = 0;
                this.multiplier = 1;
            }
        }
    }
    getMultiplier() { return this.multiplier; }
}

class ProgressionManager {
    constructor(game) {
        this.game = game;
        this.pickups = [];
        this.comboManager = new ComboManager();
        this.draftOptions = [];
        this.selectedIndex = 0;

        this.perks = {
            maxHp: 100,
            speed: 300,
            damageMult: 1,
            fireRateMult: 1,
            healAmount: 20
        };

        this.availablePerks = [
            { id: 'hpUp', name: 'Max HP +20', desc: 'Increase maximum health', apply: () => { this.perks.maxHp += 20; this.game.player.maxHp = this.perks.maxHp; this.game.player.hp += 20; } },
            { id: 'heal', name: 'Full Heal', desc: 'Restore all health', apply: () => { this.game.player.hp = this.game.player.maxHp; } },
            { id: 'speedUp', name: 'Speed +15%', desc: 'Move faster', apply: () => { this.perks.speed *= 1.15; this.game.player.speed = this.perks.speed; } },
            { id: 'dmgUp', name: 'Damage +20%', desc: 'Deal more damage', apply: () => { this.perks.damageMult *= 1.2; } },
            { id: 'fireRate', name: 'Fire Rate +15%', desc: 'Shoot faster', apply: () => { this.perks.fireRateMult *= 0.85; } },
            { id: 'comboTime', name: 'Combo Time +2s', desc: 'Combo decays slower', apply: () => { this.comboManager.maxDecayTime += 2; } },
            { id: 'pickupHeal', name: 'Better Heals', desc: 'Heal pickups give +10 HP', apply: () => { this.perks.healAmount += 10; } },
            { id: 'pointsUp', name: 'Score Multiplier', desc: 'Gain +25% base score', apply: () => { this.game.scoreMult = (this.game.scoreMult || 1) * 1.25; } }
        ];
    }
    reset() {
        this.pickups = [];
        this.comboManager = new ComboManager();
        this.perks = {
            maxHp: 100,
            speed: 300,
            damageMult: 1,
            fireRateMult: 1,
            healAmount: 20
        };
        if (this.game.player) {
            this.game.player.maxHp = this.perks.maxHp;
            this.game.player.speed = this.perks.speed;
        }
        this.game.scoreMult = 1;
    }
    spawnPickup(x, y) {
        if (Math.random() < 0.2) {
            const types = ['heal', 'score', 'combo'];
            const type = types[Math.floor(Math.random() * types.length)];
            this.pickups.push(new Pickup(x, y, type));
        }
    }
    updatePlaying(dt) {
        this.comboManager.update(dt);
        this.pickups.forEach(p => {
            if (p.active) {
                p.update(dt);
                if (this.game.player && MathUtils.distSq(p.pos.x, p.pos.y, this.game.player.pos.x, this.game.player.pos.y) < (p.radius + this.game.player.radius)**2) {
                    p.active = false;
                    this.game.sound.playUIHover();
                    if (p.type === 'heal') {
                        this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + this.perks.healAmount);
                    } else if (p.type === 'score') {
                        this.game.addScore(50);
                    } else if (p.type === 'combo') {
                        this.comboManager.decayTimer = this.comboManager.maxDecayTime;
                        this.comboManager.addCombo(5);
                    }
                }
            }
        });
        this.pickups = this.pickups.filter(p => p.active);
    }
    showDraft() {
        this.game.setState('UPGRADE');
        this.game.sound.playLevelUp();
        this.draftOptions = [];
        const pool = [...this.availablePerks];
        for (let i = 0; i < 3; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            this.draftOptions.push(pool[idx]);
            pool.splice(idx, 1);
        }
        this.selectedIndex = 0;
    }
    update(dt) {
        if (this.game.input.isJustPressed('KeyW') || this.game.input.isJustPressed('ArrowUp')) {
            this.selectedIndex = (this.selectedIndex - 1 + 3) % 3;
            this.game.sound.playUIHover();
        }
        if (this.game.input.isJustPressed('KeyS') || this.game.input.isJustPressed('ArrowDown')) {
            this.selectedIndex = (this.selectedIndex + 1) % 3;
            this.game.sound.playUIHover();
        }
        if (this.game.input.isJustPressed('Space') || this.game.input.isJustPressed('Enter')) {
            this.draftOptions[this.selectedIndex].apply();
            this.game.sound.playUIClick();
            this.game.setState('PLAYING');
        }

        if (this.game.input.touchActive) {
            const tx = this.game.input.touchMove.x;
            const ty = this.game.input.touchMove.y;
            const startY = this.game.height/2 - 50;
            if (ty >= startY - 25 && ty < startY + 25) this.selectedIndex = 0;
            if (ty >= startY + 45 && ty < startY + 95) this.selectedIndex = 1;
            if (ty >= startY + 115 && ty < startY + 165) this.selectedIndex = 2;

            if (!this.lastTouchActive) {
                if (ty >= startY - 25 && ty < startY + 165) {
                    this.draftOptions[this.selectedIndex].apply();
                    this.game.sound.playUIClick();
                    this.game.setState('PLAYING');
                    this.game.input.touchActive = false;
                }
            }
        }
        this.lastTouchActive = this.game.input.touchActive;
    }
    drawPickups(ctx) {
        this.pickups.forEach(p => p.draw(ctx));
    }
    drawUI(ctx) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Combo: ${this.comboManager.combo}x`, this.game.width - 10, 30);
        ctx.fillText(`Mult: ${this.comboManager.multiplier.toFixed(1)}x`, this.game.width - 10, 50);

        if (this.comboManager.combo > 0) {
            ctx.fillStyle = '#333';
            ctx.fillRect(this.game.width - 110, 60, 100, 10);
            ctx.fillStyle = '#0ff';
            ctx.fillRect(this.game.width - 110, 60, 100 * (this.comboManager.decayTimer / this.comboManager.maxDecayTime), 10);
        }
    }
    drawDraft(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        ctx.fillStyle = '#fff';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEAR!', this.game.width/2, this.game.height/2 - 100);
        ctx.font = '20px sans-serif';
        ctx.fillText('Choose an Upgrade:', this.game.width/2, this.game.height/2 - 60);

        const startY = this.game.height/2 - 50;

        for (let i = 0; i < 3; i++) {
            const opt = this.draftOptions[i];
            const isSelected = i === this.selectedIndex;
            ctx.fillStyle = isSelected ? '#33ccff' : '#222';
            ctx.fillRect(this.game.width/2 - 150, startY + i * 70, 300, 50);
            ctx.strokeStyle = isSelected ? '#fff' : '#444';
            ctx.strokeRect(this.game.width/2 - 150, startY + i * 70, 300, 50);

            ctx.fillStyle = isSelected ? '#000' : '#fff';
            ctx.font = '18px sans-serif';
            ctx.fillText(opt.name, this.game.width/2, startY + i * 70 + 20);
            ctx.font = '12px sans-serif';
            ctx.fillText(opt.desc, this.game.width/2, startY + i * 70 + 40);
        }
    }
}
