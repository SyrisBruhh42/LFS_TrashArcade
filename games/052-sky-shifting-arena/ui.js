class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.options = this.engine.saveManager.data.options || {};

        // Defaults if missing
        if (this.options.masterMute === undefined) this.options.masterMute = false;
        if (this.options.soundVol === undefined) this.options.soundVol = 1;
        if (this.options.musicVol === undefined) this.options.musicVol = 1;
        if (this.options.screenShake === undefined) this.options.screenShake = 1;
        if (this.options.particles === undefined) this.options.particles = 'high';
        if (this.options.palette === undefined) this.options.palette = 'normal';
        if (this.options.showFps === undefined) this.options.showFps = false;
        if (this.options.touchMode === undefined) this.options.touchMode = 'auto';
        if (this.options.touchSwap === undefined) this.options.touchSwap = 'right';

        // Milestones Definition
        this.milestones = [
            { id: 'm1', title: 'First Steps', req: (s) => s.totalGamesPlayed >= 1, icon: '🏃' },
            { id: 'm2', title: 'Survivor', req: (s) => s.bestWave >= 5, icon: '🛡️' },
            { id: 'm3', title: 'Boss Slayer', req: (s) => s.bestWave >= 6, icon: '⚔️' },
            { id: 'm4', title: 'High Scorer', req: (s) => s.highScore >= 10000, icon: '💯' },
            { id: 'm5', title: 'Combo Master', req: (s) => (s._maxComboAchieved || 0) >= 10, icon: '🔥' },
            { id: 'm6', title: 'Veteran', req: (s) => s.totalGamesPlayed >= 10, icon: '⭐' }
        ];

        this.fpsCounter = document.getElementById('fps-counter');
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.fpsUpdateTimer = 0;

        this.bindEvents();
        this.applySettings();
        this.renderMilestones();
    }

    bindEvents() {
        const optScreen = document.getElementById('options-screen');
        const optMasterMute = document.getElementById('opt-master-mute');
        const optSound = document.getElementById('opt-sound');
        const optMusic = document.getElementById('opt-music');
        const optShake = document.getElementById('opt-shake');
        const optParticles = document.getElementById('opt-particles');
        const optPalette = document.getElementById('opt-palette');
        const optFps = document.getElementById('opt-fps');
        const optTouchMode = document.getElementById('opt-touch-mode');
        const optTouchSwap = document.getElementById('opt-touch-swap');

        const openOptions = () => {
            optScreen.classList.remove('hidden');
            optMasterMute.checked = this.options.masterMute;
            optSound.value = this.options.soundVol;
            optMusic.value = this.options.musicVol;
            optShake.value = this.options.screenShake.toString();
            optParticles.value = this.options.particles;
            optPalette.value = this.options.palette;
            optFps.checked = this.options.showFps;
            optTouchMode.value = this.options.touchMode;
            optTouchSwap.value = this.options.touchSwap;
        };

        const saveOptions = () => {
            this.options.masterMute = optMasterMute.checked;
            this.options.soundVol = parseFloat(optSound.value);
            this.options.musicVol = parseFloat(optMusic.value);
            this.options.screenShake = parseFloat(optShake.value);
            this.options.particles = optParticles.value;
            this.options.palette = optPalette.value;
            this.options.showFps = optFps.checked;
            this.options.touchMode = optTouchMode.value;
            this.options.touchSwap = optTouchSwap.value;

            this.engine.saveManager.data.options = this.options;
            this.engine.saveManager.save();
            this.applySettings();
        };

        // UI Openers bind
        const btnOptTitle = document.getElementById('btn-options-title');
        const btnOptPause = document.getElementById('btn-options-pause');
        if (btnOptTitle) btnOptTitle.addEventListener('click', openOptions);
        if (btnOptPause) btnOptPause.addEventListener('click', openOptions);
        document.getElementById('btn-options-close').addEventListener('click', () => {
            saveOptions();
            optScreen.classList.add('hidden');
        });

        // Realtime application of some settings
        [optMasterMute, optSound, optMusic].forEach(el => {
            el.addEventListener('input', saveOptions);
        });

        // Export
        document.getElementById('btn-export-save').addEventListener('click', () => {
            const dataStr = JSON.stringify(this.engine.saveManager.data);
            const b64 = btoa(dataStr);
            const blob = new Blob([b64], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sky_shifting_arena_save_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });

        // Import
        const fileInput = document.getElementById('file-import');
        document.getElementById('btn-import-save').addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const b64 = ev.target.result;
                    const dataStr = atob(b64);
                    const parsed = JSON.parse(dataStr);
                    this.engine.saveManager.data = parsed;
                    this.engine.saveManager.save();
                    alert("Save imported successfully! Restarting game.");
                    location.reload();
                } catch (err) {
                    alert("Invalid save file.");
                }
            };
            reader.readAsText(file);
        });

        // Reset
        let resetStep = 0;
        const btnReset = document.getElementById('btn-reset-save');
        btnReset.addEventListener('click', () => {
            if (resetStep === 0) {
                btnReset.innerText = "Are you sure?";
                resetStep = 1;
                setTimeout(() => { if (resetStep === 1) { resetStep = 0; btnReset.innerText = "Reset Data"; } }, 3000);
            } else {
                localStorage.removeItem("arcade_game_052_052-sky-shifting-arena_v1");
                location.reload();
            }
        });
    }

    applySettings() {
        if (this.engine.audio.initialized) {
            this.engine.audio.updateVolumes(this.options.soundVol, this.options.musicVol);
        }

        if (this.options.palette === 'high-contrast') {
            document.body.classList.add('high-contrast');
        } else {
            document.body.classList.remove('high-contrast');
        }

        if (this.options.showFps) {
            this.fpsCounter.classList.remove('hidden');
        } else {
            this.fpsCounter.classList.add('hidden');
        }

        const tc = document.getElementById('touch-controls');
        tc.classList.remove('force-show', 'force-hidden');
        if (this.options.touchMode === 'always') {
            tc.classList.add('force-show');
        } else if (this.options.touchMode === 'off') {
            tc.classList.add('force-hidden');
        }

        if (this.options.touchSwap === 'left') {
            tc.classList.add('touch-right-mode');
        } else {
            tc.classList.remove('touch-right-mode');
        }
    }

    update() {
        // Track max combo for milestone
        if (this.engine.comboManager) {
            if (!this.engine.saveManager.data._maxComboAchieved) this.engine.saveManager.data._maxComboAchieved = 0;
            if (this.engine.comboManager.multiplier > this.engine.saveManager.data._maxComboAchieved) {
                this.engine.saveManager.data._maxComboAchieved = this.engine.comboManager.multiplier;
            }
        }

        this.checkMilestones();

        // FPS Calculation
        const now = performance.now();
        const dt = now - this.lastTime;
        this.lastTime = now;
        this.frameCount++;
        this.fpsUpdateTimer += dt;

        if (this.fpsUpdateTimer >= 1000) {
            if (this.options.showFps) {
                this.fpsCounter.innerText = `FPS: ${this.frameCount}`;
            }
            this.frameCount = 0;
            this.fpsUpdateTimer = 0;
        }
    }

    checkMilestones() {
        let newlyUnlocked = false;
        if (!this.engine.saveManager.data.unlockedMilestones) {
            this.engine.saveManager.data.unlockedMilestones = [];
        }

        for (const m of this.milestones) {
            if (!this.engine.saveManager.data.unlockedMilestones.includes(m.id)) {
                if (m.req(this.engine.saveManager.data)) {
                    this.engine.saveManager.data.unlockedMilestones.push(m.id);
                    newlyUnlocked = true;
                }
            }
        }

        if (newlyUnlocked) {
            this.engine.saveManager.save();
            this.renderMilestones();
        }
    }

    renderMilestones() {
        const html = this.milestones.map(m => {
            const unlocked = this.engine.saveManager.data.unlockedMilestones && this.engine.saveManager.data.unlockedMilestones.includes(m.id);
            return `<div class="milestone-badge ${unlocked ? 'unlocked' : ''}" data-title="${m.title}">${unlocked ? m.icon : '?'}</div>`;
        }).join('');

        const titleM = document.getElementById('title-milestones');
        if (titleM) titleM.innerHTML = html;
        const gameOverM = document.getElementById('game-over-milestones');
        if (gameOverM) gameOverM.innerHTML = html;
    }
}

// Inject UIManager into the game loop via Monkey Patching
window.addEventListener('DOMContentLoaded', () => {
    // Wait slightly to ensure engine is initialized
    setTimeout(() => {
        if (window.engine) {
            window.uiManager = new UIManager(window.engine);

            // Patch loop to call UI update
            const originalLoop = window.engine.loop;
            window.engine.loop = function(now) {
                if (window.uiManager) window.uiManager.update();
                originalLoop.call(this, now);
            };
        }
    }, 100);
});
