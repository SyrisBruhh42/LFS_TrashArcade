class PerkDraft {
    constructor(game) {
        this.game = game;
        this.perks = [
            { name: 'Cloak Dampeners', desc: 'Reduces enemy view radius', apply: () => { game.enemies.forEach(e => {if(e.viewRadius) e.viewRadius *= 0.8}); } },
            { name: 'Speed Boots', desc: 'Player moves faster', apply: () => { game.player.speed += 20; } },
            { name: 'Scrap Magnet', desc: 'Increases collect radius', apply: () => { game.player.collectRadius += 20; } }
        ];
    }
    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#ff7043';
        ctx.font = '40px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Pick a Perk!', w/2, 100);

        const cardW = 200;
        const cardH = 300;
        const startX = w/2 - (cardW*1.5 + 20);

        for(let i=0; i<3; i++) {
            const x = startX + i*(cardW + 20);
            ctx.fillStyle = '#362a23';
            ctx.fillRect(x, h/2 - cardH/2, cardW, cardH);
            ctx.strokeStyle = '#ffca28';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, h/2 - cardH/2, cardW, cardH);

            ctx.fillStyle = '#fff';
            ctx.font = '20px monospace';
            ctx.fillText(this.perks[i].name, x + cardW/2, h/2 - cardH/2 + 40);

            ctx.font = '14px monospace';
            ctx.fillText(this.perks[i].desc, x + cardW/2, h/2);
            ctx.fillText(`Press ${i+1} to pick`, x + cardW/2, h/2 + cardH/2 - 20);
        }
    }
    handleInput(e) {
        if(e.code === 'Digit1') { this.perks[0].apply(); this.game.endDraft(); }
        else if(e.code === 'Digit2') { this.perks[1].apply(); this.game.endDraft(); }
        else if(e.code === 'Digit3') { this.perks[2].apply(); this.game.endDraft(); }
    }
}
window.PerkDraft = PerkDraft;
