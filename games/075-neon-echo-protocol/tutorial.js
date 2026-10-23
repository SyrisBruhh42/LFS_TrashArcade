class TutorialManager {
    constructor(game) {
        this.game = game;
        this.active = true;
        this.step = 0;
        this.timer = 0;
        this.fadeAlpha = 0;
        this.fadeIn = true;

        this.hints = [
            "TUTORIAL SYSTEM ONLINE",
            "Use WASD or Arrow Keys to maneuver.",
            "Use Mouse or Arrow Keys to aim.",
            "Click or press Space to fire your weapon.",
            "Protect the Central Core at all costs!",
            "Press Shift to DASH. Dashing grants invulnerability.",
            "Your actions are constantly being recorded.",
            "Press E to deploy an ECHO of your past actions.",
            "Echoes fight alongside you! Use them strategically.",
            "Collect upgrades after completing waves.",
            "Good luck, Defender. Survive."
        ];

        this.completed = false;

        // Ensure no conflicts with saved tutorial state if any
        if (this.game.saveManager && this.game.saveManager.data.tutorialCompleted) {
            this.completed = true;
        }
    }

    update(dt) {
        if (this.completed || this.game.wave > 1 || this.game.state !== 'PLAYING') {
            this.active = false;
            return;
        }

        this.active = true;

        if (this.fadeIn) {
            this.fadeAlpha += dt * 2;
            if (this.fadeAlpha >= 1) {
                this.fadeAlpha = 1;
                this.fadeIn = false;
            }
        } else {
            this.timer += dt;
            if (this.timer > 4) {
                this.fadeAlpha -= dt * 2;
                if (this.fadeAlpha <= 0) {
                    this.fadeAlpha = 0;
                    this.timer = 0;
                    this.step++;
                    this.fadeIn = true;
                    if (this.step >= this.hints.length) {
                        this.completed = true;
                        this.active = false;
                        if (this.game.saveManager) {
                            this.game.saveManager.data.tutorialCompleted = true;
                            this.game.saveManager.save();
                        }
                    }
                }
            }
        }
    }

    draw(ctx) {
        if (!this.active || this.completed || this.game.wave > 1 || this.game.state !== 'PLAYING') return;
        if (this.step >= this.hints.length) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.fadeAlpha));

        // Draw nice sci-fi panel
        let panelWidth = 550;
        let panelHeight = 50;
        let px = this.game.width / 2 - panelWidth / 2;
        let py = 120;

        ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
        ctx.fillRect(px, py, panelWidth, panelHeight);

        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, panelWidth, panelHeight);

        // Corner accents
        ctx.beginPath();
        ctx.moveTo(px, py + 10);
        ctx.lineTo(px, py);
        ctx.lineTo(px + 10, py);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px + panelWidth - 10, py);
        ctx.lineTo(px + panelWidth, py);
        ctx.lineTo(px + panelWidth, py + 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px, py + panelHeight - 10);
        ctx.lineTo(px, py + panelHeight);
        ctx.lineTo(px + 10, py + panelHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px + panelWidth - 10, py + panelHeight);
        ctx.lineTo(px + panelWidth, py + panelHeight);
        ctx.lineTo(px + panelWidth, py + panelHeight - 10);
        ctx.stroke();

        ctx.fillStyle = '#00ffff';
        ctx.font = '18px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let text = this.hints[this.step];
        ctx.fillText(text, this.game.width / 2, py + panelHeight / 2);

        ctx.restore();
    }
}