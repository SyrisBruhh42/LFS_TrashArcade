class ParallaxBackground {
    constructor(width, height) {
        this.layers = [
            { speed: 0.1, color: '#15221b', items: [] },
            { speed: 0.3, color: '#233a2d', items: [] },
            { speed: 0.6, color: '#314a3b', items: [] }
        ];

        for (let l of this.layers) {
            for (let i = 0; i < 20; i++) {
                l.items.push({
                    x: Math.random() * width * 2,
                    y: Math.random() * height * 2,
                    w: 50 + Math.random() * 150,
                    h: 50 + Math.random() * 150
                });
            }
        }
    }

    update(dt, player) {
        for (let l of this.layers) {
            for (let item of l.items) {
                item.x += player.vx * l.speed * dt * -0.5;
                item.y += player.vy * l.speed * dt * -0.5;

                // Wrap around
                if (item.x > 3000) item.x -= 3000;
                if (item.x < -1000) item.x += 3000;
                if (item.y > 3000) item.y -= 3000;
                if (item.y < -1000) item.y += 3000;
            }
        }
    }

    draw(ctx, width, height) {
        for (let l of this.layers) {
            ctx.fillStyle = l.color;
            for (let item of l.items) {
                // Only draw if somewhat visible (rough check)
                ctx.fillRect(item.x, item.y, item.w, item.h);
            }
        }
    }
}

class DestructibleCover {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 30;
        this.hp = 3;
        this.maxHp = 3;
    }

    draw(ctx) {
        ctx.beginPath();
        // Hexagon
        for (let i = 0; i < 6; i++) {
            let angle = (Math.PI / 3) * i;
            let px = this.x + Math.cos(angle) * this.radius;
            let py = this.y + Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();

        ctx.fillStyle = '#4a544c';
        ctx.fill();
        ctx.strokeStyle = '#8a9c8f';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.hp < this.maxHp) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + 15, this.y + 15);
            ctx.lineTo(this.x - 10, this.y + 20);
            ctx.strokeStyle = '#222';
            ctx.stroke();
        }
    }
}

class ConveyorZone {
    constructor(x, y, w, h, dx, dy) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.dx = dx;
        this.dy = dy;
    }

    applyForce(dt, entity) {
        if (entity.x > this.x && entity.x < this.x + this.w &&
            entity.y > this.y && entity.y < this.y + this.h) {
            entity.x += this.dx * dt * 200;
            entity.y += this.dy * dt * 200;
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(100, 150, 100, 0.2)';
        ctx.fillRect(this.x, this.y, this.w, this.h);

        ctx.strokeStyle = 'rgba(100, 150, 100, 0.5)';
        ctx.lineWidth = 2;

        let offset = (performance.now() / 10) % 20;
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.w, this.h);
        ctx.clip();

        for (let i = -this.h; i < this.w + this.h; i += 20) {
            ctx.moveTo(this.x + i + offset, this.y);
            ctx.lineTo(this.x + i - this.h + offset, this.y + this.h);
        }
        ctx.stroke();
        ctx.restore();
    }
}

class HazardManager {
    constructor(width, height) {
        this.covers = [];
        this.conveyors = [];

        for (let i = 0; i < 5; i++) {
            this.covers.push(new DestructibleCover(
                100 + Math.random() * (width - 200),
                100 + Math.random() * (height - 200)
            ));
        }

        for (let i = 0; i < 2; i++) {
            let isHoriz = Math.random() > 0.5;
            let dir = Math.random() > 0.5 ? 1 : -1;
            if (isHoriz) {
                this.conveyors.push(new ConveyorZone(
                    Math.random() * (width - 300),
                    Math.random() * (height - 100),
                    300, 100, dir, 0
                ));
            } else {
                this.conveyors.push(new ConveyorZone(
                    Math.random() * (width - 100),
                    Math.random() * (height - 300),
                    100, 300, 0, dir
                ));
            }
        }
    }

    update(dt, game) {
        for (let i = this.covers.length - 1; i >= 0; i--) {
            let cover = this.covers[i];
            if (cover.hp <= 0) {
                game.createExplosion(cover.x, cover.y, 30, '#555');
                this.covers.splice(i, 1);
                continue;
            }

            // Player collision
            let dx = game.player.x - cover.x;
            let dy = game.player.y - cover.y;
            let dist = Math.hypot(dx, dy);
            let minDist = game.player.radius + cover.radius;

            if (dist < minDist && dist > 0) {
                let overlap = minDist - dist;
                game.player.x += (dx / dist) * overlap;
                game.player.y += (dy / dist) * overlap;

                // Add some bounce if dashing
                if (game.player.isDashing) {
                    cover.hp -= 1;
                    game.player.vx *= -0.5;
                    game.player.vy *= -0.5;
                    game.soundEngine.playSynth(100, 'square', 0.2);
                    game.createExplosion(cover.x, cover.y, 20, '#555');
                }
            }

            // Enemy collision
            for (let enemy of game.enemies) {
                let edx = enemy.x - cover.x;
                let edy = enemy.y - cover.y;
                let edist = Math.hypot(edx, edy);
                let emindist = enemy.radius + cover.radius;
                if (edist < emindist && edist > 0) {
                    let eoverlap = emindist - edist;
                    enemy.x += (edx / edist) * eoverlap;
                    enemy.y += (edy / edist) * eoverlap;
                }
            }
        }

        for (let conv of this.conveyors) {
            conv.applyForce(dt, game.player);
            for (let enemy of game.enemies) {
                conv.applyForce(dt, enemy);
            }
        }
    }

    draw(ctx) {
        for (let conv of this.conveyors) conv.draw(ctx);
        for (let cover of this.covers) cover.draw(ctx);
    }
}
