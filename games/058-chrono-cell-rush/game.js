class SaveManager {
  constructor() {
    this.saveKey = 'arcade_game_058_058-chrono-cell-rush_v1';
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
      if (stored) return JSON.parse(stored);
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

  playShoot() {
    this.playOscillator(800, 'sine', 0.05, 0.4);
  }

  playHit() {
    this.playOscillator(150, 'sawtooth', 0.1, 0.6);
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
    this.timeDilation = 1.0;
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

    if (typeof EffectsManager !== 'undefined') this.effectsManager = new EffectsManager();

    if (typeof Player !== 'undefined') this.player = new Player(this.canvas.width/2, this.canvas.height/2);
    if (typeof EnemyManager !== 'undefined') this.enemyManager = new EnemyManager();
    if (typeof EnvironmentManager !== 'undefined') this.environmentManager = new EnvironmentManager(this.canvas.width, this.canvas.height);
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

    document.getElementById('scoreDisplay').innerText = `SCORE: ${Math.floor(this.score)}`;
    document.getElementById('waveDisplay').innerText = `WAVE: ${this.wave}`;
    if (this.player) {
      let dashDisplay = document.getElementById('dashDisplay');
      if (dashDisplay) {
        if (this.player.dashTimer > 0) {
          dashDisplay.innerText = `DASH: ${this.player.dashTimer.toFixed(1)}s`;
          dashDisplay.style.color = '#ff4444';
        } else {
          dashDisplay.innerText = `DASH: READY`;
          dashDisplay.style.color = '#70e2f9';
        }
      }
    }

    // Update player
    if (this.player) this.player.update(dt, this.input);

    // Update enemies using dilated time
    const dilatedDt = dt * this.timeDilation;
    if (this.environmentManager) this.environmentManager.update(dilatedDt, this.player, this.enemyManager);
    if (this.effectsManager) this.effectsManager.update(dilatedDt);
    if (this.enemyManager) this.enemyManager.update(dilatedDt, this.player);
  }

  draw() {
    this.ctx.fillStyle = '#11151c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'PLAYING') {
      if (this.environmentManager) this.environmentManager.drawBackground(this.ctx);
      if (this.effectsManager) this.effectsManager.draw(this.ctx);
      if (this.environmentManager) this.environmentManager.drawHazards(this.ctx);
      if (this.enemyManager) this.enemyManager.draw(this.ctx);
      if (this.player) this.player.draw(this.ctx);
      if (this.environmentManager) this.environmentManager.drawForeground(this.ctx);
    }
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.baseSpeed = 200;
    this.speed = 200;
    this.color = '#70e2f9';
    this.shootTimer = 0;
    this.shootCooldown = 0.2;
    this.bullets = [];

    // Dash ability
    this.dashTimer = 0;
    this.dashCooldown = 3.0;
    this.dashDurationTimer = 0;
    this.dashDuration = 0.2;
    this.isDashing = false;
    this.dashDirX = 0;
    this.dashDirY = 0;
    this.speedMultiplier = 1.0;

    // Momentum / Recoil
    this.vx = 0;
    this.vy = 0;
    this.recoilTimer = 0;

    // Visuals
    this.aimAngle = 0;
    this.thrustParticles = [];
  }

  update(dt, input) {
    let dx = 0;
    let dy = 0;

    if (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) dy -= 1;
    if (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) dy += 1;
    if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) dx -= 1;
    if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) dx += 1;

    let targetX = this.x;
    let targetY = this.y;
    if (input.usingTouch && input.touch.isDown) {
       targetX = input.touch.x;
       targetY = input.touch.y;
    } else {
       targetX = input.mouse.x;
       targetY = input.mouse.y;
    }
    this.aimAngle = Math.atan2(targetY - this.y, targetX - this.x);

    let moving = false;
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      moving = true;
    }

    if (this.dashTimer > 0) this.dashTimer -= dt;

    if (moving && this.dashTimer <= 0 && (input.wasKeyPressed('Space') || input.wasKeyPressed('ShiftLeft'))) {
      this.isDashing = true;
      this.dashTimer = this.dashCooldown;
      this.dashDurationTimer = this.dashDuration;
      this.dashDirX = dx;
      this.dashDirY = dy;
      // Spawn burst particles
      for(let i = 0; i < 10; i++) {
         this.thrustParticles.push({
            x: this.x, y: this.y,
            vx: -this.dashDirX * 100 + (Math.random() - 0.5) * 50,
            vy: -this.dashDirY * 100 + (Math.random() - 0.5) * 50,
            life: 0.3
         });
      }
    }

    if (this.isDashing) {
      this.dashDurationTimer -= dt;
      this.vx = this.dashDirX * this.baseSpeed * 4;
      this.vy = this.dashDirY * this.baseSpeed * 4;
      if (this.dashDurationTimer <= 0) {
        this.isDashing = false;
      }
    } else {
      // Momentum logic
      const targetVx = dx * this.baseSpeed * this.speedMultiplier;
      const targetVy = dy * this.baseSpeed * this.speedMultiplier;
      // Decay recoil
      if (this.recoilTimer > 0) {
         this.recoilTimer -= dt;
      } else {
         this.vx += (targetVx - this.vx) * 10 * dt;
         this.vy += (targetVy - this.vy) * 10 * dt;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Particle update
    if (moving && !this.isDashing && Math.random() < 0.3) {
       this.thrustParticles.push({
          x: this.x - dx * this.radius, y: this.y - dy * this.radius,
          vx: -dx * 20 + (Math.random() - 0.5) * 10,
          vy: -dy * 20 + (Math.random() - 0.5) * 10,
          life: 0.2
       });
    }

    for (let i = this.thrustParticles.length - 1; i >= 0; i--) {
       let p = this.thrustParticles[i];
       p.x += p.vx * dt;
       p.y += p.vy * dt;
       p.life -= dt;
       if (p.life <= 0) this.thrustParticles.splice(i, 1);
    }

    // Clamp to screen
    this.x = Math.max(this.radius, Math.min(window.innerWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(window.innerHeight - this.radius, this.y));

    // Time Dilation calculation based on movement
    window.engine.timeDilation = moving ? 1.0 : 0.1;

    // Shooting
    if (this.shootTimer > 0) {
      this.shootTimer -= dt;
    }

    if ((input.mouse.isDown || input.touch.isDown) && this.shootTimer <= 0 && !this.isDashing) {
      this.bullets.push(new PlayerBullet(this.x, this.y, this.aimAngle));
      window.engine.audio.playShoot();
      this.shootTimer = this.shootCooldown;
      // Add recoil
      this.vx -= Math.cos(this.aimAngle) * 50;
      this.vy -= Math.sin(this.aimAngle) * 50;
      this.recoilTimer = 0.1;
    }

    // Update bullets (player bullets move in real time)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      this.bullets[i].update(dt);
      if (this.bullets[i].isOffScreen()) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    // Draw player bullets
    for (const b of this.bullets) {
      b.draw(ctx);
    }

    // Draw particles
    for (const p of this.thrustParticles) {
       ctx.beginPath();
       ctx.arc(p.x, p.y, p.life * 10, 0, Math.PI * 2);
       ctx.fillStyle = `rgba(255, 255, 255, ${p.life / 0.3})`;
       ctx.fill();
       ctx.closePath();
    }

    // Invulnerability Blink
    if (this.isDashing && Math.floor(this.dashDurationTimer * 20) % 2 === 0) {
       return; // Blink out
    }

    // Procedural Player drawing
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.aimAngle);

    // Core body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    // Aim Telegraph
    ctx.beginPath();
    ctx.moveTo(this.radius, 0);
    ctx.lineTo(this.radius + 10, 0);
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.closePath();

    // Side thrusters
    ctx.beginPath();
    ctx.arc(0, -this.radius, 4, 0, Math.PI * 2);
    ctx.arc(0, this.radius, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffaa00';
    ctx.fill();
    ctx.closePath();

    ctx.restore();
  }
}

class PlayerBullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.radius = 4;
    this.speed = 500;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.color = '#70e2f9';
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }

  isOffScreen() {
    return this.x < 0 || this.x > window.innerWidth || this.y < 0 || this.y > window.innerHeight;
  }
}

