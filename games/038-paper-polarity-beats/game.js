class SaveManager {
  constructor() {
    this.key = 'arcade_game_038_038-paper-polarity-beats_v1';
    this.data = this.load();
  }

  load() {
    let d = {
      highScore: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        masterVol: 100,
        sfxVol: 100,
        musicVol: 100,
        shake: 1,
        particles: 1
      }
    };
    try {
      const stored = localStorage.getItem(this.key);
      if (stored) {
        d = { ...d, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn("localStorage load failed, using in-memory default.");
    }
    return d;
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      console.warn("localStorage save failed.");
    }
  }

  exportBase64() {
    return btoa(JSON.stringify(this.data));
  }

  importBase64(str) {
    try {
      const parsed = JSON.parse(atob(str));
      if (parsed && typeof parsed.highScore !== 'undefined') {
        this.data = { ...this.data, ...parsed };
        this.save();
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  reset() {
    try {
      localStorage.removeItem(this.key);
    } catch (e) {}
    this.data = this.load();
  }
}

class AudioEngine {
  constructor() {
    this.ctx = null; // initialized on first input
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    // Simple state
    this.musicOsc = null;
    this.isPlayingMusic = false;
  }

  init(options) {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.updateVolumes(options);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updateVolumes(options) {
    if (!this.ctx) return;
    const vol = (v) => Math.max(0, Math.min(1, v / 100));
    // smooth ramping to avoid clicks
    this.masterGain.gain.setTargetAtTime(vol(options.masterVol), this.ctx.currentTime, 0.05);
    this.sfxGain.gain.setTargetAtTime(vol(options.sfxVol), this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(vol(options.musicVol) * 0.3, this.ctx.currentTime, 0.05);
  }

  playSFX(type) {
    if (!this.ctx) return;
    this.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const t = this.ctx.currentTime;

    switch(type) {
      case 'switch':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      case 'hit':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      case 'damage':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.2);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.2);
        break;
      case 'gameover':
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.linearRampToValueAtTime(40, t + 0.5);
        gain.gain.setValueAtTime(1.0, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
        break;
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
    }
  }

  // A very simple rhythmic pulse
  startMusic() {
    if (!this.ctx || this.isPlayingMusic) return;
    this.isPlayingMusic = true;

    // We'll just run a scheduled loop in game update for rhythm,
    // or use a simple low frequency drone.
    this.musicOsc = this.ctx.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A
    this.musicOsc.connect(this.musicGain);
    this.musicOsc.start();
  }

  stopMusic() {
    if (this.musicOsc) {
      this.musicOsc.stop();
      this.musicOsc.disconnect();
      this.musicOsc = null;
    }
    this.isPlayingMusic = false;
  }

  // Pulse the drone slightly for rhythm
  pulseMusic(intensity) {
    if (!this.ctx || !this.isPlayingMusic) return;
    const t = this.ctx.currentTime;
    // modulate frequency slightly up and back down
    this.musicOsc.frequency.cancelScheduledValues(t);
    this.musicOsc.frequency.setValueAtTime(55, t);
    this.musicOsc.frequency.linearRampToValueAtTime(55 + (intensity * 20), t + 0.05);
    this.musicOsc.frequency.linearRampToValueAtTime(55, t + 0.2);
  }
}

class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.pointerDown = false;
    this.pointerX = 0;
    this.pointerY = 0;
    this.logicalX = 0;
    this.logicalY = 0;
    this.justPressed = false;

    this.canvas = canvas;
    this.logicalWidth = 1280;
    this.logicalHeight = 720;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        this.justPressed = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    const updatePointer = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      let clientX = e.clientX;
      let clientY = e.clientY;

      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }

      this.pointerX = clientX - rect.left;
      this.pointerY = clientY - rect.top;

      // Transform to logical coordinates
      const scaleX = this.logicalWidth / rect.width;
      const scaleY = this.logicalHeight / rect.height;

      this.logicalX = this.pointerX * scaleX;
      this.logicalY = this.pointerY * scaleY;
    };

    window.addEventListener('pointerdown', (e) => {
      // Don't intercept clicks on UI buttons
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
      this.pointerDown = true;
      this.justPressed = true;
      updatePointer(e);
    });

    window.addEventListener('pointermove', (e) => {
      if (this.pointerDown) {
        updatePointer(e);
      }
    });

    window.addEventListener('pointerup', () => {
      this.pointerDown = false;
    });

    // Explicit touch handling for cross-device symmetry
    window.addEventListener('touchstart', (e) => {
       if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
       // don't prevent default aggressively, let pointer events fire unless we need raw touch
    }, {passive: false});
  }

  consumePress() {
    if (this.justPressed) {
      this.justPressed = false;
      return true;
    }
    return false;
  }
}

