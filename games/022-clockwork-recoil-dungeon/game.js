const SAVE_KEY = 'arcade_game_022_022-clockwork-recoil-dungeon_v1';

class SaveManager {
  constructor() {
    this.data = {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        mute: false,
        sfxVolume: 100,
        musicVolume: 100,
        screenShake: '100',
        particles: 'high',
        touchControls: 'auto'
      }
    };
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
      }
    } catch (e) {
      console.warn('Failed to load save data:', e);
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save data:', e);
    }
  }

  updateScore(score, wave) {
    let newHigh = false;
    if (score > this.data.highScore) {
      this.data.highScore = score;
      newHigh = true;
    }
    if (wave > this.data.bestWaveOrCombo) {
      this.data.bestWaveOrCombo = wave;
    }
    this.data.totalGamesPlayed++;
    this.data.totalScoreAccumulated += score;

    // Milestones
    if (this.data.highScore >= 1000 && !this.data.unlockedMilestones.includes('Gear Novice')) {
      this.data.unlockedMilestones.push('Gear Novice');
    }
    if (this.data.highScore >= 5000 && !this.data.unlockedMilestones.includes('Steam Adept')) {
      this.data.unlockedMilestones.push('Steam Adept');
    }
    if (this.data.bestWaveOrCombo >= 10 && !this.data.unlockedMilestones.includes('Foundry Master')) {
      this.data.unlockedMilestones.push('Foundry Master');
    }

    this.save();
    return newHigh;
  }
}

class InputManager {
  constructor(engine) {
    this.engine = engine;
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.touch = { leftActive: false, leftX: 0, leftY: 0, rightActive: false };

    // Keyboard
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    // Mouse
    this.engine.canvas.addEventListener('mousemove', e => this.updateMouse(e));
    this.engine.canvas.addEventListener('mousedown', e => {
      if (this.engine.state !== 'PLAYING') return;
      this.updateMouse(e);
      this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });

    // Touch
    const tZone = document.getElementById('touch-joystick');
    const fZone = document.getElementById('touch-fire');
    const knob = document.getElementById('touch-knob');

    const handleTouch = (e) => {
      if (this.engine.state !== 'PLAYING') return;
      e.preventDefault();
      this.touch.leftActive = false;
      this.touch.rightActive = false;

      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];

        // Check fire zone
        const fRect = fZone.getBoundingClientRect();
        if (t.clientX >= fRect.left && t.clientX <= fRect.right &&
            t.clientY >= fRect.top && t.clientY <= fRect.bottom) {
          this.touch.rightActive = true;
        }

        // Check stick zone
        const tRect = tZone.getBoundingClientRect();
        if (t.clientX >= tRect.left - 50 && t.clientX <= tRect.right + 50 &&
            t.clientY >= tRect.top - 50 && t.clientY <= tRect.bottom + 50) {
          this.touch.leftActive = true;
          const cx = tRect.left + tRect.width/2;
          const cy = tRect.top + tRect.height/2;
          let dx = t.clientX - cx;
          let dy = t.clientY - cy;
          const mag = Math.sqrt(dx*dx + dy*dy);
          const maxDist = tRect.width/2;
          if (mag > maxDist) {
            dx = (dx/mag) * maxDist;
            dy = (dy/mag) * maxDist;
          }
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
          this.touch.leftX = dx / maxDist;
          this.touch.leftY = dy / maxDist;
        }
      }

