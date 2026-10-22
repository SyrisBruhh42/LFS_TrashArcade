// Orbital Echo Tactics - Core Logic

const SaveManager = {
  key: 'arcade_game_068_068-orbital-echo-tactics_v1',
  data: {
    highScore: 0,
    totalGamesPlayed: 0,
    options: {
      masterVol: 1.0,
      sfxVol: 1.0,
      musicVol: 1.0,
      screenShake: 1.0,
      particles: 'high',
      highContrast: false,
      showFps: false,
      touchControls: 'auto',
      handedness: 'right'
    },
    milestones: []
  },
  load: function() {
    try {
      const stored = localStorage.getItem(this.key);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.data.highScore = parsed.highScore !== undefined ? parsed.highScore : this.data.highScore;
        this.data.totalGamesPlayed = parsed.totalGamesPlayed !== undefined ? parsed.totalGamesPlayed : this.data.totalGamesPlayed;
        this.data.milestones = parsed.milestones || this.data.milestones;
        if (parsed.options) {
            this.data.options = { ...this.data.options, ...parsed.options };
        }
      }
    } catch(e) { console.warn("Save load failed", e); }
  },
  save: function() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch(e) { console.warn("Save failed", e); }
  }
};

const ParallaxBG = {
  layers: [],
  init: function() {
    this.layers = [
      { speed: 10, items: [], type: 'star' }, // Distant stars
      { speed: 30, items: [], type: 'debris' }, // Space debris
      { speed: 70, items: [], type: 'strut' }  // Station struts
    ];
    for (let i = 0; i < 50; i++) this.spawnItem(this.layers[0], true);
    for (let i = 0; i < 20; i++) this.spawnItem(this.layers[1], true);
    for (let i = 0; i < 5; i++)  this.spawnItem(this.layers[2], true);
  },
  spawnItem: function(layer, initial = false) {
    const ww = window.innerWidth;
    const hh = window.innerHeight;
    const x = initial ? Math.random() * ww : ww + 50;
    const y = Math.random() * hh;

    if (layer.type === 'star') {
      layer.items.push({ x, y, size: Math.random() * 2 + 1, alpha: Math.random() * 0.5 + 0.1 });
    } else if (layer.type === 'debris') {
      layer.items.push({ x, y, size: Math.random() * 4 + 2, rot: Math.random() * Math.PI * 2, vrot: (Math.random() - 0.5) * 2 });
    } else if (layer.type === 'strut') {
      layer.items.push({ x, y, w: Math.random() * 100 + 50, h: Math.random() * 300 + 100 });
    }
  },
  update: function(dt) {


    const ww = window.innerWidth;
    for (let layer of this.layers) {
      for (let i = layer.items.length - 1; i >= 0; i--) {
        let item = layer.items[i];
        item.x -= layer.speed * dt;
        if (layer.type === 'debris') item.rot += item.vrot * dt;

        // Remove if off screen
        if (layer.type === 'star' || layer.type === 'debris') {
           if (item.x < -20) layer.items.splice(i, 1);
        } else if (layer.type === 'strut') {
           if (item.x + item.w < -20) layer.items.splice(i, 1);
        }
      }

      // Respawn
      let expected = layer.type === 'star' ? 50 : (layer.type === 'debris' ? 20 : 5);
      if (layer.items.length < expected && Math.random() < 0.1) {
        this.spawnItem(layer);
      }
    }
  },
  draw: function(ctx, w, h) {
    for (let layer of this.layers) {
      if (layer.type === 'star') {
        ctx.fillStyle = '#fff';
        for (let s of layer.items) {
          ctx.globalAlpha = s.alpha;
          ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1.0;
      } else if (layer.type === 'debris') {
        ctx.fillStyle = '#666';
        for (let d of layer.items) {
          ctx.save();
          ctx.translate(d.x, d.y);
          ctx.rotate(d.rot);
          ctx.fillRect(-d.size/2, -d.size/2, d.size, d.size);
          ctx.restore();
        }
      } else if (layer.type === 'strut') {
        ctx.fillStyle = 'rgba(34, 40, 49, 0.5)';
        for (let st of layer.items) {
          ctx.fillRect(st.x, st.y, st.w, st.h);
        }
      }
    }
  }
};

class Conveyor {
  constructor(x, y, dx, dy) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.animTimer = 0;
  }
  update(dt) {
    this.animTimer += dt * 5;
  }
  draw(ctx) {
    ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
    ctx.fillRect(this.x * GRID_SIZE, this.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);

    // Draw arrows
    ctx.strokeStyle = 'rgba(52, 152, 219, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    let cx = this.x * GRID_SIZE + GRID_SIZE/2;
    let cy = this.y * GRID_SIZE + GRID_SIZE/2;

    let offset = (this.animTimer % 1) * GRID_SIZE/2;

    if (this.dx > 0) {
      ctx.moveTo(cx - GRID_SIZE/4 + offset, cy - GRID_SIZE/4);
      ctx.lineTo(cx + offset, cy);
      ctx.lineTo(cx - GRID_SIZE/4 + offset, cy + GRID_SIZE/4);
    } else if (this.dx < 0) {
      ctx.moveTo(cx + GRID_SIZE/4 - offset, cy - GRID_SIZE/4);
      ctx.lineTo(cx - offset, cy);
      ctx.lineTo(cx + GRID_SIZE/4 - offset, cy + GRID_SIZE/4);
    } else if (this.dy > 0) {
      ctx.moveTo(cx - GRID_SIZE/4, cy - GRID_SIZE/4 + offset);
      ctx.lineTo(cx, cy + offset);
      ctx.lineTo(cx + GRID_SIZE/4, cy - GRID_SIZE/4 + offset);
    } else if (this.dy < 0) {
      ctx.moveTo(cx - GRID_SIZE/4, cy + GRID_SIZE/4 - offset);
      ctx.lineTo(cx, cy - offset);
      ctx.lineTo(cx + GRID_SIZE/4, cy + GRID_SIZE/4 - offset);
    }
    ctx.stroke();
  }
}

class LaserTrap {
  constructor(x, y, isHorizontal) {
    this.x = x;
    this.y = y;
    this.isHorizontal = isHorizontal;
    this.turnCounter = 0; // fires when turnCounter % 3 === 0
    this.isFiring = false;
    this.fireTimer = 0;
  }
  update(dt) {
    if (this.isFiring) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.isFiring = false;
      }
    }
  }
  fire() {
    this.isFiring = true;
    this.fireTimer = 0.5;
  }
  draw(ctx) {
    // Emitter base
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(this.x * GRID_SIZE + 4, this.y * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);

    // Laser beam
    if (this.isFiring) {
      ctx.fillStyle = `rgba(231, 76, 60, ${Math.random() * 0.5 + 0.5})`;
      if (this.isHorizontal) {
        ctx.fillRect((this.x + 1) * GRID_SIZE, this.y * GRID_SIZE + GRID_SIZE/2 - 4, COLS * GRID_SIZE, 8);
      } else {
        ctx.fillRect(this.x * GRID_SIZE + GRID_SIZE/2 - 4, (this.y + 1) * GRID_SIZE, 8, ROWS * GRID_SIZE);
      }
    } else {
      // Warning line
      if (this.turnCounter % 3 === 2) {
        ctx.fillStyle = `rgba(241, 196, 15, ${Math.random() * 0.3 + 0.2})`;
        if (this.isHorizontal) {
          ctx.fillRect((this.x + 1) * GRID_SIZE, this.y * GRID_SIZE + GRID_SIZE/2 - 2, COLS * GRID_SIZE, 4);
        } else {
          ctx.fillRect(this.x * GRID_SIZE + GRID_SIZE/2 - 2, (this.y + 1) * GRID_SIZE, 4, ROWS * GRID_SIZE);
        }
      }
    }
  }
}


