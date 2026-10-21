const GAME_ID = "060";
const SLUG = "060-magma-recoil-platformer";
const SAVE_KEY = "arcade_game_060_060-magma-recoil-platformer_v1";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let width, height;

class SaveManager {
  constructor() {
    this.data = {
        highScore: 0,
        totalGamesPlayed: 0,
        settings: {
            masterVolume: 1,
            musicVolume: 1,
            sfxVolume: 1,
            screenShake: 1,
            particleDensity: 1,
            highContrast: false,
            showFPS: false,
            touchMode: 'auto', // auto, always, off
            swapControls: false
        },
        milestones: {
            firstBoss: false,
            score10k: false,
            score50k: false,
            combo10x: false,
            combo25x: false,
            play10Games: false
        }
    };
    this.load();
  }

  exportSave() {
      return btoa(JSON.stringify(this.data));
  }

  importSave(base64Str) {
      try {
          const decoded = atob(base64Str);
          const parsed = JSON.parse(decoded);
          Object.assign(this.data, parsed);
          this.save();
          return true;
      } catch(e) {
          return false;
      }
  }

  resetSave() {
      this.data = {
        highScore: 0,
        totalGamesPlayed: 0,
        settings: this.data.settings,
        milestones: {
            firstBoss: false, score10k: false, score50k: false,
            combo10x: false, combo25x: false, play10Games: false
        }
      };
      this.save();
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
    this.musicGain = null;
    this.sfxGain = null;
    this.bgmOscs = [];
    this.percOsc = null;
    this.isPlayingMusic = false;
    this.nextNoteTime = 0;
    this.beatIndex = 0;
    this.tempo = 120;
    this.filterIntensity = 1000;
    this.isBossPhase = false;
    this.isLowHp = false;
    this.baseScale = [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08]; // C minor
  }

  init() {
    if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.master.gain.value = 0.5;
    this.musicGain.gain.value = 0.4;
    this.sfxGain.gain.value = 0.6;

    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);

    if (window.game && window.game.save) {
        let s = window.game.save.data.settings;
        this.master.gain.value = 0.5 * s.masterVolume;
        this.musicGain.gain.value = 0.4 * s.musicVolume;
        this.sfxGain.gain.value = 0.6 * s.sfxVolume;
    }