      if (!this.touch.leftActive) {
        knob.style.transform = `translate(-50%, -50%)`;
        this.touch.leftX = 0;
        this.touch.leftY = 0;
      }
    };

    document.getElementById('touch-controls').addEventListener('touchstart', handleTouch, {passive: false});
    document.getElementById('touch-controls').addEventListener('touchmove', handleTouch, {passive: false});
    document.getElementById('touch-controls').addEventListener('touchend', handleTouch, {passive: false});
    document.getElementById('touch-controls').addEventListener('touchcancel', handleTouch, {passive: false});
  }

  updateMouse(e) {
    const rect = this.engine.canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    this.mouse.x = (rawX - this.engine.offsetX) / this.engine.scale;
    this.mouse.y = (rawY - this.engine.offsetY) / this.engine.scale;
  }

  getAim() {
    let dx = 0;
    let dy = 0;
    let active = false;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) { dy -= 1; active = true; }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) { dy += 1; active = true; }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) { dx -= 1; active = true; }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) { dx += 1; active = true; }

    if (active) {
      const mag = Math.sqrt(dx*dx + dy*dy);
      return { x: dx/mag, y: dy/mag, type: 'keys' };
    }

    if (this.touch.leftActive) {
      const mag = Math.sqrt(this.touch.leftX*this.touch.leftX + this.touch.leftY*this.touch.leftY);
      if (mag > 0.1) {
        return { x: this.touch.leftX/mag, y: this.touch.leftY/mag, type: 'touch' };
      }
    }

    // Mouse aim
    if (this.engine.player) {
      const pdx = this.mouse.x - this.engine.player.x;
      const pdy = this.mouse.y - this.engine.player.y;
      const mag = Math.sqrt(pdx*pdx + pdy*pdy);
      if (mag > 0) return { x: pdx/mag, y: pdy/mag, type: 'mouse' };
    }

    return { x: 0, y: -1, type: 'none' };
  }

  isFiring() {
    return this.keys['Space'] || this.mouse.down || this.touch.rightActive;
  }
}

class SoundEngine {
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
    this.musicOsc = null;
    this.nextNoteTime = 0;
    this.noteIdx = 0;
    this.sequence = [440, 0, 523.25, 0, 659.25, 523.25, 880, 0]; // A4, C5, E5, C5, A5
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.updateVolumes();
    this.unlocked = true;

    // Resume immediately if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updateVolumes() {
    if (!this.ctx) return;
    const opts = this.saveManager.data.options;
    if (opts.mute) {
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    } else {
      this.masterGain.gain.setValueAtTime(1, this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime((opts.musicVolume / 100) * 0.3, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(opts.sfxVolume / 100, this.ctx.currentTime);
    }
  }

  playTone(freq, type, duration, vol=1) {
    if (!this.ctx || !this.unlocked) return;
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
    this.playTone(150, 'square', 0.1, 0.5);
    this.playTone(100, 'sawtooth', 0.2, 0.4);
  }

  playBounce() {
    this.playTone(600, 'sine', 0.1, 0.3);
  }

  playHit() {
    if (!this.ctx || !this.unlocked) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playExplosion() {
    if (!this.ctx || !this.unlocked) return;
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start();
  }

  updateMusic() {
    if (!this.ctx || !this.unlocked) return;
    if (this.ctx.state === 'suspended') return;

    this.updateVolumes();

    const now = this.ctx.currentTime;
    if (now >= this.nextNoteTime) {
      const freq = this.sequence[this.noteIdx];
      if (freq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq / 4, now); // low bass arp

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(now);
        osc.stop(now + 0.2);
      }

      this.nextNoteTime = now + 0.25; // 16th note at ~120 BPM
      this.noteIdx = (this.noteIdx + 1) % this.sequence.length;
    }
  }
}

class Engine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.logicalWidth = 1280;
    this.logicalHeight = 720;
    this.scale = 1;

    this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
    this.lastTime = 0;
    this.animFrameId = null;

    this.saveManager = new SaveManager();
    this.sound = new SoundEngine(this.saveManager);
    this.input = new InputManager(this);

    this.player = null;

