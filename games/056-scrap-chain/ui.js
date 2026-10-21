class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.bindEvents();
        this.updateSettingsUI();

        this.milestones = [
            { id: 'm_score_100k', name: 'Scrap Baron', desc: 'Reach 100,000 points in one run' },
            { id: 'm_combo_20', name: 'Chain Reaction', desc: 'Reach a 20x Combo' },
            { id: 'm_play_10', name: 'Junkyard Regular', desc: 'Play 10 games' },
            { id: 'm_boss_kill', name: 'Boss Slayer', desc: 'Defeat a Scrap Boss' },
            { id: 'm_tail_30', name: 'Long Tail', desc: 'Gather a tail of 30 scrap' },
            { id: 'm_dash_100', name: 'Speedster', desc: 'Dash 100 times total' }
        ];

        this.fpsCount = 0;
        this.lastFpsTime = performance.now();
        this.currentFps = 0;
    }

    bindEvents() {
        const d = document;

        d.getElementById('btnSettingsTitle').addEventListener('click', () => this.openSettings());
        d.getElementById('btnSettingsPaused').addEventListener('click', () => this.openSettings());
        d.getElementById('btnCloseSettings').addEventListener('click', () => this.closeSettings());

        // Settings bindings
        d.getElementById('setMute').addEventListener('change', (e) => this.setOption('mute', e.target.checked));
        d.getElementById('setMusicVol').addEventListener('input', (e) => this.setOption('musicVol', parseFloat(e.target.value)));
        d.getElementById('setSfxVol').addEventListener('input', (e) => this.setOption('sfxVol', parseFloat(e.target.value)));
        d.getElementById('setShake').addEventListener('change', (e) => this.setOption('shakeIntensity', parseFloat(e.target.value)));
        d.getElementById('setParticles').addEventListener('change', (e) => this.setOption('particleDensity', parseFloat(e.target.value)));
        d.getElementById('setContrast').addEventListener('change', (e) => {
            this.setOption('highContrast', e.target.checked);
            this.applyContrast();
        });
        d.getElementById('setFps').addEventListener('change', (e) => {
            this.setOption('showFps', e.target.checked);
            d.getElementById('fpsCounter').style.display = e.target.checked ? 'block' : 'none';
        });
        d.getElementById('setTouch').addEventListener('change', (e) => {
            this.setOption('touchMode', e.target.value);
            this.applyTouchSettings();
        });
        d.getElementById('setHand').addEventListener('change', (e) => {
            this.setOption('touchHand', e.target.value);
            this.applyTouchSettings();
        });

        // Save export/import/reset
        d.getElementById('btnExportSave').addEventListener('click', () => {
            const ta = d.getElementById('saveTextarea');
            ta.style.display = 'block';
            ta.value = btoa(JSON.stringify(this.engine.saveManager.data));
            ta.select();
        });
        d.getElementById('btnImportSave').addEventListener('click', () => {
            const ta = d.getElementById('saveTextarea');
            if(ta.style.display !== 'block') {
                ta.style.display = 'block';
                ta.value = '';
                ta.placeholder = 'Paste base64 save here and click Import again';
            } else {
                try {
                    const parsed = JSON.parse(atob(ta.value.trim()));
                    if(parsed) {
                        this.engine.saveManager.data = parsed;
                        this.engine.saveManager.save();
                        this.updateSettingsUI();
                        this.renderMilestones();
                        ta.value = 'Import Successful!';
                        setTimeout(() => ta.style.display = 'none', 2000);
                    }
                } catch(err) {
                    ta.value = 'Invalid Save Data';
                }
            }
        });

        const r1 = d.getElementById('btnResetSave1');
        const r2 = d.getElementById('btnResetSave2');
        r1.addEventListener('click', () => {
            r1.style.display = 'none';
            r2.style.display = 'block';
        });
        r2.addEventListener('click', () => {
            localStorage.removeItem(SAVE_KEY);
            location.reload();
        });
    }

    setOption(key, val) {
        if(!this.engine.saveManager.data.options) this.engine.saveManager.data.options = {};
        this.engine.saveManager.data.options[key] = val;
        this.engine.saveManager.save();

        // Apply immediately
        if(key === 'mute' || key === 'musicVol' || key === 'sfxVol') {
            if(this.engine.soundEngine) this.engine.soundEngine.updateVolumes();
        }
    }

    openSettings() {
        this.updateSettingsUI();
        this.previousState = this.engine.state;
        this.engine.state = 'SETTINGS';
        document.querySelectorAll('.ui-layer').forEach(el => el.classList.remove('active'));
        document.getElementById('screenSettings').classList.add('active');
    }

    closeSettings() {
        this.engine.setState(this.previousState);
    }

    updateSettingsUI() {
        const opts = this.engine.saveManager.data.options || {};

        // Defaults
        if(opts.mute === undefined) opts.mute = false;
        if(opts.musicVol === undefined) opts.musicVol = 1.0;
        if(opts.sfxVol === undefined) opts.sfxVol = 1.0;
        if(opts.shakeIntensity === undefined) opts.shakeIntensity = 1.0;
        if(opts.particleDensity === undefined) opts.particleDensity = 1.0;
        if(opts.highContrast === undefined) opts.highContrast = false;
        if(opts.showFps === undefined) opts.showFps = false;
        if(opts.touchMode === undefined) opts.touchMode = 'auto';
        if(opts.touchHand === undefined) opts.touchHand = 'right';

        document.getElementById('setMute').checked = opts.mute;
        document.getElementById('setMusicVol').value = opts.musicVol;
        document.getElementById('setSfxVol').value = opts.sfxVol;
        document.getElementById('setShake').value = opts.shakeIntensity;
        document.getElementById('setParticles').value = opts.particleDensity;
        document.getElementById('setContrast').checked = opts.highContrast;
        document.getElementById('setFps').checked = opts.showFps;
        document.getElementById('setTouch').value = opts.touchMode;
        document.getElementById('setHand').value = opts.touchHand;

        this.applyContrast();
        document.getElementById('fpsCounter').style.display = opts.showFps ? 'block' : 'none';
        this.applyTouchSettings();
    }

    applyContrast() {
        const opts = this.engine.saveManager.data.options || {};
        const isContrast = opts.highContrast;

        if (isContrast) {
            this.engine.colors = {
                bg: '#000000',
                player: '#00FFFF',
                tether: '#FFFFFF',
                tail: '#00FF00',
                enemy: '#FF0000',
                boss: '#FF00FF',
                proj: '#FFFF00',
                text: '#FFFFFF'
            };
        } else {
            this.engine.colors = {
                bg: '#222',
                player: '#6c9b81',
                tether: '#eee',
                tail: '#6c9b81',
                enemy: '#cc6666',
                boss: '#ffaa44',
                proj: '#ffaa44',
                text: '#6c9b81'
            };
        }
    }

    applyTouchSettings() {
        const opts = this.engine.saveManager.data.options || {};
        const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        const tc = document.getElementById('touchControls');

        if(opts.touchMode === 'always' || (opts.touchMode === 'auto' && isTouch)) {
            tc.style.display = 'flex';
        } else {
            tc.style.display = 'none';
        }

        if(opts.touchHand === 'left') {
            tc.style.flexDirection = 'row-reverse';
        } else {
            tc.style.flexDirection = 'row';
        }
    }

    checkMilestones() {
        let sd = this.engine.saveManager.data;
        if(!sd.unlockedMilestones) sd.unlockedMilestones = [];
        if(!sd.dashCount) sd.dashCount = 0;

        let unlocked = false;

        const unlock = (id) => {
            if(!sd.unlockedMilestones.includes(id)) {
                sd.unlockedMilestones.push(id);
                unlocked = true;

                // Show notification
                let m = this.milestones.find(x => x.id === id);
                if(m) {
                    if(this.engine.vfxManager) this.engine.vfxManager.addFloatingText('Milestone: ' + m.name, this.engine.player.x, this.engine.player.y - 40, '#f0f', 2);
                }
            }
        };

        if(this.engine.score >= 100000) unlock('m_score_100k');
        if(this.engine.comboMultiplier >= 20) unlock('m_combo_20');
        if(sd.totalGamesPlayed >= 10) unlock('m_play_10');
        // m_boss_kill handled in boss takeDamage
        if(this.engine.tetherManager && this.engine.tetherManager.nodes.length >= 30) unlock('m_tail_30');
        if(sd.dashCount >= 100) unlock('m_dash_100');

        if(unlocked) {
            this.engine.saveManager.save();
            this.renderMilestones();
        }
    }

    renderMilestones() {
        const drawM = (containerId) => {
            const container = document.getElementById(containerId);
            if(!container) return;
            container.innerHTML = '';
            let sd = this.engine.saveManager.data;
            if(!sd.unlockedMilestones) sd.unlockedMilestones = [];

            this.milestones.forEach(m => {
                let isUnlocked = sd.unlockedMilestones.includes(m.id);
                let div = document.createElement('div');
                div.style.padding = '5px 10px';
                div.style.border = isUnlocked ? '2px solid #6c9b81' : '2px solid #444';
                div.style.color = isUnlocked ? '#eee' : '#666';
                div.style.borderRadius = '5px';
                div.style.fontSize = '0.8rem';
                div.style.textAlign = 'center';
                div.title = m.desc;
                div.innerText = m.name + (isUnlocked ? ' ✓' : '');
                container.appendChild(div);
            });
        };

        drawM('milestonesTitle');
        drawM('milestonesGameOver');
    }

    update(dt) {
        this.fpsCount++;
        let now = performance.now();
        if(now - this.lastFpsTime >= 1000) {
            this.currentFps = this.fpsCount;
            this.fpsCount = 0;
            this.lastFpsTime = now;
            let sd = this.engine.saveManager.data;
            if(sd.options && sd.options.showFps) {
                document.getElementById('fpsCounter').innerText = `FPS: ${this.currentFps}`;
            }
        }
    }
}
