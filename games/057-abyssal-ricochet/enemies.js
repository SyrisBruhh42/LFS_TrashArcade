class Projectile {
  constructor(x, y, vx, vy) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 5;
    this.active = true;
  }
  update(dt, arena) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < arena.x || this.x > arena.x + arena.width || this.y < arena.y || this.y > arena.y + arena.height) {
      this.active = false;
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Swarmer extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.radius = 12;
    this.speed = 120;
    this.color = '#ff8844';
    this.telegraphTimer = 0.5; // Stays still and flashes for 0.5s before moving
  }
  update(dt, arena, player) {
    if (this.telegraphTimer > 0) {
        this.telegraphTimer -= dt;
        this.vx = 0;
        this.vy = 0;
    } else if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
      }
    }
    super.update(dt, arena);
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(this.x + this.radius, this.y);
    ctx.lineTo(this.x - this.radius/2, this.y + this.radius);
    ctx.lineTo(this.x - this.radius/2, this.y - this.radius);
    ctx.closePath();
    ctx.fill();
    if (this.telegraphTimer > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
    } else {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
    }
    ctx.stroke();
  }
}

class Sniper extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.radius = 18;
    this.speed = 40;
    this.color = '#aa44ff';
    this.shootTimer = 0;
    this.shootInterval = 3;
    this.telegraphTimer = 0;
  }
  update(dt, arena, player, engine) {
    if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200) {
        this.vx = -(dx / dist) * this.speed;
        this.vy = -(dy / dist) * this.speed;
      } else {
        this.vx = 0;
        this.vy = 0;
      }

      this.shootTimer += dt;
      if (this.shootTimer > this.shootInterval - 0.5) {
          this.telegraphTimer = 0.5; // Telegraph for 0.5s before shooting
      }
      if (this.telegraphTimer > 0) {
          this.telegraphTimer -= dt;
      }

      if (this.shootTimer >= this.shootInterval) {
        this.shootTimer = 0;
        if (dist > 0 && typeof engine.projectiles !== 'undefined') {
          const px = (dx / dist) * 200;
          const py = (dy / dist) * 200;
          engine.projectiles.push(new Projectile(this.x, this.y, px, py));
        }
      }
    }
    super.update(dt, arena);
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.telegraphTimer > 0) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
class Bruiser extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.radius = 25;
    this.speed = 30;
    this.color = '#4444ff';
    this.hp = 3;
    this.shieldActive = true;
    this.shieldTimer = 0;
    this.telegraphTimer = 0.5; // Stays still before moving
  }
  update(dt, arena, player) {
    if (this.telegraphTimer > 0) {
        this.telegraphTimer -= dt;
        this.vx = 0;
        this.vy = 0;
    } else if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0) {
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
      }
    }
    if (!this.shieldActive) {
        this.shieldTimer += dt;
        if (this.shieldTimer > 5) {
            this.shieldActive = true;
            this.shieldTimer = 0;
        }
    }
    super.update(dt, arena);
  }
  takeHit() {
      if (this.shieldActive) {
          this.shieldActive = false;
          return false; // Did not die
      }
      this.hp--;
      return this.hp <= 0;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    if (this.shieldActive) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(this.x - this.radius - 4, this.y - this.radius - 4, this.radius * 2 + 8, this.radius * 2 + 8);
    }
    ctx.strokeStyle = this.telegraphTimer > 0 ? '#ff0000' : '#fff';
    ctx.lineWidth = this.telegraphTimer > 0 ? 3 : 1;
    ctx.strokeRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
  }
}

class Spawner extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 20;
        this.speed = 20;
        this.color = '#44ff44';
        this.pulse = 0;
        this.telegraphTimer = 0.5; // Stays still before moving
    }
    update(dt, arena, player) {
        if (this.telegraphTimer > 0) {
            this.telegraphTimer -= dt;
            this.vx = 0;
            this.vy = 0;
        }
        this.pulse += dt * 5;
        this.radius = 20 + Math.sin(this.pulse) * 5; // Pulsing effect
        super.update(dt, arena);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.telegraphTimer > 0 ? '#ff0000' : '#fff';
        ctx.lineWidth = this.telegraphTimer > 0 ? 3 : 1;
        ctx.stroke();
    }
}

class Hazard extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 15;
        this.speed = 0;
        this.vx = 0;
        this.vy = 0;
        this.color = '#ffff00';
        this.timer = 0;
        this.warningPhase = true;
    }
    update(dt, arena, player) {
        this.timer += dt;
        if (this.warningPhase && this.timer > 2) {
            this.warningPhase = false;
            this.radius = 40; // Expand into hazard
            this.timer = 0;
        } else if (!this.warningPhase && this.timer > 3) {
            this.active = false; // Disappear
        }
    }
    draw(ctx) {
        if (this.warningPhase) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
