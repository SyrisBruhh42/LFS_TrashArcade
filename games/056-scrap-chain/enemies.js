
class Projectile {
    constructor(x, y, vx, vy, radius = 4, life = 3, color = (window.game && window.game.colors ? window.game.colors.proj : '#ff0000'), isHazard = false) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = radius;
        this.life = life;
        this.color = color;
        this.isHazard = isHazard;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        ctx.beginPath();
        if (this.isHazard) {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(128, 0, 128, ${Math.max(0, this.life)})`;
            ctx.fill();
        } else {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

class BaseEnemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.speed = 100;
        this.isTethered = false;
        this.tetherIndex = -1;
        this.markedForDeath = false;
        this.hp = 1;
        this.color = window.game && window.game.colors ? window.game.colors.enemy : '#a34a4a';
    }

    update(dt, playerX, playerY, tetherManager, game) {
        if (this.isTethered) {
            // position is updated by tether manager
        } else {
            let dx = playerX - this.x;
            let dy = playerY - this.y;
            let dist = Math.hypot(dx, dy);
            if (dist > 0) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isTethered ? '#f5ca53' : this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class SwarmerEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 120;
        this.color = '#33cc33';
        this.radius = 10;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            let angle = i * Math.PI * 2 / 5;
            let px = Math.cos(angle) * this.radius;
            let py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = this.isTethered ? '#f5ca53' : this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class BruiserEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 40;
        this.color = '#3366cc';
        this.radius = 16;
        this.hp = 3;
        this.shield = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.isTethered ? '#f5ca53' : this.color;
        ctx.fill();
        ctx.strokeStyle = this.shield ? '#00ffff' : '#fff';
        ctx.lineWidth = this.shield ? 4 : 2;
        ctx.stroke();
        ctx.restore();
    }
}

class SniperEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 90;
        this.color = '#cc3333';
        this.radius = 14;
        this.state = 'chase';
        this.timer = 0;
    }

    update(dt, playerX, playerY, tetherManager, game) {
        if (this.isTethered) return;

        let dx = playerX - this.x;
        let dy = playerY - this.y;
        let dist = Math.hypot(dx, dy);

        if (this.state === 'chase') {
            if (dist > 250) {
                if (dist > 0) {
                    this.x += (dx / dist) * this.speed * dt;
                    this.y += (dy / dist) * this.speed * dt;
                }
            } else {
                this.state = 'telegraph';
                this.timer = 1.5;
            }
        } else if (this.state === 'telegraph') {
            this.timer -= dt;
            if (this.timer <= 0) {
                if (dist > 0) {
                    game.projectiles.push(new Projectile(this.x, this.y, (dx/dist)*300, (dy/dist)*300, 4, 3, '#ff0000'));
                    game.soundEngine.playShootSFX();
                }
                this.state = 'cooldown';
                this.timer = 2.0;
            }
        } else if (this.state === 'cooldown') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'chase';
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();

        let fillCol = this.color;
        if (this.state === 'telegraph') {
            fillCol = (Math.floor(Date.now() / 100) % 2 === 0) ? '#ffffff' : this.color;
        }

        ctx.fillStyle = this.isTethered ? '#f5ca53' : fillCol;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class SplitterEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 80;
        this.color = '#cccc33';
        this.radius = 14;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fillStyle = this.isTethered ? '#f5ca53' : this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class HazardEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 60;
        this.color = '#9933cc';
        this.radius = 16;
        this.timer = 3.0;
    }

    update(dt, playerX, playerY, tetherManager, game) {
        super.update(dt, playerX, playerY, tetherManager, game);
        if (this.isTethered) return;

        this.timer -= dt;
        if (this.timer <= 0) {
            game.projectiles.push(new Projectile(this.x, this.y, 0, 0, 80, 1.0, '#000000', true));
            game.soundEngine.playHitSFX();
            this.timer = 3.0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let angle = i * Math.PI * 2 / 6;
            let px = Math.cos(angle) * this.radius;
            let py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = this.isTethered ? '#f5ca53' : this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // draw pulse telegraph
        if (!this.isTethered && this.timer < 1.0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + (1.0 - this.timer) * 60, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(153, 51, 204, ${this.timer})`;
            ctx.stroke();
        }
        ctx.restore();
    }
}
