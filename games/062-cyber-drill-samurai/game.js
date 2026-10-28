// --- Constants & Config ---
const SAVE_KEY = "arcade_game_062_062-cyber-drill-samurai_v1";

// --- Systems ---
class SaveManager {
  constructor() {
    this.data = { highScore: 0, totalGamesPlayed: 0 };
    this.load();
  }
  load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        this.data = { ...this.data, ...JSON.parse(saved) };
      }
    } catch (e) { console.warn("SaveManager load failed", e); }
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) { console.warn("SaveManager save failed", e); }
  }
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmOscs = [];
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmActive = false;
    this.tempo = 150; // bpm
    this.isBoss = false;
    this.isLowHp = false;
    this.filter = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.4;

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 2000;
      this.filter.connect(this.masterGain);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updateState(isBoss, isLowHp) {
    this.isBoss = isBoss;
    this.isLowHp = isLowHp;
    this.tempo = this.isBoss ? 180 : (this.isLowHp ? 130 : 150);

    if (this.filter && this.ctx) {
       const targetFreq = this.isLowHp ? 800 : (this.isBoss ? 4000 : 2000);
       this.filter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
    }

    // Reset timer to apply new tempo if playing
    if (this.bgmActive) {
      this.startBGM();
    }
  }

  startBGM() {
    if (!this.ctx) return;
    this.stopBGM();
    this.bgmActive = true;

    const interval = (60 / this.tempo) * 1000 / 2; // 8th notes

    this.bgmTimer = setInterval(() => {
      this._playBGMStep();
    }, interval);
  }

  stopBGM() {
    this.bgmActive = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  _playBGMStep() {
    if (!this.ctx || this.ctx.state !== 'running') return;

    const time = this.ctx.currentTime;
    const isKick = this.bgmStep % 4 === 0;
    const isSnare = this.bgmStep % 4 === 2;
    const isHihat = this.bgmStep % 1 === 0;

    // Arpeggiator / Bassline
    const bassScale = [110, 130.81, 146.83, 164.81, 196, 220]; // A2, C3, D3, E3, G3, A3
    const bossScale = [98, 110, 116.54, 130.81, 146.83, 164.81]; // G2, A2, Bb2, C3, D3, E3
    const scale = this.isBoss ? bossScale : bassScale;

    const noteIndex = this.bgmStep % scale.length;
    let freq = scale[noteIndex];
    if (this.isBoss && this.bgmStep % 8 < 4) freq *= 2; // Octave jumps for boss

    this._playSynthTone(freq, this.isBoss ? 'sawtooth' : 'square', 0.15, 0.2, this.filter);

    // Percussion
    if (isKick) {
      this._playDrum(150, 40, 0.2, 0.4);
    }
    if (isSnare) {
      this._playNoise(0.2, 0.3);
    }
    if (isHihat) {
      this._playNoise(0.05, 0.1, 5000);
    }

    this.bgmStep = (this.bgmStep + 1) % 16;
  }

  _playSynthTone(freq, type, duration, vol, destination) {
    if (window.engine && window.engine.uiManager && window.engine.uiManager.options.masterMute) return;
    vol = vol * (window.engine && window.engine.uiManager ? window.engine.uiManager.options.musicVolume : 1);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(destination || this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  _playDrum(startFreq, endFreq, duration, vol) {
    if (window.engine && window.engine.uiManager && window.engine.uiManager.options.masterMute) return;
    vol = vol * (window.engine && window.engine.uiManager ? window.engine.uiManager.options.musicVolume : 1);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  _playNoise(duration, vol, filterFreq) {
    if (window.engine && window.engine.uiManager && window.engine.uiManager.options.masterMute) return;
    vol = vol * (window.engine && window.engine.uiManager ? window.engine.uiManager.options.musicVolume : 1);
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    let targetDest = this.masterGain;
    const gain = this.ctx.createGain();

    if (filterFreq) {
      const bpFilter = this.ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.value = filterFreq;
      noise.connect(bpFilter);
      bpFilter.connect(gain);
    } else {
      noise.connect(gain);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    gain.connect(this.masterGain);

    noise.start();
  }

  // Generalized helper for SFX
  playToneEx(freq, type, duration, vol=1, slideFreq=null) {
    if (window.engine && window.engine.uiManager && window.engine.uiManager.options.masterMute) return;
    vol = vol * (window.engine && window.engine.uiManager ? window.engine.uiManager.options.sfxVolume : 1);
    if (!this.ctx || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;

    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // --- Required SFX (10+) ---
  playShoot() { this.playToneEx(600, 'square', 0.1, 0.4, 200); } // 1. Base Weapon
  playDash() { this.playToneEx(200, 'sine', 0.2, 0.5, 800); } // 2. Dash/Ability
  playHit() { this.playToneEx(150, 'sawtooth', 0.15, 0.6, 50); } // 3. Hit
  playExplosion() { this._playNoise(0.5, 0.8, 1000); } // 4. Explosion
  playCoin() { this.playToneEx(1200, 'sine', 0.1, 0.4, 1800); } // 5. Collectible
  playTetherPop() { this.playToneEx(800, 'sawtooth', 0.3, 0.6, 300); } // 6. Risk mechanic tether burst
  playTetherGrow() { this.playToneEx(300, 'sine', 0.2, 0.3, 400); } // 7. Tether growth
  playUpgrade() { this.playToneEx(400, 'square', 0.4, 0.5, 1200); } // 8. Upgrade
  playUIHover() { this.playToneEx(800, 'sine', 0.05, 0.2); } // 9. UI Hover
  playUISelect() { this.playToneEx(1000, 'square', 0.1, 0.3, 1400); } // 10. UI Select
  playBossSpawn() { this.playToneEx(100, 'sawtooth', 1.0, 0.8, 50); } // 11. Boss Spawn
}

class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.pointer = { x: 0, y: 0, active: false, justPressed: false };
    this.actionPressed = false;
    this.actionJustPressed = false;
    this.dashPressed = false;
    this.dashJustPressed = false;
    this.joystick = { active: false, dx: 0, dy: 0, startX: 0, startY: 0, id: null };

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.actionPressed = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.dashPressed = true;
        this.dashJustPressed = true;
      }
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.actionPressed = false;
    });

    canvas.addEventListener('pointerdown', e => {
      this.pointer.active = true;
      this.pointer.justPressed = true;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      this.pointer.x = x;
      this.pointer.y = y;

      const touchMode = window.engine && window.engine.uiManager ? window.engine.uiManager.options.touchMode : 'Auto';
      const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      if (touchMode === 'Off' || (touchMode === 'Auto' && !hasTouch && e.pointerType !== 'touch')) {
        return;
      }

      const handedness = window.engine && window.engine.uiManager ? window.engine.uiManager.options.handedness : 'Right';

      let isActionZone = false;
      let isDashZone = false;
      let isJoystickZone = false;

      if (handedness === 'Right') {
         isActionZone = x > canvas.width * 0.75;
         isDashZone = x > canvas.width * 0.5 && x <= canvas.width * 0.75;
         isJoystickZone = x <= canvas.width * 0.5;
      } else {
         // Left handed: Joystick on right, Action/Dash on left
         isActionZone = x < canvas.width * 0.25;
         isDashZone = x >= canvas.width * 0.25 && x < canvas.width * 0.5;
         isJoystickZone = x >= canvas.width * 0.5;
      }

      if (isActionZone) {
        this.actionPressed = true;
        this.actionJustPressed = true;
      } else if (isDashZone) {
        this.dashPressed = true;
        this.dashJustPressed = true;
      } else if (isJoystickZone) {
        this.joystick.active = true;
        this.joystick.startX = x;
        this.joystick.startY = y;
        this.joystick.id = e.pointerId;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
      }
    });

    canvas.addEventListener('pointermove', e => {
      if (this.joystick.active && this.joystick.id === e.pointerId) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);
        let dx = x - this.joystick.startX;
        let dy = y - this.joystick.startY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 50;
        if (dist > maxDist) {
          dx = (dx / dist) * maxDist;
          dy = (dy / dist) * maxDist;
        }
        this.joystick.dx = dx / maxDist;
        this.joystick.dy = dy / maxDist;
      }
    });

    canvas.addEventListener('pointerup', e => {
      this.pointer.active = false;
      if (this.joystick.id === e.pointerId) {
        this.joystick.active = false;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
        this.joystick.id = null;
      }
      this.actionPressed = false;
      this.dashPressed = false;
    });
    canvas.addEventListener('pointercancel', e => {
      this.pointer.active = false;
      if (this.joystick.id === e.pointerId) {
        this.joystick.active = false;
        this.joystick.dx = 0;
        this.joystick.dy = 0;
        this.joystick.id = null;
      }
      this.actionPressed = false;
      this.dashPressed = false;
    });
  }
  update() {
    this.pointer.justPressed = false;
    this.actionJustPressed = false;
    this.dashJustPressed = false;
  }
  getMovement() {
    let dx = 0;
    let dy = 0;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;

    if (this.joystick.active) {
      dx = this.joystick.dx;
      dy = this.joystick.dy;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy };
  }
}

