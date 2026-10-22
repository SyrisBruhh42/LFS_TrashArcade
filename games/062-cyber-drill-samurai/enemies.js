class BaseEnemy {
  constructor(x, y, r, hp, color) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.hp = hp;
    this.maxHp = hp;
    this.color = color;
    this.vx = 0;
    this.vy = 0;
    this.active = true;
    this.state = 'IDLE';
    this.stateTimer = 0;
  }
  update(dt, playerX, playerY, engine) {
    this.stateTimer -= dt;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y - cameraY, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  takeDamage(amount, engine) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.active = false;
      engine.spawnParticles(this.x, this.y, this.color, 15);
      engine.score += 20 * engine.multiplier;
    }
  }
}

class SwarmerEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 12, 1, '#f14668');
    this.speed = 80;
  }
  update(dt, playerX, playerY, engine) {
    super.update(dt, playerX, playerY, engine);
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist < 500) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - cameraY - this.r);
    ctx.lineTo(this.x + this.r, this.y - cameraY + this.r);
    ctx.lineTo(this.x - this.r, this.y - cameraY + this.r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

class SniperEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 16, 2, '#9b59b6');
    this.speed = 30;
    this.state = 'HOVER'; // HOVER, AIM, SHOOT, COOLDOWN
    this.targetX = 0;
    this.targetY = 0;
  }
  update(dt, playerX, playerY, engine) {
    super.update(dt, playerX, playerY, engine);
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.state === 'HOVER') {
      if (dist < 300) {
        this.vx = -(dx / dist) * this.speed;
        this.vy = -(dy / dist) * this.speed;
      } else if (dist > 400) {
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
      } else {
        this.vx *= 0.9;
        this.vy *= 0.9;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (this.stateTimer <= 0) {
        this.state = 'AIM';
        this.stateTimer = 1.5; // 1.5s telegraph
        this.targetX = playerX;
        this.targetY = playerY;
      }
    } else if (this.state === 'AIM') {
      this.targetX = playerX;
      this.targetY = playerY;
      if (this.stateTimer <= 0) {
        this.state = 'SHOOT';
        this.stateTimer = 0.2;
        // spawn projectile here
        if (engine.enemyProjectiles) {
           engine.enemyProjectiles.push({
               x: this.x, y: this.y,
               vx: ((this.targetX - this.x) / dist) * 200,
               vy: ((this.targetY - this.y) / dist) * 200,
               r: 6,
               active: true
           });
        }
      }
    } else if (this.state === 'SHOOT') {
      if (this.stateTimer <= 0) {
        this.state = 'HOVER';
        this.stateTimer = 3.0; // 3s cooldown
      }
    }
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y - cameraY, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cross pattern
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.x - this.r/2, this.y - cameraY - 2, this.r, 4);
    ctx.fillRect(this.x - 2, this.y - cameraY - this.r/2, 4, this.r);

    if (this.state === 'AIM') {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - cameraY);
      ctx.lineTo(this.targetX, this.targetY - cameraY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

class BruiserEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 25, 5, '#e67e22');
    this.speed = 40;
    this.state = 'MOVE';
    this.shieldActive = true;
    this.shieldTimer = 5;
  }
  update(dt, playerX, playerY, engine) {
    super.update(dt, playerX, playerY, engine);
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    this.shieldTimer -= dt;
    if (this.shieldTimer <= 0) {
        this.shieldActive = !this.shieldActive;
        this.shieldTimer = this.shieldActive ? 5 : 3;
    }

    if (dist < 400) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.r, this.y - cameraY - this.r, this.r * 2, this.r * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x - this.r, this.y - cameraY - this.r, this.r * 2, this.r * 2);

    if (this.shieldActive) {
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y - cameraY, this.r + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  takeDamage(amount, engine) {
      if (this.shieldActive) {
          engine.spawnParticles(this.x, this.y, '#3498db', 5);
          return; // Immune
      }
      super.takeDamage(amount, engine);
  }
}

class SplitterEnemy extends BaseEnemy {
  constructor(x, y, size = 1) {
    super(x, y, size === 1 ? 20 : 12, size === 1 ? 3 : 1, '#1abc9c');
    this.size = size;
    this.speed = size === 1 ? 50 : 90;
    this.vx = (Math.random() - 0.5) * this.speed * 2;
    this.vy = (Math.random() - 0.5) * this.speed * 2;
  }
  update(dt, playerX, playerY, engine) {
    super.update(dt, playerX, playerY, engine);

    // erratic movement
    if (Math.random() < 0.02) {
        this.vx = (Math.random() - 0.5) * this.speed * 2;
        this.vy = (Math.random() - 0.5) * this.speed * 2;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 300) {
        this.vx += (dx / dist) * this.speed * dt * 2;
        this.vy += (dy / dist) * this.speed * dt * 2;
    }

    // limit speed
    const spd = Math.hypot(this.vx, this.vy);
    if (spd > this.speed) {
        this.vx = (this.vx / spd) * this.speed;
        this.vy = (this.vy / spd) * this.speed;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - cameraY - this.r);
    ctx.lineTo(this.x + this.r, this.y - cameraY);
    ctx.lineTo(this.x, this.y - cameraY + this.r);
    ctx.lineTo(this.x - this.r, this.y - cameraY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  takeDamage(amount, engine) {
      super.takeDamage(amount, engine);
      if (this.hp <= 0 && this.size === 1) {
          // split into 2 smaller ones
          engine.enemies.push(new SplitterEnemy(this.x - 10, this.y - 10, 0));
          engine.enemies.push(new SplitterEnemy(this.x + 10, this.y + 10, 0));
      }
  }
}

class AreaDenialEnemy extends BaseEnemy {
  constructor(x, y) {
    super(x, y, 18, 4, '#e74c3c');
    this.speed = 20;
    this.state = 'MOVE';
    this.stateTimer = 4.0;
  }
  update(dt, playerX, playerY, engine) {
    super.update(dt, playerX, playerY, engine);

    if (this.state === 'MOVE') {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 150) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        } else {
            this.vx *= 0.9;
            this.vy *= 0.9;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.stateTimer <= 0) {
            this.state = 'DEPLOY';
            this.stateTimer = 1.0;
        }
    } else if (this.state === 'DEPLOY') {
        if (this.stateTimer <= 0) {
            // Drop a hazard pool
            if (engine.hazards) {
                engine.hazards.push(new AreaHazard(this.x, this.y));
            }
            this.state = 'MOVE';
            this.stateTimer = 5.0;
        }
    }
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    // Octagon
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const px = this.x + Math.cos(angle) * this.r;
        const py = this.y - cameraY + Math.sin(angle) * this.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (this.state === 'DEPLOY') {
        ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y - cameraY, this.r * 2 * (1 - this.stateTimer), 0, Math.PI * 2);
        ctx.fill();
    }
  }
}

class AreaHazard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = 60;
        this.life = 10.0;
        this.active = true;
    }
    update(dt, engine) {
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
        }

        // Damage player if in area
        if (engine.player && engine.player.invulnTimer <= 0) {
            const dist = Math.hypot(engine.player.x - this.x, engine.player.y - this.y);
            if (dist < this.r) {
                engine.gameOver();
            }
        }
    }
    draw(ctx, cameraY) {
        if (!this.active) return;
        ctx.fillStyle = `rgba(231, 76, 60, ${Math.min(0.5, this.life / 2)})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y - cameraY, this.r, 0, Math.PI * 2);
        ctx.fill();
    }
}
