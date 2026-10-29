class WorldRenderer {
    constructor(game) {
        this.game = game;
        this.petals = [];
        this.clouds = [];
        for(let i=0; i<30; i++) {
            this.petals.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                vx: Math.random() * 20 - 10,
                vy: Math.random() * 30 + 20,
                size: Math.random() * 4 + 2,
                angle: Math.random() * Math.PI * 2,
                spin: Math.random() * 2 - 1
            });
        }
        for(let i=0; i<5; i++) {
            this.clouds.push({
                x: Math.random() * 800,
                y: Math.random() * 150 + 20,
                vx: Math.random() * 10 + 5,
                scale: Math.random() * 0.5 + 0.5
            });
        }
        this.timeOfDay = 0; // 0=Morning, 1=Afternoon, 2=Evening
    }

    update(dt, input) {
        if (this.game.saveManager && this.game.saveManager.data) {
            this.timeOfDay = this.game.saveManager.data.timeSlot;
        }

        for (let p of this.petals) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.angle += p.spin * dt;
            if (p.y > 600) {
                p.y = -10;
                p.x = Math.random() * 800;
            }
            if (p.x > 800) p.x = 0;
            if (p.x < 0) p.x = 800;

            // Interactive: bounce on click
            if (input.mouse.justDown) {
                const dx = p.x - input.mouse.x;
                const dy = p.y - input.mouse.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 50) {
                    p.vx = (dx / dist) * 100;
                    p.vy = (dy / dist) * 100 - 50;
                }
            }
        }

        for (let c of this.clouds) {
            c.x += c.vx * dt;
            if (c.x > 850) {
                c.x = -150;
                c.y = Math.random() * 150 + 20;
            }
        }
    }

    draw(ctx) {
        // Layer 1: Sky background
        if (this.timeOfDay === 0) {
            ctx.fillStyle = '#fff8f6'; // Morning
        } else if (this.timeOfDay === 1) {
            ctx.fillStyle = '#ffe4ec'; // Afternoon
        } else {
            ctx.fillStyle = '#ff4081'; // Evening
        }
        ctx.fillRect(0, 0, 800, 600);

        // Layer 2: Parallax Clouds & Sun/Moon
        ctx.fillStyle = this.timeOfDay === 2 ? '#fff8f6' : '#ff4081';
        ctx.beginPath();
        ctx.arc(600, 100, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let c of this.clouds) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 30 * c.scale, 0, Math.PI*2);
            ctx.arc(c.x + 20 * c.scale, c.y - 10 * c.scale, 25 * c.scale, 0, Math.PI*2);
            ctx.arc(c.x + 40 * c.scale, c.y, 30 * c.scale, 0, Math.PI*2);
            ctx.fill();
        }

        // Layer 3: City Skyline / Courtyard Walls
        ctx.fillStyle = this.timeOfDay === 2 ? '#333' : '#ffb6c1';
        ctx.fillRect(0, 450, 800, 150);
        ctx.fillStyle = this.timeOfDay === 2 ? '#222' : '#ffc0cb';
        ctx.fillRect(100, 400, 150, 200);
        ctx.fillRect(300, 350, 200, 250);
        ctx.fillRect(600, 420, 120, 180);

        // Interactive stage elements: Rooftop lights in evening
        if (this.timeOfDay === 2) {
            ctx.fillStyle = '#ffe4ec';
            for(let i=0; i<5; i++) {
                ctx.beginPath();
                ctx.arc(150 + i*130, 470, 5 + Math.random()*2, 0, Math.PI*2);
                ctx.fill();
            }
        }

        // Layer 4: Falling Sakura Petals (Foreground)
        ctx.fillStyle = '#ff4081';
        for (let p of this.petals) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}
