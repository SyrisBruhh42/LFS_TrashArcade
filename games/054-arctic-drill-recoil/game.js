class SaveManager {
  constructor() {
    this.key = 'arcade_game_054_054-arctic-drill-recoil_v1';
    this.data = this.load();
  }

  load() {
    try {
      const data = localStorage.getItem(this.key);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('localStorage read failed', e);
    }
    return this.getDefaults();
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) {
      console.warn('localStorage write failed', e);
    }
  }

  getDefaults() {
    return {
      highScore: 0,
      bestWaveOrCombo: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        musicVolume: 0.5,
        sfxVolume: 0.5,
        screenShake: 1,
        particles: 1,
        touchControls: 'auto',
        leftHanded: false,
        highContrast: false
      }
    };
  }

  updateScore(score) {
    if (score > this.data.highScore) {
      this.data.highScore = score;
    }
    this.data.totalScoreAccumulated += score;
    this.data.totalGamesPlayed++;
    this.save();
  }
}

class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this.touches = [];

    // Virtual joystick state
    this.joystick = {
      active: false,
      originX: 0,
      originY: 0,
      x: 0,
      y: 0,
      dirX: 0,
      dirY: 0,
      touchId: null
    };

    // Action button state
    this.actionButton = {
      active: false,
      touchId: null
    };

    this.setupListeners();
  }

  setupListeners() {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.canvas.addEventListener('mousedown', (e) => this.handleMouse(e, true));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouse(e, false));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));

    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  handleMouse(e, isDown) {
    this.mouse.down = isDown;
    if (isDown && !this.actionButton.active) {
       this.actionButton.active = true;
    } else if (!isDown) {
       this.actionButton.active = false;
    }
    this.handleMouseMove(e);
  }

  handleMouseMove(e) {
    const pos = this.getPointerPos(e);
    this.mouse.x = pos.x;
    this.mouse.y = pos.y;
    // For mouse, we map aiming relative to center (can be overridden by game)
    if (this.mouse.down) {
       const dx = this.mouse.x - this.canvas.width/2;
       const dy = this.mouse.y - this.canvas.height/2;
       const mag = Math.sqrt(dx*dx + dy*dy) || 1;
       this.joystick.dirX = dx / mag;
       this.joystick.dirY = dy / mag;
       this.joystick.active = true;
    } else {
       this.joystick.active = false;
    }
  }

  handleTouchStart(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pos = this.getPointerPos(touch);

      // Simple split screen logic: left side move/aim, right side action
      if (pos.x < this.canvas.width / 2 && this.joystick.touchId === null) {
        this.joystick.active = true;
        this.joystick.touchId = touch.identifier;
        this.joystick.originX = pos.x;
        this.joystick.originY = pos.y;
        this.joystick.x = pos.x;
        this.joystick.y = pos.y;
        this.joystick.dirX = 0;
        this.joystick.dirY = 0;
      } else if (pos.x >= this.canvas.width / 2 && this.actionButton.touchId === null) {
        this.actionButton.active = true;
        this.actionButton.touchId = touch.identifier;
      }
    }
  }

  handleTouchMove(e) {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.joystick.touchId) {
        const pos = this.getPointerPos(touch);
        this.joystick.x = pos.x;
        this.joystick.y = pos.y;

        const dx = this.joystick.x - this.joystick.originX;
        const dy = this.joystick.y - this.joystick.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 5) {
          this.joystick.dirX = dx / dist;
          this.joystick.dirY = dy / dist;
        }
      }
    }
  }

  handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === this.joystick.touchId) {
        this.joystick.active = false;
        this.joystick.touchId = null;
        this.joystick.dirX = 0;
        this.joystick.dirY = 0;
      }
      if (touch.identifier === this.actionButton.touchId) {
        this.actionButton.active = false;
        this.actionButton.touchId = null;
      }
    }
  }

  isDown(code) {
    return this.keys.has(code);
  }

  getAimVector(centerX, centerY) {
    let dx = 0;
    let dy = 0;

    if (this.isDown('ArrowLeft') || this.isDown('KeyA')) dx -= 1;
    if (this.isDown('ArrowRight') || this.isDown('KeyD')) dx += 1;
    if (this.isDown('ArrowUp') || this.isDown('KeyW')) dy -= 1;
    if (this.isDown('ArrowDown') || this.isDown('KeyS')) dy += 1;

    let len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
       return { x: dx / len, y: dy / len, active: true };
    }

    if (this.joystick.active) {
       return { x: this.joystick.dirX, y: this.joystick.dirY, active: true };
    }

    // Mouse aim
    if (this.mouse.down || this.keys.size > 0) {
        dx = this.mouse.x - centerX;
        dy = this.mouse.y - centerY;
        len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) {
            return { x: dx / len, y: dy / len, active: true };
        }
    }

    return { x: 0, y: -1, active: false }; // Default up
  }

  isActionPressed() {
    return this.isDown('Space') || this.actionButton.active || this.mouse.down || this.joystick.active;
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
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.masterGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);

    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playDrill() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playHit() {
    if (!this.initialized) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }
}

