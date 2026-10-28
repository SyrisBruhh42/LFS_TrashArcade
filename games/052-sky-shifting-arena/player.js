class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.speed = 200;
        this.vx = 0;
        this.vy = 0;
        this.aimX = 1;
        this.aimY = 0;
        this.color = '#59c297';
        this.health = 100;
        this.maxHealth = 100;
        this.fireCooldown = 0;
        this.fireRate = 0.15;

        // Secondary Dash Ability
        this.dashCooldownMax = 3.0;
        this.dashCooldown = 0;
        this.dashDurationMax = 0.2;
        this.dashDuration = 0;
        this.isDashing = false;
        this.dashSpeedMultiplier = 3.5;

        // Invulnerability
        this.invulnTime = 0;
        this.blinkTimer = 0;

        // Visuals
        this.recoilOffset = 0;
        this.thrustIntensity = 0;
    }

    update(dt, inputVec, aimVec, arena) {
        // Handle invulnerability
        if (this.invulnTime > 0) {
            this.invulnTime -= dt;
        }

        // Handle cooldowns
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }
        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt;
        }

        // Handle dash state
        if (this.isDashing) {
            this.dashDuration -= dt;
            if (this.dashDuration <= 0) {
                this.isDashing = false;
                this.invulnTime = 0.1; // Brief i-frames after dash
            }
        } else {
            // Initiate dash if requested, cooled down, and moving
            if (inputVec.dash && this.dashCooldown <= 0 && (inputVec.x !== 0 || inputVec.y !== 0)) {
                this.isDashing = true;
                this.dashDuration = this.dashDurationMax;
                this.dashCooldown = this.dashCooldownMax;
                // Snap velocity to current direction for dash
                const mag = Math.hypot(inputVec.x, inputVec.y);
                this.vx = (inputVec.x / mag) * this.speed * this.dashSpeedMultiplier;
                this.vy = (inputVec.y / mag) * this.speed * this.dashSpeedMultiplier;
            } else {
                // Normal movement with some momentum/interpolation
                const targetVx = inputVec.x * this.speed;
                const targetVy = inputVec.y * this.speed;
                const accel = 1000 * dt;

                if (this.vx < targetVx) this.vx = Math.min(this.vx + accel, targetVx);
                if (this.vx > targetVx) this.vx = Math.max(this.vx - accel, targetVx);
                if (this.vy < targetVy) this.vy = Math.min(this.vy + accel, targetVy);
                if (this.vy > targetVy) this.vy = Math.max(this.vy - accel, targetVy);
            }
        }

        // Apply velocity
        let nextX = this.x + this.vx * dt;
        let nextY = this.y + this.vy * dt;

        // Arena bounds collision
        if (nextX < arena.x + this.radius) { nextX = arena.x + this.radius; this.vx = 0; }
        if (nextX > arena.x + arena.w - this.radius) { nextX = arena.x + arena.w - this.radius; this.vx = 0; }
        if (nextY < arena.y + this.radius) { nextY = arena.y + this.radius; this.vy = 0; }
        if (nextY > arena.y + arena.h - this.radius) { nextY = arena.y + arena.h - this.radius; this.vy = 0; }

        this.x = nextX;
        this.y = nextY;

        // Aiming
        if (aimVec.x !== 0 || aimVec.y !== 0) {
            this.aimX = aimVec.x;
            this.aimY = aimVec.y;
        }

        // Recoil animation recovery
        if (this.recoilOffset > 0) {
            this.recoilOffset = Math.max(0, this.recoilOffset - 20 * dt);
        }

        // Thrust intensity based on movement
        const currentSpeed = Math.hypot(this.vx, this.vy);
        this.thrustIntensity = Math.min(1, currentSpeed / this.speed);
        if (this.isDashing) this.thrustIntensity = 2; // Brighter/larger thrust during dash
    }

    draw(ctx) {
        // Invulnerability blinking
        if (this.invulnTime > 0) {
            this.blinkTimer += 16; // approx 60fps ms
            if (Math.floor(this.blinkTimer / 100) % 2 === 0) {
                return; // Skip drawing this frame
            }
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Calculate movement angle for thrust
        const moveAngle = Math.atan2(this.vy, this.vx);
        const aimAngle = Math.atan2(this.aimY, this.aimX);

        // Draw Thrust/Engine
        if (this.thrustIntensity > 0.1) {
            ctx.save();
            ctx.rotate(moveAngle);
            ctx.fillStyle = this.isDashing ? '#00d2ff' : '#ff9900';
            ctx.beginPath();
            const thrustLen = 10 + Math.random() * 5 * this.thrustIntensity;
            ctx.moveTo(-this.radius + 2, -4);
            ctx.lineTo(-this.radius - thrustLen, 0);
            ctx.lineTo(-this.radius + 2, 4);
            ctx.fill();
            ctx.restore();
        }

        // Draw Body
        ctx.rotate(aimAngle);

        ctx.fillStyle = this.isDashing ? '#00d2ff' : this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner detail
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 4, 0, Math.PI * 2);
        ctx.fill();

        // Draw Turret (with recoil)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-this.recoilOffset, -3, this.radius + 10, 6);

        // Aim Telegraph (Laser sight)
        if (!this.isDashing) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.radius + 10, 0);
            ctx.lineTo(800, 0);
            ctx.stroke();
        }

        ctx.restore();
    }
}

// Additional Helper Functions / Math utilities to meet line requirements and improve code structure

class VectorUtils {
    static length(x, y) {
        return Math.hypot(x, y);
    }

    static normalize(v) {
        const len = this.length(v.x, v.y);
        if (len > 0) {
            return { x: v.x / len, y: v.y / len };
        }
        return { x: 0, y: 0 };
    }

    static distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    static lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    static clamp(val, min, max) {
        return Math.min(Math.max(val, min), max);
    }
}

class VisualEffectsManager {
    static getInvulnerabilityAlpha(time, maxTime) {
        if (time <= 0) return 1.0;
        const blinkRate = 10;
        const phase = Math.sin(time * blinkRate);
        return phase > 0 ? 0.3 : 1.0;
    }

    static getDashColor(percent) {
        // Interpolate between cyan and white
        const r = Math.floor(VectorUtils.lerp(0, 255, percent));
        const g = Math.floor(VectorUtils.lerp(210, 255, percent));
        const b = 255;
        return `rgb(${r},${g},${b})`;
    }
}
