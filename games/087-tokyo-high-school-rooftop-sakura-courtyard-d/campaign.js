class CampaignManager {
    constructor(game) {
        this.game = game;
        this.milestones = [
            { id: 'first_date', name: 'First Date', desc: 'Reach 10 affection with any lead.', unlocked: false },
            { id: 'popular', name: 'Rising Star', desc: 'Reach 50 Charm.', unlocked: false },
            { id: 'rich', name: 'Big Spender', desc: 'Accumulate ¥1000.', unlocked: false },
            { id: 'midterm', name: 'Midterm Cleared', desc: 'Survive the Day 15 Showdown.', unlocked: false },
            { id: 'finale', name: 'Festival Star', desc: 'Complete the 30-day campaign.', unlocked: false }
        ];

        if (!this.game.saveManager.data.milestones) {
            this.game.saveManager.data.milestones = {};
        }
        this.syncMilestones();
    }

    syncMilestones() {
        for (let m of this.milestones) {
            if (this.game.saveManager.data.milestones[m.id]) {
                m.unlocked = true;
            }
        }
    }

    update(dt) {
        if (!this.game.saveManager || !this.game.saveManager.data) return;
        const stats = this.game.saveManager.data.stats;
        const affection = this.game.saveManager.data.affection;
        if (!stats || !affection) return;

        if (!this.milestones[0].unlocked) {
            let maxAff = 0;
            for (let k in affection) maxAff = Math.max(maxAff, affection[k]);
            if (maxAff >= 10) this.unlock('first_date');
        }

        if (!this.milestones[1].unlocked && stats.charm >= 50) this.unlock('popular');
        if (!this.milestones[2].unlocked && stats.cash >= 1000) this.unlock('rich');
        if (!this.milestones[3].unlocked && this.game.saveManager.data.day > 15) this.unlock('midterm');
        if (!this.milestones[4].unlocked && this.game.saveManager.data.day > 30) this.unlock('finale');
    }

    unlock(id) {
        let m = this.milestones.find(x => x.id === id);
        if (m && !m.unlocked) {
            m.unlocked = true;
            this.game.saveManager.data.milestones[id] = true;
            this.game.saveManager.save();

            if (this.game.vfx) {
                this.game.vfx.addFloatingText(400, 300, `Milestone Unlocked: ${m.name}!`, '#7c4dff');
                this.game.vfx.burst(400, 300, 30, '#ff4081');
            }
            if (this.game.sound) {
                this.game.sound.playItemUnlock();
            }
        }
    }

    draw(ctx) {
        if (this.game.state === 'TITLE') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(50, 350, 200, 220);
            ctx.strokeStyle = '#ff4081';
            ctx.strokeRect(50, 350, 200, 220);

            ctx.fillStyle = '#ff4081';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Milestones', 150, 375);

            ctx.textAlign = 'left';
            ctx.font = '12px sans-serif';
            for (let i = 0; i < this.milestones.length; i++) {
                let m = this.milestones[i];
                ctx.fillStyle = m.unlocked ? '#7c4dff' : '#999';
                ctx.fillText(`${m.unlocked ? '★' : '☆'} ${m.name}`, 60, 405 + i * 30);

                if (this.game.input.mouse.x >= 50 && this.game.input.mouse.x <= 250 &&
                    this.game.input.mouse.y >= 390 + i * 30 && this.game.input.mouse.y <= 415 + i * 30) {
                    ctx.fillStyle = '#333';
                    ctx.fillText(m.desc, 60, 560);
                }
            }
        }
    }
}
