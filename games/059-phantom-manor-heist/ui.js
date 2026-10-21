class UIManager {
    constructor(game) {
        this.game = game;
        this.active = false;

        // Bounds for UI elements for click handling
        this.elements = {};
    }

    update(dt) {
        // Handled directly via click/drag events, no real-time update needed
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '30px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SETTINGS', window.innerWidth / 2, 50);

        ctx.font = '16px monospace';
        let y = 100;
        let xCenter = window.innerWidth / 2;

        this.elements = {};

        // Draw Sliders
        y = this.drawSlider(ctx, 'Master Volume', this.game.save.data.masterVolume, xCenter, y, 'masterVolume');
        y = this.drawSlider(ctx, 'SFX Volume', this.game.save.data.sfxVolume, xCenter, y, 'sfxVolume');
        y = this.drawSlider(ctx, 'Music Volume', this.game.save.data.musicVolume, xCenter, y, 'musicVolume');
        y = this.drawSlider(ctx, 'Screen Shake', this.game.save.data.screenShake, xCenter, y, 'screenShake');

        // Draw Options
        y += 20;
        y = this.drawToggleOption(ctx, 'Particle Density', this.game.save.data.particleDensity === 1 ? 'High' : 'Low', xCenter, y, 'particleDensity');
        y = this.drawToggleOption(ctx, 'High Contrast', this.game.save.data.highContrast ? 'On' : 'Off', xCenter, y, 'highContrast');
        y = this.drawToggleOption(ctx, 'Show FPS', this.game.save.data.showFPS ? 'On' : 'Off', xCenter, y, 'showFPS');
        y = this.drawToggleOption(ctx, 'Touch Controls', this.game.save.data.touchControls, xCenter, y, 'touchControls');
        y = this.drawToggleOption(ctx, 'Handedness', this.game.save.data.touchHandedness, xCenter, y, 'touchHandedness');

        // Draw Buttons
        y += 20;
        this.drawButton(ctx, 'Export Save', xCenter - 110, y, 100, 30, 'export');
        this.drawButton(ctx, 'Import Save', xCenter + 10, y, 100, 30, 'import');
        y += 40;
        this.drawButton(ctx, 'Reset Save', xCenter - 50, y, 100, 30, 'reset');
        y += 40;
        this.drawButton(ctx, 'Close', xCenter - 50, y, 100, 30, 'close');

        ctx.restore();
    }

    drawSlider(ctx, label, val, x, y, id) {
        ctx.textAlign = 'right';
        ctx.fillText(label, x - 110, y + 15);

        ctx.fillStyle = '#555';
        ctx.fillRect(x - 90, y + 5, 200, 10);
        ctx.fillStyle = '#ada6b9';
        ctx.fillRect(x - 90, y + 5, 200 * val, 10);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 90 + 200 * val - 5, y, 10, 20);

        this.elements[id] = { type: 'slider', x: x - 90, y: y, w: 200, h: 20 };
        return y + 35;
    }

    drawToggleOption(ctx, label, val, x, y, id) {
        ctx.textAlign = 'right';
        ctx.fillText(label, x - 10, y + 15);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ada6b9';
        ctx.fillText(val, x + 10, y + 15);
        ctx.fillStyle = '#fff';

        this.elements[id] = { type: 'toggle', x: x - 100, y: y, w: 200, h: 25 };
        return y + 30;
    }

    drawButton(ctx, label, x, y, w, h, id) {
        ctx.fillStyle = '#334';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#ada6b9';
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + w / 2, y + 20);

        this.elements[id] = { type: 'button', x: x, y: y, w: w, h: h };
    }
}

UIManager.prototype.handleClick = function(x, y) {
    if (!this.active) return false;

    for (const [id, rect] of Object.entries(this.elements)) {
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
            if (rect.type === 'slider') {
                this.handleDrag(x, y);
            } else if (rect.type === 'toggle') {
                this.toggleOption(id);
            } else if (rect.type === 'button') {
                this.handleButton(id);
            }
            return true;
        }
    }
    return true; // block clicks while active
};

UIManager.prototype.handleDrag = function(x, y) {
    if (!this.active) return;
    for (const [id, rect] of Object.entries(this.elements)) {
        if (rect.type === 'slider' && y >= rect.y && y <= rect.y + rect.h) {
            let val = (x - rect.x) / rect.w;
            val = Math.max(0, Math.min(1, val));
            this.game.save.data[id] = val;
            this.game.save.save();
            return;
        }
    }
};

UIManager.prototype.toggleOption = function(id) {
    if (id === 'particleDensity') {
        this.game.save.data.particleDensity = this.game.save.data.particleDensity === 1 ? 0.2 : 1;
    } else if (id === 'highContrast') {
        this.game.save.data.highContrast = !this.game.save.data.highContrast;
    } else if (id === 'showFPS') {
        this.game.save.data.showFPS = !this.game.save.data.showFPS;
    } else if (id === 'touchControls') {
        const states = ['Auto', 'Always', 'Off'];
        let idx = states.indexOf(this.game.save.data.touchControls);
        this.game.save.data.touchControls = states[(idx + 1) % states.length];
    } else if (id === 'touchHandedness') {
        this.game.save.data.touchHandedness = this.game.save.data.touchHandedness === 'Right' ? 'Left' : 'Right';
    }
    this.game.save.save();
};

UIManager.prototype.handleButton = function(id) {
    if (id === 'close') {
        this.active = false;
    } else if (id === 'export') {
        let b64 = this.game.save.exportBase64();
        prompt("Copy your save data:", b64);
    } else if (id === 'import') {
        let b64 = prompt("Paste your save data:");
        if (b64) {
            if (this.game.save.importBase64(b64)) {
                alert("Save imported successfully!");
            } else {
                alert("Invalid save data.");
            }
        }
    } else if (id === 'reset') {
        if (confirm("Are you sure you want to completely reset your save? This cannot be undone.")) {
            if (confirm("FINAL WARNING: This deletes all progress. Type OK to continue.") === true) {
                 this.game.save.reset();
                 alert("Save reset.");
            }
        }
    }
};

UIManager.prototype.drawMilestones = function(ctx) {
    let m = this.game.save.data.milestones || [false, false, false, false, false, false];
    let descriptions = [
        "Reach Wave 5", "Reach Wave 10",
        "Score 5000", "Score 10000",
        "Defeat 5 Bosses", "Play 10 Games"
    ];

    let startX = window.innerWidth / 2 - 160;
    let startY = window.innerHeight - 100;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '12px monospace';

    for (let i = 0; i < 6; i++) {
        let row = Math.floor(i / 3);
        let col = i % 3;
        let bx = startX + col * 110;
        let by = startY + row * 40;

        ctx.fillStyle = m[i] ? '#fd0' : '#444';
        ctx.beginPath();
        ctx.arc(bx + 50, by - 15, 12, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = m[i] ? '#fff' : '#888';
        ctx.fillText(descriptions[i], bx + 50, by + 5);
    }
    ctx.restore();
};
