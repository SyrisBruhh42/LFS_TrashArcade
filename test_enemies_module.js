class Enemy extends Entity {
    constructor(x, y, r, hp) {
        super(x, y, r);
        this.hp = hp;
        this.maxHp = hp;
        this.timer = 0;
        this.active = true;
    }
    update(dt, game) {
        super.update(dt);
        this.timer += dt;

        // Boundaries
        if (this.pos.y > game.height + 100) {
            this.active = false;
        }
    }
    draw(ctx) {
        super.draw(ctx);
        // Health bar
        if (this.hp < this.maxHp) {
            ctx.fillStyle = '#f00';
            ctx.fillRect(this.pos.x - this.radius, this.pos.y - this.radius - 10, this.radius * 2, 4);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(this.pos.x - this.radius, this.pos.y - this.radius - 10, (this.radius * 2) * (this.hp / this.maxHp), 4);
        }
    }
}

class SwarmerEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 15, 20);
        this.polarity = Math.random() > 0.5 ? 1 : -1;
    }
    update(dt, game) {
        super.update(dt, game);
        if (!game.player) return;
        const dx = game.player.pos.x - this.pos.x;
        const dy = game.player.pos.y - this.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
            this.vel.x = (dx / dist) * 120;
            this.vel.y = (dy / dist) * 120;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(Math.atan2(this.vel.y, this.vel.x) + Math.PI/2);
        VectorRenderer.drawPolygon(ctx, 0, 0, [
            {x: 0, y: -15},
            {x: 10, y: 10},
            {x: 0, y: 5},
            {x: -10, y: 10}
        ], this.polarity === 1 ? '#ff3366' : '#33ccff', true);
        ctx.restore();
        super.draw(ctx);
    }
}

class SniperEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 30);
        this.polarity = Math.random() > 0.5 ? 1 : -1;
        this.shootTimer = 0;
        this.targetPos = new Vector2(MathUtils.rand(50, window.innerWidth - 50), MathUtils.rand(50, window.innerHeight / 2));
    }
    update(dt, game) {
        super.update(dt, game);
        this.shootTimer += dt;

        const dx = this.targetPos.x - this.pos.x;
        const dy = this.targetPos.y - this.pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 5) {
            this.vel.x = (dx / dist) * 80;
            this.vel.y = (dy / dist) * 80;
        } else {
            this.vel.set(0, 0);
        }

        if (this.shootTimer > 2) {
            if (this.shootTimer > 3) {
                if (game.player) {
                    const pdx = game.player.pos.x - this.pos.x;
                    const pdy = game.player.pos.y - this.pos.y;
                    const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                    if (pdist > 0) {
                        game.spawnBullet(this.pos.x, this.pos.y, (pdx/pdist)*300, (pdy/pdist)*300, this.polarity, true);
                        game.sound.playShoot(this.polarity === 1);
                    }
                }
                this.shootTimer = 0;
                this.targetPos.set(MathUtils.rand(50, game.width - 50), MathUtils.rand(50, game.height / 2));
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        if (this.shootTimer > 2 && this.shootTimer <= 3) {
            const ratio = (this.shootTimer - 2);
            ctx.beginPath();
            ctx.arc(0, 0, 30 * ratio, 0, Math.PI * 2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (window.game && window.game.player) {
                const pdx = window.game.player.pos.x - this.pos.x;
                const pdy = window.game.player.pos.y - this.pos.y;
                const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                if (pdist > 0) {
                     VectorRenderer.drawAimTelegraph(ctx, 0, 0, Math.atan2(pdy, pdx), pdist, this.polarity === 1 ? '#ff3366' : '#33ccff');
                }
            }
        }

        VectorRenderer.drawPolygon(ctx, 0, 0, [
            {x: 0, y: -20},
            {x: 15, y: 15},
            {x: -15, y: 15}
        ], this.polarity === 1 ? '#ff3366' : '#33ccff', true);
        ctx.restore();
        super.draw(ctx);
    }
}

class ShieldedEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 25, 80);
        this.polarity = Math.random() > 0.5 ? 1 : -1;
        this.shieldActive = true;
        this.shieldHp = 50;
    }
    update(dt, game) {
        super.update(dt, game);
        this.pos.y += 30 * dt;

        if (this.pos.x < 50 || this.pos.x > game.width - 50) {
            this.vel.x *= -1;
        }
        this.pos.x += Math.sin(this.timer * 2) * 50 * dt;

        if (this.shieldHp <= 0) {
            this.shieldActive = false;
        }

        if (this.timer > 4) {
            this.timer = 0;
            for(let i=0; i<6; i++) {
                const angle = (i/6) * Math.PI * 2;
                game.spawnBullet(this.pos.x, this.pos.y, Math.cos(angle)*100, Math.sin(angle)*100, this.polarity, true);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        VectorRenderer.drawPolygon(ctx, 0, 0, [
            {x: -20, y: -20},
            {x: 20, y: -20},
            {x: 20, y: 20},
            {x: -20, y: 20}
        ], '#888', true);

        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();

        if (this.shieldActive) {
            VectorRenderer.drawPolygon(ctx, 0, 0, [
                {x: 0, y: -35},
                {x: 30, y: 0},
                {x: 0, y: 35},
                {x: -30, y: 0}
            ], this.polarity === 1 ? 'rgba(255, 51, 102, 0.5)' : 'rgba(51, 204, 255, 0.5)', false);
            ctx.lineWidth = 3;
            ctx.strokeStyle = this.polarity === 1 ? '#ff3366' : '#33ccff';
            ctx.stroke();
        }

        ctx.restore();
        super.draw(ctx);
    }
}

class SpawnerEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 30, 60);
        this.polarity = Math.random() > 0.5 ? 1 : -1;
        this.targetX = MathUtils.rand(100, window.innerWidth - 100);
    }
    update(dt, game) {
        super.update(dt, game);
        const dx = this.targetX - this.pos.x;
        this.vel.x = dx * 1.5;

        if (Math.abs(dx) < 10) {
            this.targetX = MathUtils.rand(100, game.width - 100);
        }

        if (this.timer > 3) {
            this.timer = 0;
            if (game.enemies) {
                game.enemies.push(new SwarmerEnemy(this.pos.x, this.pos.y + 20));
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.timer);
        VectorRenderer.drawStar(ctx, 0, 0, 6, 30, 15, this.polarity === 1 ? '#ff3366' : '#33ccff');
        ctx.restore();

        if (this.timer > 2.5) {
             ctx.save();
             ctx.translate(this.pos.x, this.pos.y + 20);
             ctx.beginPath();
             ctx.arc(0, 0, (3 - this.timer) * 40, 0, Math.PI * 2);
             ctx.strokeStyle = '#fff';
             ctx.lineWidth = 2;
             ctx.stroke();
             ctx.restore();
        }
        super.draw(ctx);
    }
}

class HazardEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 20, 40);
        this.polarity = 0;
    }
    update(dt, game) {
        super.update(dt, game);
        this.pos.y += 40 * dt;

        if (this.timer > 5) {
            this.timer = 0;
            for(let i=0; i<8; i++) {
                const angle = (i/8) * Math.PI * 2;
                game.spawnBullet(this.pos.x, this.pos.y, Math.cos(angle)*80, Math.sin(angle)*80, Math.random() > 0.5 ? 1 : -1, true);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(-this.timer * 2);

        VectorRenderer.drawCross(ctx, 0, 0, 40, '#ffa500', 4);

        if (this.timer > 4) {
            ctx.beginPath();
            ctx.arc(0, 0, (this.timer - 4) * 50, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
            ctx.fill();
        }

        ctx.restore();
        super.draw(ctx);
    }
}
