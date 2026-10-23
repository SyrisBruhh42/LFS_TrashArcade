class Boss extends Orb {
    constructor(x, y, vx, vy, polarity) {
        super(x, y, vx, vy, polarity);
        this.radius = 40;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.phase = 1;
        this.stateTimer = 0;
    }
    takeDamage(amount = 1) {
        this.hp -= amount;
        if (window.game && window.game.sound) window.game.sound.playBossHit();
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseChange();
        }
        if (this.hp <= 0) this.active = false;
    }
    onPhaseChange() {}
    drawHealthBar(ctx, x, y) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 50, y - 60, 100, 10);
        ctx.fillStyle = this.phase === 1 ? '#00ff00' : '#ff0000';
        ctx.fillRect(x - 50, y - 60, 100 * (this.hp / this.maxHp), 10);
    }
}
class PhantomBaronBoss extends Boss {
    constructor(x, y, vx, vy, polarity) {
        super(x, y, vx, vy, polarity);
        this.maxHp = 200;
        this.hp = 200;
        this.attackTimer = 0;
        this.chargeTimer = 0;
    }
    update(dt, game) {
        if (!this.active) return;
        super.update(dt, game);
        this.attackTimer -= dt;
        if (this.phase === 1) {
            if (this.attackTimer <= 0) {
                this.attackTimer = 2;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i;
                    const spd = 150;
                    game.orbs.push(new Orb(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, Math.random()>0.5?1:-1));
                }
            }
        } else {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.chargeTimer = 3;
                const dx = game.player.x - this.x;
                const dy = game.player.y - this.y;
                const dist = Math.sqrt(dx*dx+dy*dy);
                this.vx = (dx/dist)*400;
                this.vy = (dy/dist)*400;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.polarity === 1 ? '#ff4444' : '#4444ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
        this.drawHealthBar(ctx, this.x, this.y);
    }
}
class MagneticConstructBoss extends Boss {
    constructor(x, y, vx, vy, polarity) {
        super(x, y, vx, vy, polarity);
        this.maxHp = 250;
        this.hp = 250;
        this.pullTimer = 0;
    }
    onPhaseChange() {
        // Enrage visual effect placeholder
    }
    update(dt, game) {
        if (!this.active) return;
        super.update(dt, game);
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (this.phase === 1) {
            if (this.polarity !== game.player.polarity) {
                game.player.x -= (dx/dist)*50*dt;
                game.player.y -= (dy/dist)*50*dt;
            } else {
                game.player.x += (dx/dist)*50*dt;
                game.player.y += (dy/dist)*50*dt;
            }
        } else {
            this.pullTimer -= dt;
            if(this.pullTimer <= 0) {
                this.pullTimer = 1.5;
                game.orbs.push(new SpawnerEnemy(this.x + (Math.random()-0.5)*100, this.y + (Math.random()-0.5)*100, 0, 0, Math.random()>0.5?1:-1));
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#aa00aa';
        ctx.fillRect(this.x-this.radius, this.y-this.radius, this.radius*2, this.radius*2);
        this.drawHealthBar(ctx, this.x, this.y);
    }
}
class BossManager {
    constructor() {
        this.activeBoss = null;
        this.warningTimer = 0;
        this.bossCount = 0;
    }
    spawnBoss(game) {
        this.bossCount++;
        const x = game.canvas.width / 2;
        const y = 100;
        if (this.bossCount % 2 === 1) {
            this.activeBoss = new PhantomBaronBoss(x, y, 50, 0, 1);
        } else {
            this.activeBoss = new MagneticConstructBoss(x, y, -50, 0, -1);
        }
    }
    update(dt, game) {
        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            if (this.warningTimer <= 0) {
                this.spawnBoss(game);
            }
            return;
        }
        if (this.activeBoss) {
            this.activeBoss.update(dt, game);
            if (!this.activeBoss.active) {
                this.activeBoss = null;
                game.score += 5000;
                game.nextBossScore = game.score + 2000;
            }
        }
    }
    draw(ctx, canvas) {
        if (this.warningTimer > 0) {
            ctx.fillStyle = 'rgba(255,0,0,0.5)';
            ctx.fillRect(0, canvas.height/2 - 50, canvas.width, 100);
            ctx.fillStyle = '#fff';
            ctx.font = '40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText("BOSS APPROACHING!", canvas.width/2, canvas.height/2);
        }
        if (this.activeBoss) {
            this.activeBoss.draw(ctx);
        }
    }
}
