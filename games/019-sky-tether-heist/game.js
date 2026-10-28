// game.js
// Sky Tether Heist

// ==========================================
// CONSTANTS & CONFIG
// ==========================================
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const SAVE_KEY = 'arcade_game_019_019-sky-tether-heist_v1';

const COLORS = {
  bg: '#1a1c2c',
  player: '#57b9f2',
  tail: '#3b5dc9',
  loot: '#fef4c0',
  guard: '#d95763',
  vision: 'rgba(217, 87, 99, 0.2)',
  visionAlert: 'rgba(217, 87, 99, 0.6)',
  island: '#29366f',
  islandEdge: '#3b5dc9',
  extract: '#73eff7',
  text: '#f4f4f4'
};

// ==========================================
// SAVE MANAGER
// ==========================================
class SaveManager {
  constructor() {
    this.memory = {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        masterMute: false,
        sfxVol: 100,
        musicVol: 100,
        shake: 100,
        particles: 'high',
        palette: 'default',
        touch: 'auto' // auto, always, off
      }
    };
    this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.memory = { ...this.memory, ...parsed };
        // Ensure options exist if it's an old save
        if (!this.memory.options) this.memory.options = {};
      }
    } catch (e) {
      console.warn("SaveManager: Failed to load from localStorage. Using memory fallback.", e);
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.memory));
    } catch (e) {
      console.warn("SaveManager: Failed to save to localStorage.", e);
    }
  }

  exportData() {
    return btoa(JSON.stringify(this.memory));
  }

  importData(base64Str) {
    try {
      const parsed = JSON.parse(atob(base64Str));
      if (parsed && typeof parsed.highScore === 'number') {
        this.memory = { ...this.memory, ...parsed };
        this.save();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch(e) {}
    this.memory = {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: this.memory.options // keep options
    };
    this.save();
  }
}

// ==========================================
// SOUND ENGINE
// ==========================================
class SoundEngine {
  constructor(saveManager) {
    this.saveManager = saveManager;
    // We do not initialize AudioContext until first interaction
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    this.bgmOscs = [];
    this.isPlayingMusic = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.updateVolumes();
  }

  updateVolumes() {
    if (!this.ctx) return;
    const opts = this.saveManager.memory.options;

    if (opts.masterMute) {
      this.masterGain.gain.value = 0;
    } else {
      this.masterGain.gain.value = 1;
      this.sfxGain.gain.value = opts.sfxVol / 100;
      this.musicGain.gain.value = opts.musicVol / 100;
    }
  }

  playSFX(type) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.sfxGain);

    const now = this.ctx.currentTime;

    switch(type) {
      case 'pickup':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'extract':
        osc.type = 'square';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(330, now + 0.1);
        osc.frequency.setValueAtTime(440, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'alert':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.2);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'gameover':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.linearRampToValueAtTime(0, now + 1);
        osc.start(now);
        osc.stop(now + 1);
        break;
    }
  }
}

// ==========================================
// INPUT MANAGER
// ==========================================
class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = {};

    // Virtual joystick
    this.touchActive = false;
    this.joystickBase = { x: 0, y: 0 };
    this.joystickCurrent = { x: 0, y: 0 };
    this.joystickActive = false;
    this.actionPressed = false;
    this.actionJustPressed = false;

    // Scale tracking
    this.scaleX = 1;
    this.scaleY = 1;
    this.rect = { top: 0, left: 0 };

    this.bindEvents();
  }

  updateScale(rect, scaleX, scaleY) {
    this.rect = rect;
    this.scaleX = scaleX;
    this.scaleY = scaleY;
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Touch events for virtual controls (handled in DOM via pointerdown/touchstart on buttons)
    // Canvas pointerdown just for initial sound init
    this.canvas.addEventListener('pointerdown', () => {
      this.touchActive = true;
    });

    // Specific bindings for DOM virtual controls are set up in GameEngine
  }

  getMovementVector() {
    let dx = 0;
    let dy = 0;

    // Keyboard
    if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
    if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

    // Joystick override
    if (this.joystickActive) {
      dx = this.joystickCurrent.x;
      dy = this.joystickCurrent.y;
    }

    // Normalize
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
    }

    return { x: dx, y: dy };
  }

  isActionPressed() {
    return this.keys['Space'] || this.keys['Enter'] || this.actionPressed;
  }
}

