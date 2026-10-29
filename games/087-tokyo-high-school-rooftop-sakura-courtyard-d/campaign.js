class CampaignManager {
    constructor(game) {
        this.game = game;
        this.milestones = [
            { id: 'm1', name: 'Week 1 Survivor', req: () => this.game.saveManager.data.day >= 7, desc: 'Survived the first week.', unlocked: false },
            { id: 'm2', name: 'Charismatic', req: () => this.game.saveManager.data.stats.charm >= 100, desc: 'Reached 100 Charm.', unlocked: false },
            { id: 'm3', name: 'Big Brain', req: () => this.game.saveManager.data.stats.wit >= 100, desc: 'Reached 100 Wit.', unlocked: false },
            { id: 'm4', name: 'High Earner', req: () => this.game.saveManager.data.stats.cash >= 1000, desc: 'Saved up ¥1000.', unlocked: false },
            { id: 'm5', name: 'True Idol', req: () => this.game.saveManager.data.stats.talent >= 100, desc: 'Reached 100 Talent.', unlocked: false },
            { id: 'm6', name: 'Popular', req: () => {
                let maxAff = 0;
                for(let k in this.game.saveManager.data.affection) {
                    if (this.game.saveManager.data.affection[k] > maxAff) maxAff = this.game.saveManager.data.affection[k];
                }
                return maxAff >= 10;
            }, desc: 'Reached 10 Affection with someone.', unlocked: false }
        ];

        this.notificationTimer = 0;
        this.recentMilestone = null;
    }

    populateHTML() {
        const container = document.getElementById('milestones-list');
        if (!container) return;

        let html = '<h3 style="color: #ff4081; border-bottom: 1px solid #ffe4ec; padding-bottom: 5px;">Unlockable Milestones</h3>';
        for (let m of this.milestones) {
            const status = m.unlocked ? '<span style="color: #4CAF50;">&#10004; Unlocked</span>' : '<span style="color: #999;">Locked</span>';
            html += `<div style="margin-bottom: 10px; padding: 10px; border: 1px solid #eee; border-radius: 5px; background: ${m.unlocked ? '#f8fdf8' : '#fafafa'};">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <strong>${m.name}</strong>
                            ${status}
                        </div>
                        <div style="font-size: 12px; color: #666;">${m.desc}</div>
                     </div>`;
        }
        container.innerHTML = html;
    }

    update(dt) {
        if (!this.game.saveManager.data.milestones) {
            this.game.saveManager.data.milestones = [];
        }

        // Sync state
        for (let m of this.milestones) {
            if (this.game.saveManager.data.milestones.includes(m.id)) {
                m.unlocked = true;
            } else if (m.req()) {
                m.unlocked = true;
                this.game.saveManager.data.milestones.push(m.id);
                this.game.saveManager.save();
                this.recentMilestone = m;
                this.notificationTimer = 4;
                if(this.game.sound.playMilestone) this.game.sound.playMilestone();
                else this.game.sound.playConfirm();

                // Add vfx
                if (this.game.vfx) {
                    this.game.vfx.burst(400, 300, 50, '#ffff00');
                    this.game.vfx.addShake(5, 0.5);
                }
            }
        }

        if (this.notificationTimer > 0) {
            this.notificationTimer -= dt;
        }
    }

    draw(ctx) {
        if (this.notificationTimer > 0 && this.recentMilestone) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(200, 100, 400, 100);
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 4;
            ctx.strokeRect(200, 100, 400, 100);

            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('MILESTONE UNLOCKED!', 400, 140);
            ctx.fillStyle = '#fff';
            ctx.font = '16px sans-serif';
            ctx.fillText(this.recentMilestone.name, 400, 175);
        }
    }
}
