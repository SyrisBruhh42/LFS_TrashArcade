class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.alerted = false;
        this.sightRange = 150;
        this.sightAngle = Math.PI / 3;
        this.angle = 0;
        this.color = '#cc846d';
        this.radius = 14;
    }
    canSee(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.sightRange) return false;
        const angleToPlayer = Math.atan2(dy, dx);
        let angleDiff = angleToPlayer - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        return Math.abs(angleDiff) < this.sightAngle / 2;
    }
    update(dt, player, game) {}
    draw(ctx) {}
}

class StandardGuard extends Enemy {
    constructor(x, y, path) {
        super(x, y);
        this.path = path;
        this.pathIndex = 0;
        this.speed = 60;
    }
    update(dt, player, game) {
        if (this.path.length === 0) return;
        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.pathIndex = (this.pathIndex + 1) % this.path.length;
        } else {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.sightRange, -this.sightAngle/2, this.sightAngle/2);
        ctx.fillStyle = this.alerted ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 0, 0.2)';
        ctx.fill();
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius/2, this.radius/2);
        ctx.lineTo(-this.radius/2, -this.radius/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius/2, 0);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();
        ctx.restore();
    }
}

class Swarmer extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 100;
        this.color = '#c24b4b';
        this.sightRange = 200;
        this.sightAngle = Math.PI;
        this.radius = 10;
        this.state = 'idle';
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
    }
    update(dt, player, game) {
        if (this.canSee(player)) {
            this.state = 'chase';
        } else {
            this.state = 'wander';
        }

        if (this.state === 'chase') {
            this.angle = Math.atan2(player.y - this.y, player.x - this.x);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        } else {
            this.wanderTimer -= dt;
            if (this.wanderTimer <= 0) {
                this.wanderTimer = 1 + Math.random();
                this.wanderAngle = Math.random() * Math.PI * 2;
            }
            this.angle += (this.wanderAngle - this.angle) * 0.1;
            this.x += Math.cos(this.angle) * (this.speed * 0.3) * dt;
            this.y += Math.sin(this.angle) * (this.speed * 0.3) * dt;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.sightRange, -this.sightAngle/2, this.sightAngle/2);
        ctx.fillStyle = this.alerted ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 200, 0, 0.1)';
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius/2, this.radius);
        ctx.lineTo(0, 0);
        ctx.lineTo(-this.radius/2, -this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class Sniper extends Enemy {
    constructor(x, y, angle) {
        super(x, y);
        this.angle = angle;
        this.color = '#7395c7';
        this.sightRange = 350;
        this.sightAngle = Math.PI / 8;
        this.chargeTimer = 0;
        this.maxCharge = 1.5;
        this.scanDir = 1;
    }
    update(dt, player, game) {
        if (this.canSee(player)) {
            this.chargeTimer += dt;
            if (this.chargeTimer >= this.maxCharge) {
                this.alerted = true;
            }
        } else {
            this.chargeTimer = Math.max(0, this.chargeTimer - dt);
            this.angle += 0.5 * dt * this.scanDir;
            if (Math.random() < 0.01) this.scanDir *= -1;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        let sightColor = `rgba(255, ${255 - (this.chargeTimer/this.maxCharge)*255}, 0, 0.2)`;
        if (this.alerted) sightColor = 'rgba(255, 0, 0, 0.5)';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.sightRange, -this.sightAngle/2, this.sightAngle/2);
        ctx.fillStyle = sightColor;
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius/2, this.radius*2, this.radius);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.radius*1.5, 0);
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        ctx.restore();
    }
}

class Bruiser extends Enemy {
    constructor(x, y, path) {
        super(x, y);
        this.path = path;
        this.pathIndex = 0;
        this.speed = 30;
        this.sightRange = 100;
        this.sightAngle = Math.PI / 2;
        this.radius = 22;
        this.color = '#7a7664';
    }
    update(dt, player, game) {
        if (this.path.length === 0) return;
        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.pathIndex = (this.pathIndex + 1) % this.path.length;
        } else {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.sightRange, -this.sightAngle/2, this.sightAngle/2);
        ctx.fillStyle = this.alerted ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 0, 0.2)';
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.lineTo(0, -this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius/2, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}

class Spawner extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 40;
        this.color = '#6b4d8c';
        this.sightRange = 120;
        this.sightAngle = Math.PI * 2;
        this.radius = 18;
        this.spawnTimer = 0;
        this.spawnInterval = 5;
        this.targetX = x;
        this.targetY = y;
    }
    update(dt, player, game) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        if (Math.hypot(dx, dy) < 5) {
            this.targetX = this.x + (Math.random() - 0.5) * 100;
            this.targetY = this.y + (Math.random() - 0.5) * 100;
        } else {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }

        this.spawnTimer += dt;
        if (this.spawnTimer > this.spawnInterval) {
            this.spawnTimer = 0;
            if (game && game.guards) {
                game.guards.push(new Swarmer(this.x, this.y));
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.beginPath();
        ctx.arc(0, 0, this.sightRange, 0, Math.PI*2);
        ctx.fillStyle = this.alerted ? 'rgba(255, 0, 0, 0.3)' : 'rgba(200, 100, 255, 0.1)';
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;

        const sides = 6;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const a = (i * Math.PI * 2) / sides;
            const r = this.radius + Math.sin(this.spawnTimer*5)*2;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}
