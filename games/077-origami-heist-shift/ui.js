class UIManager {
    constructor(game) {
        this.game = game;
        this.options = [
            { id: 'masterMute', label: 'Master Mute', type: 'toggle' },
            { id: 'sfxVolume', label: 'SFX Volume', type: 'slider' },
            { id: 'musicVolume', label: 'Music Volume', type: 'slider' },
            { id: 'screenShake', label: 'Screen Shake', type: 'multi', values: [1.0, 0.5, 0.0] },
            { id: 'particleDensity', label: 'Particles', type: 'multi', values: ['High', 'Low'] },
            { id: 'highContrast', label: 'High Contrast', type: 'toggle' },
            { id: 'fpsCounter', label: 'FPS Counter', type: 'toggle' },
            { id: 'touchControls', label: 'Touch UI', type: 'multi', values: ['Auto', 'Always', 'Off'] },
            { id: 'touchSwap', label: 'L/R Touch Swap', type: 'toggle' }
        ];
    }
    updateSettings(input) {
        if (input.mouse.justDown) {
            const settings = this.game.saveManager.data.settings;
            const bw = this.game.baseWidth;
            const bh = this.game.baseHeight;
            let y = 100;
            for (let i = 0; i < this.options.length; i++) {
                const opt = this.options[i];
                if (input.mouse.y >= y - 15 && input.mouse.y <= y + 15) {
                    if (input.mouse.x >= bw/2 && input.mouse.x <= bw/2 + 200) {
                        if (opt.type === 'toggle') {
                            settings[opt.id] = !settings[opt.id];
                        } else if (opt.type === 'multi') {
                            let idx = opt.values.indexOf(settings[opt.id]);
                            idx = (idx + 1) % opt.values.length;
                            settings[opt.id] = opt.values[idx];
                        } else if (opt.type === 'slider') {
                            if (input.mouse.x >= bw/2 + 10 && input.mouse.x <= bw/2 + 190) {
                                const ratio = (input.mouse.x - (bw/2 + 10)) / 180;
                                settings[opt.id] = Math.round(ratio * 10) / 10;
                            }
                        }
                        this.game.saveManager.save();
                        if(this.game.sound) this.game.sound.applySettings();
                        return;
                    }
                }
                y += 40;
            }
            if (input.mouse.x >= bw/2 - 50 && input.mouse.x <= bw/2 + 50 && input.mouse.y >= bh - 60 && input.mouse.y <= bh - 20) {
                this.game.state = 0;
                this.game.sound.playClick();
                return;
            }
            if (input.mouse.x >= 20 && input.mouse.x <= 120 && input.mouse.y >= bh - 60 && input.mouse.y <= bh - 20) {
                const b64 = btoa(JSON.stringify(this.game.saveManager.data));
                prompt("Copy your save data:", b64);
                return;
            }
            if (input.mouse.x >= 140 && input.mouse.x <= 240 && input.mouse.y >= bh - 60 && input.mouse.y <= bh - 20) {
                const res = prompt("Paste your save data:");
                if (res) {
                    try {
                        const parsed = JSON.parse(atob(res));
                        this.game.saveManager.data = parsed;
                        this.game.saveManager.save();
                        alert("Loaded!");
                        if(this.game.sound) this.game.sound.applySettings();
                    } catch(e) { alert("Invalid save data."); }
                }
                return;
            }
            if (input.mouse.x >= bw - 120 && input.mouse.x <= bw - 20 && input.mouse.y >= bh - 60 && input.mouse.y <= bh - 20) {
                if (confirm("Are you sure you want to reset all data?")) {
                    if (confirm("This cannot be undone. Confirm reset?")) {
                        localStorage.removeItem('arcade_game_077_077-origami-heist-shift_v1');
                        window.location.reload();
                    }
                }
                return;
            }
        }
    }
    drawSettings(ctx) {
        const bw = this.game.baseWidth;
        const bh = this.game.baseHeight;
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0,0,bw,bh);

        ctx.fillStyle = '#fff';
        ctx.font = '32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SETTINGS', bw/2, 50);

        const settings = this.game.saveManager.data.settings;
        ctx.font = '20px sans-serif';
        let y = 100;
        for (let i = 0; i < this.options.length; i++) {
            const opt = this.options[i];
            ctx.textAlign = 'right';
            ctx.fillText(opt.label, bw/2 - 20, y);
            ctx.textAlign = 'left';

            let valText = settings[opt.id];
            if (opt.type === 'slider') {
                ctx.fillStyle = '#444';
                ctx.fillRect(bw/2 + 10, y - 15, 180, 20);
                ctx.fillStyle = '#4caf50';
                ctx.fillRect(bw/2 + 10, y - 15, 180 * valText, 20);
                valText = Math.round(valText * 100) + '%';
            } else if (opt.type === 'toggle') {
                valText = valText ? 'ON' : 'OFF';
            }
            ctx.fillStyle = '#fff';
            ctx.fillText(valText, bw/2 + 10, y);
            y += 40;
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#444';
        ctx.fillRect(bw/2 - 50, bh - 60, 100, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText('BACK', bw/2, bh - 32);

        ctx.fillStyle = '#2196f3';
        ctx.fillRect(20, bh - 60, 100, 40);
        ctx.fillRect(140, bh - 60, 100, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText('EXPORT', 70, bh - 32);
        ctx.fillText('IMPORT', 190, bh - 32);

        ctx.fillStyle = '#f44336';
        ctx.fillRect(bw - 120, bh - 60, 100, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText('RESET', bw - 70, bh - 32);
    }
    drawMilestones(ctx) {
        const m = this.game.saveManager.data.milestones;
        const badges = [
            { id: 'firstBoss', label: 'Boss 1' },
            { id: 'fiftyScore', label: '50 Pts' },
            { id: 'totalScore1000', label: '1k Pts' },
            { id: 'tenGames', label: '10 Games' },
            { id: 'upgradeMax', label: 'Max Up' },
            { id: 'speedDemon', label: 'Fast' }
        ];
        ctx.save();
        ctx.textAlign = 'center';
        ctx.font = '12px sans-serif';
        for (let i = 0; i < badges.length; i++) {
            const x = this.game.baseWidth/2 - 150 + (i * 60);
            const y = this.game.baseHeight - 120;
            ctx.fillStyle = m[badges[i].id] ? '#ffd700' : '#444';
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(badges[i].label, x, y + 35);
        }
        ctx.restore();
    }
    drawTouchControls(ctx) {
        const set = this.game.saveManager.data.settings;
        const show = set.touchControls === 'Always' || (set.touchControls === 'Auto' && 'ontouchstart' in window);
        if (!show) return;

        const swap = set.touchSwap;
        const dpad = swap ? {x: this.game.baseWidth - 100, y: this.game.baseHeight - 100} : {x: 100, y: this.game.baseHeight - 100};
        const btn = swap ? {x: 100, y: this.game.baseHeight - 100} : {x: this.game.baseWidth - 100, y: this.game.baseHeight - 100};

        ctx.save();
        ctx.globalAlpha = 0.3;

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(dpad.x, dpad.y, 60, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(dpad.x, dpad.y, 20, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(btn.x, btn.y, 40, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillText('DASH', btn.x, btn.y + 5);

        ctx.restore();
    }
    drawFPS(ctx) {
        if (this.game.saveManager.data.settings.fpsCounter) {
            ctx.fillStyle = '#0f0';
            ctx.font = '16px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`FPS: ${this.game.fps}`, this.game.baseWidth - 10, 20);
        }
    }
    checkMilestones() {
        const m = this.game.saveManager.data.milestones;
        const d = this.game.saveManager.data;
        let saved = false;
        if (!m.firstBoss && this.game.bossCount > 0) { m.firstBoss = true; saved = true; }
        if (!m.fiftyScore && this.game.score >= 50) { m.fiftyScore = true; saved = true; }
        if (!m.totalScore1000 && d.totalScoreAccumulated >= 1000) { m.totalScore1000 = true; saved = true; }
        if (!m.tenGames && d.totalGamesPlayed >= 10) { m.tenGames = true; saved = true; }
        if (!m.upgradeMax && this.game.player.speed >= 600) { m.upgradeMax = true; saved = true; }
        if (!m.speedDemon && this.game.score >= 20 && this.game.arenaRadius > 300) { m.speedDemon = true; saved = true; }
        if (saved) this.game.saveManager.save();
    }
}
