class SaveManager {
  constructor() {
    this.saveKey = 'arcade_game_057_057-abyssal-ricochet_v1';
    this.data = this.load() || this.getDefaults();
  }

  getDefaults() {
    return {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        masterMute: false,
        sfxVolume: 1.0,
        musicVolume: 1.0,
        screenShake: 1.0,
        particles: 'High',
        highContrast: false,
        touchControls: 'Auto'
      }
    };
  }

  load() {
    try {
      const stored = localStorage.getItem(this.saveKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('LocalStorage load failed, using in-memory fallback.', e);
    }
    return null;
  }

  save() {
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(this.data));
    } catch (e) {
      console.warn('LocalStorage save failed.', e);
    }
  }

  updateHighScore(score) {
    if (score > this.data.highScore) {
      this.data.highScore = score;
      this.save();
      return true;
    }
    return false;
  }
}

class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.keysPressed = {};

    this.mouse = { x: 0, y: 0, isDown: false, wasPressed: false };
    this.touch = { x: 0, y: 0, isDown: false, wasPressed: false, startX: 0, startY: 0 };

    this.usingTouch = false;

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      this.keysPressed[e.code] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.updateMousePos(e);
      this.mouse.isDown = true;
      this.mouse.wasPressed = true;
      this.usingTouch = false;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.updateMousePos(e);
    });

    window.addEventListener('mouseup', () => {
      this.mouse.isDown = false;
    });

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.usingTouch = true;
      this.updateTouchPos(e.touches[0]);
      this.touch.startX = this.touch.x;
      this.touch.startY = this.touch.y;
      this.touch.isDown = true;
      this.touch.wasPressed = true;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.updateTouchPos(e.touches[0]);
    }, { passive: false });

    window.addEventListener('touchend', () => {
      this.touch.isDown = false;
    });
  }

  updateMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * scaleX;
    this.mouse.y = (e.clientY - rect.top) * scaleY;
  }

  updateTouchPos(touchInfo) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.touch.x = (touchInfo.clientX - rect.left) * scaleX;
    this.touch.y = (touchInfo.clientY - rect.top) * scaleY;
  }

  isKeyDown(code) {
    return !!this.keys[code];
  }

  wasKeyPressed(code) {
    if (this.keysPressed[code]) {
      this.keysPressed[code] = false;
      return true;
    }
    return false;
  }

  wasMousePressed() {
    if (this.mouse.wasPressed) {
      this.mouse.wasPressed = false;
      return true;
    }
    return false;
  }

  wasTouchPressed() {
    if (this.touch.wasPressed) {
      this.touch.wasPressed = false;
      return true;
    }
    return false;
  }

  resetFrame() {
    this.keysPressed = {};
    this.mouse.wasPressed = false;
    this.touch.wasPressed = false;
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
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.masterGain.gain.value = 0.5;

    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playOscillator(freq, type, duration, vol = 1) {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playBounce() {
    this.playOscillator(440, 'sine', 0.1, 0.5);
  }

  playLaunch() {
    this.playOscillator(150, 'square', 0.2, 0.6);
  }

  playHit() {
    this.playOscillator(100, 'sawtooth', 0.15, 0.7);
  }
}

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.saveManager = new SaveManager();
    this.input = new InputManager(this.canvas);
    this.audio = new SoundEngine();

    this.state = 'TITLE';
    this.lastTime = 0;
    this.score = 0;
    this.wave = 1;

    this.setupResizeObserver();
    this.bindUI();
    this.bindAudioResume();

    this.requestID = null;
  }

  setupResizeObserver() {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        if (entry.target === document.body) {
          this.canvas.width = window.innerWidth;
          this.canvas.height = window.innerHeight;
        }
      }
    });
    resizeObserver.observe(document.body);
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  bindUI() {
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());

    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.setState('PAUSED');
      }
    });
  }

  bindAudioResume() {
    const resumeAudio = () => {
      if (!this.audio.initialized) this.audio.init();
      this.audio.resume();
    };
    window.addEventListener('pointerdown', resumeAudio, { once: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
  }

  setState(newState) {
    document.querySelectorAll('.ui-layer').forEach(el => el.classList.add('hidden'));

    const ui = document.getElementById(`screen-${newState}`);
    if (ui) ui.classList.remove('hidden');

    const hud = document.getElementById('hud');
    if (newState === 'PLAYING') {
      hud.classList.remove('hidden');
    } else {
      hud.classList.add('hidden');
    }

    if (newState === 'GAME_OVER') {
      document.getElementById('finalScore').innerText = Math.floor(this.score);
      this.saveManager.updateHighScore(Math.floor(this.score));
    }

    this.state = newState;
  }

  startGame() {
    this.score = 0;
    this.wave = 1;
    this.setState('PLAYING');

    // Core game entities will be initialized here
    if (typeof Arena !== 'undefined') this.arena = new Arena(this.canvas.width, this.canvas.height);
    if (typeof Player !== 'undefined') this.player = new Player(this.canvas.width/2, this.canvas.height/2);
    if (typeof EnemyManager !== 'undefined') this.enemyManager = new EnemyManager();
    if (typeof ParallaxBackground !== 'undefined') this.background = new ParallaxBackground(this.canvas.width, this.canvas.height);
    if (typeof EnvironmentHazardManager !== 'undefined') this.hazards = new EnvironmentHazardManager();
    if (typeof BossManager !== 'undefined') this.bossManager = new BossManager();
    this.projectiles = [];
  }

  resumeGame() {
    this.setState('PLAYING');
  }

  startLoop() {
    this.lastTime = performance.now();
    this.requestID = requestAnimationFrame((t) => this.loop(t));
  }

  loop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(dt);
    this.draw();

    this.input.resetFrame();
    this.requestID = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    if (this.input.wasKeyPressed('Escape')) {
      this.setState('PAUSED');
      return;
    }

    if (this.background) this.background.update(dt);
    if (this.arena) this.arena.update(dt);
    if (this.player) this.player.update(dt, this.input, this.arena, this.audio);
    if (this.bossManager) this.bossManager.update(dt, this.player, this);
    if (this.enemyManager) this.enemyManager.update(dt, this.player, this);
    if (this.hazards) this.hazards.update(dt, this.arena, this.player, this.enemyManager ? this.enemyManager.enemies : []);

    if (this.projectiles) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            this.projectiles[i].update(dt, this.arena);
            if (this.player && this.projectiles[i].active) {
                const dx = this.player.x - this.projectiles[i].x;
                const dy = this.player.y - this.projectiles[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.player.radius + this.projectiles[i].radius) {
                    if (this.player.invulnerableTimer <= 0) {
                        this.arena.width = Math.max(this.arena.minSize, this.arena.width - 50);
                        this.arena.height = Math.max(this.arena.minSize, this.arena.height - 50);
                        this.player.invulnerableTimer = 1.0;
                        const angle = Math.atan2(dy, dx);
                        this.player.recoil = 1;
                        this.player.recoilAngle = angle;
                        this.audio.playHit();
                    }
                    this.projectiles[i].active = false;
                }
            }
            if (!this.projectiles[i].active) {
                this.projectiles.splice(i, 1);
            }
        }
    }

    document.getElementById('scoreDisplay').innerText = `SCORE: ${Math.floor(this.score)}`;
    document.getElementById('waveDisplay').innerText = `WAVE: ${this.wave}`;

    if (this.player) {
      const abilityDisplay = document.getElementById('abilityDisplay');
      if (this.player.dashCooldown <= 0) {
        abilityDisplay.innerText = 'DASH: READY';
        abilityDisplay.style.color = '#ffeb3b';
      } else {
        abilityDisplay.innerText = `DASH: ${this.player.dashCooldown.toFixed(1)}s`;
        abilityDisplay.style.color = '#70e2f9';
      }
    }
  }

  draw() {
    this.ctx.fillStyle = '#0a0e17';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state !== 'TITLE') {
      if (this.background) this.background.draw(this.ctx);
      if (this.arena) this.arena.draw(this.ctx);
      if (this.hazards) this.hazards.draw(this.ctx);
      if (this.enemyManager) this.enemyManager.draw(this.ctx);
      if (this.bossManager) this.bossManager.draw(this.ctx);
      if (this.player) this.player.draw(this.ctx);
    if (this.projectiles) {
        for (const proj of this.projectiles) {
            proj.draw(this.ctx);
        }
    }
    }
  }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.engine = new GameEngine();
  window.engine.startLoop();
});


