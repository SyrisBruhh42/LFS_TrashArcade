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
    this.mouseSecondaryDown = false;
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

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
    if (e && e.button === 2) {
      this.mouseSecondaryDown = isDown;
    } else {
      this.mouse.down = isDown;
      if (isDown && !this.actionButton.active) {
         this.actionButton.active = true;
      } else if (!isDown) {
         this.actionButton.active = false;
      }
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

  isSecondaryPressed() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.mouseSecondaryDown;
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

class IceCrystal {
  constructor(logicalWidth, logicalHeight) {
    this.x = Math.random() * logicalWidth;
    this.y = Math.random() * logicalHeight;
    this.size = 2 + Math.random() * 4;
    this.alpha = 0.1 + Math.random() * 0.3;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = 0.5 + Math.random() * 1.5;
  }
  update(dt) {
    this.phase += this.speed * dt;
  }
  draw(ctx) {
    const blink = this.alpha + Math.sin(this.phase) * 0.1;
    ctx.fillStyle = `rgba(216, 176, 226, ${blink})`;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.size);
    ctx.lineTo(this.x + this.size/2, this.y);
    ctx.lineTo(this.x, this.y + this.size);
    ctx.lineTo(this.x - this.size/2, this.y);
    ctx.fill();
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

class BasicEnemy {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 15;
    this.vx = (Math.random() - 0.5) * 100;
    this.vy = (Math.random() - 0.5) * 100;
    this.hp = 2;
  }
  update(dt, playerX, playerY, engine) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    this.vx += (dx / dist) * 50 * dt;
    this.vy += (dy / dist) * 50 * dt;
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
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r/2, 0, Math.PI * 2);
    ctx.fill();
  }
}

class DasherEnemy extends BasicEnemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 4;
    this.r = 18;
    this.dashTimer = 2;
    this.dashCooldown = 3;
    this.isDashing = false;
    this.telegraphTimer = 0;
  }
  update(dt, playerX, playerY, engine) {
    this.dashTimer -= dt;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    if (this.dashTimer > 0 && this.dashTimer < 0.5) {
      this.telegraphTimer += dt;
      this.vx *= 0.90;
      this.vy *= 0.90;
    } else if (this.dashTimer <= 0) {
      this.dashTimer = this.dashCooldown;
      this.isDashing = true;
      this.telegraphTimer = 0;
      this.vx = (dx / dist) * 400;
      this.vy = (dy / dist) * 400;
    } else if (this.dashTimer > 2.5) {
       this.vx *= 0.95;
       this.vy *= 0.95;
       if (Math.random() < 0.2 && engine) {
         engine.spawnParticles(this.x, this.y, '#f2a65a', 1);
       }
    } else {
       this.isDashing = false;
       this.telegraphTimer = 0;
       this.vx += (dx / dist) * 20 * dt;
       this.vy += (dy / dist) * 20 * dt;
    }
    this.vx *= 0.99;
    this.vy *= 0.99;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    if (this.telegraphTimer > 0) {
      ctx.fillStyle = Math.floor(this.telegraphTimer * 10) % 2 === 0 ? '#fff' : '#f2a65a';
    } else {
      ctx.fillStyle = this.isDashing ? '#f2a65a' : '#c94242';
    }
    ctx.beginPath();
    ctx.moveTo(this.x + this.r, this.y);
    ctx.lineTo(this.x - this.r, this.y + this.r);
    ctx.lineTo(this.x - this.r, this.y - this.r);
    ctx.fill();
  }
}

class BruiserEnemy extends BasicEnemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 15;
    this.r = 25;
    this.shieldAngle = 0;
  }
  update(dt, playerX, playerY, engine) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    this.shieldAngle += dt;

    // Slow relentless pursuit
    this.vx += (dx / dist) * 20 * dt;
    this.vy += (dy / dist) * 20 * dt;

    this.vx *= 0.98;
    this.vy *= 0.98;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    ctx.fillStyle = '#6b8ce2';
    ctx.fillRect(this.x - this.r, this.y - this.r, this.r*2, this.r*2);

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r + 5, this.shieldAngle, this.shieldAngle + Math.PI);
    ctx.stroke();
  }
}

class SwarmerEnemy extends BasicEnemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 1;
    this.r = 8;
    this.angle = Math.random() * Math.PI * 2;
  }
  update(dt, playerX, playerY, engine) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    // Orbit behavior mixed with pursuit
    this.angle += dt * 2;
    const orbitX = Math.cos(this.angle) * 50;
    const orbitY = Math.sin(this.angle) * 50;

    const targetX = playerX + orbitX;
    const targetY = playerY + orbitY;

    const tdx = targetX - this.x;
    const tdy = targetY - this.y;
    const tdist = Math.sqrt(tdx*tdx + tdy*tdy) || 1;

    this.vx += (tdx / tdist) * 100 * dt;
    this.vy += (tdy / tdist) * 100 * dt;

    this.vx *= 0.95;
    this.vy *= 0.95;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    ctx.fillStyle = '#e2c66b';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.r);
    ctx.lineTo(this.x + this.r, this.y + this.r/2);
    ctx.lineTo(this.x - this.r, this.y + this.r/2);
    ctx.fill();
  }
}

