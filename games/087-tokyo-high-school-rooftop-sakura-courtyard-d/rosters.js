class RosterManager {
    constructor(game) {
        this.game = game;
        this.leads = [
            { id: 'lead1', name: 'Childhood Friend', reqStat: 'charm', reqAmount: 30, desc: 'Always looks out for you.' },
            { id: 'lead2', name: 'Cool Idol', reqStat: 'talent', reqAmount: 30, desc: 'Quiet but passionate about music.' },
            { id: 'lead3', name: 'Class President', reqStat: 'wit', reqAmount: 30, desc: 'Strict but hides a softer side.' },
            { id: 'lead4', name: 'Wealthy Heir', reqStat: 'cash', reqAmount: 200, desc: 'Used to getting what he wants.' },
            { id: 'lead5', name: 'Mysterious Transfer', reqStat: 'wit', reqAmount: 40, desc: 'Knows more than she lets on.' }
        ];
        this.activeLeadIndex = 0;
    }

    getActiveLead() {
        return this.leads[this.activeLeadIndex];
    }

    nextLead() {
        this.activeLeadIndex = (this.activeLeadIndex + 1) % this.leads.length;
    }

    prevLead() {
        this.activeLeadIndex = (this.activeLeadIndex - 1 + this.leads.length) % this.leads.length;
    }

    draw(ctx) {
        const lead = this.getActiveLead();
        const affection = this.game.saveManager.data.affection[lead.id] || 0;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(300, 70, 460, 160);
        ctx.strokeStyle = '#ff4081';
        ctx.lineWidth = 2;
        ctx.strokeRect(300, 70, 460, 160);

        ctx.fillStyle = '#ff4081';
        ctx.font = 'bold 22px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(lead.name, 320, 100);

        ctx.fillStyle = '#333';
        ctx.font = '16px sans-serif';
        ctx.fillText(lead.desc, 320, 130);

        ctx.fillStyle = '#7c4dff';
        ctx.fillText(`Prefers: ${lead.reqStat.toUpperCase()} > ${lead.reqAmount}`, 320, 160);

        ctx.fillStyle = '#ff4081';
        ctx.fillText(`Affection: ${affection}`, 320, 190);

        ctx.font = '24px sans-serif';


    }
}
