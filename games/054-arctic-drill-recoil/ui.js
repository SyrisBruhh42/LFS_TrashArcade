class UIManager {
  constructor(engine) {
    this.engine = engine;
    this.isOpen = false;
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.showFps = true;

    this.buttons = [];

    // Milestones definitions
    this.milestones = [
      { id: 'm1', name: 'First Dig', condition: (data) => data.totalGamesPlayed >= 1 },
      { id: 'm2', name: 'Deep Miner', condition: (data) => data.highScore >= 1000 },
      { id: 'm3', name: 'Core Driller', condition: (data) => data.highScore >= 5000 },
      { id: 'm4', name: 'Veteran', condition: (data) => data.totalGamesPlayed >= 10 },
      { id: 'm5', name: 'Hoarder', condition: (data) => data.totalScoreAccumulated >= 10000 },
      { id: 'm6', name: 'Combo Master', condition: (data) => data.bestWaveOrCombo >= 20 }
    ];

    this.checkMilestones();
  }

  checkMilestones() {
    if (!this.engine.saveManager || !this.engine.saveManager.data) return;
    const data = this.engine.saveManager.data;
    if (!data.unlockedMilestones) data.unlockedMilestones = [];
    let unlockedAny = false;

    for (const m of this.milestones) {
      if (!data.unlockedMilestones.includes(m.id) && m.condition(data)) {
        data.unlockedMilestones.push(m.id);
        unlockedAny = true;
      }
    }
    if (unlockedAny) {
      this.engine.saveManager.save();
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.buildButtons();
    }
  }

  buildButtons() {
    this.buttons = [];
    const w = this.engine.logicalWidth;
    const cx = w / 2;
    let y = 100;

    const opts = this.engine.saveManager.data.options;

    // Master Mute
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Master Mute: ' + (opts.sfxVolume === 0 && opts.musicVolume === 0 ? 'ON' : 'OFF'),
      action: () => {
        if (opts.sfxVolume === 0 && opts.musicVolume === 0) {
          opts.sfxVolume = 0.5;
          opts.musicVolume = 0.5;
        } else {
          opts.sfxVolume = 0;
          opts.musicVolume = 0;
        }
        this.applySettings();
      }
    });
    y += 42;

    // SFX
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'SFX Volume: ' + Math.round(opts.sfxVolume * 100) + '%',
      action: () => {
        opts.sfxVolume = (opts.sfxVolume + 0.25) > 1 ? 0 : opts.sfxVolume + 0.25;
        this.applySettings();
      }
    });
    y += 42;

    // Music
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Music Volume: ' + Math.round(opts.musicVolume * 100) + '%',
      action: () => {
        opts.musicVolume = (opts.musicVolume + 0.25) > 1 ? 0 : opts.musicVolume + 0.25;
        this.applySettings();
      }
    });
    y += 42;

    // Screen Shake
    let shakeStr = opts.screenShake === 1 ? '100%' : (opts.screenShake === 0.5 ? '50%' : 'Off');
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Screen Shake: ' + shakeStr,
      action: () => {
        if (opts.screenShake === 1) opts.screenShake = 0.5;
        else if (opts.screenShake === 0.5) opts.screenShake = 0;
        else opts.screenShake = 1;
        this.applySettings();
      }
    });
    y += 42;

    // Particles
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Particles: ' + (opts.particles === 1 ? 'High' : 'Low'),
      action: () => {
        opts.particles = opts.particles === 1 ? 0.3 : 1;
        this.applySettings();
      }
    });
    y += 42;

    // Touch
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Touch: ' + opts.touchControls,
      action: () => {
        if (opts.touchControls === 'auto') opts.touchControls = 'always';
        else if (opts.touchControls === 'always') opts.touchControls = 'off';
        else opts.touchControls = 'auto';
        this.applySettings();
      }
    });
    y += 42;

    // Handedness
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Handedness: ' + (opts.leftHanded ? 'Left' : 'Right'),
      action: () => {
        opts.leftHanded = !opts.leftHanded;
        this.applySettings();
      }
    });
    y += 42;

    // High Contrast
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'High Contrast: ' + (opts.highContrast ? 'ON' : 'OFF'),
      action: () => {
        opts.highContrast = !opts.highContrast;
        this.applySettings();
      }
    });
    y += 42;

    // FPS Toggle
    this.buttons.push({
      x: cx - 150, y: y, w: 300, h: 40,
      text: 'Show FPS: ' + (this.showFps ? 'ON' : 'OFF'),
      action: () => {
        this.showFps = !this.showFps;
        this.applySettings();
      }
    });
    y += 42;

    // Export/Import/Reset
    this.buttons.push({
      x: cx - 150, y: y, w: 90, h: 40,
      text: 'Export',
      action: () => {
        const str = btoa(JSON.stringify(this.engine.saveManager.data));
        window.prompt('Copy your save string:', str);
      }
    });
    this.buttons.push({
      x: cx - 45, y: y, w: 90, h: 40,
      text: 'Import',
      action: () => {
        const str = window.prompt('Paste your save string:');
        if (str) {
          try {
            const data = JSON.parse(atob(str));
            if (data && data.options) {
              this.engine.saveManager.data = data;
              this.applySettings();
            }
          } catch(e) {}
        }
      }
    });
    this.buttons.push({
      x: cx + 60, y: y, w: 90, h: 40,
      text: 'Reset',
      action: () => {
        if (window.confirm('Are you sure you want to reset all data?')) {
          if (window.confirm('This cannot be undone. Final confirm?')) {
            this.engine.saveManager.data = this.engine.saveManager.getDefaults();
            this.applySettings();
          }
        }
      }
    });

    // Close button
    this.buttons.push({
      x: w - 120, y: 20, w: 100, h: 40,
      text: 'Close',
      action: () => {
        this.toggle();
      }
    });
  }

  applySettings() {
    this.engine.saveManager.save();
    if (this.engine.sound && this.engine.sound.updateVolumes) {
      this.engine.sound.updateVolumes(this.engine.saveManager.data.options);
    }
    this.buildButtons();
  }

  handleClick(x, y) {
    if (!this.isOpen) {
      // Check for settings button click
      if (x >= this.engine.logicalWidth - 120 && x <= this.engine.logicalWidth - 20 && y >= 20 && y <= 60) {
        this.toggle();
        return true;
      }
      return false;
    }

    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        b.action();
        return true;
      }
    }
    return true; // Consume input while open
  }

  update(dt) {
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (this.engine.state === 'GAME_OVER') {
       this.checkMilestones();
    }

    return this.isOpen;
  }

  draw(ctx) {
    const w = this.engine.logicalWidth;
    const h = this.engine.logicalHeight;
    const opts = this.engine.saveManager.data.options;

    // Draw Settings Button if not open
    if (!this.isOpen) {
      ctx.fillStyle = opts.highContrast ? '#ff0' : 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(w - 120, 20, 100, 40);
      ctx.fillStyle = opts.highContrast ? '#000' : '#fff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Settings', w - 70, 47);
    }

    if (this.showFps) {
      ctx.fillStyle = opts.highContrast ? '#ff0' : '#0f0';
      ctx.font = '16px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('FPS: ' + this.fps, w - 10, h - 10);
    }

    if (this.engine.state === 'TITLE' || this.engine.state === 'GAME_OVER') {
       this.drawMilestones(ctx);
    }

    this.drawTouchOverlay(ctx);

    if (!this.isOpen) return;

    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = opts.highContrast ? '#ff0' : '#fff';
    ctx.font = '40px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SETTINGS', w / 2, 80);

    ctx.font = '20px monospace';
    for (const b of this.buttons) {
      ctx.fillStyle = opts.highContrast ? '#ff0' : 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = opts.highContrast ? '#000' : '#fff';
      ctx.fillText(b.text, b.x + b.w / 2, b.y + 27);
    }
  }

  drawMilestones(ctx) {
    const data = this.engine.saveManager.data;
    if (!data.unlockedMilestones) return;

    const w = this.engine.logicalWidth;
    const h = this.engine.logicalHeight;
    const opts = data.options;

    ctx.fillStyle = opts.highContrast ? '#ff0' : '#aaa';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';

    ctx.fillText('Milestones:', w / 2, h - 140);

    let text = '';
    for (const m of this.milestones) {
      if (data.unlockedMilestones.includes(m.id)) {
        text += '[' + m.name + '] ';
      } else {
        text += '[???] ';
      }
    }

    ctx.fillText(text, w / 2, h - 110);
  }

  drawTouchOverlay(ctx) {
    const opts = this.engine.saveManager.data.options;
    let showTouch = false;
    if (opts.touchControls === 'always') showTouch = true;
    else if (opts.touchControls === 'auto' && 'ontouchstart' in window) showTouch = true;

    if (!showTouch) return;

    const inpt = this.engine.input;
    if (!inpt) return;

    ctx.save();
    ctx.globalAlpha = 0.3;

    const w = this.engine.logicalWidth;
    const h = this.engine.logicalHeight;

    let joyX = w / 4;
    let actX = (w * 3) / 4;

    if (opts.leftHanded) {
      joyX = (w * 3) / 4;
      actX = w / 4;
    }

    // Joystick
    if (inpt.joystick.active) {
       ctx.beginPath();
       ctx.arc(inpt.joystick.originX, inpt.joystick.originY, 50, 0, Math.PI*2);
       ctx.fillStyle = opts.highContrast ? '#ff0' : '#fff';
       ctx.fill();

       ctx.beginPath();
       ctx.arc(inpt.joystick.x, inpt.joystick.y, 25, 0, Math.PI*2);
       ctx.fillStyle = opts.highContrast ? '#f00' : '#aaa';
       ctx.fill();
    } else {
       ctx.beginPath();
       ctx.arc(joyX, h - 100, 50, 0, Math.PI*2);
       ctx.fillStyle = opts.highContrast ? '#ff0' : '#fff';
       ctx.fill();
    }

    // Action button
    ctx.beginPath();
    ctx.arc(actX, h - 100, 40, 0, Math.PI*2);
    ctx.fillStyle = inpt.actionButton.active ? (opts.highContrast ? '#f00' : '#aaa') : (opts.highContrast ? '#ff0' : '#fff');
    ctx.fill();

    ctx.restore();
  }
}
