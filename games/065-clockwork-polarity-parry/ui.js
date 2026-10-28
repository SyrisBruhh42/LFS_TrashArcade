class UIManager {
    constructor(game) {
        this.game = game;
        this.menuIndex = 0;

        this.milestones = [
            { id: 'play_1', name: 'First Gear', desc: 'Play your first game' },
            { id: 'score_1000', name: 'Apprentice', desc: 'Score 1000 in a single run' },
            { id: 'combo_3', name: 'Combo Master', desc: 'Reach a 3.0x Combo' },
            { id: 'boss_1', name: 'Boss Slayer', desc: 'Defeat a Boss' },
            { id: 'play_10', name: 'Veteran', desc: 'Play 10 total games' },
            { id: 'total_10k', name: 'Scrap Hoarder', desc: 'Accumulate 10,000 total score' }
        ];

        this.exportString = "";
        this.resetStep = 0;
    }

    checkMilestones() {
        const data = this.game.saveManager.data;
        if (!data.unlockedMilestones) data.unlockedMilestones = [];
        const unlock = (id) => {
            if (!data.unlockedMilestones.includes(id)) {
                data.unlockedMilestones.push(id);
                this.game.saveManager.save();
                this.game.vfxManager.addPopup(this.game.width/2, this.game.height/4, "MILESTONE UNLOCKED", "#ff0", 1.5);
            }
        };

        if (data.totalGamesPlayed >= 1) unlock('play_1');
        if (data.totalGamesPlayed >= 10) unlock('play_10');
        if (this.game.score >= 1000) unlock('score_1000');
        if (data.totalScoreAccumulated >= 10000) unlock('total_10k');
        if (this.game.comboManager && this.game.comboManager.multiplier >= 3.0) unlock('combo_3');
        // boss_1 is called externally
    }

    unlockBossMilestone() {
        const data = this.game.saveManager.data;
        if (!data.unlockedMilestones) data.unlockedMilestones = [];
        if (!data.unlockedMilestones.includes('boss_1')) {
            data.unlockedMilestones.push('boss_1');
            this.game.saveManager.save();
        }
    }

    drawMilestones(ctx, x, y) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('--- MILESTONES ---', x, y);

        const unlocked = this.game.saveManager.data.unlockedMilestones || [];
        this.milestones.forEach((m, i) => {
            const isUnlocked = unlocked.includes(m.id);
            ctx.fillStyle = isUnlocked ? '#dda' : '#555';
            ctx.fillText(`${m.name} ${isUnlocked ? '(UNLOCKED)' : '(LOCKED)'}`, x, y + 25 + i * 20);
        });
    }

    drawTutorialHint(ctx, width, height, wave, playerX, playerY) {
        if (wave !== 1) return;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(width / 2 - 250, 40, 500, 100);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('--- TUTORIAL ---', width / 2, 60);
        ctx.fillText('WASD/Arrows to Move | Space/Click to Parry/Slash', width / 2, 85);
        ctx.fillText('Shift/Right-Click/Double-Tap to Switch Polarity', width / 2, 110);

        // Polarity hint near player
        ctx.font = '14px monospace';
        ctx.fillStyle = '#ff0';
        ctx.fillText('Match polarity to absorb!', playerX, playerY - 40);
        ctx.fillText('Opposite polarity to slash!', playerX, playerY - 20);
        ctx.restore();
    }


    handleInput(input) {
        const opts = this.game.saveManager.data.options;
        if (!opts.touchControls) opts.touchControls = 'Auto';
        if (!opts.touchHandedness) opts.touchHandedness = 'Right';
        if (typeof opts.screenShake === 'undefined') opts.screenShake = 1.0;
        if (!opts.particleDensity) opts.particleDensity = 'High';

        let clicked = false;
        let mx = 0, my = 0;
        if (input.mouse.down && !this.wasMouseDown) {
            clicked = true;
            mx = input.mouse.x / this.game.scale;
            my = input.mouse.y / this.game.scale;
        } else if (input.touchActive && input.touches.length > 0 && !this.wasTouchDown) {
            clicked = true;
            mx = input.touches[0].x / this.game.scale;
            my = input.touches[0].y / this.game.scale;
        }

        this.wasMouseDown = input.mouse.down;
        this.wasTouchDown = input.touchActive && input.touches.length > 0;

        if (clicked) {
            const btnWidth = 300;
            const btnHeight = 30;
            const startX = this.game.width/2 - btnWidth/2;
            let startY = 100;
            const spacing = 40;

            const buttons = [
                { label: `Master Mute: ${opts.masterMute ? 'ON' : 'OFF'}`, action: () => { opts.masterMute = !opts.masterMute; this.game.soundEngine.updateVolumes(); } },
                { label: `SFX Vol: ${(opts.sfxVolume*100).toFixed(0)}%`, action: () => { opts.sfxVolume = (opts.sfxVolume + 0.25) > 1.0 ? 0 : opts.sfxVolume + 0.25; this.game.soundEngine.updateVolumes(); } },
                { label: `Music Vol: ${(opts.musicVolume*100).toFixed(0)}%`, action: () => { opts.musicVolume = (opts.musicVolume + 0.25) > 1.0 ? 0 : opts.musicVolume + 0.25; this.game.soundEngine.updateVolumes(); } },
                { label: `Screen Shake: ${opts.screenShake === 1.0 ? '100%' : (opts.screenShake === 0.5 ? '50%' : 'OFF')}`, action: () => {
                    opts.screenShake = opts.screenShake === 1.0 ? 0.5 : (opts.screenShake === 0.5 ? 0.0 : 1.0);
                } },
                { label: `Particles: ${opts.particleDensity}`, action: () => { opts.particleDensity = opts.particleDensity === 'High' ? 'Low' : 'High'; } },
                { label: `High Contrast: ${opts.highContrast ? 'ON' : 'OFF'}`, action: () => { opts.highContrast = !opts.highContrast; } },
                { label: `FPS Counter: ${opts.fpsCounter ? 'ON' : 'OFF'}`, action: () => { opts.fpsCounter = !opts.fpsCounter; } },
                { label: `Touch: ${opts.touchControls}`, action: () => {
                    const tOpts = ['Auto', 'Always', 'Off'];
                    opts.touchControls = tOpts[(tOpts.indexOf(opts.touchControls) + 1) % tOpts.length];
                } },
                { label: `Handedness: ${opts.touchHandedness}`, action: () => { opts.touchHandedness = opts.touchHandedness === 'Right' ? 'Left' : 'Right'; } },
                { label: `Export Save`, action: () => {
                    this.exportString = btoa(JSON.stringify(this.game.saveManager.data));
                    console.log(this.exportString);
                } },
                { label: `Import Save`, action: () => {
                    const str = prompt("Paste Base64 Save String:");
                    if (str) {
                        try {
                            const parsed = JSON.parse(atob(str));
                            if (parsed) {
                                this.game.saveManager.data = parsed;
                                this.game.saveManager.save();
                                alert("Save imported!");
                            }
                        } catch(e) { alert("Invalid save string"); }
                    }
                } },
                { label: this.resetStep === 0 ? `Reset Save` : `CONFIRM RESET`, action: () => {
                    if (this.resetStep === 0) this.resetStep = 1;
                    else {
                        const SAVE_KEY = 'arcade_game_065_065-clockwork-polarity-parry_v1';
                        localStorage.removeItem(SAVE_KEY);
                        location.reload();
                    }
                } },
                { label: `Back`, action: () => { this.game.state = 'TITLE'; this.resetStep = 0; this.game.saveManager.save(); } }
            ];

            for (let i = 0; i < buttons.length; i++) {
                const btnY = startY + i * spacing;
                if (mx >= startX && mx <= startX + btnWidth && my >= btnY && my <= btnY + btnHeight) {
                    buttons[i].action();
                    return;
                }
            }
        }
    }

    drawSettings(ctx, width, height) {
        const opts = this.game.saveManager.data.options;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SETTINGS', width/2, 50);

        const btnWidth = 300;
        const btnHeight = 30;
        const startX = width/2 - btnWidth/2;
        let startY = 100;
        const spacing = 40;

        const buttons = [
            `Master Mute: ${opts.masterMute ? 'ON' : 'OFF'}`,
            `SFX Vol: ${(opts.sfxVolume*100).toFixed(0)}%`,
            `Music Vol: ${(opts.musicVolume*100).toFixed(0)}%`,
            `Screen Shake: ${opts.screenShake === 1.0 ? '100%' : (opts.screenShake === 0.5 ? '50%' : 'OFF')}`,
            `Particles: ${opts.particleDensity}`,
            `High Contrast: ${opts.highContrast ? 'ON' : 'OFF'}`,
            `FPS Counter: ${opts.fpsCounter ? 'ON' : 'OFF'}`,
            `Touch: ${opts.touchControls}`,
            `Handedness: ${opts.touchHandedness}`,
            `Export Save`,
            `Import Save`,
            this.resetStep === 0 ? `Reset Save` : `CONFIRM RESET`,
            `Back`
        ];

        for (let i = 0; i < buttons.length; i++) {
            const btnY = startY + i * spacing;
            ctx.fillStyle = '#333';
            ctx.fillRect(startX, btnY, btnWidth, btnHeight);
            ctx.strokeStyle = '#666';
            ctx.strokeRect(startX, btnY, btnWidth, btnHeight);

            ctx.fillStyle = (i === 11 && this.resetStep === 1) ? '#f44' : '#eee';
            ctx.font = '16px monospace';
            ctx.fillText(buttons[i], width/2, btnY + 20);
        }

        if (this.exportString) {
            ctx.font = '12px monospace';
            ctx.fillStyle = '#aaa';
            ctx.fillText("Check browser console for export string, or copy below:", width/2, startY + buttons.length * spacing + 20);
            ctx.fillText(this.exportString.substring(0, 40) + "...", width/2, startY + buttons.length * spacing + 40);
        }
    }
}