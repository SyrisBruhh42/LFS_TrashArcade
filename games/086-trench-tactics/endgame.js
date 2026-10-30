class EndgameManager {
    constructor(game) {
        this.game = game;
        this.roundTextTime = 3.0;
    }
    update(dt) {
        if (this.game.state === 'PLAYING') {
            if (this.roundTextTime > 0) {
                this.roundTextTime -= dt;
            }
        } else if (this.game.state === 'GAME_OVER' || this.game.state === 'TITLE') {
            this.roundTextTime = 3.0;
        }
    }
    draw(ctx) {
        if (this.game.state === 'PLAYING' && this.roundTextTime > 0) {
            ctx.save();
            ctx.fillStyle = 'rgba(13, 53, 84, 0.8)';
            ctx.fillRect(0, 150, this.game.width, 100);

            ctx.fillStyle = '#00e5ff';
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MISSION START', this.game.width / 2, 190);

            ctx.fillStyle = '#cdc3b9';
            ctx.font = '20px monospace';
            ctx.fillText('Objective: Survive and eliminate hostile targets.', this.game.width / 2, 230);
            ctx.restore();
        } else if (this.game.state === 'GAME_OVER') {
            ctx.save();
            ctx.fillStyle = 'rgba(5, 10, 18, 0.8)';
            ctx.fillRect(this.game.width / 2 - 250, this.game.height / 2 + 60, 500, 160);

            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.game.width / 2 - 250, this.game.height / 2 + 60, 500, 160);

            ctx.fillStyle = '#00e676';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('MISSION SUMMARY', this.game.width / 2, this.game.height / 2 + 90);

            ctx.fillStyle = '#cdc3b9';
            ctx.font = '18px monospace';
            ctx.fillText(`Final Score: ${this.game.score}`, this.game.width / 2, this.game.height / 2 + 125);
            ctx.fillText(`Total Games Played: ${this.game.saveManager.data.totalGamesPlayed}`, this.game.width / 2, this.game.height / 2 + 155);
            ctx.fillText(`All-time High Score: ${this.game.saveManager.data.highScore}`, this.game.width / 2, this.game.height / 2 + 185);
            ctx.restore();
        }
    }
}
