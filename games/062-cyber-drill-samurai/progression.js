class Pickup {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 10;
    this.active = true;
    const types = ['heal', 'tether', 'score'];
    this.type = types[Math.floor(Math.random() * types.length)];
    this.color = this.type === 'heal' ? '#f14668' : (this.type === 'tether' ? '#a0efb8' : '#eebb00');
    this.life = 10;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
  draw(ctx, cameraY) {
    ctx.beginPath();
    ctx.arc(this.x, this.y - cameraY, this.r, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }
}
class UpgradeManager {
  constructor(game) {
    this.game = game;
    this.draft = [];
    this.pool = [
      { name: "Max HP Up", desc: "+20 Max HP", apply: (g) => { g.player.maxHp = (g.player.maxHp || 100) + 20; g.player.hp += 20; } },
      { name: "Dash Cooldown", desc: "Dash CD -20%", apply: (g) => { g.player.dashCooldown *= 0.8; } },
      { name: "Drill Damage", desc: "Blocks Break Faster", apply: (g) => { g.player.drillDamage = (g.player.drillDamage || 1) + 1; } },
      { name: "Tether Capacity", desc: "+10 Tether Max Length", apply: (g) => { g.maxTetherLength += 10; } },
      { name: "Combo Time", desc: "Max Combo Time +2s", apply: (g) => { g.comboMaxTimer += 2; } },
      { name: "Pickup Radius", desc: "Larger Pickup Range", apply: (g) => { g.player.pickupRadius = (g.player.pickupRadius || 0) + 30; } },
      { name: "Shockwave Range", desc: "Shockwave Radius +100", apply: (g) => { g.shockwaveRadiusMax = (g.shockwaveRadiusMax || 400) + 100; } },
      { name: "Speed Boost", desc: "Move Speed +10%", apply: (g) => { g.player.speed *= 1.1; } }
    ];
  }
  generateDraft() {
    let available = [...this.pool];
    this.draft = [];
    for(let i=0; i<3; i++) {
        if(available.length === 0) break;
        let idx = Math.floor(Math.random() * available.length);
        this.draft.push(available.splice(idx, 1)[0]);
    }
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, this.game.width, this.game.height);
    ctx.fillStyle = '#a0efb8';
    ctx.font = '30px Courier';
    ctx.textAlign = 'center';
    ctx.fillText('UPGRADE DRAFT', this.game.width/2, 200);
    this.draft.forEach((u, i) => {
        let x = this.game.width/2;
        let y = 300 + i * 100;
        ctx.fillStyle = '#111';
        ctx.fillRect(x - 150, y - 40, 300, 80);
        ctx.strokeStyle = '#a0efb8';
        ctx.strokeRect(x - 150, y - 40, 300, 80);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Courier';
        ctx.fillText(u.name, x, y - 5);
        ctx.font = '14px Courier';
        ctx.fillStyle = '#aaa';
        ctx.fillText(u.desc, x, y + 15);
    });
  }
  handleInput(x, y) {
    for (let i=0; i<this.draft.length; i++) {
        let cy = 300 + i * 100;
        if (x > this.game.width/2 - 150 && x < this.game.width/2 + 150 && y > cy - 40 && y < cy + 40) {
            this.draft[i].apply(this.game);
            this.game.state = 'PLAYING';
            this.game.soundEngine.playTone(600, 'sine', 0.2);
            return true;
        }
    }
    return false;
  }
}

// Additional Progression Utils
class StatModifier {
  constructor(statName, value, type='add') {
    this.statName = statName;
    this.value = value;
    this.type = type;
  }
  apply(entity) {
    if (this.type === 'add') {
      entity[this.statName] = (entity[this.statName] || 0) + this.value;
    } else if (this.type === 'mult') {
      entity[this.statName] = (entity[this.statName] || 1) * this.value;
    }
  }
}

// Dummy instantiations just to demonstrate structure
const demoStat1 = new StatModifier('hp', 10, 'add');
const demoStat2 = new StatModifier('speed', 1.2, 'mult');
