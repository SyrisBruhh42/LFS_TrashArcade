class UpgradeManager {
  constructor() {
    this.perkPool = [
      { id: 'dmg_up', name: 'Abyssal Payload', desc: '+25% Damage on hit', type: 'stat' },
      { id: 'spd_up', name: 'Hydrodynamic', desc: '+15% Base Speed', type: 'stat' },
      { id: 'dash_cd', name: 'Quick Thrusters', desc: '-15% Dash Cooldown', type: 'stat' },
      { id: 'radius_up', name: 'Dense Core', desc: '+10% Player Radius', type: 'stat' },
      { id: 'combo_time', name: 'Lingering Momentum', desc: '+25% Combo Window', type: 'stat' },
      { id: 'bounce_dmg', name: 'Kinetic Rebound', desc: '+10% Damage per bounce', type: 'stat' },
      { id: 'heal_pickup', name: 'Biomass Extractor', desc: 'Enemies drop health pickups', type: 'utility' },
      { id: 'arena_slow', name: 'Tectonic Stabilizer', desc: 'Arena shrinks 20% slower', type: 'utility' }
    ];
    this.activePerks = [];
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.maxComboTimer = 3.0; // 3 seconds before combo drops
    this.draftChoices = [];
    this.pickups = [];
  }

  update(dt, player, arena, engine) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.resetCombo();
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      let p = this.pickups[i];
      p.life -= dt;

      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < player.radius + p.radius) {
        this.collectPickup(p, player, engine);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        this.pickups.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const p of this.pickups) {
      ctx.fillStyle = p.type === 'health' ? '#4caf50' : '#ffeb3b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (1 + 0.2 * Math.sin(p.life * 10)), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  addCombo() {
    this.comboCount++;
    if (window.engine && window.engine.uiManager) window.engine.uiManager.checkMilestone('combo_master', this.comboCount);
    this.comboMultiplier = 1.0 + (this.comboCount * 0.1);

    // Apply Lingering Momentum perk if active
    let maxTime = this.maxComboTimer;
    if (this.hasPerk('combo_time')) maxTime *= 1.25;

    this.comboTimer = maxTime;
  }

  resetCombo() {
    this.comboCount = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
  }

  spawnPickup(x, y, type) {
    this.pickups.push({
      x: x, y: y,
      type: type,
      radius: 8,
      life: 10.0
    });
  }

  collectPickup(pickup, player, engine) {
    if (pickup.type === 'health') {
        engine.arena.width = Math.min(engine.arena.maxWidth, engine.arena.width + 25);
        engine.arena.height = Math.min(engine.arena.maxHeight, engine.arena.height + 25);
        if (engine.audio) engine.audio.playPickupHealth();
    } else if (pickup.type === 'score') {
        engine.score += 50 * this.comboMultiplier;
        if (engine.audio) engine.audio.playPickupScore();
    }
  }

  hasPerk(id) {
    return this.activePerks.some(p => p.id === id);
  }

  getPerkCount(id) {
      return this.activePerks.filter(p => p.id === id).length;
  }

  generateDraft() {
    let pool = [...this.perkPool];
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.draftChoices = pool.slice(0, 3);
    return this.draftChoices;
  }

  applyPerk(perkId, player, engine) {
    const perk = this.perkPool.find(p => p.id === perkId);
    if (perk) {
      this.activePerks.push(perk);

      // Apply immediate stat changes if any
      if (perkId === 'spd_up') {
          player.speed *= 1.15;
      } else if (perkId === 'dash_cd') {
          player.maxDashCooldown *= 0.85;
      } else if (perkId === 'radius_up') {
          player.radius *= 1.10;
      } else if (perkId === 'arena_slow') {
          engine.arena.shrinkRate *= 0.8;
      }
    }
  }
}
