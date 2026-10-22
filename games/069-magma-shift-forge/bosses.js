class BossWarning {
    constructor() {
        this.active = false;
        this.timer = 0;
        this.maxTimer = 3.0;
        this.message = "WARNING: ANOMALY DETECTED";
    }

    trigger(message = "WARNING: BOSS APPROACHING") {
        this.active = true;
        this.timer = this.maxTimer;
        this.message = message;
    }

    update(dt) {
        if (this.active) {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.active = false;
            }
        }
    }

    draw(ctx, game) {
        if (!this.active) return;

        ctx.save();

        // Blink effect
        const blink = Math.floor(this.timer * 4) % 2 === 0;
        if (blink) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, game.targetHeight / 2 - 50, game.targetWidth, 100);

            ctx.fillStyle = '#fff';
            ctx.font = '40px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.message, game.targetWidth / 2, game.targetHeight / 2);
        }

        ctx.restore();
    }
}

class BaseBoss extends BaseEnemy {
    constructor(x, y, radius, hp, speed, color) {
        super(x, y, radius, hp, speed, color);
        this.type = 'boss';
        this.maxHp = hp;
        this.isPhase2 = false;
        this.isBoss = true; // flag to distinguish from normal enemies
    }

    checkPhaseTransition(game) {
        if (!this.isPhase2 && this.hp <= this.maxHp / 2) {
            this.isPhase2 = true;
            this.onPhaseTransition(game);
        }
    }

    onPhaseTransition(game) {
        // To be overridden
    }

    drawHealth(ctx, game) {
        const hpPercent = Math.max(0, this.hp / this.maxHp);
        const barWidth = 400;
        const barHeight = 20;
        const x = game.targetWidth / 2 - barWidth / 2;
        const y = 20;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = this.isPhase2 ? '#f00' : '#f0f';
        ctx.fillRect(x, y, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.isPhase2 ? "PHASE 2" : "PHASE 1", game.targetWidth / 2, y + barHeight / 2);
        ctx.restore();
    }
}

class MagmaCoreBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y, 40, 100, 40, '#f50');
        this.shootTimer = 1.5;
        this.originalGravityStrength = 0;
        this.angleOffset = 0;
    }

    onPhaseTransition(game) {
        for (let i = 0; i < 20; i++) {
            game.spawnParticle(this.x, this.y, '#fff', 150);
        }
    }

    update(dt, game) {
        if (this.originalGravityStrength === 0) {
            this.originalGravityStrength = game.gravityWell.strength;
        }

        // Move slowly towards center, but try to stay in the middle
        const targetX = game.targetWidth / 2;
        const targetY = game.targetHeight / 2;
        const toX = targetX - this.x;
        const toY = targetY - this.y;
        const dist = Math.hypot(toX, toY);

        if (dist > 5) {
            this.vx = (toX / dist) * this.speed;
            this.vy = (toY / dist) * this.speed;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.shootTimer -= dt;

        if (!this.isPhase2) {
            // Phase 1: Shoot rings of fire, increase gravity
            game.gravityWell.strength = this.originalGravityStrength * 2;

            if (this.shootTimer <= 0) {
                this.shootTimer = 2.0;
                for (let i = 0; i < 8; i++) {
                    const angle = (Math.PI * 2 / 8) * i + this.angleOffset;
                    game.enemyProjectiles.push({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle) * 150,
                        vy: Math.sin(angle) * 150,
                        life: 4,
                        radius: 6,
                        bounce: false
                    });
                }
                this.angleOffset += 0.2;
            }
        } else {
            // Phase 2: Rapidly pulse arena size, shoot more projectiles
            game.gravityWell.strength = this.originalGravityStrength * 0.5; // less gravity

            game.arena.pulsing += dt * 5;

            if (this.shootTimer <= 0) {
                this.shootTimer = 1.0;
                for (let i = 0; i < 12; i++) {
                    const angle = (Math.PI * 2 / 12) * i - this.angleOffset;
                    game.enemyProjectiles.push({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(angle) * 200,
                        vy: Math.sin(angle) * 200,
                        life: 3,
                        radius: 8,
                        bounce: false
                    });
                }
                this.angleOffset += 0.3;
            }
        }
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 500);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const radius = i % 2 === 0 ? this.radius : this.radius * 0.6;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.isPhase2 ? '#f00' : '#ff0';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    onDeath(game) {
        super.onDeath(game);
        game.gravityWell.strength = this.originalGravityStrength;
    }
}

class ForgeOverseerBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y, 35, 120, 80, '#0ff');
        this.angle = 0;
        this.attackTimer = 2.0;
    }

    onPhaseTransition(game) {
        for (let i = 0; i < 30; i++) {
            game.spawnParticle(this.x, this.y, '#0ff', 200);
        }
    }

    update(dt, game) {
        if (!this.isPhase2) {
            // Phase 1: Orbit perimeter, drop hazards
            this.angle += dt * 0.5;
            const targetRadius = game.arena.radius - 40;
            const targetX = game.targetWidth / 2 + Math.cos(this.angle) * targetRadius;
            const targetY = game.targetHeight / 2 + Math.sin(this.angle) * targetRadius;

            const toX = targetX - this.x;
            const toY = targetY - this.y;
            this.x += toX * dt * 2;
            this.y += toY * dt * 2;

            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.attackTimer = 1.5;
                game.enemyHazards.push({
                    x: this.x,
                    y: this.y,
                    radius: 20,
                    life: 4.0,
                    maxLife: 4.0
                });
            }
        } else {
            // Phase 2: Shrink arena, move to center, fire bouncing projectiles
            game.arena.radius = Math.max(game.arena.minRadius + 20, game.arena.radius - dt * 20);

            const targetX = game.targetWidth / 2;
            const targetY = game.targetHeight / 2;
            const toX = targetX - this.x;
            const toY = targetY - this.y;
            this.x += toX * dt * 2;
            this.y += toY * dt * 2;

            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.attackTimer = 2.0;
                for (let i = 0; i < 4; i++) {
                    const pAngle = (Math.PI * 2 / 4) * i + this.angle;
                    game.enemyProjectiles.push({
                        x: this.x,
                        y: this.y,
                        vx: Math.cos(pAngle) * 250,
                        vy: Math.sin(pAngle) * 250,
                        life: 6, // longer life for bounces
                        radius: 8,
                        bounce: true // flag for bounce logic in game.js
                    });
                }
            }
        }
    }

    draw(ctx, game) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-Date.now() / 800);

        ctx.fillStyle = this.color;
        ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-this.radius, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.moveTo(this.radius, -this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.stroke();

        if (this.isPhase2) {
            ctx.fillStyle = '#f00';
            ctx.beginPath();
            ctx.arc(0, 0, 10 + Math.sin(Date.now() / 100) * 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
