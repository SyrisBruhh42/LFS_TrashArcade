class BossManager {
    constructor() {
        this.boss = null;
        this.warningTimer = 0;
        this.warningDuration = 3;
        this.bossWaveActive = false;
        this.bossDefeatedWave = 0;
    }

    update(dt, game) {
        if (game.wave > 0 && game.wave % 5 === 0 && this.bossDefeatedWave !== game.wave && !this.bossWaveActive) {
            this.bossWaveActive = true;
            this.warningTimer = this.warningDuration;
            game.enemies = [];

            let bossType = (game.wave / 5) % 2 === 1 ? 1 : 2;
            if (bossType === 1) {
                this.boss = new AlphaCoreBoss(game.width / 2, -100);
            } else {
                this.boss = new OmegaSwarmBoss(game.width / 2, -100);
            }
            if(game.sound) {
                if (game.sound.bossSpawn) game.sound.bossSpawn();
                else game.sound.echoSpawn();
            }
        }

        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            if (this.warningTimer <= 0 && this.boss) {
                game.enemies.push(this.boss);
            }
        }

        if (this.bossWaveActive && this.warningTimer <= 0) {
            if (this.boss && (!this.boss.active || this.boss.hp <= 0)) {
                this.bossWaveActive = false;
                this.bossDefeatedWave = game.wave;
                this.boss = null;
            }
        }
    }

    draw(ctx, game) {
        if (this.warningTimer > 0) {
            ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(this.warningTimer * 10)) * 0.5})`;
            ctx.fillRect(0, game.height / 2 - 50, game.width, 100);
            ctx.fillStyle = '#fff';
            ctx.font = '40px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('WARNING: BOSS APPROACHING', game.width / 2, game.height / 2 + 10);
            ctx.textAlign = 'left';
        }

        if (this.boss && this.bossWaveActive && this.warningTimer <= 0) {
            let hpRatio = Math.max(0, this.boss.displayHp / this.boss.maxHp);
            let barWidth = game.width - 200;
            let barHeight = 20;
            let barX = 100;
            let barY = 50;

            ctx.fillStyle = '#444';
            ctx.fillRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = this.boss.phase === 2 ? '#ff0000' : '#ff00ff';
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(barX, barY, barWidth, barHeight);

            ctx.fillStyle = '#fff';
            ctx.font = '16px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText(this.boss.name + (this.boss.phase === 2 ? ' (ENRAGED)' : ''), game.width / 2, barY - 10);
            ctx.textAlign = 'left';
        }
    }
}

class BaseBoss extends BaseEnemy {
    constructor(x, y, name) {
        super(x, y, 'boss');
        this.name = name;
        this.radius = 40;
        this.maxHp = 1000;
        this.hp = 1000;
        this.displayHp = 1000;
        this.phase = 1;
        this.speed = 40;
        this.color = '#ff00ff';
        this.value = 250;
        this.attackTimer = 0;
        this.pos = new Vector2(x, y);
        this.targetPos = new Vector2(x, y + 200);
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseChange();
        }
    }

    onPhaseChange() {
        this.color = '#ff0000';
        if (window.game && window.game.vfx) {
            window.game.vfx.hitStop(0.1);
            window.game.vfx.shakeScreen(15, 0.5);
            window.game.vfx.spawnFloatingText(this.pos.x, this.pos.y, "PHASE 2", "#ff0000");
        }
    }

    update(dt, game) {
        this.displayHp += (this.hp - this.displayHp) * dt * 5;

        let dir = this.targetPos.sub(this.pos);
        if (dir.mag() > 5) {
            this.pos = this.pos.add(dir.norm().mul(this.speed * dt));
        } else {
            this.idleMove(dt, game);
        }

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack(game);
        }
    }

    idleMove(dt, game) {
        // Base does nothing
    }

    attack(game) {
        // Base does nothing
    }

    die(game) {
        for(let i=0; i<50; i++) {
            game.spawnParticles(this.pos.x, this.pos.y, this.color, 1);
        }
        if (game.vfx) {
            game.vfx.spawnExplosion(this.pos.x, this.pos.y, this.color, 100);
            game.vfx.shakeScreen(25, 0.8);
            game.vfx.hitStop(0.2);
            game.vfx.spawnFloatingText(this.pos.x, this.pos.y, "DESTROYED", "#ff00ff");
        }
        if(game.sound) {
            game.sound.hit();
            game.sound.hit();
            game.sound.hit();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class AlphaCoreBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y, 'ALPHA CORE');
        this.attackTimer = 2;
        this.angle = 0;
    }

    idleMove(dt, game) {
        this.angle += dt * (this.phase === 2 ? 1 : 0.5);
        this.targetPos.x = game.width / 2 + Math.sin(this.angle) * 150;
        this.targetPos.y = 150 + Math.cos(this.angle * 2) * 50;
    }

    attack(game) {
        this.attackTimer = this.phase === 2 ? 1.5 : 2.5;

        let targets = [game.player];
        game.echoes.forEach(e => { if (e.active) targets.push(e); });

        targets.forEach(t => {
            let dir = t.pos.sub(this.pos).norm();
            for(let i = -1; i <= 1; i++) {
                let spread = 0.2 * i;
                let spreadDir = new Vector2(
                    dir.x * Math.cos(spread) - dir.y * Math.sin(spread),
                    dir.x * Math.sin(spread) + dir.y * Math.cos(spread)
                );
                game.spawnBullet(this.pos, spreadDir, false, '#ff0000');
            }
        });

        if (this.phase === 2) {
            for(let i = 0; i < 12; i++) {
                let ang = (Math.PI * 2 / 12) * i + this.angle;
                let dir = new Vector2(Math.cos(ang), Math.sin(ang));
                game.spawnBullet(this.pos, dir, false, '#ffaa00');
            }
        }

        if(game.sound) game.sound.shoot();
    }
}

class OmegaSwarmBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y, 'OMEGA SWARM');
        this.attackTimer = 1.5;
        this.angle = 0;
        this.color = '#00ffaa';
        this.maxHp = 1200;
        this.hp = 1200;
        this.displayHp = 1200;
    }

    onPhaseChange() {
        this.color = '#ff5500';
    }

    idleMove(dt, game) {
        this.angle += dt * 0.8;
        this.targetPos.x = game.width / 2 + Math.cos(this.angle) * 200;
        this.targetPos.y = 180 + Math.sin(this.angle * 3) * 60;
    }

    attack(game) {
        this.attackTimer = this.phase === 2 ? 2.0 : 3.0;

        let count = this.phase === 2 ? 4 : 2;
        for(let i = 0; i < count; i++) {
            let ex = this.pos.x + (Math.random() - 0.5) * 100;
            let ey = this.pos.y + (Math.random() - 0.5) * 100;
            let enemy = new SwarmerEnemy(ex, ey);
            game.enemies.push(enemy);
        }

        let coreDir = game.core.pos.sub(this.pos).norm();
        game.spawnBullet(this.pos, coreDir, false, '#ffffff');

        if(game.sound) game.sound.shoot();
    }
}
