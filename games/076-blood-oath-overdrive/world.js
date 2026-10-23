class LaserPillar {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.5);
        this.length = 300;
        this.activeTimer = 0;
        this.state = 'WARN'; // WARN, ACTIVE, COOLDOWN
        this.timer = 2; // Warn for 2 secs
    }
    update(dt, player, enemies, sound) {
        if (this.state === 'WARN') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'ACTIVE';
                this.timer = 5; // Active for 5 secs
            }
        } else if (this.state === 'ACTIVE') {
            this.angle += this.speed * dt;
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'COOLDOWN';
                this.timer = 3;
            }
            // Collision detection
            this.checkCollision(player, true, sound);
            for (let i = enemies.length - 1; i >= 0; i--) {
                if (this.checkCollision(enemies[i], false, sound)) {
                    enemies.splice(i, 1);
                }
            }
        } else if (this.state === 'COOLDOWN') {
            this.timer -= dt;
            if (this.timer <= 0) {
                this.state = 'WARN';
                this.timer = 2;
                this.angle = Math.random() * Math.PI * 2;
            }
        }
    }
    checkCollision(entity, isPlayer, sound) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > this.length) return false;

        const entityAngle = Math.atan2(dy, dx);
        let angleDiff = Math.abs(entityAngle - this.angle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        if (angleDiff < 0.1 || Math.abs(angleDiff - Math.PI) < 0.1) {
            const perpDist = dist * Math.sin(angleDiff);
            if (perpDist < entity.size + 5) {
                if (isPlayer) {
                    if (entity.dashTimer <= 0) {
                        entity.hp -= 0.5; // continuous damage
                        if (sound && Math.random() < 0.1) sound.playDamage();
                    }
                } else {
                    return true; // kill enemy
                }
            }
        }
        return false;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.rotate(this.angle);

        if (this.state === 'WARN') {
            ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(Date.now() / 100)) * 0.5})`;
            ctx.fillRect(-this.length, -2, this.length * 2, 4);
        } else if (this.state === 'ACTIVE') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f00';
            ctx.fillStyle = '#f00';
            ctx.fillRect(-this.length, -5, this.length * 2, 10);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-this.length, -2, this.length * 2, 4);
        }
        ctx.restore();
    }
}

class World {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.bgOffset = 0;
        this.hazards = [
            new LaserPillar(width * 0.25, height * 0.25),
            new LaserPillar(width * 0.75, height * 0.75)
        ];

        this.stars = Array.from({length: 100}, () => ({
            x: Math.random() * width, y: Math.random() * height, size: Math.random() * 2, speed: Math.random() * 0.5 + 0.1
        }));
        this.buildings = Array.from({length: 20}, () => ({
            x: Math.random() * width, y: Math.random() * height, width: 40 + Math.random() * 60, height: 100 + Math.random() * 200, speed: 0.8
        }));
        this.neon = Array.from({length: 15}, () => ({
            x: Math.random() * width, y: Math.random() * height, speed: 1.2, color: Math.random() < 0.5 ? '#f0f' : '#0ff'
        }));
        this.playerX = width / 2;
        this.playerY = height / 2;
    }
    update(dt, player, enemies, sound) {
        this.bgOffset += dt * 20;
        for (let hazard of this.hazards) {
            hazard.update(dt, player, enemies, sound);
        }
        if (player) {
            this.playerX = player.x;
            this.playerY = player.y;
        }
    }
    drawBackground(ctx) {
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#fff';
        const pOffsetX = (this.playerX - this.width/2) * 0.1;
        const pOffsetY = (this.playerY - this.height/2) * 0.1;
        for (let s of this.stars) {
            let x = (s.x - pOffsetX * s.speed + this.bgOffset * s.speed) % this.width;
            if (x < 0) x += this.width;
            let y = (s.y - pOffsetY * s.speed) % this.height;
            if (y < 0) y += this.height;
            ctx.fillRect(x, y, s.size, s.size);
        }

        ctx.fillStyle = '#1a1a2e';
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 1;
        const bOffsetX = (this.playerX - this.width/2) * 0.3;
        const bOffsetY = (this.playerY - this.height/2) * 0.3;
        for (let b of this.buildings) {
            let x = (b.x - bOffsetX * b.speed) % (this.width + b.width) - b.width;
            if (x < -b.width) x += this.width + b.width*2;
            let y = (b.y - bOffsetY * b.speed);
            ctx.fillRect(x, y, b.width, b.height);
            ctx.strokeRect(x, y, b.width, b.height);
        }

        const nOffsetX = (this.playerX - this.width/2) * 0.6;
        const nOffsetY = (this.playerY - this.height/2) * 0.6;
        for (let n of this.neon) {
            let x = (n.x - nOffsetX * n.speed) % this.width;
            if (x < 0) x += this.width;
            let y = (n.y - nOffsetY * n.speed) % this.height;
            if (y < 0) y += this.height;
            ctx.fillStyle = n.color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = n.color;
            ctx.font = '20px monospace';
            ctx.fillText('DOJO', x, y);
            ctx.shadowBlur = 0;
        }

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.beginPath();
        const fOffsetX = (this.playerX - this.width/2) * 0.8;
        const fOffsetY = (this.playerY - this.height/2) * 0.8;
        const gridSize = 100;
        for (let x = -gridSize - (fOffsetX % gridSize); x < this.width + gridSize; x += gridSize) {
            ctx.moveTo(x, 0); ctx.lineTo(x, this.height);
        }
        for (let y = -gridSize - (fOffsetY % gridSize); y < this.height + gridSize; y += gridSize) {
            ctx.moveTo(0, y); ctx.lineTo(this.width, y);
        }
        ctx.stroke();
    }
    drawHazards(ctx) {
        for (let hazard of this.hazards) {
            hazard.draw(ctx);
        }
    }
}
