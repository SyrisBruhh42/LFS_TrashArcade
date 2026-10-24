class World {
    constructor(canvas) {
        this.layers = [
            { speed: 10, offset: 0, color: '#3a2515', type: 'dunes' },
            { speed: 30, offset: 0, color: '#4a3525', type: 'tents' },
            { speed: 80, offset: 0, color: 'rgba(200, 180, 100, 0.2)', type: 'sandstorm' }
        ];
        this.hazards = [];
        this.width = canvas ? canvas.width : window.innerWidth;
        this.height = canvas ? canvas.height : window.innerHeight;
    }
    reset(width, height) {
        this.width = width;
        this.height = height;
        this.hazards = [];
        for (let i = 0; i < 5; i++) {
            this.hazards.push({
                x: Math.random() * width,
                y: Math.random() * height,
                radius: 50 + Math.random() * 50
            });
        }

        this.dustDevils = [];
        for (let i = 0; i < 2; i++) {
            this.dustDevils.push(new DustDevil(Math.random() * width, Math.random() * height));
        }
        this.dustDevilSpawnTimer = 5;
    }
    update(dt, player, enemies) {
        this.layers.forEach(layer => {
            layer.offset = (layer.offset + layer.speed * dt) % 100;
        });

        const applySlow = (entity) => {
            let inHazard = false;
            for (const h of this.hazards) {
                const dx = entity.x - h.x;
                const dy = entity.y - h.y;
                if (dx * dx + dy * dy < (h.radius + entity.radius) ** 2) {
                    inHazard = true;
                    break;
                }
            }
            if (inHazard) {
                entity.x -= entity.vx * 0.5 * dt || 0;
                entity.y -= entity.vy * 0.5 * dt || 0;
            }
        };

        if (player) applySlow(player);
        if (enemies) enemies.forEach(applySlow);

        this.dustDevils = this.dustDevils.filter(dd => dd.active);
        this.dustDevils.forEach(dd => {
            dd.update(dt, this.width, this.height);
            if (player) dd.applyForce(player, dt);
            if (enemies) enemies.forEach(e => dd.applyForce(e, dt));
        });

        this.dustDevilSpawnTimer -= dt;
        if (this.dustDevilSpawnTimer <= 0 && this.dustDevils.length < 4) {
            this.dustDevils.push(new DustDevil(Math.random() * this.width, Math.random() * this.height));
            this.dustDevilSpawnTimer = 5 + Math.random() * 5;
        }
    }
    drawBackground(ctx, canvas) {
        // Dunes
        ctx.fillStyle = this.layers[0].color;
        for (let i = -100; i < canvas.width + 100; i += 200) {
            ctx.beginPath();
            ctx.arc(i - this.layers[0].offset * 2, canvas.height - 100, 150, Math.PI, 0);
            ctx.fill();
        }

        // Tents
        ctx.fillStyle = this.layers[1].color;
        for (let i = -50; i < canvas.width + 100; i += 150) {
            ctx.fillRect(i - this.layers[1].offset, canvas.height - 50, 100, 50);
            ctx.beginPath();
            ctx.moveTo(i - this.layers[1].offset, canvas.height - 50);
            ctx.lineTo(i - this.layers[1].offset + 50, canvas.height - 100);
            ctx.lineTo(i - this.layers[1].offset + 100, canvas.height - 50);
            ctx.fill();
        }

        // Sand traps (hazards)
        ctx.fillStyle = '#2a1a10';
        this.hazards.forEach(h => {
            ctx.beginPath();
            ctx.ellipse(h.x, h.y, h.radius, h.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        });

        this.dustDevils.forEach(dd => dd.draw(ctx));
    }
    drawForeground(ctx, canvas) {
        // Sandstorm
        ctx.fillStyle = this.layers[2].color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 37 + this.layers[2].offset * 10) % canvas.width;
            const y = (i * 91 + this.layers[2].offset * 5) % canvas.height;
            ctx.fillRect(x, y, 2, 2);
        }
    }
}

class DustDevil {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.vx = (Math.random() - 0.5) * 100;
        this.vy = (Math.random() - 0.5) * 100;
        this.angle = 0;
        this.particles = [];
        this.active = true;
        this.lifetime = 10 + Math.random() * 10;

        for (let i = 0; i < 20; i++) {
            this.particles.push({
                distance: Math.random() * this.radius,
                angle: Math.random() * Math.PI * 2,
                speed: 2 + Math.random() * 3,
                size: 1 + Math.random() * 3
            });
        }
    }

    update(dt, canvasWidth, canvasHeight) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.angle += dt * 5;
        this.lifetime -= dt;

        if (this.lifetime <= 0) {
            this.active = false;
        }

        if (this.x < 0 || this.x > canvasWidth) this.vx *= -1;
        if (this.y < 0 || this.y > canvasHeight) this.vy *= -1;

        this.particles.forEach(p => {
            p.angle += p.speed * dt;
            p.distance += Math.sin(this.angle) * 10 * dt;
            if (p.distance > this.radius) p.distance = 0;
        });
    }

    applyForce(entity, dt) {
        const dx = this.x - entity.x;
        const dy = this.y - entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.radius + entity.radius + 50) {
            // Sucked in
            const force = 100 / (dist || 1);
            if (entity.vx !== undefined && entity.vy !== undefined) {
                entity.vx += (dx / dist) * force * dt * 50;
                entity.vy += (dy / dist) * force * dt * 50;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = 'rgba(210, 180, 140, 0.4)';
        this.particles.forEach(p => {
            const px = Math.cos(p.angle) * p.distance;
            const py = Math.sin(p.angle) * p.distance;
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200, 170, 130, 0.2)';
        ctx.fill();

        ctx.restore();
    }
}