class SpawnerEnemy extends BasicEnemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 8;
    this.r = 20;
    this.spawnTimer = 3;
    this.spawnCooldown = 5;
    this.telegraphTimer = 0;
  }
  update(dt, playerX, playerY, engine) {
    this.spawnTimer -= dt;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;

    // Tries to stay at a distance
    if (dist < 200) {
      this.vx -= (dx / dist) * 30 * dt;
      this.vy -= (dy / dist) * 30 * dt;
    } else {
      this.vx += (dx / dist) * 10 * dt;
      this.vy += (dy / dist) * 10 * dt;
    }

    if (this.spawnTimer > 0 && this.spawnTimer < 1.0) {
      this.telegraphTimer += dt;
    }

    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnCooldown;
      this.telegraphTimer = 0;
      if (engine) {
        engine.enemies.push(new SwarmerEnemy(this.x + (Math.random()-0.5)*20, this.y + (Math.random()-0.5)*20));
        engine.enemies.push(new SwarmerEnemy(this.x + (Math.random()-0.5)*20, this.y + (Math.random()-0.5)*20));
        engine.spawnParticles(this.x, this.y, '#e2c66b', 10);
      }
    }

    this.vx *= 0.95;
    this.vy *= 0.95;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(ctx) {
    ctx.fillStyle = '#b66be2';
    if (this.telegraphTimer > 0) {
       ctx.fillStyle = Math.floor(this.telegraphTimer * 10) % 2 === 0 ? '#fff' : '#b66be2';
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner pulse
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * (1 - (this.spawnTimer / this.spawnCooldown)), 0, Math.PI * 2);
    ctx.fill();
  }
}

class HazardEnemy extends BasicEnemy {
  constructor(x, y) {
    super(x, y);
    this.hp = 6;
    this.r = 18;
    this.pulseTimer = 0;
    this.pulseCooldown = 2;
    this.hazardRadius = 80;
    this.activeDuration = 0.5;
    this.isActive = false;
  }
  update(dt, playerX, playerY, engine) {
    this.pulseTimer += dt;

    // Very slow drift
    this.x += this.vx * 0.1 * dt;
    this.y += this.vy * 0.1 * dt;

    if (this.pulseTimer > this.pulseCooldown) {
      this.isActive = true;
      if (this.pulseTimer > this.pulseCooldown + this.activeDuration) {
         this.pulseTimer = 0;
         this.isActive = false;
      }
    }

    if (this.isActive && engine) {
      // Area damage
      const dx = playerX - this.x;
      const dy = playerY - this.y;
      if (dx*dx + dy*dy < this.hazardRadius * this.hazardRadius) {
         if (!engine.player.isOverdrive && engine.player.invulnerableTimer <= 0) {
            engine.state = 'GAME_OVER';
            engine.saveManager.updateScore(engine.score);
            engine.spawnParticles(engine.player.x, engine.player.y, '#d8b0e2', 30);
         }
      }
      if (Math.random() < 0.2) {
         engine.spawnParticles(this.x + (Math.random()-0.5)*this.hazardRadius*2, this.y + (Math.random()-0.5)*this.hazardRadius*2, '#6be291', 1);
      }
    }
  }
  draw(ctx) {
    // Telegraph area
    if (this.pulseTimer > this.pulseCooldown - 1 && !this.isActive) {
      ctx.fillStyle = 'rgba(107, 226, 145, 0.2)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.hazardRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.isActive) {
      ctx.fillStyle = 'rgba(107, 226, 145, 0.6)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.hazardRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#6be291';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.r);
    ctx.lineTo(this.x + this.r, this.y);
    ctx.lineTo(this.x, this.y + this.r);
    ctx.lineTo(this.x - this.r, this.y);
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
    this.overdriveTimer = 0;
    this.overdriveCooldown = 3;
    this.isOverdrive = false;
    this.invulnerableTimer = 0;
  }
  update(dt, input) {
    this.overdriveTimer -= dt;
    this.invulnerableTimer -= dt;
    if (this.invulnerableTimer <= 0.3) {
      this.isOverdrive = false;
    }

    if (input.isSecondaryPressed && input.isSecondaryPressed() && this.overdriveTimer <= 0) {
      this.isOverdrive = true;
      this.overdriveTimer = this.overdriveCooldown;
      this.invulnerableTimer = 0.5;
      this.vx += this.aimDir.x * 600;
      this.vy += this.aimDir.y * 600;
    }

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
    if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.atan2(this.aimDir.y, this.aimDir.x));

    // Telegraph line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(this.r, 0);
    ctx.lineTo(this.r + 50, 0);
    ctx.stroke();

