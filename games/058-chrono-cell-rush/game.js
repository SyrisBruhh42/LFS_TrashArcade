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

    if (typeof Player !== 'undefined') this.player = new Player(this.canvas.width/2, this.canvas.height/2);
    if (typeof EnemyManager !== 'undefined') this.enemyManager = new EnemyManager();
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

    // Update player
    if (this.player) this.player.update(dt, this.input);

    // Update enemies using dilated time
    const dilatedDt = dt * this.timeDilation;
    if (this.enemyManager) this.enemyManager.update(dilatedDt, this.player);
  }

  draw() {
    this.ctx.fillStyle = '#11151c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'PLAYING') {
      if (this.enemyManager) this.enemyManager.draw(this.ctx);
      if (this.player) this.player.draw(this.ctx);
    }
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.speed = 200;
    this.color = '#70e2f9';
    this.shootTimer = 0;
    this.shootCooldown = 0.2;
    this.bullets = [];
  }

  update(dt, input) {
    let dx = 0;
    let dy = 0;

    if (input.isKeyDown('KeyW') || input.isKeyDown('ArrowUp')) dy -= 1;
    if (input.isKeyDown('KeyS') || input.isKeyDown('ArrowDown')) dy += 1;
    if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) dx -= 1;
    if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) dx += 1;

    let moving = false;
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
      moving = true;
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

    if ((input.mouse.isDown || input.touch.isDown) && this.shootTimer <= 0) {
      let targetX, targetY;
      if (input.usingTouch && input.touch.isDown) {
         targetX = input.touch.x;
         targetY = input.touch.y;
      } else {
         targetX = input.mouse.x;
         targetY = input.mouse.y;
      }

      const angle = Math.atan2(targetY - this.y, targetX - this.x);
      this.bullets.push(new PlayerBullet(this.x, this.y, angle));
      window.engine.audio.playShoot();
      this.shootTimer = this.shootCooldown;
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

    // Draw player
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
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
         window.engine.setState('GAME_OVER');
         return; // Player died
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

window.engine = new GameEngine();
window.engine.startLoop();
