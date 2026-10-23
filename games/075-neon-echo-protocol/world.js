class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.time = 0;

        // 3 Parallax Layers
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 10 + 5,
                alpha: Math.random()
            });
        }

        this.citylineOffset = 0;
        this.gridOffset = 0;

        this.hazards = [];
        this.reset();
    }

    reset() {
        this.hazards = [];
        this.hazards.push(new DestructibleCover(200, 200));
        this.hazards.push(new DestructibleCover(600, 200));
        this.hazards.push(new DestructibleCover(200, 400));
        this.hazards.push(new DestructibleCover(600, 400));

        this.hazards.push(new ConveyorZone(300, 100, 200, 100, 50, 0));
        this.hazards.push(new GravityZone(300, 400, 200, 100, 0, 50));
    }

    update(dt, game) {
        this.time += dt;

        this.stars.forEach(s => {
            s.y += s.speed * dt;
            if (s.y > this.height) {
                s.y = 0;
                s.x = Math.random() * this.width;
            }
        });

        this.citylineOffset += 20 * dt;
        if (this.citylineOffset > 200) this.citylineOffset -= 200;

        this.gridOffset += 40 * dt;
        if (this.gridOffset > 50) this.gridOffset -= 50;

        if (game.state !== 'PLAYING') return;

        this.hazards.forEach(h => h.update(dt, game));
        this.hazards = this.hazards.filter(h => h.active);
    }

    drawBackground(ctx) {
        ctx.fillStyle = '#ffffff';
        this.stars.forEach(s => {
            ctx.globalAlpha = s.alpha * (0.5 + 0.5 * Math.sin(this.time * 2 + s.x));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.arc(this.width / 2, this.height / 2 + 100, 100, 0, Math.PI, true);
        ctx.fill();

        ctx.fillStyle = '#0b0b1a';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(this.width / 2 - 100, this.height / 2 + 10 - i * 15, 200, 5);
        }

        ctx.fillStyle = '#221133';
        for (let i = -1; i < this.width / 200 + 1; i++) {
            let x = i * 200 - this.citylineOffset;
            ctx.fillRect(x + 20, this.height / 2 - 50, 40, 150);
            ctx.fillRect(x + 70, this.height / 2 - 100, 60, 200);
            ctx.fillRect(x + 140, this.height / 2 - 30, 50, 130);
        }

        ctx.strokeStyle = 'rgba(255, 98, 172, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x < this.width; x += 50) {
            ctx.moveTo(x, this.height / 2);
            ctx.lineTo(x, this.height);
        }
        for (let y = 0; y < this.height / 2; y += 50) {
            let py = this.height / 2 + y + this.gridOffset;
            if (py < this.height) {
                ctx.moveTo(0, py);
                ctx.lineTo(this.width, py);
            }
        }
        ctx.stroke();
    }

    drawHazards(ctx) {
        this.hazards.forEach(h => h.draw(ctx));
    }
}

