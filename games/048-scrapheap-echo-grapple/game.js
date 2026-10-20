const SAVE_KEY = 'arcade_game_048_048-scrapheap-echo-grapple_v1';

class SaveManager {
  constructor() {
    this.data = {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: { mute: false, sfx: 100, music: 100, shake: 100, touch: 'auto' }
    };
    this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data = { ...this.data, ...parsed };
      }
    } catch (e) { console.warn("Save load failed", e); }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) { console.warn("Save failed", e); }
  }

  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    this.data = {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: { mute: false, sfx: 100, music: 100, shake: 100, touch: 'auto' }
    };
    this.save();
  }
}

class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, justDown: false };
    this.touchActive = false;
    this.canvas = canvas;

    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });

    canvas.addEventListener('mousedown', e => {
      this.updateMouse(e);
      this.mouse.down = true;
      this.mouse.justDown = true;
    });
    canvas.addEventListener('mousemove', e => this.updateMouse(e));
    window.addEventListener('mouseup', () => { this.mouse.down = false; });

    canvas.addEventListener('touchstart', e => {
      this.touchActive = true;
      this.updateTouch(e);
      this.mouse.down = true;
      this.mouse.justDown = true;
      e.preventDefault();
    }, {passive: false});
    canvas.addEventListener('touchmove', e => {
      this.updateTouch(e);
      e.preventDefault();
    }, {passive: false});
    window.addEventListener('touchend', () => { this.mouse.down = false; });
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
  }

  updateTouch(e) {
    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
      this.mouse.y = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
    }
  }

  isDown(code) { return !!this.keys[code]; }

  update() {
    this.mouse.justDown = false;
  }
}

const GRAVITY = 800;
const JUMP_FORCE = -400;
const MOVE_SPEED = 200;
const MAX_FALL_SPEED = 600;

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = 30;
    this.h = 30;
    this.onGround = false;
    this.grapple = null; // {x, y, length, angle, angularVelocity}
  }

  update(dt, input, level) {
    // Handle Grapple Input
    if (input.mouse.justDown) {
      let worldMouseX = input.mouse.x + window.engine.camera.x;
      let worldMouseY = input.mouse.y + window.engine.camera.y;

      // Find nearest hook
      let bestHook = null;
      let bestDist = 400; // max reach
      for (let h of level.hooks) {
        let d = Math.hypot(h.x - (this.x + this.w/2), h.y - (this.y + this.h/2));
        let mouseDist = Math.hypot(h.x - worldMouseX, h.y - worldMouseY);
        // Prioritize clicking near the hook, but also within range
        if (d < bestDist && mouseDist < 100) {
          bestDist = d;
          bestHook = h;
        }
      }

      if (bestHook) {
        let dx = (this.x + this.w/2) - bestHook.x;
        let dy = (this.y + this.h/2) - bestHook.y;
        let length = Math.hypot(dx, dy);
        let angle = Math.atan2(dx, dy); // Pendulum angle from vertical down

        // Initial angular velocity based on linear velocity
        let v_perp = this.vx * Math.cos(angle) - this.vy * Math.sin(angle);
        let angularVelocity = v_perp / length;

        this.grapple = { x: bestHook.x, y: bestHook.y, length: length, angle: angle, angularVelocity: angularVelocity };
        if(window.engine) window.engine.audio.sfxGrappleShoot();
      }
    }
    if (!input.mouse.down && this.grapple) {
      this.grapple = null; // release
    }

    if (!this.grapple) {
      // Normal Movement
      if (input.isDown('ArrowLeft') || input.isDown('KeyA')) this.vx = -MOVE_SPEED;
      else if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.vx = MOVE_SPEED;
      else this.vx = 0;

      this.vy += GRAVITY * dt;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

      if ((input.isDown('ArrowUp') || input.isDown('KeyW')) && this.onGround) {
        this.vy = JUMP_FORCE;
        this.onGround = false;
        if(window.engine) window.engine.audio.sfxJump();
      }
    } else {
      // Pendulum Physics
      const pendulumGravity = GRAVITY * 1.5;
      const angularAcceleration = -(pendulumGravity / this.grapple.length) * Math.sin(this.grapple.angle);

      this.grapple.angularVelocity += angularAcceleration * dt;
      this.grapple.angularVelocity *= 0.99; // Damping

      // Swing input
      if (input.isDown('ArrowLeft') || input.isDown('KeyA')) this.grapple.angularVelocity -= 2 * dt;
      if (input.isDown('ArrowRight') || input.isDown('KeyD')) this.grapple.angularVelocity += 2 * dt;

      this.grapple.angle += this.grapple.angularVelocity * dt;

      this.x = this.grapple.x + this.grapple.length * Math.sin(this.grapple.angle) - this.w/2;
      this.y = this.grapple.y + this.grapple.length * Math.cos(this.grapple.angle) - this.h/2;

      this.vx = this.grapple.length * this.grapple.angularVelocity * Math.cos(this.grapple.angle);
      this.vy = -this.grapple.length * this.grapple.angularVelocity * Math.sin(this.grapple.angle);
    }

    // Collision
    this.x += this.vx * dt;
    this.handleCollision(level, true);

    this.y += this.vy * dt;
    this.onGround = false;
    this.handleCollision(level, false);

    // Bounds
    if (this.x < 0) this.x = 0;
    if (this.y > 2000) this.y = 2000; // Death pit handling later
  }

  handleCollision(level, isHorizontal) {
    for (let rect of level.platforms) {
      if (this.x < rect.x + rect.w && this.x + this.w > rect.x &&
          this.y < rect.y + rect.h && this.y + this.h > rect.y) {
        if (isHorizontal) {
          if (this.vx > 0) this.x = rect.x - this.w;
          else if (this.vx < 0) this.x = rect.x + rect.w;
          this.vx = 0;
        } else {
          if (this.vy > 0) {
            this.y = rect.y - this.h;
            this.onGround = true;
          } else if (this.vy < 0) {
            this.y = rect.y + rect.h;
          }
          this.vy = 0;
        }
      }
    }
  }

  draw(ctx) {
    if (this.grapple) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x + this.w/2, this.y + this.h/2);
      ctx.lineTo(this.grapple.x, this.grapple.y);
      ctx.stroke();

      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(this.grapple.x, this.grapple.y, 4, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.fillStyle = '#0ff';
    ctx.fillRect(this.x, this.y, this.w, this.h);
  }
}


