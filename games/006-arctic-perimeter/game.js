const SAVE_KEY = 'arcade_game_006_006-arctic-perimeter_v1';

class SaveManager {
  constructor() {
    this.fallback = {
      highScore: 0,
      bestWave: 0,
      totalGamesPlayed: 0,
      totalScoreAccumulated: 0,
      unlockedMilestones: [],
      options: {
        mute: false, sfx: 80, music: 50, shake: '1', particles: 'high',
        palette: 'default', touch: 'auto'
      }
    };
    this.data = this.load();
  }
  load() {
    try {
      const stored = localStorage.getItem(SAVE_KEY);
      if (stored) return { ...this.fallback, ...JSON.parse(stored) };
    } catch (e) { console.warn('SaveManager: load failed', e); }
    return { ...this.fallback };
  }
  save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
    catch (e) { console.warn('SaveManager: save failed', e); }
  }
  updateOptions(opts) { this.data.options = { ...this.data.options, ...opts }; this.save(); }
  recordRun(score, wave) {
    this.data.totalGamesPlayed++;
    this.data.totalScoreAccumulated += score;
    let newHigh = false;
    if (score > this.data.highScore) { this.data.highScore = score; newHigh = true; }
    if (wave > this.data.bestWave) { this.data.bestWave = wave; }
    const newlyUnlocked = [];
    if (this.data.totalGamesPlayed >= 10 && !this.data.unlockedMilestones.includes('Veteran')) {
      this.data.unlockedMilestones.push('Veteran'); newlyUnlocked.push('Veteran');
    }
    if (this.data.bestWave >= 10 && !this.data.unlockedMilestones.includes('Survivor')) {
      this.data.unlockedMilestones.push('Survivor'); newlyUnlocked.push('Survivor');
    }
    if (this.data.highScore >= 5000 && !this.data.unlockedMilestones.includes('Defender')) {
      this.data.unlockedMilestones.push('Defender'); newlyUnlocked.push('Defender');
    }
    this.save();
    return { newHigh, newlyUnlocked };
  }
  reset() { this.data = { ...this.fallback }; this.save(); }
  export() { return btoa(JSON.stringify(this.data)); }
  importSave(str) {
    try {
      const parsed = JSON.parse(atob(str));
      if (parsed && typeof parsed === 'object') {
        this.data = { ...this.fallback, ...parsed };
        this.save(); return true;
      }
    } catch(e) { return false; }
    return false;
  }
}

class SoundEngine {
  constructor(saveManager) {
    this.sm = saveManager;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.updateVolumes();
    this.musicOsc = null;
    this.musicInterval = 0;
    this.musicPlaying = false;
  }
  updateVolumes() {
    const opts = this.sm.data.options;
    this.master.gain.value = opts.mute ? 0 : 1;
    this.sfx.gain.value = opts.sfx / 100;
    this.music.gain.value = (opts.music / 100) * 0.3;
  }
  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
  playTone(freq, type, duration, vol=1, slideFreq=null) {
    if (this.sm.data.options.mute || this.sm.data.options.sfx === 0) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideFreq) osc.frequency.exponentialRampToValueAtTime(slideFreq, t + duration);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + duration);
    osc.connect(g); g.connect(this.sfx);
    osc.start(t); osc.stop(t + duration);
  }
  playNoise(duration, vol=1) {
    if (this.sm.data.options.mute || this.sm.data.options.sfx === 0) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    noise.connect(filter); filter.connect(g); g.connect(this.sfx);
    noise.start(this.ctx.currentTime);
  }
  sfxShoot() { this.playTone(400, 'square', 0.1, 0.5, 200); }
  sfxLaser() { this.playTone(800, 'sawtooth', 0.2, 0.3, 100); }
  sfxHit() { this.playNoise(0.1, 0.5); }
  sfxExplode() { this.playNoise(0.5, 1); this.playTone(100, 'square', 0.5, 1, 50); }
  sfxBuild() { this.playTone(300, 'sine', 0.1, 0.5, 600); }
  sfxError() { this.playTone(150, 'sawtooth', 0.2, 0.8, 100); }
  startMusic() {
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    let note = 0;
    const notes = [220, 220, 330, 220, 440, 220, 330, 261];
    const playNote = () => {
      if (!this.musicPlaying) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[note];
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      osc.connect(g); g.connect(this.music);
      osc.start(t); osc.stop(t + 0.2);
      note = (note + 1) % notes.length;
      setTimeout(playNote, 250);
    };
    playNote();
  }
  stopMusic() { this.musicPlaying = false; }
}

