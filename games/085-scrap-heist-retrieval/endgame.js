class Endgame {
    static drawRound1Banner(ctx, game) {
        if (game.wave === 1) {
            if (typeof game.wave1BannerTimer === 'undefined') {
                game.wave1BannerTimer = 3.0;
            }
            if (game.wave1BannerTimer > 0) {
                game.wave1BannerTimer -= 1/60;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(0, game.height / 2 - 40, game.width, 80);
                ctx.fillStyle = '#ff7043';
                ctx.font = '24px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('ROUND 1: RETRIEVE SCRAP, AVOID PATROLS', game.width / 2, game.height / 2 + 8);
            }
        }
    }

    static drawGameOverSummary(ctx, game) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, game.width, game.height);

        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HEIST FAILED', game.width / 2, game.height / 2 - 80);

        ctx.fillStyle = '#ffca28';
        ctx.font = '24px monospace';
        ctx.fillText(`Final Score: ${game.score}`, game.width / 2, game.height / 2 - 20);
        ctx.fillText(`Waves Cleared: ${game.wave - 1}`, game.width / 2, game.height / 2 + 10);

        ctx.fillStyle = '#4ad5c0';
        ctx.font = '20px monospace';
        ctx.fillText(`High Score: ${game.saveManager.data.highScore}`, game.width / 2, game.height / 2 + 50);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.fillText('Press SPACE, tap or click to return to Title', game.width / 2, game.height / 2 + 100);
    }
}
window.Endgame = Endgame;
