/**
 * Phase 1: Core Playable Foundation
 * Garage Punk Soundstage Quirky Ragdoll Party Sports
 */

// --- Audio Engine ---
class SoundEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();

    this.masterGain.connect(this.ctx.destination);
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);

    this.isMuted = false;
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMasterVolume(val) {
    this.masterGain.gain.value = this.isMuted ? 0 : val;
  }

  setMusicVolume(val) {
    this.musicGain.gain.value = val;
  }

  setSfxVolume(val) {
    this.sfxGain.gain.value = val;
  }

  setMute(isMuted) {
    this.isMuted = isMuted;
    this.masterGain.gain.value = isMuted ? 0 : document.getElementById('vol-master').value;
  }

  playTone(freq, type, duration) {
    if (this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, this.ctx.currentTime + duration);
    osc.stop(this.ctx.currentTime + duration);
  }

  playJump() { this.playTone(400, 'sine', 0.2); }
  playHit() { this.playTone(150, 'square', 0.1); }
  playScore() { this.playTone(600, 'triangle', 0.4); }
  playPowerup() { this.playTone(800, 'sine', 0.3); }
}

// --- Save Manager ---
class SaveManager {
  constructor(key) {
    this.key = key;
    this.data = this.load();
  }

  load() {
    try {
      const stored = localStorage.getItem(this.key);
      return stored ? JSON.parse(atob(stored)) : this.defaultData();
    } catch (e) {
      return this.defaultData();
    }
  }

  save() {
    localStorage.setItem(this.key, btoa(JSON.stringify(this.data)));
  }

  defaultData() {
    return {
      masterVol: 1, musicVol: 0.5, sfxVol: 0.8,
      muted: false, reducedMotion: false, leftHanded: false,
      wins: 0, losses: 0
    };
  }

  reset() {
    this.data = this.defaultData();
    this.save();
  }

  export() {
    return btoa(JSON.stringify(this.data));
  }

  importData(str) {
    try {
      const parsed = JSON.parse(atob(str));
      if (parsed && typeof parsed === 'object') {
        this.data = { ...this.defaultData(), ...parsed };
        this.save();
        return true;
      }
    } catch(e) {}
    return false;
  }
}

// --- Input Manager ---
class InputManager {
  constructor() {
    this.keys = {};
    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  }
  isDown(code) { return !!this.keys[code]; }
  bindTouch(btnId, code) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const start = (e) => { e.preventDefault(); this.keys[code] = true; };
    const end = (e) => { e.preventDefault(); this.keys[code] = false; };
    btn.addEventListener('touchstart', start, {passive: false});
    btn.addEventListener('touchend', end, {passive: false});
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
  }
}

// --- Physics Entities ---
class Player {
  constructor(x, y, isBot, color) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.width = 40;
    this.height = 80;
    this.isBot = isBot;
    this.color = color;
    this.grounded = false;
    this.smashCooldown = 0;
    this.speed = 300;
    this.jumpForce = -600;
  }

  getBotInput(ball, gameWidth, gameHeight) {
    let moveDir = 0, jumpReq = false, smashReq = false;
    if (ball.x > this.x + 20) moveDir = 1;
    else if (ball.x < this.x - 20) moveDir = -1;
    if (ball.y < this.y - 50 && ball.x > this.x - 100 && ball.x < this.x + 100) jumpReq = true;
    if (Math.abs(ball.x - this.x) < 60 && Math.abs(ball.y - this.y) < 60) smashReq = true;
    return { moveDir, jumpReq, smashReq };
  }

  update(dt, input, ball, gameWidth, gameHeight) {
    // Gravity
    this.vy += 1200 * dt;

    // Controls
    let moveDir = 0;
    let jumpReq = false;
    let smashReq = false;

    if (!this.isBot) {
      if (input.isDown('ArrowLeft') || input.isDown('KeyA')) moveDir = -1;
      if (input.isDown('ArrowRight') || input.isDown('KeyD')) moveDir = 1;
      if (input.isDown('ArrowUp') || input.isDown('KeyW')) jumpReq = true;
      if (input.isDown('Space')) smashReq = true;
    } else {
      const botInput = this.getBotInput(ball, gameWidth, gameHeight);
      moveDir = botInput.moveDir;
      jumpReq = botInput.jumpReq;
      smashReq = botInput.smashReq;
    }

    this.vx = moveDir * this.speed;

    if (jumpReq && this.grounded) {
      this.vy = this.jumpForce;
      this.grounded = false;
    }

    if (this.smashCooldown > 0) this.smashCooldown -= dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Bounds (Bot stays right, P1 stays left of net)
    if (this.isBot) {
      if (this.x < gameWidth/2 + this.width/2) this.x = gameWidth/2 + this.width/2;
      if (this.x > gameWidth - this.width/2) this.x = gameWidth - this.width/2;
    } else {
      if (this.x < this.width/2) this.x = this.width/2;
      if (this.x > gameWidth/2 - this.width/2) this.x = gameWidth/2 - this.width/2;
    }

    if (this.y > gameHeight - this.height/2) {
      this.y = gameHeight - this.height/2;
      this.vy = 0;
      this.grounded = true;
    }

    return { smashReq: smashReq && this.smashCooldown <= 0, moveDir };
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
    // Eye
    ctx.fillStyle = '#fff';
    ctx.fillRect(this.x + (this.isBot ? -10 : 0), this.y - this.height/4, 10, 10);
  }
}

