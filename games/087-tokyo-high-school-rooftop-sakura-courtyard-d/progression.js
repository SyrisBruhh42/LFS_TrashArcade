class ProgressionManager {
    constructor(game) {
        this.game = game;
        this.perks = [
            { id: 'p1', name: 'Charisma Boost', cost: 100, desc: 'Increases base Charm gain.', owned: false },
            { id: 'p2', name: 'Time Saver', cost: 150, desc: 'Actions cost 5 less stamina.', owned: false },
            { id: 'p3', name: 'Idol Charm', cost: 200, desc: 'Overdrive restores more stamina.', owned: false },
            { id: 'p4', name: 'Scholar', cost: 100, desc: 'Study gives more Wit.', owned: false }
        ];
        this.bonusPickup = null;
        this.bonusTimer = 0;
        this.synergyMultiplier = 1.0;
    }

    update(dt) {
        if (!this.game.saveManager.data.perks) {
            this.game.saveManager.data.perks = [];
        }

        // Sync owned status
        for (let p of this.perks) {
            if (this.game.saveManager.data.perks.includes(p.id)) p.owned = true;
        }

        // Synergy logic based on owned perks
        this.synergyMultiplier = 1.0 + (this.game.saveManager.data.perks.length * 0.2);

        // Bonus pickup logic (appears randomly in PLAYING state)
        if (this.game.state === 'PLAYING') {
            this.bonusTimer -= dt;
            if (this.bonusTimer <= 0 && !this.bonusPickup) {
                if (Math.random() < 0.3) {
                    this.bonusPickup = {
                        x: 350 + Math.random() * 200,
                        y: 100 + Math.random() * 200,
                        size: 20
                    };
                }
                this.bonusTimer = 10;
            }

            if (this.bonusPickup && this.game.input.mouse.justDown) {
                let dx = this.game.input.mouse.x - this.bonusPickup.x;
                let dy = this.game.input.mouse.y - this.bonusPickup.y;
                if (dx * dx + dy * dy < this.bonusPickup.size * this.bonusPickup.size) {
                    this.game.saveManager.data.stats.charm += 10;
                    this.game.sound.playStatUp();
                    this.bonusPickup = null;
                }
            }
        }
    }

    drawShop(ctx) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fillRect(150, 100, 500, 400);
        ctx.strokeStyle = '#ff4081';
        ctx.lineWidth = 4;
        ctx.strokeRect(150, 100, 500, 400);

        ctx.fillStyle = '#ff4081';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Boutique Upgrade Shop', 400, 140);

        ctx.fillStyle = '#333';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Cash: ¥${this.game.saveManager.data.stats.cash}`, 400, 170);

        for (let i = 0; i < this.perks.length; i++) {
            let p = this.perks[i];
            let y = 220 + i * 50;
            ctx.fillStyle = p.owned ? '#7c4dff' : '#ff4081';
            ctx.fillRect(180, y, 440, 40);
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'left';
            ctx.font = '16px sans-serif';
            ctx.fillText(`${p.name} - ${p.desc} (${p.owned ? 'Owned' : '¥' + p.cost})`, 190, y + 25);
        }

        ctx.fillStyle = '#7c4dff';
        ctx.textAlign = 'center';
        ctx.fillText(`Current Synergy Multiplier: x${this.synergyMultiplier.toFixed(1)}`, 400, 460);
    }

    handleShopClick() {
        for (let i = 0; i < this.perks.length; i++) {
            let p = this.perks[i];
            let y = 220 + i * 50;
            if (this.game.input.mouse.x >= 180 && this.game.input.mouse.x <= 620 &&
                this.game.input.mouse.y >= y && this.game.input.mouse.y <= y + 40) {
                if (!p.owned && this.game.saveManager.data.stats.cash >= p.cost) {
                    this.game.saveManager.data.stats.cash -= p.cost;
                    this.game.saveManager.data.perks.push(p.id);
                    p.owned = true;
                    if(this.game.sound.playItemUnlock) this.game.sound.playItemUnlock();
                    else this.game.sound.playConfirm();
                } else {
                    this.game.sound.playError();
                }
            }
        }
    }

    draw(ctx) {
        if (this.bonusPickup) {
            ctx.fillStyle = '#ff4081';
            ctx.beginPath();
            ctx.arc(this.bonusPickup.x, this.bonusPickup.y, this.bonusPickup.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (this.game.state === 'PLAYING') {
            ctx.fillStyle = '#ff4081';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`Synergy: x${this.synergyMultiplier.toFixed(1)}`, 780, 20);
        }
    }
}