    // Engine block
    ctx.fillStyle = (this.isOverdrive || this.drilling) ? '#f2a65a' : '#555';
    const engOffset = (this.isOverdrive || this.drilling) ? -5 : 0;
    ctx.fillRect(-this.r - 8 + engOffset, -8, 10, 16);

    // Hull
    ctx.fillStyle = '#d8b0e2';
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();

    // Drill
    ctx.fillStyle = '#aaa';
    const drillOffset = this.drilling ? -3 + Math.random()*6 : 0;
    ctx.beginPath();
    ctx.moveTo(this.r + drillOffset, -5);
    ctx.lineTo(this.r + 20 + drillOffset, 0);
    ctx.lineTo(this.r + drillOffset, 5);
    ctx.fill();

    if (this.drilling) {
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(this.r + 20 + drillOffset, 0);
      ctx.lineTo(this.r + 25 + drillOffset + Math.random()*10, (Math.random()-0.5)*10);
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
    this.crystals = [];
    this.worldManager = new WorldManager(this.logicalWidth, this.logicalHeight);
    for (let i=0; i<30; i++) {
      this.crystals.push(new IceCrystal(this.logicalWidth, this.logicalHeight));
    }
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
    this.crystals = [];
    for (let i=0; i<30; i++) {
      this.crystals.push(new IceCrystal(this.logicalWidth, this.logicalHeight));
    }
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
    // Increase spawn rate slightly for variety
    if (Math.random() < 0.025) {
      const sx = Math.random() > 0.5 ? 0 : this.logicalWidth;
      const sy = Math.random() * this.logicalHeight;
      const r = Math.random();

      if (r < 0.3) {
        this.enemies.push(new BasicEnemy(sx, sy));
      } else if (r < 0.5) {
        this.enemies.push(new DasherEnemy(sx, sy));
      } else if (r < 0.65) {
        this.enemies.push(new BruiserEnemy(sx, sy));
      } else if (r < 0.8) {
        this.enemies.push(new SpawnerEnemy(sx, sy));
      } else if (r < 0.9) {
        this.enemies.push(new SwarmerEnemy(sx, sy));
        this.enemies.push(new SwarmerEnemy(sx + 10, sy + 10));
        this.enemies.push(new SwarmerEnemy(sx - 10, sy - 10));
      } else {
        this.enemies.push(new HazardEnemy(sx, sy));
      }
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
        if (this.player.isOverdrive) {
          e.hp -= 5;
          e.vx += this.player.aimDir.x * 400;
          e.vy += this.player.aimDir.y * 400;
          this.spawnParticles(e.x, e.y, '#f2a65a', 10);
          if (e.hp <= 0) {
             const idx = this.enemies.indexOf(e);
             if (idx > -1) this.enemies.splice(idx, 1);
             this.score += 50;
             this.sound.playHit();
             this.spawnParticles(e.x, e.y, '#e26b6b', 20);
          }
        } else if (this.player.invulnerableTimer <= 0) {
          this.state = 'GAME_OVER';
          this.saveManager.updateScore(this.score);
          this.spawnParticles(this.player.x, this.player.y, '#d8b0e2', 30);
        }
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
    if (this.player.isOverdrive) {
       this.spawnParticles(this.player.x - this.player.aimDir.x*15, this.player.y - this.player.aimDir.y*15, '#fff', 2);
       // extra visual flair for overdrive
       if (Math.random() < 0.3) {
         this.spawnParticles(this.player.x - this.player.aimDir.x*20 + (Math.random()-0.5)*10, this.player.y - this.player.aimDir.y*20 + (Math.random()-0.5)*10, '#f2a65a', 1);
       }
       if (Math.random() < 0.1) {
         this.spawnParticles(this.player.x - this.player.aimDir.x*5 + (Math.random()-0.5)*20, this.player.y - this.player.aimDir.y*5 + (Math.random()-0.5)*20, '#d8b0e2', 1);
       }
    }

    this.spawnEnemy();
    for (const c of this.crystals) c.update(dt);

    for (const e of this.enemies) e.update(dt, this.player.x, this.player.y, this);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].life <= 0) this.particles.splice(i, 1);
    }

    this.worldManager.update(dt, this);
    this.checkCollisions();
  };

  GameEngine.prototype.draw = function() {
    // Background layers
    this.worldManager.drawBackground(this.ctx);

    // Draw crystals
    for (const c of this.crystals) {
      if (this.crystals) {
        c.draw(this.ctx);
      }
    }

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

    // Foreground layers / Hazards
    this.worldManager.drawForeground(this.ctx);

    // UI
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Score: ' + this.score, 10, 30);
    this.ctx.fillText('High: ' + this.saveManager.data.highScore, 10, 60);

    // Overdrive Cooldown Bar
    this.ctx.fillStyle = '#555';
    this.ctx.fillRect(10, 70, 100, 10);
    this.ctx.fillStyle = '#f2a65a';
    const ratio = Math.max(0, this.player.overdriveCooldown - this.player.overdriveTimer) / this.player.overdriveCooldown;
    this.ctx.fillRect(10, 70, 100 * ratio, 10);

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
