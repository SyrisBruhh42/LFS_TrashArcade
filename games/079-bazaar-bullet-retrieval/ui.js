class UIManager {
    constructor(game) {
        this.game = game;
        this.wipeConfirm = false;
        this.base64String = "";
    }
    update(input) {
        if (input.keys['Escape'] || input.mouse.down && this.backHit(input.mouse)) {
            input.mouse.down = false;
            input.keys['Escape'] = false;
            this.game.state = 'TITLE';
            this.game.saveManager.save();
        }
        if (input.mouse.down) {
            this.handleHits(input.mouse);
            input.mouse.down = false; // debounce
        }
    }
    updateTitle(input) {
        if (input.mouse.down && this.settingsHit(input.mouse)) {
            input.mouse.down = false;
            this.game.state = 'SETTINGS';
            return true;
        }
        return false;
    }
    settingsHit(m) { return m.x > 10 && m.x < 110 && m.y > 10 && m.y < 50; }
    backHit(m) { return m.x > 10 && m.x < 110 && m.y > 10 && m.y < 50; }
    handleHits(m) {
        let s = this.game.saveManager.data.settings;
        const cy = this.game.canvas.height / 2;
        const cx = this.game.canvas.width / 2;
        if (m.y > cy - 115 && m.y < cy - 95 && m.x > cx) s.masterMute = !s.masterMute;
        if (m.y > cy - 85 && m.y < cy - 65 && m.x > cx) s.sfxVolume = m.x < cx + 50 ? 0.2 : (m.x < cx + 100 ? 0.5 : 1.0);
        if (m.y > cy - 55 && m.y < cy - 35 && m.x > cx) s.musicVolume = m.x < cx + 50 ? 0.2 : (m.x < cx + 100 ? 0.5 : 1.0);
        if (m.y > cy - 25 && m.y < cy - 5 && m.x > cx) s.screenShake = m.x < cx + 50 ? 0.0 : (m.x < cx + 100 ? 0.5 : 1.0);
        if (m.y > cy + 5 && m.y < cy + 25 && m.x > cx) s.particleDensity = s.particleDensity === 'High' ? 'Low' : 'High';
        if (m.y > cy + 35 && m.y < cy + 55 && m.x > cx) s.highContrast = !s.highContrast;
        if (m.y > cy + 65 && m.y < cy + 85 && m.x > cx) s.fpsCounter = !s.fpsCounter;
        if (m.y > cy + 95 && m.y < cy + 115 && m.x > cx) s.touchMode = s.touchMode === 'Auto' ? 'Always' : (s.touchMode === 'Always' ? 'Off' : 'Auto');
        if (m.y > cy + 125 && m.y < cy + 145 && m.x > cx) s.touchSwap = !s.touchSwap;

        // Export/Import/Reset
        if (m.y > cy + 160 && m.y < cy + 190) {
            if (m.x > cx - 200 && m.x < cx - 70) {
                this.base64String = this.game.saveManager.exportBase64();
                navigator.clipboard.writeText(this.base64String).catch(e=>{});
            }
            if (m.x > cx - 60 && m.x < cx + 60) {
                let p = prompt("Paste Base64 Save:");
                if (p) this.game.saveManager.importBase64(p);
            }
            if (m.x > cx + 70 && m.x < cx + 200) {
                if (!this.wipeConfirm) this.wipeConfirm = true;
                else {
                    localStorage.removeItem(this.game.saveManager.saveKey);
                    this.game.saveManager.data = this.game.saveManager.load();
                    this.wipeConfirm = false;
                }
            } else {
                this.wipeConfirm = false;
            }
        }
        this.game.saveManager.save();
    }
    drawTitleOverlay(ctx, c) {
        ctx.fillStyle = '#444';
        ctx.fillRect(10, 10, 100, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SETTINGS', 60, 35);
        this.drawMilestones(ctx, c);
    }
    drawSettings(ctx, c) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, c.width, c.height);

        ctx.fillStyle = '#444';
        ctx.fillRect(10, 10, 100, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BACK', 60, 35);

        ctx.font = '40px monospace';
        ctx.fillText('SETTINGS', c.width/2, 80);

        ctx.font = '20px monospace';
        ctx.textAlign = 'right';
        let s = this.game.saveManager.data.settings;
        let cy = c.height/2;
        let cx = c.width/2;

        const opts = [
            ['Master Mute', s.masterMute ? 'ON' : 'OFF'],
            ['SFX Volume', s.sfxVolume],
            ['Music Volume', s.musicVolume],
            ['Screen Shake', s.screenShake],
            ['Particle Density', s.particleDensity],
            ['High Contrast', s.highContrast ? 'ON' : 'OFF'],
            ['FPS Counter', s.fpsCounter ? 'ON' : 'OFF'],
            ['Touch Controls', s.touchMode],
            ['Swap Touch Hands', s.touchSwap ? 'ON' : 'OFF']
        ];

        for (let i=0; i<opts.length; i++) {
            let y = cy - 100 + i * 30;
            ctx.fillStyle = '#aaa';
            ctx.fillText(opts[i][0] + ':', cx - 20, y);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#e2fc7a';
            ctx.fillText(opts[i][1], cx + 20, y);
            ctx.textAlign = 'right';
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#444';
        ctx.fillRect(cx - 200, cy + 160, 130, 30);
        ctx.fillRect(cx - 60, cy + 160, 120, 30);
        ctx.fillStyle = this.wipeConfirm ? '#f00' : '#444';
        ctx.fillRect(cx + 70, cy + 160, 130, 30);

        ctx.fillStyle = '#fff';
        ctx.fillText('EXPORT', cx - 135, cy + 182);
        ctx.fillText('IMPORT', cx, cy + 182);
        ctx.fillText(this.wipeConfirm ? 'SURE?' : 'WIPE', cx + 135, cy + 182);

        if (this.base64String) {
            ctx.font = '10px monospace';
            ctx.fillText('Export copied to clipboard!', cx, cy + 220);
        }
    }
    drawMilestones(ctx, c) {
        let m = this.game.saveManager.data.milestones;
        let badges = [
            {n: 'First Blood', on: m.firstBlood},
            {n: 'Ammo Hoarder', on: m.ammoHoarder},
            {n: 'Boss Slayer', on: m.bossSlayer},
            {n: 'Combo Master', on: m.comboMaster},
            {n: 'Survivor', on: m.survivor},
            {n: 'Rich', on: m.rich}
        ];

        let bw = 100;
        let spacing = 20;
        let totalW = badges.length * bw + (badges.length - 1) * spacing;
        let startX = c.width/2 - totalW/2 + bw/2;

        for (let i=0; i<badges.length; i++) {
            let x = startX + i * (bw + spacing);
            let y = c.height - 80;
            ctx.fillStyle = badges[i].on ? '#e2fc7a' : '#444';
            ctx.beginPath();
            ctx.arc(x, y, 30, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = badges[i].on ? '#000' : '#888';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            let words = badges[i].n.split(' ');
            for (let j=0; j<words.length; j++) {
                ctx.fillText(words[j], x, y - 5 + j*12);
            }
        }
    }
}
