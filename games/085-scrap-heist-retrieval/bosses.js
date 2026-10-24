class Boss extends Enemy {
    constructor(x, y, name, hp) {
        super(x, y);
        this.bossName = name;
        this.maxHp = hp;
        this.hp = hp;
        this.phase2 = false;
        this.radius = 40;
    }
    takeDamage(game) {
        if (this.state === 'STUNNED') return false; // Invuln while stunned
        this.hp--;
        this.state = 'STUNNED';
        this.stunTimer = 1.0; // Brief stun
        if (this.hp <= this.maxHp / 2 && !this.phase2) {
            this.phase2 = true;
            this.color = '#ff0000'; // Enrage color
            this.onPhase2();
        }
        if (this.hp <= 0) {
            this.active = false; // Dead
            // Drop a ton of scrap
            for (let i = 0; i < 10; i++) {
                game.collectibles.push(new Collectible(this.x - 50 + Math.random() * 100, this.y - 50 + Math.random() * 100));
            }
        }
        return true;
    }
    onPhase2() {
        this.speed *= 1.5; // Default enrage
    }
}

class MechaWormBoss extends Boss {
    constructor(x, y) {
        super(x, y, "Mecha-Worm", 6);
        this.color = '#aa00aa';
        this.burrowTimer = 0;
    }
    update(dt, game) {
        if (this.state === 'STUNNED') {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) this.state = 'ALERT';
            return;
        }
        // Burrow logic: occasionally go invuln and pop up near player
        this.burrowTimer -= dt;
        if (this.burrowTimer <= 0) {
            this.x = game.player.x + (Math.random() - 0.5) * 200;
            this.y = game.player.y + (Math.random() - 0.5) * 200;
            this.burrowTimer = this.phase2 ? 3 : 5;
            // Spawn some particles
            for(let i=0; i<10; i++) game.particles.push(new Particle(this.x, this.y, '#888', 5, 1));
        }

        // Chase player
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }
        super.update(dt, game);
    }
}

class ScrapTitanBoss extends Boss {
    constructor(x, y) {
        super(x, y, "Scrap Titan", 8);
        this.color = '#aa5500';
        this.shootTimer = 0;
    }
    update(dt, game) {
        if (this.state === 'STUNNED') {
            this.stunTimer -= dt;
            if (this.stunTimer <= 0) this.state = 'ALERT';
            return;
        }

        // Shoot hazards/projectiles
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                // Spawn hazard enemy
                game.enemies.push(new HazardEnemy(this.x, this.y));
            }
            this.shootTimer = this.phase2 ? 2 : 4;
        }

        // Move towards player slowly
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
            this.vx = (dx / dist) * this.speed * 0.5;
            this.vy = (dy / dist) * this.speed * 0.5;
        }
        super.update(dt, game);
    }
}
window.Boss = Boss;
window.MechaWormBoss = MechaWormBoss;
window.ScrapTitanBoss = ScrapTitanBoss;
