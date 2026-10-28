class WaveDirector {
    constructor(game) {
        this.game = game;
        this.currentWave = 1;
        this.enemiesKilledThisWave = 0;
        this.targetKills = 10;
        this.active = true;
    }

    onEnemyKilled() {
        this.enemiesKilledThisWave++;
    }

    update(dt) {
        if (!this.active) return;

        // Ensure boss spawns don't interfere incorrectly
        if (this.game.bossManager && this.game.bossManager.activeBoss) {
            return; // Pause wave progression while fighting boss
        }

        if (this.enemiesKilledThisWave >= this.targetKills && this.game.enemies.length === 0) {
            this.active = false;

            // Clear things out for upgrade screen
            this.game.tetherManager.nodes = [];
            this.game.projectiles = [];
            this.game.hazardManager.hazards = [];

            this.game.soundEngine.playEnemySpawnSFX();
            setTimeout(() => {
                this.game.soundEngine.playEnemySpawnSFX();
            }, 100);
            setTimeout(() => {
                this.game.soundEngine.playEnemySpawnSFX();
                this.game.setState('UPGRADE_DRAFT');
            }, 200);

            this.currentWave++;
            this.enemiesKilledThisWave = 0;
            this.targetKills = Math.floor(this.targetKills * 1.3) + 3;

            // Exponentially decay spawn interval for thrilling late waves
            this.game.enemySpawnInterval = Math.max(0.15, 1.0 * Math.pow(0.85, this.currentWave - 1));
        }
    }
    getSpawnType() {
        let r = Math.random();
        // Wave 1-2: mostly swarmers/bruisers
        if (this.currentWave <= 2) {
            if (r < 0.6) return 0; // Swarmer
            if (r < 0.9) return 1; // Bruiser
            return 4; // Hazard
        }
        // Wave 3-4: introduce snipers
        if (this.currentWave <= 4) {
            if (r < 0.4) return 0;
            if (r < 0.7) return 1;
            if (r < 0.9) return 2; // Sniper
            return 4;
        }
        // Wave 5+: introduce splitters and balance
        if (r < 0.3) return 0;
        if (r < 0.5) return 1;
        if (r < 0.7) return 2;
        if (r < 0.9) return 3; // Splitter
        return 4;
    }
}

class UpgradeManager {
    constructor(game) {
        this.game = game;
        this.upgrades = [
            {
                id: 'dash_cooldown',
                name: 'Hyper Thrusters',
                desc: 'Reduces Dash Cooldown by 20%.',
                apply: (g) => { g.player.dashCooldown *= 0.8; }
            },
            {
                id: 'dash_speed',
                name: 'Kinetic Overdrive',
                desc: 'Increases Dash Speed by 25%.',
                apply: (g) => { g.player.dashSpeed *= 1.25; }
            },
            {
                id: 'accel',
                name: 'Agility Tuning',
                desc: 'Increases movement acceleration by 30%.',
                apply: (g) => { g.player.accel *= 1.3; }
            },
            {
                id: 'combo_decay',
                name: 'Capacitor Banks',
                desc: 'Increases Max Combo Decay time by 1s.',
                apply: (g) => { g.maxComboDecayTimer += 1.0; }
            },
            {
                id: 'boss_thresh',
                name: 'Stealth Coating',
                desc: 'Increases score threshold for Boss by 25%.',
                apply: (g) => { g.scoreThresholdForBoss *= 1.25; }
            },
            {
                id: 'recoil_reduce',
                name: 'Inertial Dampeners',
                desc: 'Reduces recoil from detonation by 30%.',
                apply: (g) => { g.player.recoilMultiplier = (typeof g.player.recoilMultiplier !== 'undefined' ? g.player.recoilMultiplier : 1.0) * 0.7; }
            },
            {
                id: 'score_bonus',
                name: 'Golden Scrap',
                desc: 'Permanent 25% score multiplier bonus.',
                apply: (g) => { g.scoreBonusMultiplier = (typeof g.scoreBonusMultiplier !== 'undefined' ? g.scoreBonusMultiplier : 1.0) + 0.25; }
            },
            {
                id: 'explosion_size',
                name: 'Unstable Isotope',
                desc: 'Increases Detonation Explosion Radius by 15%.',
                apply: (g) => { g.explosionRadiusMod = (typeof g.explosionRadiusMod !== 'undefined' ? g.explosionRadiusMod : 1.0) + 0.15; }
            }
        ];
    }

