class UIManager {
    constructor(game) {
        this.game = game;
        this.resetClicks = 0;
        this.saveActionEpoch = 0;
        this.initDOM();
        this.bindEvents();
    }
    initDOM() {
        this.els = {
            btnSettings: document.getElementById('btn-settings'),
            btnMilestones: document.getElementById('btn-milestones'),
            settingsScreen: document.getElementById('settings-screen'),
            milestonesScreen: document.getElementById('milestones-screen'),
            titleScreen: document.getElementById('title-screen'),
            chkMute: document.getElementById('chk-mute'),
            sldSfx: document.getElementById('sld-sfx'),
            sldMusic: document.getElementById('sld-music'),
            selShake: document.getElementById('sel-shake'),
            selParticles: document.getElementById('sel-particles'),
            chkColorblind: document.getElementById('chk-colorblind'),
            chkFps: document.getElementById('chk-fps'),
            selTouch: document.getElementById('sel-touch'),
            chkTouchSwap: document.getElementById('chk-touch-swap'),
            btnExportSave: document.getElementById('btn-export-save'),
            inpImportSave: document.getElementById('inp-import-save'),
            btnImportSave: document.getElementById('btn-import-save'),
            btnResetSave: document.getElementById('btn-reset-save'),
            btnCloseSettings: document.getElementById('btn-close-settings'),
            btnCloseMilestones: document.getElementById('btn-close-milestones'),
            milestonesList: document.getElementById('milestones-list'),
            saveStatus: document.getElementById('save-status'),
            exportText: document.getElementById('save-export-text')
        };
        this.updateSettingsUI();
    }
    updateSettingsUI() {
        if(!this.els.chkMute) return;
        const opts = this.game.saveManager.data.options;
        this.els.chkMute.checked = opts.mute;
        this.els.sldSfx.value = opts.sfxVolume !== undefined ? opts.sfxVolume : 1.0;
        this.els.sldMusic.value = opts.musicVolume !== undefined ? opts.musicVolume : 1.0;
        this.els.selShake.value = opts.shakeIntensity !== undefined ? opts.shakeIntensity : 1;
        this.els.selParticles.value = opts.particleDensity || 'high';
        this.els.chkColorblind.checked = opts.highContrast || false;
        this.els.chkFps.checked = opts.showFPS || false;
        this.els.selTouch.value = opts.touchMode || 'auto';
        this.els.chkTouchSwap.checked = opts.touchSwap || false;
    }
    bindEvents() {
        if(!this.els.btnSettings) return;
        this.els.btnSettings.addEventListener('click', () => {
            this.els.titleScreen.classList.remove('active');
            this.els.settingsScreen.classList.add('active');
        });
        this.els.btnCloseSettings.addEventListener('click', () => {
            this.els.settingsScreen.classList.remove('active');
            this.els.titleScreen.classList.add('active');
            this.applySettings();
        });
        this.els.btnMilestones.addEventListener('click', () => {
            this.els.titleScreen.classList.remove('active');
            this.els.milestonesScreen.classList.add('active');
            this.renderMilestones();
        });
        this.els.btnCloseMilestones.addEventListener('click', () => {
            this.els.milestonesScreen.classList.remove('active');
            this.els.titleScreen.classList.add('active');
        });

        this.els.chkMute.addEventListener('change', () => this.applySettings());
        this.els.sldSfx.addEventListener('input', () => this.applySettings());
        this.els.sldMusic.addEventListener('input', () => this.applySettings());
        this.els.selShake.addEventListener('change', () => this.applySettings());
        this.els.selParticles.addEventListener('change', () => this.applySettings());
        this.els.chkColorblind.addEventListener('change', () => this.applySettings());
        this.els.chkFps.addEventListener('change', () => this.applySettings());
        this.els.selTouch.addEventListener('change', () => this.applySettings());
        this.els.chkTouchSwap.addEventListener('change', () => this.applySettings());

        this.els.btnExportSave.addEventListener('click', () => this.exportSave());
        this.els.btnImportSave.addEventListener('click', () => {
            ++this.saveActionEpoch;
            this.els.exportText.hidden = true;
            const result = this.game.saveManager.importData(this.els.inpImportSave.value);
            this.els.saveStatus.textContent = result.message;
            if (result.ok) {
                this.updateSettingsUI();
                this.refreshPresentation();
            }
        });
        this.els.btnResetSave.addEventListener('click', () => {
            this.resetClicks++;
            if(this.resetClicks === 1) {
                this.els.btnResetSave.textContent = 'Are you sure? (Click again)';
                setTimeout(() => { this.resetClicks = 0; this.els.btnResetSave.textContent = 'Reset Save (Click 2x)'; }, 3000);
            } else if(this.resetClicks === 2) {
                localStorage.removeItem('arcade_game_082_082-dune-ammo-scramble_v1');
                location.reload();
            }
        });
    }
    async exportSave() {
        const epoch = ++this.saveActionEpoch;
        let text;
        try {
            text = this.game.saveManager.exportData();
        } catch (error) {
            this.els.exportText.hidden = true;
            this.els.saveStatus.textContent = 'Save could not be exported: size limit exceeded.';
            return;
        }
        this.els.exportText.value = text;
        this.els.exportText.hidden = false;
        try {
            if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(text);
            if (epoch !== this.saveActionEpoch) return;
            this.els.saveStatus.textContent = 'Save copied to clipboard.';
        } catch (error) {
            if (epoch !== this.saveActionEpoch) return;
            this.els.saveStatus.textContent = 'Clipboard unavailable. Select and copy the save text below.';
            this.els.exportText.focus();
            this.els.exportText.select();
        }
    }
    applySettings() {
        const opts = this.game.saveManager.data.options;
        opts.mute = this.els.chkMute.checked;
        opts.sfxVolume = parseFloat(this.els.sldSfx.value);
        opts.musicVolume = parseFloat(this.els.sldMusic.value);
        opts.shakeIntensity = parseFloat(this.els.selShake.value);
        opts.particleDensity = this.els.selParticles.value;
        opts.highContrast = this.els.chkColorblind.checked;
        opts.showFPS = this.els.chkFps.checked;
        opts.touchMode = this.els.selTouch.value;
        opts.touchSwap = this.els.chkTouchSwap.checked;
        this.game.saveManager.save();
        this.refreshPresentation();
    }
    refreshPresentation() {
        const opts = this.game.saveManager.data.options;
        if(this.game.sound) {
            this.game.sound.setVolumes(opts);
        }

        const fpsDisplay = document.getElementById('fps-display');
        if (fpsDisplay) fpsDisplay.style.display = opts.showFPS ? 'block' : 'none';
        this.updateTouchUI();
        this.updateColors();
    }
    updateColors() {
        const isHc = this.game.saveManager.data.options.highContrast;
        if (isHc) {
            document.getElementById('game-container').style.background = '#000000'; // high contrast bg
        } else {
            document.getElementById('game-container').style.background = '#d4a373';
        }
    }
    updateTouchUI() {
        const tc = document.getElementById('touch-controls');
        if (!tc) return;
        const opts = this.game.saveManager.data.options;
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

        if(opts.touchMode === 'off' || (opts.touchMode === 'auto' && !isTouch)) {
            tc.style.display = 'none';
        } else {
            tc.style.display = 'flex';
        }

        if(opts.touchSwap) {
            tc.style.flexDirection = 'row-reverse';
        } else {
            tc.style.flexDirection = 'row';
        }
    }
    renderMilestones() {
        const list = this.els.milestonesList;
        if (!list) return;
        list.innerHTML = '';
        const allMilestones = [
            { id: 'first_kill', name: 'First Blood', desc: 'Kill 1 enemy.' },
            { id: 'wave_5', name: 'Survivor', desc: 'Reach wave 5.' },
            { id: 'score_10k', name: 'High Roller', desc: 'Score 10,000 points.' },
            { id: 'combo_10', name: 'Combo Master', desc: 'Reach 10x combo.' },
            { id: 'boss_kill', name: 'Boss Slayer', desc: 'Defeat a boss.' },
            { id: 'dash_master', name: 'Untouchable', desc: 'Dash 100 times total.' }
        ];
        const unlocked = this.game.saveManager.data.unlockedMilestones || [];

        allMilestones.forEach(m => {
            const div = document.createElement('div');
            div.style.padding = '10px';
            div.style.border = '1px solid ' + (unlocked.includes(m.id) ? '#a3d473' : '#666');
            div.style.color = unlocked.includes(m.id) ? '#fff' : '#666';
            div.innerHTML = `<strong>${m.name}</strong><br><small>${m.desc}</small>`;
            list.appendChild(div);
        });
    }
    checkMilestones() {
        const sm = this.game.saveManager.data;
        const unlocked = sm.unlockedMilestones || [];
        let newUnlock = false;

        const checkAndUnlock = (id) => {
            if(!unlocked.includes(id)) {
                unlocked.push(id);
                newUnlock = true;
            }
        };

        if(sm.totalGamesPlayed > 0) checkAndUnlock('first_kill'); // approximate
        if(sm.bestWaveOrCombo >= 5) checkAndUnlock('wave_5');
        if(sm.highScore >= 10000) checkAndUnlock('score_10k');
        if(this.game.combo >= 10) checkAndUnlock('combo_10');
        if(sm.totalScoreAccumulated >= 100000) checkAndUnlock('dash_master'); // approximate

        if(newUnlock) {
            sm.unlockedMilestones = unlocked;
            this.game.saveManager.save();
        }
    }
}
