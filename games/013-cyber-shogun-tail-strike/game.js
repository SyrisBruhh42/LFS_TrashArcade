const SAVE_KEY = 'arcade_game_013_013-cyber-shogun-tail-strike_v1';

class SaveManager {
  constructor() {
    this.memoryFallback = {
      highScore: 0,
      totalRuns: 0,
      maxTail: 0,
      options: {
        mute: false,
        sfxVol: 80,
        musicVol: 60,
        shake: 1.0,
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
        this.memoryFallback = { ...this.memoryFallback, ...parsed };
        if (!this.memoryFallback.options) {
            this.memoryFallback.options = { mute: false, sfxVol: 80, musicVol: 60, shake: 1.0, touch: 'auto' };
        }
      }
    } catch (e) {
      console.warn('SaveManager load failed, using memory fallback', e);
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.memoryFallback));
    } catch (e) {
      console.warn('SaveManager save failed, keeping in memory', e);
    }
  }

  get(key) {
    return this.memoryFallback[key];
  }

  set(key, value) {
    this.memoryFallback[key] = value;
    this.save();
  }

  exportData() {
    return btoa(JSON.stringify(this.memoryFallback));
  }

  importData(base64str) {
    try {
      const str = atob(base64str);
      const parsed = JSON.parse(str);
      if (parsed) {
        this.memoryFallback = { ...this.memoryFallback, ...parsed };
        this.save();
        return true;
      }
    } catch (e) {
      console.error('Import failed', e);
    }
    return false;
  }

  reset() {
    this.memoryFallback = {
      highScore: 0,
      totalRuns: 0,
      maxTail: 0,
      options: this.memoryFallback.options
    };
    this.save();
  }
}

class SoundEngine {
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.initialized = false;
    this.musicOsc = null;
    this.musicTimer = null;
  }

  init() {
    if (this.initialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateVolumes();
      this.initialized = true;
    } catch(e) {
      console.warn('Audio init failed', e);
    }
  }

  updateVolumes() {
    if (!this.initialized) return;
    const opts = this.saveManager.get('options');
    this.masterGain.gain.value = opts.mute ? 0 : 1;
    this.sfxGain.gain.value = opts.sfxVol / 100;
    this.musicGain.gain.value = opts.musicVol / 100;
  }

  playTone(freq, type, duration, vol=1, slideFreq=null) {
    if (!this.initialized || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideFreq, t + duration);
    }

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  playSlash() {
    this.playTone(800, 'square', 0.15, 0.5, 200);
  }

  playParry() {
    this.playTone(1200, 'sine', 0.1, 0.8, 2400);
  }

  playHit() {
    this.playTone(150, 'sawtooth', 0.3, 1, 50);
  }

  playMusicNote(freq) {
    if (!this.initialized || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }
}

