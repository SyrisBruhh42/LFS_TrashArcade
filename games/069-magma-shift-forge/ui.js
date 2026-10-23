class UIManager {
    constructor(game) {
        this.game = game;
        this.joystickL = { active: false, x: 0, y: 0, dx: 0, dy: 0, touchId: null };
        this.joystickR = { active: false, x: 0, y: 0, dx: 0, dy: 0, touchId: null };
        this.joystickRadius = 50;
        this.handledClick = false;
        this.inSettings = false;
        this.prevState = 'TITLE';

        this.buttons = [];
        this.setupButtons();

        // Export/Import State
        this.exportString = "";
        this.showExport = false;
        this.resetStep = 0;
    }

    setupButtons() {
        this.buttons = [];
        const btnW = 300, btnH = 40, gap = 10;
        const startX = this.game.targetWidth/2 - btnW/2;
        let startY = 100;

        const addBtn = (label, action, type='toggle', key='') => {
            this.buttons.push({x: startX, y: startY, w: btnW, h: btnH, label, action, type, key});
            startY += btnH + gap;
        };

        addBtn('Resume', () => {
            this.inSettings = false;
            this.game.state = this.prevState;
        }, 'action');

        addBtn('Master Mute', () => {
            let o = this.game.saveManager.data.options;
            o.masterMute = !o.masterMute;
            if(this.game.sound && this.game.sound.masterGain) {
                this.game.sound.masterGain.gain.value = o.masterMute ? 0 : 0.5;
            }
            this.game.saveManager.save();
        }, 'toggle', 'masterMute');

        addBtn('SFX Volume', (val) => {
            let o = this.game.saveManager.data.options;
            o.sfxVolume = val;
            this.game.saveManager.save();
        }, 'slider', 'sfxVolume');

        addBtn('Music Volume', (val) => {
            let o = this.game.saveManager.data.options;
            o.musicVolume = val;
            this.game.saveManager.save();
        }, 'slider', 'musicVolume');

        addBtn('Screen Shake', () => {
            let o = this.game.saveManager.data.options;
            if(o.shakeIntensity === 1.0) o.shakeIntensity = 0.5;
            else if(o.shakeIntensity === 0.5) o.shakeIntensity = 0.0;
            else o.shakeIntensity = 1.0;
            this.game.saveManager.save();
        }, 'multi', 'shakeIntensity');

        addBtn('Particle Density', () => {
            let o = this.game.saveManager.data.options;
            o.particleDensity = o.particleDensity === 'High' ? 'Low' : 'High';
            this.game.saveManager.save();
        }, 'multi', 'particleDensity');

        addBtn('High Contrast', () => {
            let o = this.game.saveManager.data.options;
            o.highContrast = !o.highContrast;
            this.game.saveManager.save();
        }, 'toggle', 'highContrast');

        addBtn('Show FPS', () => {
            let o = this.game.saveManager.data.options;
            o.showFPS = !o.showFPS;
            this.game.saveManager.save();
        }, 'toggle', 'showFPS');

        addBtn('Touch Mode', () => {
            let o = this.game.saveManager.data.options;
            if(o.touchMode === 'Auto') o.touchMode = 'Always';
            else if(o.touchMode === 'Always') o.touchMode = 'Off';
            else o.touchMode = 'Auto';
            this.game.saveManager.save();
        }, 'multi', 'touchMode');

        addBtn('Touch Handedness', () => {
            let o = this.game.saveManager.data.options;
            o.touchHandedness = o.touchHandedness === 'Right' ? 'Left' : 'Right';
            this.game.saveManager.save();
        }, 'multi', 'touchHandedness');

        startY += gap; // Extra space
        addBtn('Export Save', () => {
            this.exportString = btoa(JSON.stringify(this.game.saveManager.data));
            this.showExport = true;
            console.log("Save Export:", this.exportString);
        }, 'action');

        addBtn('Import Save', () => {
            let input = prompt("Paste Save Data:");
            if (input) {
                try {
                    let data = JSON.parse(atob(input));
                    if(data && data.options) {
                        this.game.saveManager.data = data;
                        this.game.saveManager.save();
                        alert("Save Loaded!");
                        location.reload();
                    }
                } catch(e) {
                    alert("Invalid Save Data");
                }
            }
        }, 'action');

        addBtn('Reset Save', () => {
            if (this.resetStep === 0) {
                this.resetStep = 1;
            } else {
                localStorage.removeItem('arcade_game_069_069-magma-shift-forge_v1');
                location.reload();
            }
        }, 'action');
    }

    isTouchMode(game) {
        let mode = game.saveManager.data.options.touchMode;
        if (mode === 'Off') return false;
        if (mode === 'Always') return true;
        // Auto: detect touch events in InputManager
        return game.input.touches && game.input.touches.length > 0;
    }

    checkMilestones(game) {
        let sm = game.saveManager;
        let unlocked = sm.data.unlockedMilestones || [];
        let newlyUnlocked = false;

        const unlock = (name) => {
            if (!unlocked.includes(name)) {
                unlocked.push(name);
                newlyUnlocked = true;
                if(game.sound) game.sound.playSFX('pickup'); // Generic good sound
            }
        };

        if (game.score > 0) unlock("First Kill");
        if (game.progression && game.progression.wave >= 3) unlock("Wave 3 Reached");
        if (game.progression && game.progression.wave > 1 && !game.bossActive) unlock("Boss Defeated"); // Rough proxy for boss beaten
        if (game.score >= 10000) unlock("10k Score");
        if (game.progression && game.progression.combo >= 10) unlock("Combo Master");
        if (game.player && game.player.maxSpeed >= 450) unlock("Max Speed");

        if (newlyUnlocked) {
            sm.data.unlockedMilestones = unlocked;
            sm.save();
        }
    }

    update(dt, game) {
        if (!game.input) return;

        let tx = game.input.mouse.x / game.scale;
        let ty = game.input.mouse.y / game.scale;

        // Handle Settings Toggle Button
        if (game.input.mouse.down && !this.handledClick && !this.inSettings && game.state !== 'DRAFT') {
            // Gear icon bounds
            if (tx >= game.targetWidth - 40 && tx <= game.targetWidth - 10 && ty >= 10 && ty <= 40) {
                this.handledClick = true;
                this.inSettings = true;
                this.prevState = game.state;
                game.state = 'SETTINGS';
                this.resetStep = 0;
                this.showExport = false;
                if(game.sound) game.sound.playSFX('uiSelect');
                return;
            }
        }

        if (this.inSettings) {
            if (game.input.mouse.down && !this.handledClick) {
                for (let b of this.buttons) {
                    if (tx >= b.x && tx <= b.x + b.w && ty >= b.y && ty <= b.y + b.h) {
                        this.handledClick = true;
                        if(game.sound) game.sound.playSFX('uiSelect');

                        if (b.type === 'slider') {
                            // Calculate percentage
                            let pct = (tx - b.x) / b.w;
                            pct = Math.max(0, Math.min(1, pct));
                            b.action(pct);
                        } else {
                            b.action();
                        }
                    }
                }
            }
            if (!game.input.mouse.down) {
                this.handledClick = false;
            }
            return;
        }

        // Virtual Joysticks
        if (this.isTouchMode(game) && game.state === 'PLAYING') {
            this.updateJoysticks(game);
        }
    }

    updateJoysticks(game) {
        let leftActive = false;
        let rightActive = false;

        let touches = game.input.touches;
        const handedness = game.saveManager.data.options.touchHandedness || 'Right';
        const midX = game.targetWidth / 2;

        for (let t of touches) {
            let tx = t.x / game.scale;
            let ty = t.y / game.scale;

            let isLeftZone = (handedness === 'Right') ? (tx < midX) : (tx >= midX);

            if (isLeftZone) {
                if (!this.joystickL.active) {
                    this.joystickL.active = true;
                    this.joystickL.x = tx;
                    this.joystickL.y = ty;
                }

                let dx = tx - this.joystickL.x;
                let dy = ty - this.joystickL.y;
                let dist = Math.hypot(dx, dy);
                if (dist > this.joystickRadius) {
                    dx = (dx/dist) * this.joystickRadius;
                    dy = (dy/dist) * this.joystickRadius;
                }
                this.joystickL.dx = dx / this.joystickRadius;
                this.joystickL.dy = dy / this.joystickRadius;
                leftActive = true;
            } else {
                if (!this.joystickR.active) {
                    this.joystickR.active = true;
                    this.joystickR.x = tx;
                    this.joystickR.y = ty;
                }

                let dx = tx - this.joystickR.x;
                let dy = ty - this.joystickR.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) { // any movement aims
                    this.joystickR.dx = dx / dist;
                    this.joystickR.dy = dy / dist;
                }
                rightActive = true;
            }
        }

        if (!leftActive) { this.joystickL.active = false; this.joystickL.dx = 0; this.joystickL.dy = 0; }
        if (!rightActive) { this.joystickR.active = false; this.joystickR.dx = 0; this.joystickR.dy = 0; }
    }

    draw(ctx, game) {
        // FPS
        if (game.saveManager.data.options.showFPS) {
            ctx.fillStyle = '#0f0';
            ctx.font = '16px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`FPS: ${game.fps}`, 10, 20);
        }

        // Settings Button (Gear) - Draw if not in DRAFT
        if (game.state !== 'DRAFT') {
            ctx.fillStyle = '#888';
            ctx.fillRect(game.targetWidth - 40, 10, 30, 30);
            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('\u2699', game.targetWidth - 25, 32); // Gear icon
        }

        if (this.inSettings) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0,0,game.targetWidth, game.targetHeight);

            ctx.fillStyle = '#fff';
            ctx.font = '40px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('SETTINGS', game.targetWidth/2, 60);

            let o = game.saveManager.data.options;

            for (let b of this.buttons) {
                ctx.fillStyle = '#333';
                ctx.fillRect(b.x, b.y, b.w, b.h);

                // Value text
                let valStr = '';
                if (b.type === 'toggle') valStr = o[b.key] ? 'ON' : 'OFF';
                if (b.type === 'multi') {
                    if (b.key === 'shakeIntensity') valStr = o[b.key] === 1.0 ? '100%' : (o[b.key] === 0.5 ? '50%' : 'OFF');
                    else valStr = o[b.key];
                }

                if (b.type === 'slider') {
                    ctx.fillStyle = '#555';
                    ctx.fillRect(b.x, b.y, b.w, b.h);
                    ctx.fillStyle = '#0a0';
                    ctx.fillRect(b.x, b.y, b.w * o[b.key], b.h);
                    valStr = Math.round(o[b.key] * 100) + '%';
                }

                ctx.fillStyle = '#fff';
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'left';

                let displayLabel = b.label;
                if (b.label === 'Reset Save' && this.resetStep === 1) displayLabel = "Click again to confirm!";

                ctx.fillText(displayLabel, b.x + 10, b.y + 28);

                if (valStr) {
                    ctx.textAlign = 'right';
                    ctx.fillText(valStr, b.x + b.w - 10, b.y + 28);
                }

                ctx.strokeStyle = '#666';
                ctx.strokeRect(b.x, b.y, b.w, b.h);
            }

            if (this.showExport) {
                ctx.fillStyle = '#ff0';
                ctx.font = '12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(this.exportString.substring(0, 50) + "...", game.targetWidth/2, game.targetHeight - 20);
                ctx.fillText("String copied to console log", game.targetWidth/2, game.targetHeight - 5);
            }
        }

        // Draw Milestones on Title/GameOver
        if (game.state === 'TITLE' || game.state === 'GAME_OVER') {
            this.drawMilestones(ctx, game);
        }

        // Draw Joysticks
        if (this.isTouchMode(game) && game.state === 'PLAYING' && !this.inSettings) {
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.fillStyle = 'rgba(255,255,255,0.2)';

            if (this.joystickL.active) {
                ctx.beginPath();
                ctx.arc(this.joystickL.x, this.joystickL.y, this.joystickRadius, 0, Math.PI*2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.joystickL.x + this.joystickL.dx*this.joystickRadius, this.joystickL.y + this.joystickL.dy*this.joystickRadius, 20, 0, Math.PI*2);
                ctx.fill();
            }

            if (this.joystickR.active) {
                ctx.beginPath();
                ctx.arc(this.joystickR.x, this.joystickR.y, this.joystickRadius, 0, Math.PI*2);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(this.joystickR.x + this.joystickR.dx*this.joystickRadius, this.joystickR.y + this.joystickR.dy*this.joystickRadius, 20, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }

    drawMilestones(ctx, game) {
        const milestones = ["First Kill", "Wave 3 Reached", "Boss Defeated", "10k Score", "Combo Master", "Max Speed"];
        const unlocked = game.saveManager.data.unlockedMilestones || [];

        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText("Milestones", game.targetWidth/2, 20);

        let startX = game.targetWidth/2 - (milestones.length * 60) / 2 + 30;

        for (let i=0; i<milestones.length; i++) {
            let isUnlocked = unlocked.includes(milestones[i]);
            ctx.fillStyle = isUnlocked ? '#f50' : '#444';
            ctx.beginPath();
            ctx.arc(startX + i*60, 50, 20, 0, Math.PI*2);
            ctx.fill();

            ctx.fillStyle = isUnlocked ? '#fff' : '#888';
            ctx.font = '10px sans-serif';
            ctx.fillText(milestones[i].split(" ")[0], startX + i*60, 85);
        }
    }
}
