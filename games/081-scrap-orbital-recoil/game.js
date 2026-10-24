// Scrap Orbital Recoil - Phase 1 Foundation
const GAME_ID = "081";
const GAME_SLUG = "081-scrap-orbital-recoil";
const SAVE_KEY = "arcade_game_081_081-scrap-orbital-recoil_v1";

class SaveManager {
  constructor() {
    this.data = {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        masterVolume: 1.0,
        sfxVolume: 1.0,
        musicVolume: 1.0,
        screenShake: 1.0,
        particles: 'High',
        highContrast: false,
        showFps: true
      }
    };
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = {
          ...this.data,
          ...parsed,
          options: {
            ...this.data.options,
            ...(parsed.options || {})
          }
        };
      }
    } catch (e) {
      console.warn("SaveManager: Failed to load data", e);
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn("SaveManager: Failed to save data", e);
    }
  }

  updateScore(score) {
    if (score > this.data.highScore) {
      this.data.highScore = score;
    }
    this.data.totalScoreAccumulated += score;
    this.save();
  }

  incrementGamesPlayed() {
    this.data.totalGamesPlayed += 1;
    this.save();
  }
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.initialized = true;
    } catch (e) {
      console.warn("SoundEngine: Web Audio API not supported", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolumes(options) {
    if (!this.initialized) return;
    this.masterGain.gain.value = options.masterVolume;
    this.sfxGain.gain.value = options.sfxVolume;
    this.musicGain.gain.value = options.musicVolume;
  }

  playShoot() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.1);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.1);
  }

  playHit() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  playExplosion() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(100, t + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
  }

  playThrust() {
    if (!this.initialized) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.linearRampToValueAtTime(100, t + 0.2);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }
}

class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, click: false };
    this.touches = [];
    this.pointerDown = false;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });

    this.anyKeyOrClick = false;
  }

  onKeyDown(e) {
    this.keys[e.code] = true;
    this.anyKeyOrClick = true;
  }

  onKeyUp(e) {
    this.keys[e.code] = false;
  }

  updateMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * scaleX;
    this.mouse.y = (e.clientY - rect.top) * scaleY;
  }

  onMouseDown(e) {
    this.updateMousePos(e);
    if (e.button === 2) {
      this.mouse.rightDown = true;
    } else {
      this.mouse.down = true;
      this.mouse.click = true;
    }
    this.pointerDown = true;
    this.anyKeyOrClick = true;
  }

  onMouseMove(e) {
    this.updateMousePos(e);
  }

  onMouseUp(e) {
    if (e.button === 2) {
      this.mouse.rightDown = false;
    } else {
      this.mouse.down = false;
    }
    this.pointerDown = false;
  }

  onTouchStart(e) {
    e.preventDefault();
    this.touches = Array.from(e.touches);
    if (this.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (this.touches[0].clientX - rect.left) * scaleX;
      this.mouse.y = (this.touches[0].clientY - rect.top) * scaleY;
      this.mouse.down = true;
      this.mouse.click = true;
      this.pointerDown = true;
      this.anyKeyOrClick = true;
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    this.touches = Array.from(e.touches);
    if (this.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (this.touches[0].clientX - rect.left) * scaleX;
      this.mouse.y = (this.touches[0].clientY - rect.top) * scaleY;
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    this.touches = Array.from(e.touches);
    if (this.touches.length === 0) {
      this.mouse.down = false;
      this.pointerDown = false;
    }
  }

  consumeClick() {
    if (this.mouse.click) {
      this.mouse.click = false;
      return true;
    }
    return false;
  }

  consumeAnyInput() {
    if (this.anyKeyOrClick) {
      this.anyKeyOrClick = false;
      return true;
    }
    return false;
  }
}

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() {
    const m = this.mag();
    if (m !== 0) this.div(m);
    return this;
  }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector2(this.x, this.y); }
  dist(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  heading() { return Math.atan2(this.y, this.x); }
  static fromAngle(angle) { return new Vector2(Math.cos(angle), Math.sin(angle)); }
}

class Entity {
  constructor(x, y, radius) {
    this.pos = new Vector2(x, y);
    this.vel = new Vector2(0, 0);
    this.acc = new Vector2(0, 0);
    this.radius = radius;
    this.active = true;
    this.color = '#fff';
    this.health = 1;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update(dt) {
    this.vel.add(this.acc.copy().mult(dt));
    this.pos.add(this.vel.copy().mult(dt));
    this.acc.set(0, 0);
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }

  checkCollision(other) {
    if (!this.active || !other.active) return false;
    return this.pos.dist(other.pos) < this.radius + other.radius;
  }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y, 15);
    this.color = '#b48ff0';
    this.health = 3;
    this.maxHealth = 3;
    this.angle = 0;
    this.lastShot = 0;
    this.shootDelay = 0.2;
    this.recoilForce = 500;
    this.invulnTimer = 0;