// ==========================================
// ENTITIES
// ==========================================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 12;
    this.speed = 250;
    this.tail = []; // Array of {x, y}
    this.tailSpacing = 20;
    this.maxTailLength = 0;
  }

  update(dt, inputVec) {
    const prevX = this.x;
    const prevY = this.y;

    this.x += inputVec.x * this.speed * dt;
    this.y += inputVec.y * this.speed * dt;

    // Bounds check
    this.x = Math.max(this.radius, Math.min(LOGICAL_WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(LOGICAL_HEIGHT - this.radius, this.y));

    // Update tail positions (follow the leader)
    if (this.tail.length > 0 && (this.x !== prevX || this.y !== prevY)) {
      // Very simple follow logic: tail segment 0 moves towards player, segment 1 towards 0, etc.
      let targetX = this.x;
      let targetY = this.y;

      for (let i=0; i<this.tail.length; i++) {
        const segment = this.tail[i];
        const dx = targetX - segment.x;
        const dy = targetY - segment.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > this.tailSpacing) {
          const ratio = (dist - this.tailSpacing) / dist;
          segment.x += dx * ratio;
          segment.y += dy * ratio;
        }
        targetX = segment.x;
        targetY = segment.y;
      }
    }
  }

  addTail() {
    if (this.tail.length === 0) {
      this.tail.push({x: this.x, y: this.y});
    } else {
      const last = this.tail[this.tail.length - 1];
      this.tail.push({x: last.x, y: last.y});
    }
    this.maxTailLength = Math.max(this.maxTailLength, this.tail.length);
  }

  clearTail() {
    this.tail = [];
  }

  draw(ctx) {
    // Draw tail
    ctx.lineWidth = 4;
    ctx.strokeStyle = COLORS.tail;

    if (this.tail.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      for (let i=0; i<this.tail.length; i++) {
        ctx.lineTo(this.tail[i].x, this.tail[i].y);
      }
      ctx.stroke();

      // Draw nodes
      ctx.fillStyle = COLORS.loot;
      for (let i=0; i<this.tail.length; i++) {
        ctx.beginPath();
        ctx.arc(this.tail[i].x, this.tail[i].y, 6, 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Draw player body
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

class Guard {
  constructor(x, y, waypoints) {
    this.x = x;
    this.y = y;
    this.waypoints = waypoints;
    this.currentWaypoint = 0;
    this.speed = 100;
    this.radius = 15;

    this.angle = 0;
    this.visionRange = 250;
    this.visionFov = Math.PI / 2.5; // About 72 degrees

    this.alertLevel = 0; // 0 to 1
  }

  update(dt) {
    if (this.waypoints.length < 2) return;

    const target = this.waypoints[this.currentWaypoint];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 5) {
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    } else {
      const vx = (dx / dist) * this.speed;
      const vy = (dy / dist) * this.speed;
      this.x += vx * dt;
      this.y += vy * dt;

      // Interpolate angle for smooth turning
      const targetAngle = Math.atan2(dy, dx);
      // Shortest path angle diff
      let diff = targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI*2;
      while (diff > Math.PI) diff -= Math.PI*2;

      this.angle += diff * 5 * dt; // Turn speed
    }
  }

  checkVision(player) {
    let spotted = false;

    const pointsToCheck = [{x: player.x, y: player.y}, ...player.tail];

    for (let pt of pointsToCheck) {
      const dx = pt.x - this.x;
      const dy = pt.y - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < this.visionRange) {
        const ptAngle = Math.atan2(dy, dx);
        let diff = ptAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI*2;
        while (diff > Math.PI) diff -= Math.PI*2;

        if (Math.abs(diff) < this.visionFov / 2) {
          spotted = true;
          break;
        }
      }
    }

    if (spotted) {
      this.alertLevel = Math.min(1, this.alertLevel + 1.5 * 0.016); // Assuming 60fps dt ~0.016, takes ~0.66s to alert
    } else {
      this.alertLevel = Math.max(0, this.alertLevel - 0.5 * 0.016);
    }

    return this.alertLevel >= 1;
  }

  draw(ctx) {
    // Draw Vision Cone
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, this.visionRange, -this.visionFov/2, this.visionFov/2);
    ctx.lineTo(0, 0);

    if (this.alertLevel > 0) {
      // Interpolate color based on alert
      ctx.fillStyle = COLORS.visionAlert;
      ctx.globalAlpha = 0.2 + (this.alertLevel * 0.6);
    } else {
      ctx.fillStyle = COLORS.vision;
    }
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Draw Guard body
    ctx.fillStyle = COLORS.guard;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI*2);
    ctx.fill();

    // Eye/direction indicator
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.radius - 4, -4, 3, 0, Math.PI*2);
    ctx.arc(this.radius - 4, 4, 3, 0, Math.PI*2);
    ctx.fill();

    ctx.restore();

    // Alert meter above head
    if (this.alertLevel > 0 && this.alertLevel < 1) {
      ctx.fillStyle = 'black';
      ctx.fillRect(this.x - 15, this.y - 25, 30, 5);
      ctx.fillStyle = 'yellow';
      ctx.fillRect(this.x - 15, this.y - 25, 30 * this.alertLevel, 5);
    }
  }
}

