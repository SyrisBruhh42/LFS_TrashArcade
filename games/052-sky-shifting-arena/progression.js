class UpgradeManager {
    constructor(engine) {
        this.engine = engine;
        this.pool = [
            { id: 'maxHealthUp', name: 'Titanium Hull', desc: 'Increases Max Health by 20.', apply: (p) => { p.maxHealth += 20; p.health += 20; } },
            { id: 'speedUp', name: 'Thruster Overclock', desc: 'Increases Movement Speed.', apply: (p) => { p.speed += 30; } },
            { id: 'fireRateUp', name: 'Auto-Loader', desc: 'Increases Fire Rate.', apply: (p) => { p.fireRate = Math.max(0.05, p.fireRate - 0.02); } },
            { id: 'damageUp', name: 'High-Explosive Rounds', desc: 'Increases Bullet Damage.', apply: (p) => { p.bonusDamage = (p.bonusDamage || 0) + 5; } },
            { id: 'dashCooldownDown', name: 'Quick Charge', desc: 'Reduces Dash Cooldown.', apply: (p) => { p.dashCooldownMax = Math.max(1.0, p.dashCooldownMax - 0.5); } },
            { id: 'pierceUp', name: 'Armor Piercing', desc: 'Bullets pierce through enemies.', apply: (p) => { p.pierceCount = (p.pierceCount || 0) + 1; } },
            { id: 'multiShotUp', name: 'Split Barrel', desc: 'Fires extra projectiles.', apply: (p) => { p.multishot = (p.multishot || 0) + 1; } },
            { id: 'bulletSizeUp', name: 'Heavy Caliber', desc: 'Increases Bullet Size.', apply: (p) => { p.bulletScale = (p.bulletScale || 0) + 2; } }
        ];
    }

    generateChoices() {
        // Return 3 distinct random upgrades
        const shuffled = [...this.pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 3);
    }

    showUpgrades() {
        this.engine.setState('UPGRADING');
        const choices = this.generateChoices();
        const container = document.getElementById('upgrade-cards');
        if (!container) return;

        container.innerHTML = '';
        choices.forEach(choice => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <h3>${choice.name}</h3>
                <p>${choice.desc}</p>
            `;
            card.addEventListener('click', () => {
                choice.apply(this.engine.player);
                this.engine.audio.playHit(); // Using playHit as generic positive sound
                this.engine.continueNextWave();
            });
            container.appendChild(card);
        });
    }
}

class ComboManager {
    constructor(engine) {
        this.engine = engine;
        this.multiplier = 1.0;
        this.timer = 0;
        this.maxTime = 5.0; // seconds before combo decays completely
    }

    addScore(points) {
        const totalPoints = Math.floor(points * this.multiplier);
        this.engine.score += totalPoints;

        // Increase multiplier slightly on each kill, cap at e.g. 5.0
        this.multiplier = Math.min(5.0, this.multiplier + 0.1);

        // Refill combo timer
        this.timer = this.maxTime;

        this.engine.updateHUD(); // force HUD update on score change
    }

    update(dt) {
        if (this.timer > 0) {
            this.timer -= dt;
            if (this.timer <= 0) {
                // Combo broken
                this.multiplier = 1.0;
                this.timer = 0;
                this.engine.updateHUD(); // force HUD update on combo break
            }
        }
    }
}

class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'health' or 'score'
        this.radius = 8;
        this.active = true;
        this.lifetime = 10.0;
        this.blinkTimer = 0;
    }

    update(dt) {
        this.lifetime -= dt;
        if (this.lifetime <= 0) {
            this.active = false;
        }
    }

    draw(ctx, dt) {
        if (!this.active) return;

        // Blink when about to expire
        if (this.lifetime < 3.0) {
            this.blinkTimer += dt || 0.016;
            if (Math.floor(this.blinkTimer * 10) % 2 === 0) return;
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.type === 'health') {
            ctx.fillStyle = '#ff4d4d'; // Red cross or circle
            ctx.fillRect(-this.radius, -this.radius/3, this.radius*2, this.radius/1.5);
            ctx.fillRect(-this.radius/3, -this.radius, this.radius/1.5, this.radius*2);
        } else {
            // Score gem
            ctx.fillStyle = '#00ffff';
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, 0);
            ctx.lineTo(0, this.radius);
            ctx.lineTo(-this.radius, 0);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

class PickupManager {
    constructor(engine) {
        this.engine = engine;
        this.pickups = [];
    }

    spawn(x, y) {
        // Chance to spawn
        const roll = Math.random();
        if (roll < 0.05) {
            this.pickups.push(new Pickup(x, y, 'health'));
        } else if (roll < 0.15) {
            this.pickups.push(new Pickup(x, y, 'score'));
        }
    }

    update(dt, player) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];

            p.update(dt);

            if (p.active) {
                const dist = Math.hypot(player.x - p.x, player.y - p.y);
                if (dist < player.radius + p.radius) {
                    // Collected
                    p.active = false;
                    this.engine.audio.playShoot(); // Reuse shoot sound for pickup
                    if (p.type === 'health') {
                        player.health = Math.min(player.maxHealth, player.health + 20);
                        this.engine.updateHUD();
                    } else if (p.type === 'score') {
                        this.engine.comboManager.addScore(50);
                    }
                }
            }

            if (!p.active) {
                this.pickups.splice(i, 1);
            }
        }
    }

    draw(ctx, dt) {
        this.pickups.forEach(p => p.draw(ctx, dt));
    }
}
