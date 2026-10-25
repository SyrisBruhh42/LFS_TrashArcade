window.ARCADE_CARTRIDGE_META = {
    title: 'Scrap Heist Retrieval',
    author: 'Factory',
    description: 'Sneak through the scrapheap, collect scrap, and stun enemies. Don\'t forget to pick up your only ammo!'
};

class GoldenUI {
    constructor(game) {
        this.game = game;
        this.showOptions = false;
        this.activeTab = 'audio';
    }

    initDOM() {
        this.overlay = document.createElement('div');
        this.overlay.style.position = 'absolute';
        this.overlay.style.top = '50%';
        this.overlay.style.left = '50%';
        this.overlay.style.transform = 'translate(-50%, -50%)';
        this.overlay.style.background = '#362a23';
        this.overlay.style.color = '#fff';
        this.overlay.style.padding = '20px';
        this.overlay.style.border = '2px solid #ff7043';
        this.overlay.style.fontFamily = 'monospace';
        this.overlay.style.display = 'none';
        this.overlay.style.zIndex = '1000';
        document.body.appendChild(this.overlay);
        this.renderOptions();
    }

    renderOptions() {
        this.overlay.innerHTML = `
            <h2>Options</h2>
            <div style="display:flex;gap:10px;margin-bottom:10px;">
                <button onclick="window.game.ui.setTab('audio')" style="background:${this.activeTab==='audio'?'#ff7043':'#555'};color:white;border:none;padding:5px;cursor:pointer;">Audio</button>
                <button onclick="window.game.ui.setTab('controls')" style="background:${this.activeTab==='controls'?'#ff7043':'#555'};color:white;border:none;padding:5px;cursor:pointer;">Controls</button>
                <button onclick="window.game.ui.setTab('save')" style="background:${this.activeTab==='save'?'#ff7043':'#555'};color:white;border:none;padding:5px;cursor:pointer;">Save Data</button>
            </div>
            <div id="tab-content" style="margin-bottom: 20px;"></div>
            <button onclick="window.game.ui.toggleOptions()" style="padding:5px;background:#ffca28;border:none;color:black;cursor:pointer;width:100%;">Close</button>
        `;
        const content = this.overlay.querySelector('#tab-content');
        if (this.activeTab === 'audio') {
            content.innerHTML = `
                <p>Volume Controls</p>
                <button onclick="window.game.sound.ctx?.resume()" style="padding:5px;background:#ffca28;border:none;color:black;cursor:pointer;">Unmute</button>
            `;
        } else if (this.activeTab === 'controls') {
            content.innerHTML = `<p>WASD/Arrows: Move<br>Space/Click: Shoot<br>Collect scrap to win.</p>`;
        } else if (this.activeTab === 'save') {
            content.innerHTML = `<details><summary style="cursor:pointer;">Manage Save Data</summary><p>Base64 data hidden</p></details>`;
        }
    }

    setTab(tab) {
        this.activeTab = tab;
        this.renderOptions();
    }

    toggleOptions() {
        this.showOptions = !this.showOptions;
        this.overlay.style.display = this.showOptions ? 'block' : 'none';
    }

    draw(ctx) {
        const w = this.game.width;
        const h = this.game.height;
        ctx.fillStyle = '#362a23';
        ctx.fillRect(0,0,w,h);

        ctx.fillStyle = '#ff7043';
        ctx.font = '50px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Scrap Heist Retrieval', w/2, h/4);

        ctx.fillStyle = '#ffca28';
        ctx.font = '16px monospace';
        ctx.fillText('1. Goal & Lore: Sneak, collect scrap, and stun bots.', w/2, h/2 - 40);
        ctx.fillText('2. How It Works: Must retrieve your only ammo!', w/2, h/2 - 10);
        ctx.fillText('3. Controls: WASD/Arrows to move, Space to shoot.', w/2, h/2 + 20);

        ctx.fillStyle = '#fff';
        ctx.fillText('Press SPACE or Click to Start', w/2, h * 0.75);
        ctx.fillText('Press O for Options', w/2, h * 0.85);
    }
}
window.GoldenUI = GoldenUI;
