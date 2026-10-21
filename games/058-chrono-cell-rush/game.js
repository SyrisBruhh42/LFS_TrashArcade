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
    this.combo = 1.0;
    this.comboTimer = 0;
    this.comboMaxTimer = 3.0;
    this.pickups = [];

    this.setupResizeObserver();
    this.bindUI();
    this.bindAudioResume();

    this.requestID = null;
    this.timeDilation = 1.0;

    // Juice
    this.hitStopTimer = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.shakeDirX = 0;
    this.shakeDirY = 0;
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

  triggerHitStop(duration) {
    this.hitStopTimer = duration;
  }

  triggerScreenShake(intensity, duration, dirX = 0, dirY = 0) {
    let optionMult = (this.saveManager.data.options && this.saveManager.data.options.screenShake !== undefined) ? this.saveManager.data.options.screenShake : 1.0;
    if (optionMult <= 0) return;
    this.shakeIntensity = intensity * optionMult;
    this.shakeTimer = duration;
    this.shakeDirX = dirX;
    this.shakeDirY = dirY;
  }

  startGame() {
    this.score = 0;
    this.wave = 1;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.comboMaxTimer = 3.0;
    this.pickups = [];
    this.setState('PLAYING');

    if (typeof EffectsManager !== 'undefined') this.effectsManager = new EffectsManager();

    if (typeof Player !== 'undefined') this.player = new Player(this.canvas.width/2, this.canvas.height/2);
    if (typeof EnemyManager !== 'undefined') this.enemyManager = new EnemyManager();
    if (typeof EnvironmentManager !== 'undefined') this.environmentManager = new EnvironmentManager(this.canvas.width, this.canvas.height);
    this.upgradeManager = new UpgradeManager(this);
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
    let comboDisplay = document.getElementById('comboDisplay');
    if (comboDisplay) {
        comboDisplay.innerText = `COMBO: ${this.combo.toFixed(1)}x`;
        document.getElementById('comboBar').style.width = `${Math.max(0, (this.comboTimer / this.comboMaxTimer) * 100)}%`;
    }
    let shieldsDisplay = document.getElementById('shieldsDisplay');
    if (shieldsDisplay && this.player) {
        shieldsDisplay.innerText = `SHIELDS: ${this.player.shields}/${this.player.maxShields}`;
    }
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

    // Update combo timer (uses real dt to decay even in slowed time)
    if (this.combo > 1.0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) {
            this.combo = 1.0;
            this.comboTimer = 0;
        }
    }

    // Screen shake
    if (this.shakeTimer > 0) {
        this.shakeTimer -= dt;
        let progress = this.shakeTimer / 0.2; // default 0.2
        let currentIntensity = this.shakeIntensity * progress;
        if (this.shakeDirX !== 0 || this.shakeDirY !== 0) {
            this.shakeX = this.shakeDirX * currentIntensity * Math.sin(this.shakeTimer * 50);
            this.shakeY = this.shakeDirY * currentIntensity * Math.cos(this.shakeTimer * 50);
        } else {
            this.shakeX = (Math.random() - 0.5) * 2 * currentIntensity;
            this.shakeY = (Math.random() - 0.5) * 2 * currentIntensity;
        }
    } else {
        this.shakeX = 0;
        this.shakeY = 0;
    }

    // Hit-stop
    if (this.hitStopTimer > 0) {
        this.hitStopTimer -= dt;
        // Only update effects during hit-stop
        if (this.effectsManager) this.effectsManager.update(dt);
        return;
    }

    // Update player
    if (this.player) this.player.update(dt, this.input);

    // Update enemies using dilated time
    const dilatedDt = dt * this.timeDilation;
    if (this.environmentManager) this.environmentManager.update(dilatedDt, this.player, this.enemyManager);
    if (this.effectsManager) this.effectsManager.update(dilatedDt);
    if (this.enemyManager) this.enemyManager.update(dilatedDt, this.player);

    for (let i = this.pickups.length - 1; i >= 0; i--) {
        let p = this.pickups[i];
        p.update(dt, this.player);
        if (p.life <= 0) {
            this.pickups.splice(i, 1);
            continue;
        }
        if (this.player && !this.player.isDashing) {
            let dx = this.player.x - p.x;
            let dy = this.player.y - p.y;
            if (Math.sqrt(dx*dx + dy*dy) < p.radius + this.player.radius) {
                this.score += 25 * this.combo;
                if(this.player.shields < this.player.maxShields && Math.random() < 0.1) this.player.shields++;
                this.pickups.splice(i, 1);
            }
        }
    }
  }

  draw() {
    this.ctx.fillStyle = '#11151c';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'PLAYING') {
      this.ctx.save();
      if (this.shakeX !== 0 || this.shakeY !== 0) {
         this.ctx.translate(this.shakeX, this.shakeY);
      }
      if (this.environmentManager) this.environmentManager.drawBackground(this.ctx);
      if (this.effectsManager) this.effectsManager.draw(this.ctx);
      if (this.environmentManager) this.environmentManager.drawHazards(this.ctx);
      if (this.enemyManager) this.enemyManager.draw(this.ctx);
      for(let p of this.pickups) { p.draw(this.ctx); }
      if (this.player) this.player.draw(this.ctx);
      if (this.environmentManager) this.environmentManager.drawForeground(this.ctx);
      this.ctx.restore();
    }
  }
}



class Pickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 6;
        this.life = 10;
        this.vx = (Math.random() - 0.5) * 100;
        this.vy = (Math.random() - 0.5) * 100;
    }
    update(dt, player) {
        this.life -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= Math.pow(0.5, dt);
        this.vy *= Math.pow(0.5, dt);

        if (player) {
            let dx = player.x - this.x;
            let dy = player.y - this.y;
            let dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < player.magnetRadius) {
                this.vx += (dx / dist) * 400 * dt;
                this.vy += (dy / dist) * 400 * dt;
            }
        }
    }
    draw(ctx) {
        if (this.life < 2 && Math.floor(this.life * 10) % 2 === 0) return;
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class UpgradeManager {
    constructor(engine) {
        this.engine = engine;
        this.pool = [
            { id: 'damage', name: 'Raw Power', desc: '+25% Damage', apply: (p) => p.damageMultiplier += 0.25 },
            { id: 'multishot', name: 'Split Shot', desc: '+1 Projectile', apply: (p) => p.multiShot += 1 },
            { id: 'firerate', name: 'Overclock', desc: '+20% Fire Rate', apply: (p) => p.fireRateMultiplier += 0.2 },
            { id: 'pierce', name: 'Armor Piercing', desc: '+1 Pierce', apply: (p) => p.pierceCount += 1 },
            { id: 'shield', name: 'Deflector', desc: '+1 Max Shield', apply: (p) => { p.maxShields++; p.shields++; } },
            { id: 'magnet', name: 'Magnetic Field', desc: 'Increased Pickup Range', apply: (p) => p.magnetRadius += 100 },
            { id: 'speed', name: 'Agility', desc: '+15% Move Speed', apply: (p) => p.baseSpeed *= 1.15 },
            { id: 'dash', name: 'Quick Step', desc: '-20% Dash Cooldown', apply: (p) => p.dashCooldown *= 0.8 }
        ];
    }
    showDraft() {
        this.engine.setState('UPGRADE_DRAFT');
        let optionsDiv = document.getElementById('upgrade-options');
        optionsDiv.innerHTML = '';

        let shuffled = [...this.pool].sort(() => 0.5 - Math.random());
        let choices = shuffled.slice(0, 3);

        choices.forEach(choice => {
            let btn = document.createElement('div');
            btn.style.border = '2px solid #ecf7f4';
            btn.style.padding = '15px';
            btn.style.borderRadius = '5px';
            btn.style.cursor = 'pointer';
            btn.style.width = '150px';
            btn.innerHTML = `<strong style="color: #70e2f9;">${choice.name}</strong><br><br><span style="font-size: 0.8em;">${choice.desc}</span>`;

            btn.onmouseover = () => btn.style.background = '#333';
            btn.onmouseout = () => btn.style.background = 'transparent';

            btn.onclick = () => {
                choice.apply(this.engine.player);
                this.engine.setState('PLAYING');
            };
            optionsDiv.appendChild(btn);
        });
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

    // Upgrades
    this.damageMultiplier = 1.0;
    this.maxShields = 0;
    this.shields = 0;
    this.pierceCount = 0;
    this.multiShot = 1;
    this.fireRateMultiplier = 1.0;
    this.magnetRadius = 50;
    this.healOnKillChance = 0;

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
      if (window.engine.effectsManager) window.engine.effectsManager.addDirectionalParticles(this.x, this.y, -this.dashDirX, -this.dashDirY, 0.8, '#ffffff', 10, 50, 150, 0.2, 0.4);
      window.engine.triggerScreenShake(2, 0.1, -this.dashDirX, -this.dashDirY);
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
       if (window.engine.effectsManager) window.engine.effectsManager.addDirectionalParticles(this.x - dx * this.radius, this.y - dy * this.radius, -dx, -dy, 0.5, '#70e2f9', 1, 10, 30, 0.1, 0.3);
    }
    if (this.isDashing || moving) {
       if (window.engine.effectsManager && Math.random() < (this.isDashing ? 0.8 : 0.2)) {
           window.engine.effectsManager.addTrail(this.x, this.y, this.radius * 0.8, this.color, 0.2);
       }
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
            for(let m = 0; m < this.multiShot; m++) {
          let spread = (m - (this.multiShot - 1) / 2) * 0.15;
          let bullet = new PlayerBullet(this.x, this.y, this.aimAngle + spread);
          bullet.damage = 10 * this.damageMultiplier;
          bullet.pierce = this.pierceCount;
          this.bullets.push(bullet);
      }
      window.engine.audio.playShoot();
      this.shootTimer = this.shootCooldown / this.fireRateMultiplier;
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
    this.angle = angle;
    this.speed = 800;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.radius = 4;
    this.color = '#70e2f9';
    this.damage = 10;
    this.pierce = 0;
    this.hitEnemies = [];
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
    this.trails = [];
  }

  addParticle(x, y, vx, vy, color, life, size=5) {
    this.particles.push({ x, y, vx, vy, color, life, maxLife: life, size });
  }

  addDirectionalParticles(x, y, vx, vy, spread, color, count, speedMin, speedMax, lifeMin, lifeMax) {
    let baseAngle = Math.atan2(vy, vx);
    for (let i = 0; i < count; i++) {
       let angle = baseAngle + (Math.random() - 0.5) * spread;
       let speed = speedMin + Math.random() * (speedMax - speedMin);
       let life = lifeMin + Math.random() * (lifeMax - lifeMin);
       this.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, Math.random() * 3 + 2);
    }
  }

  addExplosion(x, y, color, count=20) {
    for (let i = 0; i < count; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 150 + 50;
      let life = Math.random() * 0.4 + 0.2;
      this.addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, Math.random() * 4 + 2);
    }
  }

  addFloatingText(x, y, text, color, life, vy = -20) {
    this.texts.push({ x, y, text, color, life, maxLife: life, vy: vy, type: 'normal' });
  }

  addDamageText(x, y, damage, isCrit = false) {
    let color = isCrit ? '#ffcc00' : '#ffffff';
    let life = isCrit ? 0.8 : 0.5;
    let vy = isCrit ? -40 : -20;
    this.texts.push({ x, y, text: Math.floor(damage), color, life, maxLife: life, vy, type: 'damage', isCrit });
  }

  addComboText(x, y, comboStr) {
    this.texts.push({ x, y, text: comboStr, color: '#ff66ff', life: 1.0, maxLife: 1.0, vy: -30, type: 'combo' });
  }

  addFlash(color, life) {
    this.flashes.push({ color, life, maxLife: life });
  }

  addTrail(x, y, width, color, life) {
    this.trails.push({ x, y, width, color, life, maxLife: life });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // apply drag
      p.vx *= 1.0 - (2.0 * dt);
      p.vy *= 1.0 - (2.0 * dt);
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      let t = this.texts[i];
      t.x += (Math.random() - 0.5) * 5 * dt; // slight jitter
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      let f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) this.flashes.splice(i, 1);
    }
    for (let i = this.trails.length - 1; i >= 0; i--) {
      let t = this.trails[i];
      t.life -= dt;
      if (t.life <= 0) this.trails.splice(i, 1);
    }
  }

  draw(ctx) {
    // Draw Trails
    for (let t of this.trails) {
      let alpha = t.life / t.maxLife;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.width * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    for (let f of this.flashes) {
      let alpha = f.life / f.maxLife;
      ctx.fillStyle = f.color;
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    }
    ctx.globalAlpha = 1.0;

    for (let p of this.particles) {
      ctx.fillStyle = p.color;
      let r = p.size * (p.life / p.maxLife);
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.textAlign = 'center';
    for (let t of this.texts) {
      ctx.fillStyle = t.color;
      ctx.globalAlpha = t.life / t.maxLife;

      let scale = 1;
      if (t.type === 'damage') {
         ctx.font = t.isCrit ? 'bold 24px monospace' : 'bold 16px monospace';
         scale = t.isCrit ? 1.0 + (1.0 - t.life/t.maxLife) : 1.0;
      } else if (t.type === 'combo') {
         ctx.font = 'bold 28px monospace';
         scale = 1.0 + (1.0 - t.life/t.maxLife)*0.5;
      } else {
         ctx.font = '20px monospace';
      }

      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(scale, scale);
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }
}

class HazardPuddle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = 40;
    this.lifeTime = 5;
    this.age = 0;
  }
  update(dt) {
    this.age += dt;
    if (this.radius < this.maxRadius) this.radius += dt * 20;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 255, 0, ${1 - this.age / this.lifeTime})`;
    ctx.fill();
    ctx.closePath();
  }
}

class BossViralOverlord extends EnemyBoss {
  constructor(cx, cy) {
    super(cx, cy);
    this.maxHp = 1500;
    this.hp = 1500;
    this.radius = 40;
    this.color = '#aa22aa';
    this.phase2 = false;
    this.dashTimer = 0;
    this.dashTarget = null;
  }
  update(dt, manager) {
    if (this.hp < this.maxHp * 0.5 && !this.phase2) {
      this.phase2 = true;
      this.color = '#ff11ff';
      manager.bullets = [];
    }
    this.time += dt;
    if (!this.phase2) {
      this.x = this.cx + Math.sin(this.time * 1.5) * 150;
      this.y = this.cy + Math.cos(this.time * 0.5) * 50;
      this.shootTimer += dt;
      if (this.shootTimer > 1.0) {
        this.shootTimer = 0;
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2 + this.time;
          manager.bullets.push(new EnemyBullet(this.x, this.y, angle));
        }
      }
    } else {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.dashTimer = 3;
        const player = window.engine.player;
        if (player) {
          this.dashTarget = {x: player.x, y: player.y};
        } else {
          this.dashTarget = {x: window.innerWidth/2, y: window.innerHeight/2};
        }
      }
      if (this.dashTarget) {
        const dx = this.dashTarget.x - this.x;
        const dy = this.dashTarget.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 10) {
          this.x += (dx/dist) * 300 * dt;
          this.y += (dy/dist) * 300 * dt;
          if (Math.random() < 0.1) {
            manager.hazards.push(new HazardPuddle(this.x, this.y));
          }
        }
      }
    }
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.closePath();
  }
}

class BossMito extends EnemyBoss {
  constructor(cx, cy) {
    super(cx, cy);
    this.maxHp = 2500;
    this.hp = 2500;
    this.radius = 50;
    this.color = '#ff8800';
    this.phase2 = false;
    this.spiralAngle = 0;
  }
  update(dt, manager) {
    if (this.hp < this.maxHp * 0.5 && !this.phase2) {
      this.phase2 = true;
      this.color = '#ff3300';
      manager.bullets = [];
    }
    this.x = window.innerWidth / 2;
    this.y = 150;
    this.shootTimer += dt;
    if (!this.phase2) {
      if (this.shootTimer > 0.1) {
        this.shootTimer = 0;
        this.spiralAngle += 0.2;
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.spiralAngle));
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.spiralAngle + Math.PI));
      }
    } else {
      if (this.shootTimer > 0.05) {
        this.shootTimer = 0;
        this.spiralAngle -= 0.15;
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.spiralAngle));
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.spiralAngle + Math.PI*0.5));
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.spiralAngle + Math.PI));
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.spiralAngle + Math.PI*1.5));
      }
    }
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#ffff00';
    ctx.stroke();
    ctx.closePath();
  }
}

class EnemySwarmer {
  constructor(x, y) {
    this.x = x; this.y = y; this.radius = 12; this.hp = 20;
    this.speed = 80;
  }
  update(dt, player, manager) {
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist > 0) { this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt; }
  }
  draw(ctx) {
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.radius);
    ctx.lineTo(this.x + this.radius, this.y + this.radius);
    ctx.lineTo(this.x - this.radius, this.y + this.radius);
    ctx.fill();
    ctx.closePath();
  }
}

class EnemySniper {
  constructor(x, y) {
    this.x = x; this.y = y; this.radius = 15; this.hp = 30;
    this.speed = 40; this.shootTimer = 0; this.state = 'position';
    this.telegraph = 0; this.targetAngle = 0;
  }
  update(dt, player, manager) {
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(this.state === 'position') {
      if(dist < 200) { this.x -= (dx/dist)*this.speed*dt; this.y -= (dy/dist)*this.speed*dt; }
      else if(dist > 250) { this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt; }
      this.shootTimer += dt;
      if(this.shootTimer > 2) { this.state = 'telegraph'; this.telegraph = 0; this.targetAngle = Math.atan2(dy, dx); }
    } else if(this.state === 'telegraph') {
      this.telegraph += dt;
      if(this.telegraph > 1) {
        manager.bullets.push(new EnemyBullet(this.x, this.y, this.targetAngle));
        this.state = 'position'; this.shootTimer = 0;
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
    if(this.state === 'telegraph') {
      ctx.strokeStyle = `rgba(255, 0, 0, ${this.telegraph})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.targetAngle)*500, this.y + Math.sin(this.targetAngle)*500);
      ctx.stroke();
    }
  }
}

