
class BossWarden {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 60;
        this.maxHealth = 20;
        this.health = 20;
        this.phase = 1;
        this.polarity = polarity;
        this.active = true;
        this.isBoss = true;
        this.type = 'BOSS_WARDEN';

        this.timer = 0;
        this.invulnTimer = 0;
        this.attackTimer = 2.0;
        this.speed = 40;

        this.polarityTimer = 5.0;
        this.rotation = 0;
    }

    takeDamage(amount) {
        if (this.invulnTimer > 0) return;
        this.health -= amount;
        this.invulnTimer = 0.5;

        if (this.health <= this.maxHealth / 2 && this.phase === 1) {
            this.phase = 2;
            this.speed = 70;
            this.attackTimer = 1.0; // attack faster
            // spawn some swarmers
        }

        if (this.health <= 0) {
            this.active = false;
        }
    }

    update(dt, player, env, game) {
        if (!this.active) return;

        this.timer += dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.rotation += dt * (this.phase === 1 ? 1 : 2);

        // Move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.radius) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        // Polarity switch
        this.polarityTimer -= dt;
        if (this.polarityTimer <= 0) {
            this.polarity = this.polarity === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE';
            this.polarityTimer = this.phase === 1 ? 5.0 : 3.0;
        }

        // Attack
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack(env);
            this.attackTimer = this.phase === 1 ? 2.0 : 1.5;
        }
    }

    attack(env) {
        const numProj = this.phase === 1 ? 6 : 12;
        for (let i = 0; i < numProj; i++) {
            const angle = (Math.PI * 2 / numProj) * i + this.rotation;
            const px = this.x + Math.cos(angle) * this.radius;
            const py = this.y + Math.sin(angle) * this.radius;
            const vx = Math.cos(angle) * 150;
            const vy = Math.sin(angle) * 150;
            env.projectiles.push(new Projectile(px, py, vx, vy, this.polarity));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = POLARITY_COLORS[this.polarity];
        }

        // Draw gear shape
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            const r = (i % 2 === 0) ? this.radius : this.radius * 0.7;
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();

        if (this.phase === 2) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0';
            ctx.fill();
        }

        ctx.restore();
    }
}

class BossFluxCore {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 50;
        this.maxHealth = 25;
        this.health = 25;
        this.phase = 1;
        this.polarity = polarity;
        this.active = true;
        this.isBoss = true;
        this.type = 'BOSS_FLUX';

        this.timer = 0;
        this.invulnTimer = 0;
        this.state = 'IDLE'; // IDLE, DASH, BEAM, SPAWN
        this.stateTimer = 2.0;
        this.rotation = 0;

        this.targetX = x;
        this.targetY = y;
    }

    takeDamage(amount) {
        if (this.invulnTimer > 0) return;
        this.health -= amount;
        this.invulnTimer = 0.5;

        if (this.health <= this.maxHealth / 2 && this.phase === 1) {
            this.phase = 2;
            this.radius = 40; // Becomes smaller and faster
            this.state = 'IDLE';
            this.stateTimer = 0.5;
        }

        if (this.health <= 0) {
            this.active = false;
        }
    }

    update(dt, player, env, game) {
        if (!this.active) return;

        this.timer += dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.rotation -= dt * 2;

        this.stateTimer -= dt;

        if (this.state === 'IDLE') {
            // Float around
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.x += dx * dt * 2;
            this.y += dy * dt * 2;

            if (this.stateTimer <= 0) {
                this.pickNextState(player);
            }
        } else if (this.state === 'DASH') {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            this.x += dx * dt * 5; // Fast dash
            this.y += dy * dt * 5;

            if (this.stateTimer <= 0) {
                this.state = 'IDLE';
                this.stateTimer = 1.0;
                this.polarity = this.polarity === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE';
            }
        } else if (this.state === 'SPAWN') {
            if (this.stateTimer <= 0) {
                this.state = 'IDLE';
                this.stateTimer = 2.0;
                // Spawn hazards
                for (let i = 0; i < (this.phase === 1 ? 2 : 4); i++) {
                    const hx = this.x + (Math.random() - 0.5) * 200;
                    const hy = this.y + (Math.random() - 0.5) * 200;
                    game.enemies.push(new HazardZone(hx, hy, this.polarity));
                }
            }
        }
    }

    pickNextState(player) {
        const rand = Math.random();
        if (rand < 0.5) {
            this.state = 'DASH';
            this.stateTimer = 1.0;
            // Dash past player
            const angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.targetX = player.x + Math.cos(angle) * 300;
            this.targetY = player.y + Math.sin(angle) * 300;
        } else {
            this.state = 'SPAWN';
            this.stateTimer = 0.5;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) {
            ctx.fillStyle = '#fff';
        } else {
            ctx.fillStyle = POLARITY_COLORS[this.polarity];
        }

        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        // Inner square
        ctx.fillStyle = '#222';
        ctx.fillRect(-this.radius/2, -this.radius/2, this.radius, this.radius);

        if (this.phase === 2) {
            ctx.fillStyle = POLARITY_COLORS[this.polarity === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE'];
            ctx.beginPath();
            ctx.arc(0, 0, this.radius/3, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.restore();
    }
}
