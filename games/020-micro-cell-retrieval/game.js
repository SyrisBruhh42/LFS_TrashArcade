// Globals
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const SAVE_KEY = 'arcade_game_020_020-micro-cell-retrieval_v1';

// Math Helpers
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const angle = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);

// Save Manager
class SaveManager {
  constructor() {
    this.memoryFallback = {
      highScore: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        masterVol: 100,
        sfxVol: 100,
        musicVol: 100,
        shake: 1
      }
    };
    this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      if (data) {
        this.memoryFallback = { ...this.memoryFallback, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn("localStorage load failed, using fallback.");
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.memoryFallback));
    } catch (e) {
      console.warn("localStorage save failed.");
    }
  }

  get data() {
    return this.memoryFallback;
  }
}

// Input Manager
class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.scale = 1;
    this.rect = { left: 0, top: 0 };

    // Virtual Joysticks
    this.leftJoy = { active: false, id: null, origin: {x:0, y:0}, pos: {x:0, y:0}, dir: {x:0, y:0} };
    this.rightJoy = { active: false, id: null, origin: {x:0, y:0}, pos: {x:0, y:0}, dir: {x:0, y:0} };

    this.bindEvents();
    this.setupResize();
  }

  bindEvents() {
    window.addEventListener('keydown', e => this.keys[e.code] = true);
    window.addEventListener('keyup', e => this.keys[e.code] = false);

    window.addEventListener('mousemove', e => {
      this.mouse.x = (e.clientX - this.rect.left) / this.scale;
      this.mouse.y = (e.clientY - this.rect.top) / this.scale;
    });
    window.addEventListener('mousedown', e => {
      if (e.target === this.canvas) this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => this.mouse.down = false);

    // Touch Input
    const touchControls = document.getElementById('touch-controls');
    const leftZone = document.getElementById('left-joystick');
    const rightZone = document.getElementById('right-joystick');

    const handleTouch = (e) => {
      e.preventDefault();

      const rectLeft = leftZone.getBoundingClientRect();
      const rectRight = rightZone.getBoundingClientRect();

      // Reset active state to cleanly evaluate
      let leftFound = false;
      let rightFound = false;

      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];

        // Left Joystick
        if (!leftFound && t.clientX < window.innerWidth / 2) {
          leftFound = true;
          this.leftJoy.active = true;
          this.leftJoy.id = t.identifier;
          const cx = rectLeft.left + rectLeft.width / 2;
          const cy = rectLeft.top + rectLeft.height / 2;
          let dx = t.clientX - cx;
          let dy = t.clientY - cy;
          const mag = Math.hypot(dx, dy);
          const maxR = rectLeft.width / 2;

          if (mag > maxR) {
            dx = (dx / mag) * maxR;
            dy = (dy / mag) * maxR;
          }

          leftZone.children[0].style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          this.leftJoy.dir.x = dx / maxR;
          this.leftJoy.dir.y = dy / maxR;
        }

        // Right Joystick
        if (!rightFound && t.clientX >= window.innerWidth / 2) {
          rightFound = true;
          this.rightJoy.active = true;
          this.rightJoy.id = t.identifier;
          const cx = rectRight.left + rectRight.width / 2;
          const cy = rectRight.top + rectRight.height / 2;
          let dx = t.clientX - cx;
          let dy = t.clientY - cy;
          const mag = Math.hypot(dx, dy);
          const maxR = rectRight.width / 2;

          if (mag > maxR) {
            dx = (dx / mag) * maxR;
            dy = (dy / mag) * maxR;
          }

          rightZone.children[0].style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          this.rightJoy.dir.x = dx / maxR;
          this.rightJoy.dir.y = dy / maxR;
        }
      }

      if (!leftFound) {
        this.leftJoy.active = false;
        leftZone.children[0].style.transform = `translate(-50%, -50%)`;
        this.leftJoy.dir = {x:0, y:0};
      }
      if (!rightFound) {
        this.rightJoy.active = false;
        rightZone.children[0].style.transform = `translate(-50%, -50%)`;
        this.rightJoy.dir = {x:0, y:0};
      }
    };

    document.addEventListener('touchstart', (e) => {
      // Un-hide touch controls on first touch
      if (touchControls.style.display !== 'block') {
         touchControls.style.display = 'block';
      }
      if (e.target.closest('#touch-controls') || e.target === this.canvas) {
         handleTouch(e);
      }
    }, {passive: false});
    document.addEventListener('touchmove', (e) => {
      if (e.target.closest('#touch-controls') || e.target === this.canvas) {
         handleTouch(e);
      }
    }, {passive: false});
    document.addEventListener('touchend', handleTouch);
    document.addEventListener('touchcancel', handleTouch);
  }

  setupResize() {
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const cw = entry.contentRect.width;
        const ch = entry.contentRect.height;
        const scaleX = cw / LOGICAL_WIDTH;
        const scaleY = ch / LOGICAL_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        this.canvas.width = LOGICAL_WIDTH * this.scale;
        this.canvas.height = LOGICAL_HEIGHT * this.scale;
        this.rect = this.canvas.getBoundingClientRect();
      }
    });
    ro.observe(document.getElementById('game-container'));
  }

  getMovement() {
    let dx = 0; let dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const mag = Math.hypot(dx, dy);
      return { x: dx/mag, y: dy/mag };
    }

    if (this.leftJoy.active) {
       return { x: this.leftJoy.dir.x, y: this.leftJoy.dir.y };
    }

    return { x: 0, y: 0 };
  }

  getAim(playerX, playerY) {
    if (this.rightJoy.active) {
      const mag = Math.hypot(this.rightJoy.dir.x, this.rightJoy.dir.y);
      if (mag > 0.1) {
         return { x: this.rightJoy.dir.x / mag, y: this.rightJoy.dir.y / mag, active: true };
      }
    }

    if (this.mouse.down) {
       const dx = this.mouse.x - playerX;
       const dy = this.mouse.y - playerY;
       const mag = Math.hypot(dx, dy);
       if (mag > 0) {
          return { x: dx/mag, y: dy/mag, active: true };
       }
    }

    return { x: 0, y: 0, active: false };
  }
}