    // Dash / Overdrive Ability
    this.dashCooldown = 3.0;
    this.dashTimer = 0;
    this.dashDuration = 0.2;
    this.dashTime = 0;
    this.dashForce = 1500;

    // Procedural animation state
    this.recoilOffset = 0; // Visual recoil pullback
    this.thrustPower = 0;  // Visual engine flare
  }

  update(dt, game) {
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // Aiming towards mouse
    const targetDir = new Vector2(game.input.mouse.x - this.pos.x, game.input.mouse.y - this.pos.y);
    if (targetDir.magSq() > 0) {
      this.angle = targetDir.heading();
    }

    // Auto-fire or click-to-fire based on input
    if ((game.input.mouse.down || game.input.keys['Space']) && game.time - this.lastShot > this.shootDelay) {
      this.shoot(game);
      this.lastShot = game.time;
    }

    super.update(dt);

    // Dash Ability Logic
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.dashTime > 0) this.dashTime -= dt;

    if ((game.input.keys['ShiftLeft'] || game.input.keys['ShiftRight'] || game.input.mouse.rightDown) && this.dashTimer <= 0) {
      this.dashTime = this.dashDuration;
      this.dashTimer = this.dashCooldown;
      this.invulnTimer = Math.max(this.invulnTimer, this.dashDuration); // Invuln while dashing

      const dashDir = Vector2.fromAngle(this.angle);
      this.vel.add(dashDir.mult(this.dashForce));

      game.spawnParticles(this.pos.x, this.pos.y, 15, '#44ff44', dashDir.mult(-1));
      game.sound.playShoot();
    }

    if (this.dashTime > 0) {
      if (Math.random() < 0.5) {
        game.spawnParticles(this.pos.x, this.pos.y, 2, '#44ff44', this.vel.copy().normalize().mult(-1));
      }
    }

    // Procedural animation update
    if (this.recoilOffset > 0) this.recoilOffset -= dt * 50;
    if (this.recoilOffset < 0) this.recoilOffset = 0;

    this.thrustPower = this.dashTime > 0 ? 2.0 : (this.vel.mag() / 500);

    // Dampen velocity
    if (this.dashTime > 0) {
       this.vel.mult(0.92); // Tighter friction during dash to make it short and snappy
    } else {
       this.vel.mult(0.98); // Slightly tighter base friction for better momentum tuning
    }

    // Keep in bounds loosely (bounce off walls)
    if (this.pos.x < this.radius) { this.pos.x = this.radius; this.vel.x *= -0.5; }
    if (this.pos.x > game.width - this.radius) { this.pos.x = game.width - this.radius; this.vel.x *= -0.5; }
    if (this.pos.y < this.radius) { this.pos.y = this.radius; this.vel.y *= -0.5; }
    if (this.pos.y > game.height - this.radius) { this.pos.y = game.height - this.radius; this.vel.y *= -0.5; }
  }

  shoot(game) {
    const dir = Vector2.fromAngle(this.angle);

    this.recoilOffset = 8; // Visual recoil pullback

    // Recoil (opposite to aim direction)
    const recoil = dir.copy().mult(-this.recoilForce);
    this.applyForce(recoil);

    // Spawn projectile
    const projPos = this.pos.copy().add(dir.copy().mult(this.radius + 5));
    const projVel = dir.copy().mult(800);
    game.spawnProjectile(projPos, projVel);

    game.sound.playShoot();

    // Spawns some particles
    game.spawnParticles(this.pos.x, this.pos.y, 5, this.color, dir.mult(-1));
  }

  hit(game) {
    if (this.invulnTimer > 0) return;
    this.health--;
    this.invulnTimer = 1.0;
    game.sound.playHit();
    game.spawnParticles(this.pos.x, this.pos.y, 20, '#ff4444');

    // Intense knockback towards center (gravity pull effect on hit)
    const center = new Vector2(game.width / 2, game.height / 2);
    const dir = center.copy().sub(this.pos).normalize();
    this.vel.add(dir.mult(400));

    if (this.health <= 0) {
      this.active = false;
      game.sound.playExplosion();
      game.setGameOver();
    }
  }

  draw(ctx) {
    const isBlinking = this.invulnTimer > 0 && Math.floor(this.invulnTimer * 15) % 2 === 0;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.angle);

    // Aim Telegraph (faint laser line)
    ctx.strokeStyle = 'rgba(180, 143, 240, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(800, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    if (isBlinking) {
       ctx.globalAlpha = 0.3;
    }

    // Engine Thrust (Procedural)
    const thrustSize = 5 + this.thrustPower * 15;
    ctx.fillStyle = this.dashTime > 0 ? '#44ff44' : '#ff8800';
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-10 - thrustSize, 0);
    ctx.lineTo(-10, 6);
    ctx.fill();

    // Draw scrap robot core body
    ctx.fillStyle = this.dashTime > 0 ? '#ddd' : '#555';
    ctx.fillRect(-10, -10, 20, 20);

    // Side plates
    ctx.fillStyle = '#777';
    ctx.fillRect(-8, -14, 16, 4);
    ctx.fillRect(-8, 10, 16, 4);

    // Blaster (front) with recoil offset
    ctx.save();
    ctx.translate(-this.recoilOffset, 0);
    ctx.fillStyle = this.color;
    ctx.fillRect(10, -5, 14, 10);
    // Barrel detail
    ctx.fillStyle = '#333';
    ctx.fillRect(20, -3, 6, 6);
    ctx.restore();

    // Additional decorative parts
    ctx.fillStyle = '#999';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw some cool dash visual effects
    if (this.dashTime > 0) {
      ctx.strokeStyle = '#44ff44';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const fxRadius = 15 + (1 - this.dashTime / this.dashDuration) * 10;
      ctx.arc(0, 0, fxRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Secondary ring
      ctx.strokeStyle = 'rgba(68, 255, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, fxRadius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw dynamic energy core depending on health and dash state
    if (this.dashTimer <= 0) {
       ctx.fillStyle = '#44ff44';
    } else {
       ctx.fillStyle = '#ff8800';
    }

    if (this.health === 1) {
       ctx.fillStyle = '#ff4444';
    }

    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw structural lines for mechanical look
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.lineTo(10, -10);
    ctx.stroke();

    ctx.restore();
  }
}

