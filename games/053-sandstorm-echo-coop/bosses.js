class Boss extends Enemy {
    constructor(x, y, maxHp, player) {
        super(x, y, 100, player);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.phase = 1;
        this.radius = 40;
        this.spawnTimer = 3.0; // Warning banner duration
        this.active = false;
        this.hitTimer = 0;
    }

    update(dt) {
        if (this.spawnTimer > 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.active = true;
            }
            return;
        }

        if (!this.active) return;

        if (this.hitTimer > 0) this.hitTimer -= dt;

        // Phase transition at 50% HP
        if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
            this.phase = 2;
            this.onPhaseTransition();
        }

        this.bossUpdate(dt);

        // Keep in bounds
        if (this.x < this.radius) this.x = this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (game) {
            if (this.x > game.width - this.radius) this.x = game.width - this.radius;
            if (this.y > game.height - this.radius) this.y = game.height - this.radius;
        }
    }

    bossUpdate(dt) {}
    onPhaseTransition() {
        if(game && game.vfx) game.vfx.spawnExplosion(this.x, this.y, 40, '#ff0000');
        if(game && game.sound) game.sound.playEcho(); // reuse as transition sound
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.hitTimer > 0) {
            ctx.fillStyle = '#fff';
        } else {
            this.drawBossShape(ctx);
        }

        if (this.hitTimer > 0) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawBossShape(ctx) {}

    drawUI(ctx) {
        if (this.spawnTimer > 0) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, game.height / 2 - 40, game.width, 80);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            const blink = Math.floor(this.spawnTimer * 10) % 2 === 0;
            if (blink) ctx.fillText("WARNING: BOSS APPROACHING", game.width / 2, game.height / 2 + 10);
            return;
        }

        if (!this.active) return;

        // Health bar
        const barWidth = 400;
        const barHeight = 20;
        const x = (game.width - barWidth) / 2;
        const y = 20;

        ctx.fillStyle = '#111';
        ctx.fillRect(x, y, barWidth, barHeight);

        const hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.phase === 2 ? '#ff5555' : '#c6f8c8';
        ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.name + " - Phase " + this.phase, game.width / 2, y + 15);
    }
}

class SandstormDjinn extends Boss {
    constructor(x, y, player) {
        super(x, y, 50, player);
        this.name = "Sandstorm Djinn";
        this.color = '#eebb55';
        this.attackTimer = 2.0;
        this.moveAngle = Math.random() * Math.PI * 2;
    }

    bossUpdate(dt) {
        // Move around slowly
        this.x += Math.cos(this.moveAngle) * 50 * dt;
        this.y += Math.sin(this.moveAngle) * 50 * dt;

        if (Math.random() < 0.02) this.moveAngle = Math.random() * Math.PI * 2;

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack();
            this.attackTimer = this.phase === 1 ? 2.5 : 1.5;
        }
    }

    attack() {
        if (!game) return;
        if(game.sound) game.sound.playShoot();
        // Djinn shoots a massive spread of projectiles. The player has to use their ghost as a meat shield to survive,
        // because the gap is too small, or the projectiles are too dense.
        const numProj = this.phase === 1 ? 16 : 24;
        const angleStep = (Math.PI * 2) / numProj;
        const baseAngle = Math.atan2(this.player.y - this.y, this.player.x - this.x);

        for (let i = 0; i < numProj; i++) {
            const angle = baseAngle + (i * angleStep) + (Math.random() * 0.1 - 0.05);
            const vx = Math.cos(angle) * (this.phase === 1 ? 150 : 200);
            const vy = Math.sin(angle) * (this.phase === 1 ? 150 : 200);
            game.projectiles.push(new Projectile(this.x, this.y, vx, vy, '#ff5555'));
        }

        if (this.phase === 2) {
            // Also spawn a whirlwind hazard
            game.hazards.push(new WindZone(this.x, this.y, game.width, 100, Math.random() > 0.5 ? 1 : -1, 3.0));
        }
    }

    drawBossShape(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner eye
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI*2);
        ctx.fill();
    }
}

class MirageSerpent extends Boss {
    constructor(x, y, player) {
        super(x, y, 60, player);
        this.name = "Mirage Serpent";
        this.color = '#55ee88';
        this.attackTimer = 1.0;
        this.segments = [];
        for(let i=0; i<5; i++) {
            this.segments.push({x: this.x, y: this.y});
        }
        this.targetX = this.x;
        this.targetY = this.y;
    }

    bossUpdate(dt) {
        // Move towards a target location
        if (Math.random() < 0.05) {
            // Target player or ghost
            if (game.ghosts.length > 0 && Math.random() > 0.5) {
                const g = game.ghosts[Math.floor(Math.random() * game.ghosts.length)];
                this.targetX = g.x;
                this.targetY = g.y;
            } else {
                this.targetX = this.player.x;
                this.targetY = this.player.y;
            }
        }

        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 10) {
            const speed = this.phase === 1 ? 150 : 250;
            this.x += (dx/dist) * speed * dt;
            this.y += (dy/dist) * speed * dt;
        }

        // Update segments
        let prevX = this.x;
        let prevY = this.y;
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const sdx = prevX - seg.x;
            const sdy = prevY - seg.y;
            const sdist = Math.sqrt(sdx*sdx + sdy*sdy);
            if (sdist > 30) {
                seg.x += (sdx/sdist) * (sdist - 30);
                seg.y += (sdy/sdist) * (sdist - 30);
            }
            prevX = seg.x;
            prevY = seg.y;
        }

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack();
            this.attackTimer = this.phase === 1 ? 3.0 : 2.0;
        }
    }

    attack() {
        if (!game) return;
        if(game.sound) game.sound.playShoot();
        // Attack that targets BOTH player and all ghosts, forcing the player to manage positioning
        // so that ghosts can intercept or they can dodge.

        const targets = [this.player];
        if (game.ghosts) {
            targets.push(...game.ghosts);
        }

        for (const target of targets) {
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const vx = (dx/dist) * (this.phase === 1 ? 200 : 300);
            const vy = (dy/dist) * (this.phase === 1 ? 200 : 300);

            // Fire homing-ish spread
            game.projectiles.push(new Projectile(this.x, this.y, vx, vy, '#ff55aa'));
            if (this.phase === 2) {
                const angle = Math.atan2(vy, vx);
                const v1x = Math.cos(angle + 0.3) * 200;
                const v1y = Math.sin(angle + 0.3) * 200;
                const v2x = Math.cos(angle - 0.3) * 200;
                const v2y = Math.sin(angle - 0.3) * 200;
                game.projectiles.push(new Projectile(this.x, this.y, v1x, v1y, '#ff55aa'));
                game.projectiles.push(new Projectile(this.x, this.y, v2x, v2y, '#ff55aa'));
            }
        }
    }

    drawBossShape(ctx) {
        // Draw segments first (they are relative to world, so we need to inverse translate or draw them absolute)
        ctx.restore(); // Undo the translate in base Boss class to draw absolute segments

        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, this.radius - (i * 5), 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(this.x, this.y); // Re-apply translate for the head and hit flash

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-10, -10, 5, 0, Math.PI*2);
        ctx.arc(10, -10, 5, 0, Math.PI*2);
        ctx.fill();
    }
}
