class UI {
  constructor(game) {
    this.game = game;
    this.menuOpen = false;
    this.activeTab = 'Options';
    this.tabs = ['Options', 'Data', 'Milestones'];
    this.touchJoystick = { active: false, x: 0, y: 0, dx: 0, dy: 0, id: null };
    this.resetConfirm = 0;
    this.milestones = [
      { id: 'first_boss', name: 'Boss Slayer', desc: 'Defeat the first boss' },
      { id: 'score_10k', name: 'Scrapper', desc: 'Reach 10,000 score' },
      { id: 'score_50k', name: 'Hoarder', desc: 'Reach 50,000 score' },
      { id: 'wave_10', name: 'Survivor', desc: 'Reach Wave 10' },
      { id: 'wave_20', name: 'Veteran', desc: 'Reach Wave 20' },
      { id: 'upgrades_5', name: 'Fully Loaded', desc: 'Get 5 upgrades in one run' }
    ];
  }
  handleInput(e = null) {
    const mx = this.game.input.mouse.x;
    const my = this.game.input.mouse.y;

    // Toggle Menu Button
    if (mx > this.game.width - 50 && mx < this.game.width - 10 && my > 10 && my < 50) {
      if (this.game.input.consumeClick()) {
        this.menuOpen = !this.menuOpen;
        if (this.menuOpen && this.game.state === 'PLAYING') this.game.state = 'PAUSED';
        return true;
      }
    }

    if (this.menuOpen) {
      if (this.game.input.consumeClick()) this.handleMenuClick(mx, my);
      return true; // block game input when menu open
    }

    // Handle touch controls
    if (this.game.saveManager.data.options.touchControls !== 'Off' && e && e.type.startsWith('touch')) {
        // Implement touch joystick / fire buttons logic here in check/handle...
        return false; // let game handle it via simulated mouse/keys for now unless we fully intercept
    }
    return false;
  }

  handleMenuClick(mx, my) {
    const cw = this.game.width;
    const ch = this.game.height;
    const mw = Math.min(600, cw * 0.9);
    const mh = Math.min(500, ch * 0.9);
    const ox = cw / 2 - mw / 2;
    const oy = ch / 2 - mh / 2;

    // Tab switching
    for (let i=0; i<this.tabs.length; i++) {
        const tx = ox + i * 120 + 20;
        const ty = oy + 20;
        if (mx > tx && mx < tx + 100 && my > ty && my < ty + 30) {
            this.activeTab = this.tabs[i];
            this.resetConfirm = 0;
            return;
        }
    }

    const opts = this.game.saveManager.data.options;

    if (this.activeTab === 'Options') {
       // Master Vol
       if (mx > ox + 200 && mx < ox + 300 && my > oy + 80 && my < oy + 100) {
           opts.masterVolume = (mx - (ox + 200)) / 100;
           this.game.sound.setVolumes(opts);
           this.game.saveManager.save();
       }
       // SFX Vol
       if (mx > ox + 200 && mx < ox + 300 && my > oy + 120 && my < oy + 140) {
           opts.sfxVolume = (mx - (ox + 200)) / 100;
           this.game.sound.setVolumes(opts);
           this.game.saveManager.save();
       }
       // Music Vol
       if (mx > ox + 200 && mx < ox + 300 && my > oy + 160 && my < oy + 180) {
           opts.musicVolume = (mx - (ox + 200)) / 100;
           this.game.sound.setVolumes(opts);
           this.game.saveManager.save();
       }
       // Screen Shake
       if (mx > ox + 200 && mx < ox + 350 && my > oy + 200 && my < oy + 220) {
           if (opts.screenShake === 1.0) opts.screenShake = 0.5;
           else if (opts.screenShake === 0.5) opts.screenShake = 0.0;
           else opts.screenShake = 1.0;
           this.game.saveManager.save();
       }
       // Particles
       if (mx > ox + 200 && mx < ox + 350 && my > oy + 240 && my < oy + 260) {
           opts.particles = opts.particles === 'High' ? 'Low' : 'High';
           this.game.saveManager.save();
       }
       // High Contrast
       if (mx > ox + 200 && mx < ox + 350 && my > oy + 280 && my < oy + 300) {
           opts.highContrast = !opts.highContrast;
           this.game.saveManager.save();
       }
       // Show FPS
       if (mx > ox + 200 && mx < ox + 350 && my > oy + 320 && my < oy + 340) {
           opts.showFps = !opts.showFps;
           this.game.saveManager.save();
       }
       // Touch Controls
       if (mx > ox + 200 && mx < ox + 350 && my > oy + 360 && my < oy + 380) {
           if (opts.touchControls === 'Auto') opts.touchControls = 'Always';
           else if (opts.touchControls === 'Always') opts.touchControls = 'Off';
           else opts.touchControls = 'Auto';
           this.game.saveManager.save();
       }
       // Touch Hand
       if (mx > ox + 200 && mx < ox + 350 && my > oy + 400 && my < oy + 420) {
           opts.touchHand = opts.touchHand === 'Right' ? 'Left' : 'Right';
           this.game.saveManager.save();
       }
    } else if (this.activeTab === 'Data') {
       // Export
       if (mx > ox + 50 && mx < ox + 200 && my > oy + 100 && my < oy + 140) {
           const dataStr = btoa(JSON.stringify(this.game.saveManager.data));
           prompt("Copy your save data:", dataStr);
       }
       // Import
       if (mx > ox + 50 && mx < ox + 200 && my > oy + 160 && my < oy + 200) {
           const dataStr = prompt("Paste your save data:");
           if (dataStr) {
               try {
                   const parsed = JSON.parse(atob(dataStr));
                   if (parsed) {
                       this.game.saveManager.data = parsed;
                       this.game.saveManager.save();
                       alert("Save imported successfully!");
                   }
               } catch(e) {
                   alert("Invalid save data.");
               }
           }
       }
       // Reset
       if (mx > ox + 50 && mx < ox + 200 && my > oy + 220 && my < oy + 260) {
           if (this.resetConfirm === 0) {
               this.resetConfirm = 1;
           } else {
               localStorage.removeItem(SAVE_KEY);
               location.reload();
           }
       }
    }
  }

