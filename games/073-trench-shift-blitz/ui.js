class UIManager {
    constructor(engine) {
        this.engine = engine;
        this.showOptions = false;

        // Touch controls config
        if (!this.engine.saveManager.data.options) {
            this.engine.saveManager.data.options = { mute: false, musicVol: 1.0, sfxVol: 1.0, shakeIntensity: 1.0 };
        }
        this.engine.saveManager.data.options.touchMode = this.engine.saveManager.data.options.touchMode || 'auto'; // auto, always, off
        this.engine.saveManager.data.options.leftHanded = this.engine.saveManager.data.options.leftHanded || false;
        this.engine.saveManager.data.options.colorblind = this.engine.saveManager.data.options.colorblind || false;
        this.engine.saveManager.data.options.showFPS = this.engine.saveManager.data.options.showFPS || false;
        this.engine.saveManager.data.options.particleDensity = this.engine.saveManager.data.options.particleDensity || 'high';

        this.milestones = [
            { id: "score_1000", name: "Rookie Diver", desc: "Score 1000 points", check: () => this.engine.saveManager.data.highScore >= 1000 },
            { id: "score_5000", name: "Deep Sea Legend", desc: "Score 5000 points", check: () => this.engine.saveManager.data.highScore >= 5000 },
            { id: "wave_5", name: "Survivor", desc: "Reach Wave 5", check: () => this.engine.saveManager.data.bestWaveOrCombo >= 5 },
            { id: "wave_10", name: "Abyssal Master", desc: "Reach Wave 10", check: () => this.engine.saveManager.data.bestWaveOrCombo >= 10 },
            { id: "play_10", name: "Dedicated", desc: "Play 10 games", check: () => this.engine.saveManager.data.totalGamesPlayed >= 10 },
            { id: "total_10k", name: "Hoarder", desc: "Accumulate 10,000 total score", check: () => this.engine.saveManager.data.totalScoreAccumulated >= 10000 }
        ];

        this.fps = 0;
        this.frames = 0;
        this.lastFpsTime = performance.now();
        this.resetStep = 0; // 0: no reset, 1: confirm, 2: reset
        this.saveString = "";
    }

    checkMilestones() {
        let newUnlock = false;
        for (let m of this.milestones) {
            if (!this.engine.saveManager.data.unlockedMilestones.includes(m.id) && m.check()) {
                this.engine.saveManager.data.unlockedMilestones.push(m.id);
                newUnlock = true;
                // Optional: Play a sound or show a toast
            }
        }
        if (newUnlock) this.engine.saveManager.save();
    }

    updateFPS(now) {
        this.frames++;
        if (now - this.lastFpsTime >= 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastFpsTime = now;
        }
    }

    draw(ctx, width, height) {
        this.updateFPS(performance.now());

        if (this.engine.saveManager.data.options.showFPS) {
            ctx.fillStyle = "#0f0";
            ctx.font = "12px monospace";
            ctx.textAlign = "left";
            ctx.fillText(`FPS: ${this.fps}`, 10, 15);
        }

        if (this.engine.state === 'TITLE') {
            this.drawOptionsButton(ctx, width, height);
            this.drawMilestones(ctx, width, height, "TITLE");
        }

        if (this.engine.state === 'GAME_OVER') {
            this.drawMilestones(ctx, width, height, "GAME_OVER");
        }

        if (this.showOptions) {
            this.drawOptionsMenu(ctx, width, height);
        }

        this.drawTouchControls(ctx, width, height);
    }

    drawOptionsButton(ctx, width, height) {
        ctx.fillStyle = "#fff";
        ctx.font = "16px monospace";
        ctx.textAlign = "right";
        ctx.fillText("[O] Options", width - 20, 30);
    }

    drawMilestones(ctx, width, height, state) {
        let startY = state === 'TITLE' ? height * 0.7 : height * 0.8;
        ctx.textAlign = "center";
        ctx.font = "14px monospace";
        ctx.fillStyle = "#fff";
        ctx.fillText("Milestones / Badges:", width / 2, startY);

        let badges = "";
        for (let m of this.milestones) {
            if (this.engine.saveManager.data.unlockedMilestones.includes(m.id)) {
                badges += "[*] ";
            } else {
                badges += "[ ] ";
            }
        }
        ctx.fillStyle = "#ffcc00";
        ctx.fillText(badges, width / 2, startY + 20);
    }

    drawTouchControls(ctx, width, height) {
        let touchMode = this.engine.saveManager.data.options.touchMode;
        let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        if (touchMode === 'off' || (touchMode === 'auto' && !isMobile)) return;
        if (this.engine.state !== 'PLAYING') return;

        let leftHanded = this.engine.saveManager.data.options.leftHanded;

        // Draw Dash Button
        let bx = leftHanded ? 80 : width - 80;
        let by = height - 80;

        ctx.fillStyle = this.engine.player.dashActive ? "rgba(0, 255, 255, 0.4)" : (this.engine.player.dashCooldown > 0 ? "rgba(100, 100, 100, 0.4)" : "rgba(255, 255, 255, 0.2)");
        ctx.fillRect(bx - 50, by - 25, 100, 50);
        ctx.strokeStyle = this.engine.player.dashCooldown <= 0 ? "#00ffff" : "#555";
        ctx.strokeRect(bx - 50, by - 25, 100, 50);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "16px monospace";
        ctx.fillText("DASH", bx, by + 5);

        // Draw D-PAD
        let dpadX = leftHanded ? width - 100 : 100;
        let dpadY = height - 100;
        let dpadS = 40;

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(dpadX - dpadS/2, dpadY - dpadS*1.5, dpadS, dpadS); // Up
        ctx.fillRect(dpadX - dpadS/2, dpadY + dpadS*0.5, dpadS, dpadS); // Down
        ctx.fillRect(dpadX - dpadS*1.5, dpadY - dpadS/2, dpadS, dpadS); // Left
        ctx.fillRect(dpadX + dpadS*0.5, dpadY - dpadS/2, dpadS, dpadS); // Right
    }

    drawOptionsMenu(ctx, width, height) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "24px monospace";
        ctx.fillText("OPTIONS", width / 2, 50);

        let opts = this.engine.saveManager.data.options;
        let startY = 100;
        let lh = 30;

        ctx.font = "16px monospace";
        ctx.textAlign = "left";
        let x = width / 2 - 150;

        ctx.fillText(`[1] Mute: ${opts.mute ? "ON" : "OFF"}`, x, startY + lh * 0);
        ctx.fillText(`[2] Music Vol: ${(opts.musicVol * 100).toFixed(0)}%`, x, startY + lh * 1);
        ctx.fillText(`[3] SFX Vol: ${(opts.sfxVol * 100).toFixed(0)}%`, x, startY + lh * 2);

        let shakeStr = opts.shakeIntensity === 1 ? "100%" : (opts.shakeIntensity === 0.5 ? "50%" : "OFF");
        ctx.fillText(`[4] Screen Shake: ${shakeStr}`, x, startY + lh * 3);

        ctx.fillText(`[5] Particle Density: ${opts.particleDensity.toUpperCase()}`, x, startY + lh * 4);
        ctx.fillText(`[6] High Contrast: ${opts.colorblind ? "ON" : "OFF"}`, x, startY + lh * 5);
        ctx.fillText(`[7] Show FPS: ${opts.showFPS ? "ON" : "OFF"}`, x, startY + lh * 6);
        ctx.fillText(`[8] Touch Controls: ${opts.touchMode.toUpperCase()}`, x, startY + lh * 7);
        ctx.fillText(`[9] Left Handed: ${opts.leftHanded ? "ON" : "OFF"}`, x, startY + lh * 8);

        ctx.textAlign = "center";
        ctx.fillStyle = "#0ff";
        ctx.fillText(`[E] Export Save | [I] Import Save`, width / 2, startY + lh * 10);

        ctx.fillStyle = "#f55";
        if (this.resetStep === 0) {
            ctx.fillText(`[R] Reset Save Data`, width / 2, startY + lh * 11);
        } else if (this.resetStep === 1) {
            ctx.fillText(`PRESS [R] AGAIN TO CONFIRM RESET`, width / 2, startY + lh * 11);
        }

        ctx.fillStyle = "#fff";
        ctx.fillText("[O] Close Options", width / 2, height - 30);
    }

    handleInput(code) {
        if (code === 'KeyO') {
            this.showOptions = !this.showOptions;
            this.resetStep = 0;
            return true;
        }

        if (this.showOptions) {
            let opts = this.engine.saveManager.data.options;
            let updated = false;

            if (code === 'Digit1') { opts.mute = !opts.mute; updated = true; }
            if (code === 'Digit2') { opts.musicVol = opts.musicVol >= 1.0 ? 0 : opts.musicVol + 0.25; updated = true; }
            if (code === 'Digit3') { opts.sfxVol = opts.sfxVol >= 1.0 ? 0 : opts.sfxVol + 0.25; updated = true; }
            if (code === 'Digit4') {
                opts.shakeIntensity = opts.shakeIntensity === 1 ? 0.5 : (opts.shakeIntensity === 0.5 ? 0 : 1);
                updated = true;
            }
            if (code === 'Digit5') { opts.particleDensity = opts.particleDensity === 'high' ? 'low' : 'high'; updated = true; }
            if (code === 'Digit6') { opts.colorblind = !opts.colorblind; updated = true; }
            if (code === 'Digit7') { opts.showFPS = !opts.showFPS; updated = true; }
            if (code === 'Digit8') {
                let m = ['auto', 'always', 'off'];
                opts.touchMode = m[(m.indexOf(opts.touchMode) + 1) % 3];
                updated = true;
            }
            if (code === 'Digit9') { opts.leftHanded = !opts.leftHanded; updated = true; }

            if (code === 'KeyE') {
                this.exportSave();
            }
            if (code === 'KeyI') {
                this.importSave();
            }

            if (code === 'KeyR') {
                if (this.resetStep === 0) {
                    this.resetStep = 1;
                } else if (this.resetStep === 1) {
                    this.resetSave();
                    this.resetStep = 0;
                }
            } else {
                this.resetStep = 0; // Cancel reset on other keys
            }

            if (updated) {
                this.engine.saveManager.save();
                this.engine.sound.updateVolumes();
            }
            return true;
        }
        return false;
    }

    handlePointer(pointers, isDown) {
        if (!isDown) {
            this.engine.input.keysDown['ArrowRight'] = false;
            this.engine.input.keysDown['ArrowLeft'] = false;
            this.engine.input.keysDown['ArrowUp'] = false;
            this.engine.input.keysDown['ArrowDown'] = false;
            return false;
        }
        if (!isDown) return false;

        let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        let touchMode = this.engine.saveManager.data.options.touchMode;
        let showTouch = touchMode === 'always' || (touchMode === 'auto' && isMobile);
        let localHandled = false;

        if (this.engine.state === 'PLAYING' && showTouch && !this.showOptions) {
            let leftHanded = this.engine.saveManager.data.options.leftHanded;
            let width = this.engine.width;
            let height = this.engine.height;

            // Dash Button (if applicable in original game - we keep it functional if they want to dash)
            let bx = leftHanded ? 80 : width - 80;
            let by = height - 80;
            for (let p of pointers) {
                if (Math.abs(p.x - bx) < 70 && Math.abs(p.y - by) < 70) {
                    if (this.engine.player.dashCooldown <= 0) {
                        this.engine.player.dashActive = !this.engine.player.dashActive;
                        if (this.engine.player.dashActive) this.engine.sound.playDash();
                    }
                    localHandled = true;
                }
            }

            // DPAD
            let dpadX = leftHanded ? width - 100 : 100;
            let dpadY = height - 100;
            let dpadS = 40;
            for (let p of pointers) {
                let dx = p.x - dpadX;
                let dy = p.y - dpadY;
                if (Math.abs(dx) < dpadS * 2 && Math.abs(dy) < dpadS * 2) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.engine.input.keysDown[dx > 0 ? 'ArrowRight' : 'ArrowLeft'] = true;
                    } else {
                        this.engine.input.keysDown[dy > 0 ? 'ArrowDown' : 'ArrowUp'] = true;
                    }
                    localHandled = true;
                }
            }
        }
        if (!isDown) return false;
        let handled = false;

        if (this.engine.state === 'TITLE' && !this.showOptions) {
            let width = this.engine.width;
            for (let p of pointers) {
                if (p.x > width - 100 && p.y < 50) {
                    this.showOptions = true;
                    handled = true;
                }
            }
        } else if (this.showOptions) {
            let startY = 100;
            let lh = 30;
            let width = this.engine.width;
            for (let p of pointers) {
                if (p.y > this.engine.height - 50) {
                    this.showOptions = false;
                    handled = true;
                    break;
                }

                // Map taps to options based on Y coordinate
                let idx = Math.floor((p.y - startY + lh/2) / lh);
                if (idx === 0) this.handleInput('Digit1');
                else if (idx === 1) this.handleInput('Digit2');
                else if (idx === 2) this.handleInput('Digit3');
                else if (idx === 3) this.handleInput('Digit4');
                else if (idx === 4) this.handleInput('Digit5');
                else if (idx === 5) this.handleInput('Digit6');
                else if (idx === 6) this.handleInput('Digit7');
                else if (idx === 7) this.handleInput('Digit8');
                else if (idx === 8) this.handleInput('Digit9');
                else if (idx === 10) {
                    if (p.x < width / 2) this.handleInput('KeyE');
                    else this.handleInput('KeyI');
                }
                else if (idx === 11) this.handleInput('KeyR');
                handled = true;
            }
            if(localHandled) handled = true;
        }
        return handled;
    }

    exportSave() {
        let dataStr = JSON.stringify(this.engine.saveManager.data);
        let b64 = btoa(dataStr);
        prompt("Copy your save data:", b64);
    }

    importSave() {
        let b64 = prompt("Paste your save data:");
        if (b64) {
            try {
                let dataStr = atob(b64);
                let data = JSON.parse(dataStr);
                if (data && typeof data === 'object') {
                    this.engine.saveManager.data = data;
                    this.engine.saveManager.save();
                    this.engine.sound.updateVolumes();
                    alert("Save imported successfully!");
                }
            } catch (e) {
                alert("Invalid save data.");
            }
        }
    }

    resetSave() {
        this.engine.saveManager.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                mute: false,
                musicVol: 1.0,
                sfxVol: 1.0,
                shakeIntensity: 1.0,
                touchMode: 'auto',
                leftHanded: false,
                colorblind: false,
                showFPS: false,
                particleDensity: 'high'
            }
        };
        this.engine.saveManager.save();
        this.engine.sound.updateVolumes();
        alert("Save reset!");
}

    // Masterpiece Release Extras
    drawCredits(ctx, width, height) {
        if (this.engine.state === 'CREDITS') {
            ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.font = "24px monospace";
            ctx.fillText("TRENCH SHIFT BLITZ", width / 2, 80);

            ctx.font = "16px monospace";
            ctx.fillText("A 10-Session Masterpiece", width / 2, 120);

            ctx.fillStyle = "#ffcc00";
            ctx.fillText("Thanks for playing!", width / 2, 160);

            ctx.fillStyle = "#ccc";
            ctx.font = "14px monospace";
            ctx.fillText("Code, Art, Audio, Design:", width / 2, 220);
            ctx.fillText("The Factory", width / 2, 250);

            ctx.fillText("Press Space/Click to Return", width / 2, height - 60);
        }
    }

    drawStats(ctx, width, height) {
        if (this.engine.state === 'STATS') {
            ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.font = "24px monospace";
            ctx.fillText("DIVER LOG (STATS)", width / 2, 60);

            ctx.font = "16px monospace";
            ctx.textAlign = "left";
            let sx = width / 2 - 120;
            let sy = 120;
            let lh = 30;

            ctx.fillText(`High Score: ${this.engine.saveManager.data.highScore}`, sx, sy);
            ctx.fillText(`Best Wave: ${this.engine.saveManager.data.bestWaveOrCombo}`, sx, sy + lh);
            ctx.fillText(`Games Played: ${this.engine.saveManager.data.totalGamesPlayed}`, sx, sy + lh*2);
            ctx.fillText(`Total Score: ${this.engine.saveManager.data.totalScoreAccumulated}`, sx, sy + lh*3);

            ctx.textAlign = "center";
            ctx.fillStyle = "#aaa";
            ctx.fillText("Press ESC / [Back] to Return", width / 2, height - 60);
        }
    }
}
