class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [];
        this.initParallax();
        this.hazards = [];
        this.conveyors = [];
        this.initHazards();
    }

    initParallax() {
        // Layer 1: Distant cellular fluid (slow)
        let l1 = [];
        for(let i=0; i<30; i++) l1.push({ x: Math.random()*this.width, y: Math.random()*this.height, r: Math.random()*15 + 5, a: Math.random()*0.3 + 0.1 });
        this.layers.push({ speed: 0.1, elements: l1, color: '#2a0a25' });

        // Layer 2: Floating mitochondria (medium)
        let l2 = [];
        for(let i=0; i<20; i++) l2.push({ x: Math.random()*this.width, y: Math.random()*this.height, w: Math.random()*30+10, h: Math.random()*15+5, a: Math.random()*0.5 + 0.2 });
        this.layers.push({ speed: 0.3, elements: l2, color: '#54154c' });

        // Layer 3: Foreground protein structures (fast)
        let l3 = [];
        for(let i=0; i<15; i++) l3.push({ x: Math.random()*this.width, y: Math.random()*this.height, r: Math.random()*8 + 2, a: Math.random()*0.7 + 0.3 });
        this.layers.push({ speed: 0.6, elements: l3, color: '#e857ce' });
    }

    initHazards() {
        // Conveyor zones
        for(let i=0; i<2; i++) {
            this.conveyors.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                w: 150 + Math.random() * 100,
                h: 150 + Math.random() * 100,
                vx: (Math.random() - 0.5) * 100,
                vy: (Math.random() - 0.5) * 100
            });
        }

        // Acidic vacuoles
        for(let i=0; i<3; i++) {
            this.hazards.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                r: 40 + Math.random() * 30,
                damageTimer: 0
            });
        }
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
    }

    update(dt, player, enemies, echoes, projectiles) {
        // Parallax update (drifting left/down)
        for (let layer of this.layers) {
            for (let el of layer.elements) {
                el.x -= layer.speed * 50 * dt;
                el.y += layer.speed * 20 * dt;
                if (el.x < -50) el.x = this.width + 50;
                if (el.y > this.height + 50) el.y = -50;
            }
        }

        // Conveyors drift entities
        const applyConveyor = (entity) => {
            if (!entity) return;
            for (let c of this.conveyors) {
                if (entity.x > c.x && entity.x < c.x + c.w && entity.y > c.y && entity.y < c.y + c.h) {
                    entity.x += c.vx * dt;
                    entity.y += c.vy * dt;
                }
            }
        };

        if(player) applyConveyor(player);
        if(enemies) enemies.forEach(e => applyConveyor(e));
        if(echoes) echoes.forEach(e => applyConveyor(e));

        // Ensure properties exist on player for hazards
        if (player && typeof player.hp === 'undefined') {
            player.hp = 1;
        }
        if (player && typeof player.inHazard === 'undefined') {
            player.inHazard = false;
        }

        // Hazards damage
        for (let h of this.hazards) {
            h.damageTimer += dt;
            if (h.damageTimer >= 1.0) {
                // Check player
                if (player && !player.isDashing) {
                    let d = Math.hypot(player.x - h.x, player.y - h.y);
                    if (d < player.radius + h.r) {
                        player.inHazard = true;
                    }
                }
                // Check enemies
                if (enemies) {
                    for (let e of enemies) {
                        let d = Math.hypot(e.x - h.x, e.y - h.y);
                        if (d < e.radius + h.r) {
                            e.hp -= 1;
                            if(e.hp <= 0) e.active = false;
                        }
                    }
                }
                h.damageTimer = 0;
            }
        }
    }

    drawBackground(ctx) {
        // Draw Parallax Layers
        for (let i=0; i<2; i++) {
            let layer = this.layers[i];
            ctx.fillStyle = layer.color;
            for (let el of layer.elements) {
                ctx.globalAlpha = el.a;
                ctx.beginPath();
                if (el.r !== undefined) {
                    ctx.arc(el.x, el.y, el.r, 0, Math.PI*2);
                } else {
                    ctx.rect(el.x, el.y, el.w, el.h);
                }
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Draw Conveyors (Currents)
        ctx.fillStyle = 'rgba(0, 150, 255, 0.1)';
        ctx.strokeStyle = 'rgba(0, 150, 255, 0.3)';
        ctx.lineWidth = 2;
        for (let c of this.conveyors) {
            ctx.fillRect(c.x, c.y, c.w, c.h);
            ctx.strokeRect(c.x, c.y, c.w, c.h);
            ctx.beginPath();
            ctx.moveTo(c.x + c.w/2, c.y + c.h/2);
            ctx.lineTo(c.x + c.w/2 + c.vx * 0.5, c.y + c.h/2 + c.vy * 0.5);
            ctx.stroke();
        }

        // Draw Hazards (Vacuoles)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        for (let h of this.hazards) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.r, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(h.x, h.y, h.r * (0.8 + 0.2 * Math.sin(Date.now() / 200)), 0, Math.PI*2);
            ctx.stroke();
        }
    }

    drawForeground(ctx) {
        // Draw top parallax layer
        let layer = this.layers[2];
        ctx.fillStyle = layer.color;
        for (let el of layer.elements) {
            ctx.globalAlpha = el.a;
            ctx.beginPath();
            ctx.arc(el.x, el.y, el.r, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}