class Loot {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 8;
    this.active = true;
    this.floatOffset = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.floatOffset += dt * 3;
  }

  draw(ctx) {
    if (!this.active) return;
    const drawY = this.y + Math.sin(this.floatOffset) * 4;

    ctx.fillStyle = COLORS.loot;
    ctx.shadowColor = COLORS.loot;
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(this.x, drawY - this.radius);
    ctx.lineTo(this.x + this.radius, drawY);
    ctx.lineTo(this.x, drawY + this.radius);
    ctx.lineTo(this.x - this.radius, drawY);
    ctx.fill();

    ctx.shadowBlur = 0;
  }
}

class ExtractionZone {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pulse = 0;
  }

  update(dt) {
    this.pulse += dt * 2;
  }

  draw(ctx) {
    ctx.strokeStyle = COLORS.extract;
    ctx.lineWidth = 4 + Math.sin(this.pulse) * 2;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(115, 239, 247, 0.1)';
    ctx.fillRect(this.x, this.y, this.width, this.height);

    ctx.fillStyle = COLORS.extract;
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXTRACT', this.x + this.width/2, this.y + this.height/2 + 6);
  }

  contains(x, y) {
    return x >= this.x && x <= this.x + this.width &&
           y >= this.y && y <= this.y + this.height;
  }
}

