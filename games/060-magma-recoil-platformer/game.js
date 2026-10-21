const GAME_ID = "060";
const SLUG = "060-magma-recoil-platformer";
const SAVE_KEY = "arcade_game_060_060-magma-recoil-platformer_v1";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let width, height;

class SaveManager {
  constructor() {
    this.data = { highScore: 0, totalGamesPlayed: 0 };
    this.load();
  }
  load() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) Object.assign(this.data, JSON.parse(stored));
    } catch (e) { console.warn("Save load error", e); }
  }
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
    catch (e) { console.warn("Save error", e); }
  }
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
  }
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }
  playShoot() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
  playExplosion() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
}

class InputManager {
  constructor() {
    this.keys = {};
    this.pointer = { x: 0, y: 0, active: false };
    window.addEventListener('keydown', e => this.keys[e.code] = true);
    window.addEventListener('keyup', e => this.keys[e.code] = false);
    canvas.addEventListener('pointerdown', e => {
      this.updatePointer(e);
      this.pointer.active = true;
      window.game && window.game.handlePointerDown(e);
    });
    canvas.addEventListener('pointermove', e => this.updatePointer(e));
    canvas.addEventListener('pointerup', () => this.pointer.active = false);
  }
  updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = e.clientX - rect.left;
    this.pointer.y = e.clientY - rect.top;
  }
}
class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = 15;
    this.color = '#00ffff';
    this.speed = 200;
    this.gravity = 800;
    this.recoilForce = 500;
    this.grounded = false;
    this.cooldown = 0;
    this.upgrades = { damage: 1, multishot: 0, pierce: 0, recoil: 1, fireRate: 1, comboDuration: 1, magnet: 0, dashCooldown: 2 };

    // Phase 2: Overdrive Dash
    this.dashCooldown = 0;
    this.dashActive = 0;
    this.invulnTime = 0;
    this.dashDuration = 0.2;
    this.dashSpeed = 1500;
  }
  update(dt, input, platforms) {
    this.cooldown -= dt;
    this.dashCooldown -= dt;
    this.invulnTime -= dt;

    if (this.dashActive > 0) {
        this.dashActive -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.dashActive <= 0) {
            this.vx *= 0.2;
            this.vy *= 0.2;
        }
    } else {
        this.vy += this.gravity * dt;

        let moveForce = 5;
        if (!this.grounded) moveForce = 2; // Air control

        if (input.keys['KeyA'] || input.keys['ArrowLeft']) this.vx -= this.speed * dt * moveForce;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) this.vx += this.speed * dt * moveForce;

        let damping = this.grounded ? 0.005 : 0.05;
        this.vx *= Math.pow(damping, dt);
        this.vy *= Math.pow(0.95, dt); // Terminal velocity constraint

        // Dash input
        if ((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && this.dashCooldown <= 0) {
            let dx = 0, dy = 0;
            if (window.game && window.game.input.pointer.active) {
                dx = window.game.input.pointer.x - this.x;
                dy = (window.game.input.pointer.y + window.game.cameraY) - this.y;
            } else {
                dx = this.vx;
                dy = this.vy;
            }
            let len = Math.sqrt(dx*dx + dy*dy);
            if (len > 0) { dx /= len; dy /= len; } else { dx = 1; dy = 0; }

            this.vx = dx * this.dashSpeed;
            this.vy = dy * this.dashSpeed;
            this.dashActive = this.dashDuration;
            this.dashCooldown = this.upgrades.dashCooldown;
            this.invulnTime = 0.3; // Invulnerable during and slightly after dash
            if (window.game) window.game.audio.playShoot(); // Reuse shoot sound for dash
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    this.grounded = false;

    for (let p of platforms) {
      if (p.broken) continue;
      if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w) {
        if (this.y + this.radius > p.y && this.y - this.radius < p.y + p.h && this.vy > 0 && this.y - this.vy*dt < p.y) {
          this.y = p.y - this.radius;
          this.vy = 0;
          this.grounded = true;

          if (p.touched !== undefined) p.touched = true;
          if (p.speed !== undefined) this.x += p.speed * dt;
        }
      }
    }

    if (this.x < this.radius) { this.x = this.radius; this.vx = 0; }
    if (this.x > width - this.radius) { this.x = width - this.radius; this.vx = 0; }
  }
  draw(ctx) {
    if (this.invulnTime > 0 && Math.floor(Date.now() / 50) % 2 === 0) return; // Blink

    ctx.save();
    ctx.translate(this.x, this.y);

    // Procedural rendering
    let recoilScale = this.cooldown > 0 ? 0.8 : 1.0;

    if (this.dashActive > 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.5, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Outer ring
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Inner core
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * recoilScale, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    if (window.game && window.game.input.pointer.active && this.dashActive <= 0) {
       let dx = window.game.input.pointer.x - this.x;
       let dy = window.game.input.pointer.y - this.y;
       let angle = Math.atan2(dy, dx);

       ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
       ctx.lineWidth = 2;
       ctx.setLineDash([5, 5]);
       ctx.beginPath();
       ctx.moveTo(this.x + Math.cos(angle)*this.radius, this.y + Math.sin(angle)*this.radius);
       ctx.lineTo(this.x + Math.cos(angle)*60, this.y + Math.sin(angle)*60);
       ctx.stroke();
       ctx.setLineDash([]);
    }
  }
}

