class RookCharger extends Enemy {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#00e5ff';
        this.speed = 150;
        this.chargeTimer = 0;
        this.chargeDir = {x: 0, y: 0};
        this.charging = false;
    }
    update(dt, player) {
        if (this.charging) {
            this.x += this.chargeDir.x * this.speed * 2 * dt;
            this.y += this.chargeDir.y * this.speed * 2 * dt;
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.charging = false;
                this.chargeTimer = 2.0;
            }
        } else {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                let dx = player.x - this.x;
                let dy = player.y - this.y;
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.chargeDir = {x: Math.sign(dx), y: 0};
                } else {
                    this.chargeDir = {x: 0, y: Math.sign(dy)};
                }
                this.charging = true;
                this.chargeTimer = 1.0;
            }
        }
    }
}

class BishopLaser extends Enemy {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#00e676';
        this.speed = 50;
    }
    update(dt, player) {
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0 && dist > 150) {
            this.x += (dx/dist) * this.speed * dt;
            this.y += (dy/dist) * this.speed * dt;
        }
    }
    draw(ctx) {
        super.draw(ctx);
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x + this.size/2, this.y + this.size/2);
        ctx.lineTo(this.x + this.size/2 + 200, this.y + this.size/2 + 200);
        ctx.moveTo(this.x + this.size/2, this.y + this.size/2);
        ctx.lineTo(this.x + this.size/2 - 200, this.y + this.size/2 + 200);
        ctx.moveTo(this.x + this.size/2, this.y + this.size/2);
        ctx.lineTo(this.x + this.size/2 + 200, this.y + this.size/2 - 200);
        ctx.moveTo(this.x + this.size/2, this.y + this.size/2);
        ctx.lineTo(this.x + this.size/2 - 200, this.y + this.size/2 - 200);
        ctx.stroke();
    }
}

class ShieldPhalanx extends Enemy {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#00e5ff';
        this.speed = 40;
        this.hp = 3;
    }
    takeDamage() {
        this.hp -= 1;
        return this.hp <= 0;
    }
    draw(ctx) {
        super.draw(ctx);
        ctx.fillStyle = '#050a12';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.hp, this.x + this.size/2, this.y + this.size/2 + 4);
    }
}

class TileSpawner extends Enemy {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#00e676';
        this.speed = 60;
        this.spawnTimer = 5.0;
    }
    update(dt, player) {
        super.update(dt, player);
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            if (window.game && window.game.enemies) {
                window.game.enemies.push(new Enemy(this.x, this.y, this.size));
            }
            this.spawnTimer = 5.0;
        }
    }
}

class ZoneBomber extends Enemy {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#00e5ff';
        this.speed = 80;
        this.bombTimer = 3.0;
    }
    update(dt, player) {
        super.update(dt, player);
        this.bombTimer -= dt;
        if (this.bombTimer <= 0) {
            this.bombTimer = 3.0;
            if (window.game && window.game.projectiles) {
                window.game.projectiles.push(new Projectile(this.x + this.size/2, this.y + this.size/2, 1, 0));
                window.game.projectiles.push(new Projectile(this.x + this.size/2, this.y + this.size/2, -1, 0));
                window.game.projectiles.push(new Projectile(this.x + this.size/2, this.y + this.size/2, 0, 1));
                window.game.projectiles.push(new Projectile(this.x + this.size/2, this.y + this.size/2, 0, -1));
            }
        }
    }
}
