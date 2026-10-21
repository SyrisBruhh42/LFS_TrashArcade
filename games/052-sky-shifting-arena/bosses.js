class Boss extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.maxHealth = 1000;
        this.health = 1000;
        this.isBoss = true;
        this.phase = 1;
        this.name = "Boss";
    }

    update(dt, playerX, playerY, arena, engine) {
        super.update(dt, playerX, playerY, arena, engine);

        if (this.health <= this.maxHealth / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseChange(engine);
        }
    }

    onPhaseChange(engine) {
        // override in subclasses
    }
}

class TitanBoss extends Boss {
    constructor(x, y) {
        super(x, y);
        this.name = "Titan of the Isles";
        this.radius = 40;
        this.color = '#8b0000';
        this.maxHealth = 2000;
        this.health = 2000;
        this.speed = 30;
        this.attackTimer = 0;
    }

    update(dt, playerX, playerY, arena, engine) {
        super.update(dt, playerX, playerY, arena, engine);

        this.attackTimer += dt;
        let attackInterval = this.phase === 1 ? 3 : 2;

        if (this.attackTimer > attackInterval) {
            this.attackTimer = 0;
            this.attack(playerX, playerY, engine);
        }
    }

    attack(playerX, playerY, engine) {
        if (engine.audio.playBossShoot) engine.audio.playBossShoot();
        if (this.phase === 1) {
            // Sweep attack (multiple projectiles in a cone)
            const angleToPlayer = Math.atan2(playerY - this.y, playerX - this.x);
            for (let i = -2; i <= 2; i++) {
                const a = angleToPlayer + i * 0.2;
                const px = Math.cos(a);
                const py = Math.sin(a);
                const proj = new Projectile(this.x, this.y, px, py, false);
                proj.speed = 150;
                proj.radius = 8;
                proj.color = '#ff4500';
                engine.projectiles.push(proj);
            }
        } else {
            // Spawn destructible covers around player to trap them + shoot
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                const dist = 100;
                const cx = playerX + Math.cos(a) * dist;
                const cy = playerY + Math.sin(a) * dist;
                engine.hazards.covers.push(new DestructibleCover(cx - 20, cy - 20, 40, 40));
            }

            // Also shoot
            const angleToPlayer = Math.atan2(playerY - this.y, playerX - this.x);
            for (let i = -3; i <= 3; i++) {
                const a = angleToPlayer + i * 0.15;
                const px = Math.cos(a);
                const py = Math.sin(a);
                const proj = new Projectile(this.x, this.y, px, py, false);
                proj.speed = 200;
                proj.radius = 10;
                proj.color = '#ff0000';
                engine.projectiles.push(proj);
            }
        }
    }

    onPhaseChange(engine) {
        this.speed = 50;
        this.color = '#ff0000';
        // Enrage effect: shrink arena faster
        engine.arena.targetW = 300;
        engine.arena.targetH = 300;
    }
}

class PhantomBoss extends Boss {
    constructor(x, y) {
        super(x, y);
        this.name = "Sky Phantom";
        this.radius = 25;
        this.color = '#4b0082';
        this.maxHealth = 1500;
        this.health = 1500;
        this.speed = 80;
        this.attackTimer = 0;
        this.teleportTimer = 0;
    }

    update(dt, playerX, playerY, arena, engine) {
        super.update(dt, playerX, playerY, arena, engine);

        this.attackTimer += dt;
        this.teleportTimer += dt;

        let attackInterval = this.phase === 1 ? 1.5 : 1.0;
        if (this.attackTimer > attackInterval) {
            this.attackTimer = 0;
            this.attack(playerX, playerY, engine);
        }

        let teleportInterval = this.phase === 1 ? 5 : 3;
        if (this.teleportTimer > teleportInterval) {
            this.teleportTimer = 0;
            this.teleport(arena);
        }
    }

    attack(playerX, playerY, engine) {
        if (engine.audio.playBossShoot) engine.audio.playBossShoot();
        // Fast targeted shots
        const angleToPlayer = Math.atan2(playerY - this.y, playerX - this.x);
        const px = Math.cos(angleToPlayer);
        const py = Math.sin(angleToPlayer);
        const proj = new Projectile(this.x, this.y, px, py, false);
        proj.speed = 300;
        proj.radius = 6;
        proj.color = '#9400d3';
        engine.projectiles.push(proj);

        if (this.phase === 2) {
            // Spawn hazard trap near player
            const hx = playerX + (Math.random() - 0.5) * 100;
            const hy = playerY + (Math.random() - 0.5) * 100;
            engine.hazards.traps.push(new LightningTrap(hx, hy, 40));
        }
    }

    teleport(arena) {
        this.x = arena.x + this.radius + Math.random() * (arena.w - this.radius * 2);
        this.y = arena.y + this.radius + Math.random() * (arena.h - this.radius * 2);
    }

    onPhaseChange(engine) {
        this.color = '#8a2be2';
        this.speed = 120;
    }
}