class Projectile extends Entity {
  constructor(pos, vel) {
    super(pos.x, pos.y, 4);
    this.vel = vel.copy();
    this.color = '#fff';
    this.life = 2.0;
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
    ctx.fillStyle = '#ffddaa';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Enemy extends Entity {
  constructor(x, y) {
    super(x, y, 12);
    this.color = '#ff4444';
    this.speed = 100 + Math.random() * 50;
    this.health = 2;
    this.points = 100;
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.orbitRadius = 200 + Math.random() * 100;
  }

  update(dt, game) {
    // Gravity Action: Enemies orbit the center, but slowly drift towards player
    const center = new Vector2(game.width / 2, game.height / 2);
    this.orbitAngle += dt * 0.5;

    const targetOrbitX = center.x + Math.cos(this.orbitAngle) * this.orbitRadius;
    const targetOrbitY = center.y + Math.sin(this.orbitAngle) * this.orbitRadius;

    const dirToOrbit = new Vector2(targetOrbitX - this.pos.x, targetOrbitY - this.pos.y).normalize();

    if (game.player && game.player.active) {
      const dirToPlayer = new Vector2(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y).normalize();
      // Blend orbit with chasing player
      this.vel = dirToOrbit.mult(this.speed * 0.4).add(dirToPlayer.mult(this.speed * 0.6));
    } else {
      this.vel = dirToOrbit.mult(this.speed);
    }

    super.update(dt);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.orbitAngle * 2); // Spin

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(10, -10);
    ctx.lineTo(10, 10);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.stroke();

    // Core
    ctx.fillStyle = '#aa2222';
    ctx.fillRect(-4, -4, 8, 8);

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
    }
  }
}

class GravityWell extends Entity {
  constructor(x, y) {
    super(x, y, 40);
    this.pullStrength = 10000;
  }

