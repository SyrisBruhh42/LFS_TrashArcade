class WorldManager {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.layers = [];
        this.hazards = [];
        this.initParallax();
    }

    initParallax() {
        this.layers.push(new GridLayer(0.1, this.width, this.height));
        this.layers.push(new ParallaxLayer(0.2, this.width, this.height, 'crane', 12, '#3a3a3a'));
        this.layers.push(new ParallaxLayer(0.5, this.width, this.height, 'cloud', 15, '#4a4a4a'));
        this.layers.push(new ParallaxLayer(1.0, this.width, this.height, 'shuriken', 8, '#5a5a5a'));
    }

    reset() {
        this.hazards = [];
        for (let i = 0; i < 3; i++) {
            this.hazards.push(new WindZone(this.width, this.height));
        }
        for (let i = 0; i < 4; i++) {
            this.hazards.push(new ShiftingTrap(this.width, this.height));
        }
    }

    update(dt, game) {
        this.layers.forEach(l => l.update(dt));
        this.hazards.forEach(h => h.update(dt, game));
    }

    drawBackground(ctx) {
        this.layers.forEach(l => l.draw(ctx));
    }

    drawHazards(ctx) {
        this.hazards.forEach(h => h.draw(ctx));
    }
}

class GridLayer {
    constructor(speed, w, h) {
        this.speed = speed;
        this.offset = 0;
        this.w = w;
        this.h = h;
    }
    update(dt) {
        this.offset += this.speed * 20 * dt;
        if (this.offset > 40) this.offset -= 40;
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = this.offset; x < this.w; x += 40) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.h);
        }
        for (let y = this.offset; y < this.h; y += 40) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.w, y);
        }
        ctx.stroke();
        ctx.restore();
    }
}