// Audio Engine
class AudioEngine {
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.masterGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);

    this.updateVolumes();

    this.initialized = false;
    const initAudio = () => {
      if (!this.initialized && this.ctx.state === 'suspended') {
        this.ctx.resume();
        this.initialized = true;
        this.startMusic();
      }
    };
    window.addEventListener('pointerdown', initAudio, { once: true });
    window.addEventListener('keydown', initAudio, { once: true });
  }

  updateVolumes() {
    const opts = this.saveManager.data.options;
    this.masterGain.gain.value = opts.masterVol / 100;
    this.sfxGain.gain.value = opts.sfxVol / 100;
    this.musicGain.gain.value = opts.musicVol / 100;
  }

  playTone(freq, type, duration, vol = 1, slideTo = null) {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playShoot() {
    this.playTone(600, 'square', 0.1, 0.5, 200);
  }

  playHit() {
    this.playTone(150, 'sawtooth', 0.2, 0.8, 50);
  }

  playPickup() {
    this.playTone(800, 'sine', 0.1, 0.5, 1200);
  }

  playGameOver() {
    this.playTone(200, 'sawtooth', 1.0, 1.0, 50);
  }

  startMusic() {
    // Simple pulsing background drone
    this.musicOsc = this.ctx.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A

    this.musicLfo = this.ctx.createOscillator();
    this.musicLfo.type = 'sine';
    this.musicLfo.frequency.setValueAtTime(0.5, this.ctx.currentTime); // 0.5 Hz pulse

    this.musicLfoGain = this.ctx.createGain();
    this.musicLfoGain.gain.setValueAtTime(0.5, this.ctx.currentTime);

    this.musicOscGain = this.ctx.createGain();
    this.musicOscGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    this.musicLfo.connect(this.musicLfoGain.gain);
    this.musicOsc.connect(this.musicOscGain);
    this.musicOscGain.connect(this.musicGain);

    this.musicOsc.start();
    this.musicLfo.start();
  }
}

// Game Entities
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 20;
    this.speed = 300;
    this.maxAmmo = 3;
    this.ammo = this.maxAmmo;
    this.fireRate = 0.25; // seconds
    this.fireTimer = 0;
    this.health = 3;
    this.invulnTimer = 0;
  }

  update(dt, input, width, height) {
    const move = input.getMovement();
    this.x += move.x * this.speed * dt;
    this.y += move.y * this.speed * dt;

    // Clamp to arena
    this.x = clamp(this.x, this.radius, width - this.radius);
    this.y = clamp(this.y, this.radius, height - this.radius);

    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    ctx.fillStyle = '#9e72e2';
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw "core" indicating ammo
    ctx.fillStyle = '#55ff55';
    for (let i = 0; i < this.ammo; i++) {
       const a = (i / this.maxAmmo) * Math.PI * 2 - Math.PI / 2;
       const d = this.radius * 0.5;
       ctx.beginPath();
       ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 4, 0, Math.PI * 2);
       ctx.fill();
    }

    ctx.restore();
  }
}