  update(dt) {
      if (this.game.saveManager.data.options.touchControls !== 'Off') {
          // Virtual Joystick Update Logic if needed
          const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
          if (this.game.saveManager.data.options.touchControls === 'Always' || (this.game.saveManager.data.options.touchControls === 'Auto' && isTouch)) {
             this.handleTouchControlsUpdate();
          }
      }
  }

  handleTouchControlsUpdate() {
      // Simulate input based on touch array
      if (this.game.input.touches.length > 0) {
          let joyFound = false;
          for (let t of this.game.input.touches) {
              const rect = this.game.canvas.getBoundingClientRect();
              const tx = (t.clientX - rect.left) * (this.game.canvas.width / rect.width);
              const ty = (t.clientY - rect.top) * (this.game.canvas.width / rect.width);

              const isLeftArea = tx < this.game.width / 2;
              const isJoystickArea = this.game.saveManager.data.options.touchHand === 'Right' ? isLeftArea : !isLeftArea;

              if (isJoystickArea) {
                  joyFound = true;
                  if (!this.touchJoystick.active) {
                      this.touchJoystick.active = true;
                      this.touchJoystick.id = t.identifier;
                      this.touchJoystick.x = tx;
                      this.touchJoystick.y = ty;
                  }
                  if (this.touchJoystick.id === t.identifier) {
                      this.touchJoystick.dx = tx - this.touchJoystick.x;
                      this.touchJoystick.dy = ty - this.touchJoystick.y;
                      const mag = Math.sqrt(this.touchJoystick.dx*this.touchJoystick.dx + this.touchJoystick.dy*this.touchJoystick.dy);
                      if (mag > 50) {
                          this.touchJoystick.dx = (this.touchJoystick.dx / mag) * 50;
                          this.touchJoystick.dy = (this.touchJoystick.dy / mag) * 50;
                      }

                      // Override mouse pos for aiming
                      if (this.game.player) {
                          this.game.input.mouse.x = this.game.player.pos.x + this.touchJoystick.dx * 10;
                          this.game.input.mouse.y = this.game.player.pos.y + this.touchJoystick.dy * 10;
                      }
                  }
              } else {
                  // Fire button area
                  this.game.input.mouse.down = true;
                  this.game.input.keys['Space'] = true;
                  // Double tap or wide press for dash? Let's just say right side tap is shoot
              }
          }
          if (!joyFound) this.touchJoystick.active = false;
      } else {
          this.touchJoystick.active = false;
          this.game.input.keys['Space'] = false;
      }
  }

  checkMilestones() {
      const data = this.game.saveManager.data;
      if (!data.unlockedMilestones) data.unlockedMilestones = [];
      const unlock = (id) => {
          if (!data.unlockedMilestones.includes(id)) {
              data.unlockedMilestones.push(id);
              this.game.saveManager.save();
          }
      };

      if (this.game.score >= 10000) unlock('score_10k');
      if (this.game.score >= 50000) unlock('score_50k');
      if (this.game.wave >= 10) unlock('wave_10');
      if (this.game.wave >= 20) unlock('wave_20');
      if (this.game.lastBossWave > 0) unlock('first_boss');
  }

  draw(ctx) {
      // FPS Counter
      if (this.game.saveManager.data.options.showFps) {
          ctx.fillStyle = '#0f0';
          ctx.font = '12px sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`FPS: ${this.game.fps}`, this.game.width - 10, 20);
      }

      // Menu Toggle Button
      ctx.fillStyle = '#444';
      ctx.fillRect(this.game.width - 50, 10, 40, 40);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '24px sans-serif';
      ctx.fillText("≡", this.game.width - 30, 38);

      // Draw Touch Controls if active
      if (this.touchJoystick.active) {
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.touchJoystick.x, this.touchJoystick.y, 50, 0, Math.PI*2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(this.touchJoystick.x + this.touchJoystick.dx, this.touchJoystick.y + this.touchJoystick.dy, 20, 0, Math.PI*2);
          ctx.fill();
      }

      if (!this.menuOpen) return;

      const cw = this.game.width;
      const ch = this.game.height;
      const mw = Math.min(600, cw * 0.9);
      const mh = Math.min(500, ch * 0.9);
      const ox = cw / 2 - mw / 2;
      const oy = ch / 2 - mh / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(ox, oy, mw, mh);
      ctx.strokeStyle = '#b48ff0';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox, oy, mw, mh);

