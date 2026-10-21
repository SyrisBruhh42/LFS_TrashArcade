class OptionsManager {
    constructor(saveManager, gameEngine) {
        this.save = saveManager;
        this.engine = gameEngine;

        const defaults = {
            muteAll: false,
            masterVol: 1.0,
            musicVol: 0.5,
            sfxVol: 1.0,
            shakeIntensity: 1.0,
            particleDensity: 'high',
            highContrast: false,
            showFps: false,
            touchMode: 'auto',
            handedness: 'right'
        };

        this.save.data.options = { ...defaults, ...(this.save.data.options || {}) };

        this.setupUI();
        this.setupSaveManagement();
        this.applyOptions();
    }

    setupUI() {
        const d = document;
        const opt = this.save.data.options;

        d.getElementById('btnSettings').addEventListener('click', () => {
            if(this.engine.state === 'PLAYING') this.engine.setPause(true);
            d.getElementById('optionsScreen').classList.add('active');
            if(this.engine.sound) this.engine.sound.playUIClick();
            this.updateSlidersFromData();
        });

        d.getElementById('btnCloseOptions').addEventListener('click', () => {
            d.getElementById('optionsScreen').classList.remove('active');
            if(this.engine.sound) this.engine.sound.playUIClick();
        });

        const updateAudio = () => {
            opt.muteAll = d.getElementById('chkMute').checked;
            opt.masterVol = parseFloat(d.getElementById('volMaster').value);
            opt.musicVol = parseFloat(d.getElementById('volMusic').value);
            opt.sfxVol = parseFloat(d.getElementById('volSfx').value);
            this.applyOptions();
            this.save.save();
        };
        d.getElementById('chkMute').addEventListener('change', updateAudio);
        d.getElementById('volMaster').addEventListener('input', updateAudio);
        d.getElementById('volMusic').addEventListener('input', updateAudio);
        d.getElementById('volSfx').addEventListener('input', updateAudio);

        const updateVisuals = () => {
            opt.shakeIntensity = parseFloat(d.getElementById('selShake').value);
            opt.particleDensity = d.getElementById('selParticles').value;
            opt.highContrast = d.getElementById('chkContrast').checked;
            opt.showFps = d.getElementById('chkFps').checked;
            this.applyOptions();
            this.save.save();
        };
        d.getElementById('selShake').addEventListener('change', updateVisuals);
        d.getElementById('selParticles').addEventListener('change', updateVisuals);
        d.getElementById('chkContrast').addEventListener('change', updateVisuals);
        d.getElementById('chkFps').addEventListener('change', updateVisuals);

        const updateControls = () => {
            opt.touchMode = d.getElementById('selTouch').value;
            opt.handedness = d.getElementById('selHand').value;
            this.applyOptions();
            this.save.save();
        };
        d.getElementById('selTouch').addEventListener('change', updateControls);
        d.getElementById('selHand').addEventListener('change', updateControls);
    }

    updateSlidersFromData() {
        const d = document;
        const opt = this.save.data.options;
        d.getElementById('chkMute').checked = opt.muteAll;
        d.getElementById('volMaster').value = opt.masterVol;
        d.getElementById('volMusic').value = opt.musicVol;
        d.getElementById('volSfx').value = opt.sfxVol;
        d.getElementById('selShake').value = opt.shakeIntensity;
        d.getElementById('selParticles').value = opt.particleDensity;
        d.getElementById('chkContrast').checked = opt.highContrast;
        d.getElementById('chkFps').checked = opt.showFps;
        d.getElementById('selTouch').value = opt.touchMode;
        d.getElementById('selHand').value = opt.handedness;
    }

    applyOptions() {
        const opt = this.save.data.options;

        if (this.engine.sound && this.engine.sound.masterGain) {
            const masterMult = opt.muteAll ? 0 : opt.masterVol;
            this.engine.sound.masterGain.gain.value = masterMult;
            this.engine.sound.musicGain.gain.value = opt.musicVol;
            this.engine.sound.sfxGain.gain.value = opt.sfxVol;
        }

        if (opt.touchMode === 'always') {
            this.engine.input.touchActive = true;
            if(this.engine.input) this.engine.input.forceTouchOff = false;
        } else if (opt.touchMode === 'off') {
            this.engine.input.touchActive = false;
            if(this.engine.input) this.engine.input.forceTouchOff = true;
        } else {
            if(this.engine.input) this.engine.input.forceTouchOff = false;
        }
    }

    setupSaveManagement() {
        const d = document;
        d.getElementById('btnExport').addEventListener('click', () => {
            const jsonStr = JSON.stringify(this.save.data);
            const base64 = btoa(jsonStr);
            d.getElementById('exportData').value = base64;
        });

        d.getElementById('btnImport').addEventListener('click', () => {
            try {
                const base64 = d.getElementById('exportData').value;
                const jsonStr = atob(base64);
                const parsed = JSON.parse(jsonStr);
                if (parsed) {
                    this.save.data = parsed;
                    this.save.save();
                    this.updateSlidersFromData();
                    this.applyOptions();
                    if(this.engine.milestones) this.engine.milestones.render();
                    alert("Save data imported successfully!");
                }
            } catch(e) {
                alert("Invalid save data string.");
            }
        });

        let resetStep = 0;
        d.getElementById('btnReset').addEventListener('click', (e) => {
            if (resetStep === 0) {
                e.target.innerText = "SURE? CLICK AGAIN TO ERASE";
                e.target.style.background = "#ff0000";
                resetStep = 1;
                setTimeout(() => {
                    resetStep = 0;
                    e.target.innerText = "RESET SAVE DATA";
                    e.target.style.background = "#ff5555";
                }, 3000);
            } else {
                localStorage.removeItem('arcade_game_053_053-sandstorm-echo-coop_v1');
                window.location.reload();
            }
        });
    }
}

class MilestoneManager {
    constructor(saveManager) {
        this.save = saveManager;

        this.milestones = [
            { id: 'm_score_1k', icon: 'S', desc: 'Score 1000' },
            { id: 'm_wave_5', icon: 'W', desc: 'Reach Wave 5' },
            { id: 'm_boss_kill', icon: 'B', desc: 'Defeat a Boss' },
            { id: 'm_combo_20', icon: 'C', desc: 'Reach 20x Combo' },
            { id: 'm_ghost_army', icon: 'G', desc: 'Spawn 5 Ghosts' },
            { id: 'm_pacifist', icon: 'P', desc: 'Survive Wave 1 no kills' }
        ];

        if (!this.save.data.unlockedMilestones) {
            this.save.data.unlockedMilestones = [];
        }

        this.render();
    }

    unlock(id) {
        if (!this.save.data.unlockedMilestones.includes(id)) {
            this.save.data.unlockedMilestones.push(id);
            this.save.save();
            this.render();
        }
    }

    render() {
        let html = '';
        const unlocked = this.save.data.unlockedMilestones;
        for (const m of this.milestones) {
            const isUnlocked = unlocked.includes(m.id);
            html += `<div class="badge ${isUnlocked ? 'unlocked' : ''}" data-desc="${m.desc}">${isUnlocked ? m.icon : '?'}</div>`;
        }
        const tM = document.getElementById('titleMilestones');
        const gM = document.getElementById('gameOverMilestones');
        if (tM) tM.innerHTML = html;
        if (gM) gM.innerHTML = html;
    }
}