class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // 0 = basic, 1 = fast
    this.radius = type === 1 ? 12 : 18;
    this.speed = type === 1 ? 180 : 100;
    this.health = type === 1 ? 1 : 2;
    this.color = type === 1 ? '#ffcc00' : '#ff5555';
  }

  update(dt, targetX, targetY) {
    const a = angle(this.x, this.y, targetX, targetY);
    this.x += Math.cos(a) * this.speed * dt;
    this.y += Math.sin(a) * this.speed * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.fillStyle = this.color;
    ctx.beginPath();
    // Spiky shape
    const spikes = this.type === 1 ? 5 : 7;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? this.radius : this.radius * 0.5;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, dirX, dirY) {
    this.x = x;
    this.y = y;
    this.dirX = dirX;
    this.dirY = dirY;
    this.speed = 600;
    this.radius = 6;
    this.life = 1.0; // Distance or time limit before it drops as ammo
    this.dead = false;
  }

  update(dt) {
    this.x += this.dirX * this.speed * dt;
    this.y += this.dirY * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }

  draw(ctx) {
    ctx.fillStyle = '#55ff55';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

class AmmoDrop {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.bob = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.bob += dt * 5;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y + Math.sin(this.bob) * 5);

    ctx.fillStyle = '#55ff55';
    ctx.beginPath();
    // Diamond shape
    ctx.moveTo(0, -this.radius);
    ctx.lineTo(this.radius, 0);
    ctx.lineTo(0, this.radius);
    ctx.lineTo(-this.radius, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#55ff55';
    ctx.stroke();

    ctx.restore();
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const s = 50 + Math.random() * 150;
    this.vx = Math.cos(a) * s;
    this.vy = Math.sin(a) * s;
    this.life = 0.2 + Math.random() * 0.3;
    this.maxLife = this.life;
    this.color = color;
    this.radius = 2 + Math.random() * 3;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

// Game Engine
class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');

    this.saveManager = new SaveManager();
    this.input = new InputManager(this.canvas);
    this.audio = new AudioEngine(this.saveManager);

    this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
    this.lastTime = performance.now();

    // Game Data
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.ammoDrops = [];
    this.particles = [];

    this.score = 0;
    this.wave = 1;
    this.enemySpawnTimer = 0;
    this.shakeTime = 0;

    this.bgTime = 0;

    this.setupUI();

    // Handle Window Blur/Focus
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') this.setState('PAUSED');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.setState('PAUSED');
    });
  }

  setupUI() {
    this.ui = {
      title: document.getElementById('ui-title'),
      playing: document.getElementById('hud'),
      paused: document.getElementById('ui-paused'),
      gameover: document.getElementById('ui-gameover'),
      howto: document.getElementById('ui-howto'),
      options: document.getElementById('ui-options')
    };

    // Init values
    document.getElementById('high-score').textContent = this.saveManager.data.highScore;

    // Options
    const o = this.saveManager.data.options;
    document.getElementById('opt-master-vol').value = o.masterVol;
    document.getElementById('opt-sfx-vol').value = o.sfxVol;
    document.getElementById('opt-music-vol').value = o.musicVol;
    document.getElementById('opt-shake').value = o.shake;

    const updateOpts = () => {
      o.masterVol = parseInt(document.getElementById('opt-master-vol').value);
      o.sfxVol = parseInt(document.getElementById('opt-sfx-vol').value);
      o.musicVol = parseInt(document.getElementById('opt-music-vol').value);
      o.shake = parseFloat(document.getElementById('opt-shake').value);
      this.saveManager.save();
      this.audio.updateVolumes();
    };
    document.getElementById('opt-master-vol').addEventListener('input', updateOpts);
    document.getElementById('opt-sfx-vol').addEventListener('input', updateOpts);
    document.getElementById('opt-music-vol').addEventListener('input', updateOpts);
    document.getElementById('opt-shake').addEventListener('change', updateOpts);

    // Buttons
    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());
    document.getElementById('btn-resume').addEventListener('click', () => this.setState('PLAYING'));
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('pause-btn').addEventListener('click', () => this.setState('PAUSED'));

    document.getElementById('btn-title').addEventListener('click', () => this.setState('TITLE'));

    document.getElementById('btn-howto').addEventListener('click', () => this.ui.howto.classList.add('active'));
    document.getElementById('btn-close-howto').addEventListener('click', () => this.ui.howto.classList.remove('active'));

    document.getElementById('btn-options').addEventListener('click', () => this.ui.options.classList.add('active'));
    document.getElementById('btn-options-pause').addEventListener('click', () => this.ui.options.classList.add('active'));
    document.getElementById('btn-close-options').addEventListener('click', () => this.ui.options.classList.remove('active'));

    // Save management
    document.getElementById('btn-export-save').addEventListener('click', () => {
      prompt("Copy your save data:", btoa(JSON.stringify(this.saveManager.data)));
    });
    document.getElementById('btn-import-save').addEventListener('click', () => {
      const data = prompt("Paste your save data:");
      if (data) {
        try {
          const parsed = JSON.parse(atob(data));
          if (parsed && typeof parsed === 'object') {
             this.saveManager.memoryFallback = parsed;
             this.saveManager.save();
             location.reload();
          }
        } catch(e) {
          alert("Invalid save data!");
        }
      }
    });
    let resetClicks = 0;
    const btnReset = document.getElementById('btn-reset-save');
    btnReset.addEventListener('click', () => {
      resetClicks++;
      if (resetClicks === 1) {
        btnReset.textContent = "Click again to confirm reset";
        setTimeout(() => { resetClicks = 0; btnReset.textContent = "Reset Save"; }, 3000);
      } else {
        localStorage.removeItem(SAVE_KEY);
        location.reload();
      }
    });
  }

  setState(newState) {
    this.state = newState;
    Object.values(this.ui).forEach(el => el.classList.remove('active'));

    if (newState === 'TITLE') this.ui.title.classList.add('active');
    if (newState === 'PLAYING') this.ui.playing.classList.add('active');
    if (newState === 'PAUSED') {
       this.ui.paused.classList.add('active');
       this.ui.playing.classList.add('active'); // Keep HUD visible under PAUSED
    }
    if (newState === 'GAME_OVER') {
       this.ui.gameover.classList.add('active');
       document.getElementById('final-score').textContent = this.score;
       if (this.score > this.saveManager.data.highScore) {
         this.saveManager.data.highScore = this.score;
         this.saveManager.save();
         document.getElementById('new-high-score-msg').style.display = 'block';
         document.getElementById('high-score').textContent = this.score;
       } else {
         document.getElementById('new-high-score-msg').style.display = 'none';
       }
    }
  }

  startGame() {
    this.player = new Player(LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2);
    this.enemies = [];
    this.bullets = [];
    this.ammoDrops = [];
    this.particles = [];
    this.score = 0;
    this.wave = 1;
    this.enemySpawnTimer = 2;
    this.shakeTime = 0;
    this.updateHUD();
    this.setState('PLAYING');
  }

  spawnParticles(x, y, color, count) {
    const pCount = this.saveManager.data.options.shake > 0 ? count : Math.floor(count/2);
    for (let i=0; i<pCount; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    // Player Aiming and Firing
    const aim = this.input.getAim(this.player.x, this.player.y);
    if (aim.active && this.player.ammo > 0 && this.player.fireTimer <= 0) {
      this.player.ammo--;
      this.player.fireTimer = this.player.fireRate;
      this.bullets.push(new Bullet(this.player.x, this.player.y, aim.x, aim.y));
      this.audio.playShoot();
      this.spawnParticles(this.player.x, this.player.y, '#9e72e2', 5);
      this.shakeTime = 0.05;
      this.updateHUD();
    }

    this.player.update(dt, this.input, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Wave Management
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
      this.wave++;
      this.enemySpawnTimer = Math.max(0.5, 3 - this.wave * 0.1);

      const count = 1 + Math.floor(this.wave / 5);
      for (let i = 0; i < count; i++) {
        let ex, ey;
        if (Math.random() > 0.5) {
          ex = Math.random() > 0.5 ? -30 : LOGICAL_WIDTH + 30;
          ey = Math.random() * LOGICAL_HEIGHT;
        } else {
          ex = Math.random() * LOGICAL_WIDTH;
          ey = Math.random() > 0.5 ? -30 : LOGICAL_HEIGHT + 30;
        }
        const type = Math.random() > 0.8 ? 1 : 0;
        this.enemies.push(new Enemy(ex, ey, type));
      }
      this.updateHUD();
    }

    // Entities
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt);

      // Hit wall?
      if (b.x < 0 || b.x > LOGICAL_WIDTH || b.y < 0 || b.y > LOGICAL_HEIGHT) {
        b.dead = true;
      }

      if (b.dead) {
        // Drop ammo
        this.ammoDrops.push(new AmmoDrop(clamp(b.x, 20, LOGICAL_WIDTH-20), clamp(b.y, 20, LOGICAL_HEIGHT-20)));
        this.bullets.splice(i, 1);
        continue;
      }

      // Enemy Collision
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (dist(b.x, b.y, e.x, e.y) < b.radius + e.radius) {
          b.dead = true;
          e.health--;
          this.audio.playHit();
          this.spawnParticles(e.x, e.y, e.color, 10);
          if (e.health <= 0) {
            this.enemies.splice(j, 1);
            this.score += (e.type === 1 ? 20 : 10);
            this.shakeTime = 0.1;
            this.updateHUD();
          }
          break;
        }
      }
    }

    for (const e of this.enemies) e.update(dt, this.player.x, this.player.y);
    for (const a of this.ammoDrops) a.update(dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    // Ammo Pickup
    for (let i = this.ammoDrops.length - 1; i >= 0; i--) {
      const a = this.ammoDrops[i];
      if (dist(this.player.x, this.player.y, a.x, a.y) < this.player.radius + a.radius) {
        if (this.player.ammo < this.player.maxAmmo) {
          this.player.ammo++;
          this.ammoDrops.splice(i, 1);
          this.audio.playPickup();
          this.spawnParticles(a.x, a.y, '#55ff55', 5);
          this.updateHUD();
        }
      }
    }

    // Player hit by Enemy
    if (this.player.invulnTimer <= 0) {
      for (const e of this.enemies) {
        if (dist(this.player.x, this.player.y, e.x, e.y) < this.player.radius + e.radius) {
          this.player.health--;
          this.player.invulnTimer = 2.0; // i-frames
          this.audio.playHit();
          this.shakeTime = 0.3;
          this.spawnParticles(this.player.x, this.player.y, '#9e72e2', 20);
          this.updateHUD();

          if (this.player.health <= 0) {
             this.audio.playGameOver();
             this.setState('GAME_OVER');
          }
          break;
        }
      }
    }

    if (this.shakeTime > 0) this.shakeTime -= dt;
  }

  updateHUD() {
    document.getElementById('score-display').textContent = `Score: ${this.score}`;
    document.getElementById('health-display').textContent = `HP: ${this.player ? this.player.health : 3}`;
    document.getElementById('wave-display').textContent = `Wave: ${this.wave}`;
    document.getElementById('ammo-display').textContent = `Ammo: ${this.player ? this.player.ammo : 3}/${this.player ? this.player.maxAmmo : 3}`;
  }

  draw() {
    this.bgTime += 0.01;

    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.save();

    // Screen Shake
    if (this.shakeTime > 0 && this.state === 'PLAYING') {
      const shakeAmt = 10 * this.saveManager.data.options.shake;
      const dx = (Math.random() - 0.5) * shakeAmt;
      const dy = (Math.random() - 0.5) * shakeAmt;
      this.ctx.translate(dx, dy);
    }

    // Draw background "Cellular" environment
    this.ctx.strokeStyle = '#222';
    this.ctx.lineWidth = 2;
    for (let x = 0; x < LOGICAL_WIDTH; x += 100) {
      for (let y = 0; y < LOGICAL_HEIGHT; y += 100) {
        const ox = Math.sin(this.bgTime + y * 0.05) * 20;
        const oy = Math.cos(this.bgTime + x * 0.05) * 20;
        this.ctx.beginPath();
        this.ctx.arc(x + ox, y + oy, 40, 0, Math.PI*2);
        this.ctx.stroke();
      }
    }

    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
       if (this.player && this.player.health > 0) this.player.draw(this.ctx);
       for (const e of this.enemies) e.draw(this.ctx);
       for (const b of this.bullets) b.draw(this.ctx);
       for (const a of this.ammoDrops) a.draw(this.ctx);
       for (const p of this.particles) p.draw(this.ctx);
    }

    this.ctx.restore();
  }

  loop(time) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }

  start() {
    requestAnimationFrame((t) => {
      this.lastTime = t;
      this.loop(t);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine();
  engine.start();
});