      // Draw Tabs
      ctx.font = '16px sans-serif';
      for (let i=0; i<this.tabs.length; i++) {
          const tx = ox + i * 120 + 20;
          const ty = oy + 20;
          ctx.fillStyle = this.activeTab === this.tabs[i] ? '#b48ff0' : '#444';
          ctx.fillRect(tx, ty, 100, 30);
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.fillText(this.tabs[i], tx + 50, ty + 20);
      }

      ctx.textAlign = 'left';
      const opts = this.game.saveManager.data.options;

      if (this.activeTab === 'Options') {
          ctx.fillStyle = '#fff';
          ctx.fillText("Master Volume:", ox + 20, oy + 95);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 80, 100, 20);
          ctx.fillStyle = '#b48ff0'; ctx.fillRect(ox + 200, oy + 80, 100 * opts.masterVolume, 20);

          ctx.fillStyle = '#fff';
          ctx.fillText("SFX Volume:", ox + 20, oy + 135);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 120, 100, 20);
          ctx.fillStyle = '#b48ff0'; ctx.fillRect(ox + 200, oy + 120, 100 * opts.sfxVolume, 20);

          ctx.fillStyle = '#fff';
          ctx.fillText("Music Volume:", ox + 20, oy + 175);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 160, 100, 20);
          ctx.fillStyle = '#b48ff0'; ctx.fillRect(ox + 200, oy + 160, 100 * opts.musicVolume, 20);

          ctx.fillStyle = '#fff';
          ctx.fillText("Screen Shake:", ox + 20, oy + 215);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 200, 150, 20);
          ctx.fillStyle = '#fff'; ctx.fillText(opts.screenShake === 1.0 ? '100%' : (opts.screenShake === 0.5 ? '50%' : 'Off'), ox + 210, oy + 215);

          ctx.fillStyle = '#fff';
          ctx.fillText("Particles:", ox + 20, oy + 255);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 240, 150, 20);
          ctx.fillStyle = '#fff'; ctx.fillText(opts.particles, ox + 210, oy + 255);

          ctx.fillStyle = '#fff';
          ctx.fillText("High Contrast:", ox + 20, oy + 295);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 280, 150, 20);
          ctx.fillStyle = '#fff'; ctx.fillText(opts.highContrast ? 'On' : 'Off', ox + 210, oy + 295);

          ctx.fillStyle = '#fff';
          ctx.fillText("Show FPS:", ox + 20, oy + 335);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 320, 150, 20);
          ctx.fillStyle = '#fff'; ctx.fillText(opts.showFps ? 'On' : 'Off', ox + 210, oy + 335);

          ctx.fillStyle = '#fff';
          ctx.fillText("Touch Controls:", ox + 20, oy + 375);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 360, 150, 20);
          ctx.fillStyle = '#fff'; ctx.fillText(opts.touchControls, ox + 210, oy + 375);

          ctx.fillStyle = '#fff';
          ctx.fillText("Touch Hand:", ox + 20, oy + 415);
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 200, oy + 400, 150, 20);
          ctx.fillStyle = '#fff'; ctx.fillText(opts.touchHand, ox + 210, oy + 415);

      } else if (this.activeTab === 'Data') {
          ctx.fillStyle = '#444'; ctx.fillRect(ox + 50, oy + 100, 150, 40);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText("Export Save", ox + 125, oy + 125);

          ctx.fillStyle = '#444'; ctx.fillRect(ox + 50, oy + 160, 150, 40);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText("Import Save", ox + 125, oy + 185);

          ctx.fillStyle = this.resetConfirm ? '#f00' : '#444'; ctx.fillRect(ox + 50, oy + 220, 150, 40);
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(this.resetConfirm ? "Are you sure?" : "Reset Save", ox + 125, oy + 245);

      } else if (this.activeTab === 'Milestones') {
          const unlocked = this.game.saveManager.data.unlockedMilestones || [];
          for (let i=0; i<this.milestones.length; i++) {
              const m = this.milestones[i];
              const isUnlocked = unlocked.includes(m.id);
              const tx = ox + 20 + (i % 2) * 260;
              const ty = oy + 80 + Math.floor(i / 2) * 80;

              ctx.fillStyle = isUnlocked ? '#224422' : '#222';
              ctx.fillRect(tx, ty, 240, 60);
              ctx.strokeStyle = isUnlocked ? '#44ff44' : '#555';
              ctx.strokeRect(tx, ty, 240, 60);

              ctx.fillStyle = isUnlocked ? '#fff' : '#888';
              ctx.textAlign = 'left';
              ctx.font = '14px sans-serif';
              ctx.fillText(m.name, tx + 10, ty + 25);
              ctx.font = '10px sans-serif';
              ctx.fillText(m.desc, tx + 10, ty + 45);
          }
      }
  }
}