const SoundEngine = {
  ctx: null,
  masterGain: null,
  musicGain: null,
  sfxGain: null,
  bgmOscillators: [],
  percussionInterval: null,
  arpeggiatorInterval: null,
  isPlayingBgm: false,
  musicFilter: null,
  currentTempo: 120, // BPM
  isBoss: false,
  isLowHp: false,

  init: function() {
    if (this.ctx) return;
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.5;

      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = 0.3;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = 0.6;

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 2000;
      this.musicFilter.connect(this.musicGain);

      this.updateVolumes();

    } catch(e) { console.warn("Web Audio API not supported", e); }
  },
  resume: function() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  updateGameState: function(isBoss, isLowHp) {
    if (this.isBoss !== isBoss || this.isLowHp !== isLowHp) {
        this.isBoss = isBoss;
        this.isLowHp = isLowHp;
        this.applyDynamicMix();
    }
  },

  applyDynamicMix: function() {
    if (!this.ctx) return;
    let targetFilterFreq = 2000;
    let targetTempo = 100;

    if (this.isBoss) {
        targetTempo = 140;
        targetFilterFreq = 4000;
    } else if (this.isLowHp) {
        targetTempo = 80;
        targetFilterFreq = 800; // Muffled
    }

    this.currentTempo = targetTempo;
    this.musicFilter.frequency.setTargetAtTime(targetFilterFreq, this.ctx.currentTime, 0.5);

    this.restartBgm(); // Restart intervals with new tempo
  },

  startBgm: function() {
    if (this.isPlayingBgm || !this.ctx) return;
    this.isPlayingBgm = true;
    this.restartBgm();
  },

  restartBgm: function() {
    if (!this.isPlayingBgm || !this.ctx) return;
    this.stopBgmLoops();

    const beatDuration = 60 / this.currentTempo;

    // Percussion Loop
    let beatCount = 0;
    this.percussionInterval = setInterval(() => {
        if (SaveManager.data.options.masterVol === 0 || SaveManager.data.options.musicVol === 0) return;
        this.playKick();
        if (beatCount % 2 === 1) {
            setTimeout(() => this.playSnare(), beatDuration * 500); // 8th note offset roughly
        }
        if (beatCount % 4 === 0) {
            this.playHat();
        }
        beatCount++;
    }, beatDuration * 1000);

    // Arpeggiator Loop
    let arpIndex = 0;
    const baseNotes = [220, 261.63, 329.63, 392.00]; // A minor pentatonic ish
    const bossNotes = [196, 233.08, 293.66, 349.23]; // G minor

    this.arpeggiatorInterval = setInterval(() => {
        if (SaveManager.data.options.masterVol === 0 || SaveManager.data.options.musicVol === 0) return;

        let notes = this.isBoss ? bossNotes : baseNotes;
        let freq = notes[arpIndex % notes.length];
        if (this.isBoss && arpIndex % 3 === 0) freq *= 2; // octave jump
        if (this.isLowHp) freq /= 2; // pitch down

        this.playSynthNote(freq, beatDuration * 0.5);
        arpIndex++;
    }, beatDuration * 1000 / 2); // 8th notes
  },

  stopBgmLoops: function() {
      if (this.percussionInterval) clearInterval(this.percussionInterval);
      if (this.arpeggiatorInterval) clearInterval(this.arpeggiatorInterval);
      this.percussionInterval = null;
      this.arpeggiatorInterval = null;
  },

  stopBgm: function() {
    this.isPlayingBgm = false;
    this.stopBgmLoops();
  },

  playSynthNote: function(freq, duration) {
      if (!this.ctx || SaveManager.data.options.masterVol === 0) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.isBoss ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + duration * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.musicFilter);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
  },

  playKick: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.musicFilter);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
  },

  playSnare: function() {
      if (!this.ctx) return;
      // White noise for snare
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 1000;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

      noise.connect(noiseFilter);
      noiseFilter.connect(gain);
      gain.connect(this.musicFilter);
      noise.start();
  },

  playHat: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(8000, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicFilter);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
  },

  playTone: function(freq, type, duration, vol=0.1) {
    if (!this.ctx || SaveManager.data.options.masterVol === 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },

  // Custom SFX methods replacing the simple tones
  playMove: function() {
      this.playTone(400, 'sine', 0.1, 0.05);
  },
  playEchoMove: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
  },
  playHit: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
  },
  playDestroy: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
  },
  playGameOver: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 1.0);
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.0);
  },
  playDash: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
  },
  playDashImpact: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
  },
  playPickup: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
  },
  playUIHover: function() {
      this.playTone(800, 'sine', 0.05, 0.05);
  },
  playUIClick: function() {
      this.playTone(1200, 'triangle', 0.1, 0.1);
  },
  playUpgrade: function() {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
  }
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
    mapTouch('btn-dash', 'ShiftLeft');
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


class DamagePopup {
  constructor(x, y, amount, color) {
    this.x = x * GRID_SIZE + GRID_SIZE/2;
    this.y = y * GRID_SIZE;
    this.amount = amount;
    this.color = color;
    this.life = 1.0;
  }
}


class MotionTrailManager {
  constructor() {
    this.trails = [];
  }
  add(x, y, dx, dy, color) {
    this.trails.push(new DashTrail(x, y, dx, dy, color));
  }
  update(dt) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      this.trails[i].update(dt);
      if (this.trails[i].life <= 0) {
        this.trails.splice(i, 1);
      }
    }
  }
  draw(ctx) {
    for (let t of this.trails) {
      t.draw(ctx);
    }
  }
}
class DashTrail {
  constructor(x, y, dx, dy, color) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
    this.life = 0.5;
  }
  update(dt) {
    this.life -= dt;
  }
  draw(ctx) {
    if (this.life <= 0) return;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.life * 2;
    // draw a streak
    ctx.beginPath();
    ctx.moveTo(this.x * GRID_SIZE + GRID_SIZE/2, this.y * GRID_SIZE + GRID_SIZE/2);
    ctx.lineTo(this.x * GRID_SIZE + GRID_SIZE/2 - this.dx * GRID_SIZE * (1-this.life*2), this.y * GRID_SIZE + GRID_SIZE/2 - this.dy * GRID_SIZE * (1-this.life*2));
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.color;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }
}

class Pickup extends Entity {
  constructor(x, y, color) {
    super(x, y, color);
    this.wobble = 0;
  }
  update(dt) {
    super.update(dt);
    this.wobble += dt * 5;
  }
  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cy = ry + Math.sin(this.wobble) * 3;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(rx + GRID_SIZE/2, cy + GRID_SIZE/2, GRID_SIZE/4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }
}

class ComboRestorer extends Pickup {
  constructor(x, y) {
    super(x, y, '#f39c12');
  }
  onPickup(engine) {
    engine.comboDecayTimer = engine.maxComboDecay;
    engine.spawnParticles(this.x, this.y, this.color);
  }
}

class ExtraPointsPickup extends Pickup {
  constructor(x, y) {
    super(x, y, '#2ecc71');
  }
  onPickup(engine) {
    engine.score += Math.floor(500 * engine.comboMultiplier);
    engine.spawnParticles(this.x, this.y, this.color);
  }
}

class Player extends Entity {
  constructor(x, y) {
    super(x, y, '#cf7cd4');
    this.history = []; // Array of {x, y}
    this.historyLength = 4; // How far back the echo is

    // Phase 2 features
    this.dashCooldown = 0;
    this.dashMaxCooldown = 3; // turns
    this.dashDamage = 2;
    this.dashRange = 2;
    this.dashInvulnDuration = 0.3;
    this.overdriveActive = false;
    this.facingX = 1;
    this.facingY = 0;

    // Animations
    this.recoilTimer = 0;
    this.thrustTimer = 0;
    this.invulnTimer = 0;
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

  update(dt) {
    super.update(dt);
    if (this.recoilTimer > 0) this.recoilTimer -= dt;
    if (this.thrustTimer > 0) this.thrustTimer -= dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
  }

  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cx = rx + GRID_SIZE / 2;
    const cy = ry + GRID_SIZE / 2;

    ctx.save();
    ctx.translate(cx, cy);

    // Recoil shake
    if (this.recoilTimer > 0) {
      const shakeAmt = this.recoilTimer * 20;
      ctx.translate((Math.random()-0.5)*shakeAmt, (Math.random()-0.5)*shakeAmt);
    }

    // Blink if invuln
    if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }

