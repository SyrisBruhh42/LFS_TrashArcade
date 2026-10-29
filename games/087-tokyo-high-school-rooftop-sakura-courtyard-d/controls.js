class GadgetRig {
    constructor(game) {
        this.game = game;
        this.overdriveActive = false;
        this.overdriveTimer = 0;
        this.rigState = {
            eyeBlink: 0,
            mouthSmile: 0,
            blush: 0,
            recoil: 0
        };
        this.clueComboPower = 0; // 0 to 100
    }

    update(dt) {
        if (this.rigState.eyeBlink > 0) this.rigState.eyeBlink -= dt * 3;
        else if (Math.random() < 0.02) this.rigState.eyeBlink = 1;

        if (this.rigState.mouthSmile > 0) this.rigState.mouthSmile -= dt;
        if (this.rigState.blush > 0) this.rigState.blush -= dt;
        if (this.rigState.recoil > 0) this.rigState.recoil -= dt * 5;

        if (this.overdriveActive) {
            this.overdriveTimer -= dt;
            if (this.overdriveTimer <= 0) {
                this.overdriveActive = false;
            }
        }
    }

    activateOverdrive() {
        if (this.clueComboPower >= 100) {
            this.clueComboPower = 0;
            this.overdriveActive = true;
            this.overdriveTimer = 10;
            this.rigState.mouthSmile = 2;
            this.rigState.blush = 2;
            this.rigState.recoil = 1;
            this.game.sound.playConfirm();
        } else {
            this.game.sound.playError();
        }
    }

    addCluePower(amount) {
        if (!this.overdriveActive) {
            this.clueComboPower = Math.min(100, this.clueComboPower + amount);
        }
        this.rigState.recoil = 1;
        this.rigState.mouthSmile = 1;
    }

    draw(ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(580, 10, 200, 40);
        ctx.strokeStyle = '#ff4081';
        ctx.strokeRect(580, 10, 200, 40);

        ctx.fillStyle = this.overdriveActive ? '#7c4dff' : '#ff4081';
        ctx.fillRect(582, 12, (196 * this.clueComboPower) / 100, 36);
        if (this.overdriveActive) {
            ctx.fillRect(582, 12, (196 * (this.overdriveTimer / 10)), 36);
        }

        ctx.fillStyle = this.overdriveActive ? '#fff' : '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.overdriveActive ? `IDOL OVERDRIVE (${Math.ceil(this.overdriveTimer)}s)` : `CLUE POWER: ${Math.floor(this.clueComboPower)}%`, 680, 30);

        ctx.save();
        ctx.translate(530, 320 + (this.rigState.recoil > 0 ? Math.sin(this.rigState.recoil * Math.PI) * 10 : 0));

        // Base head
        ctx.fillStyle = '#ffe0d2';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hair
        ctx.fillStyle = '#ff4081';
        ctx.beginPath();
        ctx.arc(0, -10, 65, Math.PI, 0);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-65, -10);
        ctx.lineTo(-30, 15);
        ctx.lineTo(0, -20);
        ctx.lineTo(30, 15);
        ctx.lineTo(65, -10);
        ctx.fill();

        // Blush
        if (this.rigState.blush > 0 || this.overdriveActive) {
            ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.beginPath();
            ctx.arc(-30, 15, 12, 0, Math.PI * 2);
            ctx.arc(30, 15, 12, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eyes
        ctx.fillStyle = '#333';
        if (this.rigState.eyeBlink > 0.8) {
            ctx.fillRect(-45, -5, 25, 2);
            ctx.fillRect(20, -5, 25, 2);
        } else {
            ctx.beginPath();
            ctx.arc(-30, -5, 8, 0, Math.PI * 2);
            ctx.arc(30, -5, 8, 0, Math.PI * 2);
            ctx.fill();

            if (this.overdriveActive) {
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(-32, -7, 3, 0, Math.PI * 2);
                ctx.arc(28, -7, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Mouth
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.rigState.mouthSmile > 0 || this.overdriveActive) {
            ctx.arc(0, 20, 12, 0, Math.PI);
        } else {
            ctx.moveTo(-8, 20);
            ctx.lineTo(8, 20);
        }
        ctx.stroke();

        ctx.restore();
    }
}