  update(dt, game) {
    // Apply gravity to player and debris/particles
    if (game.player && game.player.active) {
      const dir = this.pos.copy().sub(game.player.pos);
      const distSq = Math.max(dir.magSq(), 1000);
      const forceMag = this.pullStrength / distSq;
      game.player.applyForce(dir.normalize().mult(forceMag));
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Pulsing core
    const time = Date.now() / 200;
    const pulse = Math.sin(time) * 5;

    ctx.fillStyle = 'rgba(180, 143, 240, 0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 20 + pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(180, 143, 240, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#b48ff0';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

class Particle extends Entity {
  constructor(x, y, color, baseDir = null) {
    super(x, y, 2 + Math.random() * 3);
    this.color = color;
    const angle = baseDir ? baseDir.heading() + (Math.random() - 0.5) : Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 150;
    this.vel = Vector2.fromAngle(angle).mult(speed);
    this.life = 0.5 + Math.random() * 0.5;
    this.maxLife = this.life;
  }

  update(dt) {
    super.update(dt);
    this.vel.mult(0.95); // drag
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  draw(ctx) {
    const alpha = this.life / this.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.pos.x - this.radius, this.pos.y - this.radius, this.radius * 2, this.radius * 2);
    ctx.globalAlpha = 1.0;
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.input = new InputManager(canvas);
    this.saveManager = new SaveManager();
    this.sound = new SoundEngine();
    this.worldManager = new WorldManager(this);

    this.width = 800;
    this.height = 600;

    this.state = 'TITLE'; // TITLE, PLAYING, GAME_OVER, PAUSED

    this.lastTime = performance.now();
    this.time = 0;

    this.entities = [];
    this.particles = [];
    this.projectiles = [];
    this.enemies = [];

    this.player = null;
    this.gravityWell = null;

    this.score = 0;
    this.wave = 1;
    this.enemySpawnTimer = 0;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();

    window.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.state = 'PAUSED';
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
      }
    });

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();

    // Maintain aspect ratio or fill, let's fill
    this.width = rect.width;
    this.height = rect.height;

    // For high DPI
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;

    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(dpr, dpr);

    if (this.gravityWell) {
      this.gravityWell.pos.set(this.width / 2, this.height / 2);
    }
  }

  initGame() {
    this.sound.init();
    this.sound.resume();

    this.state = 'PLAYING';
    this.score = 0;
    this.wave = 1;
    this.time = 0;
    this.enemySpawnTimer = 2.0;

    this.entities = [];
    this.particles = [];
    this.projectiles = [];
    this.enemies = [];

    this.player = new Player(this.width / 2 - 100, this.height / 2);
    this.gravityWell = new GravityWell(this.width / 2, this.height / 2);

    this.worldManager.init();
    this.saveManager.incrementGamesPlayed();
  }

  setGameOver() {
    this.state = 'GAME_OVER';
    this.saveManager.updateScore(this.score);
  }

  spawnProjectile(pos, vel) {
    this.projectiles.push(new Projectile(pos, vel));
  }

