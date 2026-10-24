class UpgradeManager {
  constructor(game) {
    this.game = game;
    this.pool = [
      { name: "Max Health Up", desc: "+1 Max HP & Heal", apply: (p) => { p.maxHealth++; p.health++; } },
      { name: "Cooldown Reduction", desc: "-15% Dash Cooldown", apply: (p) => { p.dashCooldown *= 0.85; } },
      { name: "Recoil Boost", desc: "+25% Recoil Force", apply: (p) => { p.recoilForce *= 1.25; } },
      { name: "Thrust Boost", desc: "+25% Dash Force", apply: (p) => { p.dashForce *= 1.25; } },
      { name: "Rapid Fire", desc: "-15% Shoot Delay", apply: (p) => { p.shootDelay *= 0.85; } },
      { name: "Magnetic Aura", desc: "Gain Magnet Range", apply: (p) => { p.magnetRange = (p.magnetRange || 100) + 100; } },
      { name: "Combo Master", desc: "+1s Combo Window", apply: (p) => { p.comboWindow = (p.comboWindow || 2.0) + 1.0; } },
      { name: "Double Shot", desc: "Shoot 2 Projectiles", apply: (p) => { p.doubleShot = true; } }
    ];
    this.draftOptions = [];
  }
  startDraft() {
    this.game.state = 'DRAFT';
    let shuffled = [...this.pool].sort(() => 0.5 - Math.random());
    this.draftOptions = shuffled.slice(0, 3);
    this.game.input.mouse.down = false;
    this.game.input.mouse.clicked = false;
  }
  applyUpgrade(idx) {
    this.draftOptions[idx].apply(this.game.player);
    this.game.state = 'PLAYING';
    this.game.wave = Math.floor(this.game.score / 1000) + 1;
    this.game.lastBossWave = this.game.wave;
  }
  draw(ctx, width, height) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#b48ff0';
    ctx.textAlign = 'center';
    ctx.font = '40px sans-serif';
    ctx.fillText("WAVE CLEARED!", width / 2, height / 2 - 150);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText("Choose an Upgrade:", width / 2, height / 2 - 100);
    const boxWidth = 200, boxHeight = 120, spacing = 40;
    const startX = width / 2 - (3 * boxWidth + 2 * spacing) / 2;
    const startY = height / 2 - 50;
    for (let i = 0; i < 3; i++) {
      const opt = this.draftOptions[i];
      const bx = startX + i * (boxWidth + spacing);
      const mx = this.game.input.mouse.x, my = this.game.input.mouse.y;
      const hovered = mx > bx && mx < bx + boxWidth && my > startY && my < startY + boxHeight;
      ctx.fillStyle = hovered ? '#2a2a35' : '#151518';
      ctx.fillRect(bx, startY, boxWidth, boxHeight);
      ctx.strokeStyle = hovered ? '#b48ff0' : '#444';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, startY, boxWidth, boxHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText(opt.name, bx + boxWidth / 2, startY + 40);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText(opt.desc, bx + boxWidth / 2, startY + 80);
    }
  }
  handleInput(input, width, height) {
    if (input.consumeAnyInput()) {
       const boxWidth = 200, boxHeight = 120, spacing = 40;
       const startX = width / 2 - (3 * boxWidth + 2 * spacing) / 2;
       const startY = height / 2 - 50;
       const mx = input.mouse.x, my = input.mouse.y;
       for (let i = 0; i < 3; i++) {
         const bx = startX + i * (boxWidth + spacing);
         if (mx > bx && mx < bx + boxWidth && my > startY && my < startY + boxHeight) {
           this.applyUpgrade(i);
           input.anyKeyOrClick = false;
           input.mouse.clicked = false;
           input.mouse.down = false;
           break;
         }
       }
    }
  }
}

// Additional logic for generating more advanced perks
class AdvancedPerkGenerator {
  constructor(pool) {
    this.pool = pool;
    this.rarities = ['common', 'rare', 'legendary'];
  }

  generateSynergyPerks() {
    return [
      {
        name: "Orbital Striker",
        desc: "Increases dash force based on combo",
        apply: (p) => {
          if (!p.game) return;
          p.dashForce *= (1 + p.game.comboCount * 0.05);
        }
      },
      {
        name: "Scrap Harvester",
        desc: "Heal slowly over time based on combo",
        apply: (p) => {
           p.passiveHeal = true;
           p.healTimer = 5.0;
        }
      },
      {
        name: "Nuclear Core",
        desc: "Massive recoil, massive damage",
        apply: (p) => {
           p.recoilForce *= 2.0;
           p.damageMultiplier = (p.damageMultiplier || 1) * 2;
        }
      },
      {
        name: "Magnetic Repulsor",
        desc: "Push enemies away slightly when dashing",
        apply: (p) => {
           p.repulsorDash = true;
        }
      }
    ];
  }

  injectAdvancedPerks() {
    const newPerks = this.generateSynergyPerks();
    for (const perk of newPerks) {
      this.pool.push(perk);
    }
    console.log("Advanced perks injected into the Upgrade Pool.");
  }
}