// --- Entities ---
class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 200;
    this.vy = (Math.random() - 0.5) * 200;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 4 + 2;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt * 2;
  }
  draw(ctx, cameraY) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2 - cameraY, this.size, this.size);
    ctx.globalAlpha = 1.0;
  }
}

class Block {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.w = 40;
    this.h = 40;
    this.type = type; // 0: dirt (drillable), 1: rock (solid), 2: gem (drillable, points)
    this.active = true;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    if (this.type === 0) {
      ctx.fillStyle = '#3a2d2d';
      ctx.fillRect(this.x, this.y - cameraY, this.w, this.h);
      ctx.strokeStyle = '#2a1d1d';
      ctx.strokeRect(this.x, this.y - cameraY, this.w, this.h);
    } else if (this.type === 1) {
      ctx.fillStyle = '#6a6b6d';
      ctx.fillRect(this.x, this.y - cameraY, this.w, this.h);
      ctx.strokeStyle = '#4a4b4d';
      ctx.strokeRect(this.x, this.y - cameraY, this.w, this.h);
      // X pattern for rock
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - cameraY);
      ctx.lineTo(this.x + this.w, this.y - cameraY + this.h);
      ctx.moveTo(this.x + this.w, this.y - cameraY);
      ctx.lineTo(this.x, this.y - cameraY + this.h);
      ctx.stroke();
    } else if (this.type === 2) {
      ctx.fillStyle = '#3a2d2d';
      ctx.fillRect(this.x, this.y - cameraY, this.w, this.h);
      ctx.fillStyle = '#a0efb8';
      ctx.beginPath();
      ctx.arc(this.x + this.w/2, this.y - cameraY + this.h/2, 10, 0, Math.PI*2);
      ctx.fill();
    }
  }
}


