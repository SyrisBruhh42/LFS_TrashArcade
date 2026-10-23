class UIManager {
  constructor(game) {
    this.game = game;
    this.isOpen = false;
    this.tab = 'Audio';
    this.tabs = ['Audio', 'Display', 'Controls', 'Data', 'Milestones'];
    this.milestones = [
      { id: 'first_blood', name: 'First Blood', desc: 'Score > 0' },
      { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a Boss' },
      { id: 'combo_master', name: 'Combo Master', desc: 'Reach 5x Combo' },
      { id: 'survivor', name: 'Survivor', desc: 'Reach Wave 5' },
      { id: 'high_roller', name: 'High Roller', desc: 'Score 1000+' },
      { id: 'dedicated', name: 'Dedicated', desc: 'Play 10 Games' }
    ];
    this.fps = 60;
    this.frames = 0;
    this.lastFpsTime = performance.now();
    this.joystickActive = false;
    this.joystickDir = new Vector2(0, 0);
    this.fireActive = false;

    // UI layout params
    this.settingsRect = { x: 20, y: 110, w: 40, h: 40 };
  }

  isTouchControlActive() {
    let opt = this.game.save.data.options.touchControl;
    if (opt === 'always') return true;
    if (opt === 'off') return false;
    return this.game.input.touch.active;
  }

  checkMilestones() {
    let unlocked = this.game.save.data.unlockedMilestones || [];
    let newlyUnlocked = false;

    const unlock = (id) => {
      if (!unlocked.includes(id)) {
        unlocked.push(id);
        newlyUnlocked = true;
      }
    };

    if (this.game.score > 0) unlock('first_blood');
    if (this.game.bossKillCount >= 1) unlock('boss_slayer');
    if (this.game.comboManager && this.game.comboManager.combo >= 5) unlock('combo_master');
    if (this.game.wave >= 5) unlock('survivor');
    if (this.game.score >= 1000 || this.game.save.data.highScore >= 1000) unlock('high_roller');
    if (this.game.save.data.totalGamesPlayed >= 10) unlock('dedicated');

    if (newlyUnlocked) {
      this.game.save.data.unlockedMilestones = unlocked;
      this.game.save.save();
    }
  }

  update(dt) {
    this.frames++;
    let now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frames;
      this.frames = 0;
      this.lastFpsTime = now;
    }

    this.checkMilestones();
    this.processInput();
  }

  processInput() {
    let input = this.game.input;
    let cw = this.game.canvas.width;
    let ch = this.game.canvas.height;

    this.joystickActive = false;
    this.fireActive = false;

    if (!this.isOpen && this.isTouchControlActive() && (this.game.state === 'PLAYING' || this.game.state === 'DRAFT')) {
       let leftHanded = this.game.save.data.options.leftHanded;
       let joyCenter = leftHanded ? {x: cw - 120, y: ch - 120} : {x: 120, y: ch - 120};
       let fireCenter = leftHanded ? {x: 120, y: ch - 120} : {x: cw - 120, y: ch - 120};

       if (input.touches) {
           for (let t of input.touches) {
               let distJoy = Math.hypot(t.x - joyCenter.x, t.y - joyCenter.y);
               if (distJoy < 100) {
                   this.joystickActive = true;
                   this.joystickDir = new Vector2(t.x - joyCenter.x, t.y - joyCenter.y);
               }
               let distFire = Math.hypot(t.x - fireCenter.x, t.y - fireCenter.y);
               if (distFire < 80) {
                   this.fireActive = true;
               }
           }
       }
    }

    if (input.mouse.down && !this.wasMouseDown) {
      let mx = input.mouse.x;
      let my = input.mouse.y;
      this.handleClick(mx, my);
    }
    if (input.touch.down && !this.wasTouchDown && input.touches && input.touches.length === 1) {
      let tx = input.touches[0].x;
      let ty = input.touches[0].y;
      this.handleClick(tx, ty);
    }
    this.wasMouseDown = input.mouse.down;
    this.wasTouchDown = input.touch.down;
  }

  handleClick(x, y) {
    if (x >= this.settingsRect.x && x <= this.settingsRect.x + this.settingsRect.w &&
        y >= this.settingsRect.y && y <= this.settingsRect.y + this.settingsRect.h) {
        this.isOpen = !this.isOpen;
        if (this.isOpen && this.game.state === 'PLAYING') {
            this.game.state = 'PAUSED';
        } else if (!this.isOpen && this.game.state === 'PAUSED') {
            this.game.state = 'PLAYING';
            this.game.lastTime = performance.now(); // Prevent large dt
        }
        return;
    }

    if (!this.isOpen) return;

    let cw = this.game.canvas.width;
    let ch = this.game.canvas.height;
    let pw = 600;
    let ph = 500;
    let px = cw / 2 - pw / 2;
    let py = ch / 2 - ph / 2;

    let tabW = pw / this.tabs.length;
    for (let i = 0; i < this.tabs.length; i++) {
        let tx = px + i * tabW;
        let ty = py;
        if (x >= tx && x <= tx + tabW && y >= ty && y <= ty + 40) {
            this.tab = this.tabs[i];
            return;
        }
    }

    let opts = this.game.save.data.options;

    if (this.tab === 'Audio') {
        let updateVol = (name, mx, my, yOffset) => {
            if (my >= py + yOffset - 10 && my <= py + yOffset + 30) {
               let val = Math.max(0, Math.min(1, (mx - (px + 200)) / 300));
               opts[name] = val;
               this.game.save.save();
               if (name === 'masterVolume' && this.game.sound.masterGain) {
                  this.game.sound.masterGain.gain.value = val;
               }
            }
        };
        updateVol('masterVolume', x, y, 100);
        updateVol('sfxVolume', x, y, 180);
        updateVol('musicVolume', x, y, 260);
    } else if (this.tab === 'Display') {
        let toggle = (my) => {
            if (my >= py + 100 && my <= py + 140) {
                opts.screenShake = opts.screenShake === 1 ? 0.5 : (opts.screenShake === 0.5 ? 0 : 1);
            } else if (my >= py + 180 && my <= py + 220) {
                opts.particleDensity = opts.particleDensity === 'high' ? 'low' : 'high';
            } else if (my >= py + 260 && my <= py + 300) {
                opts.highContrast = !opts.highContrast;
            } else if (my >= py + 340 && my <= py + 380) {
                opts.showFPS = !opts.showFPS;
            }
            this.game.save.save();
        };
        toggle(y);
    } else if (this.tab === 'Controls') {
        if (y >= py + 100 && y <= py + 140) {
            if (opts.touchControl === 'auto') opts.touchControl = 'always';
            else if (opts.touchControl === 'always') opts.touchControl = 'off';
            else opts.touchControl = 'auto';
        } else if (y >= py + 180 && y <= py + 220) {
            opts.leftHanded = !opts.leftHanded;
        }
        this.game.save.save();
    } else if (this.tab === 'Data') {
        if (x >= px + 100 && x <= px + 500) {
            if (y >= py + 100 && y <= py + 140) {
                let str = btoa(JSON.stringify(this.game.save.data));
                navigator.clipboard.writeText(str).catch(()=>{});
                alert("Save copied to clipboard!");
            } else if (y >= py + 180 && y <= py + 220) {
                let str = prompt("Paste save string:");
                if (str) {
                    try {
                        let parsed = JSON.parse(atob(str));
                        this.game.save.data = parsed;
                        this.game.save.save();
                        alert("Save imported!");
                    } catch(e) {
                        alert("Invalid save string");
                    }
                }
            } else if (y >= py + 260 && y <= py + 300) {
                this.resetStep = 1;
            } else if (y >= py + 340 && y <= py + 380 && this.resetStep === 1) {
                localStorage.removeItem(this.game.save.key);
                location.reload();
            }
        }
    }
  }

  draw(ctx) {
    let cw = this.game.canvas.width;
    let ch = this.game.canvas.height;

    if (this.game.save.data.options.showFPS) {
        ctx.fillStyle = '#0f0';
        ctx.font = '16px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`FPS: ${this.fps}`, cw - 20, 20);
    }

    if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') {
        let unlocked = this.game.save.data.unlockedMilestones || [];
        ctx.textAlign = 'left';
        ctx.font = '14px monospace';
        for (let i = 0; i < this.milestones.length; i++) {
            let m = this.milestones[i];
            let isUnl = unlocked.includes(m.id);
            ctx.fillStyle = isUnl ? '#ffea00' : '#555';
            ctx.fillText(`${isUnl ? '★' : '☆'} ${m.name}`, 20, ch - 160 + i * 20);
        }
    }

    if (!this.isOpen && this.isTouchControlActive() && (this.game.state === 'PLAYING' || this.game.state === 'DRAFT')) {
        let leftHanded = this.game.save.data.options.leftHanded;
        let joyCenter = leftHanded ? {x: cw - 120, y: ch - 120} : {x: 120, y: ch - 120};
        let fireCenter = leftHanded ? {x: 120, y: ch - 120} : {x: cw - 120, y: ch - 120};

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(joyCenter.x, joyCenter.y, 80, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(fireCenter.x, fireCenter.y, 60, 0, Math.PI * 2); ctx.stroke();

        if (this.joystickActive) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            let p = this.joystickDir.copy().normalize().mult(Math.min(80, this.joystickDir.mag()));
            ctx.arc(joyCenter.x + p.x, joyCenter.y + p.y, 20, 0, Math.PI*2);
            ctx.fill();
        }
        if (this.fireActive) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.beginPath(); ctx.arc(fireCenter.x, fireCenter.y, 50, 0, Math.PI * 2); ctx.fill();
        }
    }

    ctx.fillStyle = '#444';
    ctx.fillRect(this.settingsRect.x, this.settingsRect.y, this.settingsRect.w, this.settingsRect.h);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '24px monospace';
    ctx.fillText('⚙', this.settingsRect.x + 20, this.settingsRect.y + 28);

    if (!this.isOpen) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, cw, ch);

    let pw = 600;
    let ph = 500;
    let px = cw / 2 - pw / 2;
    let py = ch / 2 - ph / 2;

    ctx.fillStyle = '#222';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(px, py, pw, ph);

    let tabW = pw / this.tabs.length;
    for (let i = 0; i < this.tabs.length; i++) {
        let tx = px + i * tabW;
        let ty = py;
        ctx.fillStyle = this.tab === this.tabs[i] ? '#444' : '#111';
        ctx.fillRect(tx, ty, tabW, 40);
        ctx.strokeRect(tx, ty, tabW, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.fillText(this.tabs[i], tx + tabW / 2, ty + 25);
    }

    let opts = this.game.save.data.options;
    ctx.textAlign = 'left';

    if (this.tab === 'Audio') {
        let drawSlider = (name, label, yOffset) => {
            ctx.fillStyle = '#fff';
            ctx.fillText(label, px + 40, py + yOffset + 15);
            ctx.fillStyle = '#555';
            ctx.fillRect(px + 200, py + yOffset, 300, 20);
            ctx.fillStyle = '#0f0';
            ctx.fillRect(px + 200, py + yOffset, 300 * opts[name], 20);
        };
        drawSlider('masterVolume', 'Master:', 100);
        drawSlider('sfxVolume', 'SFX:', 180);
        drawSlider('musicVolume', 'Music:', 260);
    } else if (this.tab === 'Display') {
        let drawToggle = (label, valStr, yOffset) => {
            ctx.fillStyle = '#fff';
            ctx.fillText(label, px + 40, py + yOffset + 15);
            ctx.fillStyle = '#555';
            ctx.fillRect(px + 300, py + yOffset, 200, 30);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(valStr, px + 400, py + yOffset + 20);
            ctx.textAlign = 'left';
        };
        let ss = opts.screenShake === 1 ? '100%' : (opts.screenShake === 0.5 ? '50%' : 'Off');
        drawToggle('Screen Shake:', ss, 100);
        drawToggle('Particles:', opts.particleDensity === 'high' ? 'High' : 'Low', 180);
        drawToggle('High Contrast:', opts.highContrast ? 'On' : 'Off', 260);
        drawToggle('Show FPS:', opts.showFPS ? 'On' : 'Off', 340);
    } else if (this.tab === 'Controls') {
        let drawToggle = (label, valStr, yOffset) => {
            ctx.fillStyle = '#fff';
            ctx.fillText(label, px + 40, py + yOffset + 15);
            ctx.fillStyle = '#555';
            ctx.fillRect(px + 300, py + yOffset, 200, 30);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(valStr, px + 400, py + yOffset + 20);
            ctx.textAlign = 'left';
        };
        let tc = opts.touchControl;
        drawToggle('Touch Control:', tc.charAt(0).toUpperCase() + tc.slice(1), 100);
        drawToggle('Handedness:', opts.leftHanded ? 'Left (Joy R)' : 'Right (Joy L)', 180);
    } else if (this.tab === 'Data') {
        let drawBtn = (label, yOffset, color='#555') => {
            ctx.fillStyle = color;
            ctx.fillRect(px + 100, py + yOffset, 400, 40);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(label, px + 300, py + yOffset + 25);
            ctx.textAlign = 'left';
        };
        drawBtn('Export Save to Clipboard', 100);
        drawBtn('Import Save from Clipboard', 180);
        drawBtn('Reset Save Data', 260, '#822');
        if (this.resetStep === 1) {
            drawBtn('CONFIRM RESET?', 340, '#f00');
        }
    } else if (this.tab === 'Milestones') {
        let unlocked = this.game.save.data.unlockedMilestones || [];
        for (let i = 0; i < this.milestones.length; i++) {
            let m = this.milestones[i];
            let isUnl = unlocked.includes(m.id);
            ctx.fillStyle = isUnl ? '#ffea00' : '#555';
            ctx.fillText(`${isUnl ? '★' : '☆'} ${m.name} - ${m.desc}`, px + 40, py + 80 + i * 40);
        }
    }
  }
}
