class Boss {
    constructor(x, y, maxHp, name) {
        this.x = x; this.y = y; this.maxHp = maxHp; this.hp = maxHp; this.name = name;
        this.phase = 1; this.radius = 40; this.active = false; this.warningTimer = 3.0;
        this.displayHp = maxHp;
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseTransition();
        }
    }
    onPhaseTransition() {}
    update(dt, player, game) {
        if (this.warningTimer > 0) { this.warningTimer -= dt; return; }
        this.active = true;
        this.displayHp += (this.hp - this.displayHp) * 5 * dt;
        this.behavior(dt, player, game);
    }
    behavior(dt, player, game) {}
    draw(ctx) {
        if (this.warningTimer > 0) return;
        this.render(ctx);
    }
    render(ctx) {}
}

class OrigamiDragon extends Boss {
    constructor(x, y) {
        super(x, y, 6, "Origami Dragon");
        this.attackTimer = 2.0;
    }
    onPhaseTransition() { this.attackTimer = 0.5; this.radius = 30; }
    behavior(dt, player, game) {
        this.attackTimer -= dt;
        let dx = player.x - this.x; let dy = player.y - this.y;
        let dist = Math.hypot(dx, dy);
        let speed = this.phase === 1 ? 50 : 100;
        if (dist > 0) { this.x += (dx/dist) * speed * dt; this.y += (dy/dist) * speed * dt; }
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase === 1 ? 2.0 : 1.0;
            let ang = Math.atan2(dy, dx);
            game.player.vx += Math.cos(ang) * 400; game.player.vy += Math.sin(ang) * 400;
        }
        if (dist < this.radius + player.radius) { game.gameOver(); }
    }
    render(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, this.radius); ctx.lineTo(-this.radius, this.radius); ctx.fill();
        ctx.restore();
    }
}

class ShiftingShogun extends Boss {
    constructor(x, y) {
        super(x, y, 8, "Shifting Shogun");
        this.shiftTimer = 3.0;
    }
    onPhaseTransition() { this.shiftTimer = 1.0; }
    behavior(dt, player, game) {
        this.shiftTimer -= dt;
        if (this.shiftTimer <= 0) {
            this.shiftTimer = this.phase === 1 ? 3.0 : 1.5;
            this.x = game.baseWidth/2 + (Math.random()-0.5) * (game.arenaRadius * 1.5);
            this.y = game.baseHeight/2 + (Math.random()-0.5) * (game.arenaRadius * 1.5);
            game.arenaRadius = Math.max(50, game.arenaRadius - 20);
        }
        let dx = player.x - this.x; let dy = player.y - this.y;
        if (Math.hypot(dx, dy) < this.radius + player.radius) { game.gameOver(); }
    }
    render(ctx) {
        ctx.save(); ctx.translate(this.x, this.y); ctx.fillStyle = '#8e44ad';
        ctx.fillRect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        ctx.restore();
    }
}