    this.startMusic();
  }

  updateMusicState(isBossPhase, isLowHp) {
    this.isBossPhase = isBossPhase;
    this.isLowHp = isLowHp;
    this.tempo = isBossPhase ? 160 : (isLowHp ? 100 : 120);
    this.filterIntensity = isBossPhase ? 2000 : (isLowHp ? 500 : 1000);
  }

  startMusic() {
    if (this.isPlayingMusic || !this.ctx) return;
    this.isPlayingMusic = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduleMusic();
  }

  scheduleMusic() {
    if (!this.isPlayingMusic || !this.ctx) return;
    const secondsPerBeat = 60.0 / this.tempo;
    while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
      this.playArpNote(this.nextNoteTime);
      this.playPercussion(this.nextNoteTime);
      this.nextNoteTime += secondsPerBeat / 4; // 16th notes
      this.beatIndex++;
    }
    this.musicTimer = setTimeout(() => this.scheduleMusic(), 25);
  }

  playArpNote(time) {
      if (this.beatIndex % 2 !== 0) return; // 8th notes
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = this.isBossPhase ? 'sawtooth' : 'square';
      const noteIndex = (this.beatIndex / 2) % 8;
      const pattern = this.isBossPhase ? [0, 4, 7, 4, 0, 4, 7, 4] : [0, 2, 4, 2, 0, 2, 4, 2];
      let freq = this.baseScale[pattern[noteIndex] % this.baseScale.length];
      if (this.isBossPhase && noteIndex % 2 === 0) freq *= 2; // Octave jumps

      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(this.filterIntensity, time);
      filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + 0.2);
  }

  playPercussion(time) {
      if (this.beatIndex % 4 === 0) { // Kick
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(150, time);
          osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
          gain.gain.setValueAtTime(0.5, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
          osc.connect(gain);
          gain.connect(this.musicGain);
          osc.start(time);
          osc.stop(time + 0.1);
      } else if (this.beatIndex % 4 === 2) { // Snare/Hat
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(this.isBossPhase ? 800 : 400, time);
          gain.gain.setValueAtTime(0.1, time);
          gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
          osc.connect(gain);
          gain.connect(this.musicGain);
          osc.start(time);
          osc.stop(time + 0.05);
      }
  }

  playSFX(type, pitch = 1) {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.sfxGain);

      const t = this.ctx.currentTime;
      let duration = 0.1;

      switch(type) {
          case 'shoot':
              osc.type = 'square';
              osc.frequency.setValueAtTime(400 * pitch, t);
              osc.frequency.exponentialRampToValueAtTime(100 * pitch, t + 0.1);
              gain.gain.setValueAtTime(0.3, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
              break;
          case 'dash':
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(200 * pitch, t);
              osc.frequency.exponentialRampToValueAtTime(600 * pitch, t + 0.15);
              gain.gain.setValueAtTime(0.4, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
              duration = 0.15;
              break;
          case 'explosion':
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(100 * pitch, t);
              osc.frequency.exponentialRampToValueAtTime(40 * pitch, t + 0.2);
              gain.gain.setValueAtTime(0.5, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
              duration = 0.2;
              break;
          case 'hit':
              osc.type = 'square';
              osc.frequency.setValueAtTime(800 * pitch, t);
              osc.frequency.exponentialRampToValueAtTime(200 * pitch, t + 0.05);
              gain.gain.setValueAtTime(0.4, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
              duration = 0.05;
              break;
          case 'pickup':
              osc.type = 'sine';
              osc.frequency.setValueAtTime(600 * pitch, t);
              osc.frequency.setValueAtTime(800 * pitch, t + 0.05);
              osc.frequency.setValueAtTime(1200 * pitch, t + 0.1);
              gain.gain.setValueAtTime(0.3, t);
              gain.gain.linearRampToValueAtTime(0.01, t + 0.2);
              duration = 0.2;
              break;
          case 'upgrade':
              osc.type = 'triangle';
              osc.frequency.setValueAtTime(400 * pitch, t);
              osc.frequency.linearRampToValueAtTime(800 * pitch, t + 0.3);
              gain.gain.setValueAtTime(0.4, t);
              gain.gain.linearRampToValueAtTime(0.01, t + 0.4);
              duration = 0.4;
              break;
          case 'bossSpawn':
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(100 * pitch, t);
              osc.frequency.linearRampToValueAtTime(50 * pitch, t + 1.0);
              gain.gain.setValueAtTime(0.6, t);
              gain.gain.linearRampToValueAtTime(0.01, t + 1.0);
              duration = 1.0;
              break;
          case 'uiHover':
              osc.type = 'sine';
              osc.frequency.setValueAtTime(600 * pitch, t);
              gain.gain.setValueAtTime(0.1, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
              duration = 0.05;
              break;
          case 'uiSelect':
              osc.type = 'square';
              osc.frequency.setValueAtTime(800 * pitch, t);
              osc.frequency.setValueAtTime(1200 * pitch, t + 0.05);
              gain.gain.setValueAtTime(0.2, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
              duration = 0.1;
              break;
          case 'jump':
              osc.type = 'sine';
              osc.frequency.setValueAtTime(300 * pitch, t);
              osc.frequency.exponentialRampToValueAtTime(500 * pitch, t + 0.1);
              gain.gain.setValueAtTime(0.3, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
              duration = 0.1;
              break;
          default:
              osc.type = 'sine';
              osc.frequency.setValueAtTime(440, t);
              gain.gain.setValueAtTime(0.1, t);
              gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      }

      osc.start(t);
      osc.stop(t + duration);
  }

  playShoot() { this.playSFX('shoot'); }
  playExplosion() { this.playSFX('explosion'); }
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
            if (window.game) window.game.audio.playSFX('dash');
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
    this.confirmReset = false;
    this.fps = 0;
    this.frames = 0;
    this.lastFpsTime = 0;
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
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.state === 'TITLE') {
       if (y > 20 && y < 60 && x > 20 && x < 200) {
          window.location.href = '../../index.html';
          return;
       }
       if (y > 20 && y < 60 && x > width - 150) {
          this.state = 'SETTINGS';
          this.confirmReset = false;
          return;
       }
       this.state = 'PLAYING';
       this.reset();
       return;
    }
    if (this.state === 'SETTINGS') {
       if (y > 20 && y < 60 && x > 20 && x < 200) {
          this.state = 'TITLE';
          this.save.save();
          return;
       }

       let s = this.save.data.settings;
       let cy = 100;
       let cx = width/2 - 150;

       // Fixed hitboxes handling the +20 offset for buttons 9, 10, 11
       const checkClick = (idx) => {
           let targetY = cy + (idx * 40) + (idx >= 9 ? 20 : 0);
           return y > targetY - 20 && y < targetY + 10;
       };

       if (checkClick(0)) { s.masterVolume = (s.masterVolume + 0.25 > 1) ? 0 : s.masterVolume + 0.25; this.audio.master.gain.value = 0.5 * s.masterVolume; }
       else if (checkClick(1)) { s.musicVolume = (s.musicVolume + 0.25 > 1) ? 0 : s.musicVolume + 0.25; this.audio.musicGain.gain.value = 0.4 * s.musicVolume; }
       else if (checkClick(2)) { s.sfxVolume = (s.sfxVolume + 0.25 > 1) ? 0 : s.sfxVolume + 0.25; this.audio.sfxGain.gain.value = 0.6 * s.sfxVolume; }
       else if (checkClick(3)) {
           if (s.screenShake === 1) s.screenShake = 0.5;
           else if (s.screenShake === 0.5) s.screenShake = 0;
           else s.screenShake = 1;
           // Compatibility with vfx.js which expects options
           if (!this.save.data.options) this.save.data.options = {};
           this.save.data.options.screenShake = s.screenShake === 1 ? '100%' : (s.screenShake === 0.5 ? '50%' : 'Off');
       }
       else if (checkClick(4)) { s.particleDensity = s.particleDensity === 1 ? 0.25 : 1; }
       else if (checkClick(5)) { s.highContrast = !s.highContrast; }
       else if (checkClick(6)) { s.showFPS = !s.showFPS; }
       else if (checkClick(7)) {
           if (s.touchMode === 'auto') s.touchMode = 'always';
           else if (s.touchMode === 'always') s.touchMode = 'off';
           else s.touchMode = 'auto';
       }
       else if (checkClick(8)) { s.swapControls = !s.swapControls; }
       else if (checkClick(9)) { // Reset
           if (this.confirmReset) {
               this.save.resetSave();
               this.confirmReset = false;
               this.state = 'TITLE';
           } else {
               this.confirmReset = true;
           }
       }
       else if (checkClick(10)) { // Export
           let b64 = this.save.exportSave();
           prompt("Copy your save data:", b64);
       }
       else if (checkClick(11)) { // Import
           let b64 = prompt("Paste your save data:");
           if (b64) {
               if (this.save.importSave(b64)) alert("Save imported!");
               else alert("Invalid save data.");
           }
       }

       this.save.save();
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
    this.confirmReset = false;
    this.fps = 0;
    this.frames = 0;
    this.lastFpsTime = 0;
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
           let cnt = Math.floor(5 * this.save.data.settings.particleDensity);
           for(let i=0; i<cnt; i++) this.particles.push(new Particle(this.player.x, this.player.y, '#e09ff1'));
       }
    }
  }
  update(dt) {
    if (this.state === 'UPGRADE_DRAFT') return;
    if (this.state !== 'PLAYING') return;
    this.comboManager.update(dt);
    if (this.audio) {
        let isBossPhase = this.bosses.length > 0;
        let isLowHp = this.player.y - this.cameraY > height * 0.7;
        this.audio.updateMusicState(isBossPhase, isLowHp);
    }
    this.pickupManager.update(dt, this.player, this);

    this.player.update(dt, this.input, this.platforms);

    if (this.player.y - this.cameraY < height * 0.4) {
        this.cameraY = this.player.y - height * 0.4;
    }

    if (this.player.y - this.cameraY > height) {
       this.state = 'GAME_OVER';
                if (this.audio) this.audio.playSFX('explosion', 0.5);
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
            this.audio.playSFX('bossSpawn');
        } else {
            this.bosses.push(new CoreGuardianBoss(width/2, this.cameraY - 200));
            this.audio.playSFX('bossSpawn');
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
                    this.audio.playSFX('hit', 1.5);
                    if (b.pierce > 0) b.pierce--; else b.life = 0;
                    this.audio.playSFX('explosion', 1.0 + Math.random() * 0.5);
                    for(let i=0; i<5; i++) this.particles.push(new Particle(e.x, e.y, '#fff'));
                } else {
                    e.alive = false;
                    if (b.pierce > 0) b.pierce--; else b.life = 0;
                    this.comboManager.addCombo(this.player.upgrades.comboDuration);
                    this.score += 100 * this.comboManager.getMultiplier();
                    if (this.score >= 10000) { this.save.data.milestones.score10k = true; }
                    if (this.score >= 50000) { this.save.data.milestones.score50k = true; }
                    this.pickupManager.spawn(e.x, e.y);
                    this.audio.playSFX('explosion', 1.0 + Math.random() * 0.5);
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
                this.audio.playSFX('hit', 0.5);
                this.audio.playSFX('hit', 0.5);
                if (b.pierce > 0) b.pierce--; else b.life = 0;
                this.audio.playSFX('explosion', 1.0 + Math.random() * 0.5);
                for(let i=0; i<5; i++) this.particles.push(new Particle(boss.x, boss.y, '#fff'));
                if (boss.hp <= 0) {
                    boss.alive = false;
                    this.score += 1000 * this.comboManager.getMultiplier();
                    if (this.score >= 10000) { this.save.data.milestones.score10k = true; }
                    if (this.score >= 50000) { this.save.data.milestones.score50k = true; }
                    this.comboManager.addCombo(this.player.upgrades.comboDuration);
                    let bcnt = Math.floor(30 * this.save.data.settings.particleDensity);
                    for(let i=0; i<bcnt; i++) this.particles.push(new Particle(boss.x, boss.y, '#ff0'));

                    this.save.data.milestones.firstBoss = true;
                    this.save.save();

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
                if (this.audio) this.audio.playSFX('explosion', 0.5);
                if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
                this.save.data.totalGamesPlayed++;
            if (this.save.data.totalGamesPlayed >= 10) this.save.data.milestones.play10Games = true;
            this.save.save();
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
                    if (this.score >= 10000) { this.save.data.milestones.score10k = true; }
                    if (this.score >= 50000) { this.save.data.milestones.score50k = true; }
                this.audio.playSFX('explosion', 1.0 + Math.random() * 0.5);
                for(let i=0; i<15; i++) this.particles.push(new Particle(e.x, e.y, '#0ff'));
            } else if (this.player.invulnTime <= 0) {
                // Enemy kills player
                this.state = 'GAME_OVER';
                if (this.audio) this.audio.playSFX('explosion', 0.5);
                if (this.score > this.save.data.highScore) {
                    this.save.data.highScore = this.score;
                    this.save.save();
                }
                this.save.data.totalGamesPlayed++;
                if (this.save.data.totalGamesPlayed >= 10) this.save.data.milestones.play10Games = true;
                this.save.save();
            }
        }
    }

    for (let b of this.enemyBullets) {
        let dx = this.player.x - b.x; let dy = this.player.y - b.y;
        if (Math.sqrt(dx*dx + dy*dy) < this.player.radius + b.radius && this.player.invulnTime <= 0) {
            this.state = 'GAME_OVER';
                if (this.audio) this.audio.playSFX('explosion', 0.5);
            if (this.score > this.save.data.highScore) { this.save.data.highScore = this.score; this.save.save(); }
            this.save.data.totalGamesPlayed++;
            if (this.save.data.totalGamesPlayed >= 10) this.save.data.milestones.play10Games = true;
            this.save.save();
        }
    }
  }
  draw(ctx) {
    if (this.save.data.settings.highContrast) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0,0,width,height);
    } else {
        if (this.bg) {
            this.bg.draw(ctx, width, height, this.cameraY);
        } else {
            ctx.fillStyle = '#201010';
            ctx.fillRect(0, 0, width, height);
        }
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
       ctx.textAlign = 'right';
       ctx.fillText('Settings >', width - 20, 40);

       this.drawMilestones(ctx, width, height, 100);

    } else if (this.state === 'SETTINGS') {
       this.drawSettings(ctx, width, height);
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
       this.drawMilestones(ctx, width, height, height/2 + 100);
    } else {
       ctx.fillText('Score: ' + this.score, 20, 30);
       this.comboManager.draw(ctx, width);
    }

    if (this.state === 'UPGRADE_DRAFT') {
        this.upgradeDraft.draw(ctx, width, height);
    }

    if (this.save.data.settings.showFPS) {
        ctx.fillStyle = '#0f0';
        ctx.textAlign = 'right';
        ctx.font = '16px monospace';
        ctx.fillText(`FPS: ${this.fps}`, width - 10, 20);
    }
  }

  drawMilestones(ctx, width, height, startY) {
      let m = this.save.data.milestones;
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('Milestones:', width/2, startY);

      const badges = [
          { key: 'firstBoss', label: 'Boss Slayer' },
          { key: 'score10k', label: '10k Points' },
          { key: 'score50k', label: '50k Points' },
          { key: 'combo10x', label: '10x Combo' },
          { key: 'combo25x', label: '25x Combo' },
          { key: 'play10Games', label: 'Veteran' },
      ];

      let x = width/2 - 125;
      let y = startY + 25;

      badges.forEach((b, i) => {
          ctx.fillStyle = m[b.key] ? '#fd0' : '#444';
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI*2);
          ctx.fill();
          if (m[b.key]) {
              ctx.fillStyle = '#000';
              ctx.fillText('★', x, y+5);
          }
          ctx.fillStyle = m[b.key] ? '#fff' : '#888';
          ctx.fillText(b.label, x, y + 30);
          x += 50;
      });
  }

  drawSettings(ctx, width, height) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0,0,width,height);
      ctx.fillStyle = '#e09ff1';
      ctx.textAlign = 'center';
      ctx.font = '30px sans-serif';
      ctx.fillText('Settings', width/2, 50);

      ctx.textAlign = 'left';
      ctx.fillText('< Back', 20, 40);

      ctx.font = '20px sans-serif';
      let s = this.save.data.settings;
      let cy = 100;
      let cx = width/2 - 150;

      const drawOption = (label, valStr) => {
          ctx.fillStyle = '#fff';
          ctx.fillText(label, cx, cy);
          ctx.fillStyle = '#0ff';
          ctx.fillText(valStr, cx + 200, cy);
          cy += 40;
      }

      drawOption('Master Volume', Math.round(s.masterVolume*100) + '%');
      drawOption('Music Volume', Math.round(s.musicVolume*100) + '%');
      drawOption('SFX Volume', Math.round(s.sfxVolume*100) + '%');
      drawOption('Screen Shake', s.screenShake === 1 ? '100%' : (s.screenShake === 0.5 ? '50%' : 'Off'));
      drawOption('Particle Density', s.particleDensity === 1 ? 'High' : 'Low');
      drawOption('High Contrast', s.highContrast ? 'On' : 'Off');
      drawOption('Show FPS', s.showFPS ? 'On' : 'Off');
      drawOption('Touch Controls', s.touchMode);
      drawOption('Swap Controls', s.swapControls ? 'Left-handed' : 'Right-handed');

      cy += 20;
      ctx.fillStyle = '#f00';
      ctx.fillText(this.confirmReset ? 'Click again to confirm Reset!' : 'Reset Save Data', cx, cy);

      cy += 40;
      ctx.fillStyle = '#0f0';
      ctx.fillText('Export Save', cx, cy);
      cy += 40;
      ctx.fillText('Import Save', cx, cy);
  }
  loop(t) {
    let dt = Math.min((t - this.lastTime) / 1000, 0.1);
    this.lastTime = t;

    this.frames++;
    if (t - this.lastFpsTime > 1000) {
        this.fps = this.frames;
        this.frames = 0;
        this.lastFpsTime = t;
    }

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

    let hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    let s = game.save.data.settings;
    let showTouch = s.touchMode === 'always' || (s.touchMode === 'auto' && hasTouch);
    if (showTouch) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

        let joyX = s.swapControls ? width - 80 : 80;
        let joyY = height - 80;
        ctx.beginPath();
        ctx.arc(joyX, joyY, 50, 0, Math.PI*2);
        ctx.fill();

        let fireX = s.swapControls ? 80 : width - 80;
        let fireY = height - 80;
        ctx.beginPath();
        ctx.arc(fireX, fireY, 50, 0, Math.PI*2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.fillText('AIM', joyX, joyY + 5);
        ctx.fillText('FIRE', fireX, fireY + 5);

        ctx.textAlign = 'right';
    }

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