    getDraftChoices() {
        let choices = [];
        let pool = [...this.upgrades];
        for(let i=0; i<3; i++){
            if(pool.length === 0) break;
            let idx = Math.floor(Math.random() * pool.length);
            choices.push(pool.splice(idx, 1)[0]);
        }
        return choices;
    }

    applyUpgrade(id) {
        let upg = this.upgrades.find(u => u.id === id);
        if(upg) {
            upg.apply(this.game);
            this.game.soundEngine.playUpgradeSFX();
            setTimeout(() => {
                this.game.soundEngine.playUpgradeSFX();
            }, 100);
        }
    }
}

class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'combo' or 'score'
        this.radius = 10;
        this.life = 10.0; // disappear after 10s
        this.angle = 0;
    }

    update(dt, player, game) {
        this.life -= dt;
        this.angle += dt * 3;

        let dx = this.x - player.x;
        let dy = this.y - player.y;
        let dist = Math.hypot(dx, dy);

        if(dist < player.radius + this.radius) {
            // Collect
            if(this.type === 'combo') {
                game.comboDecayTimer = game.maxComboDecayTimer;
                game.soundEngine.playScrapPickupSFX();
            } else {
                let sbm = (typeof game.scoreBonusMultiplier !== 'undefined') ? game.scoreBonusMultiplier : 1.0;
                game.updateScore(Math.floor(250 * sbm * game.comboMultiplier));
                game.soundEngine.playScrapPickupSFX();
            }
            return true; // remove
        }
        return false;
    }

    draw(ctx) {
        if(this.life <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if(this.life < 2.0 && Math.floor(this.life * 10) % 2 === 0) {
            // blink
        } else {
            if(this.type === 'combo') {
                ctx.strokeStyle = '#f5ca53';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(-this.radius, 0);
                ctx.lineTo(0, -this.radius);
                ctx.lineTo(this.radius, 0);
                ctx.lineTo(0, this.radius);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.fillStyle = '#6c9b81';
                ctx.fillRect(-this.radius/2, -this.radius/2, this.radius, this.radius);
            }
        }
        ctx.restore();
    }
}

class PickupManager {
    constructor(game) {
        this.game = game;
        this.pickups = [];
    }

    dropPickup(x, y) {
        if(Math.random() < 0.2) {
            let type = Math.random() < 0.5 ? 'combo' : 'score';
            this.pickups.push(new Pickup(x, y, type));
        }
    }

    update(dt) {
        for(let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];
            if(p.life <= 0 || p.update(dt, this.game.player, this.game)) {
                this.pickups.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for(let p of this.pickups) {
            p.draw(ctx);
        }
    }
}

class AnalyticsTracker {
    constructor(game) {
        this.game = game;
        this.kills = 0;
        this.detonations = 0;
        this.maxTetherLength = 0;
        this.bossDefeats = 0;
    }
    recordKill() { this.kills++; }
    recordDetonation(length) {
        this.detonations++;
        if(length > this.maxTetherLength) this.maxTetherLength = length;
    }
    recordBossDefeat() { this.bossDefeats++; }
    draw(ctx) {
        if(this.game.state === 'GAME_OVER') {
            ctx.save();
            ctx.fillStyle = '#6c9b81';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`Kills: ${this.kills} | Detonations: ${this.detonations} | Max Tail: ${this.maxTetherLength} | Bosses: ${this.bossDefeats}`, this.game.canvas.width / 2, this.game.canvas.height / 2 + 100);
            ctx.restore();
        }
    }
}
