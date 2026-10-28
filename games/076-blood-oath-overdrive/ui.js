class UIManager {
    constructor(game) {
        this.game = game;
        this.showOptions = false;
        this.frames = 0;
        this.fps = 0;
        this.lastTime = 0;
        this.milestones = [
            { id: 'first_blood', name: 'First Blood', desc: 'Defeat 1 enemy', req: (g) => g.saveManager.data.totalScoreAccumulated >= 10 },
            { id: 'apprentice', name: 'Apprentice', desc: 'Reach 500 points', req: (g) => g.saveManager.data.highScore >= 500 },
            { id: 'master', name: 'Master', desc: 'Reach 2000 points', req: (g) => g.saveManager.data.highScore >= 2000 },
            { id: 'boss_killer', name: 'Boss Killer', desc: 'Defeat a Boss', req: (g) => g.saveManager.data.bossesDefeated >= 1 },
            { id: 'overdrive_user', name: 'Overdrive', desc: 'Use Overdrive 5 times', req: (g) => g.saveManager.data.overdriveUses >= 5 },
            { id: 'veteran', name: 'Veteran', desc: 'Play 10 games', req: (g) => g.saveManager.data.totalGamesPlayed >= 10 }
        ];
        this.notification = null;
        this.notifTimer = 0;
    }
    update(dt) {
        this.frames++;
        if (Date.now() - this.lastTime > 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastTime = Date.now();
        }
        if (this.notifTimer > 0) this.notifTimer -= dt;

        if (this.game.state === 'PLAYING' || this.game.state === 'GAME_OVER') {
            for (let m of this.milestones) {
                if (!this.game.saveManager.data.unlockedMilestones.includes(m.id) && m.req(this.game)) {
                    this.game.saveManager.data.unlockedMilestones.push(m.id);
                    this.game.saveManager.save();
                    this.notification = 'Milestone Unlocked: ' + m.name;
                    this.notifTimer = 3;
                }
            }
        }
    }
    draw(ctx, canvas) {
        let opt = this.game.saveManager.data.options;
        if (opt.showFps) {
            ctx.fillStyle = opt.highContrast ? '#fff' : '#0f0';
            ctx.font = '16px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('FPS: ' + this.fps, canvas.width - 10, 20);
        }

        if (this.notifTimer > 0) {
            ctx.fillStyle = '#ff0';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.notification, canvas.width / 2, 40);
        }

        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') {
            this.drawMilestones(ctx, canvas);
            this.drawOptionsButton(ctx, canvas);
        }
        if (this.showOptions) {
            this.drawOptions(ctx, canvas);
        }

        if (this.game.state === 'PLAYING' && (opt.touchControls === 'Always' || (opt.touchControls === 'Auto' && navigator.maxTouchPoints > 0))) {
            this.drawTouchControls(ctx, canvas);
        }
    }
    drawMilestones(ctx, canvas) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Milestones', canvas.width / 2, canvas.height - 150);
        const startX = canvas.width / 2 - 125;
        let y = canvas.height - 120;
        for (let i = 0; i < this.milestones.length; i++) {
            let m = this.milestones[i];
            let unlocked = this.game.saveManager.data.unlockedMilestones.includes(m.id);
            ctx.fillStyle = unlocked ? '#ff0' : '#444';
            ctx.fillRect(startX + (i%3)*90, y + Math.floor(i/3)*40, 70, 30);
            ctx.fillStyle = unlocked ? '#000' : '#888';
            ctx.font = '10px monospace';
            ctx.fillText(unlocked ? m.name : '???', startX + (i%3)*90 + 35, y + Math.floor(i/3)*40 + 18);
        }
    }
    drawOptionsButton(ctx, canvas) {
        ctx.fillStyle = '#8b5ecb';
        ctx.fillRect(10, canvas.height - 40, 100, 30);
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('OPTIONS', 60, canvas.height - 20);
    }
    drawOptions(ctx, canvas) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '30px monospace';
        ctx.fillText('OPTIONS', canvas.width/2, 50);

        let opt = this.game.saveManager.data.options;
        ctx.font = '18px monospace';
        let y = 100;
        let x = canvas.width / 2;

        // Mute
        ctx.fillText('Master Mute: ' + (opt.mute ? 'ON' : 'OFF'), x, y); y += 40;
        // SFX
        ctx.fillText('SFX Volume: ' + Math.round(opt.sfxVol*100) + '%', x, y); y += 40;
        // Music
        ctx.fillText('Music Volume: ' + Math.round(opt.musicVol*100) + '%', x, y); y += 40;
        // Shake
        ctx.fillText('Screen Shake: ' + (opt.shakeIntensity===1?'100%':opt.shakeIntensity===0.5?'50%':'OFF'), x, y); y += 40;
        // Particles
        ctx.fillText('Particles: ' + (opt.particleDensity===1?'High':'Low'), x, y); y += 40;
        // Contrast
        ctx.fillText('High Contrast: ' + (opt.highContrast?'ON':'OFF'), x, y); y += 40;
        // FPS
        ctx.fillText('Show FPS: ' + (opt.showFps?'ON':'OFF'), x, y); y += 40;
        // Touch Mode
        ctx.fillText('Touch Mode: ' + opt.touchControls, x, y); y += 40;
        // Handedness
        ctx.fillText('Left Handed UI: ' + (opt.leftHanded?'ON':'OFF'), x, y); y += 60;

        ctx.fillStyle = '#0f0';
        ctx.fillText('EXPORT SAVE', x - 100, y);
        ctx.fillStyle = '#f90';
        ctx.fillText('IMPORT SAVE', x + 100, y);
        y += 50;

        ctx.fillStyle = '#f00';
        ctx.fillText(this.resetStep ? 'ARE YOU SURE? (TAP AGAIN)' : 'RESET DATA', x, y);
        y += 60;

        ctx.fillStyle = '#fff';
        ctx.fillText('CLOSE', x, y);
    }
    drawTouchControls(ctx, canvas) {
        let opt = this.game.saveManager.data.options;
        ctx.globalAlpha = 0.5;
        let padX = opt.leftHanded ? canvas.width - 80 : 80;
        let btnX = opt.leftHanded ? 80 : canvas.width - 80;

        // D-Pad
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(padX, canvas.height - 80, 50, 0, Math.PI*2); ctx.stroke();
        ctx.fillText('WASD', padX, canvas.height - 75);

        // Action Buttons
        ctx.beginPath(); ctx.arc(btnX, canvas.height - 120, 30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText('ATK', btnX, canvas.height - 115);

        ctx.fillStyle = '#f00';
        ctx.beginPath(); ctx.arc(btnX - 50, canvas.height - 60, 30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText('OVR', btnX - 50, canvas.height - 55);

        ctx.globalAlpha = 1.0;
    }
    handlePointer(x, y) {
        if ((this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') && !this.showOptions) {
            if (x > 10 && x < 110 && y > this.game.canvas.height - 40 && y < this.game.canvas.height - 10) {
                this.showOptions = true;
                this.resetStep = false;
                return true;
            }
        }
        if (this.showOptions) {
            let cx = this.game.canvas.width / 2;
            let opt = this.game.saveManager.data.options;

            if (y > 70 && y < 110) opt.mute = !opt.mute;
            else if (y > 110 && y < 150) { opt.sfxVol += 0.25; if (opt.sfxVol > 1) opt.sfxVol = 0; }
            else if (y > 150 && y < 190) { opt.musicVol += 0.25; if (opt.musicVol > 1) opt.musicVol = 0; }
            else if (y > 190 && y < 230) { opt.shakeIntensity = opt.shakeIntensity===1 ? 0.5 : opt.shakeIntensity===0.5 ? 0 : 1; }
            else if (y > 230 && y < 270) { opt.particleDensity = opt.particleDensity===1 ? 0.5 : 1; }
            else if (y > 270 && y < 310) { opt.highContrast = !opt.highContrast; }
            else if (y > 310 && y < 350) { opt.showFps = !opt.showFps; }
            else if (y > 350 && y < 390) { opt.touchControls = opt.touchControls==='Auto'?'Always':opt.touchControls==='Always'?'Off':'Auto'; }
            else if (y > 390 && y < 430) { opt.leftHanded = !opt.leftHanded; }

            else if (y > 470 && y < 510) {
                if (x < cx) { // EXPORT
                    prompt("Copy your save data:", btoa(JSON.stringify(this.game.saveManager.data)));
                } else { // IMPORT
                    let d = prompt("Paste your save data:");
                    if (d) {
                        try {
                            let parsed = JSON.parse(atob(d));
                            if (parsed) {
                                this.game.saveManager.data = parsed;
                                this.game.saveManager.save();
                                alert("Save imported!");
                            }
                        } catch(e) { alert("Invalid save data"); }
                    }
                }
            } else if (y > 520 && y < 560) {
                if (!this.resetStep) this.resetStep = true;
                else {
                    localStorage.removeItem('arcade_game_076_076-blood-oath-overdrive_v1');
                    location.reload();
                }
            } else if (y > 580) {
                this.showOptions = false;
                this.game.saveManager.save();
                if(this.game.sound) this.game.sound.applyVolumes(opt);
            }
            return true;
        }
        return false;
    }
}
