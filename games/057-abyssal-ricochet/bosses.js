class BossManager {
  constructor() {
    this.activeBoss = null;
    this.warningTimer = 0;
  }
  triggerBoss(wave, engine) {
    this.warningTimer = 3; // 3 seconds warning
    document.getElementById('bossUI').classList.remove('hidden');
    document.getElementById('bossWarning').style.display = 'block';
    document.getElementById('bossName').style.display = 'none';
    document.getElementById('bossHealthBarContainer').style.display = 'none';

    // Select boss based on wave
    if (wave % 10 === 0) {
        this.pendingBoss = new AbyssalCoreBoss(engine.arena.x + engine.arena.width/2, engine.arena.y + engine.arena.height/2, wave);
    } else {
        this.pendingBoss = new TrenchLeviathanBoss(engine.arena.x + engine.arena.width/2, engine.arena.y + engine.arena.height/2, wave);
    }
  }
  update(dt, player, engine) {
    if (this.warningTimer > 0) {
      this.warningTimer -= dt;
      if (this.warningTimer <= 0) {
        document.getElementById('bossWarning').style.display = 'none';
        document.getElementById('bossName').style.display = 'block';
        document.getElementById('bossHealthBarContainer').style.display = 'block';
        this.activeBoss = this.pendingBoss;
        this.pendingBoss = null;
        document.getElementById('bossName').innerText = this.activeBoss.name;
      }
    }

    if (this.activeBoss) {
      this.activeBoss.update(dt, engine.arena, player, engine);
      // Update UI
      const hpPct = Math.max(0, this.activeBoss.hp / this.activeBoss.maxHp) * 100;
      document.getElementById('bossHealthBar').style.width = hpPct + '%';

      if (!this.activeBoss.active) {
          if (engine.vfxManager) {
              engine.vfxManager.emitExplosion(this.activeBoss.x, this.activeBoss.y, '#8800ff', 50);
              engine.vfxManager.triggerScreenShake(20);
              engine.vfxManager.triggerHitStop(0.5);
          }
          this.activeBoss = null;
          document.getElementById('bossUI').classList.add('hidden');
          engine.score += 5000;
      }
    }
  }
  draw(ctx) {
    if (this.activeBoss) {
      this.activeBoss.draw(ctx);
    }
  }
}

class Boss extends Enemy {
  constructor(x, y, maxHp, name) {
    super(x, y);
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.name = name;
    this.phase = 1;
    this.radius = 40;
  }
  takeHit() {
    this.hp -= 100;
    if (window.engine && window.engine.audio) window.engine.audio.playBossHit();
    if (this.hp <= this.maxHp / 2 && this.phase === 1) {
        this.phase = 2;
        this.onPhaseChange();
    }
    if (this.hp <= 0) {
        if (window.engine && window.engine.uiManager) window.engine.uiManager.checkMilestone('boss_slayer', 1);
        if (window.engine && window.engine.audio) window.engine.audio.playBossDeath();
        this.active = false;
        return true;
    }
    return false; // Boss didn't die from this hit yet
  }
  onPhaseChange() {}
}
class TrenchLeviathanBoss extends Boss {
  constructor(x, y, wave = 5) {
    super(x, y, 2000 * (1 + (wave * 0.1)), "Trench Leviathan");
    this.speed = 80;
    this.vx = this.speed;
    this.vy = this.speed;
    this.shootTimer = 0;
  }
  onPhaseChange() {
    this.speed = 150;
    this.radius = 50;
  }
  update(dt, arena, player, engine) {
    // Move around
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.x - this.radius < arena.x) { this.x = arena.x + this.radius; this.vx = this.speed; }
    if (this.x + this.radius > arena.x + arena.width) { this.x = arena.x + arena.width - this.radius; this.vx = -this.speed; }
    if (this.y - this.radius < arena.y) { this.y = arena.y + this.radius; this.vy = this.speed; }
    if (this.y + this.radius > arena.y + arena.height) { this.y = arena.y + arena.height - this.radius; this.vy = -this.speed; }

    if (this.phase === 2) {
        // Shrink arena when bouncing
        engine.arena.width = Math.max(engine.arena.minSize, engine.arena.width - 20 * dt);
        engine.arena.height = Math.max(engine.arena.minSize, engine.arena.height - 20 * dt);
    }

    this.shootTimer += dt;
    if (this.shootTimer > (this.phase === 1 ? 1.5 : 0.8)) {
        this.shootTimer = 0;
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
        const numProj = this.phase === 1 ? 3 : 5;
        const spread = 0.5;
        for (let i = 0; i < numProj; i++) {
            const a = angleToPlayer - spread/2 + (spread/(numProj-1)) * i;
            engine.projectiles.push(new Projectile(this.x, this.y, Math.cos(a)*150, Math.sin(a)*150));
        }
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.phase === 1 ? '#0077aa' : '#ff0044';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
class AbyssalCoreBoss extends Boss {
  constructor(x, y, wave = 10) {
    super(x, y, 3000 * (1 + (wave * 0.1)), "Abyssal Core");
    this.radius = 60;
    this.beamAngle = 0;
    this.spawnTimer = 0;
    this.pullStrength = 150;
  }
  onPhaseChange() {
    this.pullStrength = 300;
  }
  update(dt, arena, player, engine) {
    // Stays in center
    this.x = arena.x + arena.width/2;
    this.y = arena.y + arena.height/2;

    this.beamAngle += dt * 1.5;

    if (this.phase === 2) {
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0 && !player.isDashing) {
            player.vx += (dx/dist) * this.pullStrength * dt;
            player.vy += (dy/dist) * this.pullStrength * dt;
        }

        this.spawnTimer += dt;
        if (this.spawnTimer > 3) {
            this.spawnTimer = 0;
            if (engine.enemyManager) {
                engine.enemyManager.enemies.push(new Swarmer(this.x + 100, this.y));
                engine.enemyManager.enemies.push(new Swarmer(this.x - 100, this.y));
            }
        }
    }

    // Beam damage logic (simple collision with a rotating line)
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const playerAngle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx*dx + dy*dy);

    let hit = false;
    // Check if player angle is close to beam angle or beam angle + PI
    const angleDiff1 = Math.abs(this.normalizeAngle(playerAngle - this.beamAngle));
    const angleDiff2 = Math.abs(this.normalizeAngle(playerAngle - (this.beamAngle + Math.PI)));

    if (dist < 400 && (angleDiff1 < 0.1 || angleDiff2 < 0.1)) {
        hit = true;
    }

    if (hit && player.invulnerableTimer <= 0) {
        engine.arena.width = Math.max(engine.arena.minSize, engine.arena.width - 50);
        engine.arena.height = Math.max(engine.arena.minSize, engine.arena.height - 50);
        player.invulnerableTimer = 1.0;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        player.recoil = 1;
        player.recoilAngle = angle;
        engine.audio.playHit();
    }
  }
  normalizeAngle(a) {
      while (a > Math.PI) a -= Math.PI*2;
      while (a < -Math.PI) a += Math.PI*2;
      return a;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.beamAngle);
    ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
    ctx.fillRect(-400, -10, 800, 20);
    ctx.restore();

    ctx.fillStyle = this.phase === 1 ? '#8800ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
}
