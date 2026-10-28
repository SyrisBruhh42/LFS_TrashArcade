
class UIManager {
    constructor(game) {
        this.game = game;

        this.milestones = [
            { id: 'm1', name: 'First Flight', desc: 'Play 1 game', check: (data) => data.totalGamesPlayed >= 1 },
            { id: 'm2', name: 'Dedication', desc: 'Play 10 games', check: (data) => data.totalGamesPlayed >= 10 },
            { id: 'm3', name: 'Score Rookie', desc: 'Reach 1,000 High Score', check: (data) => data.highScore >= 1000 },
            { id: 'm4', name: 'Score Master', desc: 'Reach 10,000 High Score', check: (data) => data.highScore >= 10000 },
            { id: 'm5', name: 'Wave Survivor', desc: 'Reach Wave 3', check: (data) => data.bestWaveOrCombo >= 3 },
            { id: 'm6', name: 'Millionaire', desc: 'Accumulate 100,000 total score', check: (data) => data.totalScoreAccumulated >= 100000 },
        ];

        this.fps = 0;
        this.frames = 0;
        this.lastFpsTime = performance.now();

        const defOpts = {
            masterMute: false,
            sfxVolume: 1,
            musicVolume: 1,
            screenShake: '100%',
            particleDensity: 'High',
            highContrast: false,
            showFPS: false,
            touchControls: 'Auto',
            touchHandedness: 'Right'
        };
        if (!this.game.saveManager.data.options) this.game.saveManager.data.options = {};
        this.game.saveManager.data.options = { ...defOpts, ...this.game.saveManager.data.options };

        // Dpad state
        this.dpadActive = false;
        this.dpadVector = {x: 0, y: 0};
        this.shootActive = false;
        this.switchJustPressed = false;
        this.switchActive = false;

        this.initDOM();
        this.applySettings();
    }

