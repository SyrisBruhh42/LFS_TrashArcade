class Swarmer {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.speed = 150 + Math.random() * 50;
        this.polarity = polarity;
        this.active = true;
        this.type = 'SWARMER';
        // AI State
        this.state = 'HOMING';
        this.wobblePhase = Math.random() * Math.PI * 2;
    }
    update(dt, player, env) {
        if (!this.active) return;

        this.wobblePhase += dt * 10;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            const angle = Math.atan2(dy, dx);
            const wobble = Math.sin(this.wobblePhase) * 0.5;
            this.x += Math.cos(angle + wobble) * this.speed * dt;
            this.y += Math.sin(angle + wobble) * this.speed * dt;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.wobblePhase);

        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.closePath();

        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        ctx.restore();
    }
}

class RangedSniper {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 14;
        this.speed = 80;
        this.polarity = polarity;
        this.active = true;
        this.type = 'SNIPER';

        this.state = 'POSITIONING'; // POSITIONING, TELEGRAPH, SHOOTING
        this.timer = 2.0;
        this.targetAngle = 0;
    }
    update(dt, player, env) {
        if (!this.active) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (this.state === 'POSITIONING') {
            if (dist < 200) {
                // Flee
                this.x -= (dx / dist) * this.speed * dt;
                this.y -= (dy / dist) * this.speed * dt;
            } else if (dist > 300) {
                // Approach
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            } else {
                // Strafe
                const angle = Math.atan2(dy, dx);
                this.x += Math.cos(angle + Math.PI/2) * this.speed * dt;
                this.y += Math.sin(angle + Math.PI/2) * this.speed * dt;
            }

            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'TELEGRAPH';
                this.timer = 1.0;
                this.targetAngle = Math.atan2(dy, dx);
            }
        } else if (this.state === 'TELEGRAPH') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'SHOOTING';
                this.timer = 0.5;
                // Env adds bullet (handled in Game loop)
                env.spawnProjectile(this.x, this.y, this.targetAngle, this.polarity);
            }
        } else if (this.state === 'SHOOTING') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'POSITIONING';
                this.timer = 2.0 + Math.random();
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'TELEGRAPH') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(this.targetAngle) * 500, Math.sin(this.targetAngle) * 500);
            ctx.strokeStyle = `rgba(255, 50, 50, ${1 - this.timer})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Inner eye
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = this.state === 'TELEGRAPH' ? '#f00' : '#222';
        ctx.fill();

        ctx.restore();
    }
}

class ShieldedBruiser {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 20;
        this.speed = 60;
        this.polarity = polarity;
        this.active = true;
        this.type = 'BRUISER';

        this.shieldActive = true;
        this.shieldHealth = 2; // Needs multiple hits to break shield if not perfect parried
        this.chargeTimer = 3.0;
        this.state = 'APPROACH'; // APPROACH, CHARGING, STUNNED
    }
    update(dt, player, env) {
        if (!this.active) return;

        if (this.state === 'STUNNED') {
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.state = 'APPROACH';
                this.chargeTimer = 3.0;
                this.shieldActive = true;
            }
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (this.state === 'APPROACH') {
            if (dist > 0) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }

            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0 && dist < 150) {
                this.state = 'CHARGING';
                this.chargeTimer = 0.5; // dash duration
                this.dashDx = (dx / dist) * this.speed * 4;
                this.dashDy = (dy / dist) * this.speed * 4;
            }
        } else if (this.state === 'CHARGING') {
            this.x += this.dashDx * dt;
            this.y += this.dashDy * dt;
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0) {
                this.state = 'APPROACH';
                this.chargeTimer = 3.0;
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        if (this.shieldActive) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${this.state === 'CHARGING' ? 1 : 0.5})`;
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Splitter {
    constructor(x, y, polarity, size = 1) {
        this.x = x;
        this.y = y;
        this.size = size; // 1 = large, 0 = small
        this.radius = size === 1 ? 16 : 8;
        this.speed = size === 1 ? 90 : 130;
        this.polarity = polarity;
        this.active = true;
        this.type = 'SPLITTER';
        this.angle = Math.random() * Math.PI * 2;
    }
    update(dt, player, env) {
        if (!this.active) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            const targetAngle = Math.atan2(dy, dx);
            // Erratic movement
            this.angle += (targetAngle - this.angle) * 2 * dt;
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.beginPath();
        const sides = 3;
        for (let i = 0; i < sides; i++) {
            const a = this.angle + (i * Math.PI * 2) / sides;
            if (i === 0) ctx.moveTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
            else ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
        }
        ctx.closePath();

        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        ctx.restore();
    }
}

class AreaDenialHazard {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 18;
        this.speed = 40;
        this.polarity = polarity;
        this.active = true;
        this.type = 'HAZARD';

        this.pulseTimer = 0;
        this.pulseRadius = this.radius;
        this.state = 'IDLE'; // IDLE, EXPANDING, SHRINKING
    }
    update(dt, player, env) {
        if (!this.active) return;

        // Slow move to center or player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        this.pulseTimer += dt;
        if (this.state === 'IDLE' && this.pulseTimer > 2.0) {
            this.state = 'EXPANDING';
            this.pulseTimer = 0;
        } else if (this.state === 'EXPANDING') {
            this.pulseRadius += 100 * dt;
            if (this.pulseRadius > 100) {
                this.state = 'SHRINKING';
            }
        } else if (this.state === 'SHRINKING') {
            this.pulseRadius -= 100 * dt;
            if (this.pulseRadius <= this.radius) {
                this.pulseRadius = this.radius;
                this.state = 'IDLE';
                this.pulseTimer = 0;
            }
        }

        // Hazard damage handled in collision
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Core
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        // Hazard area
        if (this.state !== 'IDLE') {
            ctx.beginPath();
            ctx.arc(0, 0, this.pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.polarity === 'POSITIVE' ? '100,200,255' : '255,100,100'}, 0.3)`;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(${this.polarity === 'POSITIVE' ? '100,200,255' : '255,100,100'}, 0.8)`;
            ctx.stroke();
        }

        ctx.restore();
    }
}
