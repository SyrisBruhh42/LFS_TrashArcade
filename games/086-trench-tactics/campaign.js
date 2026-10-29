class CampaignManager {
    constructor(game) {
        this.game = game;
        this.initDOM();
        this.milestones = [
            { id: 'first_blood', name: 'First Blood', desc: 'Destroy your first enemy.', condition: (d) => d.totalScoreAccumulated >= 10 },
            { id: 'survivor', name: 'Trench Survivor', desc: 'Reach a score of 500 in one game.', condition: (d) => d.highScore >= 500 },
            { id: 'veteran', name: 'Veteran Tactician', desc: 'Play 10 games.', condition: (d) => d.totalGamesPlayed >= 10 },
            { id: 'hoarder', name: 'Score Hoarder', desc: 'Accumulate 5000 total score.', condition: (d) => d.totalScoreAccumulated >= 5000 },
            { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a boss (score >= 300).', condition: (d) => d.highScore >= 300 }
        ];

        let opts = this.game.saveManager.data.options;
        if (opts.reducedMotion === undefined) opts.reducedMotion = false;
        if (opts.highContrast === undefined) opts.highContrast = false;
        if (opts.leftHanded === undefined) opts.leftHanded = false;

        this.game.saveManager.save();
        this.milestoneBonuses = 0;
        this.applyMilestoneBonuses();

        this.celebrationParticles = [];
    }

    applyMilestoneBonuses() {
        this.milestoneBonuses = 0;
        let unlocks = this.game.saveManager.data.unlockedMilestones;
        for (let i = 0; i < unlocks.length; i++) {
            let u = unlocks[i];
            if (u === 'first_blood') this.milestoneBonuses += 1;
            else if (u === 'survivor') this.milestoneBonuses += 2;
            else if (u === 'veteran') this.milestoneBonuses += 3;
            else if (u === 'hoarder') this.milestoneBonuses += 4;
            else if (u === 'boss_slayer') this.milestoneBonuses += 5;
        }

        if (this.game.player) {
            this.game.player.bonusSpeed = this.milestoneBonuses * 5;
            this.game.player.bonusDamage = Math.floor(this.milestoneBonuses / 2);
        }
    }

    createEl(tag, style, id) {
        let el = document.createElement(tag);
        if (style) el.style.cssText = style;
        if (id) el.id = id;
        return el;
    }

    initDOM() {
        this.overlay = this.createEl('div', 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(5,10,18,0.9);display:none;justify-content:center;align-items:center;z-index:2000;pointer-events:auto;font-family:monospace;color:#cdc3b9;', 'options-modal-overlay');

        let modal = this.createEl('div', 'width:80%;max-width:600px;background:#0d3554;border:2px solid #00e5ff;border-radius:8px;padding:20px;display:flex;flex-direction:column;max-height:90%;overflow-y:auto;');

        let title = this.createEl('h2', 'text-align:center;margin-top:0;color:#00e5ff;');
        title.innerText = 'OPTIONS & MILESTONES';

        let tabs = this.createEl('div', 'display:flex;justify-content:space-around;margin-bottom:20px;border-bottom:1px solid #cdc3b9;');

        let tabNames = ['Audio & Comfort', 'Controls', 'Milestones', 'Manage Save Data'];
        this.tabContents = [];
        this.tabBtns = [];

        for (let i = 0; i < tabNames.length; i++) {
            let btn = this.createEl('button', 'background:none;border:none;color:#cdc3b9;font:bold 14px monospace;cursor:pointer;padding:10px;outline:none;');
            btn.type = 'button';
            btn.innerText = tabNames[i];
            btn.onclick = () => this.switchTab(i);
            tabs.appendChild(btn);
            this.tabBtns.push(btn);

            let content = this.createEl('div');
            content.style.display = i === 0 ? 'block' : 'none';
            this.tabContents.push(content);
        }

        // Tab 0: Audio & Comfort
        let t0 = this.tabContents[0];
        let d1 = this.createEl('div', 'margin-bottom:15px;');
        let lbl1 = this.createEl('label');
        lbl1.innerText = 'Master Volume: ';
        let span1 = this.createEl('span', '', 'vol-val');
        span1.innerText = '100%';
        lbl1.appendChild(span1);
        let br = this.createEl('br');
        let range = this.createEl('input', 'width:100%;', 'vol-slider');
        range.type = 'range';
        range.min = 0;
        range.max = 100;
        range.value = 100;
        d1.appendChild(lbl1);
        d1.appendChild(br);
        d1.appendChild(range);

        let d2 = this.createEl('div', 'margin-bottom:15px;');
        let lbl2 = this.createEl('label');
        let chk1 = this.createEl('input', '', 'reduced-motion-chk');
        chk1.type = 'checkbox';
        lbl2.appendChild(chk1);
        lbl2.appendChild(document.createTextNode(' Reduced Motion'));
        d2.appendChild(lbl2);

        let d3 = this.createEl('div', 'margin-bottom:15px;');
        let lbl3 = this.createEl('label');
        let chk2 = this.createEl('input', '', 'high-contrast-chk');
        chk2.type = 'checkbox';
        lbl3.appendChild(chk2);
        lbl3.appendChild(document.createTextNode(' High Contrast Mode'));
        d3.appendChild(lbl3);

        t0.appendChild(d1);
        t0.appendChild(d2);
        t0.appendChild(d3);

        // Tab 1: Controls
        let t1 = this.tabContents[1];
        let d4 = this.createEl('div', 'margin-bottom:15px;');
        let lbl4 = this.createEl('label');
        let chk3 = this.createEl('input', '', 'left-handed-chk');
        chk3.type = 'checkbox';
        lbl4.appendChild(chk3);
        lbl4.appendChild(document.createTextNode(' Left-Handed Touch Controls'));
        d4.appendChild(lbl4);
        t1.appendChild(d4);

        // Tab 2: Milestones
        this.tabContents[2].id = 'milestones-container';

        // Tab 3: Manage Save Data
        let t3 = this.tabContents[3];
        let det = this.createEl('details');
        let sum = this.createEl('summary', 'cursor:pointer;color:#00e5ff;margin-bottom:10px;');
        sum.innerText = 'Export / Import Save Data';
        det.appendChild(sum);

        let txt = this.createEl('textarea', 'width:100%;height:100px;background:#050a12;color:#cdc3b9;border:1px solid #cdc3b9;font-family:monospace;margin-bottom:10px;', 'save-data-text');
        det.appendChild(txt);

        let bRow = this.createEl('div', 'display:flex;gap:10px;');
        let bExp = this.createEl('button', 'flex:1;padding:10px;background:#061a2b;color:#cdc3b9;border:1px solid #00e5ff;cursor:pointer;', 'export-btn');
        bExp.type = 'button';
        bExp.innerText = 'Copy to Clipboard';
        let bImp = this.createEl('button', 'flex:1;padding:10px;background:#061a2b;color:#cdc3b9;border:1px solid #00e5ff;cursor:pointer;', 'import-btn');
        bImp.type = 'button';
        bImp.innerText = 'Import Save';
        bRow.appendChild(bExp);
        bRow.appendChild(bImp);
        det.appendChild(bRow);

        let d5 = this.createEl('div', 'margin-top:20px;text-align:center;');
        let bRes = this.createEl('button', 'padding:10px 20px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;', 'reset-save-btn');
        bRes.type = 'button';
        bRes.innerText = 'Reset All Data';
        d5.appendChild(bRes);

        t3.appendChild(det);
        t3.appendChild(d5);

        let closeBtn = this.createEl('button', 'margin-top:20px;padding:10px;background:#00e676;color:#050a12;border:none;font:bold 16px monospace;cursor:pointer;border-radius:4px;');
        closeBtn.type = 'button';
        closeBtn.innerText = 'Resume / Close [Esc]';
        closeBtn.onclick = () => {
            this.game.state = 'TITLE';
            this.game.inputManager.keys['Escape'] = false;
        };

        modal.appendChild(title);
        modal.appendChild(tabs);
        for (let i = 0; i < this.tabContents.length; i++) {
            modal.appendChild(this.tabContents[i]);
        }
        modal.appendChild(closeBtn);
        this.overlay.appendChild(modal);
        document.getElementById('ui-layer').appendChild(this.overlay);

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('vol-slider').oninput = (e) => {
            let v = parseInt(e.target.value, 10);
            document.getElementById('vol-val').innerText = v + '%';
            this.game.saveManager.data.options.soundVolume = v / 100.0;
            if (this.game.soundEngine && this.game.soundEngine.masterGain) {
                this.game.soundEngine.masterGain.gain.value = this.game.saveManager.data.options.soundVolume;
            }
            this.game.saveManager.save();
        };

        document.getElementById('reduced-motion-chk').onchange = (e) => {
            this.game.saveManager.data.options.reducedMotion = e.target.checked;
            this.game.saveManager.save();
        };

        document.getElementById('high-contrast-chk').onchange = (e) => {
            this.game.saveManager.data.options.highContrast = e.target.checked;
            this.game.saveManager.save();
        };

        document.getElementById('left-handed-chk').onchange = (e) => {
            this.game.saveManager.data.options.leftHanded = e.target.checked;
            this.game.saveManager.save();
            this.updateHandedness();
        };

        document.getElementById('export-btn').onclick = () => {
            let dataStr = JSON.stringify(this.game.saveManager.data);
            let b64 = btoa(dataStr);
            let el = document.getElementById('save-data-text');
            el.value = b64;
            el.select();
            document.execCommand('copy');
        };

        document.getElementById('import-btn').onclick = () => {
            try {
                let el = document.getElementById('save-data-text');
                let b64 = el.value.trim();
                if (b64.length > 0) {
                    let dataStr = atob(b64);
                    let parsed = JSON.parse(dataStr);
                    if (parsed && typeof parsed === 'object') {
                        Object.assign(this.game.saveManager.data, parsed);
                        this.game.saveManager.save();
                        this.refreshUI();
                        this.applyMilestoneBonuses();
                    }
                }
            } catch (e) {
                console.warn(e);
            }
        };

        document.getElementById('reset-save-btn').onclick = () => {
            localStorage.removeItem(this.game.saveManager.saveKey);
            this.game.saveManager.data.highScore = 0;
            this.game.saveManager.data.bestWaveOrCombo = 0;
            this.game.saveManager.data.totalGamesPlayed = 0;
            this.game.saveManager.data.totalScoreAccumulated = 0;
            this.game.saveManager.data.unlockedMilestones = [];
            this.game.saveManager.data.options.soundVolume = 1;
            this.game.saveManager.data.options.musicVolume = 1;
            this.game.saveManager.data.options.reducedMotion = false;
            this.game.saveManager.data.options.highContrast = false;
            this.game.saveManager.data.options.leftHanded = false;
            this.game.saveManager.save();
            this.applyMilestoneBonuses();
            this.refreshUI();
        };
    }

    switchTab(idx) {
        for (let i = 0; i < this.tabContents.length; i++) {
            this.tabContents[i].style.display = i === idx ? 'block' : 'none';
            this.tabBtns[i].style.color = i === idx ? '#00e5ff' : '#cdc3b9';
            this.tabBtns[i].style.borderBottom = i === idx ? '2px solid #00e5ff' : 'none';
        }
    }

    refreshUI() {
        if (!this.game || !this.game.saveManager) return;
        let opts = this.game.saveManager.data.options;
        let volSlider = document.getElementById('vol-slider');
        if (volSlider) {
            let v = Math.round(opts.soundVolume * 100);
            volSlider.value = v;
            document.getElementById('vol-val').innerText = v + '%';
        }
        let rmChk = document.getElementById('reduced-motion-chk');
        if (rmChk) rmChk.checked = !!opts.reducedMotion;

        let hcChk = document.getElementById('high-contrast-chk');
        if (hcChk) hcChk.checked = !!opts.highContrast;

        let lhChk = document.getElementById('left-handed-chk');
        if (lhChk) lhChk.checked = !!opts.leftHanded;

        this.updateHandedness();

        let container = document.getElementById('milestones-container');
        if (container) {
            container.innerHTML = '';
            for (let i = 0; i < this.milestones.length; i++) {
                let m = this.milestones[i];
                let unlocked = this.game.saveManager.data.unlockedMilestones.includes(m.id);
                let bc = unlocked ? '#00e676' : '#555';
                let mDiv = this.createEl('div', 'padding:10px;margin-bottom:10px;border:1px solid ' + bc + ';border-radius:4px;display:flex;justify-content:space-between;');

                let tc = unlocked ? '#00e676' : '#cdc3b9';
                let sc = unlocked ? '#00e676' : '#e74c3c';
                let statusText = unlocked ? 'UNLOCKED' : 'LOCKED';

                let dL = this.createEl('div');
                let str = this.createEl('strong');
                str.style.color = tc;
                str.innerText = m.name;
                let br = this.createEl('br');
                let sp = this.createEl('span', 'font-size:12px;color:#aaa;');
                sp.innerText = m.desc;
                dL.appendChild(str);
                dL.appendChild(br);
                dL.appendChild(sp);

                let dR = this.createEl('div');
                dR.style.color = sc;
                dR.innerText = statusText;

                mDiv.appendChild(dL);
                mDiv.appendChild(dR);

                container.appendChild(mDiv);
            }
        }
    }

    updateHandedness() {
        let dashBtn = document.getElementById('dash-button');
        if (dashBtn) {
            if (this.game.saveManager.data.options.leftHanded) {
                dashBtn.style.right = 'auto';
                dashBtn.style.left = '16px';
            } else {
                dashBtn.style.left = 'auto';
                dashBtn.style.right = '126px';
            }
        }
    }

    spawnCelebration() {
        let x = this.game.width / 2;
        let y = this.game.height / 2;
        for (let i = 0; i < 20; i++) {
            this.celebrationParticles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 1.5 + Math.random(),
                color: '#00e676'
            });
        }
    }

    updateCelebration() {
        let dt = 0.016;
        for (let i = this.celebrationParticles.length - 1; i >= 0; i--) {
            let p = this.celebrationParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.celebrationParticles.splice(i, 1);
            }
        }
    }

    drawCelebration(ctx) {
        for (let i = 0; i < this.celebrationParticles.length; i++) {
            let p = this.celebrationParticles[i];
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life;
            ctx.fillRect(p.x, p.y, 6, 6);
        }
        ctx.globalAlpha = 1.0;
    }

    checkMilestones() {
        let changed = false;
        let c = 0;
        for (let i = 0; i < this.milestones.length; i++) {
            let m = this.milestones[i];
            if (!this.game.saveManager.data.unlockedMilestones.includes(m.id)) {
                if (m.condition(this.game.saveManager.data)) {
                    this.game.saveManager.data.unlockedMilestones.push(m.id);
                    changed = true;
                    c++;
                    if (this.game.vfx) {
                        this.game.vfx.addFloatingText(this.game.width/2, 100 + c*20, 'Milestone Unlocked: ' + m.name + '!', '#00e676');
                    }
                }
            }
        }
        if (changed) {
            this.game.saveManager.save();
            this.applyMilestoneBonuses();
            this.refreshUI();
            this.spawnCelebration();
        }
    }

    updateUI() {
        if (this.game.state === 'OPTIONS') {
            if (this.overlay.style.display === 'none') {
                this.refreshUI();
                this.switchTab(0);
                this.overlay.style.display = 'flex';
                let txt = document.getElementById('save-data-text');
                if (txt) txt.value = '';
            }
        } else {
            if (this.overlay.style.display !== 'none') {
                this.overlay.style.display = 'none';
            }
        }

        if (this.game.vfx) {
            if (this.game.saveManager.data.options.reducedMotion) {
                this.game.vfx.reducedMotion = true;
            } else {
                this.game.vfx.reducedMotion = false;
            }
        }

        if (this.game.world) {
             this.game.world.highContrast = !!this.game.saveManager.data.options.highContrast;
        }

        this.updateCelebration();
        if (this.celebrationParticles.length > 0 && this.game.ctx) {
            this.drawCelebration(this.game.ctx);
        }

        if (this.game.state === 'PLAYING' || this.game.state === 'GAME_OVER') {
            let r = Math.random();
            let threshold = 0.05;
            let combined = r * threshold;
            if (r < threshold && combined < 0.01) {
                this.checkMilestones();
            }
        }
    }
}
