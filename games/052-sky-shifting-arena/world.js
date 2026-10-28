class ParallaxBackground {
    constructor() {
        this.layers = [
            { speed: 5, elements: [], color: '#101020', sizeMin: 200, sizeMax: 500, count: 15, shape: 'cloud' },
            { speed: 15, elements: [], color: '#1a1a3a', sizeMin: 100, sizeMax: 300, count: 12, shape: 'island' },
            { speed: 30, elements: [], color: '#2a2a4a', sizeMin: 50, sizeMax: 150, count: 10, shape: 'island' }
        ];

        this.width = 4000;
        this.height = 4000;

        this.layers.forEach(layer => {
            for (let i = 0; i < layer.count; i++) {
                layer.elements.push({
                    x: (Math.random() - 0.5) * this.width,
                    y: (Math.random() - 0.5) * this.height,
                    size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
                    offsetY: Math.random() * Math.PI * 2
                });
            }
        });
    }

    update(dt) {
        this.layers.forEach(layer => {
            layer.elements.forEach(el => {
                el.y -= layer.speed * dt;
                if (el.y < -this.height / 2) {
                    el.y += this.height;
                    el.x = (Math.random() - 0.5) * this.width;
                }
            });
        });
    }

    draw(ctx) {
        // Base sky
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);

        const t = performance.now() / 1000;

        this.layers.forEach((layer, index) => {
            ctx.fillStyle = layer.color;
            layer.elements.forEach(el => {
                ctx.beginPath();
                const floatY = Math.sin(t * 2 + el.offsetY) * 10;

                if (layer.shape === 'cloud') {
                    ctx.arc(el.x, el.y + floatY, el.size, 0, Math.PI * 2);
                    ctx.arc(el.x + el.size*0.8, el.y + floatY + el.size*0.2, el.size*0.8, 0, Math.PI * 2);
                    ctx.arc(el.x - el.size*0.8, el.y + floatY + el.size*0.2, el.size*0.8, 0, Math.PI * 2);
                } else {
                    ctx.arc(el.x, el.y + floatY, el.size, 0, Math.PI * 2);
                    // Add some detail to islands
                    ctx.moveTo(el.x - el.size, el.y + floatY);
                    ctx.lineTo(el.x, el.y + floatY + el.size * 1.5);
                    ctx.lineTo(el.x + el.size, el.y + floatY);
                }
                ctx.fill();
            });
        });
    }
}

