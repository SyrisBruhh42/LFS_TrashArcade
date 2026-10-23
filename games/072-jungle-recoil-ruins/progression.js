class UpgradeManager {
  constructor() {
    this.upgrades = [];
    this.availableUpgrades = [
      { id: 'spread', name: 'Spread Shot', desc: 'Fires 3 projectiles in a cone.' },
      { id: 'pierce', name: 'Piercing Rounds', desc: 'Projectiles pierce through enemies.' },
      { id: 'fireRate', name: 'Rapid Fire', desc: 'Increases firing rate.' },
      { id: 'speed', name: 'Lightweight', desc: 'Increases player movement speed.' },
      { id: 'damage', name: 'High Caliber', desc: 'Increases projectile damage.' },
      { id: 'recoil', name: 'Heavy Recoil', desc: 'Increases recoil distance per shot.' },
      { id: 'shield', name: 'Energy Shield', desc: 'Blocks one instance of damage.' },
      { id: 'combo', name: 'Combo Master', desc: 'Combo multiplier decays slower.' },
      { id: 'magnet', name: 'Pickup Magnet', desc: 'Increases pickup collection radius.' }
    ];
    this.activeUpgrades = {};
  }

  getDraftChoices() {
    let pool = [...this.availableUpgrades];
    let choices = [];
    for (let i = 0; i < 3; i++) {
      if (pool.length === 0) break;
      let idx = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(idx, 1)[0]);
    }
    return choices;
  }

  applyUpgrade(id) {
    this.activeUpgrades[id] = (this.activeUpgrades[id] || 0) + 1;
    this.upgrades.push(id);
  }

  hasUpgrade(id) {
    return this.activeUpgrades[id] > 0;
  }

  getUpgradeLevel(id) {
    return this.activeUpgrades[id] || 0;
  }
}

class ComboManager {
  constructor() {
    this.combo = 1;
    this.comboTimer = 0;
    this.comboMaxTimer = 3;
    this.comboKills = 0;
  }

  update(dt, upgradeManager) {
    if (this.combo > 1) {
      let decayRate = upgradeManager && upgradeManager.hasUpgrade('combo') ? 0.5 : 1;
      this.comboTimer -= dt * decayRate;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.comboKills = 0;
      }
    }
  }

  addScore(baseScore) {
    return baseScore * this.combo;
  }

  onKill() {
    this.comboKills++;
    if (this.comboKills >= 5) {
      this.combo++;
      this.comboKills = 0;
    }
    this.comboTimer = this.comboMaxTimer;
  }

  draw(ctx, width) {
    if (this.combo > 1) {
      ctx.fillStyle = '#ff9800';
      ctx.font = '24px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Combo x${this.combo}`, width - 20, 30);

      let barWidth = 100;
      let barHeight = 10;
      let x = width - 20 - barWidth;
      let y = 40;
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, barWidth, barHeight);

      let pct = Math.max(0, this.comboTimer / this.comboMaxTimer);
      ctx.fillStyle = '#ff9800';
      ctx.fillRect(x, y, barWidth * pct, barHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(x, y, barWidth, barHeight);
    }
  }
}

class PickupManager {
  constructor() {
    this.pickups = [];
  }

  spawnPickup(x, y) {
    if (Math.random() < 0.3) {
      this.pickups.push({
        pos: new Vector2(x, y),
        radius: 6,
        type: Math.random() < 0.2 ? 'shield' : 'score',
        active: true,
        life: 10
      });
    }
  }

  update(dt, game) {
    let magnetRadius = game.upgradeManager && game.upgradeManager.hasUpgrade('magnet') ? 150 : 50;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      let p = this.pickups[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.pickups.splice(i, 1);
        continue;
      }

      let dir = game.player.pos.copy().sub(p.pos);
      let dist = dir.mag();
      if (dist < magnetRadius) {
        if (dist > 0) dir.normalize();
        p.pos.add(dir.mult(200 * dt));
      }

      if (dist < p.radius + game.player.radius) {
        if (p.type === 'score') {
          game.score += game.comboManager.addScore(50);
          game.sound.playTone(400, 'sine', 0.1);
        } else if (p.type === 'shield') {
          if (!game.player.hasShield) {
            game.player.hasShield = true;
            game.sound.playTone(600, 'square', 0.1);
          } else {
             game.score += game.comboManager.addScore(100);
             game.sound.playTone(400, 'sine', 0.1);
          }
        }
        p.active = false;
        this.pickups.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (let p of this.pickups) {
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.type === 'shield' ? '#00bcd4' : '#ffeb3b';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}
