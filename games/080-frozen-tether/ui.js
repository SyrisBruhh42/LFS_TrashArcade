class UIManager {
    constructor(game) {
        this.game = game;
        this.touchZones = {
            left: { x: 20, y: 450, w: 100, h: 100 },
            right: { x: 140, y: 450, w: 100, h: 100 },
            jump: { x: 680, y: 450, w: 100, h: 100 },
            grapple: { x: 560, y: 450, w: 100, h: 100 }
        };
        this.buttons = [];
        this.sliders = [];
        this.milestonePopups = [];
        this.lastExportBase64 = "";

        this.initSettingsUI();

        this.milestones = [
            { id: "first_jump", name: "First Jump", desc: "Take your first leap.", achieved: false },
            { id: "grapple_king", name: "Grapple King", desc: "Grapple 10 times in one run.", achieved: false },
            { id: "high_score_1k", name: "Rookie Scorer", desc: "Reach a score of 1000.", achieved: false },
            { id: "boss_slayer", name: "Boss Slayer", desc: "Defeat a boss.", achieved: false },
            { id: "combo_master", name: "Combo Master", desc: "Reach a combo of 5.", achieved: false },
            { id: "time_lord", name: "Time Lord", desc: "Dilate time below 0.3x.", achieved: false }
        ];

        this.loadMilestones();
    }

    initSettingsUI() {
        this.buttons = [];
        this.sliders = [];

        // Left Col
        this.sliders.push({ id: 'masterVolume', x: 200, y: 150, w: 150, h: 20, val: this.game.saveManager.data.options.masterVolume || 1.0, label: "Master Vol" });
        this.sliders.push({ id: 'sfxVolume', x: 200, y: 200, w: 150, h: 20, val: this.game.saveManager.data.options.sfxVolume || 1.0, label: "SFX Vol" });
        this.sliders.push({ id: 'musicVolume', x: 200, y: 250, w: 150, h: 20, val: this.game.saveManager.data.options.musicVolume || 1.0, label: "Music Vol" });

        this.buttons.push({ id: 'mute', x: 200, y: 300, w: 150, h: 30, text: "Toggle Mute" });

        // Right Col
        this.buttons.push({ id: 'screenShake', x: 450, y: 150, w: 150, h: 30, text: "Shake: 100%" });
        this.buttons.push({ id: 'particles', x: 450, y: 200, w: 150, h: 30, text: "Particles: High" });
        this.buttons.push({ id: 'contrast', x: 450, y: 250, w: 150, h: 30, text: "High Contrast: Off" });
        this.buttons.push({ id: 'fps', x: 450, y: 300, w: 150, h: 30, text: "Show FPS: Off" });

        // Touch Col (bottom left)
        this.buttons.push({ id: 'touch', x: 200, y: 350, w: 150, h: 30, text: "Touch: Auto" });
        this.buttons.push({ id: 'swap', x: 450, y: 350, w: 150, h: 30, text: "Swap L/R: Off" });

        // Bottom Actions
        this.buttons.push({ id: 'export', x: 200, y: 400, w: 150, h: 30, text: "Export Save" });
        this.buttons.push({ id: 'import', x: 380, y: 400, w: 100, h: 30, text: "Import Save" });
        this.buttons.push({ id: 'reset', x: 500, y: 400, w: 100, h: 30, text: "Reset Game", state: 0 });

        this.updateButtonLabels();
    }

    updateButtonLabels() {
        let opts = this.game.saveManager.data.options;
        for (let b of this.buttons) {
            if (b.id === 'screenShake') b.text = `Shake: ${opts.screenShake === 1.0 ? '100%' : opts.screenShake === 0.5 ? '50%' : 'Off'}`;
            if (b.id === 'particles') b.text = `Particles: ${opts.particleDensity === 1.0 ? 'High' : 'Low'}`;
            if (b.id === 'contrast') b.text = `Contrast: ${opts.highContrast ? 'On' : 'Off'}`;
            if (b.id === 'fps') b.text = `FPS: ${opts.showFPS ? 'On' : 'Off'}`;
            if (b.id === 'touch') b.text = `Touch: ${opts.touchControls === 'auto' ? 'Auto' : opts.touchControls === 'always' ? 'Always' : 'Off'}`;
            if (b.id === 'swap') b.text = `Swap L/R: ${opts.touchSwap ? 'On' : 'Off'}`;
        }
    }

    loadMilestones() {
        let saved = this.game.saveManager.data.unlockedMilestones || [];
        for (let m of this.milestones) {
            if (saved.includes(m.id)) {
                m.achieved = true;
            }
        }
    }

    isClickInUI(mx, my) {
        if (this.game.state !== 'PAUSED') return false;

        for (let s of this.sliders) {
            if (mx >= s.x - 20 && mx <= s.x + s.w + 20 && my >= s.y - 20 && my <= s.y + s.h + 20) {
                return true;
            }
        }
        for (let b of this.buttons) {
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
                return true;
            }
        }

        // Also block the general UI area so misclicks don't instantly resume if they are close
        if (mx > 180 && mx < 620 && my > 120 && my < 450) {
            return true;
        }

        return false;
    }

    unlockMilestone(id) {
        let m = this.milestones.find(x => x.id === id);
        if (m && !m.achieved) {
            m.achieved = true;
            if (!this.game.saveManager.data.unlockedMilestones) {
                this.game.saveManager.data.unlockedMilestones = [];
            }
            this.game.saveManager.data.unlockedMilestones.push(id);
            this.game.saveManager.save();
            this.milestonePopups.push({ text: `Milestone Unlocked: ${m.name}`, timer: 3.0 });
            this.game.sound.playUI(); // use UI sound for milestone
        }
    }

    handleInput(input) {
        if (input.mouse.justPressed) {
            let mx = input.mouse.x;
            let my = input.mouse.y;

            // Sliders
            for (let s of this.sliders) {
                if (mx >= s.x && mx <= s.x + s.w && my >= s.y - 10 && my <= s.y + s.h + 10) {
                    s.val = Math.max(0, Math.min(1, (mx - s.x) / s.w));
                    let opts = this.game.saveManager.data.options;
                    if (s.id === 'masterVolume') opts.masterVolume = s.val;
                    if (s.id === 'sfxVolume') opts.sfxVolume = s.val;
                    if (s.id === 'musicVolume') opts.musicVolume = s.val;
                    this.game.saveManager.save();
                }
            }

            // Buttons
            for (let b of this.buttons) {
                if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
                    this.handleButtonClick(b);
                }
            }
        } else if (input.mouse.down) {
            let mx = input.mouse.x;
            let my = input.mouse.y;
            for (let s of this.sliders) {
                if (mx >= s.x - 20 && mx <= s.x + s.w + 20 && my >= s.y - 20 && my <= s.y + s.h + 20) {
                    s.val = Math.max(0, Math.min(1, (mx - s.x) / s.w));
                    let opts = this.game.saveManager.data.options;
                    if (s.id === 'masterVolume') opts.masterVolume = s.val;
                    if (s.id === 'sfxVolume') opts.sfxVolume = s.val;
                    if (s.id === 'musicVolume') opts.musicVolume = s.val;
                    this.game.saveManager.save();
                }
            }
        }
    }

    handleButtonClick(b) {
        let opts = this.game.saveManager.data.options;
        if (b.id === 'mute') {
            let allZero = (opts.masterVolume === 0);
            opts.masterVolume = allZero ? 1.0 : 0;
            this.sliders.find(s => s.id === 'masterVolume').val = opts.masterVolume;
        } else if (b.id === 'screenShake') {
            if (opts.screenShake === 1.0) opts.screenShake = 0.5;
            else if (opts.screenShake === 0.5) opts.screenShake = 0.0;
            else opts.screenShake = 1.0;
        } else if (b.id === 'particles') {
            opts.particleDensity = (opts.particleDensity === 1.0) ? 0.5 : 1.0;
        } else if (b.id === 'contrast') {
            opts.highContrast = !opts.highContrast;
        } else if (b.id === 'fps') {
            opts.showFPS = !opts.showFPS;
        } else if (b.id === 'touch') {
            if (opts.touchControls === 'auto') opts.touchControls = 'always';
            else if (opts.touchControls === 'always') opts.touchControls = 'off';
            else opts.touchControls = 'auto';
        } else if (b.id === 'swap') {
            opts.touchSwap = !opts.touchSwap;
        } else if (b.id === 'export') {
            let str = btoa(JSON.stringify(this.game.saveManager.data));
            this.lastExportBase64 = str;
            console.log("Exported Save:", str);
        } else if (b.id === 'import') {
            let str = prompt("Paste your Base64 save string:");
            if (str) {
                try {
                    let parsed = JSON.parse(atob(str));
                    if (parsed && parsed.options) {
                        this.game.saveManager.data = parsed;
                        this.game.saveManager.save();
                        this.initSettingsUI();
                    }
                } catch(e) {
                    console.error("Invalid save string");
                }
            }
        } else if (b.id === 'reset') {
            if (b.state === 0) {
                b.text = "Are you sure?";
                b.state = 1;
            } else {
                this.game.saveManager.reset();
                window.location.reload();
                return;
            }
        }

        if (b.id !== 'reset' && this.buttons.find(x => x.id === 'reset').state === 1) {
            this.buttons.find(x => x.id === 'reset').state = 0;
            this.buttons.find(x => x.id === 'reset').text = "Reset Game";
        }

        this.updateButtonLabels();
        this.game.saveManager.save();
    }

    update(dt) {
        for (let i = this.milestonePopups.length - 1; i >= 0; i--) {
            this.milestonePopups[i].timer -= dt;
            if (this.milestonePopups[i].timer <= 0) {
                this.milestonePopups.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Draw Settings Menu if PAUSED
        if (this.game.state === 'PAUSED') {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0,0, this.game.logicalWidth, this.game.logicalHeight);

            ctx.fillStyle = '#fff';
            ctx.font = '32px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("PAUSED", this.game.logicalWidth/2, 60);

            ctx.font = '16px sans-serif';
            ctx.fillText("Press ESC or Click outside UI to Resume", this.game.logicalWidth/2, 90);

            // Draw Sliders
            for (let s of this.sliders) {
                ctx.fillStyle = '#555';
                ctx.fillRect(s.x, s.y, s.w, s.h);
                ctx.fillStyle = '#fff';
                ctx.fillRect(s.x, s.y, s.w * s.val, s.h);
                ctx.textAlign = 'right';
                ctx.fillText(s.label, s.x - 10, s.y + 15);
            }

            // Draw Buttons
            for (let b of this.buttons) {
                ctx.fillStyle = '#444';
                if (this.game.input.mouse.x >= b.x && this.game.input.mouse.x <= b.x + b.w &&
                    this.game.input.mouse.y >= b.y && this.game.input.mouse.y <= b.y + b.h) {
                    ctx.fillStyle = '#666';
                }
                ctx.fillRect(b.x, b.y, b.w, b.h);
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText(b.text, b.x + b.w/2, b.y + 20);
            }

            if (this.lastExportBase64) {
                ctx.font = '12px monospace';
                ctx.fillStyle = '#aaa';
                ctx.fillText("Copied to console: " + this.lastExportBase64.substring(0, 20) + "...", this.game.logicalWidth/2, 450);
            }
        }

        // Draw Milestones on Title / Game Over
        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') {
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.font = '16px sans-serif';
            ctx.fillText("Milestones:", 20, 200);
            for (let i = 0; i < this.milestones.length; i++) {
                let m = this.milestones[i];
                ctx.fillStyle = m.achieved ? '#00ff00' : '#555';
                ctx.fillText(`[${m.achieved ? 'X' : ' '}] ${m.name}`, 20, 230 + i * 25);
            }
        }

        // Draw Touch UI if active
        let opts = this.game.saveManager.data.options;
        let showTouch = (opts.touchControls === 'always') || (opts.touchControls === 'auto' && this.game.input.touch.active);

        if (showTouch && this.game.state === 'PLAYING') {
            ctx.save();
            let isSwap = opts.touchSwap;
            let lZones = [this.touchZones.left, this.touchZones.right];
            let rZones = [this.touchZones.grapple, this.touchZones.jump];
            if (isSwap) {
                rZones = [this.touchZones.left, this.touchZones.right];
                lZones = [this.touchZones.grapple, this.touchZones.jump];
            }

            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            for (let k in this.touchZones) {
                let z = this.touchZones[k];
                // Apply swap logic to drawing positions
                let drawX = z.x;
                if (isSwap) {
                    if (k === 'left' || k === 'right') drawX += 540;
                    if (k === 'jump' || k === 'grapple') drawX -= 540;
                }

                ctx.beginPath();
                ctx.arc(drawX + z.w/2, z.y + z.h/2, 40, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.textAlign = 'center';
                ctx.font = '16px sans-serif';
                ctx.fillText(k.toUpperCase(), drawX + z.w/2, z.y + z.h/2 + 5);
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
            }
            ctx.restore();
        }

        // Draw Milestone Popups
        for (let i = 0; i < this.milestonePopups.length; i++) {
            ctx.fillStyle = 'rgba(0, 100, 200, 0.8)';
            ctx.fillRect(this.game.logicalWidth / 2 - 150, 20 + i * 50, 300, 40);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.font = '16px sans-serif';
            ctx.fillText(this.milestonePopups[i].text, this.game.logicalWidth / 2, 45 + i * 50);
        }

        // Draw FPS
        if (opts.showFPS) {
            ctx.fillStyle = '#0f0';
            ctx.font = '12px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`FPS: ${Math.round(1 / this.game.lastDt)}`, this.game.logicalWidth - 10, 20);
        }
    }

    isTouchInZone(tx, ty, zoneKey) {
        let z = this.touchZones[zoneKey];
        let opts = this.game.saveManager.data.options;
        let isSwap = opts.touchSwap;

        let checkX = z.x;
        if (isSwap) {
            if (zoneKey === 'left' || zoneKey === 'right') checkX += 540;
            if (zoneKey === 'jump' || zoneKey === 'grapple') checkX -= 540;
        }

        return (tx >= checkX && tx <= checkX + z.w && ty >= z.y && ty <= z.y + z.h);
    }

    isActionDown(action) {
        let opts = this.game.saveManager.data.options;
        let useTouch = !this.game.input.pointerConsumed && (opts.touchControls === 'always' || (opts.touchControls === 'auto' && this.game.input.touch.active));

        if (action === 'left') {
            if (this.game.input.isKeyDown('KeyA') || this.game.input.isKeyDown('ArrowLeft')) return true;
            if (useTouch && this.game.input.touch.active && this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'left')) return true;
        }
        if (action === 'right') {
            if (this.game.input.isKeyDown('KeyD') || this.game.input.isKeyDown('ArrowRight')) return true;
            if (useTouch && this.game.input.touch.active && this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'right')) return true;
        }
        if (action === 'jump') {
            if (this.game.input.isKeyDown('KeyW') || this.game.input.isKeyDown('ArrowUp') || this.game.input.isKeyDown('Space')) return true;
            if (useTouch && this.game.input.touch.active && this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'jump')) return true;
        }
        if (action === 'grapple') {
            if (!this.game.input.pointerConsumed && this.game.input.mouse.down && !this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'left') &&
                !this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'right') &&
                !this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'jump') &&
                !this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'grapple')) return true;
            if (useTouch && this.game.input.touch.active && this.isTouchInZone(this.game.input.mouse.x, this.game.input.mouse.y, 'grapple')) return true;
        }
        return false;
    }
}
