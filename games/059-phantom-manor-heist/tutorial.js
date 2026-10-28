class Tutorial {
    constructor() {
        this.moved = false;
        this.echoed = false;
        this.looted = false;
        this.alpha = 1.0;
        this.active = true;
    }
    update(dt, game) {
        if (!this.active || game.wave > 1) { this.active = false; return; }

        let keys = game.input.keys;
        let touch = game.input.touch;
        if (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'] ||
            keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'] ||
            Math.abs(touch.x) > 10 || Math.abs(touch.y) > 10) {
            this.moved = true;
        }
        if (game.player && game.player.echo) {
            this.echoed = true;
        }
        if (game.score > 0) {
            this.looted = true;
        }

        if (this.moved && this.echoed && this.looted) {
            this.alpha -= dt * 0.5;
            if (this.alpha <= 0) {
                this.alpha = 0;
                this.active = false;
            }
        }
    }
    draw(ctx, game) {
        if (!this.active || game.wave > 1 || this.alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';

        let y = 150;
        if (!this.moved) {
            ctx.fillText('WASD / Touch to Move', window.innerWidth/2, y);
            y += 40;
        }
        if (!this.echoed) {
            ctx.fillText('Space / Action Button to Echo', window.innerWidth/2, y);
            y += 40;
        }
        if (!this.looted) {
            ctx.fillText('Collect green gems!', window.innerWidth/2, y);
        }

        ctx.restore();
    }
}
