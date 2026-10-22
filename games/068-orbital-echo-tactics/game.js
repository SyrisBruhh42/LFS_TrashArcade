// Orbital Echo Tactics - Core Logic

const SaveManager = {
  key: 'arcade_game_068_068-orbital-echo-tactics_v1',
  data: { highScore: 0, totalGamesPlayed: 0, options: { mute: false } },
  load: function() {
    try {
      const stored = localStorage.getItem(this.key);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data = { ...this.data, ...parsed };
      }
    } catch(e) { console.warn("Save load failed", e); }
  },
  save: function() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch(e) { console.warn("Save failed", e); }
  }
};

const SoundEngine = {
  ctx: null,
  init: function() {
    if (this.ctx) return;
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch(e) { console.warn("Web Audio API not supported", e); }
  },
  resume: function() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
  playTone: function(freq, type, duration, vol=0.1) {
    if (!this.ctx || SaveManager.data.options.mute) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
  playMove: function() { this.playTone(400, 'sine', 0.1, 0.05); },
  playEchoMove: function() { this.playTone(600, 'triangle', 0.1, 0.02); },
  playHit: function() { this.playTone(150, 'square', 0.2, 0.1); },
  playDestroy: function() { this.playTone(800, 'square', 0.3, 0.1); },
  playGameOver: function() { this.playTone(100, 'sawtooth', 1.0, 0.2); }
};

const Input = {
  keys: {},
  justPressed: {},
  init: function() {
    window.addEventListener('keydown', e => {
      if(!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
      SoundEngine.init(); SoundEngine.resume();
    });
    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    // Touch mappings
    const mapTouch = (id, code) => {
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('touchstart', e => {
        e.preventDefault();
        if(!this.keys[code]) this.justPressed[code] = true;
        this.keys[code] = true;
        SoundEngine.init(); SoundEngine.resume();
      }, {passive:false});
      el.addEventListener('touchend', e => {
        e.preventDefault();
        this.keys[code] = false;
      }, {passive:false});
    };

    mapTouch('btn-up', 'ArrowUp');
    mapTouch('btn-down', 'ArrowDown');
    mapTouch('btn-left', 'ArrowLeft');
    mapTouch('btn-right', 'ArrowRight');
    mapTouch('btn-wait', 'Space');
  },
  isJustPressed: function(code) {
    if (this.justPressed[code]) {
      this.justPressed[code] = false;
      return true;
    }
    return false;
  },
  clear: function() {
    this.justPressed = {};
  }
};

const GRID_SIZE = 40;
const COLS = 15;
const ROWS = 15;

class Entity {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.targetX = x;
    this.targetY = y;
    this.moveTimer = 0;
  }

  update(dt) {
    if (this.moveTimer > 0) {
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) {
        this.moveTimer = 0;
        this.x = this.targetX;
        this.y = this.targetY;
      }
    }
  }

  moveTo(tx, ty) {
    this.targetX = tx;
    this.targetY = ty;
    this.moveTimer = 0.15; // Animation duration
  }

  getRenderX() {
    if (this.moveTimer <= 0) return this.x * GRID_SIZE;
    const p = 1 - (this.moveTimer / 0.15);
    return (this.x + (this.targetX - this.x) * p) * GRID_SIZE;
  }

  getRenderY() {
    if (this.moveTimer <= 0) return this.y * GRID_SIZE;
    const p = 1 - (this.moveTimer / 0.15);
    return (this.y + (this.targetY - this.y) * p) * GRID_SIZE;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.getRenderX() + 2, this.getRenderY() + 2, GRID_SIZE - 4, GRID_SIZE - 4);
  }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y, '#cf7cd4');
    this.history = []; // Array of {x, y}
    this.historyLength = 4; // How far back the echo is
  }

  recordMove(nx, ny) {
    this.history.push({x: nx, y: ny});
    if (this.history.length > 50) { // arbitrary cap to avoid memory leak
      this.history.shift();
    }
  }

  getEchoPos() {
    if (this.history.length >= this.historyLength) {
      return this.history[this.history.length - this.historyLength];
    }
    return null;
  }
}

class Enemy extends Entity {
  constructor(x, y) {
    super(x, y, '#e74c3c');
    this.hp = 1;
  }
}

