window.addEventListener('DOMContentLoaded', () => {
  // --- BASE ENGINE AND MANAGERS PLACEHOLDER ---


  class SaveManager {
    constructor() {
      this.key = 'arcade_game_049_049-volcanic-time-forge_v1';
      this.data = {
        highScore: 0,
        bestWaveOrCombo: 0,
        totalGamesPlayed: 0,
        totalScoreAccumulated: 0,
        unlockedMilestones: [],
        options: {
          mute: false,
          sfxVol: 80,
          musicVol: 50,
          shake: 1,
          particles: 1
        }
      };
      this.load();
    }
    load() {
      try {
        const stored = localStorage.getItem(this.key);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
        }
      } catch (e) {
        console.warn('SaveManager load error:', e);
      }
    }
    save() {
      try {
        localStorage.setItem(this.key, JSON.stringify(this.data));
      } catch (e) {
        console.warn('SaveManager save error:', e);
      }
    }
    export() {
      return btoa(JSON.stringify(this.data));
    }
    importData(b64) {
      try {
        const parsed = JSON.parse(atob(b64));
        if (parsed && typeof parsed === 'object') {
          this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
          this.save();
          return true;
        }
      } catch (e) {
        console.warn('Import failed');
      }
      return false;
    }
    reset() {
      this.data = { highScore: 0, bestWaveOrCombo: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0, unlockedMilestones: [], options: this.data.options };
      this.save();
    }
  }



  class SoundEngine {
    constructor(saveMgr) {
      this.saveMgr = saveMgr;
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.updateVolumes();

      this.nextNoteTime = 0;
      this.arpIndex = 0;
      this.arpNotes = [150, 200, 300, 250];
      this.isPlaying = false;
    }

    updateVolumes() {
      const opts = this.saveMgr.data.options;
      this.masterGain.gain.value = opts.mute ? 0 : 1;
      this.sfxGain.gain.value = opts.sfxVol / 100;
      this.musicGain.gain.value = (opts.musicVol / 100) * 0.3; // music slightly quieter
    }

    resume() {
      if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playTone(freq, type, duration, vol=1) {
      if (!this.ctx || this.masterGain.gain.value === 0) return;
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
    }

    playNoise(duration, vol=1) {
      if (!this.ctx || this.masterGain.gain.value === 0) return;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      noise.start();
    }

    sfxShoot() { this.playTone(400, 'square', 0.1, 0.3); }
    sfxHit() { this.playNoise(0.2, 0.5); }
    sfxBuild() { this.playTone(600, 'sine', 0.15, 0.6); }
    sfxError() { this.playTone(150, 'sawtooth', 0.2, 0.4); }
    sfxGameOver() {
        this.playTone(200, 'sawtooth', 0.5, 0.5);
        setTimeout(() => this.playTone(150, 'sawtooth', 1.0, 0.5), 500);
    }

    startMusic() {
      this.isPlaying = true;
      this.nextNoteTime = this.ctx.currentTime + 0.1;
      this.scheduleMusic();
    }
    stopMusic() {
      this.isPlaying = false;
    }
    scheduleMusic() {
      if (!this.isPlaying) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = this.arpNotes[this.arpIndex];

        gain.gain.setValueAtTime(0.5, this.nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.nextNoteTime + 0.15);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(this.nextNoteTime);
        osc.stop(this.nextNoteTime + 0.15);

        this.nextNoteTime += 0.25; // tempo
        this.arpIndex = (this.arpIndex + 1) % this.arpNotes.length;
      }
      this.musicTimer = setTimeout(() => this.scheduleMusic(), 25);
    }
  }



  class InputManager {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = {};
      this.mouse = { x: 0, y: 0, down: false, click: false };
      this.touch = { active: false, dpad: { x: 0, y: 0 }, action: false };
      this.isInteracting = false; // For time-dilation

      window.addEventListener('keydown', (e) => { this.keys[e.code] = true; this.isInteracting = true; });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

      canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
      canvas.addEventListener('mousedown', (e) => { this.updateMouse(e); this.mouse.down = true; this.isInteracting = true; });
      canvas.addEventListener('mouseup', (e) => { this.mouse.down = false; this.mouse.click = true; });

      // Touch generic
      canvas.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch.active = true; this.isInteracting = true; this.handleTouch(e); }, {passive: false});
      canvas.addEventListener('touchmove', (e) => { e.preventDefault(); this.handleTouch(e); }, {passive: false});
      canvas.addEventListener('touchend', (e) => { e.preventDefault(); this.mouse.click = true; this.mouse.down = false; }, {passive: false});

      // Virtual Mobile Controls
      const vDpad = document.getElementById('virtual-dpad');
      const vThumb = document.getElementById('virtual-thumb');
      const vAction = document.getElementById('virtual-action');
      let dpadId = null;

      if(vDpad && vAction) {
        vDpad.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch.active = true; dpadId = e.changedTouches[0].identifier; this.updateDpad(e.changedTouches[0], vDpad, vThumb); }, {passive:false});
        vDpad.addEventListener('touchmove', (e) => { e.preventDefault(); for(let t of e.changedTouches) if(t.identifier === dpadId) this.updateDpad(t, vDpad, vThumb); }, {passive:false});
        vDpad.addEventListener('touchend', (e) => { e.preventDefault(); for(let t of e.changedTouches) if(t.identifier === dpadId) { dpadId = null; this.touch.dpad = {x:0, y:0}; vThumb.style.transform = `translate(0px, 0px)`; } }, {passive:false});
        vAction.addEventListener('touchstart', (e) => { e.preventDefault(); this.touch.active = true; this.touch.action = true; this.isInteracting = true; }, {passive:false});
        vAction.addEventListener('touchend', (e) => { e.preventDefault(); this.touch.action = false; }, {passive:false});
      }
    }

    updateMouse(e) {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    }

    handleTouch(e) {
        if(e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (e.touches[0].clientX - rect.left) * scaleX;
            this.mouse.y = (e.touches[0].clientY - rect.top) * scaleY;
            this.mouse.down = true;
        }
    }

    updateDpad(t, el, thumb) {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = t.clientX - centerX;
        let dy = t.clientY - centerY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const maxDist = rect.width / 2 - thumb.offsetWidth / 2;
        if(dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        thumb.style.transform = `translate(${dx}px, ${dy}px)`;
        this.touch.dpad.x = dx / maxDist;
        this.touch.dpad.y = dy / maxDist;
        this.isInteracting = true;
    }

    getAxis() {
      let dx = 0, dy = 0;
      if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
      if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
      if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
      if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;

      if(dx === 0 && dy === 0) {
          dx = this.touch.dpad.x;
          dy = this.touch.dpad.y;
      }
      return { x: dx, y: dy };
    }

    isActionPressed() {
      return this.keys['Space'] || this.keys['Enter'] || this.touch.action || this.mouse.click;
    }

    resetFrame() {
      this.mouse.click = false;
      this.isInteracting = false; // Reset interaction flag every frame

      // If holding keys, keep interacting true
      const axis = this.getAxis();
      if(axis.x !== 0 || axis.y !== 0 || this.mouse.down || this.touch.action) {
          this.isInteracting = true;
      }
    }
  }


  // Entities
  class Particle {
      constructor(x, y, vx, vy, color, life) {
          this.x = x; this.y = y; this.vx = vx; this.vy = vy;
          this.color = color; this.life = life; this.maxLife = life;
          this.size = Math.random() * 4 + 2;
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
          ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
          ctx.globalAlpha = 1;
      }
  }

  class Bullet {
      constructor(x, y, target, damage) {
          this.x = x; this.y = y;
          const dx = target.x - x; const dy = target.y - y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const speed = 500;
          this.vx = (dx/dist) * speed;
          this.vy = (dy/dist) * speed;
          this.damage = damage;
          this.active = true;
          this.radius = 4;
      }
          update(dt) {
          this.x += this.vx * dt;
          this.y += this.vy * dt;
      }
      draw(ctx) {
          ctx.fillStyle = '#ff8800';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
          ctx.fill();
      }
  }

  class Tower {
      constructor(x, y) {
          this.x = x; this.y = y;
          this.radius = 15;
          this.range = 250;
          this.cooldown = 0;
          this.fireRate = 0.5; // seconds per shot
          this.damage = 25;
      }
      update(dt, enemies, bullets, sound) {
          if (this.cooldown > 0) this.cooldown -= dt;
          if (this.cooldown <= 0) {
              let target = null;
              let minDist = this.range;
              for (const e of enemies) {
                  const dist = Math.hypot(e.x - this.x, e.y - this.y);
                  if (dist < minDist) { minDist = dist; target = e; }
              }
              if (target) {
                  bullets.push(new Bullet(this.x, this.y, target, this.damage));
                  this.cooldown = this.fireRate;
                  sound.sfxShoot();
              }
          }
      }
      draw(ctx) {
          ctx.fillStyle = '#7f5598';
          ctx.beginPath();
          ctx.moveTo(this.x, this.y - this.radius);
          ctx.lineTo(this.x + this.radius, this.y + this.radius);
          ctx.lineTo(this.x - this.radius, this.y + this.radius);
          ctx.fill();

          ctx.strokeStyle = '#f0e6d2';
          ctx.lineWidth = 2;
          ctx.stroke();
      }
  }

  class Enemy {
      constructor(wave, targetX, targetY) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 800; // spawn outside
          this.x = targetX + Math.cos(angle) * dist;
          this.y = targetY + Math.sin(angle) * dist;
          this.hp = 50 + (wave * 20);
          this.maxHp = this.hp;
          this.speed = 40 + (wave * 5);
          this.radius = 12;
          this.targetX = targetX;
          this.targetY = targetY;
          this.active = true;
          this.frozen = false;
          this.freezeTimer = 0;
      }
          update(dt) {
          if (this.frozen) {
              this.freezeTimer -= dt;
              if (this.freezeTimer <= 0) this.frozen = false;
              return;
          }
          const dx = this.targetX - this.x;
          const dy = this.targetY - this.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist > 5) {
              this.x += (dx/dist) * this.speed * dt;
              this.y += (dy/dist) * this.speed * dt;
          }
      }
      draw(ctx) {
          ctx.fillStyle = this.frozen ? '#88ccff' : '#ff3333';
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.stroke();

          // HP bar
          ctx.fillStyle = '#000';
          ctx.fillRect(this.x - 10, this.y - 20, 20, 4);
          ctx.fillStyle = '#0f0';
          ctx.fillRect(this.x - 10, this.y - 20, 20 * (this.hp / this.maxHp), 4);
      }
  }

  class GameEngine {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.lastTime = 0;
      this.state = 'TITLE';
      this.logicalWidth = 1280;
      this.logicalHeight = 720;
      this.setupCanvas();

      this.save = new SaveManager();
      this.sound = new SoundEngine(this.save);
      this.input = new InputManager(this.canvas);

      this.core = { x: this.logicalWidth/2, y: this.logicalHeight/2, radius: 40 };
      this.cursor = { x: this.logicalWidth/2, y: this.logicalHeight/2 };

      this.resetGameData();
      this.bindUI();

    }
    setupCanvas() {
      const resize = () => {
        const aspect = this.logicalWidth / this.logicalHeight;
        const windowAspect = window.innerWidth / window.innerHeight;
        if (windowAspect > aspect) {
          this.canvas.style.height = '100%';
          this.canvas.style.width = `${window.innerHeight * aspect}px`;
        } else {
          this.canvas.style.width = '100%';
          this.canvas.style.height = `${window.innerWidth / aspect}px`;
        }
        this.canvas.width = this.logicalWidth;
        this.canvas.height = this.logicalHeight;

        const vControls = document.getElementById('mobile-controls');
        if(window.innerWidth < 800 || (this.input && this.input.touch.active)) {
            vControls.style.display = 'flex';
        } else {
            vControls.style.display = 'none';
        }
      };
      window.addEventListener('resize', resize);
      resize();
      new ResizeObserver(resize).observe(document.getElementById('game-container'));
    }
    start() {
      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    resetGameData() {
        this.score = 0;
        this.wave = 1;
        this.energy = 100;
        this.maxEnergy = 200;
        this.towers = [];
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.waveTimer = 3.0;
        this.enemiesToSpawn = 5;
        this.canBuildTimer = 0;
        this.gameTime = 0;
        this.shakeTimer = 0;
    }

    spawnParticles(x, y, count, color) {
        const pCount = Math.floor(count * this.save.data.options.particles);
        for(let i=0; i<pCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 100 + 50;
            this.particles.push(new Particle(x, y, Math.cos(angle)*speed, Math.sin(angle)*speed, color, Math.random()*0.5 + 0.2));
        }
    }

    triggerGameOver() {
        this.state = 'GAME_OVER';
        this.sound.stopMusic();
        this.sound.sfxGameOver();
        this.shakeTimer = 0.5;

        this.save.data.totalGamesPlayed++;
        this.save.data.totalScoreAccumulated += this.score;
        if(this.wave > this.save.data.bestWaveOrCombo) this.save.data.bestWaveOrCombo = this.wave;

        let isHighScore = false;
        if(this.score > this.save.data.highScore) {
            this.save.data.highScore = this.score;
            isHighScore = true;
        }

        // Milestones
        if(this.wave >= 5 && !this.save.data.unlockedMilestones.includes('wave5')) this.save.data.unlockedMilestones.push('wave5');
        if(this.wave >= 10 && !this.save.data.unlockedMilestones.includes('wave10')) this.save.data.unlockedMilestones.push('wave10');
        if(this.score >= 1000 && !this.save.data.unlockedMilestones.includes('score1k')) this.save.data.unlockedMilestones.push('score1k');

        this.save.save();
        this.showScreen('screen-gameover');

        document.getElementById('go-wave').innerText = this.wave;
        document.getElementById('go-score').innerText = this.score;
        document.getElementById('go-highscore-msg').style.display = isHighScore ? 'block' : 'none';
    }

    updateHUD() {
        document.getElementById('hud-wave').innerText = this.wave;
        document.getElementById('hud-score').innerText = this.score;
        document.getElementById('hud-energy').innerText = Math.floor(this.energy);
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if(id) document.getElementById(id).classList.add('active');
        document.getElementById('hud').style.display = (id === null && this.state === 'PLAYING') ? 'flex' : 'none';
    }

    bindUI() {
        document.getElementById('title-highscore').innerText = this.save.data.highScore;

        const playBtn = () => {
            this.sound.resume();
            this.resetGameData();
            this.state = 'PLAYING';
            this.showScreen(null);
            this.sound.startMusic();
        };
        document.getElementById('btn-play').addEventListener('click', playBtn);
        document.getElementById('btn-playagain').addEventListener('click', playBtn);
        document.getElementById('btn-restart').addEventListener('click', playBtn);

        document.getElementById('btn-howto').addEventListener('click', () => { this.sound.resume(); this.showScreen('screen-howto'); });
        document.getElementById('btn-howto-close').addEventListener('click', () => { this.showScreen(this.state === 'PAUSED' ? 'screen-paused' : 'screen-title'); });

        document.getElementById('btn-title').addEventListener('click', () => {
            this.state = 'TITLE';
            document.getElementById('title-highscore').innerText = this.save.data.highScore;
            this.showScreen('screen-title');
        });

        document.getElementById('btn-pause').addEventListener('click', () => {
            if(this.state === 'PLAYING') {
                this.state = 'PAUSED';
                this.showScreen('screen-paused');
            }
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.state = 'PLAYING';
            this.showScreen(null);
        });

        const openOpts = () => { this.sound.resume(); this.syncOptionsUI(); this.showScreen('screen-options'); };
        document.getElementById('btn-options-title').addEventListener('click', openOpts);
        document.getElementById('btn-options-pause').addEventListener('click', openOpts);
        document.getElementById('btn-options-close').addEventListener('click', () => {
            this.save.save();
            this.showScreen(this.state === 'PAUSED' ? 'screen-paused' : 'screen-title');
        });

        // Options logic
        const mute = document.getElementById('opt-mute');
        const sfx = document.getElementById('opt-sfx');
        const mus = document.getElementById('opt-music');
        const shake = document.getElementById('opt-shake');
        const part = document.getElementById('opt-particles');

        mute.addEventListener('change', (e) => { this.save.data.options.mute = e.target.checked; this.sound.updateVolumes(); });
        sfx.addEventListener('input', (e) => { this.save.data.options.sfxVol = parseInt(e.target.value); this.sound.updateVolumes(); this.sound.sfxShoot(); });
        mus.addEventListener('input', (e) => { this.save.data.options.musicVol = parseInt(e.target.value); this.sound.updateVolumes(); });
        shake.addEventListener('change', (e) => { this.save.data.options.shake = parseFloat(e.target.value); });
        part.addEventListener('change', (e) => { this.save.data.options.particles = parseFloat(e.target.value); });

        document.getElementById('btn-export-save').addEventListener('click', () => {
            navigator.clipboard.writeText(this.save.export()).then(() => alert('Save copied to clipboard!'));
        });
        document.getElementById('btn-import-save').addEventListener('click', () => {
            const b64 = prompt('Paste save data:');
            if(b64 && this.save.importData(b64)) {
                this.syncOptionsUI();
                this.sound.updateVolumes();
                document.getElementById('title-highscore').innerText = this.save.data.highScore;
                alert('Save imported!');
            } else if (b64) {
                alert('Invalid save data.');
            }
        });

        const resetBtn = document.getElementById('btn-reset-save');
        let resetConfirm = false;
        resetBtn.addEventListener('click', () => {
            if(!resetConfirm) {
                resetConfirm = true;
                resetBtn.innerText = 'Click again to confirm reset';
                setTimeout(() => { resetConfirm = false; resetBtn.innerText = 'Reset Save'; }, 3000);
            } else {
                this.save.reset();
                this.syncOptionsUI();
                document.getElementById('title-highscore').innerText = this.save.data.highScore;
                resetConfirm = false;
                resetBtn.innerText = 'Reset Save';
                alert('Save wiped.');
            }
        });

        // Auto pause on blur/hidden
        window.addEventListener('blur', () => { if(this.state === 'PLAYING') document.getElementById('btn-pause').click(); });
        document.addEventListener('visibilitychange', () => { if(document.hidden && this.state === 'PLAYING') document.getElementById('btn-pause').click(); });
    }

    syncOptionsUI() {
        document.getElementById('opt-mute').checked = this.save.data.options.mute;
        document.getElementById('opt-sfx').value = this.save.data.options.sfxVol;
        document.getElementById('opt-music').value = this.save.data.options.musicVol;
        document.getElementById('opt-shake').value = this.save.data.options.shake;
        document.getElementById('opt-particles').value = this.save.data.options.particles;
    }

    loop(timestamp) {
      let dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      this.update(dt);
      this.draw();

      if(this.input) this.input.resetFrame();
      requestAnimationFrame((t) => this.loop(t));
    }

        update(dt) {
      if (this.state !== 'PLAYING') return;

      // Time-Dilation Mechanic
      let timeScale = 0.05; // Time stands mostly still
      if (this.input.isInteracting) {
          timeScale = 1.0; // Normal speed when moving/acting
      }
      let activeDt = dt * timeScale;

      this.gameTime += activeDt;

      // Shake reduction
      if (this.shakeTimer > 0) {
          this.shakeTimer -= dt;
      }

      // Player Movement (Cursor)
      const axis = this.input.getAxis();
      const speed = 400; // cursor is not affected by time dilation for smooth feel, but moving it causes dilation
      this.cursor.x += axis.x * speed * dt;
      this.cursor.y += axis.y * speed * dt;
      if (this.input.mouse.x !== 0 || this.input.mouse.y !== 0) {
          // If mouse moved, snap cursor
          // Only snap if we aren't predominantly using gamepad/keyboard
          if (axis.x === 0 && axis.y === 0) {
              this.cursor.x = this.input.mouse.x;
              this.cursor.y = this.input.mouse.y;
          }
      }
      // clamp cursor
      this.cursor.x = Math.max(0, Math.min(this.logicalWidth, this.cursor.x));
      this.cursor.y = Math.max(0, Math.min(this.logicalHeight, this.cursor.y));

      // Building
      if (this.input.isActionPressed() && this.energy >= 50 && this.canBuildTimer <= 0) {
          // check if near core or other towers
          const distToCore = Math.hypot(this.cursor.x - this.core.x, this.cursor.y - this.core.y);
          if (distToCore > this.core.radius + 20) {
              this.towers.push(new Tower(this.cursor.x, this.cursor.y));
              this.energy -= 50;
              this.sound.sfxBuild();
              this.spawnParticles(this.cursor.x, this.cursor.y, 10, '#7f5598');
              this.canBuildTimer = 0.5; // build cooldown
          } else {
              this.sound.sfxError();
              this.canBuildTimer = 0.5;
          }
      }
      if (this.canBuildTimer > 0) this.canBuildTimer -= dt;

      // Energy recharge
      this.energy += 5 * activeDt;
      if (this.energy > this.maxEnergy) this.energy = this.maxEnergy;

      // Spawning
      this.waveTimer -= activeDt;
      if (this.waveTimer <= 0 && this.enemiesToSpawn > 0) {
          this.enemies.push(new Enemy(this.wave, this.core.x, this.core.y));
          this.enemiesToSpawn--;
          this.waveTimer = 1.0 - (this.wave * 0.05);
          if (this.waveTimer < 0.2) this.waveTimer = 0.2;
      }

      if (this.enemies.length === 0 && this.enemiesToSpawn <= 0) {
          this.wave++;
          this.enemiesToSpawn = 5 + (this.wave * 3);
          this.waveTimer = 3.0; // break between waves
          this.energy += 20; // bonus
      }

      // Towers
      for (const t of this.towers) t.update(activeDt, this.enemies, this.bullets, this.sound);

      // Bullets & Collisions
      for (let i = this.bullets.length - 1; i >= 0; i--) {
          const b = this.bullets[i];
          b.update(activeDt);
          if (b.x < 0 || b.x > this.logicalWidth || b.y < 0 || b.y > this.logicalHeight) {
              this.bullets.splice(i, 1);
              continue;
          }
          for (const e of this.enemies) {
              if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + b.radius) {
                  e.hp -= b.damage;
                  this.bullets.splice(i, 1);
                  this.sound.sfxHit();
                  this.spawnParticles(b.x, b.y, 5, '#ff8800');
                  break;
              }
          }
      }

      // Enemies
      for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          e.update(activeDt);

          if (e.hp <= 0) {
              this.score += 10 * this.wave;
              this.energy += 2;
              this.spawnParticles(e.x, e.y, 15, '#ff3333');
              this.enemies.splice(i, 1);
              continue;
          }

          // Core Collision
          if (Math.hypot(e.x - this.core.x, e.y - this.core.y) < e.radius + this.core.radius) {
              this.triggerGameOver();
              break;
          }
      }

      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
          this.particles[i].update(activeDt);
          if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }

      this.updateHUD();
    }

    draw() {
      // Clear
      this.ctx.fillStyle = '#1a0f14';
      this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

      // Shake
      this.ctx.save();
      if (this.shakeTimer > 0) {
          const mag = this.save.data.options.shake * 10 * (this.shakeTimer / 0.5);
          const dx = (Math.random() - 0.5) * mag;
          const dy = (Math.random() - 0.5) * mag;
          this.ctx.translate(dx, dy);
      }

      // Volcanic Environment (Background decor)
      this.ctx.fillStyle = '#2a0a0a';
      this.ctx.beginPath();
      this.ctx.arc(this.logicalWidth/2, this.logicalHeight/2, 400, 0, Math.PI*2);
      this.ctx.fill();

      // Time Dilation Visuals
      if (this.state === 'PLAYING') {
          if (!this.input.isInteracting) {
              this.ctx.fillStyle = 'rgba(127, 85, 152, 0.1)'; // Purple tint for slomo
              this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
              this.ctx.fillStyle = '#7f5598';
              this.ctx.font = '24px monospace';
              this.ctx.fillText('TIME DILATION ACTIVE - MOVE TO ACCELERATE', 20, this.logicalHeight - 30);
          }
      }

      // Core
      this.ctx.fillStyle = '#ff8800';
      this.ctx.shadowColor = '#ff8800';
      this.ctx.shadowBlur = 20;
      this.ctx.beginPath();
      this.ctx.arc(this.core.x, this.core.y, this.core.radius, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 3;
      this.ctx.stroke();

      // Entities
      for (const t of this.towers) t.draw(this.ctx);
      for (const e of this.enemies) e.draw(this.ctx);
      for (const b of this.bullets) b.draw(this.ctx);
      for (const p of this.particles) p.draw(this.ctx);

      // Cursor
      if (this.state === 'PLAYING') {
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.arc(this.cursor.x, this.cursor.y, 250, 0, Math.PI*2); // Tower range preview
          this.ctx.stroke();

          this.ctx.fillStyle = '#fff';
          this.ctx.fillRect(this.cursor.x - 2, this.cursor.y - 10, 4, 20);
          this.ctx.fillRect(this.cursor.x - 10, this.cursor.y - 2, 20, 4);
      }

      this.ctx.restore();
    }


  }



  const engine = new GameEngine();
  engine.start();

});