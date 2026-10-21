
class ComboManager {
  constructor(engine) {
    this.engine = engine;
    this.hits = 0;
    this.multiplier = 1;
    this.decayTimer = 0;
    this.maxDecayTime = 3.0; // Seconds before combo resets
  }

  addHit() {
    this.hits++;
    // Multiplier increases every 5 hits, max 10x
    this.multiplier = Math.min(10, 1 + Math.floor(this.hits / 5));
    // Slower decay at higher multipliers, or just refresh
    this.decayTimer = this.maxDecayTime;
  }

  update(dt) {
    if (this.hits > 0) {
      this.decayTimer -= dt;
      if (this.decayTimer <= 0) {
        this.reset();
      }
    }
  }

  reset() {
    this.hits = 0;
    this.multiplier = 1;
    this.decayTimer = 0;
  }

  draw(ctx, width, height) {
    if (this.hits > 0) {
      // Draw Combo text
      ctx.fillStyle = this.multiplier >= 10 ? '#f2a65a' : '#d8b0e2';
      ctx.textAlign = 'right';
      ctx.font = '24px monospace';
      ctx.fillText(`Combo x${this.multiplier}`, width - 20, 40);

      ctx.font = '16px monospace';
      ctx.fillText(`${this.hits} Hits`, width - 20, 60);

      // Draw Decay Bar
      const barWidth = 100;
      const barHeight = 6;
      const fillWidth = barWidth * (Math.max(0, this.decayTimer) / this.maxDecayTime);

      ctx.fillStyle = '#333';
      ctx.fillRect(width - 20 - barWidth, 70, barWidth, barHeight);
      ctx.fillStyle = this.decayTimer > 1 ? '#44aacc' : '#e26b6b';
      ctx.fillRect(width - 20 - barWidth, 70, fillWidth, barHeight);
    }
  }
}


class Pickup {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.r = 8;
    this.type = type; // 'SCORE', 'COMBO', 'OVERDRIVE'
    this.vx = (Math.random() - 0.5) * 100;
    this.vy = (Math.random() - 0.5) * 100 - 50;
    this.life = 10;
  }

  update(dt, player) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.vy += 200 * dt; // gravity

    // Bounce off floor/walls if needed, or simple bounds
    if (this.x < 10) { this.x = 10; this.vx *= -0.8; }
    if (this.x > 790) { this.x = 790; this.vx *= -0.8; }
    if (this.y > 590) { this.y = 590; this.vy *= -0.8; }

    // Magnetism towards player if close
    const magnetRange = player.pickupRange || 100;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distSq = dx*dx + dy*dy;

    if (distSq < magnetRange * magnetRange) {
      const dist = Math.sqrt(distSq);
      this.vx += (dx / dist) * 500 * dt;
      this.vy += (dy / dist) * 500 * dt;
    }
  }

  draw(ctx) {
    if (this.life < 2 && Math.floor(Date.now() / 100) % 2 === 0) return;

    ctx.fillStyle = this.type === 'SCORE' ? '#f2a65a' :
                    this.type === 'COMBO' ? '#d8b0e2' : '#44aacc';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

class PickupManager {
  constructor(engine) {
    this.engine = engine;
    this.pickups = [];
  }

  spawn(x, y) {
    const rand = Math.random();
    let type = 'SCORE';
    if (rand < 0.2) type = 'COMBO';
    else if (rand < 0.3) type = 'OVERDRIVE';

    this.pickups.push(new Pickup(x, y, type));
  }

  update(dt, player, comboManager) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.update(dt, player);

      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (dx*dx + dy*dy < (player.r + p.r) * (player.r + p.r)) {
        this.collect(p, comboManager);
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.life <= 0) {
        this.pickups.splice(i, 1);
      }
    }
  }

  collect(p, comboManager) {
    this.engine.sound.playHit(); // re-use sound for collect
    if (p.type === 'SCORE') {
      this.engine.score += 20 * comboManager.multiplier;
    } else if (p.type === 'COMBO') {
      comboManager.addHit();
    } else if (p.type === 'OVERDRIVE') {
      this.engine.player.overdriveTimer -= 1;
      if (this.engine.player.overdriveTimer < 0) this.engine.player.overdriveTimer = 0;
    }
  }

  draw(ctx) {
    for (const p of this.pickups) {
      p.draw(ctx);
    }
  }
}