// ==========================================
// GAME ENGINE
// ==========================================
class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    this.canvas.width = LOGICAL_WIDTH;
    this.canvas.height = LOGICAL_HEIGHT;

    this.saveManager = new SaveManager();
    this.soundEngine = new SoundEngine(this.saveManager);
    this.inputManager = new InputManager(this.canvas);

    this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
    this.lastTime = 0;
    this.rafId = null;

    this.score = 0;
    this.tailLength = 0;
    this.maxTail = 0;

    this.particles = [];
    this.screenShakeTime = 0;
    this.screenShakeIntensity = 0;

    this.setupUI();
    this.setupResizeObserver();

    // First interaction init audio
    const initAudio = () => {
      this.soundEngine.init();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('keydown', initAudio);
    };
    window.addEventListener('pointerdown', initAudio);
    window.addEventListener('keydown', initAudio);

    // Visibility handling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.setState('PAUSED');
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.setState('PAUSED');
      }
    });
  }

  setupUI() {
    this.ui = {
      title: document.getElementById('screen-title'),
      hud: document.getElementById('hud'),
      pause: document.getElementById('screen-pause'),
      gameover: document.getElementById('screen-gameover'),
      options: document.getElementById('modal-options'),
      howto: document.getElementById('modal-howto'),
      vControls: document.getElementById('virtual-controls')
    };

    // Title
    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-howto-title').addEventListener('click', () => this.ui.howto.classList.remove('hidden'));
    document.getElementById('btn-options-title').addEventListener('click', () => this.openOptions());

    // HUD
    document.getElementById('btn-pause').addEventListener('click', () => this.setState('PAUSED'));

    // Pause
    document.getElementById('btn-resume').addEventListener('click', () => this.setState('PLAYING'));
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-options-pause').addEventListener('click', () => this.openOptions());
    document.getElementById('btn-howto-pause').addEventListener('click', () => this.ui.howto.classList.remove('hidden'));
    document.getElementById('btn-quit').addEventListener('click', () => this.setState('TITLE'));

    // Game Over
    document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());
    document.getElementById('btn-title').addEventListener('click', () => this.setState('TITLE'));

    // Modals
    document.getElementById('btn-close-howto').addEventListener('click', () => this.ui.howto.classList.add('hidden'));
    document.getElementById('btn-close-options').addEventListener('click', () => {
      this.ui.options.classList.add('hidden');
      this.applyOptions();
    });

    // Options mapping
    this.setupOptionsUI();

    // Virtual Controls setup
    this.setupVirtualControls();
  }

  setupVirtualControls() {
    const joyZone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    const actionBtn = document.getElementById('btn-action');

    let joyRect = null;
    let baseCenter = {x: 0, y: 0};
    const maxRadius = 40;

    const handleTouchStart = (e) => {
      e.preventDefault();
      this.inputManager.touchActive = true;
      joyRect = document.getElementById('joystick-base').getBoundingClientRect();
      baseCenter = { x: joyRect.left + joyRect.width/2, y: joyRect.top + joyRect.height/2 };
      this.inputManager.joystickActive = true;
      handleTouchMove(e);
    };

    const handleTouchMove = (e) => {
      if (!this.inputManager.joystickActive) return;
      e.preventDefault();
      // Use the touch that is in the left half of the screen
      let touch = Array.from(e.touches).find(t => t.clientX < window.innerWidth / 2);
      if (!touch) return;

      let dx = touch.clientX - baseCenter.x;
      let dy = touch.clientY - baseCenter.y;

      const dist = Math.sqrt(dx*dx + dy*dy);
      let nx = dx, ny = dy;
      if (dist > 0) {
        nx = dx / dist;
        ny = dy / dist;
      }

      let stickDist = Math.min(dist, maxRadius);
      stick.style.transform = `translate(calc(-50% + ${nx * stickDist}px), calc(-50% + ${ny * stickDist}px))`;

      this.inputManager.joystickCurrent = { x: nx, y: ny };
    };

    const handleTouchEnd = (e) => {
      e.preventDefault();
      let touch = Array.from(e.touches).find(t => t.clientX < window.innerWidth / 2);
      if (!touch) {
        this.inputManager.joystickActive = false;
        this.inputManager.joystickCurrent = { x: 0, y: 0 };
        stick.style.transform = `translate(-50%, -50%)`;
      }
    };

    joyZone.addEventListener('touchstart', handleTouchStart, {passive: false});
    joyZone.addEventListener('touchmove', handleTouchMove, {passive: false});
    joyZone.addEventListener('touchend', handleTouchEnd, {passive: false});
    joyZone.addEventListener('touchcancel', handleTouchEnd, {passive: false});

    // Also support pointerdown for mouse testing
    joyZone.addEventListener('pointerdown', handleTouchStart);
    document.addEventListener('pointermove', (e) => {
      if(this.inputManager.joystickActive && e.pointerType === 'mouse') {
        let dx = e.clientX - baseCenter.x;
        let dy = e.clientY - baseCenter.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        let nx = dx, ny = dy;
        if (dist > 0) { nx = dx / dist; ny = dy / dist; }
        let stickDist = Math.min(dist, maxRadius);
        stick.style.transform = `translate(calc(-50% + ${nx * stickDist}px), calc(-50% + ${ny * stickDist}px))`;
        this.inputManager.joystickCurrent = { x: nx, y: ny };
      }
    });
    document.addEventListener('pointerup', (e) => {
      if(e.pointerType === 'mouse') {
        this.inputManager.joystickActive = false;
        this.inputManager.joystickCurrent = { x: 0, y: 0 };
        stick.style.transform = `translate(-50%, -50%)`;
      }
    });

    const actionStart = (e) => { e.preventDefault(); this.inputManager.actionPressed = true; };
    const actionEnd = (e) => { e.preventDefault(); this.inputManager.actionPressed = false; };

    actionBtn.addEventListener('touchstart', actionStart, {passive: false});
    actionBtn.addEventListener('touchend', actionEnd, {passive: false});
    actionBtn.addEventListener('touchcancel', actionEnd, {passive: false});
    actionBtn.addEventListener('pointerdown', actionStart);
    actionBtn.addEventListener('pointerup', actionEnd);
  }

  setupOptionsUI() {
    const opts = this.saveManager.memory.options;
    const UI = {
      mute: document.getElementById('opt-master-mute'),
      sfx: document.getElementById('opt-sfx-vol'),
      sfxVal: document.getElementById('val-sfx-vol'),
      music: document.getElementById('opt-music-vol'),
      musicVal: document.getElementById('val-music-vol'),
      shake: document.getElementById('opt-shake'),
      particles: document.getElementById('opt-particles'),
      palette: document.getElementById('opt-palette'),
      touch: document.getElementById('opt-touch')
    };

    UI.mute.checked = opts.masterMute;
    UI.sfx.value = opts.sfxVol;
    UI.sfxVal.innerText = opts.sfxVol + '%';
    UI.music.value = opts.musicVol;
    UI.musicVal.innerText = opts.musicVol + '%';
    UI.shake.value = opts.shake;
    UI.particles.value = opts.particles;
    UI.palette.value = opts.palette;
    UI.touch.value = opts.touch;

    UI.sfx.addEventListener('input', (e) => UI.sfxVal.innerText = e.target.value + '%');
    UI.music.addEventListener('input', (e) => UI.musicVal.innerText = e.target.value + '%');

    // Save management buttons
    document.getElementById('btn-export-save').addEventListener('click', () => {
      const box = document.getElementById('save-data-box');
      box.value = this.saveManager.exportData();
      box.classList.remove('hidden');
      box.select();
      try { document.execCommand('copy'); } catch(e){}
    });

    document.getElementById('btn-import-save').addEventListener('click', () => {
      const str = prompt("Paste save data string:");
      if (str) {
        if (this.saveManager.importData(str)) {
          alert("Save imported successfully!");
          this.applyOptions(); // update UI based on new save
        } else {
          alert("Invalid save data.");
        }
      }
    });

    let resetClicks = 0;
    const resetBtn = document.getElementById('btn-reset-save');
    resetBtn.addEventListener('click', () => {
      resetClicks++;
      if (resetClicks === 1) {
        resetBtn.innerText = "Click again to confirm reset";
        resetBtn.style.backgroundColor = "var(--danger-color)";
        setTimeout(() => {
          resetClicks = 0;
          resetBtn.innerText = "Reset Save";
          resetBtn.style.backgroundColor = "";
        }, 3000);
      } else {
        this.saveManager.reset();
        alert("Save reset.");
        resetClicks = 0;
        resetBtn.innerText = "Reset Save";
        resetBtn.style.backgroundColor = "";
        this.setupOptionsUI(); // refresh
      }
    });
  }

  openOptions() {
    this.setupOptionsUI();
    this.ui.options.classList.remove('hidden');
  }

  applyOptions() {
    const UI = {
      mute: document.getElementById('opt-master-mute').checked,
      sfx: parseInt(document.getElementById('opt-sfx-vol').value),
      music: parseInt(document.getElementById('opt-music-vol').value),
      shake: parseInt(document.getElementById('opt-shake').value),
      particles: document.getElementById('opt-particles').value,
      palette: document.getElementById('opt-palette').value,
      touch: document.getElementById('opt-touch').value
    };

    this.saveManager.memory.options = {
      masterMute: UI.mute,
      sfxVol: UI.sfx,
      musicVol: UI.music,
      shake: UI.shake,
      particles: UI.particles,
      palette: UI.palette,
      touch: UI.touch
    };
    this.saveManager.save();

    this.soundEngine.updateVolumes();

    if (UI.palette === 'high-contrast') {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }

    this.updateVirtualControlsVisibility();
  }

  updateVirtualControlsVisibility() {
    const mode = this.saveManager.memory.options.touch;
    if (mode === 'always') {
      this.ui.vControls.classList.remove('hidden');
    } else if (mode === 'off') {
      this.ui.vControls.classList.add('hidden');
    } else {
      // auto
      if (this.inputManager.touchActive || window.innerWidth < 800) {
        this.ui.vControls.classList.remove('hidden');
      } else {
        this.ui.vControls.classList.add('hidden');
      }
    }
  }

  setupResizeObserver() {
    const container = document.getElementById('game-container');
    const ro = new ResizeObserver(entries => {
      for (let entry of entries) {
        const rect = entry.contentRect;
        // Calculate best fit scale
        const scaleX = rect.width / LOGICAL_WIDTH;
        const scaleY = rect.height / LOGICAL_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        const cssWidth = LOGICAL_WIDTH * scale;
        const cssHeight = LOGICAL_HEIGHT * scale;

        this.canvas.style.width = cssWidth + 'px';
        this.canvas.style.height = cssHeight + 'px';

        // Update input manager scale for mouse/touch coordinates relative to canvas
        const canvasRect = this.canvas.getBoundingClientRect();
        this.inputManager.updateScale(canvasRect, cssWidth / LOGICAL_WIDTH, cssHeight / LOGICAL_HEIGHT);

        this.updateVirtualControlsVisibility();
      }
    });
    ro.observe(container);
  }

  setState(newState) {
    this.state = newState;

    // Hide all UI
    Object.values(this.ui).forEach(el => {
      if (el && el.classList) el.classList.add('hidden');
    });

    switch(newState) {
      case 'TITLE':
        this.ui.title.classList.remove('hidden');
        document.getElementById('title-hs').innerText = this.saveManager.memory.highScore;
        this.updateVirtualControlsVisibility();
        break;
      case 'PLAYING':
        this.ui.hud.classList.remove('hidden');
        this.updateVirtualControlsVisibility();
        break;
      case 'PAUSED':
        this.ui.hud.classList.remove('hidden');
        this.ui.pause.classList.remove('hidden');
        break;
      case 'GAME_OVER':
        this.ui.gameover.classList.remove('hidden');
        document.getElementById('go-score').innerText = this.score;
        document.getElementById('go-tail').innerText = this.maxTail;

        // Handle High Score
        if (this.score > this.saveManager.memory.highScore) {
          this.saveManager.memory.highScore = this.score;
          document.getElementById('new-hs-banner').classList.remove('hidden');
        } else {
          document.getElementById('new-hs-banner').classList.add('hidden');
        }

        // Handle Stats
        this.saveManager.memory.totalGamesPlayed++;
        this.saveManager.memory.totalScoreAccumulated += this.score;
        if (this.maxTail > this.saveManager.memory.bestWaveOrCombo) {
          this.saveManager.memory.bestWaveOrCombo = this.maxTail;
        }

        this.saveManager.save();
        this.soundEngine.playSFX('gameover');
        break;
    }
  }

  startGame() {
    this.score = 0;
    this.tailLength = 0;
    this.maxTail = 0;
    this.particles = [];

    this.player = new Player(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT - 100);
    this.extractionZone = new ExtractionZone(LOGICAL_WIDTH / 2 - 50, LOGICAL_HEIGHT - 150, 100, 100);

    this.lootItems = [];
    this.guards = [];
    this.level = 1;
    this.spawnLootAndGuards();

    this.updateHUD();
    this.setState('PLAYING');
  }

  spawnLootAndGuards() {
    this.lootItems = [];
    this.guards = [];

    const numLoot = 3 + this.level;
    for (let i=0; i<numLoot; i++) {
      this.lootItems.push(new Loot(
        100 + Math.random() * (LOGICAL_WIDTH - 200),
        100 + Math.random() * (LOGICAL_HEIGHT - 300)
      ));
    }

    const numGuards = 1 + Math.floor(this.level / 2);
    for (let i=0; i<numGuards; i++) {
      const cx = 150 + Math.random() * (LOGICAL_WIDTH - 300);
      const cy = 100 + Math.random() * (LOGICAL_HEIGHT - 300);
      const w = 150;
      const h = 150;

      this.guards.push(new Guard(cx, cy, [
        {x: cx, y: cy},
        {x: cx + w, y: cy},
        {x: cx + w, y: cy + h},
        {x: cx, y: cy + h}
      ]));
    }
  }

  updateHUD() {
    document.getElementById('hud-score').innerText = this.score;
    document.getElementById('hud-tail').innerText = this.tailLength;
  }

  addShake(intensity) {
    const shakeMult = this.saveManager.memory.options.shake / 100;
    this.screenShakeIntensity = intensity * shakeMult;
    this.screenShakeTime = 0.2; // seconds
  }

  createParticles(x, y, color, count) {
    if (this.saveManager.memory.options.particles === 'low') count = Math.floor(count / 3);
    if (count <= 0) return;

    for (let i=0; i<count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 200,
        vy: (Math.random() - 0.5) * 200,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
        color: color,
        size: 2 + Math.random() * 4
      });
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

    const inputVec = this.inputManager.getMovementVector();
    this.player.update(dt, inputVec);
    this.extractionZone.update(dt);

    // Loot collection
    this.lootItems.forEach(loot => {
      if (loot.active) {
        loot.update(dt);
        const dx = loot.x - this.player.x;
        const dy = loot.y - this.player.y;
        if (Math.sqrt(dx*dx + dy*dy) < this.player.radius + loot.radius) {
          loot.active = false;
          this.player.addTail();
          this.tailLength = this.player.tail.length;
          this.maxTail = Math.max(this.maxTail, this.tailLength);
          this.soundEngine.playSFX('pickup');
          this.createParticles(loot.x, loot.y, COLORS.loot, 10);
          this.updateHUD();
        }
      }
    });

    // Check if level clear
    if (this.lootItems.every(l => !l.active)) {
      this.level++;
      this.spawnLootAndGuards();
    }

    // Extraction
    if (this.inputManager.isActionPressed() && this.extractionZone.contains(this.player.x, this.player.y)) {
      if (this.player.tail.length > 0) {
        const scoreGain = this.player.tail.length * 100 * this.player.tail.length; // Risk reward compounding
        this.score += scoreGain;
        this.player.clearTail();
        this.tailLength = 0;
        this.soundEngine.playSFX('extract');
        this.createParticles(this.player.x, this.player.y, COLORS.extract, 20);
        this.addShake(10);
        this.updateHUD();

        // Ensure action toggle state clears so it doesn't repeatedly trigger
        this.inputManager.actionPressed = false;
        this.inputManager.keys['Space'] = false;
      }
    }

    // Guards
    for (let guard of this.guards) {
      guard.update(dt);
      if (guard.checkVision(this.player)) {
        this.soundEngine.playSFX('alert');
        this.setState('GAME_OVER');
        return;
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Shake
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      if (this.screenShakeTime <= 0) {
        this.screenShakeIntensity = 0;
      }
    }
  }

  draw() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.save();

    // Apply Shake
    if (this.screenShakeTime > 0) {
      const dx = (Math.random() - 0.5) * this.screenShakeIntensity;
      const dy = (Math.random() - 0.5) * this.screenShakeIntensity;
      this.ctx.translate(dx, dy);
    }

    if (this.state === 'TITLE') {
      // Draw background pattern for title
      this.ctx.fillStyle = COLORS.island;
      for(let i=0; i<20; i++) {
        this.ctx.beginPath();
        this.ctx.arc(
          Math.random() * LOGICAL_WIDTH,
          Math.random() * LOGICAL_HEIGHT,
          20 + Math.random()*50,
          0, Math.PI*2
        );
        this.ctx.fill();
      }
    } else {
      // Draw islands
      this.ctx.fillStyle = COLORS.island;
      this.ctx.strokeStyle = COLORS.islandEdge;
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.roundRect(50, 50, LOGICAL_WIDTH - 100, LOGICAL_HEIGHT - 100, 30);
      this.ctx.fill();
      this.ctx.stroke();

      this.extractionZone.draw(this.ctx);
      this.lootItems.forEach(l => l.draw(this.ctx));
      this.guards.forEach(g => g.draw(this.ctx));
      this.player.draw(this.ctx);

      // Draw particles
      this.particles.forEach(p => {
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life / p.maxLife;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      });
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.restore();
  }

  loop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const rawDt = (timestamp - this.lastTime) / 1000;
    const dt = Math.min(rawDt, 0.1); // max 100ms dt to prevent spiral
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }

  start() {
    this.rafId = requestAnimationFrame((ts) => this.loop(ts));
  }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine();
  engine.start();
});
