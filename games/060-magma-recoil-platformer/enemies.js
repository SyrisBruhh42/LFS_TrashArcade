class EnemyBullet {
    constructor(x, y, vx, vy) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.radius = 4;
        this.life = 3.0;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
    draw(ctx) {
        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    }
}
class BaseEnemy {
    constructor(x, y) {
        this.x = x; this.y = y; this.radius = 12; this.alive = true; this.vx = 0; this.vy = 0;
    }
    update(dt, platforms, game) {
        this.x += this.vx * dt; this.vy += 800 * dt; this.y += this.vy * dt;
        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h && this.vy > 0) {
                this.y = p.y - this.radius; this.vy = 0;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2); ctx.fill();
    }
}
class SwarmerEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y); this.radius = 8; this.speed = 100 + Math.random()*50; }
    update(dt, platforms, game) {
        if (game && game.player) {
            let dir = Math.sign(game.player.x - this.x);
            this.vx = dir * this.speed;
        }
        super.update(dt, platforms, game);
    }
    draw(ctx) {
        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.fill();
    }
}
class SniperEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y); this.timer = Math.random() * 2 + 1; this.telegraph = 0;
    }
    update(dt, platforms, game) {
        super.update(dt, platforms, game);
        this.timer -= dt;
        if (this.timer <= 1.0 && this.timer > 0) this.telegraph = 1.0 - this.timer;
        else this.telegraph = 0;

        if (this.timer <= 0 && game && game.player && typeof game.enemyBullets !== 'undefined') {
            let dx = game.player.x - this.x; let dy = game.player.y - this.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                game.enemyBullets.push(new EnemyBullet(this.x, this.y, (dx/dist)*300, (dy/dist)*300));
            }
            this.timer = 3.0;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#00ffff'; ctx.fillRect(this.x - 10, this.y - 10, 20, 20);
        if (this.telegraph > 0) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${this.telegraph})`;
            ctx.beginPath(); ctx.arc(this.x, this.y, 25, 0, Math.PI*2); ctx.stroke();
        }
    }
}
class BruiserEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y); this.radius = 20; this.shield = 2; this.vx = (Math.random()-0.5)*50; }
    update(dt, platforms, game) {
        super.update(dt, platforms, game);
        if (this.x < 0 || this.x > window.innerWidth) this.vx *= -1;
    }
    draw(ctx) {
        ctx.fillStyle = this.shield > 0 ? '#4444ff' : '#8888ff';
        ctx.beginPath();
        for(let i=0; i<6; i++) {
            let angle = i * Math.PI / 3;
            let px = this.x + Math.cos(angle) * this.radius;
            let py = this.y + Math.sin(angle) * this.radius;
            if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
        }
        ctx.closePath(); ctx.fill();
        if(this.shield>0){ ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); ctx.lineWidth=1; }
    }
}
class SplitterEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y); this.radius = 16; this.vx = (Math.random()-0.5)*150; }
    update(dt, platforms, game) {
        super.update(dt, platforms, game);
        if (this.x < 0 || this.x > window.innerWidth) this.vx *= -1;
    }
    draw(ctx) {
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.arc(this.x-6, this.y, 8, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x+6, this.y, 8, 0, Math.PI*2); ctx.fill();
    }
}
class HazardEnemy extends BaseEnemy {
    constructor(x, y) { super(x, y); this.radius = 14; this.timer = 0; }
    update(dt, platforms, game) {
        super.update(dt, platforms, game);
        this.timer += dt;
        let phase = Math.sin(this.timer * 4);
        this.pulseRadius = this.radius + (phase > 0 ? phase * 40 : 0);
        if (phase > 0.8 && game && game.player) {
            let dx = game.player.x - this.x; let dy = game.player.y - this.y;
            if (Math.sqrt(dx*dx + dy*dy) < this.pulseRadius && game.player.invulnTime <= 0) {
                game.state = 'GAME_OVER';
                if (game.score > game.save.data.highScore) { game.save.data.highScore = game.score; game.save.save(); }
                game.save.data.totalGamesPlayed++; game.save.save();
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#aa00aa'; ctx.fillRect(this.x-10, this.y-10, 20, 20);
        if (this.pulseRadius > this.radius) {
            ctx.fillStyle = 'rgba(170, 0, 170, 0.4)';
            ctx.beginPath(); ctx.arc(this.x, this.y, this.pulseRadius, 0, Math.PI*2); ctx.fill();
        }
    }
}
