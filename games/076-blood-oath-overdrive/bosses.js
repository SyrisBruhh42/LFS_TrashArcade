class Boss {
    constructor(x, y, maxHp, title) {
        this.x = x;
        this.y = y;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.title = title;
        this.state = 'intro'; // intro, phase1, transition, phase2, dying
        this.stateTimer = 2;
        this.size = 40;
        this.phase = 1;
        this.iframes = 0;
    }
    update(dt, player, game) {
        if (this.iframes > 0) {
            this.iframes -= dt;
        }
        if (this.state === 'intro') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'phase1';
            }
        } else if (this.state === 'transition') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'phase2';
                this.phase = 2;
            }
        }
    }
    draw(ctx, canvas) {
        if (this.state === 'intro' || this.state === 'transition') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height / 2 - 50, canvas.width, 100);
            ctx.fillStyle = '#fff';
            ctx.font = '30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`WARNING: ${this.title}`, canvas.width / 2, canvas.height / 2);
            ctx.font = '20px monospace';
            ctx.fillText(this.state === 'transition' ? 'PHASE 2' : 'APPROACHING', canvas.width / 2, canvas.height / 2 + 30);
        }

        const barW = canvas.width * 0.8;
        const barH = 20;
        const barX = canvas.width * 0.1;
        const barY = 20;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barW, barH);

        const hpPercent = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.phase === 2 ? '#ff0055' : '#ff0000';
        ctx.fillRect(barX, barY, barW * hpPercent, barH);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.title, canvas.width / 2, barY + 15);
    }
    takeDamage(amount, game) {
        if (this.state === 'intro' || this.state === 'transition' || this.state === 'dying' || this.iframes > 0) return;
        this.hp -= amount;
        this.iframes = 0.5; // Half a second of invulnerability to prevent multi-hits
        if (this.hp <= this.maxHp / 2 && this.phase === 1 && this.state !== 'transition') {
            this.state = 'transition';
            this.stateTimer = 2;
            this.iframes = 0;
        }
    }
}

class CyberSamuraiBoss extends Boss {
    constructor(x, y) {
        super(x, y, 150, 'CYBER RONIN');
        this.attackTimer = 0;
        this.attackPattern = 0;
        this.dashTarget = null;
    }
    update(dt, player, game) {
        super.update(dt, player, game);
        if (this.state !== 'phase1' && this.state !== 'phase2') {
            if (this.state === 'intro') {
                this.y += 100 * dt;
            }
            return;
        }

        this.attackTimer -= dt;

        if (this.dashTarget) {
            const dx = this.dashTarget.x - this.x;
            const dy = this.dashTarget.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 10) {
                this.dashTarget = null;
            } else {
                const speed = this.phase === 2 ? 400 : 250;
                this.x += (dx / dist) * speed * dt;
                this.y += (dy / dist) * speed * dt;
            }
        } else {
             // Slowly move towards player
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 150) {
                this.x += (dx / dist) * 50 * dt;
                this.y += (dy / dist) * 50 * dt;
            }
        }

        if (this.attackTimer <= 0) {
            this.attackPattern = (this.attackPattern + 1) % 2;
            this.attackTimer = this.phase === 2 ? 1.5 : 2.5;

            if (this.attackPattern === 0) {
                const numShots = this.phase === 2 ? 12 : 8;
                for (let i = 0; i < numShots; i++) {
                    const angle = (i / numShots) * Math.PI * 2;
                    game.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle), Math.sin(angle), 150, 10, '#0ff'));
                }
                game.sound.playDamage(); // closest to laser sound in current sound engine
            } else {
                this.dashTarget = { x: player.x, y: player.y };
            }
        }

        this.x = Math.max(this.size, Math.min(game.canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(game.canvas.height - this.size, this.y));
    }
    draw(ctx, canvas) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.phase === 2 ? '#f0f' : '#0ff';
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, this.size);
        ctx.lineTo(-this.size, this.size);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        super.draw(ctx, canvas);
    }
}

class OniTankBoss extends Boss {
    constructor(x, y) {
        super(x, y, 200, 'ONI DREADNOUGHT');
        this.attackTimer = 0;
    }
    update(dt, player, game) {
        super.update(dt, player, game);
        if (this.state !== 'phase1' && this.state !== 'phase2') {
            if (this.state === 'intro') {
                this.y += 100 * dt;
            }
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const speed = this.phase === 2 ? 100 : 50;

        if (dist > 0) {
            this.x += (dx / dist) * speed * dt;
            this.y += (dy / dist) * speed * dt;
        }

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase === 2 ? 2 : 3;
            const numShots = 16;
            for (let i = 0; i < numShots; i++) {
                const angle = (i / numShots) * Math.PI * 2;
                game.projectiles.push(new Projectile(this.x, this.y, Math.cos(angle), Math.sin(angle), 100, 20, '#f80'));
            }
            game.sound.playDamage(); // play explosion sound
            game.shake.trigger(10, 0.2);

            if (this.phase === 2) {
                game.enemies.push(new EnemySwarmer(this.x + 50, this.y, 100));
                game.enemies.push(new EnemySwarmer(this.x - 50, this.y, 100));
            }
        }

        this.x = Math.max(this.size, Math.min(game.canvas.width - this.size, this.x));
        this.y = Math.max(this.size, Math.min(game.canvas.height - this.size, this.y));
    }
    draw(ctx, canvas) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.phase === 2 ? '#f00' : '#800';
        ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        ctx.restore();
        super.draw(ctx, canvas);
    }
}