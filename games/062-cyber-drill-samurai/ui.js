
class UIManager {
  constructor(game) {
    this.game = game;

    // Default options
    if (!this.game.saveManager.data.options) {
      this.game.saveManager.data.options = {
        masterMute: false,
        sfxVolume: 1.0,
        musicVolume: 1.0,
        screenShake: '100%',
        particleDensity: 'High',
        highContrast: false,
        showFPS: false,
        touchMode: 'Auto',
        handedness: 'Right'
      };
      this.game.saveManager.save();
    }
    this.options = this.game.saveManager.data.options;

    // Milestones
    if (!this.game.saveManager.data.unlockedMilestones) {
      this.game.saveManager.data.unlockedMilestones = [];
      this.game.saveManager.save();
    }

    this.milestones = [
      { id: 'first_blood', name: 'First Blood', desc: 'Score your first 1,000 points' },
      { id: 'deep_diver', name: 'Deep Diver', desc: 'Reach a depth of 500m' },
      { id: 'tether_master', name: 'Tether Master', desc: 'Reach a tether length of 50' },
      { id: 'combo_king', name: 'Combo King', desc: 'Reach a x3 Combo Multiplier' },
      { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat your first Boss' },
      { id: 'survivor', name: 'Survivor', desc: 'Survive for 1 minute' }
    ];

    this.fps = 0;
    this.frames = 0;
    this.lastFpsTime = performance.now();
  }

  update(dt) {
    // FPS Calculation
    this.frames++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastFpsTime));
      this.frames = 0;
      this.lastFpsTime = now;
    }

    // Check milestones
    if (this.game.state === 'PLAYING') {
      this.checkMilestone('first_blood', this.game.score >= 1000);
      this.checkMilestone('deep_diver', this.game.depth >= 5000); // 500m (depth is /10)
      this.checkMilestone('tether_master', this.game.tetherLength >= 50);
      this.checkMilestone('combo_king', this.game.comboMultiplier >= 3);
      this.checkMilestone('boss_slayer', this.game.bosses.length === 0 && this.game.waveCounter > 0);
      if (this.game.framesPlayed === undefined) this.game.framesPlayed = 0;
      this.game.framesPlayed++;
      this.checkMilestone('survivor', this.game.framesPlayed >= 3600); // 60 seconds at 60fps
    }
  }

  checkMilestone(id, condition) {
    if (condition && !this.game.saveManager.data.unlockedMilestones.includes(id)) {
      this.game.saveManager.data.unlockedMilestones.push(id);
      this.game.saveManager.save();
      if (this.game.vfx) {
         const m = this.milestones.find(m => m.id === id);
         this.game.vfx.addPopup(this.game.width/2, 150, "Milestone: " + (m ? m.name : id), '#a0efb8');
      }
    }
  }

  draw(ctx) {
    if (this.options.showFPS) {
      ctx.fillStyle = '#a0efb8';
      ctx.font = '16px Courier New';
      ctx.textAlign = 'right';
      ctx.fillText(`FPS: ${this.fps}`, this.game.width - 10, 50);
    }

    if (this.game.state === 'OPTIONS') {
      this.drawOptionsScreen(ctx);
    }

    if (this.game.state === 'PLAYING' && this.game.waveCounter === 0 && this.game.depth < 2000) {
       this.drawTutorial(ctx);
    }
  }

  drawTutorial(ctx) {
    const w = this.game.width;
    const cw = w / 2;
    // Let's create an elegant, non-intrusive overlay tutorial
    ctx.save();
    ctx.fillStyle = 'rgba(11, 12, 16, 0.6)';
    ctx.fillRect(cw - 200, 100, 400, 140);

    ctx.strokeStyle = '#a0efb8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cw - 200, 100, 400, 140);

    ctx.fillStyle = '#f5ca53';
    ctx.font = '20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('--- TUTORIAL ---', cw, 125);

    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText('WASD / Arrows / Touch to Move & Drill.', cw, 150);
    ctx.fillText('Drill dirt and gems to grow your Tether.', cw, 175);
    ctx.fillText('Press SPACE when Tether > 5 for a Shockwave!', cw, 200);

    // Add pulsing effect to highlight
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() * 0.005);
    ctx.fillStyle = '#a0efb8';
    ctx.fillText('Survive and dig deep!', cw, 225);

    ctx.restore();
  }

  // Extra helper to draw decorative borders for Phase 10 masterpiece polish
  drawMasterpieceBorders(ctx) {
      const w = this.game.width;
      const h = this.game.height;
      const t = performance.now();

      ctx.save();
      ctx.strokeStyle = `rgba(160, 239, 184, ${0.1 + 0.1 * Math.sin(t * 0.001)})`;
      ctx.lineWidth = 4;

      // Top left corner
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(20, 20);
      ctx.lineTo(40, 20);
      ctx.stroke();

      // Top right corner
      ctx.beginPath();
      ctx.moveTo(w - 40, 20);
      ctx.lineTo(w - 20, 20);
      ctx.lineTo(w - 20, 40);
      ctx.stroke();

      // Bottom left corner
      ctx.beginPath();
      ctx.moveTo(20, h - 40);
      ctx.lineTo(20, h - 20);
      ctx.lineTo(40, h - 20);
      ctx.stroke();

      // Bottom right corner
      ctx.beginPath();
      ctx.moveTo(w - 40, h - 20);
      ctx.lineTo(w - 20, h - 20);
      ctx.lineTo(w - 20, h - 40);
      ctx.stroke();

      ctx.restore();
  }

  drawOptionsScreen(ctx) {
    const w = this.game.width;
    const h = this.game.height;

    ctx.fillStyle = 'rgba(11, 12, 16, 0.95)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#a0efb8';
    ctx.font = '30px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('OPTIONS', w/2, 50);

    ctx.font = '20px Courier New';
    ctx.fillStyle = '#c5c6c7';

    const opts = [
      {label: "Master Mute: " + (this.options.masterMute ? "ON" : "OFF"), y: 100},
      {label: "SFX Vol: " + Math.round(this.options.sfxVolume * 100) + "%", y: 140},
      {label: "Music Vol: " + Math.round(this.options.musicVolume * 100) + "%", y: 180},
      {label: "Screen Shake: " + this.options.screenShake, y: 220},
      {label: "Particles: " + this.options.particleDensity, y: 260},
      {label: "High Contrast: " + (this.options.highContrast ? "ON" : "OFF"), y: 300},
      {label: "Show FPS: " + (this.options.showFPS ? "ON" : "OFF"), y: 340},
      {label: "Touch Mode: " + this.options.touchMode, y: 380},
      {label: "Handedness: " + this.options.handedness, y: 420},
      {label: "Export Save (Base64)", y: 480},
      {label: "Import Save", y: 520},
      {label: "Reset Save Data", y: 580, color: '#f14668'}
    ];

    opts.forEach(opt => {
      ctx.fillStyle = opt.color || '#c5c6c7';
      ctx.fillText(opt.label, w/2, opt.y);
    });

    ctx.fillStyle = '#3a9bdc';
    ctx.fillRect(w/2 - 100, h - 80, 200, 50);
    ctx.fillStyle = '#fff';
    ctx.fillText("Back", w/2, h - 48);
  }

  handleInput(x, y) {
    if (this.game.state !== 'OPTIONS') return false;

    const w = this.game.width;
    const h = this.game.height;

    // Back button
    if (x > w/2 - 100 && x < w/2 + 100 && y > h - 80 && y < h - 30) {
      this.game.state = 'TITLE';
      this.game.saveManager.save();
      this.applyOptions();
      return true;
    }

    const hitTest = (targetY) => Math.abs(y - (targetY - 5)) < 15;

    if (hitTest(100)) this.options.masterMute = !this.options.masterMute;
    if (hitTest(140)) { this.options.sfxVolume += 0.25; if(this.options.sfxVolume > 1) this.options.sfxVolume = 0; }
    if (hitTest(180)) { this.options.musicVolume += 0.25; if(this.options.musicVolume > 1) this.options.musicVolume = 0; }
    if (hitTest(220)) {
        if (this.options.screenShake === '100%') this.options.screenShake = '50%';
        else if (this.options.screenShake === '50%') this.options.screenShake = 'Off';
        else this.options.screenShake = '100%';
    }
    if (hitTest(260)) this.options.particleDensity = this.options.particleDensity === 'High' ? 'Low' : 'High';
    if (hitTest(300)) this.options.highContrast = !this.options.highContrast;
    if (hitTest(340)) this.options.showFPS = !this.options.showFPS;
    if (hitTest(380)) {
        if (this.options.touchMode === 'Auto') this.options.touchMode = 'Always';
        else if (this.options.touchMode === 'Always') this.options.touchMode = 'Off';
        else this.options.touchMode = 'Auto';
    }
    if (hitTest(420)) this.options.handedness = this.options.handedness === 'Right' ? 'Left' : 'Right';

    if (hitTest(480)) {
      const b64 = btoa(JSON.stringify(this.game.saveManager.data));
      console.log("Save Export:", b64);
      alert("Save exported to console/clipboard (if supported): " + b64.substring(0,20) + "...");
      try { navigator.clipboard.writeText(b64); } catch(e){}
    }
    if (hitTest(520)) {
      const p = prompt("Paste Base64 Save Data:");
      if (p) {
        try {
          const data = JSON.parse(atob(p));
          if (data && typeof data === 'object') {
             this.game.saveManager.data = data;
             this.game.saveManager.save();
             this.options = this.game.saveManager.data.options || this.options;
             alert("Save imported!");
          }
        } catch(e) {
          alert("Invalid save data.");
        }
      }
    }

    if (hitTest(580)) {
      if (confirm("Are you sure you want to completely reset all save data?")) {
        if (confirm("This is irreversible. SECOND CONFIRMATION: Reset?")) {
           this.game.saveManager.data = { highScore: 0, totalGamesPlayed: 0 };
           this.game.saveManager.save();
           this.options = { masterMute: false, sfxVolume: 1.0, musicVolume: 1.0, screenShake: '100%', particleDensity: 'High', highContrast: false, showFPS: false, touchMode: 'Auto', handedness: 'Right' };
           this.game.saveManager.data.options = this.options;
           this.game.saveManager.data.unlockedMilestones = [];
           this.game.saveManager.save();
        }
      }
    }

    this.game.saveManager.data.options = this.options;
    this.applyOptions();
    if(this.game.soundEngine && !this.options.masterMute) this.game.soundEngine.playUISelect();

    return true;
  }

  applyOptions() {
    if (this.game.soundEngine) {
      const se = this.game.soundEngine;
      if (se.masterGain) {
         se.masterGain.gain.value = this.options.masterMute ? 0 : (0.4 * this.options.musicVolume);
         // Note: would ideally separate SFX and Music gains, we will apply multiplier dynamically later if possible.
      }
    }
    if (this.options.highContrast) {
       document.documentElement.style.setProperty('--bg-color', '#000000');
       document.documentElement.style.setProperty('--text-main', '#ffffff');
       document.documentElement.style.setProperty('--accent', '#ff00ff');
    } else {
       document.documentElement.style.setProperty('--bg-color', '#0b0c10');
       document.documentElement.style.setProperty('--text-main', '#c5c6c7');
       document.documentElement.style.setProperty('--accent', '#a0efb8');
    }
  }

  drawMilestones(ctx, x, y) {
    ctx.fillStyle = '#a0efb8';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Milestones Unlocked:', x, y);

    const unlocked = this.game.saveManager.data.unlockedMilestones || [];
    let badgeY = y + 25;
    this.milestones.forEach((m, i) => {
       const isUnlocked = unlocked.includes(m.id);
       ctx.fillStyle = isUnlocked ? '#f5ca53' : '#4a4b4d';
       ctx.fillText(m.name, x, badgeY);
       badgeY += 20;
    });
  }
}
