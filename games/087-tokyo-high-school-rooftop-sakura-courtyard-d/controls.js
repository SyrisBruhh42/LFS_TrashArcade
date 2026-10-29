class Phase2Subsystem {
    constructor(game) {
        this.game = game;
        this.scanEnergy = 100;
        this.isScanning = false;
        this.clueFound = false;
        this.portraitFrame = 0;
        this.blinkTimer = 0;
        this.expression = 'neutral';
        
        // Setup scan button
        this.scanBtn = { x: 680, y: 80, w: 100, h: 40, text: 'Scan' };
    }

    update(dt) {
        if (this.game.state !== 'PLAYING') return;

        // Handle scan energy recharge
        if (!this.isScanning && this.scanEnergy < 100) {
            this.scanEnergy += 10 * dt;
        }

        // Check for scan button interaction
        if (this.game.input.mouse.justDown && this.game.isHover(this.scanBtn) && this.scanEnergy >= 25) {
            this.isScanning = true;
            this.scanEnergy -= 25;
            this.clueFound = Math.random() > 0.5; // Random chance to find clue
            if (this.clueFound) {
                this.expression = 'surprised';
                this.game.saveManager.data.inventory.push("Hidden Clue");
                this.game.saveManager.save();
                this.game.sound.playStatUp();
            } else {
                this.expression = 'sad';
                this.game.sound.playError();
            }
        } else if (this.game.input.mouse.justDown) {
            this.isScanning = false;
            this.expression = 'neutral';
        }

        // Animate Portrait
        this.portraitFrame += dt;
        this.blinkTimer -= dt;
        if (this.blinkTimer <= 0) {
            this.blinkTimer = Math.random() * 3 + 1; // Blink every 1-4 seconds
        }
    }

    draw(ctx) {
        if (this.game.state !== 'PLAYING') return;

        // Draw Scan Button
        ctx.fillStyle = this.game.isHover(this.scanBtn) ? '#7c4dff' : '#ff4081';
        ctx.fillRect(this.scanBtn.x, this.scanBtn.y, this.scanBtn.w, this.scanBtn.h);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.scanBtn.text, this.scanBtn.x + this.scanBtn.w/2, this.scanBtn.y + this.scanBtn.h/2);

        // Draw HUD Indicator
        ctx.fillStyle = '#fff';
        ctx.fillRect(680, 130, 100, 10);
        ctx.fillStyle = '#7c4dff';
        ctx.fillRect(680, 130, this.scanEnergy, 10);

        // Draw Expressive Portrait Rig
        ctx.save();
        ctx.translate(650, 400); // Bottom right corner

        // Body
        ctx.fillStyle = '#ffb6c1';
        ctx.fillRect(0, 0, 100, 150);
        
        // Uniform/Layer
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(10, 20, 80, 130);
        
        // Head
        ctx.fillStyle = '#ffe4b5';
        ctx.beginPath();
        ctx.arc(50, -20, 40, 0, Math.PI * 2);
        ctx.fill();

        // Eyes / Expression
        ctx.fillStyle = '#000';
        if (this.blinkTimer > 0.1) { // Open eyes
            if (this.expression === 'surprised') {
                ctx.beginPath(); ctx.arc(35, -30, 5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(65, -30, 5, 0, Math.PI * 2); ctx.fill();
                // Mouth
                ctx.beginPath(); ctx.arc(50, -10, 8, 0, Math.PI * 2); ctx.fill();
            } else if (this.expression === 'sad') {
                ctx.fillRect(30, -32, 10, 2);
                ctx.fillRect(60, -32, 10, 2);
                // Mouth
                ctx.beginPath();
                ctx.arc(50, -5, 10, Math.PI, 0);
                ctx.stroke();
            } else {
                ctx.fillRect(30, -35, 10, 5);
                ctx.fillRect(60, -35, 10, 5);
                // Mouth
                ctx.fillRect(45, -10, 10, 2);
            }
        } else { // Closed eyes (blink)
             ctx.fillRect(30, -30, 10, 2);
             ctx.fillRect(60, -30, 10, 2);
        }
        
        ctx.restore();
    }
}