// Global Export
window.SaveManager = SaveManager;
window.AudioEngine = AudioEngine;
window.InputManager = InputManager;

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Logical resolution
    this.logicalWidth = 1280;
    this.logicalHeight = 720;
    this.canvas.width = this.logicalWidth;
    this.canvas.height = this.logicalHeight;

    this.saveManager = new window.SaveManager();
    this.audio = new window.AudioEngine();
    this.input = new window.InputManager(this.canvas);

    this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER

    this.lastTime = performance.now();
    this.frameId = null;

    // Game State
    this.score = 0;
    this.multiplier = 1;
    this.health = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.shakeAmount = 0;
    this.notes = [];
    this.particles = [];

    // Polarity: 0 = Light, 1 = Dark
    this.playerPolarity = 0;
    this.playerY = this.logicalHeight / 2;
    this.targetY = this.logicalHeight / 2;

    // Rhythm tracking
    this.bpm = 120;
    this.beatInterval = 60 / this.bpm;
    this.timeSinceLastBeat = 0;
    this.spawnTimer = 0;
    this.baseSpeed = 400;
    this.speedMultiplier = 1;
    this.wave = 1;

    // DOM bindings
    this.bindUI();
    this.setupResizeObserver();
  }

  bindUI() {
    const s = (id) => document.getElementById(id);

    // Screens
    this.uiTitle = s('ui-title');
    this.uiPlaying = s('ui-playing');
    this.uiPaused = s('ui-paused');
    this.uiGameover = s('ui-gameover');
    this.uiOptions = s('ui-options');
    this.uiHowto = s('ui-howto');

    // HUD
    this.hudScore = s('hud-score');
    this.hudMultiplier = s('hud-multiplier');
    this.hudHealth = s('hud-health');

    // Buttons
    s('btn-play').addEventListener('click', () => { this.audio.playSFX('click'); this.startGame(); });
    s('btn-play-again').addEventListener('click', () => { this.audio.playSFX('click'); this.startGame(); });
    s('btn-pause').addEventListener('click', () => { this.audio.playSFX('click'); this.togglePause(); });
    s('btn-resume').addEventListener('click', () => { this.audio.playSFX('click'); this.togglePause(); });
    s('btn-restart').addEventListener('click', () => { this.audio.playSFX('click'); this.startGame(); });
    s('btn-title').addEventListener('click', () => { this.audio.playSFX('click'); this.setState('TITLE'); });

    s('btn-options-title').addEventListener('click', () => { this.audio.playSFX('click'); this.uiOptions.classList.remove('hidden'); });
    s('btn-options-pause').addEventListener('click', () => { this.audio.playSFX('click'); this.uiOptions.classList.remove('hidden'); });
    s('btn-close-options').addEventListener('click', () => { this.audio.playSFX('click'); this.uiOptions.classList.add('hidden'); });

    s('btn-howto').addEventListener('click', () => { this.audio.playSFX('click'); this.uiHowto.classList.remove('hidden'); });
    s('btn-close-howto').addEventListener('click', () => { this.audio.playSFX('click'); this.uiHowto.classList.add('hidden'); });

    // Options inputs
    const opt = this.saveManager.data.options;
    s('opt-master-vol').value = opt.masterVol;
    s('opt-sfx-vol').value = opt.sfxVol;
    s('opt-music-vol').value = opt.musicVol;
    s('opt-shake').value = opt.shake;
    s('opt-particles').value = opt.particles;

    const updateOpts = () => {
      opt.masterVol = parseInt(s('opt-master-vol').value);
      opt.sfxVol = parseInt(s('opt-sfx-vol').value);
      opt.musicVol = parseInt(s('opt-music-vol').value);
      opt.shake = parseFloat(s('opt-shake').value);
      opt.particles = parseFloat(s('opt-particles').value);
      this.saveManager.save();
      this.audio.updateVolumes(opt);
    };

    ['opt-master-vol', 'opt-sfx-vol', 'opt-music-vol', 'opt-shake', 'opt-particles'].forEach(id => {
      s(id).addEventListener('change', updateOpts);
    });

    // Save ops
    s('btn-export-save').addEventListener('click', () => {
       const str = this.saveManager.exportBase64();
       prompt("Copy this save string:", str);
    });

    s('btn-import-save').addEventListener('click', () => {
       const str = prompt("Paste your save string:");
       if (str) {
         if (this.saveManager.importBase64(str)) {
           alert("Save imported!");
           updateOpts();
           s('title-stats').innerText = `High Score: ${this.saveManager.data.highScore}`;
         } else {
           alert("Invalid save string.");
         }
       }
    });

    let resetClicks = 0;
    s('btn-reset-save').addEventListener('click', (e) => {
       resetClicks++;
       if (resetClicks === 1) {
         e.target.innerText = "Click again to confirm reset";
         setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset Save"; }, 3000);
       } else {
         this.saveManager.reset();
         alert("Save reset.");
         e.target.innerText = "Reset Save";
         resetClicks = 0;
         s('title-stats').innerText = `High Score: ${this.saveManager.data.highScore}`;
       }
    });

    // Initial stats
    s('title-stats').innerText = `High Score: ${this.saveManager.data.highScore}`;

    // Auto-pause on blur
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.togglePause();
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.togglePause();
      }
    });
  }

  setupResizeObserver() {
    const container = document.getElementById('game-container');
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const aspect = this.logicalWidth / this.logicalHeight;
      let newW = rect.width;
      let newH = rect.width / aspect;

      if (newH > rect.height) {
        newH = rect.height;
        newW = rect.height * aspect;
      }

      this.canvas.style.width = `${newW}px`;
      this.canvas.style.height = `${newH}px`;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
  }

  setState(newState) {
    this.state = newState;
    [this.uiTitle, this.uiPlaying, this.uiPaused, this.uiGameover].forEach(el => el.classList.remove('active'));

    if (newState === 'TITLE') this.uiTitle.classList.add('active');
    else if (newState === 'PLAYING') this.uiPlaying.classList.add('active');
    else if (newState === 'PAUSED') this.uiPaused.classList.add('active');
    else if (newState === 'GAME_OVER') this.uiGameover.classList.add('active');
  }

  init() {
    this.setState('TITLE');
    this.loop(performance.now());
  }

  startGame() {
    this.audio.init(this.saveManager.data.options);
    this.audio.startMusic();

    this.score = 0;
    this.multiplier = 1;
    this.health = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.wave = 1;

    this.notes = [];
    this.particles = [];

    this.playerPolarity = 0;
    this.speedMultiplier = 1;
    this.spawnTimer = 0;

    this.updateHUD();
    this.setState('PLAYING');
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.setState('PAUSED');
      this.audio.stopMusic();
    } else if (this.state === 'PAUSED') {
      this.setState('PLAYING');
      this.audio.startMusic();
      this.lastTime = performance.now();
    }
  }

  endGame() {
    this.setState('GAME_OVER');
    this.audio.stopMusic();
    this.audio.playSFX('gameover');

    this.saveManager.data.totalGamesPlayed++;
    this.saveManager.data.totalScoreAccumulated += this.score;

    const isNewHigh = this.score > this.saveManager.data.highScore;
    if (isNewHigh) {
      this.saveManager.data.highScore = this.score;
    }

    // Milestones check
    let newlyUnlocked = [];
    if (this.score >= 5000 && !this.saveManager.data.unlockedMilestones.includes('Score 5k')) {
       this.saveManager.data.unlockedMilestones.push('Score 5k');
       newlyUnlocked.push('Score 5k');
    }
    if (this.maxCombo >= 20 && !this.saveManager.data.unlockedMilestones.includes('20 Combo')) {
       this.saveManager.data.unlockedMilestones.push('20 Combo');
       newlyUnlocked.push('20 Combo');
    }
    if (this.wave >= 5 && !this.saveManager.data.unlockedMilestones.includes('Wave 5')) {
       this.saveManager.data.unlockedMilestones.push('Wave 5');
       newlyUnlocked.push('Wave 5');
    }
    this.saveManager.save();

    document.getElementById('title-stats').innerText = `High Score: ${this.saveManager.data.highScore}`;
    document.getElementById('go-score').innerText = `Final Score: ${this.score}`;

    const newHighEl = document.getElementById('go-new-high');
    if (isNewHigh) newHighEl.classList.remove('hidden');
    else newHighEl.classList.add('hidden');

    const msEl = document.getElementById('go-milestones');
    msEl.innerHTML = newlyUnlocked.length > 0 ? `<p style="color:#e8dc6d">Unlocked: ${newlyUnlocked.join(', ')}</p>` : '';
  }

  updateHUD() {
    this.hudScore.innerText = `Score: ${this.score}`;
    this.hudMultiplier.innerText = `x${this.multiplier}`;

    this.hudHealth.innerHTML = '';
    for(let i = 0; i < this.health; i++) {
      const pip = document.createElement('div');
      pip.className = 'health-pip';
      this.hudHealth.appendChild(pip);
    }
  }

  spawnParticle(x, y, color, count) {
    const mult = this.saveManager.data.options.particles;
    if (mult <= 0) return;

    const actualCount = Math.floor(count * mult);
    for(let i=0; i<actualCount; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 0.5) * 400,
        life: 1.0,
        color: color,
        size: Math.random() * 10 + 5
      });
    }
  }

  spawnNote() {
    const polarities = [0, 1];
    const p = polarities[Math.floor(Math.random() * polarities.length)];
    // Spawn at right edge
    this.notes.push({
      x: this.logicalWidth + 50,
      y: this.logicalHeight / 2, // single track for now, could add lanes
      polarity: p,
      active: true
    });
  }

  updatePlaying(dt) {
    // 1. Inputs
    if (this.input.consumePress()) {
      // Audio engine needs user gesture to start ctx
      if (!this.audio.ctx) {
         this.audio.init(this.saveManager.data.options);
      }
      this.playerPolarity = this.playerPolarity === 0 ? 1 : 0;
      this.audio.playSFX('switch');
      // small pop effect
      this.spawnParticle(150, this.playerY, this.playerPolarity === 0 ? '#f0f0f0' : '#444', 5);
    }

    // Move target Y based on pointer if dragging (optional extension, currently locked to center)
    if (this.input.pointerDown) {
       // this.targetY = this.input.logicalY;
    }
    // smooth damp player Y
    this.playerY += (this.targetY - this.playerY) * 10 * dt;

    // 2. Rhythm and Spawning
    this.timeSinceLastBeat += dt;
    if (this.timeSinceLastBeat >= this.beatInterval) {
      this.timeSinceLastBeat -= this.beatInterval;
      this.audio.pulseMusic(this.multiplier / 10);
    }

    this.spawnTimer += dt;
    // Spawn rate increases with wave
    const currentSpawnInterval = Math.max(0.4, 1.5 - (this.wave * 0.1));
    if (this.spawnTimer >= currentSpawnInterval) {
      this.spawnTimer = 0;
      this.spawnNote();

      // wave progression
      if (this.score > this.wave * 2000) {
        this.wave++;
        this.speedMultiplier += 0.15;
      }
    }

    // 3. Update Notes
    const playerX = 150;
    const hitRadius = 50;

    for (let i = this.notes.length - 1; i >= 0; i--) {
      let n = this.notes[i];
      if (!n.active) continue;

      n.x -= this.baseSpeed * this.speedMultiplier * dt;

      // Check collision
      if (Math.abs(n.x - playerX) < hitRadius && Math.abs(n.y - this.playerY) < hitRadius) {
        n.active = false;
        if (n.polarity === this.playerPolarity) {
          // Success
          this.combo++;
          if (this.combo > this.maxCombo) this.maxCombo = this.combo;
          this.multiplier = Math.min(10, 1 + Math.floor(this.combo / 5));
          this.score += 100 * this.multiplier;

          this.audio.playSFX('hit');
          this.spawnParticle(n.x, n.y, n.polarity === 0 ? '#f0f0f0' : '#444', 15);
          this.shakeAmount = 5 * this.saveManager.data.options.shake;

        } else {
          // Fail - damage
          this.combo = 0;
          this.multiplier = 1;
          this.health--;
          this.audio.playSFX('damage');
          this.spawnParticle(n.x, n.y, '#ff5555', 20);
          this.shakeAmount = 15 * this.saveManager.data.options.shake;

          if (this.health <= 0) {
            this.endGame();
            return;
          }
        }
        this.updateHUD();
      } else if (n.x < -100) {
        // Missed note completely
        n.active = false;
        this.combo = 0;
        this.multiplier = 1;
        this.updateHUD();
      }
    }

    // Cleanup inactive notes
    this.notes = this.notes.filter(n => n.active);

    // 4. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 2;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 5. Shake Decay
    if (this.shakeAmount > 0) {
      this.shakeAmount -= dt * 30;
      if (this.shakeAmount < 0) this.shakeAmount = 0;
    }
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    if (this.state === 'PLAYING') {
      this.updatePlaying(dt);
    }

    this.draw();

    this.frameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  draw() {
    // Clear and background
    this.ctx.fillStyle = '#2a2826'; // var(--bg) approx
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    this.ctx.save();

    // Apply Shake
    if (this.shakeAmount > 0 && this.state === 'PLAYING') {
      const dx = (Math.random() - 0.5) * this.shakeAmount;
      const dy = (Math.random() - 0.5) * this.shakeAmount;
      this.ctx.translate(dx, dy);
    }

    // Procedural rendering calls go here
    if (typeof this.drawGraphics === 'function') {
      this.drawGraphics();
    }

    this.ctx.restore();
  }

  // Procedural Graphics Extension
  drawGraphics() {
    // Background Diorama Grid
    this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let x = 0; x < this.logicalWidth; x += 100) {
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.logicalHeight);
    }
    for (let y = 0; y < this.logicalHeight; y += 100) {
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.logicalWidth, y);
    }
    this.ctx.stroke();

    // Draw center track line
    this.ctx.strokeStyle = '#44413e';
    this.ctx.lineWidth = 10;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.logicalHeight / 2);
    this.ctx.lineTo(this.logicalWidth, this.logicalHeight / 2);
    this.ctx.stroke();

    if (this.state === 'TITLE') {
      // Draw background paper elements flying by
      const t = performance.now() / 1000;
      this.drawPaperPoly(this.logicalWidth/2 + Math.sin(t)*200, this.logicalHeight/2 + Math.cos(t*0.8)*150, 80, t, 0);
      this.drawPaperPoly(this.logicalWidth/2 + Math.cos(t*1.2)*300, this.logicalHeight/2 + Math.sin(t*1.5)*200, 60, -t, 1);
      return;
    }

    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
      // Draw Notes
      for (const n of this.notes) {
        if (!n.active) continue;
        const pulse = 1 + Math.sin(this.timeSinceLastBeat * Math.PI * 2 / this.beatInterval) * 0.1;
        this.drawPaperPoly(n.x, n.y, 40 * pulse, n.x * 0.01, n.polarity);
      }

      // Draw Player (Catcher)
      const playerX = 150;
      this.drawPlayer(playerX, this.playerY, this.playerPolarity);

      // Draw Particles
      for (const p of this.particles) {
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1.0;
    }
  }

  drawPaperPoly(x, y, radius, rotation, polarity) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);

    // Shadow for diorama feel
    this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowOffsetX = 5;
    this.ctx.shadowOffsetY = 5;

    // Shape (Diamond for 0, Hexagon for 1)
    this.ctx.beginPath();
    const sides = polarity === 0 ? 4 : 6;
    for(let i=0; i<sides; i++) {
      const angle = i * (Math.PI*2)/sides;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i===0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();

    // Fill
    this.ctx.fillStyle = polarity === 0 ? '#f0f0f0' : '#44413e';
    this.ctx.fill();

    // Stroke to give it a folded edge look
    this.ctx.shadowColor = 'transparent';
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = polarity === 0 ? '#cccccc' : '#222222';
    this.ctx.stroke();

    // Inner fold lines
    this.ctx.beginPath();
    for(let i=0; i<sides; i++) {
      const angle = i * (Math.PI*2)/sides;
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    this.ctx.strokeStyle = polarity === 0 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPlayer(x, y, polarity) {
    this.ctx.save();
    this.ctx.translate(x, y);

    // Outer catching zone indicator
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 60, 0, Math.PI*2);
    this.ctx.strokeStyle = '#e8dc6d';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 10]);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Inner active polarity shape
    const radius = 45;
    this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
    this.ctx.shadowBlur = 15;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 10;

    this.ctx.beginPath();
    // Complex star-like shape
    for(let i=0; i<8; i++) {
      const r = i % 2 === 0 ? radius : radius/2;
      const angle = i * (Math.PI*2)/8 + (performance.now()*0.001);
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if(i===0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.closePath();

    this.ctx.fillStyle = polarity === 0 ? '#f0f0f0' : '#44413e';
    this.ctx.fill();
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = polarity === 0 ? '#ffffff' : '#222222';
    this.ctx.stroke();

    this.ctx.restore();
  }

}

window.GameEngine = GameEngine;
