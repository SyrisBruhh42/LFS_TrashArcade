class Projectile {
    constructor(x, y, dx, dy, speed, damage = 10, color = '#ff0') {
        this.x = x; this.y = y; this.dx = dx; this.dy = dy; this.speed = speed;
        this.size = 5; this.damage = damage; this.color = color;
        this.active = true;
    }
    update(dt) {
        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    }
}
class EnemySwarmer {
    constructor(x, y, speed) {
        this.x = x; this.y = y; this.speed = speed; this.size = 12; this.hp = 1; this.active = true;
    }
    update(dt, player, game) {
        const dx = player.x - this.x; const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
    }
    draw(ctx) {
        ctx.fillStyle = '#f00'; ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.size); ctx.lineTo(this.x + this.size, this.y + this.size); ctx.lineTo(this.x - this.size, this.y + this.size); ctx.fill();
    }
    takeDamage(amt, game, index) { this.hp -= amt; if(this.hp <= 0) game.enemies.splice(index, 1); }
}
class EnemySniper {
    constructor(x, y, speed) {
        this.x = x; this.y = y; this.speed = speed * 0.5; this.size = 15; this.hp = 1; this.active = true;
        this.shootTimer = 2; this.state = 'MOVE'; this.telegraphTimer = 0;
    }
    update(dt, player, game) {
        const dx = player.x - this.x; const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (this.state === 'MOVE') {
            if (dist > 250) { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
            else if (dist < 200) { this.x -= (dx / dist) * this.speed * dt; this.y -= (dy / dist) * this.speed * dt; }
            this.shootTimer -= dt;
            if (this.shootTimer <= 0) { this.state = 'TELEGRAPH'; this.telegraphTimer = 1; }
        } else if (this.state === 'TELEGRAPH') {
            this.telegraphTimer -= dt;
            if (this.telegraphTimer <= 0) {
                this.state = 'MOVE'; this.shootTimer = 3;
                if(game.projectiles) game.projectiles.push(new Projectile(this.x, this.y, dx/dist, dy/dist, 300));
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#f80'; ctx.fillRect(this.x - this.size, this.y - this.size, this.size*2, this.size*2);
        if (this.state === 'TELEGRAPH') {
            ctx.strokeStyle = 'rgba(255,0,0,0.5)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size*3, 0, Math.PI*2); ctx.stroke();
        }
    }
    takeDamage(amt, game, index) { this.hp -= amt; if(this.hp <= 0) game.enemies.splice(index, 1); }
}
class EnemyBruiser {
    constructor(x, y, speed) {
        this.x = x; this.y = y; this.speed = speed * 0.6; this.size = 25; this.hp = 3; this.active = true;
        this.shielded = true; this.shieldTimer = 3;
    }
    update(dt, player, game) {
        const dx = player.x - this.x; const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
        if (!this.shielded) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) { this.shielded = true; this.shieldTimer = 3; }
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#800'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
        if (this.shielded) { ctx.strokeStyle = '#0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 5, 0, Math.PI*2); ctx.stroke(); ctx.lineWidth = 1; }
    }
    takeDamage(amt, game, index) {
        if (this.shielded) { this.shielded = false; return; }
        this.hp -= amt; if(this.hp <= 0) game.enemies.splice(index, 1);
    }
}
class EnemySplitter {
    constructor(x, y, speed, size=20, hp=2) {
        this.x = x; this.y = y; this.speed = speed; this.size = size; this.hp = hp; this.active = true;
    }
    update(dt, player, game) {
        const dx = player.x - this.x; const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
    }
    draw(ctx) {
        ctx.fillStyle = '#a0a';
        ctx.beginPath(); ctx.moveTo(this.x, this.y - this.size); ctx.lineTo(this.x + this.size, this.y); ctx.lineTo(this.x, this.y + this.size); ctx.lineTo(this.x - this.size, this.y); ctx.fill();
    }
    takeDamage(amt, game, index) {
        this.hp -= amt;
        if(this.hp <= 0) {
            game.enemies.splice(index, 1);
            if (this.size > 10) {
                game.enemies.push(new EnemySplitter(this.x - 10, this.y, this.speed*1.2, 10, 1));
                game.enemies.push(new EnemySplitter(this.x + 10, this.y, this.speed*1.2, 10, 1));
            }
        }
    }
}
class EnemyHazard {
    constructor(x, y, speed) {
        this.x = x; this.y = y; this.speed = speed * 0.3; this.size = 18; this.hp = 2; this.active = true;
        this.trailTimer = 0;
    }
    update(dt, player, game) {
        const dx = player.x - this.x; const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) { this.x += (dx / dist) * this.speed * dt; this.y += (dy / dist) * this.speed * dt; }
        this.trailTimer -= dt;
        if (this.trailTimer <= 0) {
            this.trailTimer = 0.5;
            if(game.projectiles) game.projectiles.push(new Projectile(this.x, this.y, 0, 0, 0, 5, '#0f0'));
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#0f0';
        ctx.beginPath(); ctx.moveTo(this.x - this.size, this.y - this.size); ctx.lineTo(this.x + this.size, this.y - this.size);
        ctx.lineTo(this.x, this.y + this.size); ctx.fill();
    }
    takeDamage(amt, game, index) { this.hp -= amt; if(this.hp <= 0) game.enemies.splice(index, 1); }
}