class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false };
    this.joystick = { dx: 0, dy: 0, active: false };
    this.slash = { active: false, dx: 0, dy: 0 };

    // Bindings
    window.addEventListener('keydown', e => this.keys[e.code] = true);
    window.addEventListener('keyup', e => this.keys[e.code] = false);

    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('mousemove', e => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - rect.left;
      this.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
    canvas.addEventListener('mouseup', () => { this.mouse.down = false; });

    // Touch virtual controls
    this.setupTouch();
  }

  setupTouch() {
    const joyArea = document.getElementById('vc-joystick');
    const knob = document.getElementById('vc-knob');
    const slashArea = document.getElementById('vc-slash');
    let joyTouchId = null;
    let slashTouchId = null;
    let slashStartX = 0;
    let slashStartY = 0;

    const handleJoyMove = (touch) => {
      const rect = joyArea.getBoundingClientRect();
      const centerX = rect.left + rect.width/2;
      const centerY = rect.top + rect.height/2;
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const dist = Math.hypot(dx, dy);
      const maxDist = rect.width/2;

      if (dist > maxDist) {
        dx = (dx/dist) * maxDist;
        dy = (dy/dist) * maxDist;
      }

      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.joystick.dx = dx / maxDist;
      this.joystick.dy = dy / maxDist;
    };

    joyArea.addEventListener('touchstart', e => {
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        if (joyTouchId === null) {
          joyTouchId = e.changedTouches[i].identifier;
          this.joystick.active = true;
          handleJoyMove(e.changedTouches[i]);
        }
      }
    });

    joyArea.addEventListener('touchmove', e => {
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          handleJoyMove(e.changedTouches[i]);
        }
      }
    });

    const endJoy = (e) => {
      for(let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joyTouchId) {
          joyTouchId = null;
          this.joystick.active = false;
          this.joystick.dx = 0;
          this.joystick.dy = 0;
          knob.style.transform = `translate(-50%, -50%)`;
        }
      }
    };
    joyArea.addEventListener('touchend', endJoy);
    joyArea.addEventListener('touchcancel', endJoy);

    // Slash area (right side of screen)
    slashArea.addEventListener('touchstart', e => {
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        if (slashTouchId === null) {
          slashTouchId = e.changedTouches[i].identifier;
          slashStartX = e.changedTouches[i].clientX;
          slashStartY = e.changedTouches[i].clientY;
          // Simple tap initiates slash towards tap center
          this.slash.active = true;
        }
      }
    });

    slashArea.addEventListener('touchmove', e => {
      e.preventDefault();
      for(let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === slashTouchId) {
           let dx = e.changedTouches[i].clientX - slashStartX;
           let dy = e.changedTouches[i].clientY - slashStartY;
           if (Math.hypot(dx, dy) > 10) {
             this.slash.dx = dx;
             this.slash.dy = dy;
           }
        }
      }
    });

    const endSlash = (e) => {
       for(let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === slashTouchId) {
          slashTouchId = null;
          this.slash.active = false;
        }
      }
    };
    slashArea.addEventListener('touchend', endSlash);
    slashArea.addEventListener('touchcancel', endSlash);
  }

  getMovement() {
    let dx = 0, dy = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

    if (this.joystick.active) {
      dx = this.joystick.dx;
      dy = this.joystick.dy;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }
    return { dx, dy };
  }
}

class GameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.saveManager = new SaveManager();
    this.sound = new SoundEngine(this.saveManager);
    this.input = new InputManager();

    this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
    this.lastTime = 0;

    // Scale handling
    this.logicalWidth = 1280;
    this.logicalHeight = 720;
    this.scale = 1;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.getElementById('game-container'));

    // UI bind
    this.bindUI();
    this.resize();

    // Game entities
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.shakeTimer = 0;

    requestAnimationFrame(t => this.loop(t));
  }

  resize() {
    const ww = window.innerWidth;
    const wh = window.innerHeight;
    this.canvas.width = ww;
    this.canvas.height = wh;

    const scaleX = ww / this.logicalWidth;
    const scaleY = wh / this.logicalHeight;
    this.scale = Math.max(scaleX, scaleY);
  }

  bindUI() {
    const get = id => document.getElementById(id);
    const show = id => {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      get(id).classList.add('active');
    };

    const firstInteraction = () => {
       this.sound.init();
    };
    document.addEventListener('pointerdown', firstInteraction, {once:true});
    document.addEventListener('keydown', firstInteraction, {once:true});

    // Options Modal Logic
    const toggleOptions = (showModal) => {
      if(showModal) get('modal-options').classList.add('active');
      else get('modal-options').classList.remove('active');
      this.updateOptionsUI();
    };

    get('btn-options-title').onclick = () => toggleOptions(true);
    get('btn-options-pause').onclick = () => toggleOptions(true);
    get('btn-close-options').onclick = () => {
      toggleOptions(false);
      this.saveOptions();
    };

    get('btn-howto-title').onclick = () => show('screen-howto');
    get('btn-howto-pause').onclick = () => show('screen-howto');
    get('btn-howto-back').onclick = () => {
      if(this.state === 'TITLE') show('screen-title');
      else show('screen-paused');
    };

    get('btn-play').onclick = () => this.startGame();
    get('btn-playagain').onclick = () => this.startGame();
    get('btn-resume').onclick = () => this.unpause();
    get('btn-restart-pause').onclick = () => this.startGame();
    get('btn-title-go').onclick = () => this.goToTitle();
    get('btn-quit').onclick = () => this.goToTitle();
    get('btn-pause').onclick = () => this.pause();

    // Auto pause on blur
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pause();
    });

    // Option inputs
    get('opt-mute').onchange = () => this.saveOptions();
    get('opt-sfx').oninput = () => this.saveOptions();
    get('opt-music').oninput = () => this.saveOptions();
    get('opt-shake').onchange = () => this.saveOptions();
    get('opt-touch').onchange = () => {
      this.saveOptions();
      this.updateTouchUI();
    };

    // Save Data
    get('btn-export').onclick = () => {
      get('save-data-box').value = this.saveManager.exportData();
    };
    get('btn-import').onclick = () => {
      if (this.saveManager.importData(get('save-data-box').value)) {
        alert("Import successful!");
        this.updateTitleStats();
      } else {
        alert("Invalid save data.");
      }
    };
    let resetCount = 0;
    get('btn-reset').onclick = () => {
      if(resetCount === 0) {
        get('btn-reset').innerText = "Click again to confirm reset";
        resetCount++;
        setTimeout(() => { resetCount = 0; get('btn-reset').innerText = "Reset Save"; }, 3000);
      } else {
        this.saveManager.reset();
        this.updateTitleStats();
        get('btn-reset').innerText = "Reset Save";
        resetCount = 0;
        alert("Save reset.");
      }
    };

    this.updateTitleStats();
    this.updateTouchUI();
  }

  updateTitleStats() {
    document.getElementById('title-highscore').innerText = this.saveManager.get('highScore');
    document.getElementById('title-runs').innerText = this.saveManager.get('totalRuns');
    document.getElementById('title-maxtail').innerText = this.saveManager.get('maxTail');
  }

  updateOptionsUI() {
    const opts = this.saveManager.get('options');
    document.getElementById('opt-mute').checked = opts.mute;
    document.getElementById('opt-sfx').value = opts.sfxVol;
    document.getElementById('opt-music').value = opts.musicVol;
    document.getElementById('opt-shake').value = opts.shake;
    document.getElementById('opt-touch').value = opts.touch;
  }

  saveOptions() {
    const opts = {
      mute: document.getElementById('opt-mute').checked,
      sfxVol: parseInt(document.getElementById('opt-sfx').value),
      musicVol: parseInt(document.getElementById('opt-music').value),
      shake: parseFloat(document.getElementById('opt-shake').value),
      touch: document.getElementById('opt-touch').value
    };
    this.saveManager.set('options', opts);
    this.sound.updateVolumes();
    this.updateTouchUI();
  }

  updateTouchUI() {
    const opts = this.saveManager.get('options');
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const vc = document.body;

    if (opts.touch === 'always' || (opts.touch === 'auto' && hasTouch)) {
      vc.classList.add('vc-visible');
    } else {
      vc.classList.remove('vc-visible');
    }
  }

  startGame() {
    this.state = 'PLAYING';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('hud-score-box').style.display = 'block';
    document.getElementById('btn-pause').style.display = 'block';

    let runs = this.saveManager.get('totalRuns');
    this.saveManager.set('totalRuns', runs + 1);

    // Init game logic state here
    this.score = 0;
    this.tailLen = 0;
    this.multi = 1;
    this.health = 100;

    this.player = {
      x: this.logicalWidth / 2,
      y: this.logicalHeight / 2,
      vx: 0,
      vy: 0,
      speed: 400,
      radius: 15,
      angle: 0,
      slashTimer: 0,
      slashCooldown: 0,
      tail: []
    };

    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.shakeTimer = 0;
    this.enemySpawnTimer = 0;
    this.wave = 1;
  }

  pause() {
    this.state = 'PAUSED';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-paused').classList.add('active');
    document.getElementById('btn-pause').style.display = 'none';
  }

  unpause() {
    this.state = 'PLAYING';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('btn-pause').style.display = 'block';
    this.lastTime = performance.now();
  }

  goToTitle() {
    this.state = 'TITLE';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-title').classList.add('active');
    document.getElementById('hud-score-box').style.display = 'none';
    document.getElementById('btn-pause').style.display = 'none';
    this.updateTitleStats();
  }

  gameOver() {
    this.state = 'GAME_OVER';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-gameover').classList.add('active');
    document.getElementById('btn-pause').style.display = 'none';

    document.getElementById('go-score').innerText = this.score;
    document.getElementById('go-tail').innerText = this.tailLen;

    let hs = this.saveManager.get('highScore');
    let mt = this.saveManager.get('maxTail');

    if (this.tailLen > mt) this.saveManager.set('maxTail', this.tailLen);

    if (this.score > hs) {
      this.saveManager.set('highScore', this.score);
      document.getElementById('go-newhigh').style.display = 'block';
    } else {
      document.getElementById('go-newhigh').style.display = 'none';
    }
  }

  loop(timestamp) {
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // clamp
    this.lastTime = timestamp;

    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.draw();

    requestAnimationFrame(t => this.loop(t));
  }

  spawnParticles(x, y, color, count, speedBase) {
    const opts = this.saveManager.get('options');
    // Minimal particles if Low? We just enforce a reasonable cap
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * speedBase + speedBase / 2;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color
      });
    }
  }

  update(dt) {
    if (this.health <= 0) {
      this.gameOver();
      return;
    }

    // Player movement
    const move = this.input.getMovement();
    this.player.vx = move.dx * this.player.speed;
    this.player.vy = move.dy * this.player.speed;

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;

    // Bounds
    if (this.player.x < 0) this.player.x = 0;
    if (this.player.x > this.logicalWidth) this.player.x = this.logicalWidth;
    if (this.player.y < 0) this.player.y = 0;
    if (this.player.y > this.logicalHeight) this.player.y = this.logicalHeight;

    // Tail updates
    if (this.player.vx !== 0 || this.player.vy !== 0) {
      this.player.angle = Math.atan2(this.player.vy, this.player.vx);
    }

    // Tail mechanics: records positions
    this.player.tail.unshift({x: this.player.x, y: this.player.y});
    // Multiplier logic based on tail length
    const targetTailSegments = this.tailLen * 5;
    while (this.player.tail.length > targetTailSegments) {
      this.player.tail.pop();
    }

    this.multi = 1 + Math.floor(this.tailLen / 5);

    // Combat logic: Slashing/Parrying
    if (this.player.slashCooldown > 0) this.player.slashCooldown -= dt;
    if (this.player.slashTimer > 0) {
      this.player.slashTimer -= dt;
    } else {
      let slashDx = 0, slashDy = 0;
      let attemptingSlash = false;

      if (this.input.mouse.down) {
         attemptingSlash = true;
         const windowOffsetX = (window.innerWidth - this.logicalWidth * this.scale) / 2;
         const windowOffsetY = (window.innerHeight - this.logicalHeight * this.scale) / 2;

         const logicX = (this.input.mouse.x - windowOffsetX) / this.scale;
         const logicY = (this.input.mouse.y - windowOffsetY) / this.scale;

         slashDx = logicX - this.player.x;
         slashDy = logicY - this.player.y;
      } else if (this.input.slash.active) {
         attemptingSlash = true;
         // Default tap to aim right if absolutely zero drag
         slashDx = this.input.slash.dx === 0 && this.input.slash.dy === 0 ? 1 : this.input.slash.dx;
         slashDy = this.input.slash.dy;
      }

      if (attemptingSlash && this.player.slashCooldown <= 0) {
         this.player.slashTimer = 0.2; // Slash duration
         this.player.slashCooldown = 0.5; // Delay between slashes
         this.player.slashAngle = Math.atan2(slashDy, slashDx);
         this.sound.playSlash();
      }
    }

    // Spawning Enemies
    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
      this.enemySpawnTimer = Math.max(0.5, 2.0 - (this.wave * 0.1));
      let side = Math.floor(Math.random() * 4);
      let ex = 0, ey = 0;
      if (side === 0) { ex = Math.random() * this.logicalWidth; ey = -50; }
      if (side === 1) { ex = Math.random() * this.logicalWidth; ey = this.logicalHeight + 50; }
      if (side === 2) { ex = -50; ey = Math.random() * this.logicalHeight; }
      if (side === 3) { ex = this.logicalWidth + 50; ey = Math.random() * this.logicalHeight; }

      this.enemies.push({
        x: ex, y: ey,
        speed: 100 + (this.wave * 10),
        fireTimer: 1.0 + Math.random(),
        type: Math.random() > 0.8 ? 'dasher' : 'shooter',
        hp: 1
      });
      this.wave += 0.05;
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      let e = this.enemies[i];
      let dx = this.player.x - e.x;
      let dy = this.player.y - e.y;
      let dist = Math.hypot(dx, dy);

      if (dist > 0) {
        e.x += (dx/dist) * e.speed * dt;
        e.y += (dy/dist) * e.speed * dt;
      }

      if (e.type === 'shooter') {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = 2.0;
          let pAngle = Math.atan2(dy, dx);
          this.projectiles.push({
            x: e.x, y: e.y,
            vx: Math.cos(pAngle) * 300,
            vy: Math.sin(pAngle) * 300,
            isEnemy: true
          });
          this.sound.playTone(300, 'square', 0.1, 0.2, 100);
        }
      }

      // Enemy hit player
      if (dist < this.player.radius + 15) {
        this.health -= 20;
        this.shakeTimer = 0.5;
        this.sound.playHit();
        this.enemies.splice(i, 1);
        this.spawnParticles(this.player.x, this.player.y, '#ff3366', 20, 200);
        continue;
      }

      // Enemy hit tail
      for (let j = 0; j < this.player.tail.length; j += 5) {
        let tx = this.player.tail[j].x;
        let ty = this.player.tail[j].y;
        if (Math.hypot(tx - e.x, ty - e.y) < 15) {
          this.health -= 10;
          this.shakeTimer = 0.3;
          this.sound.playHit();
          this.tailLen = Math.max(0, this.tailLen - 2);
          this.enemies.splice(i, 1);
          this.spawnParticles(tx, ty, '#ff3366', 10, 150);
          break;
        }
      }
    }

    // Update Projectiles & Combat Logic
    const slashArc = Math.PI / 3;
    const slashRange = 60;

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      let p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Bounds
      if (p.x < -100 || p.x > this.logicalWidth + 100 || p.y < -100 || p.y > this.logicalHeight + 100) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.isEnemy) {
        // Check Parry (Player Slashing)
        let dx = p.x - this.player.x;
        let dy = p.y - this.player.y;
        let dist = Math.hypot(dx, dy);

        if (this.player.slashTimer > 0 && dist < slashRange) {
           let angleToP = Math.atan2(dy, dx);
           let angleDiff = Math.abs(angleToP - this.player.slashAngle);
           if (angleDiff > Math.PI) angleDiff = 2*Math.PI - angleDiff;

           if (angleDiff < slashArc) {
             // Parried!
             p.isEnemy = false;
             let speed = Math.hypot(p.vx, p.vy) * 1.5;
             p.vx = Math.cos(this.player.slashAngle) * speed;
             p.vy = Math.sin(this.player.slashAngle) * speed;
             this.tailLen++;
             this.score += 10 * this.multi;
             this.sound.playParry();
             this.spawnParticles(p.x, p.y, '#bd56e6', 15, 300);
             continue;
           }
        }

        // Hit player body
        if (dist < this.player.radius + 5) {
          this.health -= 10;
          this.shakeTimer = 0.4;
          this.sound.playHit();
          this.projectiles.splice(i, 1);
          this.spawnParticles(this.player.x, this.player.y, '#ff3366', 15, 200);
          continue;
        }

        // Hit player tail
        for (let j = 0; j < this.player.tail.length; j += 5) {
          let tx = this.player.tail[j].x;
          let ty = this.player.tail[j].y;
          if (Math.hypot(tx - p.x, ty - p.y) < 10) {
            this.health -= 5;
            this.shakeTimer = 0.2;
            this.sound.playHit();
            this.tailLen = Math.max(0, this.tailLen - 1);
            this.projectiles.splice(i, 1);
            this.spawnParticles(tx, ty, '#ff3366', 10, 150);
            break;
          }
        }
      } else {
        // Player projectile hits enemy
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          let e = this.enemies[j];
          if (Math.hypot(p.x - e.x, p.y - e.y) < 20) {
            this.enemies.splice(j, 1);
            this.projectiles.splice(i, 1);
            this.score += 50 * this.multi;
            this.sound.playTone(800, 'sawtooth', 0.1, 0.4, 400);
            this.spawnParticles(e.x, e.y, '#00ffcc', 20, 250);
            break;
          }
        }
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 2;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Shake
    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    // HUD updates
    document.getElementById('hud-score').innerText = this.score;
    document.getElementById('hud-tail').innerText = this.tailLen;
    document.getElementById('hud-multi').innerText = this.multi;
    document.getElementById('hud-health').style.width = Math.max(0, this.health) + '%';
  }

  draw() {
    this.ctx.save();

    // Scale and center logic
    this.ctx.translate(this.canvas.width/2, this.canvas.height/2);

    // Screen shake
    if (this.shakeTimer > 0) {
      let shakeIntensity = (this.shakeTimer / 0.5) * 10 * this.saveManager.get('options').shake;
      this.ctx.translate((Math.random()-0.5)*shakeIntensity, (Math.random()-0.5)*shakeIntensity);
    }

    this.ctx.scale(this.scale, this.scale);
    this.ctx.translate(-this.logicalWidth/2, -this.logicalHeight/2);

    // Draw Background Grid (Cyber Dojo setting)
    this.ctx.strokeStyle = 'rgba(189, 86, 230, 0.1)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let x = 0; x <= this.logicalWidth; x += 100) {
      this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.logicalHeight);
    }
    for (let y = 0; y <= this.logicalHeight; y += 100) {
      this.ctx.moveTo(0, y); this.ctx.lineTo(this.logicalWidth, y);
    }
    this.ctx.stroke();

    if (this.state === 'TITLE') {
       this.ctx.fillStyle = '#bd56e6';
       this.ctx.globalAlpha = 0.2 + Math.sin(performance.now()/500)*0.1;
       this.ctx.beginPath();
       this.ctx.arc(this.logicalWidth/2, this.logicalHeight/2, 150, 0, Math.PI*2);
       this.ctx.fill();
       this.ctx.globalAlpha = 1.0;
    }

    if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {

      // Draw Tail
      if (this.player && this.player.tail.length > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(this.player.tail[0].x, this.player.tail[0].y);
        for (let i=1; i<this.player.tail.length; i++) {
          this.ctx.lineTo(this.player.tail[i].x, this.player.tail[i].y);
        }
        this.ctx.strokeStyle = '#bd56e6';
        this.ctx.lineWidth = 4;
        this.ctx.globalAlpha = 0.8;
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
      }

      // Draw Player
      if (this.player) {
        this.ctx.save();
        this.ctx.translate(this.player.x, this.player.y);
        this.ctx.rotate(this.player.angle);

        // Player Body
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.moveTo(15, 0);
        this.ctx.lineTo(-10, 10);
        this.ctx.lineTo(-10, -10);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.restore();

        // Draw Slash Arc
        if (this.player.slashTimer > 0) {
           this.ctx.save();
           this.ctx.translate(this.player.x, this.player.y);
           this.ctx.rotate(this.player.slashAngle);
           this.ctx.beginPath();
           this.ctx.arc(0, 0, 60, -Math.PI/3, Math.PI/3);
           this.ctx.strokeStyle = '#00ffcc';
           this.ctx.lineWidth = 5 * (this.player.slashTimer / 0.2);
           this.ctx.stroke();
           this.ctx.restore();
        }
      }

      // Draw Enemies
      for (let e of this.enemies) {
        this.ctx.save();
        this.ctx.translate(e.x, e.y);
        this.ctx.fillStyle = e.type === 'dasher' ? '#ffaa00' : '#ff3366';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 15, 0, Math.PI*2);
        this.ctx.fill();

        // Inner detail
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 5, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.restore();
      }

      // Draw Projectiles
      for (let p of this.projectiles) {
        this.ctx.fillStyle = p.isEnemy ? '#ff3366' : '#00ffcc';
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
        this.ctx.fill();

        // Glow
        this.ctx.globalAlpha = 0.5;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      }

      // Draw Particles
      for (let p of this.particles) {
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.globalAlpha = 1.0;
      }
    }

    this.ctx.restore();
  }
}

// Ensure execution inside DOMContentLoaded to avoid ReferenceError for defer scripts
window.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine();
});