class InputManager {
  constructor() {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.touch = { active: false, jx: 0, jy: 0, build: false, next: false };
    this.vp = { w: window.innerWidth, h: window.innerHeight, scale: 1, ox: 0, oy: 0 };
    this.hasTouch = false;

    window.addEventListener('keydown', e => { this.keys[e.key] = true; this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.key] = false; this.keys[e.code] = false; });

    const c = document.getElementById('game-canvas');
    c.addEventListener('mousemove', e => {
      this.mouse.x = (e.clientX - this.vp.ox) / this.vp.scale;
      this.mouse.y = (e.clientY - this.vp.oy) / this.vp.scale;
    });
    c.addEventListener('pointerdown', e => {
      this.mouse.down = true; this.mouse.clicked = true;
      this.mouse.x = (e.clientX - this.vp.ox) / this.vp.scale;
      this.mouse.y = (e.clientY - this.vp.oy) / this.vp.scale;
    });
    c.addEventListener('pointerup', () => this.mouse.down = false);

    window.addEventListener('touchstart', () => { this.hasTouch = true; updateTouchUI(); }, {passive:true});

    // Virtual joystick
    const jBase = document.getElementById('joystick-base');
    const jStick = document.getElementById('joystick-stick');
    let jId = null;
    jBase.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.changedTouches[0]; jId = t.identifier;
      this.updateJoystick(t, jBase, jStick);
    });
    jBase.addEventListener('touchmove', e => {
      e.preventDefault();
      for (let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === jId) {
          this.updateJoystick(e.changedTouches[i], jBase, jStick);
        }
      }
    });
    const jEnd = e => {
      for (let i=0; i<e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === jId) {
          jId = null; this.touch.jx = 0; this.touch.jy = 0;
          jStick.style.transform = `translate(0px, 0px)`;
        }
      }
    };
    jBase.addEventListener('touchend', jEnd);
    jBase.addEventListener('touchcancel', jEnd);

    document.getElementById('vbtn-build').addEventListener('touchstart', e => { e.preventDefault(); this.touch.build = true; });
    document.getElementById('vbtn-next').addEventListener('touchstart', e => { e.preventDefault(); this.touch.next = true; });

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(document.getElementById('game-container'));
    this.resize();
  }
  updateJoystick(touch, base, stick) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const max = rect.width/2 - 25;
    if (dist > max) { dx = (dx/dist)*max; dy = (dy/dist)*max; }
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
    this.touch.jx = dx / max; this.touch.jy = dy / max;
  }
  resize() {
    this.vp.w = window.innerWidth; this.vp.h = window.innerHeight;
    const c = document.getElementById('game-canvas');
    c.width = this.vp.w; c.height = this.vp.h;
    // Logical resolution 1280x720
    const scale = Math.min(this.vp.w / 1280, this.vp.h / 720);
    this.vp.scale = scale;
    this.vp.ox = (this.vp.w - 1280 * scale) / 2;
    this.vp.oy = (this.vp.h - 720 * scale) / 2;
    updateTouchUI();
  }
  clear() { this.mouse.clicked = false; this.touch.build = false; this.touch.next = false; }
}

let saveManager, audio, input, ctx;
let state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
let lastTime = 0;

// Game State
const GAME = {
  w: 1280, h: 720,
  cx: 640, cy: 360,
  floeRadius: 360, minFloe: 100,
  baseHealth: 100,
  score: 0, wave: 1, scrap: 100,
  towers: [], enemies: [], particles: [], projectiles: [],
  spawnTimer: 0, waveTimer: 0,
  player: { x: 640, y: 360, selectedType: 0 }
};

const TOWER_TYPES = [
  { name: 'Gun', cost: 50, range: 150, cd: 0.5, dmg: 10, color: '#aaa', type: 'gun' },
  { name: 'Laser', cost: 100, range: 250, cd: 0.1, dmg: 2, color: '#f55', type: 'laser' },
  { name: 'Bomb', cost: 150, range: 100, cd: 2.0, dmg: 50, color: '#fa0', type: 'bomb' }
];

function init() {
  saveManager = new SaveManager();
  audio = new SoundEngine(saveManager);
  input = new InputManager();
  const c = document.getElementById('game-canvas');
  ctx = c.getContext('2d');

  applyOptions();
  document.getElementById('title-high-score').textContent = saveManager.data.highScore;

  bindUI();
  requestAnimationFrame(loop);
}

