class BaseBoss {
    constructor(x, y, maxHp, name) {
        this.x = x; this.y = y; this.radius = 24;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.name = name;
        this.phase = 1;
        this.bannerTimer = 3.0;
        this.transitionTimer = 0;
        this.isSpawning = true;
        this.isTransitioning = false;
        this.displayHp = maxHp;
    }
    update(dt, player, walls, hazards) {
        this.displayHp += (this.hp - this.displayHp) * 5 * dt;
        if (this.isSpawning) {
            this.bannerTimer -= dt;
            if (this.bannerTimer <= 0) this.isSpawning = false;
            return false;
        }
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.isTransitioning = true;
            this.transitionTimer = 2.0;
        }
        if (this.isTransitioning) {
            this.transitionTimer -= dt;
            if (this.transitionTimer <= 0) this.isTransitioning = false;
            return false;
        }
        return this.behavior(dt, player, walls, hazards);
    }
    draw(ctx) {
        ctx.fillStyle = this.color || '#a00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    drawUI(ctx, w, h) {
        if (this.isSpawning) {
            ctx.fillStyle = 'rgba(200, 0, 0, 0.5)';
            ctx.fillRect(0, h/2 - 50, w, 100);
            ctx.fillStyle = '#fff';
            ctx.font = '40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`WARNING: ${this.name} APPROACHING`, w/2, h/2 + 15);
        } else if (this.isTransitioning) {
            ctx.fillStyle = 'rgba(100, 0, 200, 0.5)';
            ctx.fillRect(0, h/2 - 50, w, 100);
            ctx.fillStyle = '#fff';
            ctx.font = '40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`PHASE 2`, w/2, h/2 + 15);
        }

        const barW = w * 0.6;
        const barH = 20;
        const bx = (w - barW) / 2;
        const by = 20;

        ctx.fillStyle = '#333';
        ctx.fillRect(bx, by, barW, barH);

        ctx.fillStyle = '#f00';
        ctx.fillRect(bx, by, barW * (this.displayHp / this.maxHp), barH);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, barW, barH);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, w/2, by + 15);
    }
    behavior(dt, player, walls, hazards) { return false; }
}

class SpectralWarden extends BaseBoss {
    constructor(x, y) {
        super(x, y, 6, "Spectral Warden");
        this.color = '#ff4444';
        this.speed = 60;
        this.attackTimer = 0;
    }
    behavior(dt, player, walls, hazards) {
        this.speed = this.phase === 1 ? 60 : 90;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;

        this.attackTimer += dt;
        if (this.attackTimer > (this.phase === 1 ? 4.0 : 2.5)) {
            this.attackTimer = 0;
            hazards.push({x: this.x, y: this.y, life: 0.8, type: 'blast', radius: 10});
        }

        if (Math.hypot(dx, dy) < this.radius + player.radius) return 'caught';
        return false;
    }
}

class MirrorWraith extends BaseBoss {
    constructor(x, y) {
        super(x, y, 6, "Mirror Wraith");
        this.color = '#44ffff';
        this.speed = 130;
        this.trailTimer = 0;
    }
    behavior(dt, player, walls, hazards) {
        this.speed = this.phase === 1 ? 130 : 180;
        let target = player;
        if (player.echo) target = player.echo;

        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const angle = Math.atan2(dy, dx);
        this.x += Math.cos(angle) * this.speed * dt;
        this.y += Math.sin(angle) * this.speed * dt;

        this.trailTimer += dt;
        if (this.trailTimer > 0.5) {
            this.trailTimer = 0;
            hazards.push({x: this.x, y: this.y, life: this.phase === 1 ? 5.0 : 10.0, type: 'zone', radius: 30});
        }

        if (Math.hypot(player.x - this.x, player.y - this.y) < this.radius + player.radius) return 'caught';
        return false;
    }
}