    // Rotate to facing
    const angle = Math.atan2(this.facingY, this.facingX);
    ctx.rotate(angle);

    // Thruster trail
    if (this.thrustTimer > 0) {
      ctx.fillStyle = '#f39c12';
      ctx.beginPath();
      ctx.moveTo(-GRID_SIZE/2, -5);
      ctx.lineTo(-GRID_SIZE/2 - 10 - Math.random()*10, 0);
      ctx.lineTo(-GRID_SIZE/2, 5);
      ctx.fill();
    }

    // Procedural multi-part sprite
    ctx.fillStyle = this.color;

    // Core body
    ctx.fillRect(-GRID_SIZE/2 + 4, -GRID_SIZE/2 + 4, GRID_SIZE - 8, GRID_SIZE - 8);

    // Nose cone / aim telegraph
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(GRID_SIZE/2 - 4, -8);
    ctx.lineTo(GRID_SIZE/2 + 6, 0);
    ctx.lineTo(GRID_SIZE/2 - 4, 8);
    ctx.fill();

    // Overdrive glow
    if (this.overdriveActive) {
      ctx.strokeStyle = '#3498db';
      ctx.lineWidth = 2;
      ctx.strokeRect(-GRID_SIZE/2 + 2, -GRID_SIZE/2 + 2, GRID_SIZE - 4, GRID_SIZE - 4);
      ctx.beginPath();
      ctx.arc(0, 0, GRID_SIZE/2 + 4, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.restore();
  }

}


class Enemy extends Entity {
  constructor(x, y, color = '#e74c3c') {
    super(x, y, color);
    this.hp = 1;
    this.type = 'Enemy';
    this.telegraph = false; // generic telegraph
  }

  takeTurn(engine) {
    // Default AI: move towards player
    let dx = engine.player.x - this.x;
    let dy = engine.player.y - this.y;

    let stepX = 0, stepY = 0;

    if (Math.abs(dx) > Math.abs(dy)) {
      stepX = dx > 0 ? 1 : -1;
    } else if (Math.abs(dy) > 0) {
      stepY = dy > 0 ? 1 : -1;
    }

    const nx = this.x + stepX;
    const ny = this.y + stepY;

    if (!engine.isSolid(nx, ny) && !engine.getEnemyAt(nx, ny) && (nx !== engine.player.x || ny !== engine.player.y)) {
      this.moveTo(nx, ny);
    }
  }

  draw(ctx) {
    // Override draw for generic fallback
    super.draw(ctx);
  }
}

class Swarmer extends Enemy {
  constructor(x, y) {
    super(x, y, '#e74c3c');
    this.type = 'Swarmer';
  }

  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cx = rx + GRID_SIZE / 2;
    const cy = ry + GRID_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -GRID_SIZE/2 + 4);
    ctx.lineTo(GRID_SIZE/2 - 4, 0);
    ctx.lineTo(0, GRID_SIZE/2 - 4);
    ctx.lineTo(-GRID_SIZE/2 + 4, 0);
    ctx.fill();
    ctx.restore();
  }
}

class ShieldBruiser extends Enemy {
  constructor(x, y) {
    super(x, y, '#9b59b6');
    this.hp = 2;
    this.type = 'ShieldBruiser';
    this.turnCounter = 0;
  }

  takeTurn(engine) {
    this.turnCounter++;
    if (this.turnCounter % 2 === 0) {
      // Moves every 2 turns
      super.takeTurn(engine);
    }
  }

  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cx = rx + GRID_SIZE / 2;
    const cy = ry + GRID_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = this.color;
    ctx.fillRect(-GRID_SIZE/2 + 8, -GRID_SIZE/2 + 8, GRID_SIZE - 16, GRID_SIZE - 16);
    if (this.hp > 1) {
      ctx.strokeStyle = '#2980b9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-GRID_SIZE/2 + 4, -GRID_SIZE/2 + 4, GRID_SIZE - 8, GRID_SIZE - 8);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class RangedSniper extends Enemy {
  constructor(x, y) {
    super(x, y, '#f1c40f');
    this.type = 'RangedSniper';
    this.telegraphing = false;
    this.aimX = 0;
    this.aimY = 0;
  }

  takeTurn(engine) {
    if (this.telegraphing) {
      // Fire instantly
      this.telegraphing = false;
      let currX = this.x + this.aimX;
      let currY = this.y + this.aimY;
      while (!engine.isSolid(currX, currY)) {
        engine.spawnParticles(currX, currY, '#f1c40f'); // Draw laser path via particles
        if (currX === engine.player.x && currY === engine.player.y && engine.player.invulnTimer <= 0) {
           engine.spawnParticles(engine.player.x, engine.player.y, engine.player.color);
           engine.gameOver();
        }
        currX += this.aimX;
        currY += this.aimY;
      }
    } else {
      // Check if aligned with player
      let dx = engine.player.x - this.x;
      let dy = engine.player.y - this.y;
      if ((dx === 0 || dy === 0) && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        // Can see player, start telegraphing
        this.telegraphing = true;
        this.aimX = dx === 0 ? 0 : Math.sign(dx);
        this.aimY = dy === 0 ? 0 : Math.sign(dy);
      } else {
        // Move towards player, or if too close move away?
        // simple: just use super
        super.takeTurn(engine);
      }
    }
  }

  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cx = rx + GRID_SIZE / 2;
    const cy = ry + GRID_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -GRID_SIZE/2 + 6);
    ctx.lineTo(GRID_SIZE/2 - 6, GRID_SIZE/2 - 6);
    ctx.lineTo(-GRID_SIZE/2 + 6, GRID_SIZE/2 - 6);
    ctx.fill();

    // Draw telegraph line
    if (this.telegraphing) {
       ctx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.moveTo(0, 0);
       ctx.lineTo(this.aimX * GRID_SIZE * 15, this.aimY * GRID_SIZE * 15);
       ctx.stroke();
    }
    ctx.restore();
  }
}

class Splitter extends Enemy {
  constructor(x, y) {
    super(x, y, '#2ecc71');
    this.type = 'Splitter';
  }

  onDeath(engine) {
    // spawn 2 swarmers if spaces available
    const dirs = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
    let spawned = 0;
    for(let d of dirs) {
      if(spawned >= 2) break;
      const nx = this.x + d.dx;
      const ny = this.y + d.dy;
      if (!engine.isSolid(nx, ny) && !engine.getEnemyAt(nx, ny) && (nx !== engine.player.x || ny !== engine.player.y)) {
         engine.enemies.push(new Swarmer(nx, ny));
         spawned++;
      }
    }
  }

  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cx = rx + GRID_SIZE / 2;
    const cy = ry + GRID_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(-4, -4, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, 4, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
}

class AreaDenialHazard extends Enemy {
  constructor(x, y) {
    super(x, y, '#e67e22');
    this.type = 'AreaDenialHazard';
  }

  takeTurn(engine) {
    let oldX = this.x;
    let oldY = this.y;
    // Move away from player if close, else random
    let dx = this.x - engine.player.x;
    let dy = this.y - engine.player.y;
    let stepX = 0, stepY = 0;
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
      if (Math.abs(dx) > Math.abs(dy)) {
        stepX = dx > 0 ? 1 : -1;
      } else {
        stepY = dy > 0 ? 1 : -1;
      }
    } else {
       // Random move
       const dirs = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
       let d = dirs[Math.floor(Math.random() * dirs.length)];
       stepX = d.dx;
       stepY = d.dy;
    }

