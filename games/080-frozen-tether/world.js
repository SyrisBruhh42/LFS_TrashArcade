class WorldEnvironment {
    constructor(logicalWidth, logicalHeight) {
        this.width = logicalWidth;
        this.height = logicalHeight;
        this.layers = [
            { speed: 0.1, elements: this.generateStars() },
            { speed: 0.3, elements: this.generateGlaciers() },
            { speed: 0.6, elements: this.generateStructures() }
        ];
        this.vents = [
            { x: 150, y: 560, w: 100, h: 20, force: -600, active: true, timer: 0 },
            { x: 550, y: 560, w: 100, h: 20, force: -600, active: false, timer: 2 }
        ];
        this.conveyors = [
            { x: 300, y: 250, w: 200, h: 20, speed: 100 },
            { x: 100, y: 450, w: 200, h: 20, speed: -100 }
        ];
    }
    generateStars() {
        let stars = [];
        for(let i=0; i<100; i++) stars.push({ x: Math.random() * 2000, y: Math.random() * 600, r: Math.random() * 2 });
        return stars;
    }
    generateGlaciers() {
        let gl = [];
        for(let i=0; i<10; i++) gl.push({ x: i * 300, w: 200 + Math.random()*200, h: 100 + Math.random()*200 });
        return gl;
    }
    generateStructures() {
        let st = [];
        for(let i=0; i<8; i++) st.push({ x: i * 400 + 100, w: 50 + Math.random()*100, h: 50 + Math.random()*150 });
        return st;
    }
    update(dt, entities) {
        for (let v of this.vents) {
            v.timer += dt;
            if (v.timer > 3) {
                v.active = !v.active;
                v.timer = 0;
            }
            if (v.active) {
                for (let e of entities) {
                    if (e && e.x > v.x && e.x < v.x + v.w && e.y < v.y && e.y > v.y - 400) {
                        e.vy += v.force * dt;
                    }
                }
            }
        }
        for (let c of this.conveyors) {
            for (let e of entities) {
                if (e && e.x > c.x && e.x < c.x + c.w && Math.abs((e.y + e.radius) - c.y) < 5) {
                    e.x += c.speed * dt;
                }
            }
        }
    }
    drawBackground(ctx, cameraX) {
        ctx.fillStyle = '#0a0e17';
        ctx.fillRect(0, 0, this.width, this.height);
        for (let l = 0; l < this.layers.length; l++) {
            let layer = this.layers[l];
            let offsetX = -(cameraX * layer.speed) % 2000;
            ctx.save();
            ctx.translate(offsetX, 0);

            if (l === 0) {
                ctx.fillStyle = '#fff';
                for(let s of layer.elements) {
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(s.x + 2000, s.y, s.r, 0, Math.PI*2); ctx.fill();
                }
            } else if (l === 1) {
                ctx.fillStyle = '#1c2838';
                for(let g of layer.elements) {
                    ctx.beginPath();
                    ctx.moveTo(g.x, this.height);
                    ctx.lineTo(g.x + g.w/2, this.height - g.h);
                    ctx.lineTo(g.x + g.w, this.height);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(g.x + 2000, this.height);
                    ctx.lineTo(g.x + g.w/2 + 2000, this.height - g.h);
                    ctx.lineTo(g.x + g.w + 2000, this.height);
                    ctx.fill();
                }
            } else if (l === 2) {
                ctx.fillStyle = '#2c3e50';
                for(let s of layer.elements) {
                    ctx.fillRect(s.x, this.height - s.h, s.w, s.h);
                    ctx.fillRect(s.x + 2000, this.height - s.h, s.w, s.h);
                }
            }
            ctx.restore();
        }
    }
    drawHazards(ctx) {
        // Draw vents
        for (let v of this.vents) {
            ctx.fillStyle = '#34495e';
            ctx.fillRect(v.x, v.y, v.w, v.h);
            if (v.active) {
                ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
                ctx.fillRect(v.x, v.y - 400, v.w, 400);
                // particles
                ctx.fillStyle = '#fff';
                for (let i=0; i<5; i++) {
                    ctx.fillRect(v.x + Math.random()*v.w, v.y - Math.random()*400, 2, 2);
                }
            }
        }
        // Draw conveyors
        for (let c of this.conveyors) {
            ctx.fillStyle = '#7f8c8d';
            ctx.fillRect(c.x, c.y, c.w, c.h);
            ctx.fillStyle = '#e74c3c';
            let offset = (performance.now() / 20) % 20;
            if (c.speed < 0) offset = 20 - offset;
            for (let i=0; i<c.w; i+=20) {
                let px = (i + offset) % c.w;
                ctx.fillRect(c.x + px, c.y, 5, c.h);
            }
        }
    }
}
window.WorldEnvironment = WorldEnvironment;