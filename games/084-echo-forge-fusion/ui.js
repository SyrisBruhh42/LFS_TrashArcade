window.ARCADE_CARTRIDGE_META = {
    title: 'Echo Forge Fusion',
    lore: 'Cooperate with your rhythmic echoes inside a microscopic cell.',
    controls: 'WASD/Arrows to move, Shift to dash. Blasts fire on the beat.'
};

class ArcadeUI {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.tab = 'howto';
    }
    toggle() {
        this.active = !this.active;
    }
    update(dt) {
        // Handle tab switching if active
        if (!this.active) return;
        if (this.game.input.keys['Digit1']) this.tab = 'howto';
        if (this.game.input.keys['Digit2']) this.tab = 'audio';
        if (this.game.input.keys['Digit3']) this.tab = 'save';
    }
    draw(ctx) {
        if (!this.active) return;
        const w = this.game.width, h = this.game.height;
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = '24px monospace';
        ctx.fillText('OPTIONS & LORE', w/2, 60);

        ctx.font = '16px monospace';
        ctx.fillStyle = this.tab === 'howto' ? '#1de9b6' : '#fff';
        ctx.fillText('[1] How to Play', w/2 - 150, 100);
        ctx.fillStyle = this.tab === 'audio' ? '#1de9b6' : '#fff';
        ctx.fillText('[2] Audio & Comfort', w/2, 100);
        ctx.fillStyle = this.tab === 'save' ? '#1de9b6' : '#fff';
        ctx.fillText('[3] Save Data', w/2 + 150, 100);

        ctx.fillStyle = '#fff';
        if (this.tab === 'howto') {
            ctx.fillText('1. Goal & Lore: Survive the microscopic cell, cooperate with echoes.', w/2, h/2 - 40);
            ctx.fillText('2. Loop: Dash and shoot on the beat to increase combo and resonance.', w/2, h/2 - 10);
            ctx.fillText('3. Controls: WASD/Arrows to Move, Shift to dash, Auto-fire on beat.', w/2, h/2 + 20);
        } else if (this.tab === 'audio') {
            ctx.fillText('Audio Settings:', w/2, h/2 - 20);
            ctx.fillText('Multi-Voice Synthesizer and genre-authentic adaptive tracks are ON.', w/2, h/2 + 10);
        } else if (this.tab === 'save') {
            ctx.fillText('Save Data:', w/2, h/2 - 20);
            ctx.fillText(`High Score: ${this.game.saves.data.highScore}`, w/2, h/2 + 10);
            ctx.fillText('Save data is managed automatically.', w/2, h/2 + 40);
        }

        ctx.fillStyle = '#aaa';
        ctx.fillText('Press [O] to close', w/2, h - 60);
    }
}
