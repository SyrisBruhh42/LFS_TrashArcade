class World {
    constructor() {
        this.time = 0;
        this.traps = [
            {x: 450, y: 150, w: 100, h: 100, active: false, timer: 0},
            {x: 250, y: 500, w: 100, h: 100, active: false, timer: 1.5}
        ];
        this.drafts = [
            {x: 100, y: 200, w: 100, h: 200, dx: 0, dy: -50},
            {x: 700, y: 200, w: 100, h: 200, dx: 0, dy: 50}
        ];
        this.movingWalls = [
            {x: 400, y: 350, w: 150, h: 20, startX: 400, endX: 600, speed: 100, dir: 1}
        ];
    }
    update(dt, player, guards, walls) {
        this.time += dt;

        // Update traps
        for (let t of this.traps) {
            t.timer += dt;
            if (t.timer > 3) { t.timer = 0; t.active = !t.active; }
            if (t.active) {
                const check = (e) => {
                    if (!e) return;
                    if (e.x > t.x && e.x < t.x+t.w && e.y > t.y && e.y < t.y+t.h) {
                        e.vx *= 0.5;
                        e.vy *= 0.5;
                        if (e.speed) e.speed = 40;
                    }
                };
                check(player);
                check(player.echo);
                guards.forEach(g => check(g));
            }
        }

        // Update drafts
        for (let d of this.drafts) {
            const check = (e) => {
                if (!e) return;
                if (e.x > d.x && e.x < d.x+d.w && e.y > d.y && e.y < d.y+d.h) {
                    if (e.vx !== undefined) { e.x += d.dx*dt; e.y += d.dy*dt; }
                    else { e.x += d.dx*dt; e.y += d.dy*dt; }
                }
            };
            check(player);
            check(player.echo);
            guards.forEach(g => check(g));
        }

        // Update moving walls
        for (let mw of this.movingWalls) {
            mw.x += mw.speed * mw.dir * dt;
            if (mw.x > mw.endX) { mw.x = mw.endX; mw.dir = -1; }
            if (mw.x < mw.startX) { mw.x = mw.startX; mw.dir = 1; }
        }
    }
    drawBackground(ctx, cx, cy) {
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
        ctx.save();
        ctx.translate(-cx * 0.1, -cy * 0.1);
        ctx.fillStyle = '#1a1a3a';
        for(let i=0; i<50; i++) {
            let rx = (Math.sin(i*123) * 2000) % 2000;
            let ry = (Math.cos(i*321) * 2000) % 2000;
            if(rx<0) rx+=2000; if(ry<0) ry+=2000;
            ctx.fillRect(rx, ry, 4, 4);
        }
        ctx.fillStyle = '#ddf';
        ctx.beginPath();
        ctx.arc(800, 200, 60, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(-cx * 0.3, -cy * 0.3);
        ctx.fillStyle = '#151525';
        for(let i=0; i<10; i++) {
            ctx.fillRect(i*300, 100, 80, 800);
            ctx.beginPath();
            ctx.moveTo(i*300 - 40, 100);
            ctx.lineTo(i*300 + 40, -50);
            ctx.lineTo(i*300 + 120, 100);
            ctx.fill();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(-cx, -cy);
        ctx.fillStyle = '#222';
        ctx.fillRect(-1000, -1000, 3000, 3000);
        ctx.strokeStyle = '#181818';
        ctx.lineWidth = 2;
        for(let i=-1000; i<2000; i+=40) {
            ctx.beginPath(); ctx.moveTo(-1000, i); ctx.lineTo(2000, i); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i, -1000); ctx.lineTo(i, 2000); ctx.stroke();
        }

        for (let d of this.drafts) {
            ctx.fillStyle = 'rgba(100, 200, 255, 0.1)';
            ctx.fillRect(d.x, d.y, d.w, d.h);
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(d.x + d.w/2, d.y + d.h/2);
            ctx.lineTo(d.x + d.w/2 + d.dx*0.5, d.y + d.h/2 + d.dy*0.5);
            ctx.stroke();
        }

        for (let t of this.traps) {
            ctx.fillStyle = t.active ? 'rgba(255, 0, 0, 0.3)' : 'rgba(50, 0, 0, 0.3)';
            ctx.fillRect(t.x, t.y, t.w, t.h);
            ctx.strokeStyle = t.active ? '#f00' : '#500';
            ctx.strokeRect(t.x, t.y, t.w, t.h);
            if (t.active) {
                ctx.fillStyle = '#f00';
                for(let i=0; i<5; i++) {
                    ctx.beginPath();
                    ctx.arc(t.x + Math.random()*t.w, t.y + Math.random()*t.h, 3, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
        ctx.restore();
    }
}

class AmbientDust {
    constructor() {
        this.particles = Array.from({length: 50}, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            s: Math.random() * 2 + 1,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10
        }));
    }
    update(dt) {
        for (let p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.x < 0) p.x += window.innerWidth;
            if (p.x > window.innerWidth) p.x -= window.innerWidth;
            if (p.y < 0) p.y += window.innerHeight;
            if (p.y > window.innerHeight) p.y -= window.innerHeight;
        }
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for (let p of this.particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.s, 0, Math.PI*2);
            ctx.fill();
        }
    }
}
