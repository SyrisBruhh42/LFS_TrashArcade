class BossEntity {
    constructor(x, y, r, hp, color) {
        this.x = x;
        this.y = y;
        this.r = r;
        this.maxHp = hp;
        this.hp = hp;
        this.color = color;
        this.active = true;
        this.phase = 1;
        this.state = 'SPAWNING';
        this.stateTimer = 3.0; // 3 seconds warning
    }

    update(dt, playerX, playerY, engine) {
        if (this.state === 'SPAWNING') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'PHASE1';
                this.stateTimer = 0;
            }
            return;
        }

        if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
            this.phase = 2;
            this.state = 'TRANSITION';
            this.stateTimer = 2.0; // 2 seconds invulnerable transition
        }

        if (this.state === 'TRANSITION') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'PHASE2';
            }
            return;
        }
    }

    draw(ctx, cameraY) {
        if (!this.active) return;

        if (this.state === 'SPAWNING') {
            // Draw warning
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y - cameraY, this.r * (2 + Math.sin(this.stateTimer * 10)), 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.font = '24px Courier New';
            ctx.fillText("WARNING", this.x, this.y - cameraY - this.r - 20);
            return;
        }

        this.drawBody(ctx, cameraY);
        this.drawHealthBar(ctx);
    }

    drawBody(ctx, cameraY) {
        // override in subclass
    }

    drawHealthBar(ctx) {
        const barWidth = 400;
        const barHeight = 20;
        const x = window.innerWidth / 2 - barWidth / 2; // Assuming game engine handles canvas sizing
        // Wait, best to use engine dimensions, we will pass it later, or draw based on canvas width
        // Will draw based on ctx.canvas.width
        const cw = ctx.canvas.width;
        const bx = cw / 2 - barWidth / 2;
        const by = 20;

        ctx.fillStyle = '#222';
        ctx.fillRect(bx, by, barWidth, barHeight);

        const hpPercent = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.phase === 1 ? '#e74c3c' : '#c0392b';
        ctx.fillRect(bx, by, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, barWidth, barHeight);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '16px Courier New';
        ctx.fillText(`BOSS - Phase ${this.phase}`, cw/2, by + 15);
    }

    takeDamage(amount, engine) {
        if (this.state === 'SPAWNING' || this.state === 'TRANSITION') return;

        this.hp -= amount;
        engine.spawnParticles(this.x, this.y, this.color, 5);

        if (this.hp <= 0) {
            this.active = false;
            engine.spawnParticles(this.x, this.y, this.color, 50);
            engine.score += 1000 * engine.multiplier;
        }
    }
}

class TetherSeverBoss extends BossEntity {
    constructor(x, y) {
        super(x, y, 40, 500, '#e74c3c');
        this.speed = 100;
        this.vx = 0;
        this.vy = 0;
        this.attackTimer = 2.0;
    }

    update(dt, playerX, playerY, engine) {
        super.update(dt, playerX, playerY, engine);
        if (this.state === 'SPAWNING' || this.state === 'TRANSITION') return;

        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);

        // Move towards player slowly
        if (dist > 150) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        } else {
            this.vx *= 0.9;
            this.vy *= 0.9;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            // Attack logic: shoots projectiles that sever tether
            if (this.phase === 1) {
                this.attackTimer = 2.0;
                this.shoot(playerX, playerY, engine, 3);
            } else {
                this.attackTimer = 1.5;
                this.shoot(playerX, playerY, engine, 5);
                this.dash(playerX, playerY);
            }
        }
    }

    shoot(px, py, engine, count) {
        if (!engine.enemyProjectiles) return;
        const angleToPlayer = Math.atan2(py - this.y, px - this.x);
        for(let i=0; i<count; i++) {
            const angle = angleToPlayer + (i - Math.floor(count/2)) * 0.2;
            engine.enemyProjectiles.push({
               x: this.x, y: this.y,
               vx: Math.cos(angle) * 150,
               vy: Math.sin(angle) * 150,
               r: 8,
               active: true,
               isSevering: true // custom property to sever tether
           });
        }
    }

    dash(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
            this.vx = (dx / dist) * this.speed * 3;
            this.vy = (dy / dist) * this.speed * 3;
        }
    }

    drawBody(ctx, cameraY) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Spiky shape
        for (let i = 0; i < 10; i++) {
            const angle = (i * Math.PI * 2) / 10;
            const r = (i % 2 === 0) ? this.r : this.r / 2;
            const px = this.x + Math.cos(angle) * r;
            const py = this.y - cameraY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.state === 'TRANSITION') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y - cameraY, this.r + 10, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class GroundPoundBoss extends BossEntity {
    constructor(x, y) {
        super(x, y, 50, 800, '#8e44ad');
        this.speed = 80;
        this.attackTimer = 3.0;
        this.targetX = x;
        this.targetY = y;
        this.slamming = false;
    }

    update(dt, playerX, playerY, engine) {
        super.update(dt, playerX, playerY, engine);
        if (this.state === 'SPAWNING' || this.state === 'TRANSITION') return;

        if (this.slamming) {
            // Slam down fast
            this.y += 500 * dt;
            if (this.y >= this.targetY) {
                this.y = this.targetY;
                this.slamming = false;
                this.attackTimer = this.phase === 1 ? 2.5 : 1.5;
                // Create shockwave or hazard
                engine.spawnParticles(this.x, this.y, '#fff', 30);
                if (engine.hazards) {
                    engine.hazards.push(new AreaHazard(this.x, this.y));
                }
            }
        } else {
            // Hover above player
            this.targetX = playerX;
            this.targetY = playerY;
            const hoverY = playerY - 300;

            const dx = this.targetX - this.x;
            const dy = hoverY - this.y;

            this.x += dx * 2 * dt;
            this.y += dy * 2 * dt;

            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.slamming = true;
                this.targetY = playerY;
            }
        }
    }

    drawBody(ctx, cameraY) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.r, this.y - cameraY - this.r, this.r * 2, this.r * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - this.r, this.y - cameraY - this.r, this.r * 2, this.r * 2);

        if (this.slamming) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(this.x - this.r + 5, this.y - cameraY - this.r + 5, this.r * 2 - 10, this.r * 2 - 10);
        }
    }
}
