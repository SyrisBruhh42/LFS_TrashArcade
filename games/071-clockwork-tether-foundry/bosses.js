class Boss extends Enemy {
    constructor(x, y, maxHp, name) {
        super(x, y);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.name = name;
        this.phase = 1;
        this.radius = 40;
    }
    drawHealthBar(ctx, game) {
        const barWidth = 400;
        const barHeight = 20;
        const bx = game.width / 2 - barWidth / 2;
        const by = 50;
        ctx.fillStyle = '#444';
        ctx.fillRect(bx, by, barWidth, barHeight);
        ctx.fillStyle = this.phase === 1 ? '#a04e7e' : '#e53935';
        ctx.fillRect(bx, by, barWidth * (this.hp / this.maxHp), barHeight);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, barWidth, barHeight);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.name} - Phase ${this.phase}`, game.width / 2, by - 10);
    }
}

class CogwheelTitan extends Boss {
    constructor(x, y) {
        super(x, y, 100, "Cogwheel Titan");
        this.state = 'MOVE';
        this.stateTimer = 2.0;
        this.attackTimer = 1.0;
        this.targetX = x;
        this.targetY = y;
    }
    update(dt, game) {
        super.update(dt, game);
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.stateTimer = 1.0;
        }

        this.attackTimer -= dt;

        if (this.phase === 1) {
            if (this.attackTimer <= 0) {
                this.attackTimer = 1.5;
                game.sound.playWeaponFire();
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    game.hazards.push(new Projectile(this.x, this.y, Math.cos(angle) * 150, Math.sin(angle) * 150));
                }
            }
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.stateTimer = 2.0;
                this.targetX = 100 + Math.random() * (game.width - 200);
                this.targetY = 100 + Math.random() * (game.height - 300);
            }
            this.x += (this.targetX - this.x) * 2 * dt;
            this.y += (this.targetY - this.y) * 2 * dt;
        } else {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                if (this.state === 'MOVE') {
                    this.state = 'CHARGE';
                    this.stateTimer = 1.0;
                    this.targetX = game.player.x;
                    this.targetY = game.player.y;
                } else {
                    this.state = 'MOVE';
                    this.stateTimer = 1.0;
                }
            }
            if (this.state === 'CHARGE') {
                const angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);
                this.x += Math.cos(angle) * 300 * dt;
                this.y += Math.sin(angle) * 300 * dt;
                if (this.attackTimer <= 0) {
                    this.attackTimer = 0.2;
                    game.hazards.push(new Projectile(this.x, this.y, 0, 0));
                }
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Date.now() / 500);
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r1 = this.radius;
            const r2 = this.radius * 1.3;
            ctx.lineTo(Math.cos(a - 0.1) * r1, Math.sin(a - 0.1) * r1);
            ctx.lineTo(Math.cos(a - 0.1) * r2, Math.sin(a - 0.1) * r2);
            ctx.lineTo(Math.cos(a + 0.1) * r2, Math.sin(a + 0.1) * r2);
            ctx.lineTo(Math.cos(a + 0.1) * r1, Math.sin(a + 0.1) * r1);
        }
        ctx.closePath();
        ctx.fillStyle = this.phase === 1 ? '#a87a51' : '#ff4444';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
}

class SteamOverlord extends Boss {
    constructor(x, y) {
        super(x, y, 100, "Steam Overlord");
        this.attackTimer = 2.0;
    }
    update(dt, game) {
        super.update(dt, game);
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.attackTimer = 1.0;
        }

        this.x = game.width / 2 + Math.sin(Date.now() / 1000) * (game.width / 3);
        this.y = 150 + Math.cos(Date.now() / 800) * 50;

        this.attackTimer -= dt;
        if (this.phase === 1) {
            if (this.attackTimer <= 0) {
                this.attackTimer = 1.5;
                game.hazards.push(new ToxicPuddle(this.x, game.height - 50));
                game.sound.playWeaponFire();
            }
        } else {
            if (this.attackTimer <= 0) {
                this.attackTimer = 2.5;
                for (let i = 0; i < 5; i++) {
                    const tx = 100 + Math.random() * (game.width - 200);
                    const ty = game.height - 50;
                    game.hazards.push(new ToxicPuddle(tx, ty));
                }
            }
            const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (dist < 400 && !game.player.tethered) {
                const pullForce = 800 * dt;
                const angle = Math.atan2(this.y - game.player.y, this.x - game.player.x);
                game.player.vx += Math.cos(angle) * pullForce;
                game.player.vy += Math.sin(angle) * pullForce;
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.phase === 1 ? '#44aacc' : '#ff44aa';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-15, -10, 5, 0, Math.PI * 2);
        ctx.arc(15, -10, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();

        ctx.restore();
    }
}