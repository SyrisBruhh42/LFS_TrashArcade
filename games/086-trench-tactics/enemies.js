class Enemy extends Entity {
    constructor(x, y, size, color = '#e74c3c') {
        super(x, y, size, color);
        this.speed = 100;
        this.baseSpeed = 100;
        this.type = 'Base';
    }
    update(dt, player, game) {
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
            this.x += (dx/dist) * this.speed * dt;
            this.y += (dy/dist) * this.speed * dt;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

class RookCharger extends Enemy {
    constructor(x, y, size) {
        super(x, y, size, '#ff4757');
        this.speed = 0;
        this.chargeTimer = 2.0;
        this.isCharging = false;
        this.chargeDir = {x:0, y:0};
        this.type = 'Rook';
    }
    update(dt, player, game) {
        if (!this.isCharging) {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                let dx = Math.abs(player.x - this.x);
                let dy = Math.abs(player.y - this.y);
                if (dx > dy) {
                    this.chargeDir = {x: Math.sign(player.x - this.x), y: 0};
                } else {
                    this.chargeDir = {x: 0, y: Math.sign(player.y - this.y)};
                }
                this.isCharging = true;
                this.speed = 500;
            }
        } else {
            this.x += this.chargeDir.x * this.speed * dt;
            this.y += this.chargeDir.y * this.speed * dt;
            if (this.x < 0 || this.x > 800 || this.y < 0 || this.y > 600) {
                this.isCharging = false;
                this.chargeTimer = 2.0;
                this.speed = 0;
            }
        }
    }
    draw(ctx) {
        super.draw(ctx);
        if (!this.isCharging && this.chargeTimer < 1.0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(this.x + this.size/4, this.y + this.size/4, this.size/2, this.size/2);
        }
    }
}

class BishopLaser extends Enemy {
    constructor(x, y, size) {
        super(x, y, size, '#9b59b6');
        this.speed = 50;
        this.shootTimer = 3.0;
        this.type = 'Bishop';
    }
    update(dt, player, game) {
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 200) {
            this.x += (dx/dist) * this.speed * dt;
            this.y += (dy/dist) * this.speed * dt;
        }

        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && game) {
            if (Math.abs(dx) > Math.abs(dy)) {
                game.spawnProjectile(this.x + this.size/2, this.y + this.size/2, Math.sign(dx), Math.sign(dy)*0.5);
                game.spawnProjectile(this.x + this.size/2, this.y + this.size/2, Math.sign(dx), -Math.sign(dy)*0.5);
            } else {
                game.spawnProjectile(this.x + this.size/2, this.y + this.size/2, Math.sign(dx)*0.5, Math.sign(dy));
                game.spawnProjectile(this.x + this.size/2, this.y + this.size/2, -Math.sign(dx)*0.5, Math.sign(dy));
            }
            this.shootTimer = 3.0;
        }
    }
}

class ShieldPhalanx extends Enemy {
    constructor(x, y, size) {
        super(x, y, size, '#34495e');
        this.speed = 30;
        this.hp = 300;
        this.type = 'Phalanx';
    }
    update(dt, player, game) {
        super.update(dt, player, game);
    }
    draw(ctx) {
        super.draw(ctx);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillRect(this.x - 2, this.y - 2, this.size + 4, 4);
    }
}

class ZoneBomber extends Enemy {
    constructor(x, y, size) {
        super(x, y, size, '#e67e22');
        this.speed = 80;
        this.bombTimer = 4.0;
        this.type = 'Bomber';
    }
    update(dt, player, game) {
        super.update(dt, player, game);
        this.bombTimer -= dt;
        if (this.bombTimer <= 0) {
            if (game) {
                const dirs = [
                    {x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1},
                    {x:1,y:1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:1}
                ];
                dirs.forEach(d => {
                    let dNorm = Math.sqrt(d.x*d.x + d.y*d.y);
                    game.spawnProjectile(this.x + this.size/2, this.y + this.size/2, d.x/dNorm, d.y/dNorm);
                });
            }
            this.bombTimer = 4.0;
        }
    }
}

class TileSpawner extends Enemy {
    constructor(x, y, size) {
        super(x, y, size, '#2ecc71');
        this.speed = 60;
        this.spawnTimer = 5.0;
        this.type = 'Spawner';
    }
    update(dt, player, game) {
        let dx = this.x - player.x;
        let dy = this.y - player.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0 && dist < 300) {
            this.x += (dx/dist) * this.speed * dt;
            this.y += (dy/dist) * this.speed * dt;
        } else {
            this.x += Math.sin(Date.now()/1000) * this.speed * 0.5 * dt;
            this.y += Math.cos(Date.now()/1000) * this.speed * 0.5 * dt;
        }

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && game) {
            game.enemies.push(new Enemy(game.grid.snap(this.x), game.grid.snap(this.y), game.grid.cellSize));
            this.spawnTimer = 5.0;
        }
    }
}
