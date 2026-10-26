class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.bubbles = [];
        this.scanlineY = 0;
        this.vents = [{x: 100, y: height - 20, active: 0}, {x: width - 100, y: height - 20, active: 0}];
        for(let i=0; i<30; i++) {
            this.bubbles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                speed: 10 + Math.random() * 20,
                size: 2 + Math.random() * 4,
                phase: Math.random() * Math.PI * 2
            });
        }
    }
    update(dt) {
        this.scanlineY += 50 * dt;
        if (this.scanlineY > this.height) this.scanlineY = 0;

        for (let b of this.bubbles) {
            b.y -= b.speed * dt;
            b.x += Math.sin(b.phase) * 10 * dt;
            b.phase += dt;
            if (b.y + b.size < 0) {
                b.y = this.height + b.size;
                b.x = Math.random() * this.width;
            }
        }

        for (let v of this.vents) {
            if (Math.random() < 0.01) v.active = 1.0;
            if (v.active > 0) v.active -= dt;
        }
    }
    draw(ctx) {
        let grad = ctx.createLinearGradient(0, 0, 0, this.height);
        grad.addColorStop(0, '#061a2b');
        grad.addColorStop(1, '#0d3554');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
        ctx.fillRect(0, this.scanlineY, this.width, 4);

        for (let v of this.vents) {
            if (v.active > 0) {
                ctx.fillStyle = `rgba(0, 230, 118, ${v.active * 0.5})`;
                ctx.beginPath();
                ctx.arc(v.x, v.y, 40 * v.active, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        for (let b of this.bubbles) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