class EnemyBoss {
  constructor(cx, cy) {
    this.cx = cx;
    this.cy = cy;
    this.x = cx;
    this.y = cy;
    this.radius = 30;
    this.color = '#ff4444';
    this.time = 0;
    this.hp = 100;
    this.shootTimer = 0;
    this.shootInterval = 1.5;
  }

  update(dt, manager) {
    this.time += dt;
    // Move in a sine wave
    this.x = this.cx + Math.sin(this.time * 2) * 100;

    this.shootTimer += dt;
    if (this.shootTimer >= this.shootInterval) {
      this.shootTimer = 0;
      // 8-way radial spread
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        manager.bullets.push(new EnemyBullet(this.x, this.y, angle));
      }
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();

    // Draw HP bar
    ctx.fillStyle = 'red';
    ctx.fillRect(this.x - 30, this.y - 45, 60, 5);
    ctx.fillStyle = '#ecf7f4';
    ctx.fillRect(this.x - 30, this.y - 45, 60 * (this.hp / 100), 5);
  }
}

class EnemyBullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.radius = 5;
    this.speed = 150;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.color = '#ff8888';
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }

  isOffScreen() {
    return this.x < 0 || this.x > window.innerWidth || this.y < 0 || this.y > window.innerHeight;
  }
}