class Arena {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.maxWidth = canvasWidth * 0.9;
    this.maxHeight = canvasHeight * 0.9;
    this.width = this.maxWidth;
    this.height = this.maxHeight;
    this.minSize = 150;
    this.shrinkRate = 10; // Pixels per second

    this.x = (this.canvasWidth - this.width) / 2;
    this.y = (this.canvasHeight - this.height) / 2;
  }

  update(dt) {
    if (this.width > this.minSize) {
      this.width -= this.shrinkRate * dt;
    }
    if (this.height > this.minSize) {
      this.height -= this.shrinkRate * dt;
    }

    // Keep it centered
    this.x = (this.canvasWidth - this.width) / 2;
    this.y = (this.canvasHeight - this.height) / 2;
  }

  draw(ctx) {
    ctx.strokeStyle = '#70e2f9'; // accent color
    ctx.lineWidth = 4;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // Draw some shifting inner geometry lines to emphasize the theme
    ctx.strokeStyle = 'rgba(112, 226, 249, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.moveTo(this.x + this.width, this.y);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.stroke();
  }
}


class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.vx = 0;
    this.vy = 0;
    this.speed = 350;
    this.isLaunched = false;
    this.aimAngle = -Math.PI / 2;
    this.dashCooldown = 0;
    this.maxDashCooldown = 2;
    this.isDashing = false;
    this.dashTimer = 0;
    this.invulnerableTimer = 0;
    this.recoil = 0;
    this.recoilAngle = 0;
    this.thrustAnim = 0;
    this.trail = [];
  }

  update(dt, input, arena, audio) {
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTimer = Math.max(0, this.dashTimer - dt);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    this.recoil = Math.max(0, this.recoil - dt * 5);
    this.thrustAnim += dt * 10;

    if (this.dashTimer <= 0) {
      this.isDashing = false;
    }

    if (!this.isLaunched) {
      this.handleAiming(input, arena);
      return;
    }

    // Track trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 10) this.trail.shift();

    // Dash input check
    const touchDoubleTap = input.usingTouch && input.wasTouchPressed();
    if ((input.wasKeyPressed('ShiftLeft') || touchDoubleTap) && this.dashCooldown <= 0) {
      this.isDashing = true;
      this.dashTimer = 0.3;
      this.dashCooldown = this.maxDashCooldown;
      this.invulnerableTimer = 0.5;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > 0) {
        this.vx += (this.vx / speed) * 600;
        this.vy += (this.vy / speed) * 600;
      }
      if (window.engine) window.engine.audio.playLaunch();
    }

    // Apply friction/damping
    const frictionBase = this.isDashing ? 0.995 : 0.985;
    const friction = Math.pow(frictionBase, dt * 60);
    this.vx *= friction;
    this.vy *= friction;

    // Check if stopped
    const currentSpeedSq = this.vx * this.vx + this.vy * this.vy;
    if (currentSpeedSq < 40) { // Threshold for stopping
      this.isLaunched = false;
      this.vx = 0;
      this.vy = 0;
      this.trail = [];
      return;
    }

    // Move player
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Check collisions with arena boundaries
    let bounced = false;

    // Left boundary
    if (this.x - this.radius < arena.x) {
      this.x = arena.x + this.radius;
      this.vx = -this.vx;
      this.recoil = 1;
      this.recoilAngle = 0;
      bounced = true;
    }
    // Right boundary
    else if (this.x + this.radius > arena.x + arena.width) {
      this.x = arena.x + arena.width - this.radius;
      this.vx = -this.vx;
      this.recoil = 1;
      this.recoilAngle = Math.PI;
      bounced = true;
    }

    // Top boundary
    if (this.y - this.radius < arena.y) {
      this.y = arena.y + this.radius;
      this.vy = -this.vy;
      this.recoil = 1;
      this.recoilAngle = Math.PI / 2;
      bounced = true;
    }
    // Bottom boundary
    else if (this.y + this.radius > arena.y + arena.height) {
      this.y = arena.y + arena.height - this.radius;
      this.vy = -this.vy;
      this.recoil = 1;
      this.recoilAngle = -Math.PI / 2;
      bounced = true;
    }

    if (bounced) {
      audio.playBounce();
    }

    // Check if player gets squished by the shrinking arena
    const minimumSafeSize = this.radius * 2 + 10; // Player diameter + buffer
    if (arena.width <= minimumSafeSize || arena.height <= minimumSafeSize) {
        if (window.engine) {
          window.engine.setState('GAME_OVER');
          audio.playHit();
        }
    }
  }

  handleAiming(input, arena) {
    // Keep player in center of current arena while aiming
    this.x = arena.x + arena.width / 2;
    this.y = arena.y + arena.height / 2;

    if (input.keys['ArrowLeft'] || input.keys['KeyA']) {
      this.aimAngle -= 3 * 0.016; // Approx dt
    }
    if (input.keys['ArrowRight'] || input.keys['KeyD']) {
      this.aimAngle += 3 * 0.016;
    }

    if (input.usingTouch || input.mouse.isDown) {
        const targetX = input.usingTouch ? input.touch.x : input.mouse.x;
        const targetY = input.usingTouch ? input.touch.y : input.mouse.y;
        this.aimAngle = Math.atan2(targetY - this.y, targetX - this.x);
    }

    const touchReleased = input.usingTouch && !input.touch.isDown && input.touch.wasPressed;
    const mouseReleased = !input.usingTouch && !input.mouse.isDown && input.mouse.wasPressed;

    if (input.wasKeyPressed('Space') || touchReleased || mouseReleased) {
      this.isLaunched = true;
      this.vx = Math.cos(this.aimAngle) * this.speed;
      this.vy = Math.sin(this.aimAngle) * this.speed;
      if (window.engine) window.engine.audio.playLaunch();
    }
  }

  draw(ctx) {
    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 20) % 2 === 0) return;

    // Draw fading trails
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = (i + 1) / this.trail.length * 0.4;
      ctx.fillStyle = `rgba(112, 226, 249, ${alpha})`;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, this.radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.recoilAngle);
    ctx.scale(1 - this.recoil * 0.4, 1 + this.recoil * 0.4);
    ctx.rotate(-this.recoilAngle);

    // Outer pulsing ring
    const pulseRadius = this.radius * (1 + 0.2 * Math.sin(this.thrustAnim));
    ctx.strokeStyle = this.isDashing ? '#ffeb3b' : 'rgba(112, 226, 249, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Core circle
    ctx.fillStyle = this.isDashing ? '#ffeb3b' : '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    if (this.isLaunched) {
      const moveAngle = Math.atan2(this.vy, this.vx);
      ctx.rotate(moveAngle);

      // Engine thrust
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(-this.radius, -this.radius * 0.5);
      ctx.lineTo(-this.radius * (1.5 + Math.random() * 0.5), 0);
      ctx.lineTo(-this.radius, this.radius * 0.5);
      ctx.closePath();
      ctx.fill();

      // Nose polygon
      ctx.fillStyle = '#70e2f9';
      ctx.beginPath();
      ctx.moveTo(this.radius * 0.5, -this.radius * 0.5);
      ctx.lineTo(this.radius * 1.5, 0);
      ctx.lineTo(this.radius * 0.5, this.radius * 0.5);
      ctx.closePath();
      ctx.fill();

      ctx.rotate(-moveAngle);
    }

    ctx.restore();

    if (!this.isLaunched) {
      // Draw aiming line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.aimAngle) * 50, this.y + Math.sin(this.aimAngle) * 50);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}


class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 15;
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = (Math.random() - 0.5) * 50;
    this.active = true;
  }

  update(dt, arena) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Bounce off arena edges softly to stay inside
    if (this.x - this.radius < arena.x) { this.x = arena.x + this.radius; this.vx *= -1; }
    if (this.x + this.radius > arena.x + arena.width) { this.x = arena.x + arena.width - this.radius; this.vx *= -1; }
    if (this.y - this.radius < arena.y) { this.y = arena.y + this.radius; this.vy *= -1; }
    if (this.y + this.radius > arena.y + arena.height) { this.y = arena.y + arena.height - this.radius; this.vy *= -1; }
  }

  draw(ctx) {
    ctx.fillStyle = '#ff4444'; // Red enemy
    ctx.beginPath();
    // Draw a diamond shape for the abyssal entity
    ctx.moveTo(this.x, this.y - this.radius);
    ctx.lineTo(this.x + this.radius, this.y);
    ctx.lineTo(this.x, this.y + this.radius);
    ctx.lineTo(this.x - this.radius, this.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

class EnemyManager {
  constructor() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2; // Spawn an enemy every 2 seconds
  }

  update(dt, player, engine) {
    if (!player.isLaunched) return; // Don't spawn/update until game starts

    if (!engine.bossManager || (!engine.bossManager.activeBoss && engine.bossManager.warningTimer <= 0)) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0;
          this.spawnEnemy(engine.arena);
        }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      let enemy = this.enemies[i];
      enemy.update(dt, engine.arena, player, engine);

      // Collision detection with player
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let hitPlayer = false;
      if (typeof Hazard !== 'undefined' && enemy instanceof Hazard) {
          if (!enemy.warningPhase && dist < player.radius + enemy.radius) {
              hitPlayer = true;
          }
      } else if (dist < player.radius + enemy.radius) {
          hitPlayer = true;
      }

      if (hitPlayer) {
        const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
        const angle = Math.atan2(dy, dx);

        if (speed < 100 && !player.isDashing) {
          // Penalize player if moving too slow and not dashing
          if (player.invulnerableTimer <= 0) {
            engine.arena.width = Math.max(engine.arena.minSize, engine.arena.width - 50);
            engine.arena.height = Math.max(engine.arena.minSize, engine.arena.height - 50);
            player.invulnerableTimer = 1.0;
            player.recoil = 1;
            player.recoilAngle = angle + Math.PI;

            // Bounce enemy away
            enemy.vx = Math.cos(angle + Math.PI) * 200;
            enemy.vy = Math.sin(angle + Math.PI) * 200;

            engine.audio.playHit();
          }
        } else {
          // Hit
          let died = true;
          if (typeof enemy.takeHit === 'function') {
              died = enemy.takeHit();
          } else {
              enemy.active = false;
          }

          if (died) {
              enemy.active = false;
              engine.score += 100;
              if (typeof Spawner !== 'undefined' && enemy instanceof Spawner) {
                  for (let j = 0; j < 3; j++) {
                      let swarmer = new Swarmer(enemy.x, enemy.y);
                      swarmer.vx = (Math.random() - 0.5) * 200;
                      swarmer.vy = (Math.random() - 0.5) * 200;
                      this.enemies.push(swarmer);
                  }
              }
          }

          engine.audio.playHit();

          if (!player.isDashing) {
            // Bounce player slightly off enemy
            player.vx = Math.cos(angle) * speed * 0.85; // Retain 85% speed
            player.vy = Math.sin(angle) * speed * 0.85;
          } else {
            // Dash bonus
            engine.score += 50;
          }
        }
      }

      if (!enemy.active) {
        this.enemies.splice(i, 1);
      }
    }

    // Wave progression logic: if score passes threshold, increase wave and expand arena slightly
    const targetWave = Math.floor(engine.score / 1000) + 1;
    if (targetWave > engine.wave) {
        engine.wave = targetWave;
        // Reward: expand arena slightly
        engine.arena.width = Math.min(engine.arena.maxWidth, engine.arena.width + 100);
        engine.arena.height = Math.min(engine.arena.maxHeight, engine.arena.height + 100);
        engine.arena.shrinkRate += 2; // Make it harder
        if (engine.wave % 5 === 0 && engine.bossManager && (!engine.bossManager.activeBoss && engine.bossManager.warningTimer <= 0)) {
            engine.bossManager.triggerBoss(engine.wave, engine);
        }
    }
  }

  spawnEnemy(arena) {
    if (arena.width <= 0 || arena.height <= 0) return;
    const x = arena.x + Math.random() * arena.width;
    const y = arena.y + Math.random() * arena.height;

    let r = Math.random();
    if (r < 0.2) {
        this.enemies.push(new Swarmer(x, y));
    } else if (r < 0.4) {
        this.enemies.push(new Sniper(x, y));
    } else if (r < 0.6) {
        this.enemies.push(new Bruiser(x, y));
    } else if (r < 0.8) {
        this.enemies.push(new Spawner(x, y));
    } else {
        this.enemies.push(new Hazard(x, y));
    }
  }

  draw(ctx) {
    for (const enemy of this.enemies) {
      enemy.draw(ctx);
    }
  }
}

class AnalyticsTracker {
  constructor() {
    this.events = [];
    this.sessionStart = performance.now();
    this.dashCount = 0;
    this.wallBounces = 0;
    this.enemiesDefeated = 0;
  }

  logEvent(name, data) {
    this.events.push({
      time: performance.now() - this.sessionStart,
      name: name,
      data: data
    });
  }

  logDash() {
    this.dashCount++;
    this.logEvent("dash_used", { total: this.dashCount });
  }

  logBounce() {
    this.wallBounces++;
    this.logEvent("wall_bounce", { total: this.wallBounces });
  }

  logEnemyDefeated(bonus) {
    this.enemiesDefeated++;
    this.logEvent("enemy_defeated", { total: this.enemiesDefeated, bonus: bonus });
  }

  getSummary() {
    return {
      playTime: (performance.now() - this.sessionStart) / 1000,
      dashes: this.dashCount,
      bounces: this.wallBounces,
      kills: this.enemiesDefeated,
      eventCount: this.events.length
    };
  }
}
