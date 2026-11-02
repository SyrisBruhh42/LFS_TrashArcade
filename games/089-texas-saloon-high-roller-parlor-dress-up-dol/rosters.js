class RunwayRoster {
    constructor(game) {
        this.game = game;
        this.time = 0;
        this.judges = [
            {
                name: "Madame Velvet",
                brief: "Gothic Saloon Elegance",
                color: "#800080",
                evaluate: (doll) => {
                    let score = 50;
                    let critique = "A bit plain, darling.";
                    if (doll.bottom === 0) { score += 30; critique = "Ah, the ruffled skirt is perfection."; }
                    if (doll.hair === 2) { score += 20; critique += " Red hair adds dramatic flair."; }
                    return { score, critique };
                }
            },
            {
                name: "Tex 'Grit' Cassidy",
                brief: "Dusty Outlaw Chic",
                color: "#8b4513",
                evaluate: (doll) => {
                    let score = 40;
                    let critique = "Where's the grit?";
                    if (doll.bottom === 2) { score += 40; critique = "Chaps! Now that's what I'm talking about."; }
                    if (doll.shoes === 0) { score += 20; critique += " Good boots."; }
                    return { score, critique };
                }
            },
            {
                name: "Duchess Gold",
                brief: "High Roller Opulence",
                color: "#ffd700",
                evaluate: (doll) => {
                    let score = 60;
                    let critique = "Needs more shine.";
                    if (doll.top === 1) { score += 30; critique = "Silk is always a winner."; }
                    if (doll.shoes === 1) { score += 10; critique += " Heels for the high roller."; }
                    return { score, critique };
                }
            },
            {
                name: "Ranger Steele",
                brief: "Frontier Patrol Practicality",
                color: "#4682b4",
                evaluate: (doll) => {
                    let score = 50;
                    let critique = "Too flashy for patrol.";
                    if (doll.top === 2) { score += 30; critique = "A sturdy vest. Good."; }
                    if (doll.shoes === 2) { score += 20; critique += " Spurs for the ride."; }
                    return { score, critique };
                }
            },
            {
                name: "Cyber-Idol Spark",
                brief: "Neon Nights Rodeo",
                color: "#00ffff",
                evaluate: (doll) => {
                    let score = 40;
                    let critique = "Needs more circuit flow.";
                    if (doll.hair === 0) { score += 25; critique = "Bright hair, I like it."; }
                    if (doll.bottom === 1) { score += 35; critique += " Leather pants are totally in."; }
                    return { score, critique };
                }
            }
        ];
        this.activeParticles = [];
    }

    getBriefs() {
        return this.judges.map(j => j.brief);
    }

    update(dt) {
        this.time += dt;
        if (Math.random() < 0.1 && this.game.state === "RUNWAY") {
            this.activeParticles.push({
                x: this.game.width * 0.8 + (Math.random() - 0.5) * 60,
                y: this.game.height / 2 + (Math.random() - 0.5) * 100,
                vy: -50 - Math.random() * 50,
                life: 1.0,
                maxLife: 1.0
            });
        }
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            let p = this.activeParticles[i];
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.activeParticles.splice(i, 1);
            }
        }
    }

    draw(ctx, judgeIndex, x, y) {
        if (this.game.state !== "RUNWAY") return;
        const judge = this.judges[judgeIndex];

        ctx.save();
        ctx.translate(x, y + Math.sin(this.time * 2) * 10);

        // Draw judge silhouette
        ctx.fillStyle = judge.color;
        ctx.fillRect(-30, -80, 60, 160);
        ctx.fillStyle = "#fff";
        ctx.font = "14px Courier New";
        ctx.textAlign = "center";
        ctx.fillText(judge.name, 0, -90);

        ctx.restore();

        // Draw particles
        ctx.fillStyle = "#ffd700";
        for (let p of this.activeParticles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    }
}
