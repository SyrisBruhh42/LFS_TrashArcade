class BaseEnemy extends Entity {
    constructor(x, y, radius, hp, points) {
        super(x, y, radius);
        this.hp = hp;
        this.maxHp = hp;
        this.points = points;
        this.active = true;
        this.timer = 0;
        this.polarity = Math.random() < 0.5 ? 1 : -1;
    }
    takeDamage(dmg) {
        this.hp -= dmg;
        if (this.hp <= 0) this.active = false;
    }
}
class SwarmerEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y, 15, 30, 20); }
    update(dt, game) {
        this.timer += dt;
        const dx = game.player.pos.x - this.pos.x;
        const dy = game.player.pos.y - this.pos.y;
        const mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > 0) this.vel.set((dx/mag)*150, (dy/mag)*150);
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.pos.x, this.pos.y); ctx.rotate(Math.atan2(this.vel.y, this.vel.x));
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, 10); ctx.lineTo(-10, -10); ctx.closePath();
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    }
}
class SniperEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y, 20, 50, 40); this.shootTimer = 0; this.state = 'AIM'; }
    update(dt, game) {
        this.timer += dt;
        if (this.state === 'AIM') {
            this.shootTimer += dt;
            if (this.shootTimer > 2) {
                this.state = 'SHOOT'; this.shootTimer = 0;
                const dx = game.player.pos.x - this.pos.x;
                const dy = game.player.pos.y - this.pos.y;
                const mag = Math.sqrt(dx*dx + dy*dy);
                if (mag > 0) {
                    game.spawnBullet(this.pos.x, this.pos.y, (dx/mag)*300, (dy/mag)*300, this.polarity, true);
                    game.sound.playShoot();
                }
            }
        } else {
            this.shootTimer += dt;
            if (this.shootTimer > 1) { this.state = 'AIM'; this.shootTimer = 0; }
        }
        if (this.pos.y < 100) this.pos.y += 50 * dt;
        else this.pos.x += Math.sin(this.timer * 2) * 50 * dt;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath(); ctx.rect(-15, -15, 30, 30);
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        if (this.state === 'AIM') {
            VectorRenderer.drawAimTelegraph(ctx, 0, 0, Math.atan2(window.game.player.pos.y - this.pos.y, window.game.player.pos.x - this.pos.x), 200, 'rgba(255,0,0,0.5)');
        }
        ctx.restore();
    }
}
class ShieldedBruiser extends BaseEnemy {
    constructor(x, y) { super(x, y, 30, 150, 80); this.shieldActive = true; }
    update(dt, game) {
        this.timer += dt;
        this.pos.y += 40 * dt;
        if (this.timer % 4 < 2) this.shieldActive = true; else this.shieldActive = false;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(25, 20); ctx.lineTo(-25, 20); ctx.closePath();
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        if (this.shieldActive) {
            ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(200,200,255,0.5)'; ctx.lineWidth = 4; ctx.stroke();
        }
        ctx.restore();
    }
}
class SplitterEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y, 25, 60, 50); }
    update(dt, game) {
        this.timer += dt;
        this.pos.y += 60 * dt;
        this.pos.x += Math.cos(this.timer * 3) * 80 * dt;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(20, -20); ctx.lineTo(0, 20); ctx.closePath();
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
    }
}
class HazardEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y, 25, 80, 60); this.pulseTimer = 0; }
    update(dt, game) {
        this.timer += dt;
        this.pulseTimer += dt;
        if (this.pulseTimer > 3) {
            this.pulseTimer = 0;
            for(let i=0; i<8; i++) {
                const a = (i/8)*Math.PI*2;
                game.spawnBullet(this.pos.x, this.pos.y, Math.cos(a)*100, Math.sin(a)*100, this.polarity, true);
            }
        }
        this.pos.y += 30 * dt;
    }
    draw(ctx) {
        ctx.save(); ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath(); ctx.moveTo(0, -25); ctx.lineTo(25, 0); ctx.lineTo(0, 25); ctx.lineTo(-25, 0); ctx.closePath();
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        VectorRenderer.drawRing(ctx, 0, 0, 25 + this.pulseTimer*10, 'rgba(255,100,100,0.5)', 2);
        ctx.restore();
    }
}
class EnemySpawner {
    constructor() { this.timer = 0; this.spawnInterval = 4; }
    update(dt, game) {
        this.timer += dt;
        if (this.timer > this.spawnInterval) {
            this.timer = 0;
            this.spawnInterval = MathUtils.rand(3, 5) - (game.wave * 0.15);
            if (this.spawnInterval < 0.3) this.spawnInterval = 0.3;

            let maxType = Math.min(6, Math.floor(game.wave / 2));
            const type = MathUtils.randInt(0, maxType);
            const x = MathUtils.rand(50, game.width - 50);
            const y = -50;
            let enemy;
            switch(type) {
                case 0: enemy = new SwarmerEnemy(x, y); break;
                case 1: enemy = new SniperEnemy(x, y); break;
                case 2: enemy = new ShieldedBruiser(x, y); break;
                case 3: enemy = new SplitterEnemy(x, y); break;
                case 4: enemy = new HazardEnemy(x, y); break;
                case 5: enemy = new HeavyTankEnemy(x, y); break;
                case 6: enemy = new HeavyTankEnemyElite(x, y); break;
            }
            game.enemies.push(enemy);
            game.sound.playEnemySpawn();
        }
    }
}
window.EnemySpawner = new EnemySpawner();
class HeavyTankEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 35, 300, 150);
        this.shootTimer = 0;
        this.speed = 20;
    }
    update(dt, game) {
        this.timer += dt;
        this.shootTimer += dt;

        const dx = game.player.pos.x - this.pos.x;
        const dy = game.player.pos.y - this.pos.y;
        const mag = Math.sqrt(dx*dx + dy*dy);

        if (mag > 0) {
            this.vel.set((dx/mag) * this.speed, (dy/mag) * this.speed);
        }

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        if (this.shootTimer > 2.5) {
            this.shootTimer = 0;
            const p = Math.random() > 0.5 ? 1 : -1;
            game.spawnBullet(this.pos.x - 15, this.pos.y + 20, 0, 150, p, true);
            game.spawnBullet(this.pos.x + 15, this.pos.y + 20, 0, 150, p, true);
            game.sound.playShoot(p === 1);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.rect(-30, -20, 60, 40);
        ctx.fillStyle = this.polarity === 1 ? '#aa1133' : '#1166aa';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
    }
}

class HeavyTankEnemyElite extends HeavyTankEnemy {
    constructor(x, y) {
        super(x, y);
        this.maxHp = 600;
        this.hp = 600;
        this.speed = 25;
        this.points = 300;
    }
    draw(ctx) {
        super.draw(ctx);
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff0';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}
