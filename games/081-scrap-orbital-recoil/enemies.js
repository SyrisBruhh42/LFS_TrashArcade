class EnemyProjectile extends Entity {
  constructor(pos, vel) {
    super(pos.x, pos.y, 4);
    this.vel = vel.copy();
    this.color = '#ff4444';
    this.life = 3.0;
  }
  update(dt, game) {
    super.update(dt);
    this.life -= dt;
    if (this.life <= 0) this.active = false;
    if (this.pos.x < 0 || this.pos.x > game.width || this.pos.y < 0 || this.pos.y > game.height) {
      this.active = false;
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class AreaDenialHazard extends Entity {
  constructor(x, y) {
    super(x, y, 30);
    this.life = 6.0;
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    const pulse = Math.sin(Date.now() / 150) * 5;
    ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class SwarmerEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.color = '#ff66aa';
    this.speed = 180 + Math.random() * 50;
    this.health = 1;
    this.points = 50;
    this.orbitRadius = 150 + Math.random() * 50;
    this.aiState = 'ORBIT';
    this.timer = Math.random() * 3 + 2;
    this.chargeDir = new Vector2(0, 0);
  }
  update(dt, game) {
    if (!game.player || !game.player.active) { super.update(dt, game); return; }
    const center = new Vector2(game.width / 2, game.height / 2);
    this.timer -= dt;

    if (this.aiState === 'ORBIT') {
      this.orbitAngle += dt * 1.5;
      const targetX = center.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      const targetY = center.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      const dirOrbit = new Vector2(targetX - this.pos.x, targetY - this.pos.y).normalize();
      this.vel = dirOrbit.mult(this.speed);
      if (this.timer <= 0) {
        this.aiState = 'TELEGRAPH';
        this.timer = 0.5;
        this.vel = new Vector2(0, 0);
      }
    } else if (this.aiState === 'TELEGRAPH') {
      this.orbitAngle += dt * 15;
      if (this.timer <= 0) {
        this.aiState = 'CHARGE';
        this.timer = 1.5;
        this.chargeDir = new Vector2(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
      }
    } else if (this.aiState === 'CHARGE') {
      this.vel = this.chargeDir.mult(this.speed * 2.5);
      if (this.timer <= 0) {
        this.aiState = 'ORBIT';
        this.timer = Math.random() * 3 + 2;
      }
    }
    Entity.prototype.update.call(this, dt);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.orbitAngle);
    ctx.strokeStyle = this.aiState === 'TELEGRAPH' && Date.now() % 100 < 50 ? '#fff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 10);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -10);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#aa2222';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.restore();
  }
}

class SniperEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.color = '#ffff00';
    this.speed = 80;
    this.health = 2;
    this.points = 150;
    this.orbitRadius = 350 + Math.random() * 50;
    this.aiState = 'POSITION';
    this.timer = 3.0;
  }
  update(dt, game) {
    if (!game.player || !game.player.active) { super.update(dt, game); return; }
    const center = new Vector2(game.width / 2, game.height / 2);
    this.timer -= dt;

    if (this.aiState === 'POSITION') {
      this.orbitAngle += dt * 0.3;
      const targetX = center.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      const targetY = center.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      const dirOrbit = new Vector2(targetX - this.pos.x, targetY - this.pos.y).normalize();
      this.vel = dirOrbit.mult(this.speed);
      if (this.timer <= 0) {
        this.aiState = 'AIM';
        this.timer = 1.0;
        this.vel = new Vector2(0, 0);
      }
    } else if (this.aiState === 'AIM') {
      if (this.timer <= 0) {
        this.aiState = 'FIRE';
        this.timer = 0.5;
      }
    } else if (this.aiState === 'FIRE') {
      if (this.timer <= 0) {
        const dir = new Vector2(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
        game.enemyProjectiles.push(new EnemyProjectile(this.pos, dir.mult(300)));
        this.aiState = 'POSITION';
        this.timer = 3.0 + Math.random() * 2;
      }
    }
    Entity.prototype.update.call(this, dt);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    if (this.aiState === 'AIM') {
      ctx.strokeStyle = Date.now() % 200 < 100 ? '#ff0000' : '#ffff00';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -this.orbitRadius * 2); // Visual laser line
      ctx.stroke();
    } else {
      ctx.strokeStyle = this.color;
    }
    ctx.rotate(this.orbitAngle);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(10, 0);
    ctx.lineTo(0, 15);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#aa2222';
    ctx.fillRect(-3, -3, 6, 6);
    ctx.restore();
  }
}

class ShieldedBruiserEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.color = '#00ffff';
    this.speed = 50;
    this.health = 5;
    this.points = 200;
    this.orbitRadius = 250;
    this.shieldAngle = 0;
  }
  update(dt, game) {
    if (!game.player || !game.player.active) { super.update(dt, game); return; }
    this.shieldAngle += dt * 2;
    const dirToPlayer = new Vector2(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
    this.vel = dirToPlayer.mult(this.speed);
    Entity.prototype.update.call(this, dt);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.shieldAngle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i=0; i<6; i++) {
      const angle = (Math.PI * 2 / 6) * i;
      const px = Math.cos(angle) * 18;
      const py = Math.sin(angle) * 18;
      if (i===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#22aaaa';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
}

class SplitterEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.color = '#aa00ff';
    this.speed = 90;
    this.health = 2;
    this.points = 120;
    this.orbitRadius = 200 + Math.random() * 50;
    this.wobble = 0;
  }
  update(dt, game) {
    this.wobble += dt * 10;
    super.update(dt, game);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    if (this.health === 1) {
      ctx.translate(Math.sin(this.wobble)*2, Math.cos(this.wobble)*2);
    }
    ctx.rotate(this.orbitAngle);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -6, 10, 12);
    ctx.strokeRect(2, -6, 10, 12);
    ctx.restore();
  }
  hit(game) {
    this.health--;
    game.sound.playHit();
    if (this.health <= 0) {
      this.active = false;
      game.score += this.points;
      game.sound.playExplosion();
      game.spawnParticles(this.pos.x, this.pos.y, 10, this.color);
      game.enemies.push(new SwarmerEnemy(this.pos.x - 15, this.pos.y));
      game.enemies.push(new SwarmerEnemy(this.pos.x + 15, this.pos.y));
    }
  }
}

class HazardDeployerEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.color = '#ff8800';
    this.speed = 100;
    this.health = 3;
    this.points = 250;
    this.orbitRadius = 280;
    this.timer = 5.0;
    this.aiState = 'MOVE';
    this.zigzagTimer = 0;
    this.zigzagDir = 1;
  }
  update(dt, game) {
    const center = new Vector2(game.width / 2, game.height / 2);
    this.timer -= dt;
    this.zigzagTimer -= dt;

    if (this.zigzagTimer <= 0) {
      this.zigzagDir *= -1;
      this.zigzagTimer = 1.5;
    }

    if (this.aiState === 'MOVE') {
      this.orbitAngle += dt * 0.2 * this.zigzagDir;
      const targetX = center.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      const targetY = center.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      const dirOrbit = new Vector2(targetX - this.pos.x, targetY - this.pos.y).normalize();
      this.vel = dirOrbit.mult(this.speed);
      if (this.timer <= 0) {
        this.aiState = 'DEPLOY';
        this.timer = 1.5;
        this.vel = new Vector2(0, 0);
      }
    } else if (this.aiState === 'DEPLOY') {
      if (this.timer <= 0) {
        game.enemyProjectiles.push(new AreaDenialHazard(this.pos.x, this.pos.y));
        this.aiState = 'MOVE';
        this.timer = 5.0;
      }
    }
    Entity.prototype.update.call(this, dt);
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.orbitAngle);
    ctx.strokeStyle = this.aiState === 'DEPLOY' && Date.now() % 200 < 100 ? '#ffffff' : this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for(let i=0; i<8; i++) {
      const angle = (Math.PI * 2 / 8) * i;
      const dist = this.aiState === 'DEPLOY' ? 18 : 12;
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      if (i===0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#cc5500';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}
