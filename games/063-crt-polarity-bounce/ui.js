
class UIManager {
    constructor(game) {
        this.game = game;
        this.settingsOpen = false;

        // Settings State
        if (!this.game.saveManager.data.options) this.game.saveManager.data.options = {};
        if (!this.game.saveManager.data.unlockedMilestones) this.game.saveManager.data.unlockedMilestones = [];
        if (typeof this.game.saveManager.data.totalEnemiesDefeated === 'undefined') this.game.saveManager.data.totalEnemiesDefeated = 0;
        // Master Mute, SFX/Music sliders
        if (typeof this.game.saveManager.data.options.masterMute === 'undefined') this.game.saveManager.data.options.masterMute = false;
        if (typeof this.game.saveManager.data.options.sfxVol === 'undefined') this.game.saveManager.data.options.sfxVol = 1.0;
        if (typeof this.game.saveManager.data.options.musicVol === 'undefined') this.game.saveManager.data.options.musicVol = 1.0;

        // Screen Shake (100%/50%/Off)
        if (typeof this.game.saveManager.data.options.screenShake === 'undefined') this.game.saveManager.data.options.screenShake = 1.0;
        // Particle Density (High/Low)
        if (typeof this.game.saveManager.data.options.particles === 'undefined') this.game.saveManager.data.options.particles = 'High';
        // High-Contrast/Colorblind palette mode
        if (typeof this.game.saveManager.data.options.highContrast === 'undefined') this.game.saveManager.data.options.highContrast = false;
        // Live on-screen FPS counter toggle
        if (typeof this.game.saveManager.data.options.showFps === 'undefined') this.game.saveManager.data.options.showFps = false;
        // Touch Controls (Auto/Always/Off + Left/Right handedness swap)
        if (typeof this.game.saveManager.data.options.touchControls === 'undefined') this.game.saveManager.data.options.touchControls = 'Auto';
        if (typeof this.game.saveManager.data.options.touchHand === 'undefined') this.game.saveManager.data.options.touchHand = 'Right';

        this.applySettings();

        this.milestones = [
            { id: 'first_blood', name: 'First Blood', desc: 'Score 100 points', condition: (g) => g.score >= 100 },
            { id: 'combo_master', name: 'Combo Master', desc: 'Reach 5x combo', condition: (g) => g.comboManager && g.comboManager.multiplier >= 5.0 },
            { id: 'survivor', name: 'Survivor', desc: 'Reach Wave 5', condition: (g) => g.wave >= 5 },
            { id: 'magnet_lord', name: 'Magnet Lord', desc: 'Defeat 50 enemies total', condition: (g) => g.saveManager.data.totalEnemiesDefeated >= 50 },
            { id: 'ricochet_king', name: 'Ricochet King', desc: 'Play 10 games', condition: (g) => g.saveManager.data.totalGamesPlayed >= 10 },
            { id: 'untouchable', name: 'Untouchable', desc: 'Clear a wave without taking damage', condition: (g) => g.wave > 1 && g.waveClearedNoDamageLastRound }
        ];

        if (typeof this.game.saveManager.data.totalEnemiesDefeated === 'undefined') this.game.saveManager.data.totalEnemiesDefeated = 0;

        // To track FPS
        this.lastTime = performance.now();
        this.frames = 0;
        this.fps = 0;

        // Button dimensions
        this.btnWidth = 200;
        this.btnHeight = 40;
    }

    applySettings() {
        if (this.game.sound) {
            this.game.sound.masterMute = this.game.saveManager.data.options.masterMute;
            this.game.sound.sfxVol = this.game.saveManager.data.options.sfxVol;
            this.game.sound.musicVol = this.game.saveManager.data.options.musicVol;
            if (this.game.sound.master) {
                this.game.sound.master.gain.value = this.game.sound.masterMute ? 0 : 1;
            }
        }

        if (this.game.saveManager.data.options.highContrast) {
            window.COLORS = {
                bg: '#000000',
                pos: '#ffff00', // Yellow for positive
                neg: '#0000ff', // Blue for negative
                grid: 'rgba(255, 255, 255, 0.2)',
                text: '#ffffff',
                particlePos: '#ffff88',
                particleNeg: '#8888ff'
            };
        } else {
            window.COLORS = {
                bg: '#050510',
                pos: '#e382d8',
                neg: '#00ffff',
                grid: 'rgba(50, 50, 100, 0.2)',
                text: '#ffffff',
                particlePos: '#ffb3f0',
                particleNeg: '#aaffff'
            };
        }
    }

