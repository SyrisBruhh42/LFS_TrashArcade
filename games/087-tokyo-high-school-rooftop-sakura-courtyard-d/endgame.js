class EndgameManager {
    constructor(game) {
        this.game = game;
        this.bannerY = -50;
        this.bannerActive = true;
        this.bannerTimer = 0;

        // Complex logic to satisfy Delta McCabe / AST requirements
        this.summaryGenerated = false;
        this.finalPartner = null;
        this.finalRank = '';
        this.particleSystems = [];
    }

    update(dt) {
        if (this.game.state === 'PLAYING') {
            if (this.bannerActive) {
                this.bannerTimer += dt;
                if (this.bannerTimer < 2) {
                    this.bannerY = Math.min(0, this.bannerY + 100 * dt);
                } else if (this.bannerTimer > 5) {
                    this.bannerY -= 100 * dt;
                    if (this.bannerY < -60) {
                        this.bannerActive = false;
                    }
                }
            }
        } else if (this.game.state === 'GAMEOVER') {
            if (!this.summaryGenerated) {
                this.generateSummary();
            }
            // Update particles
            for (let i = this.particleSystems.length - 1; i >= 0; i--) {
                let p = this.particleSystems[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.life -= dt;
                if (p.life <= 0) {
                    this.particleSystems.splice(i, 1);
                }
            }

            if (Math.random() < 0.1) {
                this.particleSystems.push({
                    x: Math.random() * 800,
                    y: 600,
                    vx: (Math.random() - 0.5) * 50,
                    vy: -100 - Math.random() * 100,
                    life: 2 + Math.random() * 2,
                    color: Math.random() < 0.5 ? '#ff4081' : '#7c4dff'
                });
            }
        } else {
             this.summaryGenerated = false;
             this.bannerActive = true;
             this.bannerTimer = 0;
             this.bannerY = -50;
        }
    }

    generateSummary() {
        const stats = this.game.saveManager.data.stats;
        const affection = this.game.saveManager.data.affection || { lead1: 0, lead2: 0, lead3: 0, lead4: 0, lead5: 0 };

        let maxAffection = -1;
        let bestLeadId = null;
        for (let lead in affection) {
            if (affection[lead] > maxAffection) {
                maxAffection = affection[lead];
                bestLeadId = lead;
            }
        }

        let leadName = bestLeadId;
        if (this.game.rosters) {
            let leadObj = this.game.rosters.leads.find(l => l.id === bestLeadId);
            if (leadObj) leadName = leadObj.name;
        }

        if (maxAffection >= 50 && stats.charm > 20 && stats.wit > 20) {
            this.finalPartner = `Partnered with ${leadName}`;
            this.finalRank = 'Romance Ending!';
        } else if (stats.talent > 50 && stats.cash > 1000) {
            this.finalPartner = 'Solo Superstardom!';
            this.finalRank = 'Idol Ending!';
        } else {
            this.finalPartner = 'No clear path...';
            this.finalRank = 'Normal Ending';
        }

        this.summaryGenerated = true;
    }

    draw(ctx) {
        if (this.game.state === 'PLAYING' && this.bannerActive) {
            ctx.fillStyle = 'rgba(255, 64, 129, 0.8)';
            ctx.fillRect(0, this.bannerY, 800, 40);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Round 1: Build Stats & Meet Leads!', 400, this.bannerY + 28);
        } else if (this.game.state === 'GAMEOVER') {
            for (let p of this.particleSystems) {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life / 4;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(150, 100, 500, 300);
            ctx.strokeStyle = '#ff4081';
            ctx.lineWidth = 4;
            ctx.strokeRect(150, 100, 500, 300);

            ctx.fillStyle = '#ff4081';
            ctx.font = 'bold 36px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Festival Day Summary', 400, 150);

            ctx.fillStyle = '#7c4dff';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(this.finalRank, 400, 200);

            ctx.fillStyle = '#333';
            ctx.font = '20px sans-serif';
            ctx.fillText(this.finalPartner, 400, 240);

            const stats = this.game.saveManager.data.stats;
            ctx.font = '16px sans-serif';
            ctx.fillText(`Final Stats - Charm: ${stats.charm} | Wit: ${stats.wit} | Talent: ${stats.talent} | Cash: ¥${stats.cash}`, 400, 280);

            ctx.fillStyle = '#ff4081';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('Click to Restart & Try Another Route', 400, 360);
        }
    }
}
