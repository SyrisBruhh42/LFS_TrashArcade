class Boss extends Enemy {
    constructor(x, y, size) {
        super(x, y, size * 2); // Multi-tile footprint
        this.hp = 100;
        this.maxHp = 100;
        this.phase = 1;
        this.bossName = "Boss";
    }
    takeDamage() {
        this.hp -= 1;
        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseChange();
        }
        return this.hp <= 0;
    }
    onPhaseChange() {}
    drawBossUI(ctx, width, height) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(width / 2 - 150, 40, 300, 20);
        ctx.fillStyle = this.color;
        ctx.fillRect(width / 2 - 150, 40, 300 * (this.hp / this.maxHp), 20);
        ctx.strokeStyle = '#cdc3b9';
        ctx.strokeRect(width / 2 - 150, 40, 300, 20);
        ctx.fillStyle = '#cdc3b9';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.bossName} - Phase ${this.phase}`, width / 2, 55);
    }
}

class DreadnoughtAlpha extends Boss {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#e74c3c';
        this.hp = 20;
        this.maxHp = 20;
        this.speed = 30;
        this.bossName = "Dreadnought Alpha";
        this.attackTimer = 2.0;
    }
    update(dt, player) {
        super.update(dt, player);
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase === 1 ? 2.0 : 1.0;
            if (window.game && window.game.projectiles) {
                let dx = player.x - this.x;
                let dy = player.y - this.y;
                let len = Math.sqrt(dx*dx + dy*dy);
                if (len > 0) {
                    window.game.projectiles.push(new Projectile(this.x + this.size/2, this.y + this.size/2, dx/len, dy/len));
                }
            }
        }
    }
    onPhaseChange() {
        this.speed = 60;
        this.color = '#ff6b6b';
    }
}

class DreadnoughtOmega extends Boss {
    constructor(x, y, size) {
        super(x, y, size);
        this.color = '#8e44ad';
        this.hp = 30;
        this.maxHp = 30;
        this.speed = 20;
        this.bossName = "Dreadnought Omega";
        this.spawnTimer = 3.0;
    }
    update(dt, player) {
        super.update(dt, player);
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.phase === 1 ? 3.0 : 1.5;
            if (window.game && window.game.enemies) {
                window.game.enemies.push(new RookCharger(this.x, this.y, this.size/2));
            }
        }
    }
    onPhaseChange() {
        this.speed = 40;
        this.color = '#9b59b6';
    }
}
