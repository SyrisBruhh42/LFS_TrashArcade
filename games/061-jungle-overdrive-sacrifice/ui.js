class UIManager {
    static initSettings(saveData) {
        if (!saveData.settings) {
            saveData.settings = {
                masterMute: false,
                sfxVolume: 0.8,
                musicVolume: 0.6,
                screenShake: '100%',
                particleDensity: 'High',
                highContrast: false,
                showFPS: false,
                touchControls: 'Auto',
                touchHandedness: 'Right'
            };
        }
        if (!saveData.milestones) {
            saveData.milestones = {
                firstBlood: false,
                comboMaster: false,
                overdriven: false,
                untouchable: false,
                bossSlayer: false,
                sacrificialLamb: false
            };
        }
    }

    static drawSettings(ctx, game, width, height) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '30px Arial';
        ctx.fillText('SETTINGS', width/2, 50);

        const settings = game.saveManager.data.settings;
        let y = 100;
        const s = 40;

        ctx.font = '20px Arial';
        this.drawButton(ctx, `Master Mute: ${settings.masterMute ? 'ON' : 'OFF'}`, width/2, y, settings.masterMute ? '#f55' : '#5f5');
        y += s;
        this.drawButton(ctx, `Music Volume: ${Math.round(settings.musicVolume * 100)}%`, width/2, y, '#aaa');
        y += s;
        this.drawButton(ctx, `SFX Volume: ${Math.round(settings.sfxVolume * 100)}%`, width/2, y, '#aaa');
        y += s;
        this.drawButton(ctx, `Screen Shake: ${settings.screenShake}`, width/2, y, '#aaa');
        y += s;
        this.drawButton(ctx, `Particles: ${settings.particleDensity}`, width/2, y, '#aaa');
        y += s;
        this.drawButton(ctx, `High Contrast: ${settings.highContrast ? 'ON' : 'OFF'}`, width/2, y, settings.highContrast ? '#f55' : '#aaa');
        y += s;
        this.drawButton(ctx, `Show FPS: ${settings.showFPS ? 'ON' : 'OFF'}`, width/2, y, settings.showFPS ? '#f55' : '#aaa');
        y += s;
        this.drawButton(ctx, `Touch Controls: ${settings.touchControls}`, width/2, y, '#aaa');
        y += s;
        this.drawButton(ctx, `Handedness: ${settings.touchHandedness}`, width/2, y, '#aaa');
        y += s;
        this.drawButton(ctx, `Export Save`, width/2, y, '#55f');
        y += s;
        this.drawButton(ctx, `Import Save`, width/2, y, '#55f');
        y += s;
        this.drawButton(ctx, game.resetStep === 1 ? `Confirm Reset?` : `Reset Save`, width/2, y, '#f55');

        ctx.fillStyle = '#fff';
        ctx.fillText('Back (Esc)', width/2, height - 30);
    }

    static drawButton(ctx, text, x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(x - 150, y - 25, 300, 35);
        ctx.fillStyle = '#000';
        ctx.fillText(text, x, y - 2);
    }

    static updateSettings(game) {
        if (!game.inputManager.tapped) return;
        game.inputManager.tapped = false;

        const x = game.inputManager.pointerX;
        const y = game.inputManager.pointerY;
        const cx = window.gameCanvas ? window.gameCanvas.width / 2 : 400; // approximation
        const cy = window.gameCanvas ? window.gameCanvas.height : 600;

        if (Math.abs(x - cx) < 150) {
            const settings = game.saveManager.data.settings;
            let idx = Math.floor((y - 75) / 40);

            if (idx === 0) settings.masterMute = !settings.masterMute;
            else if (idx === 1) settings.musicVolume = (settings.musicVolume + 0.2) % 1.2;
            else if (idx === 2) settings.sfxVolume = (settings.sfxVolume + 0.2) % 1.2;
            else if (idx === 3) settings.screenShake = settings.screenShake === '100%' ? '50%' : (settings.screenShake === '50%' ? 'Off' : '100%');
            else if (idx === 4) settings.particleDensity = settings.particleDensity === 'High' ? 'Low' : 'High';
            else if (idx === 5) settings.highContrast = !settings.highContrast;
            else if (idx === 6) settings.showFPS = !settings.showFPS;
            else if (idx === 7) settings.touchControls = settings.touchControls === 'Auto' ? 'Always' : (settings.touchControls === 'Always' ? 'Off' : 'Auto');
            else if (idx === 8) settings.touchHandedness = settings.touchHandedness === 'Right' ? 'Left' : 'Right';
            else if (idx === 9) this.exportSave(game);
            else if (idx === 10) this.importSave(game);
            else if (idx === 11) {
                if (game.resetStep === 1) {
                    game.saveManager.data = { highScore: 0, totalGamesPlayed: 0 };
                    this.initSettings(game.saveManager.data);
                    game.saveManager.save();
                    game.resetStep = 0;
                } else {
                    game.resetStep = 1;
                }
            }
            if (idx !== 11) game.resetStep = 0;

            if (idx >= 0 && idx <= 2) game.soundEngine.updateVolumes();
            game.saveManager.save();
        }

        if (y > cy - 60) {
            game.state = 'TITLE';
            game.resetStep = 0;
        }
    }

    static exportSave(game) {
        const str = btoa(JSON.stringify(game.saveManager.data));
        prompt("Copy your save data:", str);
    }

    static importSave(game) {
        const str = prompt("Paste your save data:");
        if (str) {
            try {
                const data = JSON.parse(atob(str));
                game.saveManager.data = data;
                this.initSettings(game.saveManager.data);
                game.saveManager.save();
                game.soundEngine.updateVolumes();
            } catch (e) {
                alert("Invalid save data.");
            }
        }
    }

    static drawMilestones(ctx, game, x, y) {
        const m = game.saveManager.data.milestones;
        const badges = [
            { id: 'firstBlood', name: 'First Blood (5k Score)', color: '#f55' },
            { id: 'comboMaster', name: 'Combo Master (10x)', color: '#f5f' },
            { id: 'overdriven', name: 'Overdriven', color: '#55f' },
            { id: 'untouchable', name: 'Untouchable (Wave 5 Full HP)', color: '#5f5' },
            { id: 'bossSlayer', name: 'Boss Slayer', color: '#ff5' },
            { id: 'sacrificialLamb', name: 'Sacrificial Lamb', color: '#fff' }
        ];

        ctx.font = '12px Arial';
        badges.forEach((b, i) => {
            ctx.fillStyle = m[b.id] ? b.color : '#444';
            ctx.beginPath();
            ctx.arc(x - 75 + (i%3)*75, y + Math.floor(i/3)*40, 15, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.fillText(b.name.split(' ')[0], x - 75 + (i%3)*75, y + 25 + Math.floor(i/3)*40);
        });
    }

    static drawTouchControls(ctx, game, width, height) {
        const settings = game.saveManager.data.settings;
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const shouldShow = settings.touchControls === 'Always' || (settings.touchControls === 'Auto' && isTouchDevice);

        if (!shouldShow || game.state !== 'PLAYING') return;

        const isLeft = settings.touchHandedness === 'Left';
        const strikeX = isLeft ? 80 : width - 80;
        const dashX = isLeft ? 200 : width - 200;
        const overdriveX = isLeft ? width - 80 : 80;

        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#fff';

        // Strike
        ctx.beginPath(); ctx.arc(strikeX, height - 80, 50, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText('Strike', strikeX, height - 75);

        // Dash
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(dashX, height - 80, 40, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText('Dash', dashX, height - 75);

        // Overdrive
        ctx.fillStyle = '#f55';
        ctx.beginPath(); ctx.arc(overdriveX, height - 80, 50, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText('Overdrive', overdriveX, height - 75);

        ctx.globalAlpha = 1.0;
    }

    static handleTouchInput(x, y) {
        if (!window.game || window.game.state !== 'PLAYING') return false;

        const settings = window.game.saveManager.data.settings;
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        const shouldShow = settings.touchControls === 'Always' || (settings.touchControls === 'Auto' && isTouchDevice);

        if (!shouldShow) return false;

        const w = window.gameCanvas.width;
        const h = window.gameCanvas.height;
        const isLeft = settings.touchHandedness === 'Left';

        const strikeX = isLeft ? 80 : w - 80;
        const dashX = isLeft ? 200 : w - 200;
        const overdriveX = isLeft ? w - 80 : 80;

        // Check distance to buttons
        const dist = (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2);

        if (dist(x, y, strikeX, h - 80) < 50) {
            window.game.inputManager.tapped = true;
            return true;
        }
        if (dist(x, y, dashX, h - 80) < 40) {
            window.game.inputManager.dashInput = true;
            return true;
        }
        if (dist(x, y, overdriveX, h - 80) < 50) {
            window.game.inputManager.overdriveInput = true;
            return true;
        }

        return false;
    }
}
