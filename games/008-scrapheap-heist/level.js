class Scrap {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 15;
        this.collected = false;

        // Visuals
        this.rotation = Math.random() * Math.PI * 2;
        this.points = [];
        const numPoints = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const r = this.radius * (0.5 + Math.random() * 0.5);
            this.points.push({x: Math.cos(angle) * r, y: Math.sin(angle) * r});
        }
    }

    update(dt) {
        this.rotation += dt * 0.5;
    }

    draw(ctx) {
        if (this.collected) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = '#FFD700'; // Gold scrap
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        if (this.points.length > 0) {
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class LevelManager {
    constructor() {
        this.level = 1;
        this.score = 0;
        this.scraps = [];
        this.enemies = [];
    }

    generateLevel(levelNum) {
        this.level = levelNum;
        this.scraps = [];
        this.enemies = [];

        // Spawn scraps
        const numScraps = 3 + levelNum;
        for (let i = 0; i < numScraps; i++) {
            const x = 100 + Math.random() * (LOGICAL_WIDTH - 200);
            const y = 100 + Math.random() * (LOGICAL_HEIGHT - 200);
            this.scraps.push(new Scrap(x, y, 100 * levelNum));
        }

        // Spawn enemies
        const numEnemies = Math.min(1 + Math.floor(levelNum / 2), 10); // max 10
        for (let i = 0; i < numEnemies; i++) {
            const ex = 100 + Math.random() * (LOGICAL_WIDTH - 200);
            const ey = 100 + Math.random() * (LOGICAL_HEIGHT - 200);

            // Generate some patrol points
            const patrolPoints = [];
            for (let p = 0; p < 3; p++) {
                patrolPoints.push({
                    x: ex + (Math.random() - 0.5) * 600,
                    y: ey + (Math.random() - 0.5) * 600
                });
            }

            const sentry = new Sentry(ex, ey, patrolPoints);
            sentry.speed = 100 + (levelNum * 10);
            this.enemies.push(sentry);
        }

        // Initial safe spawn for player (center ish)
        return { px: LOGICAL_WIDTH / 2, py: LOGICAL_HEIGHT / 2 };
    }

    update(dt, player, audioEngine) {
        if (!player) return false;

        let allCollected = true;

        for (let scrap of this.scraps) {
            if (!scrap.collected) {
                scrap.update(dt);

                // Collision with player
                const dist = Math.hypot(player.x - scrap.x, player.y - scrap.y);
                if (dist < player.radius + scrap.radius) {
                    scrap.collected = true;
                    this.score += scrap.value;
                    audioEngine.playCollect();
                } else {
                    allCollected = false;
                }
            }
        }

        return allCollected;
    }

    drawScraps(ctx) {
        for (let scrap of this.scraps) {
            scrap.draw(ctx);
        }
    }
}
