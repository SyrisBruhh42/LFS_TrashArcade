class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.milestoneDefinitions = [
            { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first enemy', target: 1 },
            { id: 'combo_master', name: 'Combo Master', desc: 'Reach a 5x combo', target: 5 },
            { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a boss', target: 1 },
            { id: 'deep_diver', name: 'Deep Diver', desc: 'Reach wave 10', target: 10 },
            { id: 'survivor', name: 'Survivor', desc: 'Survive an arena shrink to 20%', target: 1 },
            { id: 'richochet_god', name: 'Ricochet God', desc: 'Achieve 10,000 score', target: 10000 }
        ];
        this.milestoneProgress = {};
        this.fpsCounter = document.createElement('div');
        this.fpsCounter.id = 'fpsCounter';
        this.fpsCounter.style.cssText = 'position: absolute; top: 10px; right: 10px; color: #0f0; font-family: monospace; z-index: 100; display: none;';
        document.getElementById('gameContainer').appendChild(this.fpsCounter);
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.bindEvents();
        this.applyOptions();
    }

    bindEvents() {
        const sm = this.engine.saveManager;
        document.getElementById('btn-options')?.addEventListener('click', () => this.showOptions());
        document.getElementById('btn-options-pause')?.addEventListener('click', () => this.showOptions());
        document.getElementById('btn-close-options')?.addEventListener('click', () => this.hideOptions());

        const muteCheck = document.getElementById('opt-masterMute');
        if (muteCheck) {
            muteCheck.checked = sm.data.options.masterMute;
            muteCheck.addEventListener('change', (e) => {
                sm.data.options.masterMute = e.target.checked;
                this.applyOptions();
                sm.save();
            });
        }

        const sfxSlider = document.getElementById('opt-sfxVolume');
        if (sfxSlider) {
            sfxSlider.value = sm.data.options.sfxVolume * 100;
            sfxSlider.addEventListener('input', (e) => {
                sm.data.options.sfxVolume = parseInt(e.target.value) / 100;
                this.applyOptions();
                sm.save();
            });
        }

        const musicSlider = document.getElementById('opt-musicVolume');
        if (musicSlider) {
            musicSlider.value = sm.data.options.musicVolume * 100;
            musicSlider.addEventListener('input', (e) => {
                sm.data.options.musicVolume = parseInt(e.target.value) / 100;
                this.applyOptions();
                sm.save();
            });
        }

        const shakeSelect = document.getElementById('opt-screenShake');
        if (shakeSelect) {
            shakeSelect.value = sm.data.options.screenShake;
            shakeSelect.addEventListener('change', (e) => {
                sm.data.options.screenShake = parseFloat(e.target.value);
                sm.save();
            });
        }

        const particlesSelect = document.getElementById('opt-particles');
        if (particlesSelect) {
            particlesSelect.value = sm.data.options.particles;
            particlesSelect.addEventListener('change', (e) => {
                sm.data.options.particles = e.target.value;
                sm.save();
            });
        }

        const contrastCheck = document.getElementById('opt-highContrast');
        if (contrastCheck) {
            contrastCheck.checked = sm.data.options.highContrast;
            contrastCheck.addEventListener('change', (e) => {
                sm.data.options.highContrast = e.target.checked;
                this.applyOptions();
                sm.save();
            });
        }

        const touchSelect = document.getElementById('opt-touchControls');
        if (touchSelect) {
            touchSelect.value = sm.data.options.touchControls;
            touchSelect.addEventListener('change', (e) => {
                sm.data.options.touchControls = e.target.value;
                this.applyOptions();
                sm.save();
            });
        }

        const fpsCheck = document.getElementById('opt-showFPS');
        if (fpsCheck) {
            fpsCheck.addEventListener('change', (e) => {
                this.fpsCounter.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        document.getElementById('btn-export-save')?.addEventListener('click', () => {
            const data = btoa(JSON.stringify(sm.data));
            prompt("Copy your save data:", data);
        });

        document.getElementById('btn-import-save')?.addEventListener('click', () => {
            const data = prompt("Paste your save data:");
            if (data) {
                try {
                    const parsed = JSON.parse(atob(data));
                    sm.data = parsed;
                    sm.save();
                    this.applyOptions();
                    alert("Save imported!");
                    window.location.reload();
                } catch (e) {
                    alert("Invalid save data!");
                }
            }
        });

        document.getElementById('btn-reset-save')?.addEventListener('click', () => {
            if (confirm("Are you sure you want to reset your save data?")) {
                if (confirm("This is irreversible. Are you absolutely sure?")) {
                    sm.data = sm.getDefaults();
                    sm.save();
                    window.location.reload();
                }
            }
        });
    }

    applyOptions() {
        const opts = this.engine.saveManager.data.options;
        if (this.engine.audio && this.engine.audio.masterGain) {
            if (opts.masterMute) {
                this.engine.audio.masterGain.gain.value = 0;
            } else {
                this.engine.audio.masterGain.gain.value = 0.6;
            }
            this.engine.audio.sfxGain.gain.value = opts.sfxVolume;
            this.engine.audio.musicGain.gain.value = opts.musicVolume;
        }

        if (opts.highContrast) {
            document.documentElement.style.setProperty('--accent', '#ff00ff');
            document.documentElement.style.setProperty('--bg', '#000000');
        } else {
            document.documentElement.style.setProperty('--accent', '#70e2f9');
            document.documentElement.style.setProperty('--bg', '#0a0e17');
        }

        const container = document.getElementById('gameContainer');
        if (opts.touchControls === 'Left') {
            container.style.flexDirection = 'row-reverse';
        } else {
            container.style.flexDirection = 'row';
        }
    }

    showOptions() {
        document.getElementById('screen-OPTIONS').classList.remove('hidden');
    }

    hideOptions() {
        document.getElementById('screen-OPTIONS').classList.add('hidden');
    }

    updateFPS(now) {
        this.frameCount++;
        if (now - this.lastTime >= 1000) {
            this.fpsCounter.innerText = `FPS: ${this.frameCount}`;
            this.frameCount = 0;
            this.lastTime = now;
        }
    }

    checkMilestone(id, amount) {
        if (!this.engine.saveManager.data.unlockedMilestones) {
            this.engine.saveManager.data.unlockedMilestones = [];
        }
        if (this.engine.saveManager.data.unlockedMilestones.includes(id)) return;

        this.milestoneProgress[id] = (this.milestoneProgress[id] || 0) + amount;
        const milestone = this.milestoneDefinitions.find(m => m.id === id);

        if (milestone && this.milestoneProgress[id] >= milestone.target) {
            this.engine.saveManager.data.unlockedMilestones.push(id);
            this.engine.saveManager.save();
            this.engine.vfxManager.spawnFloatingText(this.engine.canvas.width/2, this.engine.canvas.height/2, `MILESTONE: ${milestone.name}`, '#ffeb3b');
            this.renderMilestones();
        }
    }

    renderMilestones() {
        const msContainer = document.getElementById('milestone-list');
        if (!msContainer) return;
        msContainer.innerHTML = '';
        const unlocked = this.engine.saveManager.data.unlockedMilestones || [];
        this.milestoneDefinitions.forEach(m => {
            const div = document.createElement('div');
            div.style.color = unlocked.includes(m.id) ? '#ffeb3b' : '#888';
            div.innerText = `${m.name}: ${m.desc}`;
            msContainer.appendChild(div);
        });
    }
}
window.UIManager = UIManager;

class TutorialOverlay {
    constructor() {
        this.alpha = 1.0;
    }
    draw(ctx, engine) {
        if (engine.wave !== 1) return;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(112, 226, 249, ${this.alpha})`;
        ctx.font = 'bold 24px monospace';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;

        let hint = "";
        let yPos = engine.canvas.height / 2 - 100;

        if (!engine.player.isLaunched) {
            hint = "DRAG & RELEASE TO LAUNCH!";
        } else if (engine.score === 0) {
            hint = "BOUNCE OFF TRENCHES TO DEAL DAMAGE!";
        } else if (engine.arena.width < engine.arena.maxWidth * 0.5 && engine.score > 0) {
            hint = "DON'T LET THE TRENCH CRUSH YOU!";
        }

        if (hint) {
            this.alpha = Math.min(1.0, this.alpha + 0.05);
            ctx.fillText(hint, engine.canvas.width / 2, yPos);
            this.renderHelperIndicators(ctx, engine);
        } else {
            this.alpha = Math.max(0.0, this.alpha - 0.05);
        }

        ctx.restore();
    }

    renderHelperIndicators(ctx, engine) {
        if (!engine.player.isLaunched) {
            ctx.beginPath();
            ctx.arc(engine.player.x, engine.player.y, 40 + Math.sin(performance.now() / 200) * 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(112, 226, 249, ${this.alpha * 0.5})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(engine.player.x, engine.player.y, 30 + Math.cos(performance.now() / 200) * 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(112, 226, 249, ${this.alpha * 0.8})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (engine.score === 0) {
            // Draw indicators to the nearest wall
            const p = engine.player;
            const a = engine.arena;
            const dists = [
                p.x - a.x,
                a.x + a.width - p.x,
                p.y - a.y,
                a.y + a.height - p.y
            ];
            const minDist = Math.min(...dists);
            if (minDist < 100) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha * 0.3})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, minDist, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}
window.TutorialOverlay = TutorialOverlay;