class EnemyBruiser {
  constructor(x, y) {
    this.x = x; this.y = y; this.radius = 25; this.hp = 100;
    this.speed = 30; this.shield = 50; this.shieldMax = 50;
  }
  update(dt, player, manager) {
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist > 0) { this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt; }
    if(this.shield < this.shieldMax) this.shield += dt * 5;
  }
  draw(ctx) {
    ctx.fillStyle = '#ff8800';
    ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
    if(this.shield > 0) {
      ctx.strokeStyle = `rgba(0, 0, 255, ${this.shield / this.shieldMax})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x - this.radius - 5, this.y - this.radius - 5, this.radius*2 + 10, this.radius*2 + 10);
    }
  }
}

class EnemySpawner {
  constructor(x, y) {
    this.x = x; this.y = y; this.radius = 20; this.hp = 60;
    this.speed = 20; this.spawnTimer = 0; this.telegraph = 0;
    this.tx = Math.random()*window.innerWidth; this.ty = Math.random()*window.innerHeight;
  }
  update(dt, player, manager) {
    const dx = this.tx - this.x; const dy = this.ty - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist > 10) { this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt; }
    else { this.tx = Math.random()*window.innerWidth; this.ty = Math.random()*window.innerHeight; }

    this.spawnTimer += dt;
    if(this.spawnTimer > 4) {
      this.telegraph += dt;
      if(this.telegraph > 1) {
        manager.enemies.push(new EnemySwarmer(this.x + 20, this.y));
        manager.enemies.push(new EnemySwarmer(this.x - 20, this.y));
        this.spawnTimer = 0; this.telegraph = 0;
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#aa00aa';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.radius);
    ctx.lineTo(this.x + this.radius, this.y);
    ctx.lineTo(this.x, this.y + this.radius);
    ctx.lineTo(this.x - this.radius, this.y);
    ctx.fill();
    ctx.closePath();
    if(this.telegraph > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.telegraph})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI*2);
      ctx.fill();
      ctx.closePath();
    }
  }
}

class EnemyHazardMaker {
  constructor(x, y) {
    this.x = x; this.y = y; this.radius = 18; this.hp = 40;
    this.speed = 50; this.hazardTimer = 0; this.telegraph = 0;
  }
  update(dt, player, manager) {
    const dx = player.x - this.x; const dy = player.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist > 100) { this.x += (dx/dist)*this.speed*dt; this.y += (dy/dist)*this.speed*dt; }

    this.hazardTimer += dt;
    if(this.hazardTimer > 3) {
      this.telegraph += dt;
      if(this.telegraph > 0.5) {
        manager.hazards.push(new HazardPuddle(this.x, this.y));
        this.hazardTimer = 0; this.telegraph = 0;
      }
    }
  }
  draw(ctx) {
    ctx.fillStyle = '#555500';
    ctx.beginPath();
    for(let i=0; i<6; i++) {
      const a = (i/6)*Math.PI*2;
      ctx.lineTo(this.x + Math.cos(a)*this.radius, this.y + Math.sin(a)*this.radius);
    }
    ctx.fill();
    ctx.closePath();
    if(this.telegraph > 0) {
      ctx.fillStyle = `rgba(0, 255, 0, ${this.telegraph*2})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.closePath();
    }
  }
}

