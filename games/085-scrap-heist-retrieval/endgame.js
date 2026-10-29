class Endgame {
    static init(game) {
        game.endgameParticles = [];
        for (let i = 0; i < 100; i++) {
            game.endgameParticles.push({
                x: Math.random() * game.width,
                y: Math.random() * game.height,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                color: Math.random() > 0.5 ? '#ff7043' : '#362a23',
                size: Math.random() * 5 + 1,
                life: Math.random() * 100,
                maxLife: 100
            });
        }

        game.confetti = [];
        for(let i=0; i<50; i++) {
            game.confetti.push({
                x: game.width/2,
                y: game.height/2,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 1.0) * 10,
                color: ['#4ad5c0', '#ffca28', '#ff7043'][Math.floor(Math.random()*3)],
                size: Math.random() * 8 + 4,
                angle: Math.random() * Math.PI * 2,
                va: (Math.random() - 0.5) * 0.2
            });
        }

        game.hasInitEndgame = true;
    }

    static updateParticles(game) {
        if (!game.hasInitEndgame) {
            this.init(game);
        }

        for (let i = 0; i < game.endgameParticles.length; i++) {
            let p = game.endgameParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0) {
                p.x = Math.random() * game.width;
                p.y = Math.random() * game.height;
                p.life = p.maxLife;
                p.vx = (Math.random() - 0.5) * 4;
                p.vy = (Math.random() - 0.5) * 4;
            }

            if (p.x < 0) {
                p.x += game.width;
            } else if (p.x > game.width) {
                p.x -= game.width;
            }

            if (p.y < 0) {
                p.y += game.height;
            } else if (p.y > game.height) {
                p.y -= game.height;
            }
        }

        if (game.score > 5000) {
            for (let i = 0; i < game.confetti.length; i++) {
                let c = game.confetti[i];
                c.x += c.vx;
                c.y += c.vy;
                c.vy += 0.2;
                c.angle += c.va;

                if (c.y > game.height) {
                    c.y = 0;
                    c.x = Math.random() * game.width;
                    c.vy = Math.random() * 5;
                }
            }
        }
    }

    static updateBanner(game) {
        if (game.wave === 1) {
            if (typeof game.wave1BannerTimer === 'undefined') {
                game.wave1BannerTimer = 3.0;
            }
            if (game.wave1BannerTimer > 0) {
                game.wave1BannerTimer -= 1/60;
                let t = game.wave1BannerTimer;
                game.bannerPulse = Math.abs(Math.sin(t * 5));
                game.bannerAlpha = t < 1.0 ? t : 1.0;
                game.bannerScale = 1.0 + (1.0 - game.bannerAlpha) * 0.5;
            }
        }
    }

    static drawRound1Banner(ctx, game) {
        this.updateBanner(game);
        if (game.wave === 1 && game.wave1BannerTimer > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * game.bannerAlpha})`;
            ctx.fillRect(0, game.height / 2 - 40, game.width, 80);

            if (game.bannerPulse > 0.8) {
                ctx.fillStyle = '#ffca28';
            } else if (game.bannerPulse > 0.6) {
                ctx.fillStyle = '#ff7043';
            } else if (game.bannerPulse > 0.4) {
                ctx.fillStyle = '#4ad5c0';
            } else {
                ctx.fillStyle = '#fff';
            }

            ctx.globalAlpha = game.bannerAlpha;
            ctx.font = '24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('ROUND 1: RETRIEVE SCRAP, AVOID PATROLS', game.width / 2, game.height / 2 + 8);
            ctx.globalAlpha = 1.0;
        }
    }

    static calculateRank(game) {
        let r = 0;
        let c = 0;

        let ranks = ['SS', 'S', 'A', 'B', 'C', 'D', 'F'];
        let colors = ['#ff00ff', '#ffca28', '#4ad5c0', '#4ad5c0', '#fff', '#888', '#555'];

        if (game.score > 20000 && game.wave > 20) {
            r = 0; c = 0;
        } else if (game.score > 10000 && game.wave > 15) {
            r = 1; c = 1;
        } else if (game.score > 5000 && game.wave > 10) {
            r = 2; c = 2;
        } else if (game.score > 2000 && game.wave > 5) {
            r = 3; c = 3;
        } else if (game.score > 500) {
            r = 4; c = 4;
        } else if (game.wave > 2) {
            r = 5; c = 5;
        } else {
            r = 6; c = 6;
        }

        return { rank: ranks[r], gradeColor: colors[c] };
    }

    static drawGameOverSummary(ctx, game) {
        this.updateParticles(game);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, game.width, game.height);

        for (let i = 0; i < game.endgameParticles.length; i++) {
            let p = game.endgameParticles[i];
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        if (game.score > 5000) {
            for (let i = 0; i < game.confetti.length; i++) {
                let c = game.confetti[i];
                ctx.save();
                ctx.translate(c.x, c.y);
                ctx.rotate(c.angle);
                ctx.fillStyle = c.color;
                ctx.globalAlpha = 0.8;
                ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size);
                ctx.restore();
            }
        }

        ctx.globalAlpha = 1.0;

        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('HEIST FAILED', game.width / 2, game.height / 2 - 120);

        const perf = Endgame.calculateRank(game);

        ctx.fillStyle = perf.gradeColor;
        ctx.font = 'bold 36px monospace';
        ctx.fillText('RANK: ' + perf.rank, game.width / 2, game.height / 2 - 70);

        ctx.fillStyle = '#ffca28';
        ctx.font = '24px monospace';
        ctx.fillText('Final Score: ' + game.score, game.width / 2, game.height / 2 - 20);
        ctx.fillText('Waves Cleared: ' + (game.wave - 1), game.width / 2, game.height / 2 + 10);

        let unlocked = 0;
        if (game.saveManager && game.saveManager.data) {
            unlocked = game.saveManager.data.unlockedMilestones.length;
            ctx.fillStyle = '#4ad5c0';
            ctx.font = '20px monospace';
            ctx.fillText('High Score: ' + game.saveManager.data.highScore, game.width / 2, game.height / 2 + 50);
            ctx.fillText('Milestones: ' + unlocked + ' / 5', game.width / 2, game.height / 2 + 80);

            if (game.score > game.saveManager.data.highScore && game.score > 0) {
                ctx.fillStyle = '#ffca28';
                ctx.font = '16px monospace';
                ctx.fillText('NEW HIGH SCORE!', game.width / 2, game.height / 2 + 110);
            }
        }

        if (unlocked === 5) {
            ctx.fillStyle = '#ffca28';
            ctx.font = '16px monospace';
            ctx.fillText('100% MASTERY ACHIEVED', game.width / 2, game.height / 2 + 130);
        } else if (unlocked > 0) {
            ctx.fillStyle = '#4ad5c0';
            ctx.font = '16px monospace';
            ctx.fillText('KEEP SCRAPPING...', game.width / 2, game.height / 2 + 130);
        } else {
            ctx.fillStyle = '#888';
            ctx.font = '16px monospace';
            ctx.fillText('BEGIN YOUR HEIST', game.width / 2, game.height / 2 + 130);
        }

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';

        let pulse = Math.abs(Math.sin(Date.now() / 500));
        ctx.globalAlpha = 0.5 + pulse * 0.5;
        ctx.fillText('Press SPACE, tap or click to return to Title', game.width / 2, game.height / 2 + 170);
        ctx.globalAlpha = 1.0;
    }
}
window.Endgame = Endgame;