class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

class Block {
  constructor(x, y, w, h, hp) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.hp = hp;
    this.maxHp = hp;
    this.color = '#7ab8d6';
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(this.x, this.y, this.w, this.h);
    // Draw crack based on hp
    if (this.hp < this.maxHp) {
      ctx.beginPath();
      ctx.moveTo(this.x + this.w/2, this.y);
      ctx.lineTo(this.x + this.w/4, this.y + this.h/2);
      ctx.lineTo(this.x + this.w/2, this.y + this.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
    }
  }
}

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.vx = (Math.random() - 0.5) * 100;
    this.vy = (Math.random() - 0.5) * 100;
    this.hp = 2;
  }
  update(dt, playerX, playerY) {
    // Move towards player slowly
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    this.vx += (dx / dist) * 50 * dt;
    this.vy += (dy / dist) * 50 * dt;

    // Friction
    this.vx *= 0.99;
    this.vy *= 0.99;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    ctx.fillStyle = '#e26b6b';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r/2, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = 12;
    this.aimDir = { x: 0, y: -1 };
    this.drilling = false;
    this.drillTimer = 0;
    this.drillCooldown = 0.1;
  }
  update(dt, input) {
    // Recoil-as-movement mechanic
    const aim = input.getAimVector(this.x, this.y);
    if (aim.active) {
       this.aimDir.x = aim.x;
       this.aimDir.y = aim.y;
    }

    this.drillTimer -= dt;
    this.drilling = false;

    if (input.isActionPressed() && this.drillTimer <= 0) {
      this.drilling = true;
      this.drillTimer = this.drillCooldown;
      // Add recoil velocity opposite to aim
      const recoilForce = 300;
      this.vx += -this.aimDir.x * recoilForce;
      this.vy += -this.aimDir.y * recoilForce;
    }

    // Apply friction and gravity
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.vy += 300 * dt; // gravity

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Bounds check
    if (this.x < this.r) { this.x = this.r; this.vx *= -0.5; }
    if (this.x > 800 - this.r) { this.x = 800 - this.r; this.vx *= -0.5; }
    if (this.y < this.r) { this.y = this.r; this.vy *= -0.5; }
    if (this.y > 600 - this.r) { this.y = 600 - this.r; this.vy *= -0.5; }
  }

  draw(ctx) {
    // Draw body
    ctx.fillStyle = '#d8b0e2';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Draw drill
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.aimDir.y, this.aimDir.x));

    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(this.r, -5);
    ctx.lineTo(this.r + 20, 0);
    ctx.lineTo(this.r, 5);
    ctx.fill();

    // Drill active visual
    if (this.drilling) {
       ctx.strokeStyle = '#fff';
       ctx.beginPath();
       ctx.moveTo(this.r + 20, 0);
       ctx.lineTo(this.r + 25 + Math.random()*10, (Math.random()-0.5)*10);
       ctx.stroke();
    }
    ctx.restore();
  }
}

class GameEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.saveManager = new SaveManager();
    this.input = new InputManager(canvas);
    this.sound = new SoundEngine();

    this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
    this.lastTime = 0;

    this.logicalWidth = 800;
    this.logicalHeight = 600;

    this.player = null;
    this.particles = [];
    this.blocks = [];
    this.enemies = [];
    this.score = 0;

    this.setupResizeObserver();

    // Auto-pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') {
        this.state = 'PAUSED';
      }
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
      }
    });
  }

  setupResizeObserver() {
    const ro = new ResizeObserver(entries => {
      for (let entry of entries) {
        const rect = entry.contentRect;
        // Keep aspect ratio
        const scale = Math.min(rect.width / this.logicalWidth, rect.height / this.logicalHeight);
        this.canvas.width = this.logicalWidth * scale;
        this.canvas.height = this.logicalHeight * scale;
        this.ctx.scale(scale, scale);
      }
    });
    ro.observe(this.canvas.parentElement);
  }
}

  // Adding methods to GameEngine
  GameEngine.prototype.start = function() {
    this.resetGame();
    requestAnimationFrame((ts) => this.loop(ts));
  };

  GameEngine.prototype.resetGame = function() {
    this.player = new Player(400, 300);
    this.particles = [];
    this.blocks = [];
    this.enemies = [];
    this.score = 0;
    this.generateBlocks();
  };

  GameEngine.prototype.generateBlocks = function() {
    // Generate some procedural blocks
    for(let i=0; i<20; i++) {
      this.blocks.push(new Block(
        Math.random() * 700 + 50,
        Math.random() * 500 + 50,
        40 + Math.random() * 40,
        40 + Math.random() * 40,
        3
      ));
    }
  };

  GameEngine.prototype.spawnEnemy = function() {
    if (Math.random() < 0.02) {
      this.enemies.push(new Enemy(
        Math.random() > 0.5 ? 0 : this.logicalWidth,
        Math.random() * this.logicalHeight
      ));
    }
  };

  GameEngine.prototype.spawnParticles = function(x, y, color, count) {
    for(let i=0; i<count; i++) {
      this.particles.push(new Particle(
        x, y,
        (Math.random()-0.5)*200, (Math.random()-0.5)*200,
        0.5 + Math.random()*0.5,
        color,
        2 + Math.random()*3
      ));
    }
  };

  GameEngine.prototype.checkCollisions = function() {
    // Drill vs Blocks/Enemies
    if (this.player.drilling) {
      const drillX = this.player.x + this.player.aimDir.x * (this.player.r + 20);
      const drillY = this.player.y + this.player.aimDir.y * (this.player.r + 20);

      // Blocks
      for (let i = this.blocks.length - 1; i >= 0; i--) {
        const b = this.blocks[i];
        if (drillX > b.x && drillX < b.x + b.w && drillY > b.y && drillY < b.y + b.h) {
          b.hp--;
          this.spawnParticles(drillX, drillY, '#fff', 5);
          if (b.hp <= 0) {
            this.blocks.splice(i, 1);
            this.score += 10;
            this.sound.playHit();
            this.spawnParticles(drillX, drillY, '#7ab8d6', 15);
          }
        }
      }

      // Enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        const dx = drillX - e.x;
        const dy = drillY - e.y;
        if (dx*dx + dy*dy < e.r*e.r) {
          e.hp--;
          this.spawnParticles(drillX, drillY, '#e26b6b', 5);
          // Knockback
          e.vx += this.player.aimDir.x * 200;
          e.vy += this.player.aimDir.y * 200;
          if (e.hp <= 0) {
            this.enemies.splice(i, 1);
            this.score += 50;
            this.sound.playHit();
            this.spawnParticles(e.x, e.y, '#e26b6b', 20);
          }
        }
      }
    }

    // Player vs Enemies (Damage)
    for (const e of this.enemies) {
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      if (dx*dx + dy*dy < (this.player.r + e.r) * (this.player.r + e.r)) {
        this.state = 'GAME_OVER';
        this.saveManager.updateScore(this.score);
        this.spawnParticles(this.player.x, this.player.y, '#d8b0e2', 30);
      }
    }
  };

  GameEngine.prototype.update = function(dt) {
    if (this.state !== 'PLAYING') {
      if (this.input.isActionPressed()) {
        this.sound.init();
        this.sound.resume();
        if (this.state === 'TITLE' || this.state === 'GAME_OVER') {
          this.resetGame();
          this.state = 'PLAYING';
        } else if (this.state === 'PAUSED') {
          this.state = 'PLAYING';
        }
        // Debounce
        this.input.actionButton.active = false;
        this.input.keys.delete('Space');
      }
      return;
    }

    if (this.input.isDown('Escape') || this.input.isDown('KeyP')) {
      this.state = 'PAUSED';
      this.input.keys.delete('Escape');
      this.input.keys.delete('KeyP');
      return;
    }

    this.player.update(dt, this.input);
    if (this.player.drilling) {
       this.sound.playDrill();
       // visual smoke
       this.spawnParticles(this.player.x - this.player.aimDir.x*10, this.player.y - this.player.aimDir.y*10, 'rgba(255,255,255,0.3)', 1);
    }

    this.spawnEnemy();

    for (const e of this.enemies) e.update(dt, this.player.x, this.player.y);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.checkCollisions();
  };

  GameEngine.prototype.draw = function() {
    // Clear
    this.ctx.fillStyle = '#0b1a2a'; // Deep arctic water
    this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

    // Draw blocks
    for (const b of this.blocks) b.draw(this.ctx);

    // Draw enemies
    for (const e of this.enemies) e.draw(this.ctx);

    // Draw player
    if (this.state !== 'GAME_OVER') {
      this.player.draw(this.ctx);
    }

    // Draw particles
    for (const p of this.particles) p.draw(this.ctx);

    // UI
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Score: ' + this.score, 10, 30);
    this.ctx.fillText('High: ' + this.saveManager.data.highScore, 10, 60);

    // Overlays
    if (this.state === 'TITLE') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      this.ctx.fillStyle = '#d8b0e2';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px monospace';
      this.ctx.fillText('ARCTIC DRILL RECOIL', this.logicalWidth/2, this.logicalHeight/2 - 40);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '20px monospace';
      this.ctx.fillText('Aim & Click/Space/Touch to Drill', this.logicalWidth/2, this.logicalHeight/2 + 10);
      this.ctx.fillText('Use Drill Recoil to Move!', this.logicalWidth/2, this.logicalHeight/2 + 40);
    } else if (this.state === 'PAUSED') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      this.ctx.fillStyle = '#fff';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px monospace';
      this.ctx.fillText('PAUSED', this.logicalWidth/2, this.logicalHeight/2);
    } else if (this.state === 'GAME_OVER') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
      this.ctx.fillStyle = '#e26b6b';
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px monospace';
      this.ctx.fillText('GAME OVER', this.logicalWidth/2, this.logicalHeight/2 - 20);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '20px monospace';
      this.ctx.fillText('Score: ' + this.score, this.logicalWidth/2, this.logicalHeight/2 + 20);
      this.ctx.fillText('Click/Space/Touch to Restart', this.logicalWidth/2, this.logicalHeight/2 + 50);
    }
  };

  GameEngine.prototype.loop = function(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame((ts) => this.loop(ts));
  };

// Init
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const engine = new GameEngine(canvas);
  engine.start();
});
