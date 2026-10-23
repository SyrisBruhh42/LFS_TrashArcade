class CloudLayer {
    constructor(count, speedBase, sizeMin, sizeMax, color) {
        this.clouds = [];
        this.speedBase = speedBase;
        for(let i=0; i<count; i++) {
            this.clouds.push({
                x: Math.random() * 2000,
                y: Math.random() * 2000,
                size: Math.random() * (sizeMax - sizeMin) + sizeMin,
                vx: Math.random() * 20 - 10,
                vy: speedBase * (Math.random() * 0.4 + 0.8),
                color: color
            });
        }
    }
    update(dt, w, h) {
        this.clouds.forEach(c => {
            c.x += c.vx * dt;
            c.y += c.vy * dt;
            if (c.y > h + c.size) c.y = -c.size;
            if (c.x > w + c.size) c.x = -c.size;
            if (c.x < -c.size) c.x = w + c.size;
        });
    }
    draw(ctx) {
        ctx.save();
        this.clouds.forEach(c => {
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.arc(c.x, c.y, c.size, 0, Math.PI*2);
            ctx.arc(c.x + c.size*0.6, c.y - c.size*0.2, c.size*0.8, 0, Math.PI*2);
            ctx.arc(c.x - c.size*0.6, c.y - c.size*0.2, c.size*0.8, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.restore();
    }
}

class AsteroidCover extends Entity {
    constructor(x, y) {
        super(x, y, Math.random() * 20 + 20);
        this.hp = this.radius * 2;
        this.vel.set(0, Math.random() * 30 + 30);
        this.rotation = Math.random() * Math.PI;
        this.rotSpeed = Math.random() * 2 - 1;
        this.vertices = [];
        const numPts = 8;
        for (let i = 0; i < numPts; i++) {
            const angle = (i / numPts) * Math.PI * 2;
            const r = this.radius * (Math.random() * 0.4 + 0.8);
            this.vertices.push({ x: Math.cos(angle)*r, y: Math.sin(angle)*r });
        }
    }
    update(dt, game) {
        super.update(dt);
        this.rotation += this.rotSpeed * dt;
        if (this.pos.y > game.height + this.radius) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotation);
        ctx.beginPath();
        this.vertices.forEach((v, i) => {
            if (i===0) ctx.moveTo(v.x, v.y);
            else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.fillStyle = '#6b5e5e';
        ctx.fill();
        ctx.strokeStyle = '#4a3f3f';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-this.radius*0.5, -this.radius*0.2);
        ctx.lineTo(0, this.radius*0.1);
        ctx.lineTo(this.radius*0.4, -this.radius*0.3);
        ctx.strokeStyle = '#3a2f2f';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

class MagneticStorm {
    constructor(x, y, radius, polarity) {
        this.pos = new Vector2(x, y);
        this.radius = radius;
        this.polarity = polarity;
        this.active = true;
        this.life = 10;
        this.angle = 0;
    }
    update(dt, game) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            return;
        }
        this.angle += dt * 2;
        this.pos.y += 30 * dt;

        if (game.player && game.player.hp > 0) {
            const distSq = Math.pow(game.player.pos.x - this.pos.x, 2) + Math.pow(game.player.pos.y - this.pos.y, 2);
            if (distSq < this.radius * this.radius && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const force = (1 - dist / this.radius) * 600;
                const dirX = (game.player.pos.x - this.pos.x) / dist;
                const dirY = (game.player.pos.y - this.pos.y) / dist;

                const effect = (this.polarity === game.player.polarity) ? 1 : -1;
                game.player.vel.x += dirX * force * effect * dt;
                game.player.vel.y += dirY * force * effect * dt;
            }
        }

        if (game.bullets) {
            game.bullets.forEach(b => {
                if (!b.active) return;
                const bDistSq = Math.pow(b.pos.x - this.pos.x, 2) + Math.pow(b.pos.y - this.pos.y, 2);
                if (bDistSq < this.radius * this.radius && bDistSq > 0) {
                    const bDist = Math.sqrt(bDistSq);
                    const bForce = (1 - bDist / this.radius) * 800;
                    const bDirX = (b.pos.x - this.pos.x) / bDist;
                    const bDirY = (b.pos.y - this.pos.y) / bDist;
                    const bEffect = (this.polarity === b.polarity) ? 1 : -1;
                    b.vel.x += bDirX * bForce * bEffect * dt;
                    b.vel.y += bDirY * bForce * bEffect * dt;
                }
            });
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        const color = this.polarity === 1 ? 'rgba(255,51,102,0.15)' : 'rgba(51,204,255,0.15)';
        const edgeColor = this.polarity === 1 ? 'rgba(255,51,102,0.6)' : 'rgba(51,204,255,0.6)';

        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = edgeColor;
        ctx.setLineDash([15, 20]);
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.rotate(-this.angle * 2);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

class WorldManager {
    constructor(gameWidth, gameHeight) {
        this.layers = [
            new CloudLayer(20, 15, 40, 100, 'rgba(255, 255, 255, 0.05)'),
            new CloudLayer(12, 35, 60, 150, 'rgba(255, 255, 255, 0.08)'),
            new CloudLayer(6, 70, 80, 200, 'rgba(255, 255, 255, 0.12)')
        ];
        this.hazards = [];
        this.hazardTimer = 5;
    }

    update(dt, game) {
        this.layers.forEach(l => l.update(dt, game.width, game.height));

        if (game.state !== 'PLAYING') return;

        this.hazardTimer -= dt;
        if (this.hazardTimer <= 0) {
            this.hazardTimer = Math.random() * 5 + 4;
            if (Math.random() < 0.6) {
                const count = Math.floor(Math.random() * 3) + 1;
                for(let i=0; i<count; i++) {
                    this.hazards.push(new AsteroidCover(Math.random() * (game.width - 100) + 50, -50 - i*80));
                }
            } else {
                this.hazards.push(new MagneticStorm(Math.random() * (game.width - 200) + 100, -150, Math.random() * 100 + 120, Math.random() < 0.5 ? 1 : -1));
            }
        }

        this.hazards.forEach(h => h.update(dt, game));
        this.hazards = this.hazards.filter(h => h.active);

        game.bullets.forEach(b => {
            if (!b.active) return;
            this.hazards.forEach(h => {
                if (h instanceof AsteroidCover && h.active) {
                    const distSq = Math.pow(b.pos.x - h.pos.x, 2) + Math.pow(b.pos.y - h.pos.y, 2);
                    if (distSq < Math.pow(b.radius + h.radius, 2)) {
                        b.active = false;
                        h.hp -= 15;
                        game.spawnParticles(b.pos.x, b.pos.y, b.polarity, 5);
                        if (h.hp <= 0) {
                            h.active = false;
                            game.sound.playExplosion();
                            game.spawnParticles(h.pos.x, h.pos.y, 1, 15);
                            game.spawnParticles(h.pos.x, h.pos.y, -1, 15);
                            game.score += 20;
                        }
                    }
                }
            });
        });

        this.hazards.forEach(h => {
            if (h instanceof AsteroidCover && h.active) {
                const distSq = Math.pow(game.player.pos.x - h.pos.x, 2) + Math.pow(game.player.pos.y - h.pos.y, 2);
                if (distSq < Math.pow(game.player.radius + h.radius, 2)) {
                    if (game.player.invulnTimer <= 0) {
                        game.player.hp -= 15;
                        game.player.invulnTimer = 1.0;
                        game.sound.playHit();
                        game.spawnParticles(game.player.pos.x, game.player.pos.y, -game.player.polarity, 15);
                        if (game.player.hp <= 0) {
                            game.endGame();
                        }
                    }
                    const angle = Math.atan2(game.player.pos.y - h.pos.y, game.player.pos.x - h.pos.x);
                    game.player.vel.x += Math.cos(angle) * 600;
                    game.player.vel.y += Math.sin(angle) * 600;

                    h.hp -= 20;
                    if (h.hp <= 0) {
                        h.active = false;
                        game.sound.playExplosion();
                        game.spawnParticles(h.pos.x, h.pos.y, 1, 15);
                        game.spawnParticles(h.pos.x, h.pos.y, -1, 15);
                    }
                }
            }
        });
    }

    drawBackground(ctx) {
        this.layers.forEach(l => l.draw(ctx));
    }

    drawForeground(ctx) {
        this.hazards.forEach(h => h.draw(ctx));
    }
}
