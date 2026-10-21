class ParallaxBackground {
    constructor() {
        this.layers = [
            { speed: 0.2, color: '#301010', offset: 0, draw: this.drawFar },
            { speed: 0.5, color: '#502015', offset: 0, draw: this.drawMid },
            { speed: 0.8, color: '#703020', offset: 0, draw: this.drawNear }
        ];
    }
    update(cameraY) {
        for (let l of this.layers) {
            l.offset = cameraY * l.speed;
        }
    }
    draw(ctx, width, height, cameraY) {
        ctx.fillStyle = '#200505'; // Base color instead of #201010
        ctx.fillRect(0, 0, width, height);

        for (let l of this.layers) {
            ctx.save();
            // We translate such that it loops relative to the camera
            let y = -l.offset % height;
            if (y > 0) y -= height;
            ctx.translate(0, y);
            l.draw(ctx, width, height, l.color);
            ctx.translate(0, height);
            l.draw(ctx, width, height, l.color);
            ctx.restore();
        }
    }
    drawFar(ctx, w, h, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for(let x=0; x<=w; x+=50) ctx.lineTo(x, h - 200 + Math.sin(x*0.02)*100);
        ctx.lineTo(w, h);
        ctx.fill();
    }
    drawMid(ctx, w, h, color) {
        ctx.fillStyle = color;
        for(let x=20; x<w; x+=150) {
            ctx.fillRect(x, 0, 40, h);
        }
    }
    drawNear(ctx, w, h, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for(let x=0; x<=w; x+=30) ctx.lineTo(x, h - 50 + Math.sin(x*0.05)*10 + Math.cos(x*0.03)*10);
        ctx.lineTo(w, h);
        ctx.fill();
    }
}

class HazardManager {
    constructor() {
        this.hazards = [];
    }
    addGeyser(x, y) {
        this.hazards.push(new Geyser(x, y));
    }
    update(dt, player, enemies, cameraY, height) {
        for (let h of this.hazards) h.update(dt, player, enemies);
        this.hazards = this.hazards.filter(h => h.active && h.y < cameraY + height + 200);
    }
    draw(ctx) {
        for (let h of this.hazards) h.draw(ctx);
    }
}

class Geyser {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 40;
        this.timer = Math.random() * 3;
        this.state = 'IDLE'; // IDLE, WARN, ERUPT
        this.active = true;
    }
    update(dt, player, enemies) {
        this.timer -= dt;
        if (this.state === 'IDLE' && this.timer <= 0) {
            this.state = 'WARN';
            this.timer = 1.0;
        } else if (this.state === 'WARN' && this.timer <= 0) {
            this.state = 'ERUPT';
            this.timer = 2.0;
        } else if (this.state === 'ERUPT' && this.timer <= 0) {
            this.state = 'IDLE';
            this.timer = 3.0;
        }

        if (this.state === 'ERUPT') {
            let rect = { x: this.x - this.w/2, y: this.y - 400, w: this.w, h: 400 };
            if (player.x > rect.x && player.x < rect.x + rect.w &&
                player.y > rect.y && player.y < rect.y + rect.h) {
                player.vy -= 2000 * dt;
            }
            for (let e of enemies) {
                if (e.x > rect.x && e.x < rect.x + rect.w &&
                    e.y > rect.y && e.y < rect.y + rect.h) {
                    e.alive = false; // Geyser kills enemies
                }
            }
        }
    }
    draw(ctx) {
        if (this.state === 'WARN') {
            ctx.fillStyle = 'rgba(255, 100, 0, 0.5)';
            ctx.fillRect(this.x - this.w/2, this.y - 400, this.w, 400);
        } else if (this.state === 'ERUPT') {
            ctx.fillStyle = 'rgba(255, 50, 0, 0.9)';
            ctx.fillRect(this.x - this.w/2, this.y - 400, this.w, 400);
            ctx.fillStyle = '#fff';
            for(let i=0; i<5; i++) {
                ctx.fillRect(this.x - this.w/2 + Math.random()*this.w, this.y - Math.random()*400, 4, Math.random()*20+10);
            }
        }
        ctx.fillStyle = '#422';
        ctx.fillRect(this.x - this.w/2 - 10, this.y, this.w + 20, 20);
    }
}

class FragilePlatform {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.timer = 0.5;
        this.touched = false;
        this.broken = false;
        this.respawnTimer = 0;
    }
    update(dt) {
        if (this.broken) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.broken = false;
                this.touched = false;
                this.timer = 0.5;
            }
        } else if (this.touched) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.broken = true;
                this.respawnTimer = 3.0; // Reappears after 3 seconds
            }
        }
    }
    draw(ctx) {
        if (this.broken) return;
        ctx.fillStyle = this.touched ? (Math.floor(Date.now()/50)%2===0 ? '#f00' : '#844') : '#844';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        // Draw cracks if touched
        if (this.touched) {
            ctx.strokeStyle = '#000';
            ctx.beginPath();
            ctx.moveTo(this.x + 10, this.y);
            ctx.lineTo(this.x + 20, this.y + 10);
            ctx.lineTo(this.x + 15, this.y + 20);
            ctx.stroke();
        }
    }
}

class ConveyorPlatform {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
        this.speed = Math.random() > 0.5 ? 200 : -200;
        this.beltOffset = 0;
    }
    update(dt) {
        this.beltOffset += this.speed * dt;
    }
    draw(ctx) {
        ctx.fillStyle = '#445';
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.fillStyle = '#889';
        for(let i=0; i<this.w; i+=20) {
            let bx = (i + this.beltOffset) % this.w;
            if (bx < 0) bx += this.w;
            ctx.fillRect(this.x + bx, this.y, 10, this.h);
        }
    }
}
