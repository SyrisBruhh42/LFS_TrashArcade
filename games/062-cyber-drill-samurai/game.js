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
  }
  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3;
    }
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playTone(freq, type, duration, vol=1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  playShoot() { this.playTone(400, 'square', 0.1, 0.5); }
  playHit() { this.playTone(150, 'sawtooth', 0.2, 0.8); }
  playExplosion() { this.playTone(100, 'sawtooth', 0.4, 1.0); }
  playCoin() { this.playTone(800, 'sine', 0.1, 0.5); }
}

class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.pointer = { x: 0, y: 0, active: false, justPressed: false };
    this.actionPressed = false;
    this.actionJustPressed = false;
    this.joystick = { active: false, dx: 0, dy: 0, startX: 0, startY: 0, id: null };

    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.actionPressed = true;
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

      if (x > canvas.width / 2) {
        this.actionPressed = true;
        this.actionJustPressed = true;
      } else {
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
    });
  }
  update() {
    this.pointer.justPressed = false;
    this.actionJustPressed = false;
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

class Enemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.vx = (Math.random() - 0.5) * 50;
    this.vy = (Math.random() - 0.5) * 50;
    this.active = true;
  }
  update(dt, playerX, playerY) {
    // Float towards player slowly
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0 && dist < 400) {
      this.vx += (dx / dist) * 20 * dt;
      this.vy += (dy / dist) * 20 * dt;
    }

    // limit speed
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 60) {
      this.vx = (this.vx / speed) * 60;
      this.vy = (this.vy / speed) * 60;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx, cameraY) {
    if (!this.active) return;
    ctx.fillStyle = '#f14668';
    ctx.beginPath();
    ctx.arc(this.x, this.y - cameraY, this.r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
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
  }
  update(dt, input) {
    const mov = input.getMovement();
    this.vx = mov.dx * this.speed;
    this.vy = mov.dy * this.speed;

    if (mov.dx !== 0 || mov.dy !== 0) {
      this.angle = Math.atan2(mov.dy, mov.dx);
      this.drillActive = true;
    } else {
      this.drillActive = false;
    }
  }
  draw(ctx, cameraY) {
    ctx.save();
    ctx.translate(this.x, this.y - cameraY);
    ctx.rotate(this.angle);

    // Body
    ctx.fillStyle = '#3a9bdc';
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI*2);
    ctx.fill();

    // Drill
    ctx.fillStyle = this.drillActive ? '#f5ca53' : '#aaaaaa';
    ctx.beginPath();
    ctx.moveTo(this.r * 0.5, -this.r * 0.8);
    ctx.lineTo(this.r * 1.5, 0);
    ctx.lineTo(this.r * 0.5, this.r * 0.8);
    ctx.closePath();
    ctx.fill();

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
    this.particles = [];
    this.tether = []; // array of {x, y}
    this.tetherLength = 0;
    this.maxTetherLength = 100;
    this.score = 0;
    this.multiplier = 1;
    this.depth = 0;
    this.maxDepthReached = 0;
    this.shockwaveRadius = 0;
    this.shockwaveActive = false;

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

      if (this.state === 'TITLE') this.startGame();
      else if (this.state === 'GAME_OVER') this.state = 'TITLE';
      else if (this.state === 'PAUSED') {
        // check back to arcade
        if (x > this.width/2 - 100 && x < this.width/2 + 100 && y > this.height/2 + 50 && y < this.height/2 + 90) {
          window.location.href = '../../index.html';
        } else {
          this.state = 'PLAYING';
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

    // spawn enemy occasionally
    if (Math.random() < 0.05 + (this.depth * 0.00002)) {
      this.enemies.push(new Enemy(Math.random() * this.width, rowY));
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.player = new Player(this.width / 2, 100);
    this.cameraY = 0;
    this.blocks = [];
    this.enemies = [];
    this.particles = [];
    this.tether = [{x: this.player.x, y: this.player.y}];
    this.tetherLength = 0;
    this.maxTetherLength = 10; // capacity starts low
    this.score = 0;
    this.multiplier = 1;
    this.depth = 0;
    this.maxDepthReached = 0;
    this.shockwaveActive = false;
    this.saveManager.data.totalGamesPlayed++;
    this.saveManager.save();

    // Generate initial blocks
    for (let r = 5; r < 25; r++) {
      this.generateRow(r * 40);
    }
  }

  spawnParticles(x, y, color, count) {
    for (let i=0; i<count; i++) {
      this.particles.push(new Particle(x, y, color));
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING') return;

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
          hitSolid = true;
          // bounce
          this.player.vx = -this.player.vx * 0.5;
          this.player.vy = -this.player.vy * 0.5;
          break; // Stop checking
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
    }
    this.tetherLength = this.tether.length;
    this.multiplier = 1 + Math.floor(this.tetherLength / 10);

    // --- Cash In / Shockwave ---
    if ((this.inputManager.actionJustPressed || this.inputManager.keys['Space']) && !this.shockwaveActive && this.tetherLength > 5) {
      this.soundEngine.playExplosion();
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
            e.active = false;
            this.spawnParticles(e.x, e.y, '#f14668', 15);
            this.score += 100 * this.multiplier;
          }
        }
      });
    }

    // --- Update Enemies ---
    this.enemies.forEach(e => {
      if (!e.active) return;
      e.update(dt, this.player.x, this.player.y);

      // Collision with player
      const distToPlayer = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      if (distToPlayer < e.r + this.player.r) {
        this.gameOver();
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
            // Enemy dies too
            e.active = false;
            break;
          }
        }
      }
    });

    // --- Update Particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // --- Cleanup ---
    this.blocks = this.blocks.filter(b => b.active && b.y > this.cameraY - 200);
    this.enemies = this.enemies.filter(e => e.active && e.y > this.cameraY - 400 && e.y < this.cameraY + this.height + 400);

    this.inputManager.update();
  }

  gameOver() {
    this.state = 'GAME_OVER';
    this.soundEngine.playHit();
    if (this.score > this.saveManager.data.highScore) {
      this.saveManager.data.highScore = this.score;
      this.saveManager.save();
    }
  }

  draw() {
    this.ctx.fillStyle = '#0b0c10';
    this.ctx.fillRect(0, 0, this.width, this.height);

    if (this.state === 'TITLE') {
      this.ctx.fillStyle = '#a0efb8';
      this.ctx.font = '40px Courier New';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('CYBER DRILL SAMURAI', this.width/2, this.height/3);
      this.ctx.font = '20px Courier New';
      this.ctx.fillStyle = '#c5c6c7';
      this.ctx.fillText('Press SPACE or Tap to Start', this.width/2, this.height/2);

      this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width/2, this.height/2 + 50);

      // Draw a fake back to arcade link for check_games
      this.ctx.fillStyle = '#3a9bdc';
      this.ctx.fillText('Back to Arcade', this.width/2, this.height - 50);

      return;
    }

    // --- Draw Game World ---
    this.blocks.forEach(b => b.draw(this.ctx, this.cameraY));

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
    if (this.player) this.player.draw(this.ctx, this.cameraY);
    this.enemies.forEach(e => e.draw(this.ctx, this.cameraY));

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

    // Capacity Bar
    this.ctx.fillStyle = '#4a4b4d';
    this.ctx.fillRect(this.width/2 - 100, 30, 200, 5);
    this.ctx.fillStyle = '#a0efb8';
    this.ctx.fillRect(this.width/2 - 100, 30, 200 * (this.tetherLength / this.maxTetherLength), 5);

    // Draw touch controls if active
    if (this.inputManager.joystick.active) {
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