class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 16;
    this.vx = 0;
    this.vy = 0;
    this.speed = 200;
    this.drillActive = false;
    this.angle = Math.PI / 2; // pointing down

    // Phase 2: Dash/Overdrive & Reactive Sprite
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.isDashing = false;
    this.dashDuration = 0.2;
    this.dashSpeedMultiplier = 3;
    this.invulnTimer = 0;
    this.recoilTimer = 0;
    this.recoilForceX = 0;
    this.recoilForceY = 0;
    this.thrustLevel = 0;
    this.aimLineLength = 50;
  }

  applyRecoil(force, angle) {
    this.recoilTimer = 0.15;
    this.recoilForceX = -Math.cos(angle) * force;
    this.recoilForceY = -Math.sin(angle) * force;
  }

  update(dt, input) {
    // Cooldowns & Timers
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.recoilTimer > 0) this.recoilTimer -= dt;
    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    }

    const mov = input.getMovement();

    // Handle Input for movement & dash
    if (input.dashJustPressed && this.dashCooldown <= 0) {
      if (window.game && window.game.soundEngine) window.game.soundEngine.playDash();
      this.isDashing = true;
      this.dashTimer = this.dashDuration;
      this.dashCooldown = 2.5; // 2.5 second cooldown
      this.invulnTimer = this.dashDuration; // Invulnerable while dashing
      this.applyRecoil(100, this.angle);

      // If pressing a direction, dash there, else dash forward
      if (mov.dx !== 0 || mov.dy !== 0) {
        this.angle = Math.atan2(mov.dy, mov.dx);
      }
    }

    // Momentum / Movement computation
    let targetVx = mov.dx * this.speed;
    let targetVy = mov.dy * this.speed;

    if (this.isDashing) {
      targetVx = Math.cos(this.angle) * this.speed * this.dashSpeedMultiplier;
      targetVy = Math.sin(this.angle) * this.speed * this.dashSpeedMultiplier;
      this.thrustLevel = 1.0;
    } else {
      if (mov.dx !== 0 || mov.dy !== 0) {
        this.angle = Math.atan2(mov.dy, mov.dx);
        this.drillActive = true;
        this.thrustLevel = Math.min(1.0, this.thrustLevel + dt * 5);
      } else {
        this.drillActive = false;
        this.thrustLevel = Math.max(0.0, this.thrustLevel - dt * 5);
      }
    }

    // Add recoil vector if active
    let rX = 0, rY = 0;
    if (this.recoilTimer > 0) {
      const p = this.recoilTimer / 0.15;
      rX = this.recoilForceX * p;
      rY = this.recoilForceY * p;
    }

    // Tighter friction/lerping towards target velocities
    const friction = 10 * dt;
    this.vx += (targetVx + rX - this.vx) * friction;
    this.vy += (targetVy + rY - this.vy) * friction;
  }

  draw(ctx, cameraY) {
    if (this.invulnTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
        return; // Blink invulnerability
    }

    ctx.save();
    ctx.translate(this.x, this.y - cameraY);
    ctx.rotate(this.angle);

    // Aim Telegraph Line (Reactive)
    if (this.thrustLevel > 0 && !this.isDashing) {
        ctx.strokeStyle = `rgba(58, 155, 220, ${this.thrustLevel * 0.3})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.r * 1.5, 0);
        ctx.lineTo(this.r * 1.5 + this.aimLineLength * this.thrustLevel, 0);
        ctx.stroke();
    }

    // Thruster Jet (Multi-part sprite element 1)
    if (this.thrustLevel > 0 || this.isDashing) {
        const jetLength = this.isDashing ? 30 : 15 * this.thrustLevel;
        ctx.fillStyle = this.isDashing ? '#f14668' : '#3a9bdc';
        ctx.beginPath();
        ctx.moveTo(-this.r * 0.8, -5);
        ctx.lineTo(-this.r * 0.8 - jetLength - Math.random() * 5, 0);
        ctx.lineTo(-this.r * 0.8, 5);
        ctx.closePath();
        ctx.fill();
    }

    // Recoil offset for body drawing
    let rx = 0;
    if (this.recoilTimer > 0) {
        rx = -Math.cos(0) * (this.recoilTimer / 0.15) * 5; // Local space recoil shift backwards
    }

    ctx.translate(rx, 0);

    // Cyber Samurai Shoulders/Armor (Multi-part sprite element 2)
    ctx.fillStyle = '#1c222b';
    ctx.fillRect(-this.r * 0.6, -this.r, this.r * 1.2, this.r * 2);
    ctx.strokeStyle = '#f5ca53';
    ctx.lineWidth = 2;
    ctx.strokeRect(-this.r * 0.6, -this.r, this.r * 1.2, this.r * 2);

    // Core Body/Helmet (Multi-part sprite element 3)
    ctx.fillStyle = '#3a9bdc';
    ctx.beginPath();
    ctx.arc(0, 0, this.r * 0.8, 0, Math.PI*2);
    ctx.fill();

    // Visor / Eye (Multi-part sprite element 4)
    ctx.fillStyle = this.isDashing ? '#f14668' : '#a0efb8';
    ctx.beginPath();
    ctx.rect(-2, -this.r * 0.4, this.r * 0.8, this.r * 0.8);
    ctx.fill();

    // The Drill (Multi-part sprite element 5)
    // Rotate the drill visually if active
    let drillAngleOffset = 0;
    if (this.drillActive || this.isDashing) {
        drillAngleOffset = (Date.now() % 360) * Math.PI / 180;
    }

    ctx.translate(this.r * 0.8, 0);

    ctx.fillStyle = (this.drillActive || this.isDashing) ? '#f5ca53' : '#aaaaaa';

    // Drill base
    ctx.beginPath();
    ctx.moveTo(0, -this.r * 0.6);
    ctx.lineTo(this.r, 0);
    ctx.lineTo(0, this.r * 0.6);
    ctx.closePath();
    ctx.fill();

    // Spiral details (reactive)
    if (this.drillActive || this.isDashing) {
        ctx.strokeStyle = '#b89437';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        let phase = (Date.now() / 50) % (this.r);
        ctx.moveTo(phase, -(this.r * 0.6) * (1 - phase/this.r));
        ctx.lineTo(phase, (this.r * 0.6) * (1 - phase/this.r));
        ctx.stroke();
    }

    ctx.restore();
  }
}

class Engine {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.width = 600;
    this.height = 800;

    this.saveManager = new SaveManager();
    this.soundEngine = new SoundEngine();
    this.inputManager = new InputManager(this.canvas);

    this.state = 'TITLE'; // TITLE, PLAYING, GAME_OVER, PAUSED
    this.lastTime = 0;

    this.player = null;
    this.cameraY = 0;
    this.blocks = [];
    this.enemies = [];
    this.enemyProjectiles = [];
    this.particles = [];
    this.hazards = [];
    this.bosses = [];
    this.waveCounter = 0; // Interactive stage hazards
    if (typeof ParallaxBackground !== 'undefined') {
        this.background = new ParallaxBackground(this.width, this.height);
    }
    this.tether = []; // array of {x, y}
    this.tetherLength = 0;
    this.maxTetherLength = 100;
    this.score = 0;
    this.multiplier = 1;
    this.depth = 0;
    this.maxDepthReached = 0;
    this.shockwaveRadius = 0;
    this.shockwaveActive = false;

    // Progression & Wave Director
    this.pickups = [];
    if (typeof UpgradeManager !== 'undefined') {
      this.upgradeManager = new UpgradeManager(this);
    }
    if (typeof UIManager !== "undefined") {
      this.uiManager = new UIManager(this);
      this.uiManager.applyOptions();
    }
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.comboMaxTimer = 5;
    this.maxComboMultiplier = 5;

    this.handleResize();
    new ResizeObserver(() => this.handleResize()).observe(document.body);

    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') this.state = 'PAUSED';
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
    });

    window.addEventListener('keydown', (e) => {
      if (this.state === 'TITLE' && e.code === 'Space') this.startGame();
      else if (this.state === 'GAME_OVER' && e.code === 'Space') this.state = 'TITLE';
      else if (this.state === 'PAUSED' && e.code === 'Space') this.state = 'PLAYING';
      else if (this.state === 'PLAYING' && e.code === 'Escape') this.state = 'PAUSED';
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.soundEngine.init();
      this.soundEngine.resume();

      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);

      if (this.state === 'OPTIONS') {
        if (this.uiManager) this.uiManager.handleInput(x, y);
        return;
      }
      if (this.state === 'TITLE') {
        if (x > this.width/2 - 75 && x < this.width/2 + 75 && y > this.height/2 + 50 && y < this.height/2 + 90) {
          if (this.soundEngine) this.soundEngine.playUISelect();
          this.state = 'OPTIONS';
        } else {
          if (this.soundEngine) this.soundEngine.playUISelect();
          this.startGame();
        }
      }
      else if (this.state === 'GAME_OVER') {
        if (this.soundEngine) this.soundEngine.playUISelect();
        this.state = 'TITLE';
      }
      else if (this.state === 'PAUSED') {
        if (this.soundEngine) this.soundEngine.playUISelect();
        // check back to arcade
        if (x > this.width/2 - 100 && x < this.width/2 + 100 && y > this.height/2 + 50 && y < this.height/2 + 90) {
          window.location.href = '../../index.html';
        } else {
          this.state = 'PLAYING';
        }
      }
      else if (this.state === 'UPGRADE') {
        if (this.upgradeManager) {
          this.upgradeManager.handleInput(x, y);
        }
      }
    });

    requestAnimationFrame(t => this.loop(t));
  }

  handleResize() {
    const windowRatio = window.innerWidth / window.innerHeight;
    const gameRatio = this.width / this.height;
    if (windowRatio < gameRatio) {
      this.canvas.style.width = '100%';
      this.canvas.style.height = `${(window.innerWidth / gameRatio)}px`;
    } else {
      this.canvas.style.width = `${(window.innerHeight * gameRatio)}px`;
      this.canvas.style.height = '100%';
    }
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  generateRow(rowY) {
    const row = Math.floor(rowY / 40);
    // don't generate above starting area
    if (row < 5) return;

    // check if row already exists
    if (this.blocks.some(b => Math.abs(b.y - row * 40) < 5)) return;

    for (let col = 0; col < this.width / 40; col++) {
      const x = col * 40;
      const y = row * 40;

      // procedural generation
      const rand = Math.random();
      let type = 0; // dirt

      if (rand < 0.1 + (this.depth * 0.0001)) {
        type = 1; // rock
      } else if (rand > 0.9 - (this.depth * 0.00005)) {
        type = 2; // gem
      }

      // always leave a path at column 7
      if (col === 7 && type === 1) type = 0;

      this.blocks.push(new Block(x, y, type));
    }

    // spawn enemy occasionally (balanced pacing based on wave/depth)
    let enemySpawnChance = 0.02 + (this.waveCounter * 0.015) + (this.depth * 0.00001);
    // Cap spawn chance so it doesn't get utterly ridiculous
    enemySpawnChance = Math.min(enemySpawnChance, 0.15);
    if (Math.random() < enemySpawnChance) {
      const rand = Math.random();
      // Adjust enemy weights: harder enemies appear later
      let bruiserThreshold = 0.4 + Math.max(0, 0.2 - this.waveCounter * 0.05);
      if (rand < 0.2) this.enemies.push(new SwarmerEnemy(Math.random() * this.width, rowY));
      else if (rand < bruiserThreshold) this.enemies.push(new SniperEnemy(Math.random() * this.width, rowY));
      else if (rand < 0.4) this.enemies.push(new SniperEnemy(Math.random() * this.width, rowY));
      else if (rand < 0.6) this.enemies.push(new BruiserEnemy(Math.random() * this.width, rowY));
      else if (rand < 0.8) this.enemies.push(new SplitterEnemy(Math.random() * this.width, rowY));
      else this.enemies.push(new AreaDenialEnemy(Math.random() * this.width, rowY));
    }
    // spawn hazard occasionally
    if (typeof Hazard !== 'undefined' && Math.random() < 0.04 + (this.depth * 0.00001)) {
        let type = Math.random() < 0.5 ? 'geyser' : 'shifter';
        this.hazards.push(new Hazard(Math.random() * this.width, rowY, type));
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.player = new Player(this.width / 2, 100);
    this.cameraY = 0;
    this.blocks = [];
    this.enemies = [];
    this.enemyProjectiles = [];
    this.particles = [];
    this.hazards = [];
    this.bosses = [];
    this.waveCounter = 0;
    this.tether = [{x: this.player.x, y: this.player.y}];
    this.nextBossDepth = 500;
    this.tetherLength = 0;
    this.maxTetherLength = 10; // capacity starts low
    this.score = 0;
    this.multiplier = 1;
    this.depth = 0;
    this.maxDepthReached = 0;
    this.shockwaveActive = false;

    this.pickups = [];
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.vfx = new VFXManager();
    this.saveManager.data.totalGamesPlayed++;
    this.saveManager.save();

    // Generate initial blocks
    for (let r = 5; r < 25; r++) {
      this.generateRow(r * 40);
    }
  }

  spawnParticles(x, y, color, count) {
    if (this.vfx) {
      this.vfx.spawnExplosion(x, y, color, count);
    } else {
      for (let i=0; i<count; i++) {
        this.particles.push(new Particle(x, y, color));
      }
    }
  }

  update(dt) {
    if (this.uiManager) this.uiManager.update(dt);
    if (this.state !== 'PLAYING') return;

    // Update dynamic BGM state
    if (this.soundEngine) {
        const isBoss = this.bosses.length > 0;
        const isLowHp = this.player && this.player.hp <= 30;

        // Start BGM if not active
        if (!this.soundEngine.bgmActive) {
            this.soundEngine.startBGM();
        }

        // Update state
        if (this.soundEngine.isBoss !== isBoss || this.soundEngine.isLowHp !== isLowHp) {
            if (isBoss && !this.soundEngine.isBoss) {
               this.soundEngine.playBossSpawn(); // Play boss spawn SFX
            }
            this.soundEngine.updateState(isBoss, isLowHp);
        }
    }

    if (this.vfx) this.vfx.update(dt);
    if (this.vfx && this.vfx.hitStopTimer > 0) return; // Hitstop freeze frame

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = 1;
        this.comboTimer = 0;
      }
    }

    // --- Update Player ---
    const oldX = this.player.x;
    const oldY = this.player.y;
    this.player.update(dt, this.inputManager);

    // Tentative position
    let newX = this.player.x + this.player.vx * dt;
    let newY = this.player.y + this.player.vy * dt;

    // Bounds
    newX = Math.max(this.player.r, Math.min(this.width - this.player.r, newX));
    newY = Math.max(this.player.r, newY); // can't go above ceiling

    // --- Collision with Blocks ---
    let hitSolid = false;
    for (let i = this.blocks.length - 1; i >= 0; i--) {
      const b = this.blocks[i];
      if (!b.active) continue;

      // Simple AABB vs Circle
      const closestX = Math.max(b.x, Math.min(newX, b.x + b.w));
      const closestY = Math.max(b.y, Math.min(newY, b.y + b.h));
      const distX = newX - closestX;
      const distY = newY - closestY;
      const distanceSquared = (distX * distX) + (distY * distY);

      if (distanceSquared < (this.player.r * this.player.r)) {
        if (b.type === 1) { // Rock
          if (this.player.isDashing) {
            // Dash destroys rocks!
            b.active = false;
            this.soundEngine.playExplosion();
            this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#6a6b6d', 10);
          } else {
            hitSolid = true;
            // bounce
            this.player.vx = -this.player.vx * 0.5;
            this.player.vy = -this.player.vy * 0.5;
            this.player.applyRecoil(200, this.player.angle);
            break; // Stop checking
          }
        } else {
          // Drill dirt/gem
          b.active = false;
          if (b.type === 2) { // Gem
            this.soundEngine.playCoin();
            this.score += 10 * this.multiplier;
            this.maxTetherLength += 5; // Increase tail capacity
            this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#a0efb8', 10);
          } else {
            this.score += 1 * this.multiplier;
            this.spawnParticles(b.x + b.w/2, b.y + b.h/2, '#6b5858', 5);
          }
        }
      }
    }

    if (!hitSolid) {
      this.player.x = newX;
      this.player.y = newY;
    } else {
      // Revert to old position if hit solid
      // basic sliding
      this.player.x = oldX;
      this.player.y = oldY;
    }


    // --- Camera & Generation ---
    this.depth = Math.max(this.depth, this.player.y);
    const targetCameraY = this.player.y - this.height * 0.4;
    if (targetCameraY > this.cameraY) {
      this.cameraY += (targetCameraY - this.cameraY) * 5 * dt;
    }

    // --- Memory Leak Prevention / Garbage Collection ---
    const cleanupY = this.cameraY - 1000;
    this.blocks = this.blocks.filter(b => b.y > cleanupY);
    this.enemies = this.enemies.filter(e => e.y > cleanupY);
    this.hazards = this.hazards.filter(h => h.y > cleanupY);
    if (this.enemyProjectiles) {
        this.enemyProjectiles = this.enemyProjectiles.filter(p => p.y > cleanupY);
    }

    // Boss spawn logic
    if (this.depth > this.nextBossDepth) {
        this.nextBossDepth += 500;
        this.waveCounter++;
        const bossY = this.player.y + 400;
        let b;
        if (this.waveCounter % 2 === 1) {
            b = new TetherSeverBoss(this.width / 2, bossY);
        } else {
            b = new GroundPoundBoss(this.width / 2, bossY);
        }
        // Scale Boss HP based on wave
        let hpMultiplier = 1 + (this.waveCounter - 1) * 0.4;
        b.maxHp *= hpMultiplier;
        b.hp = b.maxHp;
        this.bosses.push(b);
    }


    // Generate new rows ahead
    if (this.cameraY + this.height + 200 > this.maxDepthReached) {
      for(let r = Math.floor(this.maxDepthReached/40); r < Math.floor((this.cameraY + this.height + 200)/40); r++) {
         this.generateRow(r * 40);
      }
      this.maxDepthReached = this.cameraY + this.height + 200;
    }

    // --- Update Tether ---
    const lastPoint = this.tether[0];
    const distToLast = Math.hypot(this.player.x - lastPoint.x, this.player.y - lastPoint.y);
    if (distToLast > 10) {
      this.tether.unshift({x: this.player.x, y: this.player.y});
      if (this.tether.length > this.maxTetherLength) {
        this.tether.pop();
      }
      if (this.tether.length % 5 === 0 && this.soundEngine && this.soundEngine.playTetherGrow) {
        this.soundEngine.playTetherGrow();
      }
    }
    this.tetherLength = this.tether.length;
    this.multiplier = 1 + Math.floor(this.tetherLength / 10);

    // --- Cash In / Shockwave ---
    if ((this.inputManager.actionJustPressed || this.inputManager.keys['Space']) && !this.shockwaveActive && this.tetherLength > 5) {
      this.soundEngine.playExplosion();
      this.soundEngine.playTetherPop();
      this.shockwaveActive = true;
      this.shockwaveRadius = 0;

      // Massive score payout
      const payout = this.tetherLength * this.multiplier * 50;
      this.score += payout;
      // Reset tether
      this.tether = [{x: this.player.x, y: this.player.y}];
      this.maxTetherLength = 10;

    }

    if (this.shockwaveActive) {
      this.shockwaveRadius += 800 * dt;
      if (this.shockwaveRadius > 400) {
        this.shockwaveActive = false;
      }

      // Kill enemies in radius
      this.enemies.forEach(e => {
        if (e.active) {
          const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
          if (dist < this.shockwaveRadius) {
            if (typeof e.takeDamage === 'function') {
                e.takeDamage(10, this);
            } else {
                e.active = false;
                this.spawnParticles(e.x, e.y, '#f14668', 15);
                this.score += 100 * this.multiplier;
            }
          }
        }
      });

      // Damage bosses
      this.bosses.forEach(b => {
        if (b.active) {
          const dist = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          if (dist < this.shockwaveRadius + b.r) {
            if (typeof b.takeDamage === 'function') {
                b.takeDamage(50, this);
            }
          }
        }
      });

    }

    // --- Update Enemies ---
    this.enemies.forEach(e => {
      if (!e.active) return;
      e.update(dt, this.player.x, this.player.y, this);

      // Collision with player
      const distToPlayer = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (distToPlayer < e.r + this.player.r) {
        if (this.player.isDashing) {
          // Dash damages enemies!
          if (typeof e.takeDamage === 'function') {
              e.takeDamage(10, this);
          } else {
              e.active = false;
              this.spawnParticles(e.x, e.y, '#f14668', 15);
              this.score += 20 * this.multiplier * this.comboMultiplier;
              this.comboTimer = this.comboMaxTimer;
              this.comboMultiplier = Math.min(this.maxComboMultiplier, this.comboMultiplier + 0.2);
              if (Math.random() < 0.2 && typeof Pickup !== 'undefined') {
                this.pickups.push(new Pickup(e.x, e.y));
              }
          }
          this.soundEngine.playHit();
        } else if (this.player.invulnTimer <= 0) {
          this.gameOver();
        }
      }

      // Collision with tether (severing)
      if (this.tether.length > 5 && !this.shockwaveActive) {
        // Simple check against points in tether (every 3rd point for efficiency)
        for (let i = 5; i < this.tether.length; i += 3) {
          const pt = this.tether[i];
          const distToPt = Math.hypot(e.x - pt.x, e.y - pt.y);
          if (distToPt < e.r + 5) {
            // Sever tether at this point
            this.soundEngine.playHit();
            this.tether = this.tether.slice(0, i);
            this.maxTetherLength = Math.max(10, i);
            this.spawnParticles(pt.x, pt.y, '#a0efb8', 20);
            // Enemy gets damaged
            if (typeof e.takeDamage === 'function') {
                e.takeDamage(10, this);
            } else {
                e.active = false;
            }
            break;
          }
        }
      }
    });

    // --- Update Pickups ---
    if (this.pickups) {
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        p.update(dt);
        if (!p.active) {
          this.pickups.splice(i, 1);
          continue;
        }
        let pr = this.player.r + (this.player.pickupRadius || 0);
        if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < p.r + pr) {
          if (p.type === 'heal') {
            this.player.hp = Math.min(this.player.maxHp || 100, (this.player.hp || 100) + 20);
          } else if (p.type === 'tether') {
            this.maxTetherLength += 5;
          } else if (p.type === 'score') {
            this.score += 50 * this.multiplier * this.comboMultiplier;
          }
          this.soundEngine.playTone(800, 'sine', 0.1);
          this.pickups.splice(i, 1);
        }
      }
    }

    // --- Update Particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) {
        this.particles.splice(i, 1);
      }
    }


    // --- Update Bosses ---
    for (let i = this.bosses.length - 1; i >= 0; i--) {
      const b = this.bosses[i];
      b.update(dt, this.player.x, this.player.y, this);
      if (!b.active) {
        this.bosses.splice(i, 1);
        this.score += 500 * this.multiplier * this.comboMultiplier;
        if (this.upgradeManager) {
          this.upgradeManager.generateDraft();
          this.state = 'UPGRADE';
        }
        continue;
      }

      // Collision with player
      if (b.state !== 'SPAWNING') {
          const distToPlayer = Math.hypot(b.x - this.player.x, b.y - this.player.y);
          if (distToPlayer < b.r + this.player.r) {
            if (this.player.isDashing) {
              b.takeDamage(10, this);
              this.soundEngine.playHit();
            } else if (this.player.invulnTimer <= 0) {
              this.gameOver();
            }
          }
      }
    }

    // --- Update Enemy Projectiles ---
    if (this.enemyProjectiles) {
        this.enemyProjectiles.forEach(p => {
            if (!p.active) return;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            if (p.y < this.cameraY - 50 || p.y > this.cameraY + this.height + 50 || p.x < -50 || p.x > this.width + 50) {
                p.active = false;
            }


            // Collision with player
            if (this.player && this.player.invulnTimer <= 0) {
                const distToPlayer = Math.hypot(p.x - this.player.x, p.y - this.player.y);
                if (distToPlayer < p.r + this.player.r) {
                    if (this.player.isDashing) {
                        p.active = false;
                    } else {
                        this.gameOver();
                    }
                }

                if (p.isSevering && this.tether.length > 5 && !this.shockwaveActive) {
                    for (let i = 5; i < this.tether.length; i += 3) {
                      const pt = this.tether[i];
                      const distToPt = Math.hypot(p.x - pt.x, p.y - pt.y);
                      if (distToPt < p.r + 5) {
                        this.soundEngine.playHit();
                        this.tether = this.tether.slice(0, i);
                        this.maxTetherLength = Math.max(10, i);
                        this.spawnParticles(pt.x, pt.y, '#a0efb8', 20);
                        p.active = false;
                        break;
                      }
                    }
                }
            }

        });
        this.enemyProjectiles = this.enemyProjectiles.filter(p => p.active);
    }

    // --- Update Hazards ---
    this.hazards.forEach(h => {
        if (!h.active) return;
        h.update(dt, this);
    });

    if (this.background) {
        this.background.update(dt, this.cameraY);
    }

    // --- Cleanup ---
    this.blocks = this.blocks.filter(b => b.active && b.y > this.cameraY - 200);
    this.enemies = this.enemies.filter(e => e.active && e.y > this.cameraY - 400 && e.y < this.cameraY + this.height + 400);
    this.hazards = this.hazards.filter(h => h.active && h.y > this.cameraY - 400 && h.y < this.cameraY + this.height + 400);

    this.inputManager.update();
  }

  gameOver() {
    this.state = 'GAME_OVER';
    if (this.soundEngine) {
        this.soundEngine.stopBGM();
        this.soundEngine.playHit();
    }
    if (this.score > this.saveManager.data.highScore) {
      this.saveManager.data.highScore = this.score;
      this.saveManager.save();
    }
  }

  draw() {
    this.ctx.fillStyle = '#0b0c10';
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (this.background && (this.state === 'PLAYING' || this.state === 'GAME_OVER' || this.state === 'PAUSED')) {
        this.background.draw(this.ctx, this.width, this.height);
    }

    if (this.state === 'TITLE') {
      this.ctx.fillStyle = '#a0efb8';
      this.ctx.font = '40px Courier New';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('CYBER DRILL SAMURAI', this.width/2, this.height/3);
      this.ctx.font = '20px Courier New';
      this.ctx.fillStyle = '#c5c6c7';
      this.ctx.fillText('Press SPACE or Tap to Start', this.width/2, this.height/2);
      this.ctx.fillStyle = '#3a9bdc';
      this.ctx.fillRect(this.width/2 - 75, this.height/2 + 50, 150, 40);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText('OPTIONS', this.width/2, this.height/2 + 75);
      if (this.uiManager) this.uiManager.drawMilestones(this.ctx, this.width/2, this.height/2 + 120);

      this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width/2, this.height/2 + 50);

      // Draw a fake back to arcade link for check_games
      this.ctx.fillStyle = '#3a9bdc';
      this.ctx.fillText('Back to Arcade', this.width/2, this.height - 50);

      return;
    }

    // --- Draw Game World ---
    if (this.background) {
        // Additional atmospheric mid-layer could go here
    }
    this.blocks.forEach(b => b.draw(this.ctx, this.cameraY));
    this.hazards.forEach(h => h.draw(this.ctx, this.cameraY));
    if (this.pickups) {
      this.pickups.forEach(p => p.draw(this.ctx, this.cameraY));
    }

    // Tether
    if (this.tether.length > 1) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.tether[0].x, this.tether[0].y - this.cameraY);
      for (let i = 1; i < this.tether.length; i++) {
        this.ctx.lineTo(this.tether[i].x, this.tether[i].y - this.cameraY);
      }
      this.ctx.strokeStyle = `rgba(160, 239, 184, ${0.5 + Math.min(0.5, this.multiplier*0.05)})`;
      this.ctx.lineWidth = 4 + Math.min(6, this.multiplier);
      this.ctx.stroke();

      // Tether joints
      this.ctx.fillStyle = '#fff';
      for (let i = 0; i < this.tether.length; i += 5) {
        this.ctx.beginPath();
        this.ctx.arc(this.tether[i].x, this.tether[i].y - this.cameraY, 3, 0, Math.PI*2);
        this.ctx.fill();
      }
    }

    // Shockwave
    if (this.shockwaveActive) {
      this.ctx.beginPath();
      this.ctx.arc(this.player.x, this.player.y - this.cameraY, this.shockwaveRadius, 0, Math.PI*2);
      this.ctx.strokeStyle = `rgba(160, 239, 184, ${1 - this.shockwaveRadius/400})`;
      this.ctx.lineWidth = 10;
      this.ctx.stroke();
    }


    this.particles.forEach(p => p.draw(this.ctx, this.cameraY));
    if (this.vfx) this.vfx.draw(this.ctx, this.cameraY);
    if (this.player) this.player.draw(this.ctx, this.cameraY);
    this.enemies.forEach(e => e.draw(this.ctx, this.cameraY));
    this.bosses.forEach(b => b.draw(this.ctx, this.cameraY));


    if (this.enemyProjectiles) {
        this.enemyProjectiles.forEach(p => {
            this.ctx.fillStyle = '#f14668';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y - this.cameraY, p.r, 0, Math.PI*2);
            this.ctx.fill();
        });
    }

    // --- HUD ---
    this.ctx.fillStyle = 'rgba(11, 12, 16, 0.7)';
    this.ctx.fillRect(0, 0, this.width, 40);

    this.ctx.fillStyle = '#a0efb8';
    this.ctx.font = '20px Courier New';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Score: ${this.score}`, 10, 25);

    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#f5ca53';
    this.ctx.fillText(`x${this.multiplier}`, this.width/2, 25);

    this.ctx.textAlign = 'right';
    this.ctx.fillStyle = '#3a9bdc';
    this.ctx.fillText(`Depth: ${Math.floor(this.depth/10)}m`, this.width - 10, 25);

    // Combo Bar
    if (this.comboMultiplier > 1) {
      this.ctx.textAlign = 'left';
      this.ctx.fillStyle = '#eebb00';
      this.ctx.fillText(`COMBO x${this.comboMultiplier.toFixed(1)}`, 10, 50);
      this.ctx.fillRect(10, 55, 100 * (this.comboTimer / this.comboMaxTimer), 4);
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(10, 55, 100, 4);
    }

    // Capacity Bar
    this.ctx.fillStyle = '#4a4b4d';
    this.ctx.fillRect(this.width/2 - 100, 30, 200, 5);
    this.ctx.fillStyle = '#a0efb8';
    this.ctx.fillRect(this.width/2 - 100, 30, 200 * (this.tetherLength / this.maxTetherLength), 5);

    // Dash Cooldown HUD Indicator
    this.ctx.fillStyle = '#4a4b4d';
    this.ctx.fillRect(this.width/2 - 50, 42, 100, 4);
    if (this.player && this.player.dashCooldown > 0) {
        this.ctx.fillStyle = '#f14668';
        this.ctx.fillRect(this.width/2 - 50, 42, 100 * (this.player.dashCooldown / 2.5), 4);
    } else {
        this.ctx.fillStyle = '#3a9bdc';
        this.ctx.fillRect(this.width/2 - 50, 42, 100, 4);
        this.ctx.font = '10px Courier New';
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('DASH READY', this.width/2, 54);
    }

    // Draw touch controls if active
    const touchMode = this.uiManager ? this.uiManager.options.touchMode : 'Auto';
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const showTouch = touchMode === 'Always' || (touchMode === 'Auto' && hasTouch);
    if (this.inputManager.joystick.active && showTouch) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      this.ctx.beginPath();
      this.ctx.arc(this.inputManager.joystick.startX, this.inputManager.joystick.startY, 50, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.beginPath();
      this.ctx.arc(this.inputManager.joystick.startX + this.inputManager.joystick.dx * 50, this.inputManager.joystick.startY + this.inputManager.joystick.dy * 50, 20, 0, Math.PI*2);
      this.ctx.fill();
    }

    if (this.state === 'GAME_OVER') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#f14668';
      this.ctx.font = '40px Courier New';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('GAME OVER', this.width/2, this.height/2);
      this.ctx.font = '20px Courier New';
      this.ctx.fillStyle = '#c5c6c7';
      this.ctx.fillText(`Final Score: ${this.score}`, this.width/2, this.height/2 + 40);
      this.ctx.fillText('Press SPACE or Tap to Restart', this.width/2, this.height/2 + 80);
      if (this.uiManager) this.uiManager.drawMilestones(this.ctx, this.width/2, this.height/2 + 120);
    } else if (this.state === 'UPGRADE') {
      if (this.upgradeManager) {
        this.upgradeManager.draw(this.ctx);
      }
    } else if (this.state === 'PAUSED') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#f5ca53';
      this.ctx.font = '40px Courier New';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('PAUSED', this.width/2, this.height/2);
      this.ctx.font = '20px Courier New';
      this.ctx.fillText('Press ESC or SPACE to Resume', this.width/2, this.height/2 + 40);

      this.ctx.fillStyle = '#3a9bdc';
      this.ctx.fillRect(this.width/2 - 100, this.height/2 + 50, 200, 40);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillText('Back to Arcade', this.width/2, this.height/2 + 75);
    }
    if (this.uiManager) {
      this.uiManager.draw(this.ctx);
      if (this.state === 'PLAYING') {
          this.uiManager.drawMasterpieceBorders(this.ctx);
      }
    }
  }

  loop(time) {
    requestAnimationFrame(t => this.loop(t));
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.update(dt);
    this.draw();
  }
}

window.onload = () => {
  window.engine = new Engine();
};
