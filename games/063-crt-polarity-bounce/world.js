class StarfieldLayer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.stars = [];
        for (let i = 0; i < 50; i++) {
            this.stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 1,
                speed: Math.random() * 20 + 10
            });
        }
    }
    resize(w, h) {
        this.width = w;
        this.height = h;
    }
    draw(ctx, totalTime) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        for (let star of this.stars) {
            let x = (star.x - totalTime * star.speed) % this.width;
            if (x < 0) x += this.width;
            ctx.beginPath();
            ctx.arc(x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class GeometricLayer {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.shapes = [];
        for (let i = 0; i < 5; i++) {
            this.shapes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 100 + 50,
                speed: Math.random() * 30 + 15,
                angle: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.5,
                sides: Math.floor(Math.random() * 3) + 3
            });
        }
    }
    resize(w, h) {
        this.width = w;
        this.height = h;
    }
    draw(ctx, totalTime) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        for (let shape of this.shapes) {
            const wrapWidth = this.width + shape.size * 2;
            let x = ((shape.x - totalTime * shape.speed) % wrapWidth + wrapWidth) % wrapWidth - shape.size;

            ctx.save();
            ctx.translate(x, shape.y);
            ctx.rotate(shape.angle + totalTime * shape.rotSpeed);

            ctx.beginPath();
            for (let i = 0; i < shape.sides; i++) {
                const a = (i / shape.sides) * Math.PI * 2;
                if (i === 0) ctx.moveTo(Math.cos(a) * shape.size, Math.sin(a) * shape.size);
                else ctx.lineTo(Math.cos(a) * shape.size, Math.sin(a) * shape.size);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }
    }
}

class GravityZone {
    constructor(x, y, radius, force) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.force = force;
        this.time = 0;
    }
    update(dt, game) {
        this.time += dt;
        const applyForce = (entity) => {
            if (!entity) return;
            const dx = this.x - entity.x;
            const dy = this.y - entity.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < this.radius * this.radius && distSq > 100) {
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                // Pull entity towards center
                const pullStrength = (1 - dist / this.radius) * this.force * dt;
                entity.x += nx * pullStrength;
                entity.y += ny * pullStrength;

                // Add velocity if applicable
                if (entity.vx !== undefined) entity.vx += nx * pullStrength * 0.5;
                if (entity.vy !== undefined) entity.vy += ny * pullStrength * 0.5;
            }
        };

        if (game.player && game.health > 0) applyForce(game.player);
        for (let e of game.enemies) applyForce(e);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.time);

        ctx.strokeStyle = 'rgba(255, 0, 255, 0.4)';
        ctx.setLineDash([5, 10]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner swirl
        ctx.beginPath();
        for(let i=0; i<Math.PI*4; i+=0.1) {
            const r = (i / (Math.PI*4)) * this.radius;
            const x = Math.cos(i) * r;
            const y = Math.sin(i) * r;
            if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();

        ctx.restore();
    }
}

class VectorWall {
    constructor(x, y, w, h, dx, dy, speed) {
        this.startX = x;
        this.startY = y;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.dx = dx;
        this.dy = dy;
        this.speed = speed;
        this.time = 0;
        this.active = true;
    }
    update(dt, game) {
        this.time += dt;
        // Move wall back and forth
        this.x = this.startX + Math.sin(this.time * this.speed) * this.dx;
        this.y = this.startY + Math.cos(this.time * this.speed) * this.dy;

        const checkCollision = (entity) => {
            if (!entity) return;

            // Simple AABB vs Circle collision
            const testX = Math.max(this.x, Math.min(entity.x, this.x + this.w));
            const testY = Math.max(this.y, Math.min(entity.y, this.y + this.h));

            const distX = entity.x - testX;
            const distY = entity.y - testY;
            const distSq = distX * distX + distY * distY;

            if (distSq < entity.radius * entity.radius) {
                // Collided, resolve position
                const dist = Math.sqrt(distSq) || 1;
                const nx = distX / dist;
                const ny = distY / dist;

                const overlap = entity.radius - dist;
                entity.x += nx * overlap;
                entity.y += ny * overlap;

                // Bounce
                if (entity.vx !== undefined && entity.vy !== undefined) {
                    if (Math.abs(nx) > Math.abs(ny)) {
                        entity.vx *= -1;
                    } else {
                        entity.vy *= -1;
                    }

                    // Add wall velocity to entity
                    const wallVx = Math.cos(this.time * this.speed) * this.speed * this.dx * dt;
                    const wallVy = -Math.sin(this.time * this.speed) * this.speed * this.dy * dt;

                    entity.vx += wallVx * 50;
                    entity.vy += wallVy * 50;
                }
            }
        };

        if (game.player && game.health > 0) checkCollision(game.player);
        for (let e of game.enemies) checkCollision(e);
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.lineWidth = 3;

        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        // Internal scanlines
        ctx.beginPath();
        for (let i = 0; i < this.w; i += 10) {
            ctx.moveTo(this.x + i, this.y);
            ctx.lineTo(this.x + i, this.y + this.h);
        }
        ctx.stroke();
        ctx.restore();
    }
}

class WorldEnvironment {
    constructor(width, height) {
        this.width = width;
        this.height = height;

        this.stars = new StarfieldLayer(width, height);
        this.geometry = new GeometricLayer(width, height);

        this.hazards = [];
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
        this.stars.resize(w, h);
        this.geometry.resize(w, h);
    }

    reset() {
        this.hazards = [];

        // Spawn some hazards based on screen size
        this.hazards.push(new GravityZone(this.width / 2, this.height / 2, 150, 100));

        // Vertical moving wall
        this.hazards.push(new VectorWall(this.width * 0.2, this.height * 0.3, 20, 150, 0, 100, 1.5));
        // Horizontal moving wall
        this.hazards.push(new VectorWall(this.width * 0.6, this.height * 0.7, 150, 20, 100, 0, 2.0));
    }

    update(dt, game) {
        for (let h of this.hazards) {
            h.update(dt, game);
        }
    }

    drawBackground(ctx, totalTime, grid) {
        this.stars.draw(ctx, totalTime);
        this.geometry.draw(ctx, totalTime);

        if (grid) {
            grid.draw(ctx, totalTime);
        }
    }

    drawHazards(ctx) {
        for (let h of this.hazards) {
            h.draw(ctx);
        }
    }
}