    initDOM() {
        const style = document.createElement('style');
        style.textContent = `
            #ui-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; color: white; font-family: sans-serif; }
            .ui-btn { pointer-events: auto; background: rgba(0,0,0,0.7); border: 1px solid white; color: white; padding: 5px 10px; cursor: pointer; }
            #settings-btn { position: absolute; top: 10px; right: 10px; }
            #fps-counter { position: absolute; top: 10px; left: 10px; font-weight: bold; text-shadow: 1px 1px 0 #000; }
            #settings-panel { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.95); border: 2px solid #7751ef; padding: 20px; pointer-events: auto; display: none; flex-direction: column; gap: 10px; max-height: 90%; overflow-y: auto; width: 300px; }
            .setting-row { display: flex; justify-content: space-between; align-items: center; }
            .setting-row label { font-size: 14px; }
            .setting-row select, .setting-row input, .setting-row button { background: #333; color: white; border: 1px solid #7751ef; padding: 4px; }
            .setting-row input[type=range] { width: 100px; }
            #touch-controls { position: absolute; bottom: 0; left: 0; width: 100%; height: 50%; pointer-events: none; display: none; }
            .dpad { position: absolute; bottom: 20px; width: 120px; height: 120px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; pointer-events: auto; touch-action: none; }
            .dpad-knob { position: absolute; top: 40px; left: 40px; width: 40px; height: 40px; background: rgba(255,255,255,0.5); border-radius: 50%; pointer-events: none; transition: transform 0.05s; }
            .btn-container { position: absolute; bottom: 20px; width: 150px; height: 150px; pointer-events: none; }
            .action-btn { position: absolute; width: 60px; height: 60px; background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.4); border-radius: 50%; pointer-events: auto; display: flex; justify-content: center; align-items: center; user-select: none; touch-action: none; font-size: 12px; }
            .action-btn:active { background: rgba(255,255,255,0.4); }
            #btn-shoot { bottom: 0; left: 0; }
            #btn-switch { bottom: 70px; left: 70px; }
            .close-btn { align-self: center; margin-top: 10px; width: 100px; }
            .milestones-title { text-align: center; margin-top: 10px; font-weight: bold; border-top: 1px solid #555; padding-top: 10px; }
            .milestone { font-size: 12px; color: #888; }
            .milestone.unlocked { color: #0f0; }
        `;
        document.head.appendChild(style);

        this.uiLayer = document.createElement('div');
        this.uiLayer.id = 'ui-layer';

        this.fpsCounter = document.createElement('div');
        this.fpsCounter.id = 'fps-counter';
        this.uiLayer.appendChild(this.fpsCounter);

        this.settingsBtn = document.createElement('button');
        this.settingsBtn.id = 'settings-btn';
        this.settingsBtn.className = 'ui-btn';
        this.settingsBtn.textContent = 'Settings (Esc)';
        this.settingsBtn.onclick = () => this.toggleSettings();
        this.uiLayer.appendChild(this.settingsBtn);

        this.settingsPanel = document.createElement('div');
        this.settingsPanel.id = 'settings-panel';
        this.buildSettingsPanel();
        this.uiLayer.appendChild(this.settingsPanel);

        // Touch Controls
        this.touchLayer = document.createElement('div');
        this.touchLayer.id = 'touch-controls';

        this.dpad = document.createElement('div');
        this.dpad.className = 'dpad';
        this.dpadKnob = document.createElement('div');
        this.dpadKnob.className = 'dpad-knob';
        this.dpad.appendChild(this.dpadKnob);

        this.btnContainer = document.createElement('div');
        this.btnContainer.className = 'btn-container';

        this.btnShoot = document.createElement('div');
        this.btnShoot.className = 'action-btn';
        this.btnShoot.id = 'btn-shoot';
        this.btnShoot.innerHTML = 'Shoot';

        this.btnSwitch = document.createElement('div');
        this.btnSwitch.className = 'action-btn';
        this.btnSwitch.id = 'btn-switch';
        this.btnSwitch.innerHTML = 'Switch';

        this.btnContainer.appendChild(this.btnShoot);
        this.btnContainer.appendChild(this.btnSwitch);

        this.touchLayer.appendChild(this.dpad);
        this.touchLayer.appendChild(this.btnContainer);
        this.uiLayer.appendChild(this.touchLayer);

        document.body.appendChild(this.uiLayer);

        this.bindTouchControls();

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.toggleSettings();
            }
        });
    }

    buildSettingsPanel() {
        this.settingsPanel.innerHTML = '<h3>Options</h3>';

        const createRow = (label, el) => {
            const row = document.createElement('div');
            row.className = 'setting-row';
            row.innerHTML = `<label>${label}</label>`;
            row.appendChild(el);
            this.settingsPanel.appendChild(row);
            return el;
        };

        // Master Mute
        this.chkMute = document.createElement('input');
        this.chkMute.type = 'checkbox';
        this.chkMute.onchange = () => this.updateOption('masterMute', this.chkMute.checked);
        createRow('Master Mute', this.chkMute);

        // SFX Volume
        this.rngSfx = document.createElement('input');
        this.rngSfx.type = 'range';
        this.rngSfx.min = '0'; this.rngSfx.max = '1'; this.rngSfx.step = '0.1';
        this.rngSfx.onchange = () => this.updateOption('sfxVolume', parseFloat(this.rngSfx.value));
        createRow('SFX Volume', this.rngSfx);

        // Music Volume
        this.rngMusic = document.createElement('input');
        this.rngMusic.type = 'range';
        this.rngMusic.min = '0'; this.rngMusic.max = '1'; this.rngMusic.step = '0.1';
        this.rngMusic.onchange = () => this.updateOption('musicVolume', parseFloat(this.rngMusic.value));
        createRow('Music Volume', this.rngMusic);

        // Screen Shake
        this.selShake = document.createElement('select');
        ['100%', '50%', 'Off'].forEach(opt => this.selShake.add(new Option(opt, opt)));
        this.selShake.onchange = () => this.updateOption('screenShake', this.selShake.value);
        createRow('Screen Shake', this.selShake);

        // Particle Density
        this.selParticles = document.createElement('select');
        ['High', 'Low'].forEach(opt => this.selParticles.add(new Option(opt, opt)));
        this.selParticles.onchange = () => this.updateOption('particleDensity', this.selParticles.value);
        createRow('Particle Density', this.selParticles);

        // High Contrast
        this.chkContrast = document.createElement('input');
        this.chkContrast.type = 'checkbox';
        this.chkContrast.onchange = () => this.updateOption('highContrast', this.chkContrast.checked);
        createRow('High Contrast Mode', this.chkContrast);

        // Show FPS
        this.chkFps = document.createElement('input');
        this.chkFps.type = 'checkbox';
        this.chkFps.onchange = () => this.updateOption('showFPS', this.chkFps.checked);
        createRow('Show FPS', this.chkFps);

        // Touch Controls
        this.selTouch = document.createElement('select');
        ['Auto', 'Always', 'Off'].forEach(opt => this.selTouch.add(new Option(opt, opt)));
        this.selTouch.onchange = () => this.updateOption('touchControls', this.selTouch.value);
        createRow('Touch Controls', this.selTouch);

        // Touch Handedness
        this.selHand = document.createElement('select');
        ['Right', 'Left'].forEach(opt => this.selHand.add(new Option(opt, opt)));
        this.selHand.onchange = () => this.updateOption('touchHandedness', this.selHand.value);
        createRow('Handedness (Action btn)', this.selHand);

        // Export / Import
        const exImRow = document.createElement('div');
        exImRow.className = 'setting-row';
        exImRow.style.marginTop = '10px';
        const btnEx = document.createElement('button');
        btnEx.textContent = 'Export Save';
        btnEx.onclick = () => this.exportSave();
        const btnIm = document.createElement('button');
        btnIm.textContent = 'Import Save';
        btnIm.onclick = () => this.importSave();
        exImRow.appendChild(btnEx);
        exImRow.appendChild(btnIm);
        this.settingsPanel.appendChild(exImRow);

        // Reset
        this.btnReset = document.createElement('button');
        this.btnReset.textContent = 'Reset Data (Step 1)';
        this.btnReset.style.width = '100%';
        this.btnReset.style.marginTop = '10px';
        this.btnReset.style.background = '#800';
        this.resetStep = 0;
        this.btnReset.onclick = () => {
            if (this.resetStep === 0) {
                this.resetStep = 1;
                this.btnReset.textContent = 'Confirm Reset! (Step 2)';
                this.btnReset.style.background = '#f00';
            } else {
                localStorage.removeItem(SAVE_KEY);
                location.reload();
            }
        };
        this.settingsPanel.appendChild(this.btnReset);

        const btnClose = document.createElement('button');
        btnClose.className = 'ui-btn close-btn';
        btnClose.textContent = 'Close';
        btnClose.onclick = () => this.toggleSettings();
        this.settingsPanel.appendChild(btnClose);

        this.milestonesContainer = document.createElement('div');
        this.settingsPanel.appendChild(this.milestonesContainer);
    }

    updateOption(key, val) {
        this.game.saveManager.data.options[key] = val;
        this.game.saveManager.save();
        this.applySettings();
    }

    syncInputs() {
        const o = this.game.saveManager.data.options;
        this.chkMute.checked = o.masterMute;
        this.rngSfx.value = o.sfxVolume;
        this.rngMusic.value = o.musicVolume;
        this.selShake.value = o.screenShake;
        this.selParticles.value = o.particleDensity;
        this.chkContrast.checked = o.highContrast;
        this.chkFps.checked = o.showFPS;
        this.selTouch.value = o.touchControls;
        this.selHand.value = o.touchHandedness;
    }

    applySettings() {
        const o = this.game.saveManager.data.options;

        // Sound
        if (this.game.sound.masterGain) {
            this.game.sound.masterGain.gain.value = o.masterMute ? 0 : 1;
            this.game.sound.sfxGain.gain.value = o.sfxVolume;
            this.game.sound.musicGain.gain.value = o.musicVolume;
        }

        // Particles density in VFX
        if (this.game.vfx) {
            this.game.vfx.particleMultiplier = (o.particleDensity === 'Low') ? 0.5 : 1;
        }

        // Screen shake
        let shakeFactor = 1;
        if (o.screenShake === '50%') shakeFactor = 0.5;
        if (o.screenShake === 'Off') shakeFactor = 0;
        if (this.game.vfx) {
            this.game.vfx.shakeFactor = shakeFactor;
        }

        // High contrast (we set a flag on game object for renderer to read)
        this.game.highContrast = o.highContrast;

        // FPS
        this.fpsCounter.style.display = o.showFPS ? 'block' : 'none';

        // Touch Controls
        const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        let showTouch = false;
        if (o.touchControls === 'Always') showTouch = true;
        if (o.touchControls === 'Auto' && isMobile) showTouch = true;
        if (o.touchControls === 'Off') showTouch = false;

        this.touchLayer.style.display = showTouch ? 'block' : 'none';

        if (o.touchHandedness === 'Left') {
            this.dpad.style.left = 'auto';
            this.dpad.style.right = '20px';
            this.btnContainer.style.right = 'auto';
            this.btnContainer.style.left = '20px';
        } else {
            this.dpad.style.right = 'auto';
            this.dpad.style.left = '20px';
            this.btnContainer.style.left = 'auto';
            this.btnContainer.style.right = '20px';
        }
    }

    exportSave() {
        const jsonStr = JSON.stringify(this.game.saveManager.data);
        const b64 = btoa(jsonStr);
        prompt("Copy your save code:", b64);
    }

    importSave() {
        const b64 = prompt("Paste your save code:");
        if (b64) {
            try {
                const jsonStr = atob(b64);
                const data = JSON.parse(jsonStr);
                if (data && typeof data === 'object') {
                    this.game.saveManager.data = data;
                    this.game.saveManager.save();
                    location.reload();
                }
            } catch(e) {
                alert("Invalid save data");
            }
        }
    }

    toggleSettings() {
        if (this.settingsPanel.style.display === 'flex') {
            this.settingsPanel.style.display = 'none';
            if(this.game.state === 'PAUSED') this.game.setState('PLAYING');
        } else {
            this.syncInputs();
            this.renderMilestones();
            this.settingsPanel.style.display = 'flex';
            this.resetStep = 0;
            this.btnReset.textContent = 'Reset Data (Step 1)';
            this.btnReset.style.background = '#800';
            if(this.game.state === 'PLAYING') this.game.setState('PAUSED');
        }
    }

    renderMilestones() {
        this.checkMilestones();
        let html = '<div class="milestones-title">Milestones</div>';
        const d = this.game.saveManager.data;
        this.milestones.forEach(m => {
            const unl = d.unlockedMilestones && d.unlockedMilestones.includes(m.id);
            html += `<div class="milestone ${unl ? 'unlocked' : ''}">
                ${unl ? '✅' : '🔒'} <b>${m.name}</b>: ${m.desc}
            </div>`;
        });
        this.milestonesContainer.innerHTML = html;
    }

    checkMilestones() {
        const d = this.game.saveManager.data;
        if (!d.unlockedMilestones) d.unlockedMilestones = [];
        let newUnlock = false;
        this.milestones.forEach(m => {
            if (!d.unlockedMilestones.includes(m.id)) {
                if (m.check(d)) {
                    d.unlockedMilestones.push(m.id);
                    if (this.game.vfx) this.game.vfx.addPopup(this.game.width/2, this.game.height/4, `Unlocked: ${m.name}!`, '#0f0');
                    newUnlock = true;
                }
            }
        });
        if (newUnlock) this.game.saveManager.save();
    }

    bindTouchControls() {
        let dpadCenter = {x: 0, y: 0};

        this.dpad.addEventListener('pointerdown', (e) => {
            this.dpadActive = true;
            const rect = this.dpad.getBoundingClientRect();
            dpadCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
            this.updateDpad(e.clientX, e.clientY, rect.width/2);
            e.preventDefault();
        });

        window.addEventListener('pointermove', (e) => {
            if (this.dpadActive) {
                const rect = this.dpad.getBoundingClientRect();
                this.updateDpad(e.clientX, e.clientY, rect.width/2, dpadCenter);
            }
        });

        window.addEventListener('pointerup', (e) => {
            this.dpadActive = false;
            this.dpadVector = {x: 0, y: 0};
            this.dpadKnob.style.transform = `translate(0px, 0px)`;
        });

        this.btnShoot.addEventListener('pointerdown', (e) => { this.shootActive = true; e.preventDefault(); });
        this.btnShoot.addEventListener('pointerup', (e) => { this.shootActive = false; e.preventDefault(); });
        this.btnShoot.addEventListener('pointerleave', (e) => { this.shootActive = false; e.preventDefault(); });

        this.btnSwitch.addEventListener('pointerdown', (e) => {
            if(!this.switchActive) this.switchJustPressed = true;
            this.switchActive = true;
            e.preventDefault();
        });
        this.btnSwitch.addEventListener('pointerup', (e) => { this.switchActive = false; e.preventDefault(); });
        this.btnSwitch.addEventListener('pointerleave', (e) => { this.switchActive = false; e.preventDefault(); });
    }

    updateDpad(x, y, radius, center) {
        if(!center) return;
        let dx = x - center.x;
        let dy = y - center.y;
        let mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > radius) {
            dx = (dx/mag) * radius;
            dy = (dy/mag) * radius;
            mag = radius;
        }
        this.dpadKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.dpadVector = { x: dx/radius, y: dy/radius };
    }

    update(dt) {
        this.frames++;
        const now = performance.now();
        if (now - this.lastFpsTime >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastFpsTime = now;
            if (this.game.saveManager.data.options.showFPS) {
                this.fpsCounter.textContent = `FPS: ${this.fps}`;
            }
        }

        this.checkMilestones();
    }

    drawMilestones(ctx) {
        // Draw unlocked milestones nicely on TITLE and GAME_OVER
        if (this.game.state !== 'TITLE' && this.game.state !== 'GAME_OVER') return;

        const d = this.game.saveManager.data;
        if (!d.unlockedMilestones || d.unlockedMilestones.length === 0) return;

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';

        let unlocked = this.milestones.filter(m => d.unlockedMilestones.includes(m.id));

        let startY = 100;
        if (this.game.state === 'GAME_OVER') startY = this.game.height - (unlocked.length * 20) - 20;

        ctx.fillText("Earned Milestones:", this.game.width/2, startY - 20);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#fd0';
        unlocked.forEach((m, idx) => {
            ctx.fillText(`🏆 ${m.name}`, this.game.width/2, startY + (idx * 20));
        });

        ctx.restore();
    }
}