class EnemyManager {

  constructor() {
    this.boss = null;
    this.bullets = [];
    this.enemies = [];
    this.hazards = [];
    this.spawnTimer = 0;
    this.waveProgress = 0;
    this.warningTimer = 0;
    this.bossSpawnedForWave = false;
    this.bossName = "";
  }

  update(dt, player) {
    if (this.warningTimer > 0) {
      this.warningTimer -= dt;
      if (this.warningTimer <= 0) {
        if (window.engine.wave % 10 === 0) {
          this.boss = new BossMito(window.innerWidth/2, 100);
          this.bossName = "MITOCHONDRIAL CORE";
        } else {
          this.boss = new BossViralOverlord(window.innerWidth/2, 100);
          this.bossName = "VIRAL OVERLORD";
        }
        this.bossSpawnedForWave = true;
      }
      return;
    }

    if (!this.boss) {
      this.waveProgress += dt;
      if (this.waveProgress >= 10) {
        this.waveProgress = 0;
        window.engine.wave++;
        this.bossSpawnedForWave = false;
      }
      if (window.engine.wave > 0 && window.engine.wave % 5 === 0 && !this.bossSpawnedForWave) {
        this.warningTimer = 3;
        return;
      }
    }

    if (!this.boss) {
      this.spawnTimer += dt;
      const spawnRate = Math.max(0.5, 3 - window.engine.wave * 0.1);
      if(this.spawnTimer > spawnRate) {
        this.spawnTimer = 0;
        const type = Math.floor(Math.random() * 5);
        let nx = Math.random() > 0.5 ? 0 : window.innerWidth;
      let ny = Math.random() * window.innerHeight;
      if (type === 0) this.enemies.push(new EnemySwarmer(nx, ny));
      else if (type === 1) this.enemies.push(new EnemySniper(nx, ny));
      else if (type === 2) this.enemies.push(new EnemyBruiser(nx, ny));
      else if (type === 3) this.enemies.push(new EnemySpawner(nx, ny));
      else if (type === 4) this.enemies.push(new EnemyHazardMaker(nx, ny));
      }
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      let h = this.hazards[i];
      h.update(dt);
      if (player && !player.isDashing) {
        const dx = player.x - h.x; const dy = player.y - h.y;
        if (Math.sqrt(dx*dx + dy*dy) < h.radius + player.radius) {
           if (window.engine.effectsManager) window.engine.effectsManager.addExplosion(player.x, player.y, player.color, 20);
           window.engine.triggerScreenShake(8, 0.3);
           if (player.shields > 0) {
               player.shields--;
               this.hazards.splice(i, 1);
               if (window.engine.effectsManager) window.engine.effectsManager.addFlash('#0088ff', 0.2);
           } else {
               if (window.engine.effectsManager) window.engine.effectsManager.addFlash('#ff0000', 0.5);
               window.engine.triggerHitStop(0.5);
               window.engine.setState('GAME_OVER');
               return;
           }
        }
      }
      if (h.age > h.lifeTime) this.hazards.splice(i, 1);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      let e = this.enemies[i];
      e.update(dt, player, this);

      if (player) {
        const dx = player.x - e.x; const dy = player.y - e.y;
        if (Math.sqrt(dx*dx + dy*dy) < e.radius + player.radius && !player.isDashing) {
           if (window.engine.effectsManager) window.engine.effectsManager.addExplosion(player.x, player.y, player.color, 20);
           window.engine.triggerScreenShake(8, 0.3);
           if (player.shields > 0) {
               player.shields--;
               e.hp -= 1000; // Kill enemy on shield break
               window.engine.combo = 1.0;
               if (window.engine.effectsManager) window.engine.effectsManager.addFlash('#0088ff', 0.2);
           } else {
               if (window.engine.effectsManager) window.engine.effectsManager.addFlash('#ff0000', 0.5);
               window.engine.triggerHitStop(0.5);
               window.engine.setState('GAME_OVER');
               return;
           }
        }

        for (let j = player.bullets.length - 1; j >= 0; j--) {
          let b = player.bullets[j];
          const bx = b.x - e.x; const by = b.y - e.y;
          if (Math.sqrt(bx*bx + by*by) < e.radius + b.radius) {
             if (!b.hitEnemies.includes(e)) {
                 b.hitEnemies.push(e);
                 b.pierce--;

                 let isCrit = Math.random() < 0.1;
                 let dmg = isCrit ? b.damage * 2 : b.damage;
                 if (e.shield !== undefined && e.shield > 0) {
                     e.shield -= dmg;
                     if (e.shield < 0) e.shield = 0;
                 } else {
                     e.hp -= dmg;
                 }
                 window.engine.audio.playHit();
                 window.engine.score += 10 * window.engine.combo;
                 window.engine.combo = Math.min(window.engine.combo + 0.1, 5.0);
                 window.engine.comboTimer = window.engine.comboMaxTimer;

                 if (window.engine.effectsManager) {
                     window.engine.effectsManager.addDirectionalParticles(b.x, b.y, b.vx, b.vy, 1.0, '#ffcc00', 3, 20, 50, 0.1, 0.3);
                     window.engine.effectsManager.addDamageText(b.x, b.y, dmg, isCrit);
                     window.engine.effectsManager.addComboText(b.x, b.y - 20, window.engine.combo.toFixed(1) + 'x');
                 }

                 if (isCrit) {
                     window.engine.triggerScreenShake(3, 0.1);
                     window.engine.triggerHitStop(0.05);
                 }

                 if (b.pierce < 0) player.bullets.splice(j, 1);
             }
          }
        }
      }
      if (e.hp <= 0) {
        window.engine.score += 50 * window.engine.combo;
        if (Math.random() < 0.2) window.engine.pickups.push(new Pickup(e.x, e.y));
        if (window.engine.effectsManager) window.engine.effectsManager.addExplosion(e.x, e.y, e.color || '#ff4444', 15);
        window.engine.triggerScreenShake(4, 0.15);
        this.enemies.splice(i, 1);
      }
    }
    if (this.boss) {
      this.boss.update(dt, this);

      // Check collision between player bullets and boss
      for (let i = player.bullets.length - 1; i >= 0; i--) {
        const b = player.bullets[i];
        const dx = b.x - this.boss.x;
        const dy = b.y - this.boss.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < b.radius + this.boss.radius) {
          if (!b.hitEnemies.includes(this.boss)) {
              b.hitEnemies.push(this.boss);
              let isCrit = Math.random() < 0.15;
              let dmg = isCrit ? b.damage * 2 : b.damage;
              this.boss.hp -= dmg;
              window.engine.audio.playHit();
              window.engine.score += 50 * window.engine.combo;
              window.engine.combo = Math.min(window.engine.combo + 0.2, 5.0);
              window.engine.comboTimer = window.engine.comboMaxTimer;

              if (window.engine.effectsManager) {
                  window.engine.effectsManager.addDirectionalParticles(b.x, b.y, b.vx, b.vy, 1.5, '#ff8800', 5, 30, 80, 0.2, 0.4);
                  window.engine.effectsManager.addDamageText(b.x, b.y, dmg, isCrit);
                  window.engine.effectsManager.addComboText(b.x, b.y - 20, window.engine.combo.toFixed(1) + 'x');
              }

              if (isCrit) {
                  window.engine.triggerScreenShake(5, 0.15);
                  window.engine.triggerHitStop(0.1);
              }

              b.pierce--;
              if (b.pierce < 0) player.bullets.splice(i, 1);
          }
        }
      }

      if (this.boss.hp <= 0) {
        window.engine.score += 1000 * window.engine.combo;
        for(let k=0; k<10; k++) window.engine.pickups.push(new Pickup(this.boss.x + (Math.random()-0.5)*50, this.boss.y + (Math.random()-0.5)*50));

        if (window.engine.effectsManager) {
            window.engine.effectsManager.addExplosion(this.boss.x, this.boss.y, '#ffffff', 50);
            window.engine.effectsManager.addFlash('#ffffff', 0.5);
        }
        window.engine.triggerScreenShake(15, 1.0);
        window.engine.triggerHitStop(1.0);

        this.boss = null;
        window.engine.wave++;
        this.waveProgress = 0;
        this.bossSpawnedForWave = true;
        this.bullets = [];
        setTimeout(() => window.engine.upgradeManager.showDraft(), 1500);
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
           if (window.engine.effectsManager) window.engine.effectsManager.addExplosion(player.x, player.y, player.color, 20);
           window.engine.triggerScreenShake(8, 0.3);
           if (player.shields > 0) {
               player.shields--;
               this.bullets.splice(i, 1);
               window.engine.combo = 1.0;
               if (window.engine.effectsManager) window.engine.effectsManager.addFlash('#0088ff', 0.2);
               continue;
           } else {
               if (window.engine.effectsManager) window.engine.effectsManager.addFlash('#ff0000', 0.5);
               window.engine.triggerHitStop(0.5);
               window.engine.setState('GAME_OVER');
               return; // Player died
           }
         }
      }

      if (b.isOffScreen()) {
        this.bullets.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    if (this.boss) {
      this.boss.draw(ctx);

      // Boss UI
      const barW = window.innerWidth * 0.6;
      const barH = 20;
      const bx = window.innerWidth / 2 - barW / 2;
      const by = 20;

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, barW, barH);

      const hpRatio = Math.max(0, this.boss.hp / (this.boss.maxHp || 100));
      ctx.fillStyle = this.boss.color || 'red';
      ctx.fillRect(bx, by, barW * hpRatio, barH);

      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, barW, barH);

      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.bossName || 'BOSS', window.innerWidth/2, by + 15);
    }

    if (this.warningTimer > 0) {
      ctx.fillStyle = (Math.floor(this.warningTimer * 5) % 2 === 0) ? '#ff0000' : '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText("WARNING: " + (window.engine.wave % 10 === 0 ? "MITOCHONDRIAL CORE" : "VIRAL OVERLORD"), window.innerWidth/2, window.innerHeight/2);
    }

    for (const h of this.hazards) {
      h.draw(ctx);
    }
    for (const e of this.enemies) {
      e.draw(ctx);
    }
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
