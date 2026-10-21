class BossProjectile {
  constructor(x, y, vx, vy, r, color, damage) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.r = r;
    this.color = color;
    this.damage = damage;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.iFrames > 0) this.iFrames -= dt;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Boss {
  constructor(x, y, hp, name) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.iFrames = 0;
    this.name = name;
    this.r = 40;
    this.dead = false;
    this.phase = 1;
    this.projectiles = [];
    this.vx = 0;
    this.vy = 0;
    this.stateTimer = 0;
    this.state = 'enter';
  }

  update(dt, playerX, playerY, game) {
    if (this.hp <= 0) {
      this.dead = true;
      return;
    }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.onPhaseChange(game);
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      if (p.x < -100 || p.x > game.logicalWidth + 100 || p.y < -100 || p.y > game.logicalHeight + 100) {
        this.projectiles.splice(i, 1);
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.iFrames > 0) this.iFrames -= dt;

    // Screen bounds for boss
    if (this.x < this.r) { this.x = this.r; this.vx *= -1; }
    if (this.x > game.logicalWidth - this.r) { this.x = game.logicalWidth - this.r; this.vx *= -1; }
    if (this.y < this.r) { this.y = this.r; this.vy *= -1; }
    if (this.y > game.logicalHeight - this.r) { this.y = game.logicalHeight - this.r; this.vy *= -1; }

    this.behavior(dt, playerX, playerY, game);
  }

  onPhaseChange(game) {
    game.spawnParticles(this.x, this.y, '#ffffff', 50);
  }

  behavior(dt, playerX, playerY, game) {}

  draw(ctx) {
    // Draw Projectiles
    for (const p of this.projectiles) p.draw(ctx);

    // Draw Health Bar
    const barWidth = 400;
    const barHeight = 20;
    const barX = 200; // Assuming 800 width, centered
    const barY = 20;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpRatio = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = this.iFrames > 0 ? '#ffffff' : (this.phase === 1 ? '#e26b6b' : '#d8b0e2');
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.name} - Phase ${this.phase}`, barX + barWidth/2, barY + 15);
  }
}

class IceWormBoss extends Boss {
  constructor(x, y) {
    super(x, y, 500, "Glacial Annihilator");
    this.r = 50;
    this.segments = [];
    for(let i=0; i<5; i++) {
      this.segments.push({x: x, y: y});
    }
  }

  behavior(dt, playerX, playerY, game) {
    this.stateTimer -= dt;

    // Update segments
    let prevX = this.x;
    let prevY = this.y;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const dx = prevX - seg.x;
      const dy = prevY - seg.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 30) {
        seg.x += (dx/dist) * (dist - 30);
        seg.y += (dy/dist) * (dist - 30);
      }
      prevX = seg.x;
      prevY = seg.y;
    }

    if (this.state === 'enter') {
      this.vx = 0;
      this.vy = 100;
      if (this.y > 100) {
        this.state = 'idle';
        this.stateTimer = 2;
      }
    } else if (this.state === 'idle') {
      this.vx *= 0.9;
      this.vy *= 0.9;
      if (this.stateTimer <= 0) {
        this.state = 'lunge';
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const speed = this.phase === 1 ? 300 : 450;
        this.vx = (dx/dist) * speed;
        this.vy = (dy/dist) * speed;
        this.stateTimer = 1.5;
        game.sound.playHit(); // roar
      }
    } else if (this.state === 'lunge') {
      if (this.stateTimer <= 0) {
        this.state = 'shoot';
        this.stateTimer = this.phase === 1 ? 1 : 0.5;
        this.vx *= 0.5;
        this.vy *= 0.5;
      }
    } else if (this.state === 'shoot') {
      if (this.stateTimer <= 0) {
        // Shoot spread
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const angle = Math.atan2(dy, dx);
        const count = this.phase === 1 ? 3 : 5;
        const spread = 0.5;
        for (let i = 0; i < count; i++) {
          const a = angle - spread/2 + (spread/(count-1)) * i;
          this.projectiles.push(new BossProjectile(
            this.x, this.y,
            Math.cos(a) * 200, Math.sin(a) * 200,
            8, '#a0d8e2', 1
          ));
        }
        this.state = 'idle';
        this.stateTimer = this.phase === 1 ? 2 : 1;
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);
    // Draw segments
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      ctx.fillStyle = '#4a708b';
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, this.r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.stroke();
    }
    // Draw head
    ctx.fillStyle = this.phase === 1 ? '#6ba8e2' : '#e26b6b';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x - 15, this.y - 15, 8, 0, Math.PI * 2);
    ctx.arc(this.x + 15, this.y - 15, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.x - 15, this.y - 15, 4, 0, Math.PI * 2);
    ctx.arc(this.x + 15, this.y - 15, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

class FrostConstructBoss extends Boss {
  constructor(x, y) {
    super(x, y, 600, "Aegis Core");
    this.r = 60;
    this.rotation = 0;
  }

  behavior(dt, playerX, playerY, game) {
    this.stateTimer -= dt;
    this.rotation += dt;

    if (this.state === 'enter') {
      this.vx = 0;
      this.vy = 50;
      if (this.y > 150) {
        this.state = 'orbit';
        this.stateTimer = 4;
        this.vy = 0;
      }
    } else if (this.state === 'orbit') {
      // Move in a figure-8 or sine wave
      this.x = game.logicalWidth/2 + Math.sin(Date.now() / 1000) * 200;
      this.y = 150 + Math.cos(Date.now() / 500) * 50;

      if (this.stateTimer <= 0) {
        this.state = 'bullet_hell';
        this.stateTimer = 3;
      } else {
        // Periodically shoot slow homing
        if (Math.random() < (this.phase === 1 ? 0.02 : 0.05)) {
          const dx = playerX - this.x;
          const dy = playerY - this.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          this.projectiles.push(new BossProjectile(
            this.x, this.y,
            (dx/dist) * 100, (dy/dist) * 100,
            12, '#f2a65a', 1
          ));
        }
      }
    } else if (this.state === 'bullet_hell') {
      this.vx = 0;
      this.vy = 0;

      // Emit ring of bullets
      if (Math.random() < 0.2) {
        const pCount = this.phase === 1 ? 8 : 16;
        const offset = this.rotation * 5;
        for (let i = 0; i < pCount; i++) {
          const a = (Math.PI * 2 / pCount) * i + offset;
          this.projectiles.push(new BossProjectile(
            this.x, this.y,
            Math.cos(a) * 150, Math.sin(a) * 150,
            6, '#d8b0e2', 1
          ));
        }
      }

      if (this.stateTimer <= 0) {
        this.state = 'orbit';
        this.stateTimer = 5;
      }
    }
  }

  draw(ctx) {
    super.draw(ctx);

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.fillStyle = '#223344';
    ctx.fillRect(-this.r, -this.r, this.r*2, this.r*2);

    ctx.strokeStyle = this.phase === 1 ? '#a0d8e2' : '#f2a65a';
    ctx.lineWidth = 4;
    ctx.strokeRect(-this.r, -this.r, this.r*2, this.r*2);

    ctx.fillStyle = this.phase === 1 ? '#d8b0e2' : '#e26b6b';
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Crystals floating around
    for(let i=0; i<4; i++) {
      ctx.save();
      ctx.rotate((Math.PI/2) * i + this.rotation * 2);
      ctx.fillStyle = '#fff';
      ctx.fillRect(this.r * 1.2, -5, 20, 10);
      ctx.restore();
    }

    ctx.restore();
  }
}
