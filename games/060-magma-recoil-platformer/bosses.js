class BossBullet {
    constructor(x, y, vx, vy, r = 5, color = '#f0f') {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = r; this.color = color;
        this.life = 3.0;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
    }
}

class BaseBoss {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.alive = true;
        this.maxHp = 1000;
        this.hp = this.maxHp;
        this.radius = 40;
        this.timer = 0;
        this.state = 'SPAWN';
        this.phase = 1;
        this.warningTime = 3.0;
        this.color = '#fff';
    }
    update(dt, game) {
        if (this.state === 'SPAWN') {
            this.warningTime -= dt;
            if (this.warningTime <= 0) this.state = 'ACTIVE';
            return;
        }
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseTransition(game);
        }
    }
    onPhaseTransition(game) {}
    draw(ctx) {
        if (this.state === 'SPAWN') {
            return;
        }
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
    }
    drawHealthBar(ctx, width) {
        if (this.state === 'SPAWN') {
            ctx.fillStyle = `rgba(255, 0, 0, ${0.5 + Math.sin(this.warningTime * 10) * 0.5})`;
            ctx.font = '30px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('WARNING: BOSS INCOMING', width/2, 100);
            return;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(width * 0.1, 50, width * 0.8, 20);
        ctx.fillStyle = this.phase === 1 ? '#f00' : '#f0f';
        ctx.fillRect(width * 0.1, 50, (width * 0.8) * (this.hp / this.maxHp), 20);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(width * 0.1, 50, width * 0.8, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`BOSS - Phase ${this.phase}`, width/2, 45);
    }
}

class MagmaWormBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y);
        this.maxHp = 1500;
        this.hp = 1500;
        this.radius = 50;
        this.color = '#ff4400';
        this.targetY = y;
        this.baseX = x;
        this.moveTimer = 0;
    }
    update(dt, game) {
        super.update(dt, game);
        if (this.state !== 'ACTIVE') return;

        this.moveTimer += dt;
        this.x = this.baseX + Math.sin(this.moveTimer) * (game.width * 0.3 || 200);
        this.y += (this.targetY - this.y) * dt * 2;

        if (game.player) {
            this.targetY = game.cameraY + (game.height || 600) * 0.2 + Math.sin(this.moveTimer * 0.5) * 100;
        }

        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.phase === 1 ? 2.0 : 1.0;
            if (game.enemyBullets) {
                let count = this.phase === 1 ? 8 : 16;
                for (let i = 0; i < count; i++) {
                    let angle = (Math.PI * 2 / count) * i + this.moveTimer;
                    game.enemyBullets.push(new BossBullet(
                        this.x, this.y,
                        Math.cos(angle) * 200, Math.sin(angle) * 200,
                        8, '#ffaa00'
                    ));
                }
            }
        }
    }
    onPhaseTransition(game) {
        for(let i=0; i<20; i++) game.particles.push(new Particle(this.x, this.y, '#fff'));
        game.audio.playExplosion();
    }
}

class CoreGuardianBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y);
        this.maxHp = 2000;
        this.hp = 2000;
        this.radius = 60;
        this.color = '#4400ff';
        this.targetX = x;
        this.targetY = y;
    }
    update(dt, game) {
        super.update(dt, game);
        if (this.state !== 'ACTIVE') return;

        if (game.player) {
            this.targetX = game.player.x;
            this.targetY = game.player.y - 200;
        }

        this.x += (this.targetX - this.x) * dt;
        this.y += (this.targetY - this.y) * dt;

        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = this.phase === 1 ? 1.5 : 0.8;
            if (game.enemyBullets && game.player) {
                let dx = game.player.x - this.x;
                let dy = game.player.y - this.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 0) {
                    game.enemyBullets.push(new BossBullet(
                        this.x, this.y,
                        (dx/dist) * 400, (dy/dist) * 400,
                        10, '#00ffff'
                    ));
                    if (this.phase === 2) {
                        game.enemyBullets.push(new BossBullet(this.x, this.y, (dx/dist)*400 + 50, (dy/dist)*400 - 50, 8, '#00ffff'));
                        game.enemyBullets.push(new BossBullet(this.x, this.y, (dx/dist)*400 - 50, (dy/dist)*400 + 50, 8, '#00ffff'));
                    }
                }
            }
        }
    }
    onPhaseTransition(game) {
        for(let i=0; i<30; i++) game.particles.push(new Particle(this.x, this.y, '#00ffff'));
        game.audio.playExplosion();
    }
}
