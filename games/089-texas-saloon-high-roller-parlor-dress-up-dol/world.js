class StudioEnvironment {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.spotlightAngle = 0;
        this.initDecorations();
    }

    initDecorations() {
        for (let i = 0; i < 20; i++) {
            this.particles.push({
                x: Math.random() * this.game.width,
                y: Math.random() * this.game.height,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() * 20) + 10,
                size: Math.random() * 4 + 2,
                type: Math.floor(Math.random() * 3)
            });
        }
    }

    update(dt) {
        this.spotlightAngle += dt;
        for (let i = 0; i < this.particles.length; i++) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y > this.game.height) {
                p.y = -10;
                p.x = Math.random() * this.game.width;
            }
        }
    }

    drawBackdrop(ctx) {
        let briefName = this.game.briefs[this.game.currentBrief];
        ctx.save();
        if (briefName === "Saloon Gala") {
            // Felt background
            ctx.fillStyle = "#8b4513";
            ctx.fillRect(0, 0, this.game.width, this.game.height);
            ctx.fillStyle = "#144533"; // Green felt table feel
            ctx.fillRect(50, 50, this.game.width - 100, this.game.height - 100);
            ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
            for(let i=0; i<this.game.width; i+=40) {
                ctx.fillRect(i, 0, 2, this.game.height);
            }
        } else if (briefName === "Outlaw Chic") {
            // Parchment background
            ctx.fillStyle = "#f5deb3";
            ctx.fillRect(0, 0, this.game.width, this.game.height);
            ctx.strokeStyle = "#8b4513";
            ctx.lineWidth = 2;
            ctx.strokeRect(20, 20, this.game.width - 40, this.game.height - 40);
            ctx.fillStyle = "rgba(139, 69, 19, 0.1)";
            for(let i=0; i<10; i++) {
                 ctx.beginPath();
                 ctx.arc(Math.random() * this.game.width, Math.random() * this.game.height, Math.random() * 50 + 20, 0, Math.PI*2);
                 ctx.fill();
            }
        } else {
            // High Roller Elite - Casino felt / deep red
            ctx.fillStyle = "#4a0404";
            ctx.fillRect(0, 0, this.game.width, this.game.height);
            ctx.fillStyle = "#e53935";
            ctx.beginPath();
            ctx.moveTo(0, this.game.height);
            ctx.lineTo(this.game.width, 0);
            ctx.lineTo(this.game.width, this.game.height);
            ctx.fill();
        }

        // Interactive spotlight
        if (this.game.state === "RUNWAY") {
             ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
             ctx.beginPath();
             ctx.moveTo(this.game.width/2, 0);
             ctx.lineTo(this.game.doll.x - 100 + Math.sin(this.spotlightAngle)*50, this.game.height);
             ctx.lineTo(this.game.doll.x + 100 + Math.sin(this.spotlightAngle)*50, this.game.height);
             ctx.fill();
        }
        ctx.restore();
    }

    drawForeground(ctx) {
        ctx.save();
        let briefName = this.game.briefs[this.game.currentBrief];
        if (briefName === "High Roller Elite") {
            for (let p of this.particles) {
                ctx.fillStyle = p.type === 0 ? "#ffd700" : (p.type === 1 ? "#fff" : "#e53935");
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.fill();
            }
        } else if (briefName === "Outlaw Chic") {
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.fillRect(0, this.game.height - 30, this.game.width, 30);
        }
        ctx.restore();
    }
}
