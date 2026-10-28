class BaseEnemy {
    constructor(x, y, radius, hp, speed, color) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = radius;
        this.hp = hp;
        this.speed = speed;
        this.color = color;
        this.type = 'base';
    }

    applyGravity(game, dt) {
        const edx = game.gravityWell.x - this.x;
        const edy = game.gravityWell.y - this.y;
        const edist = Math.max(10, Math.hypot(edx, edy));
        const egForce = game.gravityWell.strength / edist;
        this.vx += (edx / edist) * egForce * dt;
        this.vy += (edy / edist) * egForce * dt;
    }

    update(dt, game) {
        this.applyGravity(game, dt);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx, game) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    onDeath(game) {
        // Base logic to spawn some particles
        for(let p = 0; p < 5; p++) {
            game.spawnParticle(this.x, this.y, this.color, 80);
        }
    }
}

class SwarmerEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 8, 1, 60, '#f0f');
        this.type = 'swarmer';
    }

    update(dt, game) {
        this.applyGravity(game, dt);
        const toPx = game.player.x - this.x;
        const toPy = game.player.y - this.y;
        const toPdist = Math.hypot(toPx, toPy);
        if(toPdist > 0) {
            this.vx += (toPx / toPdist) * this.speed * dt;
            this.vy += (toPy / toPdist) * this.speed * dt;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class SniperEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 12, 1, 30, '#0ff');
        this.type = 'sniper';
        this.telegraphTimer = 0;
        this.shootTimer = 2.0 + Math.random() * 2;
    }

    update(dt, game) {
        this.applyGravity(game, dt);
        const toPx = game.player.x - this.x;
        const toPy = game.player.y - this.y;
        const toPdist = Math.hypot(toPx, toPy);

        // Keep distance
        if(toPdist > 0) {
            if(toPdist < 150) {
                this.vx -= (toPx / toPdist) * this.speed * dt;
                this.vy -= (toPy / toPdist) * this.speed * dt;
            } else if (toPdist > 250) {
                this.vx += (toPx / toPdist) * this.speed * dt;
                this.vy += (toPy / toPdist) * this.speed * dt;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.shootTimer -= dt;
        if(this.shootTimer <= 1.0 && this.shootTimer > 0) {
            this.telegraphTimer = this.shootTimer; // 1s warning
        } else if (this.shootTimer <= 0) {
            this.telegraphTimer = 0;
            this.shootTimer = 2.0 + Math.random() * 2;
            const angle = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            game.enemyProjectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * 300,
                vy: Math.sin(angle) * 300,
                life: 3,
                radius: 4
            });
        }
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fill();

        if (this.telegraphTimer > 0) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${this.telegraphTimer})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -this.radius * 1.5);
            ctx.lineTo(this.radius * 1.5, 0);
            ctx.lineTo(0, this.radius * 1.5);
            ctx.lineTo(-this.radius * 1.5, 0);
            ctx.closePath();
            ctx.stroke();

            // Aim line
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const len = Math.hypot(dx, dy);
            ctx.lineTo((dx/len)*50, (dy/len)*50);
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }
}

class BruiserEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 20, 5, 20, '#ff0');
        this.type = 'bruiser';
        this.maxHp = 5;
    }

    update(dt, game) {
        this.applyGravity(game, dt);
        const toPx = game.player.x - this.x;
        const toPy = game.player.y - this.y;
        const toPdist = Math.hypot(toPx, toPy);
        if(toPdist > 0) {
            this.vx += (toPx / toPdist) * this.speed * dt;
            this.vy += (toPy / toPdist) * this.speed * dt;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Draw shield based on HP
        if (this.hp > 0) {
            ctx.strokeStyle = `rgba(255, 255, 0, ${this.hp / this.maxHp})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class SplitterEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 15, 1, 40, '#0f0');
        this.type = 'splitter';
    }

    update(dt, game) {
        this.applyGravity(game, dt);
        const toPx = game.player.x - this.x;
        const toPy = game.player.y - this.y;
        const toPdist = Math.hypot(toPx, toPy);
        if(toPdist > 0) {
            this.vx += (toPx / toPdist) * this.speed * dt;
            this.vy += (toPy / toPdist) * this.speed * dt;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(-this.radius/2, -this.radius/2, this.radius, this.radius);
        ctx.restore();
    }

    onDeath(game) {
        super.onDeath(game);
        for(let i = 0; i < 2; i++) {
            let s = new SwarmerEnemy(this.x, this.y);
            s.vx = this.vx + (Math.random() - 0.5) * 100;
            s.vy = this.vy + (Math.random() - 0.5) * 100;
            game.enemies.push(s);
        }
    }
}

class HazardEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 15, 3, 5, '#f50'); // slow moving
        this.type = 'hazard';
        this.dropTimer = 3.0;
    }

    update(dt, game) {
        this.applyGravity(game, dt);
        // Very slow movement
        const toPx = game.player.x - this.x;
        const toPy = game.player.y - this.y;
        const toPdist = Math.hypot(toPx, toPy);
        if(toPdist > 0) {
            this.vx += (toPx / toPdist) * this.speed * dt;
            this.vy += (toPy / toPdist) * this.speed * dt;
        }

        // Add strong drag to keep it mostly stationary
        this.vx *= 0.9;
        this.vy *= 0.9;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.dropTimer -= dt;
        if(this.dropTimer <= 0) {
            this.dropTimer = 4.0;
            game.enemyHazards.push({
                x: this.x,
                y: this.y,
                radius: 30,
                life: 5.0,
                maxLife: 5.0
            });
            for(let i=0; i<10; i++) {
                game.spawnParticle(this.x, this.y, this.color, 100);
            }
        }
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 1000);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);

            const angle2 = angle + (Math.PI * 2 / 10);
            const px2 = Math.cos(angle2) * this.radius * 0.4;
            const py2 = Math.sin(angle2) * this.radius * 0.4;
            ctx.lineTo(px2, py2);
        }
        ctx.closePath();
        ctx.fill();

        // Pulse core
        ctx.fillStyle = `rgba(255, 255, 0, ${0.5 + Math.sin(Date.now()/200)*0.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
