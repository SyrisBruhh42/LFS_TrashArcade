class Sentry {
    constructor(x, y, patrolPoints) {
        this.x = x;
        this.y = y;
        this.radius = 25;
        this.speed = 100;

        this.patrolPoints = patrolPoints;
        this.currentPointIdx = 0;

        this.visionAngle = Math.PI / 4; // 45 degrees half-angle
        this.visionRange = 400;
        this.facing = 0; // angle in radians

        this.alertTimer = 0;
        this.state = 'patrol'; // patrol, alert
    }

    update(dt, player, audioEngine) {
        if (!player) return;

        // Line of sight check
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distToPlayer = Math.hypot(dx, dy);

        if (distToPlayer <= this.visionRange) {
            const angleToPlayer = Math.atan2(dy, dx);
            let angleDiff = angleToPlayer - this.facing;

            // Normalize angle diff to [-PI, PI]
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            if (Math.abs(angleDiff) <= this.visionAngle) {
                // Player is in vision cone!
                // Add obstacle check if we add walls later.
                if (this.state !== 'alert') {
                    this.state = 'alert';
                    audioEngine.playAlert();
                }
            }
        }

        if (this.state === 'alert') {
            // Chase player or shoot? Let's just have them charge at the player, doing damage on touch
            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            this.facing = angleToPlayer;
            this.x += Math.cos(this.facing) * this.speed * 2 * dt;
            this.y += Math.sin(this.facing) * this.speed * 2 * dt;

            if (distToPlayer < this.radius + player.radius) {
                player.takeDamage(20, audioEngine);
                // Knockback
                player.x += Math.cos(this.facing) * 50;
                player.y += Math.sin(this.facing) * 50;
                this.state = 'patrol'; // Reset after hit
            }

            // Lose interest if player gets too far
            if (distToPlayer > this.visionRange * 1.5) {
                this.state = 'patrol';
            }

        } else {
            // Patrol logic
            if (this.patrolPoints && this.patrolPoints.length > 0) {
                const target = this.patrolPoints[this.currentPointIdx];
                const tdx = target.x - this.x;
                const tdy = target.y - this.y;
                const tDist = Math.hypot(tdx, tdy);

                if (tDist < 5) {
                    this.currentPointIdx = (this.currentPointIdx + 1) % this.patrolPoints.length;
                } else {
                    const targetAngle = Math.atan2(tdy, tdx);

                    // Smooth rotation
                    let angleDiff = targetAngle - this.facing;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                    this.facing += angleDiff * Math.min(1, 5 * dt);

                    this.x += Math.cos(this.facing) * this.speed * dt;
                    this.y += Math.sin(this.facing) * this.speed * dt;
                }
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw vision cone
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, this.facing - this.visionAngle, this.facing + this.visionAngle);
        ctx.lineTo(0, 0);
        ctx.fillStyle = this.state === 'alert' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 255, 0, 0.1)';
        ctx.fill();

        // Draw body
        ctx.rotate(this.facing);
        ctx.fillStyle = this.state === 'alert' ? '#f00' : '#888';
        ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);

        // Draw "eye"
        ctx.fillStyle = '#ff0';
        ctx.fillRect(0, -5, this.radius + 5, 10);

        ctx.restore();
    }
}
