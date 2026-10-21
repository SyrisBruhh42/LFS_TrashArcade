class BossManager {
    constructor(game) {
        this.game = game;
        this.activeBoss = null;
        this.warningTimer = 0;
        this.bossesSpawned = 0;
    }

    spawnBoss() {
        if (this.activeBoss) return;
        this.warningTimer = 3.0; // 3 seconds warning
        this.game.soundEngine.playBossSpawnSFX();
    }

    doSpawn() {
        let x = this.game.canvas.width / 2;
        let y = -50;
        if (this.bossesSpawned % 2 === 0) {
            this.activeBoss = new AmalgamBoss(x, y);
        } else {
            this.activeBoss = new TetherBreakerBoss(x, y);
        }
        this.game.enemies.push(this.activeBoss);
        this.bossesSpawned++;
    }

    update(dt) {
        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            if (this.warningTimer <= 0) {
                this.doSpawn();
            }
        }

        if (this.activeBoss) {
            if (this.activeBoss.markedForDeath) {
                this.activeBoss = null;
                this.game.updateScore(1000); // Boss kill bonus
                let sd = this.game.saveManager.data;
                if(!sd.unlockedMilestones) sd.unlockedMilestones = [];
                if(!sd.unlockedMilestones.includes('m_boss_kill')) {
                    sd.unlockedMilestones.push('m_boss_kill');
                    if(this.game.vfxManager) this.game.vfxManager.addFloatingText('Milestone: Boss Slayer', this.game.player.x, this.game.player.y - 40, '#f0f', 2);
                    this.game.saveManager.save();
                    if(this.game.uiManager) this.game.uiManager.renderMilestones();
                }
            }
        }
    }

    draw(ctx) {
        if (this.warningTimer > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, this.game.canvas.width, this.game.canvas.height);
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            if (Math.floor(this.warningTimer * 4) % 2 === 0) {
                ctx.fillText("WARNING: INCOMING SCRAP BOSS", this.game.canvas.width / 2, this.game.canvas.height / 2 - 20);
            }
            ctx.restore();
        }

        if (this.activeBoss && !this.activeBoss.markedForDeath) {
            // Draw Boss Health Bar
            ctx.save();
            let hpPercentage = this.activeBoss.hp / this.activeBoss.maxHp;
            let barWidth = this.game.canvas.width * 0.6;
            let barHeight = 20;
            let barX = (this.game.canvas.width - barWidth) / 2;
            let barY = 20;

            ctx.fillStyle = '#333';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = this.activeBoss.phase2 ? '#ff0000' : '#f5ca53';
            ctx.fillRect(barX, barY, barWidth * hpPercentage, barHeight);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#fff';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.activeBoss.bossName, this.game.canvas.width / 2, barY + 15);
            ctx.restore();
        }
    }
}

class BaseBoss extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.isBoss = true;
        this.phase2 = false;
        this.bossName = "UNKNOWN BOSS";
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.color = window.game && window.game.colors ? window.game.colors.boss : '#ff0000';
        this.radius = 30;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.markedForDeath = true;
        } else if (this.hp <= this.maxHp / 2 && !this.phase2) {
            this.phase2 = true;
            this.onPhaseTransition();
        }
    }

    onPhaseTransition() {
        // override
    }
}

class AmalgamBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y);
        this.bossName = "AMALGAM SCRAP-GIANT";
        this.maxHp = 500;
        this.hp = 500;
        this.radius = 45;
        this.speed = 40;
        this.color = '#8e44ad';
        this.attackTimer = 0;
        this.attackInterval = 3.0;
        this.projectilesToFire = 0;
        this.fireDelayTimer = 0;
    }

    onPhaseTransition() {
        this.speed = 80;
        this.attackInterval = 2.0;
        this.color = '#c0392b';
    }

    update(dt, playerX, playerY, tetherManager, game) {
        super.update(dt, playerX, playerY, tetherManager, game);

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.projectilesToFire = 8;
            this.attackTimer = this.attackInterval;
        }

        if (this.projectilesToFire > 0) {
            this.fireDelayTimer -= dt;
            if (this.fireDelayTimer <= 0) {
                let angle = (Math.PI * 2) * (this.projectilesToFire / 8);
                if (this.phase2) angle += Math.random() * 0.5;
                let vx = Math.cos(angle) * 150;
                let vy = Math.sin(angle) * 150;
                game.projectiles.push(new Projectile(this.x, this.y, vx, vy, 6, 4, '#ff9900', false));
                this.projectilesToFire--;
                this.fireDelayTimer = 0.1;
                game.soundEngine.playHitSFX();
            }
        }

        // Periodically spawn swarmers in phase 2
        if (this.phase2 && Math.random() < 0.01) {
            game.enemies.push(new SwarmerEnemy(this.x + (Math.random()-0.5)*40, this.y + (Math.random()-0.5)*40));
        }
    }

    draw(ctx) {
        super.draw(ctx);
        // Add some boss detailing
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = this.phase2 ? '#ffcc00' : '#111';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

class TetherBreakerBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y);
        this.bossName = "TETHER-BREAKER ENGINE";
        this.maxHp = 600;
        this.hp = 600;
        this.radius = 35;
        this.speed = 150;
        this.color = '#d35400';
        this.chargeTimer = 2.0;
        this.isCharging = false;
        this.chargeTargetX = 0;
        this.chargeTargetY = 0;
        this.hazardTimer = 4.0;
    }

    onPhaseTransition() {
        this.speed = 220;
        this.color = '#f1c40f';
    }

    update(dt, playerX, playerY, tetherManager, game) {
        // Custom movement for charging
        if (this.isCharging) {
            let dx = this.chargeTargetX - this.x;
            let dy = this.chargeTargetY - this.y;
            let dist = Math.hypot(dx, dy);
            if (dist > 10) {
                this.x += (dx / dist) * this.speed * 2 * dt;
                this.y += (dy / dist) * this.speed * 2 * dt;
            } else {
                this.isCharging = false;
                this.chargeTimer = this.phase2 ? 1.5 : 2.5;
            }
        } else {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.isCharging = true;
                this.chargeTargetX = playerX;
                this.chargeTargetY = playerY;
            } else {
                // slow tracking while resting
                let dx = playerX - this.x;
                let dy = playerY - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    this.x += (dx / dist) * this.speed * 0.3 * dt;
                    this.y += (dy / dist) * this.speed * 0.3 * dt;
                }
            }
        }

        this.hazardTimer -= dt;
        if (this.hazardTimer <= 0) {
            // Shoot hazard projectile that creates a cover
            let dx = playerX - this.x;
            let dy = playerY - this.y;
            let dist = Math.hypot(dx, dy);
            let vx = (dx / dist) * 200;
            let vy = (dy / dist) * 200;
            game.projectiles.push(new Projectile(this.x, this.y, vx, vy, 10, 5, '#8e44ad', true));
            this.hazardTimer = this.phase2 ? 2.5 : 4.0;
            if (this.phase2) {
                 game.enemies.push(new SplitterEnemy(this.x, this.y));
            }
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x - this.radius, this.y - this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        if (this.isCharging) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.lineWidth = 5;
            ctx.stroke();
        }
    }
}
