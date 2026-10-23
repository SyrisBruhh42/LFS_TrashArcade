class BaseBoss extends Entity {
    constructor(x, y, maxHp, game) {
        super(x, y, 60);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.phase = 1;
        this.timer = 0;
        this.game = game;
        this.targetPos = new Vector2(x, y);
    }
    update(dt) {
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseTransition();
        }
    }
    onPhaseTransition() {
        this.game.spawnParticles(this.pos.x, this.pos.y, 1, 50);
        this.game.sound.playExplosion();
    }
}

class MagnetoBoss extends BaseBoss {
    constructor(x, y, wave, game) {
        super(x, y, 800 + wave * 400, game);
        this.attackTimer = 0;
    }
    update(dt) {
        super.update(dt);
        this.timer += dt;
        this.attackTimer += dt;

        if (MathUtils.distSq(this.pos.x, this.pos.y, this.targetPos.x, this.targetPos.y) < 100) {
            this.targetPos.set(MathUtils.rand(100, this.game.width - 100), MathUtils.rand(100, this.game.height/3));
        }
        const dx = this.targetPos.x - this.pos.x;
        const dy = this.targetPos.y - this.pos.y;
        const mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > 0) this.vel.set((dx/mag)*100, (dy/mag)*100);

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        if (this.phase === 1) {
            if (this.attackTimer > 2) {
                this.attackTimer = 0;
                const p = Math.random() > 0.5 ? 1 : -1;
                for(let i=0; i<12; i++) {
                    const angle = (i/12) * Math.PI * 2;
                    const speed = 150;
                    this.game.spawnBullet(this.pos.x, this.pos.y, Math.cos(angle)*speed, Math.sin(angle)*speed, p, true);
                }
                this.game.sound.playShoot(p === 1);
            }
        } else {
            if (this.attackTimer > 1.5) {
                this.attackTimer = 0;
                for (let p of [1, -1]) {
                    for(let i=0; i<8; i++) {
                        const angle = (i/8) * Math.PI * 2 + this.timer;
                        const speed = 180;
                        this.game.spawnBullet(this.pos.x, this.pos.y, Math.cos(angle)*speed, Math.sin(angle)*speed, p, true);
                    }
                }
                this.game.sound.playShoot(true);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.timer);
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        ctx.fillStyle = this.phase === 1 ? '#444' : '#662222';
        ctx.fill();
        ctx.strokeStyle = '#7751ef';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI*2);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.restore();
    }
}

class PolarisBoss extends BaseBoss {
    constructor(x, y, wave, game) {
        super(x, y, 1200 + wave * 500, game);
        this.attackTimer = 0;
        this.spin = 0;
    }
    update(dt) {
        super.update(dt);
        this.timer += dt;
        this.attackTimer += dt;

        if (MathUtils.distSq(this.pos.x, this.pos.y, this.targetPos.x, this.targetPos.y) < 100) {
            this.targetPos.set(MathUtils.rand(100, this.game.width - 100), MathUtils.rand(100, this.game.height/4));
        }
        const dx = this.targetPos.x - this.pos.x;
        const dy = this.targetPos.y - this.pos.y;
        const mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > 0) this.vel.set((dx/mag)*150, (dy/mag)*150);

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;

        if (this.phase === 1) {
            if (this.attackTimer > 1) {
                this.attackTimer = 0;
                const p = this.timer % 2 < 1 ? 1 : -1;
                for(let i=0; i<5; i++) {
                    const angle = Math.PI/2 + (i-2)*0.2;
                    const speed = 200;
                    this.game.spawnBullet(this.pos.x, this.pos.y, Math.cos(angle)*speed, Math.sin(angle)*speed, p, true);
                }
                this.game.sound.playShoot(p === 1);
            }
        } else {
            if (this.attackTimer > 0.1) {
                this.attackTimer = 0;
                this.spin += 0.3;
                const p = Math.random() > 0.5 ? 1 : -1;
                const speed = 250;
                this.game.spawnBullet(this.pos.x, this.pos.y, Math.cos(this.spin)*speed, Math.sin(this.spin)*speed, p, true);
                this.game.spawnBullet(this.pos.x, this.pos.y, Math.cos(this.spin + Math.PI)*speed, Math.sin(this.spin + Math.PI)*speed, -p, true);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(-this.timer);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fillStyle = this.phase === 1 ? '#225588' : '#882255';
        ctx.fill();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }
}