class ParallaxLayer {
    constructor(speed, w, h, type, count, color) {
        this.speed = speed;
        this.w = w;
        this.h = h;
        this.type = type;
        this.color = color;
        this.objects = [];
        for (let i = 0; i < count; i++) {
            this.objects.push({
                x: Math.random() * w,
                y: Math.random() * h,
                s: 0.5 + Math.random() * 1.5,
                r: Math.random() * Math.PI * 2,
                vx: (Math.random() - 0.5) * 20,
                vy: 20 + Math.random() * 30
            });
        }
    }
    update(dt) {
        this.objects.forEach(obj => {
            obj.x += obj.vx * this.speed * dt;
            obj.y += obj.vy * this.speed * dt;
            obj.r += 0.5 * this.speed * dt;
            if (obj.y > this.h + 50) {
                obj.y = -50;
                obj.x = Math.random() * this.w;
            }
            if (obj.x < -50) obj.x = this.w + 50;
            if (obj.x > this.w + 50) obj.x = -50;
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        this.objects.forEach(obj => {
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.scale(obj.s, obj.s);
            ctx.rotate(obj.r);
            ctx.beginPath();
            if (this.type === 'crane') {
                ctx.moveTo(0, -10); ctx.lineTo(10, 10); ctx.lineTo(-10, 10); ctx.closePath();
                ctx.moveTo(0, -10); ctx.lineTo(15, 0); ctx.lineTo(10, 10); ctx.closePath();
            } else if (this.type === 'cloud') {
                ctx.arc(0, 0, 15, 0, Math.PI * 2);
                ctx.arc(10, -5, 10, 0, Math.PI * 2);
                ctx.arc(-10, -5, 10, 0, Math.PI * 2);
            } else if (this.type === 'shuriken') {
                ctx.moveTo(0, -15); ctx.lineTo(4, -4); ctx.lineTo(15, 0);
                ctx.lineTo(4, 4); ctx.lineTo(0, 15); ctx.lineTo(-4, 4);
                ctx.lineTo(-15, 0); ctx.lineTo(-4, -4); ctx.closePath();
            }
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        });
        ctx.restore();
    }
}

class WindZone {
    constructor(w, h) {
        this.x = w/2 + (Math.random() - 0.5) * 500;
        this.y = h/2 + (Math.random() - 0.5) * 400;
        this.radius = 60 + Math.random() * 40;
        this.angle = Math.random() * Math.PI * 2;
        this.force = 200 + Math.random() * 150;
        this.particles = [];
        for(let i=0; i<15; i++) {
            this.particles.push({
                x: (Math.random()-0.5) * this.radius * 2,
                y: (Math.random()-0.5) * this.radius * 2,
                life: Math.random()
            });
        }
    }
    update(dt, game) {
        let dx = game.player.x - this.x;
        let dy = game.player.y - this.y;
        if (Math.hypot(dx, dy) < this.radius) {
            game.player.vx += Math.cos(this.angle) * this.force * dt;
            game.player.vy += Math.sin(this.angle) * this.force * dt;
        }
        game.guards.forEach(g => {
            let gx = g.x - this.x;
            let gy = g.y - this.y;
            if (Math.hypot(gx, gy) < this.radius) {
                g.x += Math.cos(this.angle) * this.force * 0.4 * dt;
                g.y += Math.sin(this.angle) * this.force * 0.4 * dt;
            }
        });

        this.particles.forEach(p => {
            p.x += Math.cos(this.angle) * this.force * 0.5 * dt;
            p.y += Math.sin(this.angle) * this.force * 0.5 * dt;
            p.life -= dt;
            if (p.life <= 0 || Math.hypot(p.x, p.y) > this.radius) {
                let spawnDist = Math.random() * this.radius;
                let spawnAng = Math.random() * Math.PI * 2;
                p.x = Math.cos(spawnAng) * spawnDist - Math.cos(this.angle)*this.radius*0.5;
                p.y = Math.sin(spawnAng) * spawnDist - Math.sin(this.angle)*this.radius*0.5;
                p.life = 0.5 + Math.random();
            }
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(200, 220, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 220, 255, 0.3)';
        ctx.setLineDash([5, 10]);
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.particles.forEach(p => {
            if (Math.hypot(p.x, p.y) <= this.radius) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
                ctx.fill();
            }
        });
        ctx.restore();
    }
}

class ShiftingTrap {
    constructor(w, h) {
        this.x = w/2 + (Math.random() - 0.5) * 600;
        this.y = h/2 + (Math.random() - 0.5) * 500;
        this.radius = 40;
        this.timer = Math.random() * 5;
        this.state = 0;
    }
    update(dt, game) {
        this.timer -= dt;
        if (this.state === 0 && this.timer <= 0) {
            this.state = 1;
            this.timer = 1.0;
        } else if (this.state === 1 && this.timer <= 0) {
            this.state = 2;
            this.timer = 2.0;
            if (game.sound) game.sound.playTone(150, 'sawtooth', 0.1, 0.2);
        } else if (this.state === 2 && this.timer <= 0) {
            this.state = 0;
            this.timer = 3 + Math.random() * 4;
        }

        if (this.state === 2) {
            let distP = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (distP < this.radius + game.player.radius) {
                let ang = Math.atan2(game.player.y - this.y, game.player.x - this.x);
                game.player.vx += Math.cos(ang) * 800 * dt;
                game.player.vy += Math.sin(ang) * 800 * dt;
            }
            game.guards.forEach(g => {
                let distG = Math.hypot(g.x - this.x, g.y - this.y);
                if (distG < this.radius + g.radius) {
                    let ang = Math.atan2(g.y - this.y, g.x - this.x);
                    g.x += Math.cos(ang) * 200 * dt;
                    g.y += Math.sin(ang) * 200 * dt;
                }
            });
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.state === 0) {
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.moveTo(-this.radius, -this.radius); ctx.lineTo(this.radius, this.radius);
            ctx.moveTo(this.radius, -this.radius); ctx.lineTo(-this.radius, this.radius);
            ctx.stroke();
        } else if (this.state === 1) {
            ctx.translate((Math.random()-0.5)*4, (Math.random()-0.5)*4);
            ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
            ctx.beginPath(); ctx.arc(0, 0, this.radius, 0, Math.PI*2); ctx.fill();
        } else if (this.state === 2) {
            ctx.fillStyle = '#ff6b6b'; ctx.strokeStyle = '#c92a2a'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-this.radius, -this.radius); ctx.lineTo(0, 0); ctx.lineTo(-this.radius, this.radius); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fa5252';
            ctx.beginPath(); ctx.moveTo(this.radius, -this.radius); ctx.lineTo(0, 0); ctx.lineTo(this.radius, this.radius); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#ff8787';
            ctx.beginPath(); ctx.moveTo(-this.radius, -this.radius); ctx.lineTo(0, 0); ctx.lineTo(this.radius, -this.radius); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e03131';
            ctx.beginPath(); ctx.moveTo(-this.radius, this.radius); ctx.lineTo(0, 0); ctx.lineTo(this.radius, this.radius); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }
}