function applyOptions() {
  const o = saveManager.data.options;
  document.documentElement.setAttribute('data-palette', o.palette);
  updateTouchUI();
  audio.updateVolumes();

  document.getElementById('opt-mute').checked = o.mute;
  document.getElementById('opt-sfx').value = o.sfx;
  document.getElementById('opt-music').value = o.music;
  document.getElementById('opt-shake').value = o.shake;
  document.getElementById('opt-particles').value = o.particles;
  document.getElementById('opt-palette').value = o.palette;
  document.getElementById('opt-touch').value = o.touch;
}

function updateTouchUI() {
  if (!input) return;
  const o = saveManager.data.options;
  const vc = document.getElementById('virtual-controls');
  const show = o.touch === 'always' || (o.touch === 'auto' && (input.hasTouch || window.innerWidth < 800));
  if (show && state === 'PLAYING') vc.classList.add('active');
  else vc.classList.remove('active');
}

function setUI(id) {
  document.querySelectorAll('.ui-layer').forEach(el => el.classList.remove('active'));
  if(id) document.getElementById(id).classList.add('active');
}

function bindUI() {
  const clk = (id, fn) => document.getElementById(id).addEventListener('click', () => {
    audio.resume(); audio.sfxBuild(); fn();
  });

  clk('btn-play', startGame);
  clk('btn-how-to', () => setUI('ui-how-to'));
  clk('btn-close-how-to', () => setUI(state === 'PAUSED' ? 'ui-paused' : 'ui-title'));
  clk('btn-options-title', () => setUI('ui-options'));
  clk('btn-options-pause', () => setUI('ui-options'));
  clk('btn-close-options', () => { applyOptions(); setUI(state === 'PAUSED' ? 'ui-paused' : 'ui-title'); });
  clk('btn-pause', () => { state = 'PAUSED'; setUI('ui-paused'); audio.stopMusic(); updateTouchUI(); });
  clk('btn-resume', () => { state = 'PLAYING'; setUI('ui-playing'); lastTime = performance.now(); audio.startMusic(); updateTouchUI(); });
  clk('btn-restart', startGame);
  clk('btn-play-again', startGame);
  clk('btn-title-return', () => { state = 'TITLE'; setUI('ui-title'); });

  // Options
  const optChg = (id, key) => document.getElementById(id).addEventListener('change', e => {
    saveManager.updateOptions({[key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value});
    applyOptions();
  });
  optChg('opt-mute', 'mute'); optChg('opt-sfx', 'sfx'); optChg('opt-music', 'music');
  optChg('opt-shake', 'shake'); optChg('opt-particles', 'particles');
  optChg('opt-palette', 'palette'); optChg('opt-touch', 'touch');

  // Save ops
  clk('btn-export-save', () => {
    const ta = document.getElementById('save-data-io');
    ta.style.display = 'block'; ta.value = saveManager.export(); ta.select();
  });
  clk('btn-import-save', () => {
    const ta = document.getElementById('save-data-io');
    ta.style.display = 'block'; ta.value = ''; ta.focus();
    document.getElementById('btn-submit-import').style.display = 'inline-block';
  });
  clk('btn-submit-import', () => {
    const ta = document.getElementById('save-data-io');
    if (saveManager.importSave(ta.value)) {
      alert('Save imported!'); applyOptions();
      ta.style.display = 'none'; document.getElementById('btn-submit-import').style.display = 'none';
      document.getElementById('title-high-score').textContent = saveManager.data.highScore;
    } else alert('Invalid save data.');
  });
  let resetClicks = 0;
  clk('btn-reset-save', () => {
    resetClicks++;
    if(resetClicks === 1) {
      document.getElementById('btn-reset-save').textContent = 'Click again to confirm reset';
      setTimeout(()=> { resetClicks=0; document.getElementById('btn-reset-save').textContent='Reset Save'; }, 3000);
    } else {
      saveManager.reset(); applyOptions();
      document.getElementById('title-high-score').textContent = 0;
      resetClicks = 0; document.getElementById('btn-reset-save').textContent='Reset Save';
      alert('Save reset.');
    }
  });

  // Tower selection UI
  document.querySelectorAll('.tower-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      audio.resume(); setTowerType(parseInt(btn.getAttribute('data-type')));
    });
  });
}

