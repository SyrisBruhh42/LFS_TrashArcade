class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.radius = 15;
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.thrustIntensity = 0;
        this.recoil = 0;
        this.invulnerabilityTime = 0;

        // Progression Stats
        this.damage = 1;
        this.maxSpeed = 300;
        this.fireCooldown = 0.2;
        this.fireTimer = 0;
        this.dashCooldownMax = 1.0;
        this.pierce = 1;
        this.multishot = 1;
        this.magnetRadius = 50;
    }

    update(dt, input, game) {
        const speed = this.maxSpeed;
        let ax = 0, ay = 0;

        if(input.keys['KeyW'] || input.keys['ArrowUp']) ay -= 1;
        if(input.keys['KeyS'] || input.keys['ArrowDown']) ay += 1;
        if(input.keys['KeyA'] || input.keys['ArrowLeft']) ax -= 1;
        if(input.keys['KeyD'] || input.keys['ArrowRight']) ax += 1;

        if(ax !== 0 || ay !== 0) {
            const len = Math.hypot(ax, ay);
            ax /= len; ay /= len;
            this.thrustIntensity = Math.min(1, this.thrustIntensity + dt * 10);
        } else {
            this.thrustIntensity = Math.max(0, this.thrustIntensity - dt * 5);
        }

        // Apply dash
        if(this.dashCooldown > 0) this.dashCooldown -= dt;
        if(this.invulnerabilityTime > 0) this.invulnerabilityTime -= dt;
        if(this.dashTimer > 0) this.dashTimer -= dt;

        if((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && this.dashCooldown <= 0) {
            this.dashCooldown = this.dashCooldownMax;
            this.dashTimer = 0.2; // 0.2s duration
            this.invulnerabilityTime = 0.2;

            // Spawn dash particles
            for(let i=0; i<10; i++) {
                game.spawnParticle(this.x, this.y, '#0ff', 200, this.angle + (Math.random()-0.5));
            }
        }

        let currentSpeed = speed;
        if(this.dashTimer > 0) {
            currentSpeed = speed * 3;
            game.spawnParticle(this.x, this.y, '#0ff', 50, this.angle + Math.PI + (Math.random()-0.5)*0.5);
        }

        this.vx += ax * currentSpeed * dt;
        this.vy += ay * currentSpeed * dt;

        // Apply gravity well (Orbital physics)
        const dx = game.gravityWell.x - this.x;
        const dy = game.gravityWell.y - this.y;
        const dist = Math.max(10, Math.hypot(dx, dy));
        const gForce = game.gravityWell.strength / (dist);

        this.vx += (dx / dist) * gForce * dt;
        this.vy += (dy / dist) * gForce * dt;

        // Friction
        this.vx *= 0.95;
        this.vy *= 0.95;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Recoil recovery
        if(this.recoil > 0) {
            this.recoil = Math.max(0, this.recoil - dt * 5);
        }

        // Aim angle is handled in game.js before shooting, but we could do it here if we pass mouse unscaled coordinates.
        // The plan keeps angle setting in game.js.

        // Arena shrink bounds checking logic
        const currentArenaRadius = game.arena.radius + Math.sin(game.arena.pulsing) * 10;
        const pdx = this.x - game.targetWidth/2;
        const pdy = this.y - game.targetHeight/2;
        const pdist = Math.hypot(pdx, pdy);

        if(pdist + this.radius > currentArenaRadius) {
            // Bounce
            const nx = pdx / pdist;
            const ny = pdy / pdist;
            this.x = game.targetWidth/2 + nx * (currentArenaRadius - this.radius);

            // Reflect velocity
            const dot = this.vx * nx + this.vy * ny;
            this.vx -= 2 * dot * nx;
            this.vy -= 2 * dot * ny;

            // Also slight shrink acceleration on wall hit
            game.arena.radius -= 1;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Recoil displacement
        ctx.translate(-this.recoil * 5, 0);

        // Blink if invulnerable
        if (this.invulnerabilityTime > 0 && Math.floor(this.invulnerabilityTime * 20) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Aim Telegraph
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(100, 0);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Thrust Flame
        if(this.thrustIntensity > 0) {
            ctx.beginPath();
            ctx.moveTo(-10, -5);
            ctx.lineTo(-10 - 15 * this.thrustIntensity * (0.8 + Math.random()*0.4), 0);
            ctx.lineTo(-10, 5);
            ctx.closePath();
            ctx.fillStyle = '#f50';
            ctx.fill();
        }

        // Hull / Wings
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fillStyle = '#0ff';
        ctx.fill();

        // Cockpit
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(0, -4);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();

        ctx.restore();
    }
}