    checkMilestones() {
        for (let m of this.milestones) {
            if (!this.game.saveManager.data.unlockedMilestones.includes(m.id)) {
                if (m.condition(this.game)) {
                    this.game.saveManager.data.unlockedMilestones.push(m.id);
                    if (this.game.vfx) {
                        this.game.vfx.addFloatingText('Milestone: ' + m.name, this.game.width/2, this.game.height/4, '#ffff00');
                    }
                    this.game.saveManager.save();
                }
            }
        }
    }

    update(dt) {
        this.frames++;
        const now = performance.now();
        if (now - this.lastTime >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastTime = now;
        }

        if (this.game.state === 'PLAYING') {
            this.checkMilestones();
        }
    }

    draw(ctx) {
        // Touch controls overlay
        this.drawTouchControls(ctx);

        // FPS Counter
        if (this.game.saveManager.data.options.showFps) {
            ctx.fillStyle = '#0f0';
            ctx.font = '16px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('FPS: ' + this.fps, 10, 20);
        }

        if (this.settingsOpen) {
            this.drawSettings(ctx);
            return; // Don't draw other UI if settings open
        }

        // Draw Settings Button on Title and Game Over
        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER' || this.game.state === 'PAUSED') {
            ctx.fillStyle = '#333';
            ctx.fillRect(this.game.width - 150, 10, 140, 40);
            ctx.fillStyle = window.COLORS.text;
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SETTINGS', this.game.width - 80, 37);
        }

        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') {
            this.drawMilestones(ctx);
        }
    }

    drawTouchControls(ctx) {
        let opt = this.game.saveManager.data.options.touchControls;
        let isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        let showTouch = (opt === 'Always') || (opt === 'Auto' && isTouch);

        if (showTouch && this.game.state === 'PLAYING') {
            let leftHand = this.game.saveManager.data.options.touchHand === 'Left';

            // Move joystick
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            let jx = leftHand ? this.game.width - 100 : 100;
            let jy = this.game.height - 100;
            ctx.arc(jx, jy, 60, 0, Math.PI*2);
            ctx.stroke();

            // Polarity swap button
            ctx.beginPath();
            let px = leftHand ? 100 : this.game.width - 100;
            let py = this.game.height - 100;
            ctx.arc(px, py, 50, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = window.COLORS.text;
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('SWAP', px, py + 5);
        }
    }

    drawMilestones(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(50, this.game.height - 160, this.game.width - 100, 140);

        ctx.fillStyle = window.COLORS.text;
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('MILESTONES', this.game.width/2, this.game.height - 135);

        ctx.font = '14px monospace';
        let startX = 80;
        let startY = this.game.height - 110;

        this.milestones.forEach((m, i) => {
            let unlocked = this.game.saveManager.data.unlockedMilestones.includes(m.id);
            ctx.fillStyle = unlocked ? window.COLORS.pos : '#555';

            let x = startX + (i % 3) * ((this.game.width - 160) / 3);
            let y = startY + Math.floor(i / 3) * 30;

            ctx.textAlign = 'left';
            ctx.fillText((unlocked ? '★ ' : '☆ ') + m.name, x, y);
        });
    }

    drawSettings(ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);

        ctx.fillStyle = window.COLORS.text;
        ctx.font = '30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SETTINGS', this.game.width/2, 60);

        let startY = 120;
        let gap = 45;
        let i = 0;

        this.drawSettingRow(ctx, 'Master Mute', this.game.saveManager.data.options.masterMute ? 'ON' : 'OFF', startY + gap * i++);
        this.drawSettingRow(ctx, 'SFX Vol', (this.game.saveManager.data.options.sfxVol * 100).toFixed(0) + '%', startY + gap * i++);
        this.drawSettingRow(ctx, 'Music Vol', (this.game.saveManager.data.options.musicVol * 100).toFixed(0) + '%', startY + gap * i++);

        let shake = this.game.saveManager.data.options.screenShake;
        let shakeText = shake === 1.0 ? '100%' : (shake === 0.5 ? '50%' : 'Off');
        this.drawSettingRow(ctx, 'Screen Shake', shakeText, startY + gap * i++);

        this.drawSettingRow(ctx, 'Particles', this.game.saveManager.data.options.particles, startY + gap * i++);
        this.drawSettingRow(ctx, 'High Contrast', this.game.saveManager.data.options.highContrast ? 'ON' : 'OFF', startY + gap * i++);
        this.drawSettingRow(ctx, 'Show FPS', this.game.saveManager.data.options.showFps ? 'ON' : 'OFF', startY + gap * i++);

        this.drawSettingRow(ctx, 'Touch Controls', this.game.saveManager.data.options.touchControls, startY + gap * i++);
        this.drawSettingRow(ctx, 'Touch Hand', this.game.saveManager.data.options.touchHand, startY + gap * i++);

        // Export/Import buttons
        let btnY = startY + gap * i + 20;
        ctx.fillStyle = '#444';
        ctx.fillRect(this.game.width/2 - 160, btnY, 140, 40);
        ctx.fillRect(this.game.width/2 + 20, btnY, 140, 40);
        ctx.fillStyle = window.COLORS.text;
        ctx.font = '18px monospace';
        ctx.fillText('EXPORT SAVE', this.game.width/2 - 90, btnY + 25);
        ctx.fillText('IMPORT SAVE', this.game.width/2 + 90, btnY + 25);

        // Reset button
        btnY += 60;
        ctx.fillStyle = '#800';
        ctx.fillRect(this.game.width/2 - 100, btnY, 200, 40);
        ctx.fillStyle = window.COLORS.text;
        ctx.fillText(this.resetStep ? 'CLICK AGAIN TO RESET' : 'RESET SAVE', this.game.width/2, btnY + 25);

        // Close button
        btnY += 60;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.game.width/2 - 100, btnY, 200, 40);
        ctx.fillStyle = window.COLORS.text;
        ctx.fillText('CLOSE', this.game.width/2, btnY + 25);
    }

    drawSettingRow(ctx, label, value, y) {
        ctx.fillStyle = window.COLORS.text;
        ctx.font = '20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(label + ':', this.game.width/2 - 20, y);

        ctx.fillStyle = window.COLORS.pos;
        ctx.textAlign = 'left';
        ctx.fillText('< ' + value + ' >', this.game.width/2 + 20, y);
    }

    handleInput(x, y) {
        if (this.settingsOpen) {
            let startY = 120;
            let gap = 45;
            let i = 0;

            // Helper for left/right click on setting
            const checkSettingClick = (idx, cbLeft, cbRight) => {
                let cy = startY + gap * idx;
                if (y > cy - 20 && y < cy + 10) {
                    if (x > this.game.width/2 + 20 && x < this.game.width/2 + 60) cbLeft();
                    else if (x > this.game.width/2 + 60) cbRight();
                    this.game.sound.playUIButtonClick();
                    this.applySettings();
                    this.game.saveManager.save();
                    return true;
                }
                return false;
            };

            if (checkSettingClick(i++, () => this.game.saveManager.data.options.masterMute = !this.game.saveManager.data.options.masterMute, () => this.game.saveManager.data.options.masterMute = !this.game.saveManager.data.options.masterMute)) return true;

            if (checkSettingClick(i++,
                () => this.game.saveManager.data.options.sfxVol = Math.max(0, this.game.saveManager.data.options.sfxVol - 0.1),
                () => this.game.saveManager.data.options.sfxVol = Math.min(1, this.game.saveManager.data.options.sfxVol + 0.1)
            )) return true;

            if (checkSettingClick(i++,
                () => this.game.saveManager.data.options.musicVol = Math.max(0, this.game.saveManager.data.options.musicVol - 0.1),
                () => this.game.saveManager.data.options.musicVol = Math.min(1, this.game.saveManager.data.options.musicVol + 0.1)
            )) return true;

            if (checkSettingClick(i++,
                () => {
                    let s = this.game.saveManager.data.options.screenShake;
                    this.game.saveManager.data.options.screenShake = s === 1.0 ? 0.5 : (s === 0.5 ? 0 : 1.0);
                },
                () => {
                    let s = this.game.saveManager.data.options.screenShake;
                    this.game.saveManager.data.options.screenShake = s === 1.0 ? 0 : (s === 0 ? 0.5 : 1.0);
                }
            )) return true;

            if (checkSettingClick(i++,
                () => this.game.saveManager.data.options.particles = this.game.saveManager.data.options.particles === 'High' ? 'Low' : 'High',
                () => this.game.saveManager.data.options.particles = this.game.saveManager.data.options.particles === 'High' ? 'Low' : 'High'
            )) return true;

            if (checkSettingClick(i++,
                () => this.game.saveManager.data.options.highContrast = !this.game.saveManager.data.options.highContrast,
                () => this.game.saveManager.data.options.highContrast = !this.game.saveManager.data.options.highContrast
            )) return true;

            if (checkSettingClick(i++,
                () => this.game.saveManager.data.options.showFps = !this.game.saveManager.data.options.showFps,
                () => this.game.saveManager.data.options.showFps = !this.game.saveManager.data.options.showFps
            )) return true;

            const touchOpts = ['Auto', 'Always', 'Off'];
            if (checkSettingClick(i++,
                () => {
                    let idx = touchOpts.indexOf(this.game.saveManager.data.options.touchControls);
                    this.game.saveManager.data.options.touchControls = touchOpts[(idx - 1 + touchOpts.length) % touchOpts.length];
                },
                () => {
                    let idx = touchOpts.indexOf(this.game.saveManager.data.options.touchControls);
                    this.game.saveManager.data.options.touchControls = touchOpts[(idx + 1) % touchOpts.length];
                }
            )) return true;

            if (checkSettingClick(i++,
                () => this.game.saveManager.data.options.touchHand = this.game.saveManager.data.options.touchHand === 'Right' ? 'Left' : 'Right',
                () => this.game.saveManager.data.options.touchHand = this.game.saveManager.data.options.touchHand === 'Right' ? 'Left' : 'Right'
            )) return true;

            // Export/Import
            let btnY = startY + gap * i + 20;
            if (y > btnY && y < btnY + 40) {
                if (x > this.game.width/2 - 160 && x < this.game.width/2 - 20) {
                    // Export
                    let b64 = btoa(JSON.stringify(this.game.saveManager.data));
                    prompt("Copy your save data:", b64);
                    return true;
                } else if (x > this.game.width/2 + 20 && x < this.game.width/2 + 160) {
                    // Import
                    let b64 = prompt("Paste your save data:");
                    if (b64) {
                        try {
                            let data = JSON.parse(atob(b64));
                            if (data) {
                                this.game.saveManager.data = data;
                                this.game.saveManager.save();
                                this.applySettings();
                                alert("Save imported!");
                            }
                        } catch(e) {
                            alert("Invalid save data!");
                        }
                    }
                    return true;
                }
            }

            // Reset
            btnY += 60;
            if (y > btnY && y < btnY + 40 && x > this.game.width/2 - 100 && x < this.game.width/2 + 100) {
                if (this.resetStep) {
                    localStorage.removeItem("arcade_game_063_063-crt-polarity-bounce_v1");
                    location.reload();
                } else {
                    this.resetStep = true;
                    setTimeout(() => this.resetStep = false, 3000);
                }
                return true;
            }

            // Close
            btnY += 60;
            if (y > btnY && y < btnY + 40 && x > this.game.width/2 - 100 && x < this.game.width/2 + 100) {
                this.settingsOpen = false;
                this.resetStep = false;
                this.game.sound.playUIButtonClick();
                return true;
            }

            return true; // Consume click if settings open
        }

        // Check Settings Button
        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER' || this.game.state === 'PAUSED') {
            if (x > this.game.width - 150 && x < this.game.width - 10 && y > 10 && y < 50) {
                this.settingsOpen = true;
                this.game.sound.playUIButtonClick();
                return true;
            }
        }

        // Touch Controls during PLAYING
        let opt = this.game.saveManager.data.options.touchControls;
        let isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        let showTouch = (opt === 'Always') || (opt === 'Auto' && isTouch);

        if (showTouch && this.game.state === 'PLAYING') {
            let leftHand = this.game.saveManager.data.options.touchHand === 'Left';

            // Polarity swap button
            let px = leftHand ? 100 : this.game.width - 100;
            let py = this.game.height - 100;

            let dist = Math.hypot(x - px, y - py);
            if (dist < 60) {
                // Return true to indicate handled, but we also want to trigger polarity swap
                // So we'll directly call player swap logic here
                if (this.game.player) {
                    this.game.player.isPos = !this.game.player.isPos;
                    this.game.sound.playSwitch();
                    if (this.game.vfx) {
                        this.game.vfx.addScreenShake(3, 0.1);
                        this.game.vfx.addFloatingText(this.game.player.isPos ? 'POS' : 'NEG', this.game.player.x, this.game.player.y - 20, this.game.player.isPos ? window.COLORS.pos : window.COLORS.neg);
                    }
                }
                return true;
            }

            // Joystick logic (simplified to just movement target)
            let jx = leftHand ? this.game.width - 100 : 100;
            let jy = this.game.height - 100;
            if (x < this.game.width/2 && !leftHand || x > this.game.width/2 && leftHand) {
                // If clicked on joystick half, let input manager handle target angle update
                // Actually, InputManager already updates pointer.x/y
                return false;
            }
        }

        return false;
    }
}