class DestructibleCover {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.health = 50;
        this.maxHealth = 50;
        this.active = true;
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(150, 150, 150, ${this.health / this.maxHealth})`;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.strokeRect(this.x, this.y, this.w, this.h);

        // draw cracks
        ctx.beginPath();
        if (this.health < this.maxHealth * 0.7) {
            ctx.moveTo(this.x + this.w*0.2, this.y);
            ctx.lineTo(this.x + this.w*0.5, this.y + this.h*0.5);
        }
        if (this.health < this.maxHealth * 0.3) {
            ctx.moveTo(this.x + this.w*0.5, this.y + this.h*0.5);
            ctx.lineTo(this.x + this.w*0.8, this.y + this.h);
        }
        ctx.stroke();
    }
}

class LightningTrap {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.timer = Math.random() * 5;
        this.interval = 5;
        this.duration = 1;
        this.state = 'idle'; // idle, warning, active
        this.active = true;
    }

    update(dt, player, enemies, audio) {
        this.timer += dt;

        if (this.state === 'idle' && this.timer >= this.interval - 1.5) {
            this.state = 'warning';
        } else if (this.state === 'warning' && this.timer >= this.interval) {
            this.state = 'active';
            // play sound if audio is available
            if(audio && audio.playExplosion) audio.playExplosion();
        } else if (this.state === 'active' && this.timer >= this.interval + this.duration) {
            this.state = 'idle';
            this.timer = 0;
        }

        if (this.state === 'active') {
            // Check player
            const pDist = Math.hypot(player.x - this.x, player.y - this.y);
            if (pDist < this.radius + player.radius) {
                player.health -= 20 * dt;
            }

            // Check enemies
            enemies.forEach(e => {
                const eDist = Math.hypot(e.x - this.x, e.y - this.y);
                if (eDist < this.radius + e.radius) {
                    e.health -= 50 * dt;
                }
            });
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'idle') {
            ctx.strokeStyle = 'rgba(0, 200, 255, 0.2)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else if (this.state === 'warning') {
            ctx.fillStyle = `rgba(255, 100, 0, ${0.2 + Math.sin(this.timer * 20) * 0.1})`;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.state === 'active') {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw lightning bolts
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            for(let i=0; i<5; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                let angle = Math.random() * Math.PI * 2;
                let r = Math.random() * this.radius;
                ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}

class HazardManager {
    constructor() {
        this.covers = [];
        this.traps = [];
        this.spawnTimer = 0;
    }

    update(dt, arena, player, enemies, projectiles, audio) {
        this.spawnTimer += dt;
        if (this.spawnTimer > 10) {
            this.spawnTimer = 0;
            this.spawnHazards(arena);
        }

        // Cleanup out-of-bounds or destroyed hazards
        for (let i = this.covers.length - 1; i >= 0; i--) {
            let c = this.covers[i];
            if (c.health <= 0 || !this.isInsideArena(c, arena)) {
                this.covers.splice(i, 1);
            }
        }

        for (let i = this.traps.length - 1; i >= 0; i--) {
            let t = this.traps[i];
            t.update(dt, player, enemies, audio);
            if (!this.isInsideArena(t, arena)) {
                this.traps.splice(i, 1);
            }
        }

        // Handle cover collisions
        this.handleCoverCollisions(player, enemies, projectiles);
    }

    isInsideArena(obj, arena) {
        // simple point check for center
        let cx = obj.x + (obj.w ? obj.w/2 : 0);
        let cy = obj.y + (obj.h ? obj.h/2 : 0);
        return cx > arena.x && cx < arena.x + arena.w && cy > arena.y && cy < arena.y + arena.h;
    }

    spawnHazards(arena) {
        // ensure we don't overcrowd
        if (this.covers.length < 5) {
            let w = 40 + Math.random() * 60;
            let h = 40 + Math.random() * 60;
            let x = arena.x + 50 + Math.random() * (arena.w - 100 - w);
            let y = arena.y + 50 + Math.random() * (arena.h - 100 - h);
            this.covers.push(new DestructibleCover(x, y, w, h));
        }

        if (this.traps.length < 3) {
            let r = 50 + Math.random() * 50;
            let x = arena.x + r + Math.random() * (arena.w - r*2);
            let y = arena.y + r + Math.random() * (arena.h - r*2);
            this.traps.push(new LightningTrap(x, y, r));
        }
    }

    handleCoverCollisions(player, enemies, projectiles) {
        // Player vs Cover
        this.covers.forEach(c => {
            this.resolveCircleRectCollision(player, c);

            enemies.forEach(e => {
                this.resolveCircleRectCollision(e, c);
            });

            // Projectiles vs Cover
            for (let i = projectiles.length - 1; i >= 0; i--) {
                let p = projectiles[i];
                if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) {
                    c.health -= 10;
                    p.active = false;
                }
            }
        });
    }

    resolveCircleRectCollision(circle, rect) {
        let testX = circle.x;
        let testY = circle.y;

        if (circle.x < rect.x) testX = rect.x;
        else if (circle.x > rect.x + rect.w) testX = rect.x + rect.w;

        if (circle.y < rect.y) testY = rect.y;
        else if (circle.y > rect.y + rect.h) testY = rect.y + rect.h;

        let distX = circle.x - testX;
        let distY = circle.y - testY;
        let distance = Math.hypot(distX, distY);

        if (distance < circle.radius) {
            let pushDist = circle.radius - distance;
            if (distance === 0) { // circle center exactly on rect edge/corner
               circle.x -= pushDist;
            } else {
               circle.x += (distX / distance) * pushDist;
               circle.y += (distY / distance) * pushDist;
            }
        }
    }

    draw(ctx) {
        this.traps.forEach(t => t.draw(ctx));
        this.covers.forEach(c => c.draw(ctx));
    }
}
