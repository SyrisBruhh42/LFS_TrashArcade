class BossManager {
    constructor(game) {
        this.game = game;
        this.activeShowdown = null;
        this.bosses = {
            15: {
                id: 'midterm',
                name: 'Heart-to-Heart Confession',
                hp: 100,
                maxHp: 100,
                color: '#ff4081',
                desc: 'Break through their emotional barriers!',
                reward: { charm: 20, cash: 500 }
            },
            30: {
                id: 'finale',
                name: 'Festival Showdown',
                hp: 250,
                maxHp: 250,
                color: '#7c4dff',
                desc: 'The Grand Starlight Finale!',
                reward: { charm: 50, cash: 1000 }
            }
        };
    }

    startShowdown(day) {
        if (this.bosses[day]) {
            this.activeShowdown = JSON.parse(JSON.stringify(this.bosses[day])); // deep copy
            this.game.state = 'SHOWDOWN';
            this.game.sound.playConfirm();
        }
    }

    update(dt) {
        // Boss showdown uses the clue combo mechanic.
        // We let the player click buttons or wait for the gadget rig overdrive.
        // The game.js loop updates gadgetRig.

        // If gadgetRig overdrive is active, drain boss HP rapidly!
        if (this.game.gadgetRig && this.game.gadgetRig.overdriveActive) {
            this.activeShowdown.hp -= 20 * dt;
        }

        if (this.activeShowdown.hp <= 0) {
            this.winShowdown();
        }
    }

    winShowdown() {
        const stats = this.game.saveManager.data.stats;
        stats.charm += this.activeShowdown.reward.charm;
        stats.cash += this.activeShowdown.reward.cash;
        this.activeShowdown = null;
        this.game.state = 'PLAYING';
        this.game.sound.playStatUp();
    }

    draw(ctx) {
        // Draw showdown UI overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, 800, 600);

        const boss = this.activeShowdown;
        if (!boss) return;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(150, 100, 500, 400);
        ctx.strokeStyle = boss.color;
        ctx.lineWidth = 4;
        ctx.strokeRect(150, 100, 500, 400);

        ctx.fillStyle = boss.color;
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(boss.name, 400, 150);

        ctx.fillStyle = '#333';
        ctx.font = '18px sans-serif';
        ctx.fillText(boss.desc, 400, 200);

        // HP Bar
        ctx.fillStyle = '#ccc';
        ctx.fillRect(200, 250, 400, 30);
        ctx.fillStyle = boss.color;
        ctx.fillRect(200, 250, (Math.max(0, boss.hp) / boss.maxHp) * 400, 30);

        ctx.fillStyle = '#fff';
        ctx.font = '20px sans-serif';
        ctx.fillText(`Resistance: ${Math.ceil(Math.max(0, boss.hp))}`, 400, 272);

        ctx.fillStyle = '#ff4081';
        ctx.font = '16px sans-serif';
        ctx.fillText("Use 'Combine' (Idol Overdrive) to break resistance!", 400, 320);

        if (this.game.gadgetRig) {
            this.game.gadgetRig.draw(ctx);
        }
    }
}