class Ghost {
  constructor(frames) {
    this.frames = frames;
    this.frameIdx = 0;
    this.x = frames[0].x;
    this.y = frames[0].y;
    this.w = 30;
    this.h = 30;
    this.grapple = null;
    this.active = true;
  }
  update(dt) {
    if (!this.active) return;
    this.frameIdx++;
    if (this.frameIdx >= this.frames.length) {
      this.active = false;
      return;
    }
    let f = this.frames[this.frameIdx];
    this.x = f.x;
    this.y = f.y;
    this.grapple = f.grapple;
  }
  draw(ctx) {
    if (!this.active) return;
    ctx.globalAlpha = 0.5;
    if (this.grapple) {
      ctx.strokeStyle = '#78c94d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x + this.w/2, this.y + this.h/2);
      ctx.lineTo(this.grapple.x, this.grapple.y);
      ctx.stroke();
    }
    ctx.fillStyle = '#78c94d';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.globalAlpha = 1.0;
  }
}
class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.saveManager = new SaveManager();
    this.input = new InputManager(this.canvas);
    this.audio = new SoundEngine();

    this.state = 'TITLE';
    this.lastTime = performance.now();

    this.logicalWidth = 1280;
    this.logicalHeight = 720;

    this.player = null;
    this.level = { platforms: [], hooks: [] };

    this.score = 0;
    this.wave = 1;
    this.particles = [];
    this.camera = { x: 0, y: 0 };

    this.ghostState = 'IDLE'; // IDLE, RECORDING, PLAYING
    this.ghostFrames = [];
    this.ghost = null;
    this.ghostCooldown = 0;

    this.setupResizeObserver();
    this.setupUI();
    this.applyOptions();

    requestAnimationFrame((t) => this.loop(t));
  }

  setupResizeObserver() {
    const ro = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        this.canvas.width = this.logicalWidth;
        this.canvas.height = this.logicalHeight;

        const scale = Math.min(width / this.logicalWidth, height / this.logicalHeight);
        this.canvas.style.width = `${this.logicalWidth * scale}px`;
        this.canvas.style.height = `${this.logicalHeight * scale}px`;
      }
    });
    ro.observe(document.getElementById('game-container'));
  }

  setupUI() {
    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-howto').addEventListener('click', () => {
      document.getElementById('screen-title').classList.add('hidden');
      document.getElementById('screen-howto').classList.remove('hidden');
    });
    document.getElementById('btn-howto-back').addEventListener('click', () => {
      document.getElementById('screen-howto').classList.add('hidden');
      document.getElementById('screen-title').classList.remove('hidden');
    });

    document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
    document.getElementById('btn-restart').addEventListener('click', () => this.startGame());
    document.getElementById('btn-quit').addEventListener('click', () => this.changeState('TITLE'));
    document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());
    document.getElementById('btn-title-return').addEventListener('click', () => this.changeState('TITLE'));

    const optIds = ['btn-options-title', 'btn-options-pause'];
    optIds.forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        document.getElementById('modal-options').classList.remove('hidden');
      });
    });
    document.getElementById('btn-close-options').addEventListener('click', () => {
      document.getElementById('modal-options').classList.add('hidden');
      this.saveManager.save();
    });

    // Options binding
    document.getElementById('opt-mute').addEventListener('change', e => { this.saveManager.data.options.mute = e.target.checked; this.applyOptions(); });
    document.getElementById('opt-sfx').addEventListener('input', e => { this.saveManager.data.options.sfx = parseInt(e.target.value)/100; this.applyOptions(); });
    document.getElementById('opt-music').addEventListener('input', e => { this.saveManager.data.options.music = parseInt(e.target.value)/100; this.applyOptions(); });
    document.getElementById('opt-shake').addEventListener('change', e => { this.saveManager.data.options.shake = parseInt(e.target.value); });
    document.getElementById('opt-touch').addEventListener('change', e => { this.saveManager.data.options.touch = e.target.value; this.applyOptions(); });

    document.getElementById('high-score').innerText = this.saveManager.data.highScore;

    // Resume audio context
    window.addEventListener('pointerdown', () => this.audio.resume(), {once: true});
    window.addEventListener('keydown', () => this.audio.resume(), {once: true});
  }

  applyOptions() {
    const opt = this.saveManager.data.options;
    document.getElementById('opt-mute').checked = opt.mute;
    document.getElementById('opt-sfx').value = opt.sfx * 100;
    document.getElementById('opt-music').value = opt.music * 100;
    document.getElementById('opt-shake').value = opt.shake;
    document.getElementById('opt-touch').value = opt.touch;
    this.audio.updateOptions(opt);
  }

  changeState(newState) {
    this.state = newState;
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.add('hidden');

    if (newState === 'TITLE') {
      document.getElementById('screen-title').classList.remove('hidden');
      document.getElementById('high-score').innerText = this.saveManager.data.highScore;
      this.audio.stopMusic();
    } else if (newState === 'PLAYING') {
      document.getElementById('hud').classList.remove('hidden');
      this.audio.startMusic();
    } else if (newState === 'PAUSED') {
      document.getElementById('screen-pause').classList.remove('hidden');
    } else if (newState === 'GAME_OVER') {
      document.getElementById('screen-gameover').classList.remove('hidden');
      document.getElementById('final-score').innerText = this.score;
      if (this.score > this.saveManager.data.highScore) {
        this.saveManager.data.highScore = this.score;
        this.saveManager.save();
        document.getElementById('new-high-score-msg').classList.remove('hidden');
      } else {
        document.getElementById('new-high-score-msg').classList.add('hidden');
      }
      this.audio.stopMusic();
      this.audio.sfxGameOver();
    }
  }

  togglePause() {
    if (this.state === 'PLAYING') this.changeState('PAUSED');
    else if (this.state === 'PAUSED') this.changeState('PLAYING');
  }

  generateLevel() {
    this.level = { platforms: [], hooks: [], switches: [], exit: null };
    // Basic floor
    this.level.platforms.push({x: 0, y: 600, w: 2000, h: 50});
    // Pits and platforms
    this.level.platforms.push({x: 400, y: 400, w: 200, h: 20});
    this.level.platforms.push({x: 800, y: 300, w: 200, h: 20});

    // Hooks
    this.level.hooks.push({x: 500, y: 150});
    this.level.hooks.push({x: 900, y: 50});

    this.level.exit = {x: 1800, y: 500, w: 60, h: 100};
    this.level.switches = [];
    this.level.barriers = [];

    if (this.wave > 1) {
       let b = {x: 1400, y: 300, w: 20, h: 300, open: false};
       this.level.barriers.push(b);
       this.level.switches.push({x: 500, y: 550, w: 40, h: 40, active: false, targetBarrier: b});
    }
  }

  startGame() {
    this.player = new Player(100, 500);
    this.score = 0;
    this.wave = 1;
    this.particles = [];
    this.camera = { x: 0, y: 0 };

    this.ghostState = 'IDLE'; // IDLE, RECORDING, PLAYING
    this.ghostFrames = [];
    this.ghost = null;
    this.ghostCooldown = 0;
    this.generateLevel();
    this.changeState('PLAYING');
  }

  loop(now) {
    let dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }
    this.draw();

    this.input.update(); // clear justDowns
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt) {
    this.player.update(dt, this.input, this.level);

    // Camera follow
    this.camera.x += ((this.player.x - this.logicalWidth/2) - this.camera.x) * 5 * dt;
    this.camera.x = Math.max(0, this.camera.x); // dont go past left edge

    // Ghost Logic
    if (this.ghostCooldown > 0) this.ghostCooldown -= dt;

    let echoPressed = this.input.isDown('Space') || this.input.isDown('Enter'); // Simplified trigger
    if (echoPressed && this.ghostCooldown <= 0) {
      if (this.ghostState === 'IDLE') {
        this.ghostState = 'RECORDING';
        this.ghostFrames = [];
        this.audio.sfxGhostRecord();
      } else if (this.ghostState === 'RECORDING') {
        this.ghostState = 'PLAYING';
        if (this.ghostFrames.length > 0) {
          this.ghost = new Ghost(this.ghostFrames);
          this.audio.sfxGhostPlay();
        } else {
          this.ghostState = 'IDLE';
        }
      } else if (this.ghostState === 'PLAYING') {
        this.ghostState = 'IDLE';
        this.ghost = null;
        this.audio.sfxHit(); // cancel sound
      }
      this.ghostCooldown = 0.5; // Prevent rapid toggling

      document.getElementById('ghost-state').innerText = this.ghostState;
    }

    if (this.ghostState === 'RECORDING') {
      this.ghostFrames.push({
        x: this.player.x,
        y: this.player.y,
        grapple: this.player.grapple ? { x: this.player.grapple.x, y: this.player.grapple.y } : null
      });
      if (this.ghostFrames.length > 600) { // 10 seconds at 60fps
         this.ghostState = 'PLAYING';
         this.ghost = new Ghost(this.ghostFrames);
         this.audio.sfxGhostPlay();
         document.getElementById('ghost-state').innerText = this.ghostState;
      }
    } else if (this.ghostState === 'PLAYING' && this.ghost) {
      this.ghost.update(dt);
      if (!this.ghost.active) {
         this.ghostState = 'IDLE';
         this.ghost = null;
         document.getElementById('ghost-state').innerText = this.ghostState;
      }

      // Check ghost collisions with switches
      for (let s of this.level.switches) {
        if (!s.active && this.ghost && this.ghost.active &&
            this.ghost.x < s.x + s.w && this.ghost.x + this.ghost.w > s.x &&
            this.ghost.y < s.y + s.h && this.ghost.y + this.ghost.h > s.y) {
           s.active = true;
           this.audio.sfxSwitch();
           // Open barrier
           if (s.targetBarrier) s.targetBarrier.open = true;
        }
      }
    }

    // Check player collision with barriers
    for (let b of this.level.barriers) {
      if (!b.open) {
        // Simple AABB against player (push back)
        if (this.player.x < b.x + b.w && this.player.x + this.player.w > b.x &&
            this.player.y < b.y + b.h && this.player.y + this.player.h > b.y) {

            // Basic push out (assume barriers are thin vertical walls for now)
            if (this.player.vx > 0) this.player.x = b.x - this.player.w;
            else if (this.player.vx < 0) this.player.x = b.x + b.w;
            this.player.vx = 0;
        }
      }
    }

    // Exit check
    if (this.player.x > this.level.exit.x && this.player.x < this.level.exit.x + this.level.exit.w &&
        this.player.y > this.level.exit.y && this.player.y < this.level.exit.y + this.level.exit.h) {
      this.wave++;
      this.score += 1000;
      this.generateLevel();
      this.player.x = 100;
      this.player.y = 500;
      this.player.vx = 0;
      this.player.vy = 0;
      this.audio.sfxCoin();
    }

    if (this.player.y > 1000) {
      this.changeState('GAME_OVER');
    }

    document.getElementById('score-val').innerText = this.score;
    document.getElementById('wave-val').innerText = this.wave;
  }

  draw() {
    this.ctx.fillStyle = '#1a1c23';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state !== 'PLAYING' && this.state !== 'PAUSED' && this.state !== 'GAME_OVER') return;

    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Draw level
    this.ctx.fillStyle = '#555';
    for (let p of this.level.platforms) {
      this.ctx.fillRect(p.x, p.y, p.w, p.h);
      // Top edge highlight
      this.ctx.fillStyle = '#777';
      this.ctx.fillRect(p.x, p.y, p.w, 4);
      this.ctx.fillStyle = '#555';
    }

    this.ctx.fillStyle = '#aaa';
    for (let h of this.level.hooks) {
      this.ctx.beginPath();
      this.ctx.arc(h.x, h.y, 8, 0, Math.PI*2);
      this.ctx.fill();
    }

    if (this.level.exit) {
      this.ctx.fillStyle = '#78c94d';
      this.ctx.fillRect(this.level.exit.x, this.level.exit.y, this.level.exit.w, this.level.exit.h);
    }

    if (this.ghost) this.ghost.draw(this.ctx);

    for (let s of this.level.switches) {
      this.ctx.fillStyle = s.active ? '#78c94d' : '#e74c3c';
      this.ctx.fillRect(s.x, s.y, s.w, s.h);
    }
    for (let b of this.level.barriers) {
      if (!b.open) {
        this.ctx.fillStyle = '#f39c12';
        this.ctx.fillRect(b.x, b.y, b.w, b.h);
      }
    }

    this.player.draw(this.ctx);

    this.ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.engine = new GameEngine();
});
