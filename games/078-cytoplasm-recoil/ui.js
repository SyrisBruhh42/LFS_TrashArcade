class UIManager {
    constructor(game) {
        this.game = game;
        this.resetStep = 0;
        this.menuItems = [
            { label: "Master Mute", key: "mute", type: "toggle" },
            { label: "SFX Volume", key: "sfxVolume", type: "slider" },
            { label: "Music Volume", key: "musicVolume", type: "slider" },
            { label: "Screen Shake", key: "screenShake", type: "multi", opts: [1, 0.5, 0], labels: ["100%", "50%", "Off"] },
            { label: "Particles", key: "particleDensity", type: "multi", opts: ["high", "low"], labels: ["High", "Low"] },
            { label: "High Contrast", key: "highContrast", type: "toggle" },
            { label: "Show FPS", key: "showFPS", type: "toggle" },
            { label: "Touch Ctrls", key: "touchControls", type: "multi", opts: ["auto", "always", "off"], labels: ["Auto", "Always", "Off"] },
            { label: "Handedness", key: "touchHandedness", type: "multi", opts: ["right", "left"], labels: ["Right", "Left"] }
        ];
        this.exportString = "";
    }
    drawMilestones(ctx, x, y) {
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("Milestones:", x, y);
        let ms = this.game.saveManager.data.unlockedMilestones || [];
        const allMs = ["First Blood", "Combo Master", "Boss Slayer", "Survivor", "High Roller", "Veteran"];
        for (let i = 0; i < allMs.length; i++) {
            let unlocked = ms.includes(allMs[i]);
            ctx.fillStyle = unlocked ? '#f1c40f' : '#555';
            ctx.fillText(allMs[i], x, y + 20 + i*20);
        }
    }
    update() {
        let input = this.game.input;
        if (input.keys['Escape']) {
            input.keys['Escape'] = false;
            if (this.game.state === STATES.PLAYING) this.game.state = STATES.OPTIONS;
            else if (this.game.state === STATES.OPTIONS) this.game.state = STATES.PLAYING;
        }
        if (this.game.state === STATES.OPTIONS && input.mouse.clicked) {
            input.mouse.clicked = false;
            let mx = input.mouse.x; let my = input.mouse.y;
            let startY = 100;
            for (let i = 0; i < this.menuItems.length; i++) {
                let item = this.menuItems[i];
                let by = startY + i * 35;
                if (mx > this.game.width/2 && mx < this.game.width/2 + 200 && my > by - 20 && my < by + 10) {
                    let opt = this.game.saveManager.data.options;
                    if (item.type === "toggle") opt[item.key] = !opt[item.key];
                    else if (item.type === "multi") {
                        let idx = item.opts.indexOf(opt[item.key]);
                        opt[item.key] = item.opts[(idx + 1) % item.opts.length];
                    } else if (item.type === "slider") {
                        opt[item.key] = (opt[item.key] + 0.25) % 1.25;
                    }
                    this.game.saveManager.save();
                }
            }
            // Reset button
            if (mx > 50 && mx < 200 && my > this.game.height - 60 && my < this.game.height - 20) {
                if (this.resetStep === 0) this.resetStep = 1;
                else {
                    localStorage.removeItem("arcade_game_078_078-cytoplasm-recoil_v1");
                    location.reload();
                }
            }
            // Export
            if (mx > 250 && mx < 400 && my > this.game.height - 60 && my < this.game.height - 20) {
                this.exportString = btoa(JSON.stringify(this.game.saveManager.data));
                console.log("Exported: " + this.exportString);
            }
            // Import
            if (mx > 450 && mx < 600 && my > this.game.height - 60 && my < this.game.height - 20) {
                let pr = prompt("Paste Base64 Save String:");
                if (pr) {
                    try {
                        let parsed = JSON.parse(atob(pr));
                        if (parsed) {
                            this.game.saveManager.data = { ...this.game.saveManager.data, ...parsed };
                            this.game.saveManager.save();
                            location.reload();
                        }
                    } catch (e) { alert("Invalid save string"); }
                }
            }
            // Close options
            if (mx > this.game.width - 200 && mx < this.game.width - 50 && my > this.game.height - 60 && my < this.game.height - 20) {
                this.game.state = STATES.PLAYING;
            }
        }

        // Milestones check
        if (this.game.score > 0) this.game.saveManager.unlockMilestone("First Blood");
        if (this.game.combo >= 10) this.game.saveManager.unlockMilestone("Combo Master");
        if (this.game.saveManager.data.bestWaveOrCombo >= 1) this.game.saveManager.unlockMilestone("Boss Slayer");
        if (this.game.score >= 5000) this.game.saveManager.unlockMilestone("High Roller");
        if (this.game.saveManager.data.totalGamesPlayed >= 10) this.game.saveManager.unlockMilestone("Veteran");
    }
    drawOptions(ctx) {
        let w = this.game.width; let h = this.game.height;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#fff';
        ctx.font = '30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("OPTIONS", w/2, 50);
        ctx.font = '20px monospace';
        let startY = 100;
        let opt = this.game.saveManager.data.options;
        for (let i = 0; i < this.menuItems.length; i++) {
            let item = this.menuItems[i];
            let by = startY + i * 35;
            ctx.textAlign = 'right';
            ctx.fillText(item.label + ":", w/2 - 10, by);
            ctx.textAlign = 'left';
            let valStr = "";
            if (item.type === "toggle") valStr = opt[item.key] ? "ON" : "OFF";
            else if (item.type === "multi") {
                let idx = item.opts.indexOf(opt[item.key]);
                valStr = item.labels[idx];
            } else if (item.type === "slider") valStr = (opt[item.key] * 100).toFixed(0) + "%";
            ctx.fillStyle = '#4caf50';
            ctx.fillText(valStr, w/2 + 10, by);
            ctx.fillStyle = '#fff';
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = this.resetStep === 0 ? '#e74c3c' : '#c0392b';
        ctx.fillRect(50, h - 60, 150, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText(this.resetStep === 0 ? "Reset Save" : "Confirm?", 125, h - 35);

        ctx.fillStyle = '#3498db';
        ctx.fillRect(250, h - 60, 150, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText("Export", 325, h - 35);

        ctx.fillStyle = '#9b59b6';
        ctx.fillRect(450, h - 60, 150, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText("Import", 525, h - 35);

        ctx.fillStyle = '#555';
        ctx.fillRect(w - 200, h - 60, 150, 40);
        ctx.fillStyle = '#fff';
        ctx.fillText("Close", w - 125, h - 35);

        if (this.exportString) {
            ctx.font = '12px monospace';
            ctx.fillText("Exported to console!", 325, h - 70);
        }
    }
    drawFPS(ctx) {
        if (!this.game.saveManager.data.options.showFPS) return;
        ctx.fillStyle = '#0f0';
        ctx.font = '16px monospace';
        ctx.textAlign = 'right';
        let fps = Math.round(1 / this.game.dtFallback);
        ctx.fillText(`FPS: ${fps}`, this.game.width - 10, 20);
    }
    drawTouch(ctx) {
        let opt = this.game.saveManager.data.options;
        if (opt.touchControls === 'off') return;
        if (opt.touchControls === 'auto' && !this.game.input.joystick.active) return;

        if (this.game.input.joystick.active) {
            ctx.beginPath();
            ctx.arc(this.game.input.joystick.baseX, this.game.input.joystick.baseY, 50, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(this.game.input.joystick.curX, this.game.input.joystick.curY, 20, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
        } else if (opt.touchControls === 'always') {
            let basex = opt.touchHandedness === 'right' ? 100 : this.game.width - 100;
            let basey = this.game.height - 100;
            ctx.beginPath();
            ctx.arc(basex, basey, 50, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fill();
        }
    }
}