const PERK_POOL = [
  { id: 'drill_damage', name: 'Titanium Drill', desc: 'Increases drill damage', apply: (p) => { p.drillDamage = (p.drillDamage || 1) + 1; } },
  { id: 'recoil_boost', name: 'Heavy Recoil', desc: 'Increases recoil force for faster movement', apply: (p) => { p.recoilMultiplier = (p.recoilMultiplier || 1) + 0.3; } },
  { id: 'overdrive_cd', name: 'Coolant Flush', desc: 'Reduces Overdrive cooldown', apply: (p) => { p.overdriveCooldown = Math.max(0.5, (p.overdriveCooldown || 3) - 0.5); } },
  { id: 'pickup_magnet', name: 'Electromagnet', desc: 'Increases pickup collection range', apply: (p) => { p.pickupRange = (p.pickupRange || 100) + 50; } },
  { id: 'invuln_time', name: 'Thick Hull', desc: 'Longer invulnerability after Overdrive', apply: (p) => { p.invulnBonus = (p.invulnBonus || 0) + 0.3; } },
  { id: 'combo_decay', name: 'Momentum', desc: 'Combo multiplier decays slower', apply: (p, cm) => { cm.maxDecayTime += 1.0; } },
  { id: 'gravity_res', name: 'Anti-Grav', desc: 'Reduces falling gravity', apply: (p) => { p.gravityMod = (p.gravityMod || 1) * 0.8; } },
  { id: 'drill_range', name: 'Extended Drill', desc: 'Increases drill hitbox range', apply: (p) => { p.drillRangeBonus = (p.drillRangeBonus || 0) + 10; } },
];

class UpgradeManager {
  constructor(engine) {
    this.engine = engine;
    this.activePerks = [];
    this.draftChoices = [];
  }

  startDraft() {
    this.engine.state = 'UPGRADE_DRAFT';
    this.draftChoices = [];
    const pool = [...PERK_POOL];
    for (let i = 0; i < 3; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      this.draftChoices.push(pool.splice(idx, 1)[0]);
    }
  }

  selectPerk(index) {
    if (index >= 0 && index < this.draftChoices.length) {
      const perk = this.draftChoices[index];
      this.activePerks.push(perk);
      perk.apply(this.engine.player, this.engine.comboManager);

      this.draftChoices = [];
      this.engine.state = 'PLAYING';
      // Restart boss timer / next wave logic handled in game.js
      this.engine.bossWarningTimer = 15;
      this.engine.nextBossScore = this.engine.score + 1000;
    }
  }

  draw(ctx, width, height) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '30px monospace';
    ctx.fillText('WAVE CLEARED!', width / 2, height / 2 - 150);
    ctx.font = '20px monospace';
    ctx.fillText('Select an Upgrade:', width / 2, height / 2 - 100);

    const cardWidth = 200;
    const cardHeight = 120;
    const spacing = 40;
    const startX = width / 2 - (cardWidth * 1.5 + spacing);

    for (let i = 0; i < this.draftChoices.length; i++) {
      const perk = this.draftChoices[i];
      const x = startX + i * (cardWidth + spacing);
      const y = height / 2 - 40;

      ctx.fillStyle = '#223344';
      ctx.fillRect(x, y, cardWidth, cardHeight);
      ctx.strokeStyle = '#44aacc';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, cardWidth, cardHeight);

      ctx.fillStyle = '#f2a65a';
      ctx.font = '16px monospace';
      ctx.fillText(perk.name, x + cardWidth / 2, y + 30);

      ctx.fillStyle = '#aaa';
      ctx.font = '12px monospace';
      this.wrapText(ctx, perk.desc, x + cardWidth / 2, y + 60, cardWidth - 20, 16);

      ctx.fillStyle = '#fff';
      ctx.fillText(`Press [${i+1}] or Click`, x + cardWidth / 2, y + cardHeight - 15);
    }
  }

  wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      }
      else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  }

  handleInput(input) {
    // Keyboard input for draft
    if (input.isDown('Digit1')) this.selectPerk(0);
    if (input.isDown('Digit2')) this.selectPerk(1);
    if (input.isDown('Digit3')) this.selectPerk(2);
  }

  handleMouse(e, input, width, height) {
    if (!input.mouse.down) return;

    const cardWidth = 200;
    const cardHeight = 120;
    const spacing = 40;
    const startX = width / 2 - (cardWidth * 1.5 + spacing);
    const y = height / 2 - 40;

    for (let i = 0; i < this.draftChoices.length; i++) {
      const x = startX + i * (cardWidth + spacing);
      if (input.mouse.x > x && input.mouse.x < x + cardWidth &&
          input.mouse.y > y && input.mouse.y < y + cardHeight) {
          this.selectPerk(i);
          input.mouse.down = false; // debounce
          break;
      }
    }
  }
}
