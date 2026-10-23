class UI {
    constructor(engine) {
        this.engine = engine;
        this.milestones = [
            { id: 'm1', name: 'First Gear', desc: 'Play 10 games', check: (e) => e.saveManager.data.totalGamesPlayed >= 10 },
            { id: 'm2', name: 'Wealthy', desc: 'Score over 5000', check: (e) => e.score >= 5000 },
            { id: 'm3', name: 'Titan Slayer', desc: 'Defeat a Boss', check: (e) => e.bossesKilled >= 1 },
            { id: 'm4', name: 'Exterminator', desc: 'Kill 20 Enemies', check: (e) => e.saveManager.data.enemiesKilled >= 20 },
            { id: 'm5', name: 'Combo Master', desc: 'Reach 5x Combo', check: (e) => e.comboMultiplier >= 5 },
            { id: 'm6', name: 'Survivor', desc: 'Reach Wave 3', check: (e) => e.waveCount >= 3 }
        ];
        this.showSettings = false;

        // Merge defaults safely
        const defaultOptions = {
            mute: false,
            sfxVolume: 1,
            musicVolume: 1,
            shakeIntensity: 100,
            particleDensity: 'High',
            highContrast: false,
            showFPS: false,
            touchControls: 'Auto', // Auto, Always, Off
            handedness: 'Right' // Right, Left
        };
        this.engine.saveManager.data.options = { ...defaultOptions, ...(this.engine.saveManager.data.options || {}) };
        if (typeof this.engine.saveManager.data.enemiesKilled === 'undefined') {
            this.engine.saveManager.data.enemiesKilled = 0;
        }

        this.touchZones = {
            aim: { active: false, x: 0, y: 0, r: 80, cx: 0, cy: 0 },
            dash: { active: false, x: 0, y: 0, r: 40, cx: 0, cy: 0 }
        };

        this.applySettings();
    }

    applySettings() {
        const opts = this.engine.saveManager.data.options;
        if (this.engine.sound && this.engine.sound.initialized) {
            this.engine.sound.masterGain.gain.value = opts.mute ? 0 : 0.5;
            this.engine.sound.sfxGain.gain.value = opts.sfxVolume;
            this.engine.sound.musicGain.gain.value = opts.musicVolume;
        }
    }

    toggleSettings() {
        this.showSettings = !this.showSettings;
        if (this.showSettings && this.engine.state === 'PLAYING') {
            this.engine.state = 'PAUSED';
        }
    }

    checkMilestones() {
        const data = this.engine.saveManager.data;
        if (!data.unlockedMilestones) data.unlockedMilestones = [];
        let newUnlock = false;
        for (const ms of this.milestones) {
            if (!data.unlockedMilestones.includes(ms.id) && ms.check(this.engine)) {
                data.unlockedMilestones.push(ms.id);
                newUnlock = true;
                if (this.engine.vfx) {
                    this.engine.vfx.addText(this.engine.width/2, 50, `Milestone Unlocked: ${ms.name}!`, '#00ffaa');
                }
            }
        }
        if (newUnlock) this.engine.saveManager.save();
    }

    exportSave() {
        try {
            return btoa(JSON.stringify(this.engine.saveManager.data));
        } catch (e) { return ''; }
    }

    importSave(str) {
        try {
            const data = JSON.parse(atob(str));
            if (data) {
                this.engine.saveManager.data = { ...this.engine.saveManager.data, ...data };
                this.engine.saveManager.data.options = { ...this.engine.saveManager.data.options, ...(data.options || {}) };
                this.engine.saveManager.save();
                this.applySettings();
            }
        } catch(e) {}
    }

    update(dt) {
        this.checkMilestones();

        const opts = this.engine.saveManager.data.options;
        let useTouch = false;
        if (opts.touchControls === 'Auto') {
             useTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        } else if (opts.touchControls === 'Always') {
             useTouch = true;
        }

        if (useTouch && this.engine.state === 'PLAYING') {
            const h = opts.handedness;
            this.touchZones.aim.cx = h === 'Right' ? this.engine.width - 100 : 100;
            this.touchZones.aim.cy = this.engine.height - 100;
            this.touchZones.dash.cx = h === 'Right' ? 80 : this.engine.width - 80;
            this.touchZones.dash.cy = this.engine.height - 80;

            // Map touches
            this.engine.input.mouse.down = false;
            this.engine.input.mouse.rightDown = false;
            this.engine.input.keys['Space'] = false;
            this.engine.input.keys['ShiftLeft'] = false;

            if (this.engine.input.touch.active) {
                let mx = this.engine.input.mouse.x;
                let my = this.engine.input.mouse.y;

                let distAim = Math.hypot(mx - this.touchZones.aim.cx, my - this.touchZones.aim.cy);
                let distDash = Math.hypot(mx - this.touchZones.dash.cx, my - this.touchZones.dash.cy);

                if (distAim < this.touchZones.aim.r * 1.5) {
                    this.engine.input.keys['Space'] = true;
                    this.engine.input.mouse.x = this.engine.player.x + (mx - this.touchZones.aim.cx) * 5;
                    this.engine.input.mouse.y = this.engine.player.y + (my - this.touchZones.aim.cy) * 5;
                } else if (distDash < this.touchZones.dash.r * 1.5) {
                    this.engine.input.keys['ShiftLeft'] = true;
                    if (!this.engine.input.prevKeys['ShiftLeft']) {
                         this.engine.input.mouse.rightJustDown = true;
                    }
                } else {
                    this.engine.input.keys['Space'] = true;
                }
            }
        }
    }

    drawPreVFX(ctx) {
        if (this.engine.saveManager.data.options.highContrast) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, this.engine.width, this.engine.height);
        }
    }

    drawPostVFX(ctx) {
        const opts = this.engine.saveManager.data.options;
        if (opts.showFPS && this.engine.lastDt) {
            ctx.fillStyle = '#0f0';
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`FPS: ${Math.round(1 / this.engine.lastDt)}`, this.engine.width - 10, 20);
        }

        let useTouch = false;
        if (opts.touchControls === 'Auto') {
             useTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        } else if (opts.touchControls === 'Always') {
             useTouch = true;
        }

        if (useTouch && this.engine.state === 'PLAYING') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;

            // Aim
            ctx.beginPath();
            ctx.arc(this.touchZones.aim.cx, this.touchZones.aim.cy, this.touchZones.aim.r, 0, Math.PI*2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '12px monospace';
            ctx.fillText('AIM/FIRE', this.touchZones.aim.cx, this.touchZones.aim.cy + 4);

            // Dash
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.arc(this.touchZones.dash.cx, this.touchZones.dash.cy, this.touchZones.dash.r, 0, Math.PI*2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#fff';
            ctx.fillText('DASH', this.touchZones.dash.cx, this.touchZones.dash.cy + 4);
        }

        if (this.engine.state === 'TITLE' || this.engine.state === 'GAME_OVER') {
            this.drawMilestones(ctx);
        }

        if (this.showSettings) {
            this.drawSettings(ctx);
        }
    }

    drawMilestones(ctx) {
        const data = this.engine.saveManager.data;
        const unlocked = data.unlockedMilestones || [];
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 220, 30 + this.milestones.length * 20);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('MILESTONES', 20, 30);

        ctx.font = '12px monospace';
        for (let i = 0; i < this.milestones.length; i++) {
            const ms = this.milestones[i];
            const isUnl = unlocked.includes(ms.id);
            ctx.fillStyle = isUnl ? '#00ffaa' : '#555';
            ctx.fillText(`${isUnl ? '[X]' : '[ ]'} ${ms.name}`, 20, 50 + i * 20);
        }
    }

    drawSettings(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, this.engine.width, this.engine.height);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '30px monospace';
        ctx.fillText('SETTINGS', this.engine.width/2, 50);

        const opts = this.engine.saveManager.data.options;
        const items = [
            `Master Mute: ${opts.mute ? 'ON' : 'OFF'}`,
            `SFX Vol: ${opts.sfxVolume.toFixed(1)}`,
            `Music Vol: ${opts.musicVolume.toFixed(1)}`,
            `Screen Shake: ${opts.shakeIntensity}%`,
            `Particles: ${opts.particleDensity}`,
            `High Contrast: ${opts.highContrast ? 'ON' : 'OFF'}`,
            `Show FPS: ${opts.showFPS ? 'ON' : 'OFF'}`,
            `Touch Controls: ${opts.touchControls}`,
            `Handedness: ${opts.handedness}`,
            `[ Export Save (Base64) ]`,
            `[ Import Save (Base64) ]`,
            `[ Reset Save ]`,
            `[ Close ]`
        ];

        ctx.font = '20px monospace';
        for (let i = 0; i < items.length; i++) {
            let y = 100 + i * 35;
            let hovered = Math.abs(this.engine.input.mouse.y - y) < 15;
            ctx.fillStyle = hovered ? '#a04e7e' : '#ccc';
            ctx.fillText(items[i], this.engine.width/2, y);

            if (hovered && this.engine.input.mouse.justDown) {
                this.engine.input.mouse.justDown = false;
                if (i === 0) opts.mute = !opts.mute;
                else if (i === 1) opts.sfxVolume = (opts.sfxVolume + 0.2) > 1.05 ? 0 : opts.sfxVolume + 0.2;
                else if (i === 2) opts.musicVolume = (opts.musicVolume + 0.2) > 1.05 ? 0 : opts.musicVolume + 0.2;
                else if (i === 3) opts.shakeIntensity = opts.shakeIntensity === 100 ? 50 : (opts.shakeIntensity === 50 ? 0 : 100);
                else if (i === 4) opts.particleDensity = opts.particleDensity === 'High' ? 'Low' : 'High';
                else if (i === 5) opts.highContrast = !opts.highContrast;
                else if (i === 6) opts.showFPS = !opts.showFPS;
                else if (i === 7) opts.touchControls = opts.touchControls === 'Auto' ? 'Always' : (opts.touchControls === 'Always' ? 'Off' : 'Auto');
                else if (i === 8) opts.handedness = opts.handedness === 'Right' ? 'Left' : 'Right';
                else if (i === 9) {
                    const b64 = this.exportSave();
                    const b = window.prompt('Copy this save code:', b64);
                } else if (i === 10) {
                    const b64 = window.prompt('Paste save code:');
                    if (b64) this.importSave(b64);
                } else if (i === 11) {
                    if (window.confirm('Are you sure you want to reset all save data?')) {
                        localStorage.removeItem(this.engine.saveManager.saveKey);
                        location.reload();
                    }
                } else if (i === 12) {
                    this.showSettings = false;
                }

                this.engine.saveManager.save();
                this.applySettings();
            }
        }
    }
}
