class BossEnemy extends Enemy {
  constructor(x, y, maxHealth, title) {
    super(x, y);
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.title = title;
    this.points = 1000;
    this.phase = 1;
    this.orbitAngle = Math.random() * Math.PI * 2;
  }
  update(dt, game) {
    super.update(dt, game);
    if (this.health <= this.maxHealth / 2 && this.phase === 1) {
      this.phase = 2;
      this.onPhaseTransition(game);
    }
  }
  onPhaseTransition(game) {}
}

class JunkGoliathBoss extends BossEnemy {
  constructor(x, y) {
    super(x, y, 50, "Junk Goliath");
    this.color = "#ff8800";
    this.speed = 80;
    this.timer = 2;
    this.orbitRadius = 250;
  }
  update(dt, game) {
    super.update(dt, game); // triggers phase transition
    if (!game.player || !game.player.active) { return; }
    this.timer -= dt;
    const center = new Vector2(game.width / 2, game.height / 2);
    this.orbitAngle += dt * (this.phase === 1 ? 0.3 : 0.6);
    const targetX = center.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetY = center.y + Math.sin(this.orbitAngle) * this.orbitRadius;
    const dirOrbit = new Vector2(targetX - this.pos.x, targetY - this.pos.y).normalize();
    this.vel = dirOrbit.mult(this.speed);

    if (this.timer <= 0) {
      if (this.phase === 1) {
        // Shoot big slow bullet
        const dir = new Vector2(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
        const proj = new EnemyProjectile(this.pos, dir.mult(150));
        proj.radius = 12;
        proj.color = '#ff8800';
        game.enemyProjectiles.push(proj);
        this.timer = 1.5;
        if (Math.random() < 0.3) game.enemies.push(new SwarmerEnemy(this.pos.x, this.pos.y));
      } else {
        // Spread fire
        for(let i=-1; i<=1; i++) {
          const baseDir = new Vector2(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
          const angle = Math.atan2(baseDir.y, baseDir.x) + i * 0.3;
          const dir = new Vector2(Math.cos(angle), Math.sin(angle));
          game.enemyProjectiles.push(new EnemyProjectile(this.pos, dir.mult(200)));
        }
        if (Math.random() < 0.2) game.enemyProjectiles.push(new AreaDenialHazard(this.pos.x, this.pos.y));
        this.timer = 1.0;
      }
    }
  }
  onPhaseTransition(game) {
    this.speed = 120;
    this.color = "#ff4400";
    game.spawnParticles(this.pos.x, this.pos.y, 30, this.color);
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.pos.x - 20, this.pos.y - 20, 40, 40);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(this.pos.x - 20, this.pos.y - 20, 40, 40);
  }
}

class MagneticWarlordBoss extends BossEnemy {
  constructor(x, y) {
    super(x, y, 60, "Magnetic Warlord");
    this.color = "#00ffff";
    this.speed = 60;
    this.timer = 3;
    this.orbitRadius = 200;
  }
  update(dt, game) {
    super.update(dt, game); // triggers phase transition
    if (!game.player || !game.player.active) { return; }
    this.timer -= dt;
    const center = new Vector2(game.width / 2, game.height / 2);
    this.orbitAngle -= dt * 0.4;
    const targetX = center.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetY = center.y + Math.sin(this.orbitAngle) * this.orbitRadius;
    const dirOrbit = new Vector2(targetX - this.pos.x, targetY - this.pos.y).normalize();
    this.vel = dirOrbit.mult(this.speed);

    // Magnetic effect
    const distToPlayer = Math.hypot(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y);
    if (distToPlayer > 0) {
      const magDir = new Vector2(this.pos.x - game.player.pos.x, this.pos.y - game.player.pos.y).normalize();
      const force = this.phase === 1 ? 100 : -150; // Attract in P1, Repel in P2
      game.player.vel = game.player.vel.add(magDir.mult(force * dt));
    }

    if (this.timer <= 0) {
      if (this.phase === 1) {
        game.enemies.push(new SniperEnemy(this.pos.x, this.pos.y));
        this.timer = 2.5;
      } else {
        game.enemies.push(new ShieldedBruiserEnemy(this.pos.x, this.pos.y));
        this.timer = 3.0;
      }
    }
  }
  onPhaseTransition(game) {
    this.color = "#ff00ff";
    game.spawnParticles(this.pos.x, this.pos.y, 30, this.color);
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.pos.x, this.pos.y - 25);
    ctx.lineTo(this.pos.x + 25, this.pos.y);
    ctx.lineTo(this.pos.x, this.pos.y + 25);
    ctx.lineTo(this.pos.x - 25, this.pos.y);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}