    const nx = this.x + stepX;
    const ny = this.y + stepY;
    if (!engine.isSolid(nx, ny) && !engine.getEnemyAt(nx, ny) && (nx !== engine.player.x || ny !== engine.player.y)) {
      this.moveTo(nx, ny);
      // Drop hazard pool where it was
      engine.acidPools = engine.acidPools || [];
      engine.acidPools.push({x: oldX, y: oldY, turns: 3});
    }
  }

  draw(ctx) {
    const rx = this.getRenderX();
    const ry = this.getRenderY();
    const cx = rx + GRID_SIZE / 2;
    const cy = ry + GRID_SIZE / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    const sides = 8;
    for(let i=0; i<sides; i++) {
       const ang = (i / sides) * Math.PI * 2;
       const px = Math.cos(ang) * (GRID_SIZE/2 - 4);
       const py = Math.sin(ang) * (GRID_SIZE/2 - 4);
       if (i === 0) ctx.moveTo(px, py);
       else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.restore();
  }
}



class Boss extends Enemy {
  constructor(x, y, color) {
    super(x, y, color);
    this.type = 'Boss';
    this.isBoss = true;
    this.maxHp = 10;
    this.hp = this.maxHp;
    this.phase = 1;
  }

  checkPhaseTransition(engine) {
    if (this.hp <= this.maxHp / 2 && this.phase === 1) {
      this.phase = 2;
      this.onPhaseTransition(engine);
    }
  }

  onPhaseTransition(engine) {
    // Override in subclasses
    engine.spawnParticles(this.x, this.y, '#ffffff');
    SoundEngine.playHit();
  }
}

class OrbitalWarden extends Boss {
  constructor(x, y) {
    super(x, y, '#e67e22');
    this.type = 'OrbitalWarden';
    this.maxHp = 12;
    this.hp = this.maxHp;
    this.turnCounter = 0;
  }

  takeTurn(engine) {
    this.turnCounter++;
    this.checkPhaseTransition(engine);

    if (this.phase === 1) {
      // Phase 1: Move towards player or spawn a Swarmer occasionally
      if (this.turnCounter % 4 === 0) {
         // Spawn Swarmer
         let s = new Swarmer(this.x, this.y);
         // Find a valid spot near boss
         for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
               if (dx === 0 && dy === 0) continue;
               if (!engine.isSolid(this.x + dx, this.y + dy) && !engine.getEnemyAt(this.x + dx, this.y + dy)) {
                   s.x = this.x + dx; s.y = this.y + dy;
                   engine.enemies.push(s);
                   return; // End turn
               }
            }
         }
      } else {
         super.takeTurn(engine); // normal move
      }
    } else {
       // Phase 2: Teleport near player, drop LaserTrap
       if (this.turnCounter % 3 === 0) {
          let placed = false;
          // Teleport
          for(let i=0; i<5; i++) {
             let tx = engine.player.x + (Math.floor(Math.random() * 5) - 2);
             let ty = engine.player.y + (Math.floor(Math.random() * 5) - 2);
             if (!engine.isSolid(tx, ty) && !engine.getEnemyAt(tx, ty)) {
                 engine.spawnParticles(this.x, this.y, '#e67e22');
                 this.moveTo(tx, ty);
                 this.x = tx; this.y = ty;
                 placed = true;
                 break;
             }
          }
          if (placed) {
              // drop a laser trap here before or after moving? Let's drop it at old pos
              // Actually drop it at random empty spot
              let isHor = Math.random() > 0.5;
              engine.lasers.push(new LaserTrap(this.x, this.y, isHor));
          }
       } else {
          super.takeTurn(engine);
       }
    }
  }

  onPhaseTransition(engine) {
    super.onPhaseTransition(engine);
    // Spawn immediate swarmers
    engine.spawnParticles(this.x, this.y, '#e74c3c');
  }

  draw(ctx) {
     super.draw(ctx);
     // Draw a crown or symbol
     ctx.fillStyle = '#f1c40f';
     let rx = this.getRenderX();
     let ry = this.getRenderY();
     ctx.fillRect(rx + GRID_SIZE/2 - 4, ry - 4, 8, 4);
  }
}

class EchoNullifier extends Boss {
  constructor(x, y) {
    super(x, y, '#9b59b6');
    this.type = 'EchoNullifier';
    this.maxHp = 14;
    this.hp = this.maxHp;
    this.turnCounter = 0;
  }

  takeTurn(engine) {
    this.turnCounter++;
    this.checkPhaseTransition(engine);
    const echoPos = engine.player.getEchoPos();

    if (this.phase === 1) {
       // Phase 1: Hunt player, drop acid pools
       if (this.turnCounter % 3 === 0) {
          engine.acidPools.push({x: this.x, y: this.y, turns: 6});
       }
       super.takeTurn(engine);
    } else {
       // Phase 2: Explicitly hunt the Echo instead of Player
       if (echoPos) {
           let dx = echoPos.x - this.x;
           let dy = echoPos.y - this.y;

           let stepX = 0, stepY = 0;
           if (Math.abs(dx) > Math.abs(dy)) {
               stepX = dx > 0 ? 1 : -1;
           } else if (Math.abs(dy) > 0) {
               stepY = dy > 0 ? 1 : -1;
           }

           const nx = this.x + stepX;
           const ny = this.y + stepY;

           if (!engine.isSolid(nx, ny) && !engine.getEnemyAt(nx, ny)) {
               this.moveTo(nx, ny);
           }
       } else {
           super.takeTurn(engine);
       }

       if (this.turnCounter % 2 === 0) {
           engine.acidPools.push({x: this.x, y: this.y, turns: 8});
       }
    }
  }

  draw(ctx) {
     super.draw(ctx);
     ctx.strokeStyle = '#8e44ad';
     ctx.lineWidth = 2;
     let rx = this.getRenderX();
     let ry = this.getRenderY();
     ctx.strokeRect(rx + 4, ry + 4, GRID_SIZE - 8, GRID_SIZE - 8);
  }
}