class DestructibleCover {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.width = 60;
        this.height = 20;
        this.hp = 100;
        this.maxHp = 100;
        this.active = true;
    }
    update(dt, game) {
        game.bullets.forEach(b => {
            if (b.active && b.pos.x > this.pos.x && b.pos.x < this.pos.x + this.width &&
                b.pos.y > this.pos.y && b.pos.y < this.pos.y + this.height) {
                b.active = false;
                this.hp -= 10;
                if(game.sound) game.sound.hit();
            }
        });

        if (game.player && this.collides(game.player)) {
            let overlapX = (game.player.pos.x) - (this.pos.x + this.width/2);
            let overlapY = (game.player.pos.y) - (this.pos.y + this.height/2);
            if (Math.abs(overlapX) > Math.abs(overlapY)) {
                game.player.pos.x += Math.sign(overlapX) * 2;
            } else {
                game.player.pos.y += Math.sign(overlapY) * 2;
            }
        }

        game.enemies.forEach(e => {
            if (this.collides(e)) {
                let overlapX = (e.pos.x) - (this.pos.x + this.width/2);
                let overlapY = (e.pos.y) - (this.pos.y + this.height/2);
                if (Math.abs(overlapX) > Math.abs(overlapY)) {
                    e.pos.x += Math.sign(overlapX) * 2;
                } else {
                    e.pos.y += Math.sign(overlapY) * 2;
                }
            }
        });

        if (this.hp <= 0) {
            this.active = false;
            game.spawnParticles(this.pos.x + this.width/2, this.pos.y + this.height/2, '#ffffff', 20);
        }
    }
    collides(entity) {
        let r = entity.radius || 10;
        return entity.pos.x + r > this.pos.x && entity.pos.x - r < this.pos.x + this.width &&
               entity.pos.y + r > this.pos.y && entity.pos.y - r < this.pos.y + this.height;
    }
    draw(ctx) {
        ctx.fillStyle = '#555555';
        ctx.fillRect(this.pos.x, this.pos.y, this.width, this.height);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.pos.x, this.pos.y, this.width, this.height);

        ctx.fillStyle = 'red';
        ctx.fillRect(this.pos.x, this.pos.y - 10, this.width, 4);
        ctx.fillStyle = 'lime';
        ctx.fillRect(this.pos.x, this.pos.y - 10, this.width * (this.hp / this.maxHp), 4);
    }
}

class ConveyorZone {
    constructor(x, y, w, h, vx, vy) {
        this.rect = new Rect(x, y, w, h);
        this.vel = new Vector2(vx, vy);
        this.active = true;
        this.time = 0;
    }
    update(dt, game) {
        this.time += dt;
        let applyForce = (entity) => {
            if (this.rect.contains(entity.pos)) {
                entity.pos.x += this.vel.x * dt;
                entity.pos.y += this.vel.y * dt;
            }
        };
        if (game.player) applyForce(game.player);
        game.enemies.forEach(e => applyForce(e));
        game.echoes.forEach(e => applyForce(e));
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);

        ctx.save();
        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.clip();

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 2;

        let offset = (this.time * this.vel.mag()) % 20;
        let dir = this.vel.norm();

        for(let i = -this.rect.w; i < this.rect.w * 2; i+= 20) {
            ctx.beginPath();
            if (dir.x > 0) {
                ctx.moveTo(this.rect.x + i + offset, this.rect.y);
                ctx.lineTo(this.rect.x + i + offset, this.rect.y + this.rect.h);
            } else if (dir.x < 0) {
                ctx.moveTo(this.rect.x + this.rect.w - (i + offset), this.rect.y);
                ctx.lineTo(this.rect.x + this.rect.w - (i + offset), this.rect.y + this.rect.h);
            } else if (dir.y > 0) {
                ctx.moveTo(this.rect.x, this.rect.y + i + offset);
                ctx.lineTo(this.rect.x + this.rect.w, this.rect.y + i + offset);
            }
            ctx.stroke();
        }

        ctx.restore();
    }
}

class GravityZone {
    constructor(x, y, w, h, vx, vy) {
        this.rect = new Rect(x, y, w, h);
        this.vel = new Vector2(vx, vy);
        this.active = true;
        this.time = 0;
    }
    update(dt, game) {
        this.time += dt;
        let applyForce = (entity) => {
            if (this.rect.contains(entity.pos)) {
                entity.pos.x += this.vel.x * dt;
                entity.pos.y += this.vel.y * dt;
            }
        };
        if (game.player) applyForce(game.player);
        game.enemies.forEach(e => applyForce(e));
        game.echoes.forEach(e => applyForce(e));
        game.bullets.forEach(b => applyForce(b));
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 0, 255, 0.1)';
        ctx.fillRect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);

        ctx.save();
        ctx.beginPath();
        ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
        ctx.clip();

        ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.lineWidth = 1;

        let offset = (this.time * 50) % 20;

        for(let i = -this.rect.h; i < this.rect.h * 2; i+= 20) {
            ctx.beginPath();
            ctx.moveTo(this.rect.x, this.rect.y + i + offset);
            ctx.lineTo(this.rect.x + this.rect.w, this.rect.y + i + offset);
            ctx.stroke();
        }

        ctx.restore();
    }
}