class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 15;
  }

  update(dt, gameWidth, gameHeight) {
    this.vy += 500 * dt; // Gravity

    // Drag
    this.vx *= 0.99;
    this.vy *= 0.99;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    let hitWall = false;
    // Bounds
    if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.8; hitWall = true; }
    if (this.x > gameWidth - this.radius) { this.x = gameWidth - this.radius; this.vx *= -0.8; hitWall = true; }
    if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.8; hitWall = true; }

    // Net Collision
    const netX = gameWidth/2;
    const netY = gameHeight - 150;
    if (this.x + this.radius > netX - 5 && this.x - this.radius < netX + 5 && this.y > netY) {
      if (this.vy > 0 && this.y - this.radius < netY) {
        this.y = netY - this.radius;
        this.vy *= -0.8;
      } else {
        if (this.x < netX) { this.x = netX - 5 - this.radius; this.vx *= -0.8; }
        else { this.x = netX + 5 + this.radius; this.vx *= -0.8; }
      }
      hitWall = true;
    }

    return hitWall;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.stroke();
  }
}

// --- Main Game Loop ---
class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.state = 'TITLE'; // TITLE, PLAYING, GAME_OVER
    this.lastTime = performance.now();

    this.width = 800;
    this.height = 600;

    this.audio = new SoundEngine();
    this.saveManager = new SaveManager('arcade_game_088_088-garage-punk-soundstage-quirky-ragdoll-party_v1');
    this.input = new InputManager();

    this.initUI();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.getElementById('game-container'));

    // Pause on blur
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
      }
    });
    window.addEventListener('focus', () => {
      if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.lastTime = performance.now();
      }
    });

    this.input.bindTouch('btn-left', 'ArrowLeft');
    this.input.bindTouch('btn-right', 'ArrowRight');
    this.input.bindTouch('btn-jump', 'ArrowUp');
    this.input.bindTouch('btn-smash', 'Space');

    requestAnimationFrame(t => this.loop(t));

    // Cabinet Synergy
    window.ARCADE_CARTRIDGE_META = {
      title: "Garage Punk Soundstage Quirky Ragdoll Party Sports",
      lore: "The Grand Stadium Cup is underway! Step onto the floodlit pitch against a roster of eccentric rival champions.",
      objective: "Outscore your rival before the 90-second match clock expires.",
      inspiration: "Sports Heads, Slime Volleyball, QWOP.",
      sessionLength: "90-180 Sec",
      howItWorks: "1. Control Positioning & Jump Arc | 2. Angle Your Kick / Smash | 3. Hit Floating Arena Powerups",
      palette: ["#1b162a", "#2c2247", "#00e5ff", "#ff4081"]
    };
    window.game = this; // Expose for testing/cabinet
  }

  initUI() {
    // Buttons
    document.getElementById('btn-start').addEventListener('click', () => this.startMatch());
    document.getElementById('btn-restart').addEventListener('click', () => this.startMatch());
    document.getElementById('btn-quit').addEventListener('click', () => this.showScreen('title-screen'));

    document.getElementById('btn-how-to-play').addEventListener('click', () => this.showScreen('how-to-play-screen'));
    document.getElementById('btn-close-how-to-play').addEventListener('click', () => this.showScreen('title-screen'));

    document.getElementById('btn-options').addEventListener('click', () => {
      this.syncOptionsToUI();
      this.showScreen('options-screen');
    });
    document.getElementById('btn-close-options').addEventListener('click', () => {
      this.saveOptionsFromUI();
      this.showScreen('title-screen');
    });

    // Options Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        e.target.classList.add('active');
        document.getElementById(e.target.dataset.target).classList.remove('hidden');
      });
    });

    // Save Data Management
    document.getElementById('btn-copy-save').addEventListener('click', () => {
      navigator.clipboard.writeText(this.saveManager.export());
      alert("Save data copied to clipboard.");
    });
    document.getElementById('btn-import-save').addEventListener('click', () => {
      const data = prompt("Paste save data here:");
      if (data && this.saveManager.importData(data)) {
        alert("Save imported successfully.");
        this.syncOptionsToUI();
      } else if (data) {
        alert("Invalid save data.");
      }
    });
    document.getElementById('btn-reset-save').addEventListener('click', () => {
      if (confirm("Are you sure you want to reset all progress?")) {
        this.saveManager.reset();
        this.syncOptionsToUI();
      }
    });
  }

  syncOptionsToUI() {
    const d = this.saveManager.data;
    document.getElementById('vol-master').value = d.masterVol;
    document.getElementById('vol-music').value = d.musicVol;
    document.getElementById('vol-sfx').value = d.sfxVol;
    document.getElementById('chk-mute').checked = d.muted;
    document.getElementById('chk-reduced-motion').checked = d.reducedMotion;
    document.getElementById('chk-left-handed').checked = d.leftHanded;
    document.getElementById('save-data-text').value = this.saveManager.export();
  }

  saveOptionsFromUI() {
    const d = this.saveManager.data;
    d.masterVol = parseFloat(document.getElementById('vol-master').value);
    d.musicVol = parseFloat(document.getElementById('vol-music').value);
    d.sfxVol = parseFloat(document.getElementById('vol-sfx').value);
    d.muted = document.getElementById('chk-mute').checked;
    d.reducedMotion = document.getElementById('chk-reduced-motion').checked;
    d.leftHanded = document.getElementById('chk-left-handed').checked;

    this.saveManager.save();

    this.audio.setMasterVolume(d.masterVol);
    this.audio.setMusicVolume(d.musicVol);
    this.audio.setSfxVolume(d.sfxVol);
    this.audio.setMute(d.muted);

    if (d.leftHanded) {
      document.getElementById('touch-controls').classList.add('left-handed');
    } else {
      document.getElementById('touch-controls').classList.remove('left-handed');
    }
  }

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    if (id) document.getElementById(id).classList.remove('hidden');
    document.getElementById('hud').classList.toggle('hidden', id !== null);

    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    document.getElementById('touch-controls').classList.toggle('hidden', id !== null || !isTouch);
  }

  resize() {
    const container = document.getElementById('game-container');
    const aspect = this.width / this.height;
    let w = container.clientWidth;
    let h = container.clientHeight;

    if (w / h > aspect) {
      w = h * aspect;
    } else {
      h = w / aspect;
    }

    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  startMatch() {
    this.audio.resume();
    this.saveOptionsFromUI();
    this.showScreen(null);
    this.state = 'PLAYING';

    this.p1 = new PlayerController(this.width/4, this.height - 100, false, '#00e5ff');

    if (!this.rosterManager) {
      this.rosterManager = new RosterManager();
    }
    const currentMatchIndex = this.saveManager.data.wins || 0;
    const RivalClass = this.rosterManager.getRivalClass(currentMatchIndex);
    this.p2 = new RivalClass(this.width*3/4, this.height - 100);
    // Reset bot score label if starting new opponent
    const p2Label = document.querySelector('.score-p2');
    if (p2Label) { p2Label.dataset.nameSet = ""; }
    this.ball = new Ball(this.width/2, 200);
    this.world = new WorldEnvironment(this.width, this.height);

    this.score1 = 0;
    this.score2 = 0;
    this.timeLeft = 90;
    this.matchTimer = 0;

    this.updateHUD();
  }

  resetBall(scorer) {
    this.ball.x = this.width/2;
    this.ball.y = 200;
    this.ball.vx = scorer === 1 ? 200 : -200;
    this.ball.vy = -300;
    this.p1.x = this.width/4;
    this.p2.x = this.width*3/4;
  }

  update(dt) {
    if (this.state !== 'PLAYING') {
      if (this.state === 'TITLE' && this.input.isDown('Enter')) {
        this.startMatch();
        this.input.keys['Enter'] = false;
      }
      if (this.state === 'GAME_OVER' && this.input.isDown('Enter')) {
        this.startMatch();
        this.input.keys['Enter'] = false;
      }
      if (this.state === 'PAUSED' && this.input.isDown('Escape')) {
        this.state = 'PLAYING';
        this.input.keys['Escape'] = false;
      }
      return;
    }

    if (this.input.isDown('Escape')) {
      this.state = 'PAUSED';
      this.input.keys['Escape'] = false;
      return;
    }

    this.matchTimer += dt;
    if (this.matchTimer >= 1) {
      this.timeLeft--;
      this.matchTimer = 0;
      this.updateHUD();
      if (this.timeLeft <= 0) {
        this.endMatch();
        return;
      }
    }

    const p1State = this.p1.update(dt, this.input, this.ball, this.width, this.height);
    const p2State = this.p2.update(dt, this.input, this.ball, this.width, this.height);
    const ballHitWall = this.ball.update(dt, this.width, this.height);

    if (this.world) this.world.update(dt, this.ball, this.audio);

    if (ballHitWall) this.audio.playHit();

    // Player-Ball Collision
    this.handleCollision(this.p1, p1State);
    this.handleCollision(this.p2, p2State);

    // Scoring
    if (this.ball.y > this.height - this.ball.radius - 10) {
      if (this.ball.x < this.width/2) {
        this.score2++;
        this.audio.playScore();
        this.resetBall(2);
      } else {
        this.score1++;
        this.audio.playScore();
        this.resetBall(1);
      }
      this.updateHUD();

      if (this.score1 >= 7 || this.score2 >= 7) {
        this.endMatch();
      }
    }
  }

  handleCollision(player, pState) {
    // Simple AABB vs Circle
    const px = Math.max(player.x - player.width/2, Math.min(this.ball.x, player.x + player.width/2));
    const py = Math.max(player.y - player.height/2, Math.min(this.ball.y, player.y + player.height/2));

    const dx = this.ball.x - px;
    const dy = this.ball.y - py;
    const distSq = dx*dx + dy*dy;

    if (distSq < this.ball.radius * this.ball.radius) {
      // Collision occurred
      this.audio.playHit();

      let forceX = (this.ball.x - player.x) * 5;
      let forceY = (this.ball.y - player.y) * 5;

      if (pState.smashReq) {
        // Core Mechanic: Mid-Flight Boost / Smash
        forceX *= 2.5;
        forceY = -800; // Spike or high lob
        player.smashCooldown = 0.5;
        // Recoil
        player.vy -= 200;
        player.vx -= forceX * 0.2;
      }

      this.ball.vx = forceX + player.vx * 0.5;
      this.ball.vy = forceY + player.vy * 0.5;

      // Push ball out
      const dist = Math.sqrt(distSq);
      if (dist > 0) {
        const overlap = this.ball.radius - dist;
        this.ball.x += (dx / dist) * overlap;
        this.ball.y += (dy / dist) * overlap;
      }
    }
  }

  updateHUD() {
    if (this.p2 && this.p2.name) {
      const p2Label = document.querySelector('.score-p2');
      if (p2Label && !p2Label.dataset.nameSet) {
        p2Label.innerHTML = `${this.p2.name}: <span id="score2"></span>`;
        p2Label.dataset.nameSet = "true";
      }
    }

    document.getElementById('score1').textContent = this.score1;
    document.getElementById('score2').textContent = this.score2;
    document.getElementById('time').textContent = this.timeLeft;
  }

  endMatch() {
    this.state = 'GAME_OVER';
    let msg = "";
    if (this.score1 > this.score2) {
      msg = "You Win!";
      this.saveManager.data.wins++;
    } else if (this.score2 > this.score1) {
      msg = "Bot Wins!";
      this.saveManager.data.losses++;
    } else {
      msg = "Draw!";
    }
    this.saveManager.save();

    document.getElementById('game-over-title').textContent = msg;
    document.getElementById('game-over-stats').innerHTML = `
      <p>Final Score: ${this.score1} - ${this.score2}</p>
      <p>Career Record: ${this.saveManager.data.wins} W / ${this.saveManager.data.losses} L</p>
    `;
    this.showScreen('game-over-screen');
  }

  draw() {
    // Clear
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.world && (this.state === 'PLAYING' || this.state === 'PAUSED')) {
      this.world.draw(this.ctx);
    }

    if (this.state === 'PAUSED') {
      this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '40px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('PAUSED', this.width/2, this.height/2);
    }

    if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;

    // Draw Environment
    // Background gradient is handled by CSS, just draw court details

    // Net
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(this.width/2 - 5, this.height - 150, 10, 150);

    // Floor lines
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height - 2);
    this.ctx.lineTo(this.width, this.height - 2);
    this.ctx.stroke();

    // Goals (visual only, entire floor scores)
    this.ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
    this.ctx.fillRect(0, this.height - 150, 100, 150);
    this.ctx.fillStyle = 'rgba(255, 64, 129, 0.2)';
    this.ctx.fillRect(this.width - 100, this.height - 150, 100, 150);

    // Entities
    this.p1.draw(this.ctx);
    this.p2.draw(this.ctx);
    this.ball.draw(this.ctx);
  }

  loop(time) {
    const dt = Math.min((time - this.lastTime) / 1000, 0.1); // Cap delta time
    this.lastTime = time;

    this.update(dt);
    this.draw();

    requestAnimationFrame(t => this.loop(t));
  }
}

// Start
window.onload = () => {
  new Game();
};