  spawnParticles(x, y, count, color, baseDir = null) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, color, baseDir));
    }
  }

  spawnEnemy() {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.max(this.width, this.height) / 2 + 50;
    const x = this.width / 2 + Math.cos(angle) * dist;
    const y = this.height / 2 + Math.sin(angle) * dist;
    this.enemies.push(new Enemy(x, y));
  }

  update(dt) {
    if (this.state === 'TITLE') {
      if (this.input.consumeAnyInput()) {
        this.initGame();
      }
      return;
    }

    if (this.state === 'GAME_OVER') {
      if (this.input.consumeAnyInput()) {
        this.state = 'TITLE';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.consumeAnyInput() || this.input.keys['Escape']) {
        this.state = 'PLAYING';
        this.sound.resume();
      }
      return;
    }

    if (this.input.keys['Escape']) {
      this.state = 'PAUSED';
      this.input.keys['Escape'] = false;
    }

    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
      this.spawnEnemy();
      this.enemySpawnTimer = Math.max(0.5, 2.0 - (this.wave * 0.1));
    }

    // Every 1000 points, wave increases
    this.wave = Math.floor(this.score / 1000) + 1;

    if (this.player && this.player.active) {
      this.player.update(dt, this);
    }

    if (this.gravityWell) {
      this.gravityWell.update(dt, this);
    }

    this.worldManager.update(dt);

    // Update collections
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt, this);
      if (!p.active) this.projectiles.splice(i, 1);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, this);

      // Check collision with player
      if (this.player && this.player.active && e.checkCollision(this.player)) {
        this.player.hit(this);
        e.active = false;
      }

      // Check collision with gravity well (eaten)
      if (this.gravityWell && e.checkCollision(this.gravityWell)) {
        e.active = false;
        this.spawnParticles(e.pos.x, e.pos.y, 10, '#b48ff0');
      }

      if (!e.active) this.enemies.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update(dt);
      if (!p.active) this.particles.splice(i, 1);
    }

    // Projectile vs Enemy collisions
    for (let p of this.projectiles) {
      if (!p.active) continue;
      for (let e of this.enemies) {
        if (!e.active) continue;
        if (p.checkCollision(e)) {
          p.active = false;
          e.hit(this);
          break;
        }
      }
    }
  }

  draw() {
    this.ctx.fillStyle = '#0a0a0c'; // space background
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.worldManager.drawBackground(this.ctx);

    // Draw grid
    this.ctx.strokeStyle = '#222';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    const cellSize = 50;
    for(let x = 0; x < this.width; x += cellSize) {
      this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height);
    }
    for(let y = 0; y < this.height; y += cellSize) {
      this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y);
    }
    this.ctx.stroke();

    if (this.state === 'TITLE') {
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px sans-serif';
      this.ctx.fillText("SCRAP ORBITAL RECOIL", this.width / 2, this.height / 2 - 40);
      this.ctx.font = '20px sans-serif';
      this.ctx.fillStyle = '#aaa';
      this.ctx.fillText("Click or Press Any Key to Start", this.width / 2, this.height / 2 + 20);

      this.ctx.font = '16px sans-serif';
      this.ctx.fillStyle = '#b48ff0';
      this.ctx.fillText("High Score: " + this.saveManager.data.highScore, this.width / 2, this.height / 2 + 60);

      this.ctx.fillStyle = '#888';
      this.ctx.fillText("Aim: Mouse | Fire: Click/Space | Dash: Right-Click/Shift | Recoil propels you!", this.width / 2, this.height - 40);

      // Render some aesthetic floating bits on title screen
      const timer = Date.now() / 1000;
      this.ctx.fillStyle = '#444';
      for(let i=0; i<10; i++) {
        const ax = this.width / 2 + Math.cos(timer + i) * 150;
        const ay = this.height / 2 + Math.sin(timer * 1.5 + i) * 100;
        this.ctx.fillRect(ax, ay, 4, 4);
      }

      return;
    }

    if (this.gravityWell) this.gravityWell.draw(this.ctx);

    this.worldManager.drawHazards(this.ctx);

    for (let p of this.particles) p.draw(this.ctx);
    for (let e of this.enemies) e.draw(this.ctx);
    for (let p of this.projectiles) p.draw(this.ctx);

    if (this.player && this.player.active) {
      this.player.draw(this.ctx);
    }

    // UI
    if (this.state === 'PLAYING' || this.state === 'GAME_OVER' || this.state === 'PAUSED') {
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'left';
      this.ctx.font = '20px sans-serif';
      this.ctx.fillText("Score: " + this.score, 20, 40);
      this.ctx.fillText("Wave: " + this.wave, 20, 70);

      if (this.player) {
        this.ctx.fillText("HP: ", 20, 100);
        for(let i=0; i<this.player.maxHealth; i++) {
          this.ctx.fillStyle = i < this.player.health ? '#ff4444' : '#555';
          this.ctx.fillRect(60 + i * 25, 85, 20, 20);
        }

        // Dash Cooldown HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText("DASH: ", 20, 130);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(90, 115, 100, 15);
        if (this.player.dashTimer <= 0) {
          this.ctx.fillStyle = '#44ff44';
          this.ctx.fillRect(90, 115, 100, 15);
        } else {
          this.ctx.fillStyle = '#ff8800';
          const pct = 1.0 - (this.player.dashTimer / this.player.dashCooldown);
          this.ctx.fillRect(90, 115, 100 * pct, 15);
        }
      }
    }

    if (this.state === 'GAME_OVER') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#ff4444';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px sans-serif';
      this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 20);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '20px sans-serif';
      this.ctx.fillText("Final Score: " + this.score, this.width / 2, this.height / 2 + 20);
      this.ctx.fillStyle = '#aaa';
      this.ctx.fillText("Click or Press Any Key to Restart", this.width / 2, this.height / 2 + 60);
    }

    if (this.state === 'PAUSED') {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px sans-serif';
      this.ctx.fillText("PAUSED", this.width / 2, this.height / 2);
      this.ctx.font = '20px sans-serif';
      this.ctx.fillStyle = '#aaa';
      this.ctx.fillText("Click or Press Escape to Resume", this.width / 2, this.height / 2 + 40);
    }
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    let dt = (now - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1;
    this.lastTime = now;
    this.time += dt;

    this.update(dt);
    this.draw();
  }
}

window.onload = () => {
  const canvas = document.getElementById('gameCanvas');
  window.game = new Game(canvas);
};