function setTowerType(t) {
  GAME.player.selectedType = t;
  document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.tower-btn[data-type="${t}"]`).classList.add('active');
}

function startGame() {
  state = 'PLAYING';
  setUI('ui-playing');
  updateTouchUI();
  audio.startMusic();

  GAME.floeRadius = 360;
  GAME.baseHealth = 100;
  GAME.score = 0; GAME.wave = 1; GAME.scrap = 100;
  GAME.towers = []; GAME.enemies = []; GAME.particles = []; GAME.projectiles = [];
  GAME.spawnTimer = 0; GAME.waveTimer = 0;
  GAME.player = { x: GAME.cx, y: GAME.cy, selectedType: 0 };
  setTowerType(0);

  updateHUD();
  lastTime = performance.now();
}

function updateHUD() {
  document.getElementById('hud-score').textContent = GAME.score;
  document.getElementById('hud-wave').textContent = GAME.wave;
  document.getElementById('hud-scrap').textContent = GAME.scrap;
  document.getElementById('hud-health').textContent = Math.max(0, Math.floor(GAME.baseHealth));
}

function addParticle(x, y, color, speed, life) {
  if (saveManager.data.options.particles === 'low' && Math.random() > 0.3) return;
  const ang = Math.random() * Math.PI * 2;
  const v = Math.random() * speed;
  GAME.particles.push({ x, y, vx: Math.cos(ang)*v, vy: Math.sin(ang)*v, life, maxLife: life, color });
}

function spawnEnemy() {
  const ang = Math.random() * Math.PI * 2;
  const r = GAME.floeRadius + 50;
  const hp = 20 + GAME.wave * 10;
  GAME.enemies.push({
    x: GAME.cx + Math.cos(ang)*r,
    y: GAME.cy + Math.sin(ang)*r,
    hp: hp, maxHp: hp, speed: 20 + GAME.wave * 2,
    radius: 12
  });
}

function shake(amt) {
  const mult = parseFloat(saveManager.data.options.shake);
  if (mult === 0) return;
  const s = amt * mult;
  document.getElementById('game-canvas').style.transform = `translate(${(Math.random()-0.5)*s}px, ${(Math.random()-0.5)*s}px)`;
  setTimeout(()=> document.getElementById('game-canvas').style.transform = 'none', 50);
}

function buildTower(x, y) {
  const type = TOWER_TYPES[GAME.player.selectedType];
  if (GAME.scrap < type.cost) { audio.sfxError(); return; }

  const distToBase = Math.hypot(x - GAME.cx, y - GAME.cy);
  if (distToBase > GAME.floeRadius - 15) { audio.sfxError(); return; } // outside floe
  if (distToBase < 30) { audio.sfxError(); return; } // on base

  // check overlap
  for (let t of GAME.towers) {
    if (Math.hypot(x - t.x, y - t.y) < 20) { audio.sfxError(); return; }
  }

  GAME.scrap -= type.cost;
  GAME.towers.push({ x, y, type: GAME.player.selectedType, cd: 0, radius: 10 });
  audio.sfxBuild();
  for(let i=0;i<10;i++) addParticle(x, y, type.color, 50, 0.5);
  updateHUD();
}

function updatePlaying(dt) {
  // Input logic
  let dx = 0, dy = 0;
  if (input.keys['ArrowUp'] || input.keys['w']) dy -= 1;
  if (input.keys['ArrowDown'] || input.keys['s']) dy += 1;
  if (input.keys['ArrowLeft'] || input.keys['a']) dx -= 1;
  if (input.keys['ArrowRight'] || input.keys['d']) dx += 1;

  if (input.touch.jx !== 0 || input.touch.jy !== 0) {
    dx = input.touch.jx; dy = input.touch.jy;
  }

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    GAME.player.x += (dx/len) * 300 * dt;
    GAME.player.y += (dy/len) * 300 * dt;
  } else if (!input.hasTouch) {
    GAME.player.x = input.mouse.x;
    GAME.player.y = input.mouse.y;
  }

  // Constrain player to floe
  const pd = Math.hypot(GAME.player.x - GAME.cx, GAME.player.y - GAME.cy);
  if (pd > GAME.floeRadius) {
    GAME.player.x = GAME.cx + (GAME.player.x - GAME.cx) / pd * GAME.floeRadius;
    GAME.player.y = GAME.cy + (GAME.player.y - GAME.cy) / pd * GAME.floeRadius;
  }

  // Tower selection input
  if (input.keys['1']) setTowerType(0);
  if (input.keys['2']) setTowerType(1);
  if (input.keys['3']) setTowerType(2);
  if (input.touch.next) { setTowerType((GAME.player.selectedType + 1) % 3); }

  // Build input
  if (input.keys[' '] || input.mouse.clicked || input.touch.build) {
    buildTower(GAME.player.x, GAME.player.y);
  }

  // Mechanics: Floe shrinking
  GAME.floeRadius -= 2 * dt;
  if (GAME.floeRadius < GAME.minFloe) GAME.floeRadius = GAME.minFloe;

  // Wave logic
  GAME.waveTimer += dt;
  GAME.spawnTimer -= dt;
  if (GAME.spawnTimer <= 0) {
    spawnEnemy();
    GAME.spawnTimer = Math.max(0.5, 2.0 - GAME.wave * 0.1);
  }
  if (GAME.waveTimer > 20) {
    GAME.wave++;
    GAME.waveTimer = 0;
    GAME.floeRadius = Math.min(360, GAME.floeRadius + 30); // small regen
    audio.playTone(600, 'square', 0.5, 0.8, 800);
    updateHUD();
  }

  // Towers
  for (let i=GAME.towers.length-1; i>=0; i--) {
    let t = GAME.towers[i];
    const def = TOWER_TYPES[t.type];

    // Destroy if floe melts under it
    if (Math.hypot(t.x - GAME.cx, t.y - GAME.cy) > GAME.floeRadius) {
      GAME.towers.splice(i, 1);
      audio.sfxExplode(); shake(5);
      for(let k=0;k<20;k++) addParticle(t.x, t.y, '#fff', 100, 1);
      continue;
    }

    t.cd -= dt;
    if (t.cd <= 0) {
      let target = null; let minDist = def.range;
      for (let e of GAME.enemies) {
        let d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d < minDist) { minDist = d; target = e; }
      }
      if (target) {
        t.cd = def.cd;
        if (def.type === 'gun') {
          audio.sfxShoot();
          GAME.projectiles.push({ x: t.x, y: t.y, tx: target.x, ty: target.y, dmg: def.dmg, speed: 500, type: 'bullet' });
        } else if (def.type === 'laser') {
          audio.sfxLaser();
          target.hp -= def.dmg;
          GAME.projectiles.push({ x: t.x, y: t.y, tx: target.x, ty: target.y, life: 0.1, type: 'laser' });
          if (target.hp <= 0) { target.dead = true; GAME.score += 10; GAME.scrap += 5; }
        } else if (def.type === 'bomb') {
          audio.sfxShoot();
          GAME.projectiles.push({ x: t.x, y: t.y, tx: target.x, ty: target.y, dmg: def.dmg, speed: 200, type: 'bomb' });
        }
      }
    }
  }

  // Projectiles
  for (let i = GAME.projectiles.length-1; i>=0; i--) {
    let p = GAME.projectiles[i];
    if (p.type === 'laser') {
      p.life -= dt; if(p.life <= 0) GAME.projectiles.splice(i, 1);
      continue;
    }

    let dx = p.tx - p.x; let dy = p.ty - p.y;
    let dist = Math.hypot(dx, dy);
    let move = p.speed * dt;
    if (move >= dist) {
      if (p.type === 'bullet') {
        for (let e of GAME.enemies) {
          if (Math.hypot(e.x - p.tx, e.y - p.ty) < e.radius + 10) {
            e.hp -= p.dmg; audio.sfxHit();
            for(let k=0;k<5;k++) addParticle(p.tx, p.ty, '#ff0', 50, 0.2);
            if (e.hp <= 0) { e.dead = true; GAME.score += 10; GAME.scrap += 5; }
            break;
          }
        }
      } else if (p.type === 'bomb') {
        audio.sfxExplode(); shake(3);
        for (let e of GAME.enemies) {
          if (Math.hypot(e.x - p.tx, e.y - p.ty) < 60) {
            e.hp -= p.dmg;
            if (e.hp <= 0) { e.dead = true; GAME.score += 10; GAME.scrap += 5; }
          }
        }
        for(let k=0;k<15;k++) addParticle(p.tx, p.ty, '#fa0', 150, 0.5);
      }
      GAME.projectiles.splice(i, 1);
    } else {
      p.x += (dx/dist)*move; p.y += (dy/dist)*move;
    }
  }

  // Enemies
  for (let i = GAME.enemies.length-1; i>=0; i--) {
    let e = GAME.enemies[i];
    if (e.dead) {
      GAME.enemies.splice(i, 1); updateHUD();
      for(let k=0;k<10;k++) addParticle(e.x, e.y, '#0f0', 80, 0.4);
      continue;
    }
    let dx = GAME.cx - e.x; let dy = GAME.cy - e.y;
    let dist = Math.hypot(dx, dy);
    if (dist < 30) {
      GAME.baseHealth -= 10; audio.sfxHit(); shake(5);
      GAME.enemies.splice(i, 1); updateHUD();
      for(let k=0;k<10;k++) addParticle(e.x, e.y, '#f00', 100, 0.5);
    } else {
      e.x += (dx/dist) * e.speed * dt;
      e.y += (dy/dist) * e.speed * dt;
    }
  }

  // Particles
  for (let i = GAME.particles.length-1; i>=0; i--) {
    let p = GAME.particles[i];
    p.life -= dt;
    if (p.life <= 0) GAME.particles.splice(i, 1);
    else { p.x += p.vx * dt; p.y += p.vy * dt; }
  }

  if (GAME.baseHealth <= 0) {
    state = 'GAME_OVER'; audio.stopMusic(); audio.sfxExplode(); shake(20);
    const res = saveManager.recordRun(GAME.score, GAME.wave);
    document.getElementById('go-score').textContent = GAME.score;
    document.getElementById('go-wave').textContent = GAME.wave;
    document.getElementById('go-new-high').style.display = res.newHigh ? 'block' : 'none';
    const ms = document.getElementById('go-milestones');
    ms.innerHTML = res.newlyUnlocked.length ? 'Unlocked: ' + res.newlyUnlocked.join(', ') : '';
    setUI('ui-game-over');
    updateTouchUI();
  }
}

function draw() {
  // Clear
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-color');
  ctx.fillRect(0, 0, input.vp.w, input.vp.h);

  ctx.save();
  ctx.translate(input.vp.ox, input.vp.oy);
  ctx.scale(input.vp.scale, input.vp.scale);

  // Water / Base
  ctx.beginPath();
  ctx.arc(GAME.cx, GAME.cy, GAME.floeRadius, 0, Math.PI*2);
  const grad = ctx.createRadialGradient(GAME.cx, GAME.cy, 0, GAME.cx, GAME.cy, GAME.floeRadius);
  grad.addColorStop(0, '#e0f7fa'); grad.addColorStop(1, '#80deea');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#006064'; ctx.stroke();

  // Draw Base
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(GAME.cx, GAME.cy, 30, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = `hsl(${GAME.baseHealth * 1.2}, 100%, 50%)`;
  ctx.beginPath(); ctx.arc(GAME.cx, GAME.cy, 20, 0, Math.PI*2); ctx.fill();

  // Towers
  for (let t of GAME.towers) {
    const def = TOWER_TYPES[t.type];
    ctx.fillStyle = def.color;
    ctx.fillRect(t.x - 8, t.y - 8, 16, 16);
    ctx.strokeStyle = '#fff'; ctx.strokeRect(t.x - 8, t.y - 8, 16, 16);
  }

  // Enemies
  for (let e of GAME.enemies) {
    ctx.fillStyle = '#0f0';
    ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#f00';
    ctx.fillRect(e.x - e.radius, e.y - e.radius - 5, e.radius*2 * (e.hp/e.maxHp), 3);
  }

  // Projectiles
  for (let p of GAME.projectiles) {
    if (p.type === 'laser') {
      ctx.strokeStyle = '#f55'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
    } else {
      ctx.fillStyle = p.type === 'bomb' ? '#fa0' : '#ff0';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.type==='bomb'?4:2, 0, Math.PI*2); ctx.fill();
    }
  }

  // Particles
  for (let p of GAME.particles) {
    ctx.fillStyle = p.color; ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player / Cursor
  if (state === 'PLAYING') {
    const def = TOWER_TYPES[GAME.player.selectedType];
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(GAME.player.x, GAME.player.y, def.range, 0, Math.PI*2); ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(GAME.player.x - 8, GAME.player.y - 8, 16, 16);
    ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    ctx.strokeRect(GAME.player.x - 10, GAME.player.y - 10, 20, 20);
  }

  ctx.restore();
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (state === 'PLAYING') { updatePlaying(dt); }
  draw();
  if (input) input.clear();
}

document.addEventListener('visibilitychange', () => { if(document.hidden && state === 'PLAYING') document.getElementById('btn-pause').click(); });
window.addEventListener('blur', () => { if(state === 'PLAYING') document.getElementById('btn-pause').click(); });

window.onload = init;
