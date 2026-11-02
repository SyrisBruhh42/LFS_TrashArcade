class ProgressionManager {
  constructor(game) {
    this.game = game;
    this.coins = this.game.saveManager.data.coins || 0;
    this.upgrades = this.game.saveManager.data.upgrades || {
      springCleats: 0,
      curveGlove: 0,
      powerGauge: 0,
      mascotBuff: 0
    };

    this.shopItems = [
      { id: 'springCleats', name: 'Spring Cleats', desc: 'Increases Jump Height.', cost: 50, maxLevel: 3 },
      { id: 'curveGlove', name: 'Curve-Spin Glove', desc: 'Increases mid-flight adjust/speed.', cost: 50, maxLevel: 3 },
      { id: 'powerGauge', name: 'Power-Kick Gauge', desc: 'More powerful smashes.', cost: 75, maxLevel: 3 },
      { id: 'mascotBuff', name: 'Mascot Buffs', desc: 'Generates passive Overdrive.', cost: 100, maxLevel: 3 }
    ];

    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.multiplier = 1;

    this.activePickup = null;
    this.pickupTimer = 0;

    this.initUI();
  }

  initUI() {
    const btnShop = document.getElementById('btn-shop');
    if (btnShop) {
        btnShop.addEventListener('click', () => {
            this.openShop();
        });
    }

    const btnShopContinue = document.getElementById('btn-shop-continue');
    if (btnShopContinue) {
        btnShopContinue.addEventListener('click', () => {
            this.game.startMatch();
        });
    }
  }

  save() {
    this.game.saveManager.data.coins = this.coins;
    this.game.saveManager.data.upgrades = this.upgrades;
    this.game.saveManager.save();
  }

  openShop() {
    this.game.showScreen('shop-screen');
    document.getElementById('shop-coins').textContent = this.coins;

    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';

    this.shopItems.forEach(item => {
      const level = this.upgrades[item.id];
      const cost = item.cost + (level * 25);

      const div = document.createElement('div');
      div.className = 'panel';
      div.innerHTML = `
        <h3>${item.name} (Lv ${level}/${item.maxLevel})</h3>
        <p>${item.desc}</p>
        <p>Cost: ${cost} Coins</p>
        <button type="button" ${level >= item.maxLevel || this.coins < cost ? 'disabled' : ''}>Upgrade</button>
      `;

      const btn = div.querySelector('button');
      btn.addEventListener('click', () => {
        if (this.coins >= cost && level < item.maxLevel) {
          this.coins -= cost;
          this.upgrades[item.id]++;
          this.save();
          this.openShop();
          this.game.audio.playPowerup();
        }
      });

      container.appendChild(div);
    });
  }

  applyUpgrades(player) {
    if (player.isBot) return;

    const u = this.upgrades;
    player.jumpForce -= u.springCleats * 50;
    player.speed += u.curveGlove * 30;
  }

  spawnPickup() {
    this.activePickup = {
      x: Math.random() * (this.game.width - 200) + 100,
      y: Math.random() * (this.game.height - 300) + 100,
      radius: 20,
      type: 'coinBonus'
    };
  }

  registerHit() {
    this.combo++;
    this.comboTimer = 3.0; // 3 seconds to keep combo
    this.multiplier = 1 + Math.min(this.combo * 0.1, 2.0); // max 3x multiplier
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
  }

  resetCombo() {
    this.combo = 0;
    this.multiplier = 1.0;
  }

  update(dt, ball, p1) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }

    if (this.upgrades.mascotBuff > 0 && p1) {
      p1.overdrive += dt * this.upgrades.mascotBuff * 2;
    }

    if (!this.activePickup) {
      this.pickupTimer -= dt;
      if (this.pickupTimer <= 0) {
        this.spawnPickup();
        this.pickupTimer = 10;
      }
    } else {
      // Check collision with ball
      const dx = ball.x - this.activePickup.x;
      const dy = ball.y - this.activePickup.y;
      if (dx*dx + dy*dy < (ball.radius + this.activePickup.radius)**2) {
        this.coins += 10 * Math.floor(this.multiplier);
        this.game.audio.playPowerup();
        this.activePickup = null;
        this.save();
      }
    }
  }

  draw(ctx) {
    // Draw combo
    if (this.combo > 1) {
      ctx.fillStyle = '#ff4081';
      ctx.font = '24px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`Combo: ${this.combo}x`, this.game.width - 20, 40);
      ctx.fillStyle = '#00e5ff';
      ctx.fillText(`Multiplier: ${this.multiplier.toFixed(1)}x`, this.game.width - 20, 70);
    }

    if (this.activePickup) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(this.activePickup.x, this.activePickup.y, this.activePickup.radius, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', this.activePickup.x, this.activePickup.y);
    }
  }

  addCoins(amount) {
    this.coins += amount * Math.floor(this.multiplier);
    this.save();
  }
}