    this.initResize();
    this.initUI();
    this.updateTitleScore();
  }

  initResize() {
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        this.resize();
      }
    });
    resizeObserver.observe(document.getElementById('game-container'));
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const container = document.getElementById('game-container');
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    this.canvas.width = cw;
    this.canvas.height = ch;

    const scaleX = cw / this.logicalWidth;
    const scaleY = ch / this.logicalHeight;
    this.scale = Math.min(scaleX, scaleY);

    this.offsetX = (cw - this.logicalWidth * this.scale) / 2;
    this.offsetY = (ch - this.logicalHeight * this.scale) / 2;

    this.draw();
  }

  initUI() {
    const getEl = id => document.getElementById(id);

    this.screens = {
      title: getEl('screen-title'),
      playing: getEl('hud'),
      paused: getEl('screen-paused'),
      gameover: getEl('screen-gameover'),
      options: getEl('screen-options'),
      howto: getEl('screen-howto')
    };

    // Title
    getEl('btn-play').addEventListener('click', () => this.startGame());
    getEl('btn-howto').addEventListener('click', () => this.showScreen('howto'));
    getEl('btn-options-title').addEventListener('click', () => {
      this.prevScreen = 'title';
      this.showScreen('options');
    });

    // Paused
    getEl('btn-resume').addEventListener('click', () => this.resumeGame());
    getEl('btn-restart').addEventListener('click', () => this.startGame());
    getEl('btn-options-pause').addEventListener('click', () => {
      this.prevScreen = 'paused';
      this.showScreen('options');
    });
    getEl('btn-quit').addEventListener('click', () => this.quitToTitle());

    // Game Over
    getEl('btn-play-again').addEventListener('click', () => this.startGame());
    getEl('btn-to-title').addEventListener('click', () => this.quitToTitle());

    // HUD
    getEl('btn-pause-hud').addEventListener('click', () => this.pauseGame());

    // Options
    getEl('btn-close-options').addEventListener('click', () => this.showScreen(this.prevScreen));
    getEl('btn-close-howto').addEventListener('click', () => this.showScreen('title'));

    // Options Sync
    this.syncOptionsUI();
    getEl('opt-mute').addEventListener('change', e => { this.saveManager.data.options.mute = e.target.checked; this.saveManager.save(); });
    getEl('opt-sfx').addEventListener('input', e => { this.saveManager.data.options.sfxVolume = parseInt(e.target.value); this.saveManager.save(); });
    getEl('opt-music').addEventListener('input', e => { this.saveManager.data.options.musicVolume = parseInt(e.target.value); this.saveManager.save(); });
    getEl('opt-shake').addEventListener('change', e => { this.saveManager.data.options.screenShake = e.target.value; this.saveManager.save(); });
    getEl('opt-particles').addEventListener('change', e => { this.saveManager.data.options.particles = e.target.value; this.saveManager.save(); });
    getEl('opt-touch').addEventListener('change', e => { this.saveManager.data.options.touchControls = e.target.value; this.saveManager.save(); this.updateTouchUI(); });

    getEl('btn-export-save').addEventListener('click', () => {
      getEl('export-data').value = btoa(JSON.stringify(this.saveManager.data));
      getEl('export-data').select();
      try { document.execCommand('copy'); } catch(err){}
    });

    getEl('btn-import-save').addEventListener('click', () => {
      try {
        const data = JSON.parse(atob(getEl('export-data').value));
        if (data && typeof data === 'object') {
          this.saveManager.data = data;
          this.saveManager.save();
          this.syncOptionsUI();
          this.updateTitleScore();
          alert('Save imported successfully!');
        }
      } catch(err) {
        alert('Invalid save data');
      }
    });

    let resetClicks = 0;
    getEl('btn-reset-save').addEventListener('click', (e) => {
      resetClicks++;
      if (resetClicks === 1) {
        e.target.innerText = "Click again to confirm reset";
      } else {
        localStorage.removeItem(SAVE_KEY);
        this.saveManager = new SaveManager();
        this.syncOptionsUI();
        this.updateTitleScore();
        e.target.innerText = "Reset Save";
        resetClicks = 0;
        alert('Save reset!');
      }
    });

    // Auto Pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.pauseGame();
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      }
    });

    // First interaction for AudioContext
    const unlockAudio = () => {
      this.sound.init();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  }

  syncOptionsUI() {
    const opts = this.saveManager.data.options;
    document.getElementById('opt-mute').checked = opts.mute;
    document.getElementById('opt-sfx').value = opts.sfxVolume;
    document.getElementById('opt-music').value = opts.musicVolume;
    document.getElementById('opt-shake').value = opts.screenShake;
    document.getElementById('opt-particles').value = opts.particles;
    document.getElementById('opt-touch').value = opts.touchControls;
  }

  updateTouchUI() {
    const show = this.saveManager.data.options.touchControls === 'always' ||
                 (this.saveManager.data.options.touchControls === 'auto' && 'ontouchstart' in window);
    document.getElementById('touch-controls').classList.toggle('active', show && this.state === 'PLAYING');
  }

  updateTitleScore() {
    document.getElementById('title-highscore').innerText = this.saveManager.data.highScore;
  }

  showScreen(screenId) {
    Object.values(this.screens).forEach(s => s.classList.remove('active'));
    if (this.screens[screenId]) {
      this.screens[screenId].classList.add('active');
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.showScreen('playing');
    this.updateTouchUI();

    this.player = {
      x: this.logicalWidth / 2,
      y: this.logicalHeight / 2,
      vx: 0,
      vy: 0,
      radius: 15,
      fireTimer: 0,
      fireRate: 0.2,
      health: 3,
      maxHealth: 3,
      invulnTimer: 0,
      damageFlash: 0
    };

    this.gears = [];
    this.generateEnvironment();


    this.enemies = [];
    this.enemySpawnTimer = 3.0;

    this.score = 0;
    this.wave = 1;
    this.enemyKills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.updateHUD();
this.shakeTimer = 0;
    this.shakeIntensity = 0;

    if (!this.animFrameId) {
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  pauseGame() {
    this.state = 'PAUSED';
    this.showScreen('paused');
    this.updateTouchUI();
  }

  resumeGame() {
    this.state = 'PLAYING';
    this.showScreen('playing');
    this.updateTouchUI();
    this.lastTime = performance.now();
  }

  quitToTitle() {
    this.state = 'TITLE';
    this.showScreen('title');
    this.updateTitleScore();
    this.updateTouchUI();
  }

  updateHUD() {
    if (this.state !== "PLAYING") return;
    document.getElementById("hud-score").innerText = this.score + (this.combo > 1 ? ` (x${this.combo})` : "");
    document.getElementById("hud-wave").innerText = this.wave;
  }

  takeDamage() {
    if (this.player.invulnTimer <= 0) {
      this.player.health--;
      this.player.invulnTimer = 1.0;
      this.player.damageFlash = 0.2;
      this.sound.playHit();
      this.shakeTimer = 0.2;
      this.shakeIntensity = 10;
      this.updateHUD();
    }
  }

  gameOver() {
    this.state = 'GAME_OVER';
    const newHigh = this.saveManager.updateScore(this.score, this.wave);
    document.getElementById("go-score").innerText = this.score;
    document.getElementById("go-wave").innerText = this.wave;
    document.getElementById("go-highscore-banner").style.display = newHigh ? "block" : "none";
    this.showScreen('gameover');
    this.updateTouchUI();
  }

  loop(now) {
    this.animFrameId = requestAnimationFrame(ts => this.loop(ts));

    let dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.draw();
  }

  spawnEnemy() {
    // Spawn off-screen
    let x, y;
    if (Math.random() > 0.5) {
      x = Math.random() > 0.5 ? -50 : this.logicalWidth + 50;
      y = Math.random() * this.logicalHeight;
    } else {
      x = Math.random() * this.logicalWidth;
      y = Math.random() > 0.5 ? -50 : this.logicalHeight + 50;
    }

    this.enemies.push({
      x, y, radius: 12, speed: 60 + Math.random() * 40
    });
  }

  generateEnvironment() {
    this.gears = [];
    const numGears = 8;
    for (let i = 0; i < numGears; i++) {
      let x, y, r;
      let valid = false;
      let attempts = 0;
      while (!valid && attempts < 50) {
        r = 30 + Math.random() * 50;
        x = r + Math.random() * (this.logicalWidth - r * 2);
        y = r + Math.random() * (this.logicalHeight - r * 2);

        valid = true;
        // Avoid center where player spawns
        const dx = x - this.logicalWidth/2;
        const dy = y - this.logicalHeight/2;
        if (dx*dx + dy*dy < (r + 100)*(r + 100)) valid = false;

        // Avoid overlapping gears
        for (let g of this.gears) {
          const gx = x - g.x;
          const gy = y - g.y;
          if (gx*gx + gy*gy < (r + g.radius + 20)*(r + g.radius + 20)) valid = false;
        }
        attempts++;
      }

      if (valid) {
        this.gears.push({
          x, y, radius: r,
          rotation: Math.random() * Math.PI * 2,
          speed: (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random()),
          teeth: Math.floor(r / 5)
        });
      }
    }
  }

  update(dt) {
    if (!this.player) return;

    // Player Physics (Recoil as Movement)
    // 1. Friction
    const friction = 0.95;
    this.player.vx *= Math.pow(friction, dt * 60);
    this.player.vy *= Math.pow(friction, dt * 60);

    // 2. Shooting / Recoil
    const aim = this.input.getAim();
    if (this.input.isFiring() && this.player.fireTimer <= 0) {
      this.sound.playShoot();
      this.player.fireTimer = this.player.fireRate;

      // Apply recoil force (opposite to aim direction)
      // If aim is zero (no input), shoot "up" as default so recoil pushes down
      let ax = aim.x;
      let ay = aim.y;
      if (ax === 0 && ay === 0) { ay = -1; }

      const recoilForce = 400;
      this.player.vx -= ax * recoilForce;
      this.player.vy -= ay * recoilForce;

      // Screen shake
      if (this.saveManager.data.options.screenShake !== '0') {
        this.shakeTimer = 0.1;
        this.shakeIntensity = 5 * (parseInt(this.saveManager.data.options.screenShake) / 100);
      }
    }

    if (this.player.fireTimer > 0) {
      this.player.fireTimer -= dt;
    }

    // 3. Movement & Collision
    let nextX = this.player.x + this.player.vx * dt;
    let nextY = this.player.y + this.player.vy * dt;

    // Wall collision
    let bounced = false;
    if (nextX < this.player.radius) {
      nextX = this.player.radius;
      this.player.vx *= -1;
      bounced = true;
    } else if (nextX > this.logicalWidth - this.player.radius) {
      nextX = this.logicalWidth - this.player.radius;
      this.player.vx *= -1;
      bounced = true;
    }

    if (nextY < this.player.radius) {
      nextY = this.player.radius;
      this.player.vy *= -1;
      bounced = true;
    } else if (nextY > this.logicalHeight - this.player.radius) {
      nextY = this.logicalHeight - this.player.radius;
      this.player.vy *= -1;
      bounced = true;
    }

    // Gear collision (circle-circle)
    for (let g of this.gears) {
      const dx = nextX - g.x;
      const dy = nextY - g.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minDist = this.player.radius + g.radius;

      if (dist < minDist) {
        // Resolve overlap
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        nextX += nx * overlap;
        nextY += ny * overlap;

        // Reflect velocity
        const dot = this.player.vx * nx + this.player.vy * ny;
        this.player.vx -= 2 * dot * nx;
        this.player.vy -= 2 * dot * ny;

        // Add restitution/bounce energy
        const bounceMult = 1.2;
        this.player.vx *= bounceMult;
        this.player.vy *= bounceMult;

        bounced = true;
      }
    }

    if (bounced) {
      this.sound.playBounce();
      // Only shake on fast impacts
      const speed = Math.sqrt(this.player.vx*this.player.vx + this.player.vy*this.player.vy);
      if (speed > 200 && this.saveManager.data.options.screenShake !== '0') {
        this.shakeTimer = 0.1;
        this.shakeIntensity = 2 * (parseInt(this.saveManager.data.options.screenShake) / 100);
      }
    // Damage enemies on bounce dash
      if (speed > 300) {
         for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const dx = nextX - e.x;
            const dy = nextY - e.y;
            if (dx*dx + dy*dy < (this.player.radius + e.radius + 10)*(this.player.radius + e.radius + 10)) {
               this.enemies.splice(i, 1);
               this.sound.playExplosion();
               this.combo++;
               this.comboTimer = 2.0;
               this.score += 100 * this.combo;
               this.enemyKills++;

               if (this.enemyKills >= this.wave * 5) {
                   this.wave++;
                   this.sound.playTone(880, "sine", 0.5, 0.5);
               }
               this.updateHUD();
}
         }
      }
    }

    this.player.x = nextX;
    this.player.y = nextY;

    // Enemy Spawn
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
      this.spawnEnemy();
      this.enemySpawnTimer = 3.0 + Math.random() * 2.0; // random interval
    }

    // Enemy Update & Collision
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // Move towards player
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist > 0) {
        e.x += (dx / dist) * e.speed * dt;
        e.y += (dy / dist) * e.speed * dt;
      }

      // Damage Player
      if (dist < this.player.radius + e.radius) {
        this.takeDamage();
        this.enemies.splice(i, 1);
      }
    }

    // Screen Shake update
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
    }

    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer -= dt;
    }
    if (this.player.damageFlash > 0) {
      this.player.damageFlash -= dt;
    }

    if (this.player.health <= 0) {
      this.gameOver();
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }

    // Music
    this.sound.updateMusic();
  }

  draw() {
    this.ctx.fillStyle = '#1a1512';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // Apply Shake
    if (this.shakeTimer > 0) {
      const dx = (Math.random() - 0.5) * this.shakeIntensity;
      const dy = (Math.random() - 0.5) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
    }

    // Draw game here
    this.ctx.fillStyle = 'rgba(40, 30, 25, 0.5)';
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Draw Gears
    if (this.gears) {
      for (let g of this.gears) {
        g.rotation += g.speed * 0.016; // Approx dt for smooth rotation

        this.ctx.save();
        this.ctx.translate(g.x, g.y);
        this.ctx.rotate(g.rotation);

        this.ctx.fillStyle = '#1a1512';
        this.ctx.strokeStyle = '#8a8578';
        this.ctx.lineWidth = 3;

        this.ctx.beginPath();
        this.ctx.arc(0, 0, g.radius, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.stroke();

        // Teeth
        this.ctx.fillStyle = '#8a8578';
        for (let i=0; i<g.teeth; i++) {
          this.ctx.save();
          this.ctx.rotate((Math.PI * 2 / g.teeth) * i);
          this.ctx.fillRect(g.radius - 2, -4, 8, 8);
          this.ctx.restore();
        }

        // Inner hole
        this.ctx.beginPath();
        this.ctx.arc(0, 0, g.radius * 0.3, 0, Math.PI*2);
        this.ctx.stroke();

        this.ctx.restore();
      }
    }

    // Draw Enemies
    if (this.enemies) {
      this.ctx.fillStyle = '#ff4444';
      this.ctx.strokeStyle = '#220000';
      this.ctx.lineWidth = 2;
      for (let e of this.enemies) {
        this.ctx.beginPath();
        this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Steam eye
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(e.x + (this.player ? (this.player.x - e.x)*0.1 : 0),
                     e.y + (this.player ? (this.player.y - e.y)*0.1 : 0),
                     e.radius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ff4444';
      }
    }

    if (this.player) {
      this.ctx.fillStyle = '#c7c99b';
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw aim indicator
      const aim = this.input.getAim();
      let ax = aim.x;
      let ay = aim.y;
      if (ax === 0 && ay === 0) { ay = -1; }

      this.ctx.strokeStyle = 'rgba(199, 201, 155, 0.5)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.x, this.player.y);
      this.ctx.lineTo(this.player.x + ax * 40, this.player.y + ay * 40);
      this.ctx.stroke();
    }

    this.ctx.strokeStyle = '#c7c99b';
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(0, 0, this.logicalWidth, this.logicalHeight);

    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const engine = new Engine();
});