const Engine = {
  state: 'TITLE',
  lastTime: 0,
  score: 0,
  wave: 1,

  init: function() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    SaveManager.load();
    document.getElementById('title-highscore').innerText = SaveManager.data.highScore;

    Input.init();

    // Resize Observer
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.resize();

    // UI Binding
    document.getElementById('btn-play').addEventListener('click', () => this.start());
    document.getElementById('btn-pause-hud').addEventListener('click', () => this.pause());
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-playagain').addEventListener('click', () => this.start());
    document.getElementById('btn-quit-go').addEventListener('click', () => this.quitToTitle());

    // Auto-pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') this.pause();
    });

    requestAnimationFrame(t => this.loop(t));
  },

  resize: function() {
    // Maintain aspect ratio or fit screen
    const container = this.canvas.parentElement;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    // Desired game size based on grid
    const gameW = COLS * GRID_SIZE;
    const gameH = ROWS * GRID_SIZE;

    const scale = Math.min(cw / gameW, ch / gameH) * 0.95; // 95% to leave slight border

    this.canvas.width = gameW;
    this.canvas.height = gameH;
    this.canvas.style.width = `${gameW * scale}px`;
    this.canvas.style.height = `${gameH * scale}px`;

    // Show touch controls if on mobile/small screen
    if (cw < 800) {
      document.getElementById('touch-controls').classList.remove('hidden');
    } else {
      document.getElementById('touch-controls').classList.add('hidden');
    }
  },

  start: function() {
    this.state = 'PLAYING';
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');

    this.score = 0;
    this.wave = 1;
    this.initLevel();
    this.updateHUD();
    this.lastTime = performance.now();
  },

  initLevel: function() {
    this.player = new Player(Math.floor(COLS/2), Math.floor(ROWS/2));
    this.player.recordMove(this.player.x, this.player.y); // Initial pos

    this.enemies = [];
    this.walls = [];
    this.particles = [];

    // Border walls
    for(let i=0; i<COLS; i++) {
      this.walls.push({x: i, y: 0});
      this.walls.push({x: i, y: ROWS-1});
    }
    for(let i=1; i<ROWS-1; i++) {
      this.walls.push({x: 0, y: i});
      this.walls.push({x: COLS-1, y: i});
    }

    // Spawn enemies
    const numEnemies = 2 + this.wave;
    for(let i=0; i<numEnemies; i++) {
      let ex, ey;
      do {
        ex = 1 + Math.floor(Math.random() * (COLS-2));
        ey = 1 + Math.floor(Math.random() * (ROWS-2));
      } while(
        this.isSolid(ex, ey) ||
        (Math.abs(ex - this.player.x) < 3 && Math.abs(ey - this.player.y) < 3)
      );
      this.enemies.push(new Enemy(ex, ey));
    }

    this.turnState = 'PLAYER_TURN'; // PLAYER_TURN, ANIMATING, ENEMY_TURN, RESOLVING
    this.animTimer = 0;
  },

  pause: function() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    document.getElementById('screen-pause').classList.remove('hidden');
  },

  resume: function() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    document.getElementById('screen-pause').classList.add('hidden');
    this.lastTime = performance.now();
  },

  quitToTitle: function() {
    this.state = 'TITLE';
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('screen-title').classList.remove('hidden');
    document.getElementById('title-highscore').innerText = SaveManager.data.highScore;
  },

  gameOver: function() {
    this.state = 'GAME_OVER';
    document.getElementById('screen-gameover').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('go-score').innerText = this.score;

    SoundEngine.playGameOver();

    SaveManager.data.totalGamesPlayed++;
    if (this.score > SaveManager.data.highScore) {
      SaveManager.data.highScore = this.score;
    }
    SaveManager.save();
  },

  updateHUD: function() {
    document.getElementById('score-display').innerText = `Score: ${this.score}`;
    document.getElementById('wave-display').innerText = `Wave: ${this.wave}`;
  },

  isSolid: function(x, y) {
    if(x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    for(let w of this.walls) if(w.x === x && w.y === y) return true;
    return false;
  },

  getEnemyAt: function(x, y) {
    return this.enemies.find(e => e.targetX === x && e.targetY === y);
  },

  spawnParticles: function(x, y, color) {
    for(let i=0; i<10; i++) {
      this.particles.push({
        x: x * GRID_SIZE + GRID_SIZE/2,
        y: y * GRID_SIZE + GRID_SIZE/2,
        vx: (Math.random() - 0.5) * 100,
        vy: (Math.random() - 0.5) * 100,
        life: 0.5 + Math.random() * 0.5,
        color: color
      });
    }
  },

  processPlayerTurn: function() {
    let dx = 0; let dy = 0;
    let wait = false;

    if (Input.isJustPressed('ArrowUp') || Input.isJustPressed('KeyW')) dy = -1;
    else if (Input.isJustPressed('ArrowDown') || Input.isJustPressed('KeyS')) dy = 1;
    else if (Input.isJustPressed('ArrowLeft') || Input.isJustPressed('KeyA')) dx = -1;
    else if (Input.isJustPressed('ArrowRight') || Input.isJustPressed('KeyD')) dx = 1;
    else if (Input.isJustPressed('Space')) wait = true;

    if (dx !== 0 || dy !== 0 || wait) {
      const nx = this.player.x + dx;
      const ny = this.player.y + dy;

      if (!this.isSolid(nx, ny) && !this.getEnemyAt(nx, ny)) {
        this.player.moveTo(nx, ny);
        this.player.recordMove(nx, ny);
        SoundEngine.playMove();

        // Echo move sound slightly delayed/different pitch handled in update if needed,
        // for now just play together
        if(this.player.getEchoPos()) SoundEngine.playEchoMove();

        this.turnState = 'ANIMATING';
        this.animTimer = 0.15; // Match entity move timer
      } else if (wait) {
        this.player.recordMove(this.player.x, this.player.y);
        SoundEngine.playMove();
        this.turnState = 'ANIMATING';
        this.animTimer = 0.15;
      } else {
        SoundEngine.playHit(); // bump wall
      }
    }
  },

  processEnemyTurn: function() {
    const echoPos = this.player.getEchoPos();

    this.enemies.forEach(e => {
      // Simple AI: Move towards player or avoid echo
      let dx = this.player.x - e.x;
      let dy = this.player.y - e.y;

      let stepX = 0, stepY = 0;

      if (Math.abs(dx) > Math.abs(dy)) {
        stepX = dx > 0 ? 1 : -1;
      } else if (Math.abs(dy) > 0) {
        stepY = dy > 0 ? 1 : -1;
      }

      const nx = e.x + stepX;
      const ny = e.y + stepY;

      if (!this.isSolid(nx, ny) && !this.getEnemyAt(nx, ny) && (nx !== this.player.x || ny !== this.player.y)) {
        e.moveTo(nx, ny);
      }
    });

    this.turnState = 'ANIMATING';
    this.animTimer = 0.15;
  },

  resolveTurn: function() {
    const echoPos = this.player.getEchoPos();

    // Check collisions
    let playerHit = false;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      // If enemy on echo, it dies
      if (echoPos && e.x === echoPos.x && e.y === echoPos.y) {
        this.spawnParticles(e.x, e.y, e.color);
        SoundEngine.playDestroy();
        this.enemies.splice(i, 1);
        this.score += 100;
        this.updateHUD();
      }
      // If enemy on player, player dies
      else if (e.x === this.player.x && e.y === this.player.y) {
        playerHit = true;
      }
    }

    if (playerHit) {
      this.spawnParticles(this.player.x, this.player.y, this.player.color);
      this.gameOver();
      return;
    }

    if (this.enemies.length === 0) {
      this.wave++;
      this.score += 500;
      this.initLevel();
      this.updateHUD();
    } else {
      // Toggle turns
      if (this.turnPhase === 'PLAYER_DONE') {
        this.turnPhase = 'ENEMY_DONE';
        this.processEnemyTurn();
      } else {
        this.turnPhase = null;
        this.turnState = 'PLAYER_TURN';
      }
    }
  },

  loop: function(time) {
    requestAnimationFrame(t => this.loop(t));

    let dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (dt > 0.1) dt = 0.1;

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.draw();
    Input.clear();
  },

  update: function(dt) {
    this.player.update(dt);
    this.enemies.forEach(e => e.update(dt));

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.turnState === 'PLAYER_TURN') {
      this.processPlayerTurn();
    } else if (this.turnState === 'ANIMATING') {
      this.animTimer -= dt;
      if (this.animTimer <= 0) {
        if (!this.turnPhase) {
          this.turnPhase = 'PLAYER_DONE';
          this.resolveTurn();
        } else if (this.turnPhase === 'ENEMY_DONE') {
           this.resolveTurn();
        }
      }
    }
  },

  draw: function() {
    // Clear
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'TITLE') {
      // Draw grid background
      this.ctx.strokeStyle = '#222';
      for(let x=0; x<this.canvas.width; x+=GRID_SIZE) {
        this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
      }
      for(let y=0; y<this.canvas.height; y+=GRID_SIZE) {
        this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
      }
      return;
    }

    // Grid
    this.ctx.strokeStyle = '#2a2a2a';
    for(let x=0; x<this.canvas.width; x+=GRID_SIZE) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
    }
    for(let y=0; y<this.canvas.height; y+=GRID_SIZE) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
    }

    // Walls
    this.ctx.fillStyle = '#444';
    this.walls.forEach(w => {
      this.ctx.fillRect(w.x * GRID_SIZE, w.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
    });

    // Draw Echo Ghost
    const echoPos = this.player.getEchoPos();
    if (echoPos) {
      this.ctx.fillStyle = 'rgba(207, 124, 212, 0.4)'; // Transparent player color
      this.ctx.fillRect(echoPos.x * GRID_SIZE + 4, echoPos.y * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);

      // Draw line connecting player and echo
      this.ctx.strokeStyle = 'rgba(207, 124, 212, 0.2)';
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.getRenderX() + GRID_SIZE/2, this.player.getRenderY() + GRID_SIZE/2);
      this.ctx.lineTo(echoPos.x * GRID_SIZE + GRID_SIZE/2, echoPos.y * GRID_SIZE + GRID_SIZE/2);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // Entities
    if (this.state !== 'GAME_OVER') {
      this.player.draw(this.ctx);
    }
    this.enemies.forEach(e => e.draw(this.ctx));

    // Particles
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life * 2;
      this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    this.ctx.globalAlpha = 1.0;
  }
};

window.addEventListener('load', () => {
  Engine.init();
});
