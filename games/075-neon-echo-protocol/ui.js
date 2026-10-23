class UIManager {
    constructor(game) {
        this.game = game;
        this.optionsOpen = false;

        // Ensure options exist
        if (!this.game.saveManager.data.options) {
            this.game.saveManager.data.options = {};
        }
        let opts = this.game.saveManager.data.options;
        opts.masterMute = opts.masterMute || false;
        opts.sfxVol = opts.sfxVol !== undefined ? opts.sfxVol : 1.0;
        opts.musicVol = opts.musicVol !== undefined ? opts.musicVol : 1.0;
        opts.screenShake = opts.screenShake !== undefined ? opts.screenShake : 1.0;
        opts.particleDensity = opts.particleDensity || 'High';
        opts.colorBlind = opts.colorBlind || false;
        opts.showFps = opts.showFps || false;
        opts.touchMode = opts.touchMode || 'Auto';
        opts.leftHanded = opts.leftHanded || false;

        this.fps = 0;
        this.frames = 0;
        this.lastFpsTime = 0;

        // Interaction areas for options
        this.buttons = [];

        this.milestones = [
            { id: 'first_blood', name: 'First Blood', desc: 'Defeat your first enemy', achieved: false },
            { id: 'wave_10', name: 'Defender', desc: 'Reach Wave 10', achieved: false },
            { id: 'score_10k', name: 'High Scorer', desc: 'Reach 10,000 Score', achieved: false },
            { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a Boss', achieved: false },
            { id: 'echo_master', name: 'Echo Master', desc: 'Deploy 50 Echoes', achieved: false },
            { id: 'combo_king', name: 'Combo King', desc: 'Reach a Combo of 20', achieved: false }
        ];

        this.loadMilestones();
    }

    loadMilestones() {
        let saved = this.game.saveManager.data.unlockedMilestones || [];
        this.milestones.forEach(m => {
            if (saved.includes(m.id)) m.achieved = true;
        });
    }

    unlockMilestone(id) {
        let m = this.milestones.find(x => x.id === id);
        if (m && !m.achieved) {
            m.achieved = true;
            this.game.saveManager.data.unlockedMilestones.push(id);
            this.game.saveManager.save();
            if (this.game.vfx) {
                this.game.vfx.spawnFloatingText(this.game.width/2, 100, `Milestone Unlocked: ${m.name}!`, '#ffff00', 3);
            }
        }
    }

    update(dt) {
        // Update FPS
        this.frames++;
        if (performance.now() - this.lastFpsTime >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastFpsTime = performance.now();
        }

        // Milestone checks
        if (this.game.score >= 10000) this.unlockMilestone('score_10k');
        if (this.game.wave >= 10) this.unlockMilestone('wave_10');
        if (this.game.progression && this.game.progression.combo >= 20) this.unlockMilestone('combo_king');
        if (this.game.saveManager.data.totalGamesPlayed > 0) this.unlockMilestone('first_blood'); // Close enough proxy
    }

    draw(ctx) {
        if (this.game.saveManager.data.options.showFps) {
            ctx.fillStyle = 'lime';
            ctx.font = '12px Courier New';
            ctx.textAlign = 'left';
            ctx.fillText(`FPS: ${this.fps}`, 10, 20);
        }

        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') {
            this.drawMilestones(ctx);
            this.drawOptionsButton(ctx);
        }

        if (this.optionsOpen) {
            this.drawOptionsMenu(ctx);
        }
    }

    drawMilestones(ctx) {
        ctx.fillStyle = 'white';
        ctx.font = '14px Courier New';
        ctx.textAlign = 'center';
        let y = this.game.height - 100;
        ctx.fillText("MILESTONES", this.game.width/2, y);
        y += 20;
        let count = 0;
        let line = "";
        this.milestones.forEach((m, i) => {
            let color = m.achieved ? '#00ff00' : '#555555';
            ctx.fillStyle = color;
            ctx.fillText(`[${m.name}]`, this.game.width/2 - 150 + (i%3)*150, y + Math.floor(i/3)*20);
        });
    }

    drawOptionsButton(ctx) {
        ctx.fillStyle = '#ff62ac';
        ctx.fillRect(this.game.width - 100, 10, 90, 30);
        ctx.fillStyle = 'white';
        ctx.font = '14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText("OPTIONS", this.game.width - 55, 30);
    }

    drawOptionsMenu(ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        ctx.fillStyle = '#ff62ac';
        ctx.font = '24px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText("OPTIONS", this.game.width/2, 50);

        let opts = this.game.saveManager.data.options;
        ctx.font = '16px Courier New';

        let y = 100;
        this.buttons = [];

        const addBtn = (label, val, ypos, key, type, extra) => {
            ctx.fillStyle = 'white';
            ctx.textAlign = 'right';
            ctx.fillText(label + ":", this.game.width/2 - 20, ypos);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#00ffff';
            ctx.fillText(val, this.game.width/2 + 20, ypos);
            this.buttons.push({x: this.game.width/2 + 20, y: ypos - 15, w: 100, h: 20, key: key, type: type, extra: extra});
        };

        addBtn("Master Mute", opts.masterMute ? "ON" : "OFF", y, 'masterMute', 'bool'); y += 30;
        addBtn("SFX Volume", Math.round(opts.sfxVol * 100) + "%", y, 'sfxVol', 'cycle', [0, 0.25, 0.5, 0.75, 1.0]); y += 30;
        addBtn("Music Volume", Math.round(opts.musicVol * 100) + "%", y, 'musicVol', 'cycle', [0, 0.25, 0.5, 0.75, 1.0]); y += 30;

        let shakeStr = opts.screenShake === 1 ? "100%" : (opts.screenShake === 0.5 ? "50%" : "OFF");
        addBtn("Screen Shake", shakeStr, y, 'screenShake', 'cycle', [1.0, 0.5, 0]); y += 30;

        addBtn("Particles", opts.particleDensity, y, 'particleDensity', 'cycle', ['High', 'Low']); y += 30;
        addBtn("Colorblind Mode", opts.colorBlind ? "ON" : "OFF", y, 'colorBlind', 'bool'); y += 30;
        addBtn("Show FPS", opts.showFps ? "ON" : "OFF", y, 'showFps', 'bool'); y += 30;
        addBtn("Touch Controls", opts.touchMode, y, 'touchMode', 'cycle', ['Auto', 'Always', 'Off']); y += 30;
        addBtn("Handedness", opts.leftHanded ? "Left" : "Right", y, 'leftHanded', 'bool'); y += 30;

        y += 20;
        ctx.fillStyle = '#ff62ac';
        ctx.fillRect(this.game.width/2 - 100, y, 200, 30);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText("EXPORT SAVE (Base64)", this.game.width/2, y + 20);
        this.buttons.push({x: this.game.width/2 - 100, y: y, w: 200, h: 30, key: 'export', type: 'action'});

        y += 40;
        ctx.fillStyle = '#ff62ac';
        ctx.fillRect(this.game.width/2 - 100, y, 200, 30);
        ctx.fillStyle = 'white';
        ctx.fillText("IMPORT SAVE (Prompt)", this.game.width/2, y + 20);
        this.buttons.push({x: this.game.width/2 - 100, y: y, w: 200, h: 30, key: 'import', type: 'action'});

        y += 40;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(this.game.width/2 - 100, y, 200, 30);
        ctx.fillStyle = 'white';
        ctx.fillText(this.resetPending ? "CLICK AGAIN TO RESET" : "RESET SAVE DATA", this.game.width/2, y + 20);
        this.buttons.push({x: this.game.width/2 - 100, y: y, w: 200, h: 30, key: 'reset', type: 'action'});

        y += 40;
        ctx.fillStyle = '#555555';
        ctx.fillRect(this.game.width/2 - 50, y, 100, 30);
        ctx.fillStyle = 'white';
        ctx.fillText("CLOSE", this.game.width/2, y + 20);
        this.buttons.push({x: this.game.width/2 - 50, y: y, w: 100, h: 30, key: 'close', type: 'action'});
    }

    handleClick(x, y) {
        if (!this.optionsOpen) {
            if (x > this.game.width - 100 && x < this.game.width - 10 && y > 10 && y < 40) {
                this.optionsOpen = true;
                this.resetPending = false;
                return true;
            }
            return false;
        }

        let opts = this.game.saveManager.data.options;

        for (let b of this.buttons) {
            if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) {
                if (b.type === 'bool') {
                    opts[b.key] = !opts[b.key];
                } else if (b.type === 'cycle') {
                    let idx = b.extra.indexOf(opts[b.key]);
                    idx = (idx + 1) % b.extra.length;
                    opts[b.key] = b.extra[idx];
                } else if (b.type === 'action') {
                    if (b.key === 'close') {
                        this.optionsOpen = false;
                        this.game.saveManager.save();
                        this.game.applyOptions();
                    } else if (b.key === 'export') {
                        let b64 = btoa(JSON.stringify(this.game.saveManager.data));
                        console.log("SAVE EXPORT:", b64);
                        alert("Save exported to console and clipboard!");
                        navigator.clipboard.writeText(b64).catch(e=>{});
                    } else if (b.key === 'import') {
                        let str = prompt("Paste Base64 Save Data:");
                        if (str) {
                            try {
                                let data = JSON.parse(atob(str));
                                if (data) {
                                    this.game.saveManager.data = data;
                                    this.game.saveManager.save();
                                    this.game.applyOptions();
                                    this.loadMilestones();
                                    alert("Save imported successfully!");
                                }
                            } catch(e) {
                                alert("Invalid save data.");
                            }
                        }
                    } else if (b.key === 'reset') {
                        if (this.resetPending) {
                            localStorage.removeItem(SAVE_KEY);
                            location.reload();
                        } else {
                            this.resetPending = true;
                        }
                    }
                }

                if (b.key !== 'reset') this.resetPending = false;
                this.game.saveManager.save();
                this.game.applyOptions();
                return true;
            }
        }
        return true; // absorb click if options open
    }
}