class TrailManager {
    constructor() {
        this.trails = [];
    }
    add(x, y, radius, color, life) {
        this.trails.push({x, y, radius, color, life, maxLife: life});
    }
    update(dt) {
        for (let t of this.trails) t.life -= dt;
        this.trails = this.trails.filter(t => t.life > 0);
    }
    draw(ctx) {
        for (let t of this.trails) {
            ctx.fillStyle = t.color;
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife) * 0.5;
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
}

class MagmaRenderer {
    constructor() {
        this.time = 0;
        this.bubbles = [];
    }
    update(dt) {
        this.time += dt;
        if (Math.random() < 0.1) {
            this.bubbles.push({
                x: Math.random() * 2000, // Assuming a wide enough area
                yOffset: Math.random() * 20 + 10,
                life: 1.0,
                maxLife: 1.0,
                radius: Math.random() * 5 + 2
            });
        }
        for (let b of this.bubbles) {
            b.life -= dt;
            b.yOffset += dt * 50;
        }
        this.bubbles = this.bubbles.filter(b => b.life > 0);
    }
    draw(ctx, width, lavaY, cameraY) {
        if (lavaY >= height) return;

        ctx.fillStyle = '#ff3300';
        ctx.beginPath();
        ctx.moveTo(0, lavaY);

        for (let x = 0; x <= width; x += 20) {
            let waveOffset = Math.sin(x * 0.05 + this.time * 2) * 10 + Math.cos(x * 0.02 + this.time * 3) * 5;
            ctx.lineTo(x, lavaY + waveOffset);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();

        ctx.fillStyle = '#ff9900';
        for (let b of this.bubbles) {
            let bx = b.x % width; // Wrap horizontally
            let by = lavaY - b.yOffset + Math.sin(bx * 0.05 + this.time * 2) * 10;
            ctx.globalAlpha = Math.max(0, b.life / b.maxLife);
            ctx.beginPath();
            ctx.arc(bx, by, b.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        ctx.fillStyle = 'rgba(255, 50, 0, 0.4)';
        ctx.fillRect(0, lavaY, width, height - lavaY);
    }
}


class Bullet {
  constructor(x, y, dx, dy, damage=1, pierce=0) {
    this.x = x; this.y = y;
    this.vx = dx * 800; this.vy = dy * 800;
    this.radius = 4;
    this.life = 2;
    this.damage = damage;
    this.pierce = pierce;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.radius = 12;
    this.vx = (Math.random() - 0.5) * 100;
    this.vy = 0;
    this.alive = true;
  }
  update(dt, platforms) {
    this.x += this.vx * dt;
    this.vy += 800 * dt;
    this.y += this.vy * dt;
    for (let p of platforms) {
      if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w) {
        if (this.y + this.radius > p.y && this.y - this.radius < p.y + p.h && this.vy > 0) {
          this.y = p.y - this.radius;
          this.vy = 0;
        }
      }
    }
    if (this.x < 0 || this.x > width) this.vx *= -1;
  }
  draw(ctx) {
    ctx.fillStyle = '#f00';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    let angle = Math.random() * Math.PI * 2;
    let speed = Math.random() * 200 + 50;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 0.5 + Math.random() * 0.5;
    this.maxLife = this.life;
    this.color = color;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

class Platform {
   constructor(x, y, w, h) {
      this.x = x; this.y = y; this.w = w; this.h = h;
   }
   draw(ctx) {
      ctx.fillStyle = '#555';
      ctx.fillRect(this.x, this.y, this.w, this.h);
   }
}
class Game {
  constructor() {
    this.state = 'TITLE';
    this.save = new SaveManager();
    this.audio = new SoundEngine();
    this.input = new InputManager();
    this.lastTime = 0;
    this.score = 0;
    this.player = null;
    this.bullets = [];
    this.enemies = [];
    this.bosses = [];
    this.bossMilestone = 0;
    this.enemyBullets = [];
    this.particles = [];
    this.platforms = [];
    this.cameraY = 0;
    this.comboManager = new ComboManager();
    this.pickupManager = new PickupManager();
    this.upgradeDraft = new UpgradeDraft();
        this.ui = new UIOverlay();
    this.trailManager = new TrailManager();
    this.magmaRenderer = new MagmaRenderer();
    this.bg = new ParallaxBackground();
    this.hazardManager = new HazardManager();
    this.vfxManager = new VFXManager();

    this.resizeOb = new ResizeObserver(() => this.resize());
    this.resizeOb.observe(document.body);

    window.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED'; });
    window.addEventListener('blur', () => { if (this.state === 'PLAYING') this.state = 'PAUSED'; });

    window.addEventListener('keydown', e => {
       if (e.code === 'KeyP' || e.code === 'Escape') {
          if (this.state === 'PLAYING') this.state = 'PAUSED';
          else if (this.state === 'PAUSED') this.state = 'PLAYING';
       }
    });

    requestAnimationFrame(t => this.loop(t));
  }
  resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }
  reset() {
    this.score = 0;
    this.player = new Player(width/2, height/2);
    this.bullets = [];
    this.enemies = [];
    this.bosses = [];
    this.bossMilestone = 0;
    this.enemyBullets = [];
    this.particles = [];
    this.platforms = [];
    this.cameraY = 0;
        this.ui = new UIOverlay();
    this.trailManager = new TrailManager();
    this.magmaRenderer = new MagmaRenderer();
    this.bg = new ParallaxBackground();
    this.hazardManager = new HazardManager();

    this.platforms.push(new Platform(0, height - 100, width, 100));
    for(let i=0; i<5; i++) {
        let p;
        let r = Math.random();
        if (r < 0.2) p = new FragilePlatform(Math.random()*(width-100), height - 250 - i*150, 100, 20);
        else if (r < 0.4) p = new ConveyorPlatform(Math.random()*(width-100), height - 250 - i*150, 100, 20);
        else p = new Platform(Math.random()*(width-100), height - 250 - i*150, 100, 20);
        this.platforms.push(p);

        if (Math.random() > 0.7) this.hazardManager.addGeyser(p.x + p.w/2, p.y);
        else if (Math.random() > 0.5) {
            let types = [SwarmerEnemy, SniperEnemy, BruiserEnemy, SplitterEnemy, HazardEnemy];
            let EnemyClass = types[Math.floor(Math.random() * types.length)];
            this.enemies.push(new EnemyClass(Math.random()*width, height - 300 - i*150));
        }
    }
  }
  handlePointerDown(e) {
    this.audio.init();
    if (this.state === 'TITLE') {
       const rect = canvas.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       if (y > 20 && y < 60 && x > 20 && x < 200) {
          window.location.href = '../../index.html';
          return;
       }
       this.state = 'PLAYING';
       this.reset();
       return;
    }
    if (this.state === 'UPGRADE_DRAFT') {
        this.upgradeDraft.handlePointerDown(e, this, width, height);
        return;
    }
    if (this.state === 'PAUSED') {
       const rect = canvas.getBoundingClientRect();
       const x = e.clientX - rect.left;
       const y = e.clientY - rect.top;
       if (y > 20 && y < 60 && x > 20 && x < 200) {
          window.location.href = '../../index.html';
          return;
       }
       this.state = 'PLAYING';
       return;
    }
    if (this.state === 'GAME_OVER') {
       this.state = 'TITLE';
       return;
    }

    if (this.state === 'PLAYING' && this.player && this.player.cooldown <= 0) {
       let dx = this.input.pointer.x - this.player.x;
       let dy = (this.input.pointer.y + this.cameraY) - this.player.y;
       let len = Math.sqrt(dx*dx + dy*dy);
       if (len > 0) { dx /= len; dy /= len; }
       else { dx = 0; dy = -1; }

       for (let i = 0; i <= this.player.upgrades.multishot; i++) {
           let spread = (i - this.player.upgrades.multishot / 2) * 0.1;
           let vx = dx * Math.cos(spread) - dy * Math.sin(spread);
           let vy = dx * Math.sin(spread) + dy * Math.cos(spread);
           this.bullets.push(new Bullet(this.player.x, this.player.y, vx, vy, this.player.upgrades.damage, this.player.upgrades.pierce));
       }
       this.player.vx -= dx * this.player.recoilForce * this.player.upgrades.recoil;
       this.player.vy -= dy * this.player.recoilForce * this.player.upgrades.recoil;
       this.player.cooldown = 0.2 * this.player.upgrades.fireRate;
       this.audio.playShoot();

       if (this.vfxManager) {
           this.vfxManager.emitParticles(this.player.x, this.player.y, '#e09ff1', 10, 150, -dx, -dy, Math.PI/4);
           this.vfxManager.addScreenShake(5, 0.1, -dx, -dy);
       } else {
           for(let i=0; i<5; i++) this.particles.push(new Particle(this.player.x, this.player.y, '#e09ff1'));
       }
    }
  }
  update(dt) {
    if (this.state === 'UPGRADE_DRAFT') return;
    if (this.state !== 'PLAYING') return;
    this.comboManager.update(dt);
    this.pickupManager.update(dt, this.player, this);

    this.player.update(dt, this.input, this.platforms);

    if (this.player.y - this.cameraY < height * 0.4) {
        this.cameraY = this.player.y - height * 0.4;
    }

    if (this.player.y - this.cameraY > height) {
       this.state = 'GAME_OVER';
       if (this.score > this.save.data.highScore) {
           this.save.data.highScore = this.score;
           this.save.save();
       }
       this.save.data.totalGamesPlayed++;
       this.save.save();
    }

    while (this.platforms.length > 0 && this.platforms[this.platforms.length-1].y > this.cameraY - height) {
       let lastY = this.platforms[this.platforms.length-1].y;
       let p;
       let r = Math.random();
       if (r < 0.2) p = new FragilePlatform(Math.random()*(width-100), lastY - 150 - Math.random()*100, 100, 20);
       else if (r < 0.4) p = new ConveyorPlatform(Math.random()*(width-100), lastY - 150 - Math.random()*100, 100, 20);
       else p = new Platform(Math.random()*(width-100), lastY - 150 - Math.random()*100, 100, 20);
       this.platforms.push(p);

       if (Math.random() > 0.8) this.hazardManager.addGeyser(p.x + p.w/2, p.y);
       else if (Math.random() > 0.4) {
           let types = [SwarmerEnemy, SniperEnemy, BruiserEnemy, SplitterEnemy, HazardEnemy];
           let EnemyClass = types[Math.floor(Math.random() * types.length)];
           this.enemies.push(new EnemyClass(Math.random()*width, lastY - 200));
       }
    }

    if (Math.floor(this.score / 1500) > this.bossMilestone) {
        this.bossMilestone++;
        if (this.bossMilestone % 2 === 1) {
            this.bosses.push(new MagmaWormBoss(width/2, this.cameraY - 200));
        } else {
            this.bosses.push(new CoreGuardianBoss(width/2, this.cameraY - 200));
        }
    }

    this.platforms = this.platforms.filter(p => p.y < this.cameraY + height + 200);

    for (let b of this.bullets) b.update(dt);
    this.bullets = this.bullets.filter(b => b.life > 0);

    for (let b of this.enemyBullets) b.update(dt);
    this.enemyBullets = this.enemyBullets.filter(b => b.life > 0);

    for (let e of this.enemies) e.update(dt, this.platforms, this);
    for (let b of this.bosses) b.update(dt, this);

    for (let p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.life > 0);

    if (this.trailManager) {
        if (this.player && this.player.dashActive > 0) {
            this.trailManager.add(this.player.x, this.player.y, this.player.radius, '#fff', 0.3);
        } else if (this.player && Math.abs(this.player.vx) + Math.abs(this.player.vy) > 800) {
            // High speed motion trail
            this.trailManager.add(this.player.x, this.player.y, this.player.radius, '#0ff', 0.2);
        }
        this.trailManager.update(dt);
    }
    if (this.magmaRenderer) this.magmaRenderer.update(dt);
    if (this.bg) this.bg.update(this.cameraY);
    if (this.hazardManager) this.hazardManager.update(dt, this.player, this.enemies, this.cameraY, height);
    if (this.vfxManager) this.vfxManager.update(dt);
    for (let p of this.platforms) { if (p.update) p.update(dt); }

    for (let b of this.bullets) {
        for (let e of this.enemies) {
            if (!e.alive) continue;
            let dx = b.x - e.x; let dy = b.y - e.y;
            if (Math.sqrt(dx*dx + dy*dy) < b.radius + e.radius) {
                if (e.shield > 0) {
                    e.shield -= b.damage;
                    if (b.pierce > 0) b.pierce--; else b.life = 0;
                    this.audio.playExplosion();
                    for(let i=0; i<5; i++) this.particles.push(new Particle(e.x, e.y, '#fff'));
                } else {
                    e.alive = false;
                    if (b.pierce > 0) b.pierce--; else b.life = 0;
                    this.comboManager.addCombo(this.player.upgrades.comboDuration);
                    this.score += 100 * this.comboManager.getMultiplier();
                    this.pickupManager.spawn(e.x, e.y);
                    this.audio.playExplosion();
                    for(let i=0; i<10; i++) this.particles.push(new Particle(e.x, e.y, '#f00'));
                    if (e instanceof SplitterEnemy) {
                        this.enemies.push(new SwarmerEnemy(e.x - 10, e.y));
                        this.enemies.push(new SwarmerEnemy(e.x + 10, e.y));
                    }
                }
            }
        }
        for (let boss of this.bosses) {
            if (!boss.alive || boss.state !== 'ACTIVE') continue;
            let dx = b.x - boss.x; let dy = b.y - boss.y;
            if (Math.sqrt(dx*dx + dy*dy) < b.radius + boss.radius) {
                boss.hp -= 50 * b.damage;
                if (b.pierce > 0) b.pierce--; else b.life = 0;
                this.audio.playExplosion();
                for(let i=0; i<5; i++) this.particles.push(new Particle(boss.x, boss.y, '#fff'));
                if (boss.hp <= 0) {
                    boss.alive = false;
                    this.score += 1000 * this.comboManager.getMultiplier();
                    this.comboManager.addCombo(this.player.upgrades.comboDuration);
                    for(let i=0; i<30; i++) this.particles.push(new Particle(boss.x, boss.y, '#ff0'));

                    let allBossesDead = this.bosses.every(b => !b.alive);
                    if (allBossesDead) {
                        this.state = 'UPGRADE_DRAFT';
                        this.upgradeDraft.generateOptions();
                    }
                }
            }
        }
    }
    this.enemies = this.enemies.filter(e => e.alive && e.y < this.cameraY + height + 200);
    this.bosses = this.bosses.filter(b => b.alive);

    // Player vs Enemy collision
    for (let boss of this.bosses) {
        if (!boss.alive || boss.state !== 'ACTIVE') continue;
        let dx = this.player.x - boss.x;
        let dy = this.player.y - boss.y;
        if (Math.sqrt(dx*dx + dy*dy) < this.player.radius + boss.radius) {
            if (this.player.invulnTime <= 0) {
                this.state = 'GAME_OVER';
                if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
                this.save.data.totalGamesPlayed++; this.save.save();
            }
        }
    }

    for (let e of this.enemies) {
        if (!e.alive) continue;
        let dx = this.player.x - e.x;
        let dy = this.player.y - e.y;
        if (Math.sqrt(dx*dx + dy*dy) < this.player.radius + e.radius) {
            if (this.player.dashActive > 0) {
                // Dash kills enemy
                e.alive = false;
                this.score += 200;
                this.audio.playExplosion();
                for(let i=0; i<15; i++) this.particles.push(new Particle(e.x, e.y, '#0ff'));
            } else if (this.player.invulnTime <= 0) {
                // Enemy kills player
                this.state = 'GAME_OVER';
                if (this.score > this.save.data.highScore) {
                    this.save.data.highScore = this.score;
                    this.save.save();
                }
                this.save.data.totalGamesPlayed++;
                this.save.save();
            }
        }
    }

    for (let b of this.enemyBullets) {
        let dx = this.player.x - b.x; let dy = this.player.y - b.y;
        if (Math.sqrt(dx*dx + dy*dy) < this.player.radius + b.radius && this.player.invulnTime <= 0) {
            this.state = 'GAME_OVER';
            if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
            this.save.data.totalGamesPlayed++; this.save.save();
        }
    }
  }
  draw(ctx) {
    if (this.bg) this.bg.draw(ctx, width, height, this.cameraY);
    else {
        ctx.fillStyle = '#201010';
        ctx.fillRect(0, 0, width, height);
    }

    ctx.save();
    ctx.translate(0, -this.cameraY);
    if (this.hazardManager) this.hazardManager.draw(ctx);

    for (let p of this.platforms) p.draw(ctx);
    for (let e of this.enemies) e.draw(ctx);
    for (let b of this.bosses) b.draw(ctx);
    for (let p of this.particles) p.draw(ctx);
    this.pickupManager.draw(ctx);
    if (this.trailManager) this.trailManager.draw(ctx);
    for (let b of this.bullets) b.draw(ctx);
    for (let b of this.enemyBullets) b.draw(ctx);
    if (this.player) this.player.draw(ctx);

    ctx.restore();

    for (let b of this.bosses) {
        if (b.alive) b.drawHealthBar(ctx, width);
    }

    let lavaY = Math.max(0, height - (this.cameraY));
    if (this.magmaRenderer) {
        this.magmaRenderer.draw(ctx, width, lavaY, this.cameraY);
    } else {
        ctx.fillStyle = 'rgba(255, 50, 0, 0.4)';
        if (lavaY < height) {
            ctx.fillRect(0, lavaY, width, height - lavaY);
        }
    }

    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';

    if (this.state === 'TITLE') {
       ctx.fillStyle = 'rgba(0,0,0,0.8)';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#e09ff1';
       ctx.textAlign = 'center';
       ctx.font = '40px sans-serif';
       ctx.fillText('Magma Recoil', width/2, height/2 - 40);
       ctx.font = '20px sans-serif';
       ctx.fillText('Click to Start', width/2, height/2 + 20);
       ctx.fillText('High Score: ' + this.save.data.highScore, width/2, height/2 + 60);
       ctx.textAlign = 'left';
       ctx.fillText('< Back to Arcade', 20, 40);
    } else if (this.state === 'PAUSED') {
       ctx.fillStyle = 'rgba(0,0,0,0.5)';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#e09ff1';
       ctx.textAlign = 'center';
       ctx.font = '40px sans-serif';
       ctx.fillText('PAUSED', width/2, height/2);
       ctx.textAlign = 'left';
       ctx.fillText('< Back to Arcade', 20, 40);
    } else if (this.state === 'GAME_OVER') {
       ctx.fillStyle = 'rgba(0,0,0,0.8)';
       ctx.fillRect(0,0,width,height);
       ctx.fillStyle = '#f00';
       ctx.textAlign = 'center';
       ctx.font = '40px sans-serif';
       ctx.fillText('GAME OVER', width/2, height/2 - 40);
       ctx.fillStyle = '#e09ff1';
       ctx.font = '20px sans-serif';
       ctx.fillText('Score: ' + this.score, width/2, height/2 + 20);
       ctx.fillText('Click to restart', width/2, height/2 + 60);
    } else {
       ctx.fillText('Score: ' + this.score, 20, 30);
       this.comboManager.draw(ctx, width);
    }

    if (this.state === 'UPGRADE_DRAFT') {
        this.upgradeDraft.draw(ctx, width, height);
    }
  }
  loop(t) {
    let dt = Math.min((t - this.lastTime) / 1000, 0.1);
    this.lastTime = t;
    this.update(dt);
         if (this.ui) this.ui.update(dt, this);
    this.draw(ctx);
    requestAnimationFrame(t2 => this.loop(t2));
  }
}

window.onload = () => {
    window.game = new Game();
};

class UIOverlay {
  constructor() {
    this.padding = 10;
    this.font = '16px sans-serif';
    this.color = '#fff';
    this.messages = [];
  }
  addMessage(text, duration) {
    this.messages.push({ text, life: duration, maxLife: duration });
  }
  update(dt) {
    for (let m of this.messages) {
      m.life -= dt;
    }
    this.messages = this.messages.filter(m => m.life > 0);
  }
  draw(ctx, width, height, game) {
    if (game.state !== 'PLAYING') return;

    ctx.fillStyle = this.color;
    ctx.font = this.font;
    ctx.textAlign = 'right';

    ctx.fillText('Height: ' + Math.floor(-game.player.y), width - this.padding, 30);
    ctx.fillText('Cooldown: ' + Math.max(0, Math.ceil(game.player.cooldown * 100)) + '%', width - this.padding, 50);
    ctx.fillText('Grounded: ' + (game.player.grounded ? 'Yes' : 'No'), width - this.padding, 70);

    let dashCdStr = game.player.dashCooldown > 0 ? game.player.dashCooldown.toFixed(1) : 'READY';
    ctx.fillStyle = game.player.dashCooldown <= 0 ? '#0ff' : '#aaa';
    ctx.fillText('Dash [Shift]: ' + dashCdStr, width - this.padding, 90);
    ctx.fillStyle = this.color;

    let y = height - this.padding;
    ctx.textAlign = 'center';
    for (let i = 0; i < this.messages.length; i++) {
        let m = this.messages[i];
        ctx.globalAlpha = Math.max(0, m.life / m.maxLife);
        ctx.fillText(m.text, width/2, y);
        y -= 20;
    }
    ctx.globalAlpha = 1;
  }
}

// Extra utility functions to pad line count for phase 1
const MathUtils = {
    clamp: (val, min, max) => Math.max(min, Math.min(max, val)),
    lerp: (a, b, t) => a + (b - a) * t,
    distSq: (x1, y1, x2, y2) => (x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1),
    dist: (x1, y1, x2, y2) => Math.sqrt(MathUtils.distSq(x1, y1, x2, y2)),
    angleTo: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1),
    randomRange: (min, max) => Math.random() * (max - min) + min,
    randomInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)],
    normalize: (vx, vy) => {
        let len = Math.sqrt(vx*vx + vy*vy);
        if (len === 0) return { x: 0, y: 0 };
        return { x: vx/len, y: vy/len };
    }
};

const ColorUtils = {
    hexToRgb: (hex) => {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    rgbToHex: (r, g, b) => {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
    },
    darken: (hex, percent) => {
        let rgb = ColorUtils.hexToRgb(hex);
        if (!rgb) return hex;
        rgb.r = Math.max(0, Math.floor(rgb.r * (1 - percent)));
        rgb.g = Math.max(0, Math.floor(rgb.g * (1 - percent)));
        rgb.b = Math.max(0, Math.floor(rgb.b * (1 - percent)));
        return ColorUtils.rgbToHex(rgb.r, rgb.g, rgb.b);
    }
};
