class BaseBoss {
  constructor(x, y) {
    this.pos = new Vector2(x, y);
    this.radius = 40;
    this.maxHp = 500;
    this.hp = this.maxHp;
    this.color = '#fff';
    this.phase = 1;
    this.active = true;
    this.scoreValue = 500;
    this.time = 0;
  }
  takeDamage(amt) {
    this.hp -= amt;
    if (this.hp <= this.maxHp / 2 && this.phase === 1) {
      this.phase = 2;
      this.onPhaseChange();
    }
    if (this.hp <= 0) {
      this.active = false;
    }
  }
  onPhaseChange() {}
  update(dt, game) {
    this.time += dt;
  }
  draw(ctx) {}
  drawHpBar(ctx, width, height) {
    let barWidth = width * 0.6;
    let barHeight = 20;
    let x = (width - barWidth) / 2;
    let y = height - 50;
    ctx.fillStyle = '#333';
    ctx.fillRect(x, y, barWidth, barHeight);
    let hpPct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = this.phase === 1 ? '#4caf50' : '#f44336';
    ctx.fillRect(x, y, barWidth * hpPct, barHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x, y, barWidth, barHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    let name = this.constructor.name === 'OvergrownColossus' ? 'OVERGROWN COLOSSUS' : 'RUINS GUARDIAN';
    ctx.fillText(`${name} - PHASE ${this.phase}`, width / 2, y - 10);
  }
}
class OvergrownColossus extends BaseBoss {
  constructor(x, y) {
    super(x, y);
    this.color = '#388e3c';
    this.shootTimer = 2;
    this.orbitAngle = 0;
  }
  onPhaseChange() {
    this.color = '#d32f2f'; // enrages
  }
  update(dt, game) {
    super.update(dt, game);
    let center = new Vector2(game.canvas.width / 2, game.canvas.height / 2);
    let dirToCenter = center.copy().sub(this.pos);
    if (dirToCenter.mag() > 10) {
      this.pos.add(dirToCenter.normalize().mult(30 * dt));
    }
    this.shootTimer -= dt;
    if (this.phase === 1) {
      if (this.shootTimer <= 0) {
        let dirToPlayer = game.player.pos.copy().sub(this.pos).normalize();
        for (let i = -1; i <= 1; i++) {
          let angle = Math.atan2(dirToPlayer.y, dirToPlayer.x) + (i * 0.2);
          let pDir = new Vector2(Math.cos(angle), Math.sin(angle));
          game.enemyProjectiles.push(new EnemyProjectile(this.pos.x, this.pos.y, pDir, 150, 6, '#ffeb3b'));
        }
        this.shootTimer = 1.5;
        game.sound.playShoot();
      }
    } else {
      let pDir = game.player.pos.copy().sub(this.pos);
      let pDist = pDir.mag();
      if (pDist > 50) {
        game.player.pos.sub(pDir.normalize().mult(60 * dt));
      }
      if (this.shootTimer <= 0) {
        for(let i=0; i<4; i++) {
          let a = this.orbitAngle + (i * Math.PI / 2);
          let d = new Vector2(Math.cos(a), Math.sin(a));
          game.enemyProjectiles.push(new EnemyProjectile(this.pos.x, this.pos.y, d, 200, 8, '#ff5722'));
        }
        this.orbitAngle += 0.3;
        this.shootTimer = 0.4;
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.time);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.strokeRect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
    ctx.fillStyle = this.phase === 1 ? '#8bc34a' : '#ffeb3b';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
class RuinsGuardian extends BaseBoss {
  constructor(x, y) {
    super(x, y);
    this.color = '#795548';
    this.stateTimer = 0;
    this.targetPos = new Vector2(x, y);
    this.spawnMinionsTimer = 5;
  }
  onPhaseChange() {
    this.color = '#512da8';
    this.spawnMinionsTimer = 2; // spawn faster
  }
  update(dt, game) {
    super.update(dt, game);
    this.stateTimer -= dt;
    this.spawnMinionsTimer -= dt;
    if (this.stateTimer <= 0) {
      let cx = game.canvas.width / 2;
      let cy = game.canvas.height / 2;
      this.targetPos = new Vector2(cx + (Math.random() * 400 - 200), cy + (Math.random() * 400 - 200));
      this.stateTimer = 4;
      for(let i=0; i<8; i++) {
        let a = (i / 8) * Math.PI * 2;
        let d = new Vector2(Math.cos(a), Math.sin(a));
        game.enemyProjectiles.push(new EnemyProjectile(this.pos.x, this.pos.y, d, 100, 5, '#00bcd4'));
      }
    }
    let dir = this.targetPos.copy().sub(this.pos);
    if (dir.mag() > 5) {
      this.pos.add(dir.normalize().mult(100 * dt));
    }
    if (this.phase === 1) {
      if (this.spawnMinionsTimer <= 0) {
        game.enemies.push(new SwarmerEnemy(this.pos.x, this.pos.y));
        this.spawnMinionsTimer = 4;
      }
    } else {
      let pDir = game.player.pos.copy().sub(this.pos);
      if (pDir.mag() < 400) {
         game.player.pos.add(pDir.normalize().mult(80 * dt));
      }
      if (this.spawnMinionsTimer <= 0) {
        game.enemies.push(new SniperEnemy(this.pos.x, this.pos.y));
        this.spawnMinionsTimer = 5;
      }
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    let scale = 1 + Math.sin(this.time * 5) * 0.1;
    ctx.scale(scale, scale);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = this.phase === 1 ? '#00bcd4' : '#ffeb3b';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
  }
}