class EffectsManager {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.flashes = [];
  }

  addParticle(x, y, vx, vy, color, life) {
    this.particles.push({ x, y, vx, vy, color, life, maxLife: life });
  }

  addFloatingText(x, y, text, color, life) {
    this.texts.push({ x, y, text, color, life, maxLife: life });
  }

  addFlash(color, life) {
    this.flashes.push({ color, life, maxLife: life });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      let t = this.texts[i];
      t.y -= 20 * dt;
      t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      let f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) this.flashes.splice(i, 1);
    }
  }

  draw(ctx) {
    for (let f of this.flashes) {
      let alpha = f.life / f.maxLife;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }
    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      let r = 5 * (p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.closePath();
    }
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    for (let t of this.texts) {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.life / t.maxLife;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1.0;
    }
  }
}

class EnemyManager {

  constructor() {
    this.boss = new EnemyBoss(window.innerWidth / 2, 100);
    this.bullets = [];
  }

  update(dt, player) {
    if (this.boss) {
      this.boss.update(dt, this);

      // Check collision between player bullets and boss
      for (let i = player.bullets.length - 1; i >= 0; i--) {
        const b = player.bullets[i];
        const dx = b.x - this.boss.x;
        const dy = b.y - this.boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < b.radius + this.boss.radius) {
          this.boss.hp -= 10;
          player.bullets.splice(i, 1);
          window.engine.audio.playHit();
          window.engine.score += 50;
        }
      }

      if (this.boss.hp <= 0) {
        window.engine.score += 1000;
        this.boss = null;
        // Proceed to next wave/boss here in future phases
        window.engine.setState('GAME_OVER');
      }
    }

    // Update enemy bullets and check player collision
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);

      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < b.radius + player.radius) {
         if (!player.isDashing) {
           window.engine.setState('GAME_OVER');
           return; // Player died
         }
      }

      if (b.isOffScreen()) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    if (this.boss) this.boss.draw(ctx);
    for (const b of this.bullets) {
      b.draw(ctx);
    }
  }
}

class EnvironmentManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.membrane = Array.from({length: 30}, () => ({x: Math.random()*width, y: Math.random()*height, r: 4, s: 20}));
    this.plasma = Array.from({length: 20}, () => ({x: Math.random()*width, y: Math.random()*height, r: 15, s: 40}));
    this.structures = Array.from({length: 10}, () => ({x: Math.random()*width, y: Math.random()*height, r: 60, s: 80}));
    this.hazards = [];
    this.hazardTimer = 0;
    this.gridOffsetX = 0;
    this.gridOffsetY = 0;
    this.proteinClusters = [];
    this.proteinTimer = 0;
    this.bgPulse = 0;
    this.bgPulseDir = 1;
    this.ambientParticles = Array.from({length: 40}, () => ({x: Math.random()*width, y: Math.random()*height, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, r: 2}));
  }

  update(dt, player, enemyManager) {
    [this.membrane, this.plasma, this.structures].forEach(arr => {
      arr.forEach(p => {
        p.y += p.s * dt;
        if (p.y > this.height + p.r) { p.y = -p.r; p.x = Math.random() * this.width; }
      });
    });

    this.gridOffsetY += 20 * dt;
    if (this.gridOffsetY > 50) this.gridOffsetY -= 50;

    this.bgPulse += this.bgPulseDir * 0.5 * dt;
    if (this.bgPulse > 1) { this.bgPulse = 1; this.bgPulseDir = -1; }
    if (this.bgPulse < 0) { this.bgPulse = 0; this.bgPulseDir = 1; }

    this.ambientParticles.forEach(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;
    });

    this.proteinTimer -= dt;
    if (this.proteinTimer <= 0) {
      this.proteinTimer = 8;
      this.proteinClusters.push({x: Math.random() * this.width, y: -80, r: 40, hp: 50, s: 30});
    }

    for (let i = this.proteinClusters.length - 1; i >= 0; i--) {
      let pc = this.proteinClusters[i];
      pc.y += pc.s * dt;
      if (player) {
        let dx = pc.x - player.x, dy = pc.y - player.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < pc.r + player.radius) {
          player.x += (dx/dist) * -200 * dt;
          player.y += (dy/dist) * -200 * dt;
        }
        for (let j = player.bullets.length - 1; j >= 0; j--) {
          let b = player.bullets[j];
          let bx = pc.x - b.x, by = pc.y - b.y;
          if (Math.sqrt(bx*bx + by*by) < pc.r + b.radius) {
            pc.hp -= 10;
            player.bullets.splice(j, 1);
            if (typeof window.engine !== 'undefined' && window.engine.audio) window.engine.audio.playHit();
          }
        }
      }
      if (pc.hp <= 0 || pc.y > this.height + pc.r) {
        this.proteinClusters.splice(i, 1);
      }
    }

    this.hazardTimer -= dt;
    if (this.hazardTimer <= 0) {
      this.hazardTimer = 5;
      this.hazards.push({x: Math.random() * this.width, y: -60, r: 60, s: 60, type: 'enzyme'});
    }

    let inPool = false;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      let h = this.hazards[i];
      h.y += h.s * dt;
      if (player) {
        let dx = h.x - player.x, dy = h.y - player.y;
        if (Math.sqrt(dx*dx + dy*dy) < h.r + player.radius) inPool = true;
      }
      if (enemyManager && enemyManager.boss) {
        let dx = h.x - enemyManager.boss.x, dy = h.y - enemyManager.boss.y;
        if (Math.sqrt(dx*dx + dy*dy) < h.r + enemyManager.boss.radius) {
          enemyManager.boss.hp -= 10 * dt;
          if (enemyManager.boss.hp < 0) enemyManager.boss.hp = 0;
        }
      }
      if (h.y > this.height + h.r) this.hazards.splice(i, 1);
    }
    if (player) player.speedMultiplier = inPool ? 0.3 : 1.0;
  }

  drawBackground(ctx) {
    let pulseHex = Math.floor(this.bgPulse * 20 + 20).toString(16).padStart(2, '0');
    ctx.strokeStyle = `#11${pulseHex}22`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < this.width; x += 50) {
      ctx.moveTo(x, 0); ctx.lineTo(x, this.height);
    }
    for (let y = this.gridOffsetY - 50; y < this.height; y += 50) {
      ctx.moveTo(0, y); ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(200, 255, 200, 0.2)';
    this.ambientParticles.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    });

    ctx.fillStyle = '#224444';
    this.membrane.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); });
    ctx.fillStyle = 'rgba(0,255,100,0.1)';
    this.plasma.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); });
  }

  drawHazards(ctx) {
    ctx.fillStyle = 'rgba(150,0,255,0.4)';
    this.hazards.forEach(h => { ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, Math.PI*2); ctx.fill(); });
  }

  drawForeground(ctx) {
    ctx.fillStyle = 'rgba(0,100,200,0.05)';
    this.structures.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill(); });

    this.proteinClusters.forEach(pc => {
      ctx.beginPath();
      ctx.arc(pc.x, pc.y, pc.r, 0, Math.PI*2);
      ctx.fillStyle = '#aa4422';
      ctx.fill();
      ctx.strokeStyle = '#ff8844';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#ff8844';
      for(let i=0; i<5; i++) {
        let ax = pc.x + Math.cos(i*Math.PI*2/5) * (pc.r * 0.5);
        let ay = pc.y + Math.sin(i*Math.PI*2/5) * (pc.r * 0.5);
        ctx.beginPath(); ctx.arc(ax, ay, pc.r*0.2, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(pc.x - 20, pc.y - pc.r - 10, 40 * (pc.hp/50), 4);
    });
  }
}

window.engine = new GameEngine();
window.engine.startLoop();