const Engine = {
  state: 'TITLE',
  lastTime: 0,
  score: 0,
  wave: 1,

  comboMultiplier: 1.0,
  comboDecayTimer: 0,
  maxComboDecay: 5.0,
  comboMax: 3.0,
  upgrades: [],
  availableUpgrades: [
    'Reduced Dash Cooldown',
    'Increased Combo Duration',
    'Dash Damage Plus One',
    'Echo Length Plus One',
    'Invuln After Dash Plus One Sec',
    'Combo Multiplier Cap Plus One',
    'Dash Range Plus One',
    'Wave Start Bomb'
  ],
  pickups: [],

  hitStopTimer: 0,
  cameraShakeTimer: 0,
  cameraShakeIntensity: 0,
  damagePopups: [],

  cameraShake: function(duration, intensity) {
    this.cameraShakeTimer = duration;
    this.cameraShakeIntensity = intensity * (SaveManager.data.options.screenShake !== undefined ? SaveManager.data.options.screenShake : 1.0);
  },

  selectUpgrade: function(upgradeName) {
    this.applyUpgrade(upgradeName);
    document.getElementById('screen-upgrade').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'PLAYING';
    this.initLevel();
    this.updateHUD();
  },
  applyUpgrade: function(upgradeName) {
    SoundEngine.playUpgrade();
    this.upgrades.push(upgradeName);
    switch(upgradeName) {
      case 'Reduced Dash Cooldown':
        this.player.dashMaxCooldown = Math.max(1, this.player.dashMaxCooldown - 1);
        break;
      case 'Increased Combo Duration':
        this.maxComboDecay += 2.0;
        break;
      case 'Dash Damage Plus One':
        this.player.dashDamage += 1;
        break;
      case 'Echo Length Plus One':
        this.player.historyLength += 1;
        break;
      case 'Invuln After Dash Plus One Sec':
        this.player.dashInvulnDuration += 1.0;
        break;
      case 'Combo Multiplier Cap Plus One':
        this.comboMax += 1.0;
        break;
      case 'Dash Range Plus One':
        this.player.dashRange += 1;
        break;
      case 'Wave Start Bomb':
        // Wave Start Bomb will be triggered in initLevel
        break;
    }
  },

  init: function() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    ParallaxBG.init();

    SaveManager.load();
    document.getElementById('title-highscore').innerText = SaveManager.data.highScore;
    this.updateTouchControlsVisibility();
    this.updateMilestonesUI();

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

    // Settings UI Binding
    const settingsScreen = document.getElementById('screen-settings');
    const saveDataIO = document.getElementById('saveDataIO');
    let resetClicks = 0;

    document.getElementById('btn-settings').addEventListener('click', () => {
       settingsScreen.classList.remove('hidden');
       document.getElementById('masterVol').value = SaveManager.data.options.masterVol ?? 1.0;
       document.getElementById('sfxVol').value = SaveManager.data.options.sfxVol ?? 1.0;
       document.getElementById('musicVol').value = SaveManager.data.options.musicVol ?? 1.0;
       document.getElementById('screenShake').value = (SaveManager.data.options.screenShake ?? 1.0).toString();
       document.getElementById('particles').value = SaveManager.data.options.particles || 'high';
       document.getElementById('highContrast').checked = !!SaveManager.data.options.highContrast;
       document.getElementById('showFps').checked = !!SaveManager.data.options.showFps;
       document.getElementById('touchControls').value = SaveManager.data.options.touchControls || 'auto';
       document.getElementById('handedness').value = SaveManager.data.options.handedness || 'right';
       resetClicks = 0;
       document.getElementById('btn-reset-save').innerText = 'Reset Data (Click Twice)';
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
       settingsScreen.classList.add('hidden');
       SaveManager.data.options.masterVol = parseFloat(document.getElementById('masterVol').value);
       SaveManager.data.options.sfxVol = parseFloat(document.getElementById('sfxVol').value);
       SaveManager.data.options.musicVol = parseFloat(document.getElementById('musicVol').value);
       SaveManager.data.options.screenShake = parseFloat(document.getElementById('screenShake').value);
       SaveManager.data.options.particles = document.getElementById('particles').value;
       SaveManager.data.options.highContrast = document.getElementById('highContrast').checked;
       SaveManager.data.options.showFps = document.getElementById('showFps').checked;
       SaveManager.data.options.touchControls = document.getElementById('touchControls').value;
       SaveManager.data.options.handedness = document.getElementById('handedness').value;
       SaveManager.save();
       SoundEngine.updateVolumes();
       if(this.updateTouchControlsVisibility) this.updateTouchControlsVisibility();
    });

    document.getElementById('btn-export-save').addEventListener('click', () => {
       saveDataIO.value = btoa(JSON.stringify(SaveManager.data));
    });

    document.getElementById('btn-import-save').addEventListener('click', () => {
       try {
          const parsed = JSON.parse(atob(saveDataIO.value));
          if (parsed && parsed.options) {
             SaveManager.data = { ...SaveManager.data, ...parsed };
             SaveManager.save();
             alert('Save imported successfully! Reloading...');
             location.reload();
          }
       } catch (e) {
          alert('Invalid save data');
       }
    });

    document.getElementById('btn-reset-save').addEventListener('click', () => {
       resetClicks++;
       if (resetClicks === 1) {
          document.getElementById('btn-reset-save').innerText = 'Are you sure? Click again.';
       } else if (resetClicks >= 2) {
          localStorage.removeItem(SaveManager.key);
          location.reload();
       }
    });


    // Auto-pause
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pause();
    });
    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') this.pause();
    });

    requestAnimationFrame(t => this.loop(t));
  },


  updateMilestonesUI: function() {
    const renderBadges = (containerId) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      if (!SaveManager.data.milestones) SaveManager.data.milestones = [];
      SaveManager.data.milestones.forEach(m => {
        const span = document.createElement('span');
        span.innerText = m;
        span.style.background = 'var(--accent)';
        span.style.color = '#000';
        span.style.padding = '2px 5px';
        span.style.margin = '2px';
        span.style.borderRadius = '3px';
        span.style.fontSize = '0.8rem';
        span.style.display = 'inline-block';
        container.appendChild(span);
      });
    };
    renderBadges('title-milestones');
    renderBadges('go-milestones');
  },

  grantMilestone: function(name) {
    if (!SaveManager.data.milestones) SaveManager.data.milestones = [];
    if (!SaveManager.data.milestones.includes(name)) {
      SaveManager.data.milestones.push(name);
      SaveManager.save();
    }
  },

  updateTouchControlsVisibility: function() {
    const touchControls = document.getElementById('touch-controls');
    const setting = SaveManager.data.options.touchControls || 'auto';
    let show = false;

    if (setting === 'always') show = true;
    else if (setting === 'auto') show = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    else show = false;

    if (show && this.state === 'PLAYING') {
      touchControls.classList.remove('hidden');
    } else {
      touchControls.classList.add('hidden');
    }

    if (SaveManager.data.options.handedness === 'left') {
      touchControls.style.flexDirection = 'row-reverse';
    } else {
      touchControls.style.flexDirection = 'row';
    }
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

    this.updateTouchControlsVisibility();
  },

  start: function() {
    SoundEngine.startBgm();
    this.state = 'PLAYING';
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.remove('hidden');
    this.updateTouchControlsVisibility();

    this.score = 0;
    this.wave = 1;
    this.comboMultiplier = 1.0;
    this.comboMax = 3.0;
    this.maxComboDecay = 5.0;
    this.comboDecayTimer = 5.0;
    this.upgrades = [];

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
    this.trailManager = new MotionTrailManager();
    this.conveyors = [];
    this.lasers = [];
    this.acidPools = [];
    this.pickups = [];

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
    const enemyTypes = [Swarmer, ShieldBruiser, RangedSniper, Splitter, AreaDenialHazard];

    for(let i=0; i<numEnemies; i++) {
      let ex, ey;
      do {
        ex = 1 + Math.floor(Math.random() * (COLS-2));
        ey = 1 + Math.floor(Math.random() * (ROWS-2));
      } while(
        this.isSolid(ex, ey) ||
        (Math.abs(ex - this.player.x) < 3 && Math.abs(ey - this.player.y) < 3)
      );

      // Pick random enemy type
      let EType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      // First wave mostly swarmers
      if (this.wave === 1) EType = Swarmer;

      this.enemies.push(new EType(ex, ey));
    }


    // Spawn Hazards
    const numHazards = Math.min(2 + Math.floor(this.wave / 2), 5);

    // Boss Spawning Logic
    if (this.wave % 5 === 0) {
       this.bossWarningTimer = 3.0; // 3 seconds banner
       let bX = Math.floor(COLS/2);
       let bY = 2;
       // find empty spot
       while(this.isSolid(bX, bY)) { bX++; if (bX >= COLS) { bX=1; bY++; } }

       let BossClass = (this.wave % 10 === 0) ? EchoNullifier : OrbitalWarden;
       this.enemies.push(new BossClass(bX, bY));
    }

    for(let i=0; i<numHazards; i++) {
      if (Math.random() > 0.5) {
        // Spawn Conveyor
        let cx, cy;
        do {
          cx = 1 + Math.floor(Math.random() * (COLS-2));
          cy = 1 + Math.floor(Math.random() * (ROWS-2));
        } while (this.isSolid(cx, cy) || (cx === this.player.x && cy === this.player.y));
        let dirs = [{dx:1,dy:0}, {dx:-1,dy:0}, {dx:0,dy:1}, {dx:0,dy:-1}];
        let d = dirs[Math.floor(Math.random()*dirs.length)];
        this.conveyors.push(new Conveyor(cx, cy, d.dx, d.dy));
      } else {
        // Spawn Laser
        let lx, ly;
        let isHoriz = Math.random() > 0.5;
        if (isHoriz) {
           lx = 0; // Emitter on left wall
           ly = 1 + Math.floor(Math.random() * (ROWS-2));
        } else {
           lx = 1 + Math.floor(Math.random() * (COLS-2));
           ly = 0; // Emitter on top wall
        }

        let laser = new LaserTrap(lx, ly, isHoriz);
        laser.turnCounter = Math.floor(Math.random() * 3); // Random phase
        this.lasers.push(laser);
      }
    }

    // Spawn Pickups
    const numPickups = 1 + Math.floor(Math.random() * 2);
    for(let i=0; i<numPickups; i++) {
        let px, py;
        do {
          px = 1 + Math.floor(Math.random() * (COLS-2));
          py = 1 + Math.floor(Math.random() * (ROWS-2));
        } while (this.isSolid(px, py) || (px === this.player.x && py === this.player.y) || this.getEnemyAt(px, py));

        if (Math.random() > 0.5) {
           this.pickups.push(new ComboRestorer(px, py));
        } else {
           this.pickups.push(new ExtraPointsPickup(px, py));
        }
    }

    // Apply Wave Start Bomb
    if (this.upgrades.includes('Wave Start Bomb')) {
        this.enemies.forEach(e => {
           e.hp -= 2;
           if (e.hp <= 0) {
               if (e.onDeath) e.onDeath(this);
           }
        });
        this.enemies = this.enemies.filter(e => e.hp > 0);
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
    SoundEngine.stopBgm();
    document.querySelectorAll('.overlay').forEach(el => el.classList.add('hidden'));
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('screen-title').classList.remove('hidden');
    document.getElementById('title-highscore').innerText = SaveManager.data.highScore;
    this.updateTouchControlsVisibility();
    this.updateMilestonesUI();
  },

  gameOver: function() {
    this.state = 'GAME_OVER';
    SoundEngine.stopBgm();
    document.getElementById('screen-gameover').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    this.updateTouchControlsVisibility();
    document.getElementById('go-score').innerText = this.score;

    SoundEngine.playGameOver();

    SaveManager.data.totalGamesPlayed++;
    if (this.score > SaveManager.data.highScore) {
      SaveManager.data.highScore = this.score;
    }

    this.grantMilestone('First Win');
    if (this.score >= 5000) this.grantMilestone('Score 5k');
    if (this.score >= 10000) this.grantMilestone('Score 10k');
    if (SaveManager.data.totalGamesPlayed >= 10) this.grantMilestone('Dedicated Player');

    SaveManager.save();
    this.updateMilestonesUI();
  },

  updateHUD: function() {
    document.getElementById('score-display').innerText = `Score: ${this.score}`;
    document.getElementById('wave-display').innerText = `Wave: ${this.wave}`;
    const cdEl = document.getElementById('cooldown-display');
    if (this.player && cdEl) {
      if (this.player.overdriveActive) {
        cdEl.innerText = 'Dash: ACTV';
        cdEl.style.color = '#e74c3c';
      } else if (this.player.dashCooldown > 0) {
        cdEl.innerText = `Dash: ${this.player.dashCooldown}`;
        cdEl.style.color = '#7f8c8d';
      } else {
        cdEl.innerText = 'Dash: RDY';
        cdEl.style.color = '#3498db';
      }
    }
  },


  // Extra helper for bounds checking safely
  isOutOfBounds: function(x, y) {
    if (x < 0) return true;
    if (x >= COLS) return true;
    if (y < 0) return true;
    if (y >= ROWS) return true;
    return false;
  },
  isSolid: function(x, y) {
    if(x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    for(let w of this.walls) if(w.x === x && w.y === y) return true;
    return false;
  },

  getEnemyAt: function(x, y) {
    return this.enemies.find(e => e.targetX === x && e.targetY === y);
  },

  spawnExplosion: function(x, y, color, intensity=1) {
    let count = SaveManager.data.options.particles === 'low' ? 10 : 25;
    count = Math.floor(count * intensity);
    for(let i=0; i<count; i++) {
      const speed = Math.random() * 200 + 50;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: x * GRID_SIZE + GRID_SIZE/2,
        y: y * GRID_SIZE + GRID_SIZE/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5 + Math.random() * 0.8,
        color: Math.random() > 0.5 ? color : '#ffffff'
      });
    }
  },

  spawnHitSpark: function(x, y) {
    let count = SaveManager.data.options.particles === 'low' ? 3 : 8;
    for(let i=0; i<count; i++) {
      const speed = Math.random() * 300 + 100;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: x * GRID_SIZE + GRID_SIZE/2,
        y: y * GRID_SIZE + GRID_SIZE/2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.2 + Math.random() * 0.3,
        color: '#f1c40f'
      });
    }
  },

  spawnThrusterExhaust: function(x, y, dx, dy) {
    if (SaveManager.data.options.particles === 'low') return;
    for(let i=0; i<3; i++) {
      this.particles.push({
        x: x * GRID_SIZE + GRID_SIZE/2 - (dx * GRID_SIZE/2),
        y: y * GRID_SIZE + GRID_SIZE/2 - (dy * GRID_SIZE/2),
        vx: -dx * (Math.random() * 50 + 50) + (Math.random() - 0.5) * 20,
        vy: -dy * (Math.random() * 50 + 50) + (Math.random() - 0.5) * 20,
        life: 0.3 + Math.random() * 0.2,
        color: '#3498db'
      });
    }
  },
  spawnParticles: function(x, y, color, dx = 0, dy = 0) {
    let count = SaveManager.data.options.particles === 'low' ? 5 : 10;
    for(let i=0; i<count; i++) {
      this.particles.push({
        x: x * GRID_SIZE + GRID_SIZE/2,
        y: y * GRID_SIZE + GRID_SIZE/2,
        vx: (Math.random() - 0.5) * 100 + (dx * 150),
        vy: (Math.random() - 0.5) * 100 + (dy * 150),
        life: 0.5 + Math.random() * 0.5,
        color: color
      });
    }
  },

  processPlayerTurn: function() {
    let dx = 0; let dy = 0;
    let wait = false;
    let dashToggle = false;

    if (Input.isJustPressed('ArrowUp') || Input.isJustPressed('KeyW')) dy = -1;
    else if (Input.isJustPressed('ArrowDown') || Input.isJustPressed('KeyS')) dy = 1;
    else if (Input.isJustPressed('ArrowLeft') || Input.isJustPressed('KeyA')) dx = -1;
    else if (Input.isJustPressed('ArrowRight') || Input.isJustPressed('KeyD')) dx = 1;
    else if (Input.isJustPressed('Space')) wait = true;
    else if (Input.isJustPressed('ShiftLeft')) dashToggle = true;

    if (dashToggle && this.player.dashCooldown <= 0) {
      this.player.overdriveActive = !this.player.overdriveActive;
      SoundEngine.playDash();
      this.updateHUD();
      return; // Free action
    }

    if (dx !== 0 || dy !== 0 || wait) {
      if (dx !== 0 || dy !== 0) {
         this.player.facingX = dx;
         this.player.facingY = dy;
      }

      if (this.player.overdriveActive && (dx !== 0 || dy !== 0)) {
        // Execute Dash
        this.player.overdriveActive = false;
        this.player.dashCooldown = this.player.dashMaxCooldown;
        this.player.thrustTimer = 0.3;
        this.player.invulnTimer = 0.3;

        let steps = this.player.dashRange;
        let nx = this.player.x;
        let ny = this.player.y;
        this.player.invulnTimer = this.player.dashInvulnDuration;

        for (let i = 0; i < steps; i++) {
           let tx = nx + dx;
           let ty = ny + dy;
           if (!this.isSolid(tx, ty)) {
             nx = tx;
             ny = ty;

             // Deal damage to enemies in path
             const enemy = this.getEnemyAt(nx, ny);
             if (enemy) {
               enemy.hp -= this.player.dashDamage;
               this.spawnParticles(nx, ny, enemy.color, dx, dy);
               this.hitStopTimer = 0.05;
               this.cameraShake(0.1, 5);
               this.damagePopups.push(new DamagePopup(nx, ny, this.player.dashDamage, '#f1c40f'));
               if (enemy.hp <= 0) {
                 SoundEngine.playDestroy();
                 if (enemy.onDeath) enemy.onDeath(this);
                 this.enemies = this.enemies.filter(e => e !== enemy);
                 let baseScore = enemy.isBoss ? 1000 : 100;
                 this.score += Math.floor(baseScore * this.comboMultiplier);
                 this.comboMultiplier = Math.min(this.comboMax, this.comboMultiplier + 0.1);
                 this.comboDecayTimer = this.maxComboDecay;
               } else {
                 SoundEngine.playHit();
               }
             }
           } else {
             this.player.recoilTimer = 0.2;
             SoundEngine.playHit();
             break;
           }
        }

        this.player.moveTo(nx, ny);
        this.player.recordMove(nx, ny);
        this.trailManager.add(this.player.x, this.player.y, dx, dy, '#3498db');
        SoundEngine.playDashImpact();

        this.turnState = 'ANIMATING';
        this.animTimer = 0.15;
        this.updateHUD();

      } else {
        // Normal Move
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;

        if (!wait && !this.isSolid(nx, ny) && !this.getEnemyAt(nx, ny)) {
          this.trailManager.add(this.player.x, this.player.y, dx, dy, 'rgba(207, 124, 212, 0.3)');
          this.player.moveTo(nx, ny);
          this.player.recordMove(nx, ny);
          this.player.thrustTimer = 0.15;
          this.spawnThrusterExhaust(this.player.x, this.player.y, dx, dy);
          SoundEngine.playMove();

          if(this.player.getEchoPos()) SoundEngine.playEchoMove();

          this.turnState = 'ANIMATING';
          this.animTimer = 0.15;
        } else if (wait) {
          this.player.recordMove(this.player.x, this.player.y);
          SoundEngine.playMove();
          this.turnState = 'ANIMATING';
          this.animTimer = 0.15;
        } else {
          this.player.recoilTimer = 0.15;
          SoundEngine.playHit();
        }
      }
    }
  },

  processEnvTurn: function() {
    let animRequired = false;

    // Conveyors push entities
    const entities = [this.player, ...this.enemies];
    for (let c of this.conveyors) {
      for (let ent of entities) {
        if (ent.x === c.x && ent.y === c.y) {
          let nx = ent.x + c.dx;
          let ny = ent.y + c.dy;
          if (!this.isSolid(nx, ny)) {
             // Check if pushing into another entity could be done, for simplicity just push if not solid
             let blocked = false;
             for (let e2 of entities) {
               if (e2 !== ent && e2.x === nx && e2.y === ny) blocked = true;
             }
             if (!blocked) {
               ent.moveTo(nx, ny);
               animRequired = true;
             }
          }
        }
      }
    }

    // Process acid pools
    if (this.acidPools) {
       for (let i = this.acidPools.length - 1; i >= 0; i--) {
          let p = this.acidPools[i];
          if (this.player.x === p.x && this.player.y === p.y && this.player.invulnTimer <= 0) {
             this.spawnParticles(this.player.x, this.player.y, this.player.color);
             this.gameOver();
             return;
          }
          p.turns--;
          if (p.turns <= 0) this.acidPools.splice(i, 1);
       }
    }

    // Lasers fire
    for (let l of this.lasers) {
      l.turnCounter++;
      if (l.turnCounter % 3 === 0) {
        l.fire();
        SoundEngine.playHit(); // Laser fire sound

        // Damage entities in path
        for (let i = this.enemies.length - 1; i >= 0; i--) {
           let e = this.enemies[i];
           let hit = l.isHorizontal ? (e.y === l.y) : (e.x === l.x);
           if (hit) {
             e.hp -= 2;
             this.spawnHitSpark(e.x, e.y); this.spawnParticles(e.x, e.y, e.color);
             if (e.hp <= 0) {
               SoundEngine.playDestroy();
               if (e.onDeath) e.onDeath(this);
               this.enemies.splice(i, 1);
               this.score += e.isBoss ? 500 : 50; // Points for env kill
             }
             this.updateHUD();
           }
        }

        let playerHit = l.isHorizontal ? (this.player.y === l.y) : (this.player.x === l.x);
        if (playerHit && this.player.invulnTimer <= 0) {
           this.spawnParticles(this.player.x, this.player.y, this.player.color);
           this.gameOver();
           return;
        }
      }
    }

    if (animRequired) {
      this.turnState = 'ANIMATING';
      this.animTimer = 0.15;
    } else {
      // Resolve immediately if no animations
      this.resolveTurn();
    }
  },

  processEnemyTurn: function() {
    const echoPos = this.player.getEchoPos();

    this.enemies.forEach(e => {
       if (e.takeTurn) {
         e.takeTurn(this);
       }
    });

    this.turnState = 'ANIMATING';
    this.animTimer = 0.15;
  },

  resolveTurn: function() {
    const echoPos = this.player.getEchoPos();

    // Decrease cooldown
    if (this.turnPhase === 'PLAYER_DONE' || !this.turnPhase) {
       if (this.player.dashCooldown > 0) {
           this.player.dashCooldown--;
           this.updateHUD();
       }
    }

    // Check Pickups
    if (this.pickups) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            let p = this.pickups[i];
            if (p.x === this.player.x && p.y === this.player.y) {
                p.onPickup(this);
                this.pickups.splice(i, 1);
                SoundEngine.playPickup();
            }
        }
    }

    // Check collisions
    let playerHit = false;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      let eHit = false;
      // If enemy on echo, it takes damage
      if (echoPos && e.x === echoPos.x && e.y === echoPos.y) {
         eHit = true;
      }
      // If enemy on player
      else if (e.x === this.player.x && e.y === this.player.y) {
        if (this.player.invulnTimer > 0) {
          eHit = true;
        } else {
          playerHit = true;
        }
      }

      if (eHit) {
        e.hp--;
        this.spawnHitSpark(e.x, e.y); this.spawnParticles(e.x, e.y, e.color);
        this.hitStopTimer = e.isBoss ? 0.2 : 0.05;
        this.cameraShake(e.isBoss ? 0.5 : 0.1, e.isBoss ? 15 : 5);
        this.damagePopups.push(new DamagePopup(e.x, e.y, 1, '#f1c40f'));
        SoundEngine.playDestroy();
        if (e.hp <= 0) {
           this.spawnExplosion(e.x, e.y, e.color, e.isBoss ? 2 : 1);
           if (e.onDeath) e.onDeath(this);
           this.enemies.splice(i, 1);
           let baseScore = e.isBoss ? 1000 : 100;
           this.score += Math.floor(baseScore * this.comboMultiplier);
           this.comboMultiplier = Math.min(this.comboMax, this.comboMultiplier + 0.1);
           this.comboDecayTimer = this.maxComboDecay;

           if (e.isBoss) this.grantMilestone('Boss Slayer');
           if (this.comboMultiplier >= 3.0) this.grantMilestone('Combo Master');
        } else {
           // Push back slightly? Just take damage.
           this.score += Math.floor(10 * this.comboMultiplier);
        }
        this.updateHUD();
      }
    }

    if (playerHit) {
      this.spawnExplosion(this.player.x, this.player.y, this.player.color, 1.5);
      this.spawnParticles(this.player.x, this.player.y, this.player.color);
      this.cameraShake(0.4, 20);
      this.hitStopTimer = 0.1;
      this.gameOver();
      return;
    }

    if (this.enemies.length === 0 && this.state !== 'GAME_OVER') {
      this.wave++;
      this.score += Math.floor(500 * this.comboMultiplier);

      // Upgrade Phase
      this.state = 'UPGRADE';
      document.getElementById('screen-upgrade').classList.remove('hidden');
      document.getElementById('hud').classList.add('hidden');

      // Shuffle and pick 3 upgrades
      let pool = [...this.availableUpgrades];
      pool.sort(() => Math.random() - 0.5);

      let u1 = pool[0];
      let u2 = pool[1];
      let u3 = pool[2];

      let btn1 = document.getElementById('btn-upgrade-1');
      let btn2 = document.getElementById('btn-upgrade-2');
      let btn3 = document.getElementById('btn-upgrade-3');

      btn1.innerText = u1;
      btn2.innerText = u2;
      btn3.innerText = u3;

      btn1.onclick = () => { this.selectUpgrade(u1); };
      btn2.onclick = () => { this.selectUpgrade(u2); };
      btn3.onclick = () => { this.selectUpgrade(u3); };

    } else if (this.state !== 'GAME_OVER') {
      // Toggle turns
      if (this.turnPhase === 'PLAYER_DONE') {
        this.turnPhase = 'ENEMY_DONE';
        this.processEnemyTurn();
      } else if (this.turnPhase === 'ENEMY_DONE') {
        this.turnPhase = 'ENV_DONE';
        this.processEnvTurn();
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

    if (dt > 0) {
      this.fps = this.fps ? (this.fps * 0.9 + (1/dt) * 0.1) : (1/dt);
    }

    if (this.state === 'PLAYING') {
      this.update(dt);
    }

    this.draw();
    Input.clear();
  },

  update: function(dt) {
    if (this.enemies) {
        let isBoss = this.enemies.some(e => e.isBoss);
        // Player has no HP, but they can be one hit away from death if enemies are nearby. Let's base it on enemies being very close.
        let isLowHp = false;
        if (this.player && this.state === 'PLAYING') {
            for (let e of this.enemies) {
                if (Math.abs(e.x - this.player.x) <= 2 && Math.abs(e.y - this.player.y) <= 2) {
                    isLowHp = true;
                    break;
                }
            }
        }
        SoundEngine.updateGameState(isBoss, isLowHp);
    }


    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer -= dt;
    }

    if (this.comboMultiplier > 1.0) {
       this.comboDecayTimer -= dt;
       if (this.comboDecayTimer <= 0) {
          this.comboMultiplier = 1.0;
       }
    }

    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= dt;
    }
    ParallaxBG.update(dt);
    this.player.update(dt);
    this.enemies.forEach(e => e.update(dt));
    this.conveyors.forEach(c => c.update(dt));
    this.lasers.forEach(l => l.update(dt));
    if (this.pickups) this.pickups.forEach(p => p.update(dt));

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      let dp = this.damagePopups[i];
      dp.y -= 30 * dt;
      dp.life -= dt;
      if (dp.life <= 0) this.damagePopups.splice(i, 1);
    }
    this.trailManager.update(dt);

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
        } else if (this.turnPhase === 'ENV_DONE') {
           this.resolveTurn();
        }
      }
    }
  },

  draw: function() {
    // Clear
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    if (this.cameraShakeTimer > 0) {
      this.ctx.translate((Math.random() - 0.5) * this.cameraShakeIntensity, (Math.random() - 0.5) * this.cameraShakeIntensity);
    }

    // Parallax background
    ParallaxBG.draw(this.ctx, this.canvas.width, this.canvas.height);

    if (SaveManager.data.options && SaveManager.data.options.highContrast) {
       this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
       this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

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

    // Acid Pools
    if (this.acidPools) {
      for (let p of this.acidPools) {
        this.ctx.fillStyle = 'rgba(230, 126, 34, 0.5)';
        this.ctx.fillRect(p.x * GRID_SIZE, p.y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
      }
    }

    // Hazards
    this.conveyors.forEach(c => c.draw(this.ctx));
    this.lasers.forEach(l => l.draw(this.ctx));
    if (this.pickups) this.pickups.forEach(p => p.draw(this.ctx));

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

    // Boss UI
    let boss = this.enemies.find(e => e.isBoss);
    if (boss) {
       // Health Bar
       const barW = this.canvas.width * 0.8;
       const barH = 20;
       const barX = (this.canvas.width - barW) / 2;
       const barY = 40;

       this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
       this.ctx.fillRect(barX, barY, barW, barH);
       this.ctx.strokeStyle = '#e74c3c';
       this.ctx.strokeRect(barX, barY, barW, barH);

       const hpPercent = Math.max(0, boss.hp / boss.maxHp);
       this.ctx.fillStyle = '#e74c3c';
       this.ctx.fillRect(barX, barY, barW * hpPercent, barH);

       this.ctx.fillStyle = '#fff';
       this.ctx.font = '14px Courier New';
       this.ctx.textAlign = 'center';
       this.ctx.fillText(`${boss.type} - Phase ${boss.phase}`, this.canvas.width/2, barY + 15);
       this.ctx.textAlign = 'left';
    }

    // Combo UI
    if (this.comboMultiplier > 1.0) {
       this.ctx.fillStyle = '#f39c12';
       this.ctx.font = 'bold 16px Courier New';
       this.ctx.textAlign = 'right';
       this.ctx.fillText(`COMBO x${this.comboMultiplier.toFixed(1)}`, this.canvas.width - 20, 80);

       // Decay Bar
       const barW = 100;
       const barH = 10;
       const barX = this.canvas.width - 20 - barW;
       const barY = 90;
       this.ctx.strokeStyle = '#f39c12';
       this.ctx.strokeRect(barX, barY, barW, barH);
       this.ctx.fillRect(barX, barY, barW * (this.comboDecayTimer / this.maxComboDecay), barH);
       this.ctx.textAlign = 'left';
    }

    // Boss Warning Banner
    if (this.bossWarningTimer > 0) {
       this.ctx.fillStyle = `rgba(231, 76, 60, ${Math.min(1, this.bossWarningTimer)})`;
       this.ctx.fillRect(0, this.canvas.height/2 - 40, this.canvas.width, 80);
       this.ctx.fillStyle = '#fff';
       this.ctx.font = 'bold 32px Courier New';
       this.ctx.textAlign = 'center';
       this.ctx.fillText('WARNING: BOSS INCOMING', this.canvas.width/2, this.canvas.height/2 + 10);
       this.ctx.textAlign = 'left';
    }
    this.trailManager.draw(this.ctx);

    // Particles
    this.particles.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life * 2;
      this.ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    this.ctx.globalAlpha = 1.0;

    // Damage Popups
    this.ctx.font = 'bold 20px Courier New';
    this.ctx.textAlign = 'center';
    this.damagePopups.forEach(dp => {
      this.ctx.fillStyle = dp.color;
      this.ctx.globalAlpha = Math.max(0, dp.life);
      this.ctx.fillText(dp.amount, dp.x, dp.y);
    });
    this.ctx.globalAlpha = 1.0;
    this.ctx.textAlign = 'left';

    this.ctx.restore();

    if (SaveManager.data.options && SaveManager.data.options.showFps) {
       this.ctx.fillStyle = '#fff';
       this.ctx.font = '16px Courier New';
       this.ctx.fillText(`FPS: ${Math.round(this.fps || 0)}`, 10, this.canvas.height - 20);
    }
  }
};

window.addEventListener('load', () => {
  Engine.init();
});
