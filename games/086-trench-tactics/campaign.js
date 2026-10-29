class CampaignManager {
    constructor(g) {
        this.g = g;
        this.mils = [
            { id: 'first_blood', name: 'First Blood', desc: 'Destroy your first enemy.', cond: (d) => d.totalScoreAccumulated >= 10 },
            { id: 'survivor', name: 'Trench Survivor', desc: 'Reach a score of 500 in one game.', cond: (d) => d.highScore >= 500 },
            { id: 'veteran', name: 'Veteran Tactician', desc: 'Play 10 games.', cond: (d) => d.totalGamesPlayed >= 10 },
            { id: 'hoarder', name: 'Score Hoarder', desc: 'Accumulate 5000 total score.', cond: (d) => d.totalScoreAccumulated >= 5000 },
            { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat a boss.', cond: (d) => d.highScore >= 300 }
        ];

        let o = this.g.saveManager.data.options;
        if (o.reducedMotion === undefined) o.reducedMotion = false;
        if (o.highContrast === undefined) o.highContrast = false;
        if (o.leftHanded === undefined) o.leftHanded = false;

        this.g.saveManager.save();
        this.milBonuses = 0;
        this.applyMilestoneBonuses();
        this.parts = [];
        this.initDOM();
    }

    applyMilestoneBonuses() {
        this.milBonuses = 0;
        let u = this.g.saveManager.data.unlockedMilestones;
        for (let i = 0; i < u.length; i++) {
            if (u[i] === 'first_blood') this.milBonuses += 1;
            else if (u[i] === 'survivor') this.milBonuses += 2;
            else if (u[i] === 'veteran') this.milBonuses += 3;
            else if (u[i] === 'hoarder') this.milBonuses += 4;
            else if (u[i] === 'boss_slayer') this.milBonuses += 5;
        }
        if (this.g.player) {
            this.g.player.bonusSpeed = this.milBonuses * 5;
            this.g.player.bonusDamage = Math.floor(this.milBonuses / 2);
        }
    }

    ce(tag, className, id, inner) {
        let el = document.createElement(tag);
        if (className) el.className = className;
        if (id) el.id = id;
        if (inner) el.innerText = inner;
        return el;
    }

    initDOM() {
        this.overlay = this.ce('div', null, 'options-modal-overlay');
        this.overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(5,10,18,0.9);display:none;justify-content:center;align-items:center;z-index:2000;pointer-events:auto;font-family:monospace;color:#cdc3b9;';

        let m = this.ce('div');
        m.style.cssText = 'width:80%;max-width:600px;background:#0d3554;border:2px solid #00e5ff;border-radius:8px;padding:20px;display:flex;flex-direction:column;max-height:90%;overflow-y:auto;';

        let title = this.ce('h2', null, null, 'OPTIONS & MILESTONES');
        title.style.cssText = 'text-align:center;margin-top:0;color:#00e5ff;';
        m.appendChild(title);

        let tabs = this.ce('div');
        tabs.style.cssText = 'display:flex;justify-content:space-around;margin-bottom:20px;border-bottom:1px solid #cdc3b9;';

        let tN = ['Audio & Comfort', 'Controls', 'Milestones', 'Manage Save Data'];
        this.tC = [];
        this.tB = [];

        for (let i = 0; i < tN.length; i++) {
            let btn = this.ce('button', null, null, tN[i]);
            btn.style.cssText = 'background:none;border:none;color:#cdc3b9;font:bold 14px monospace;cursor:pointer;padding:10px;outline:none;';
            btn.type = 'button';
            btn.onclick = () => this.switchTab(i);
            tabs.appendChild(btn);
            this.tB.push(btn);

            let cnt = this.ce('div');
            cnt.style.display = i === 0 ? 'block' : 'none';
            this.tC.push(cnt);
        }

        let dMb = 'margin-bottom:15px;';

        let r = this.ce('input', null, 'vol-slider');
        r.style.width = '100%';
        r.type = 'range'; r.min = 0; r.max = 100; r.value = 100;
        let v = this.ce('span', null, 'vol-val', '100%');
        let d1 = this.ce('div'); d1.style.cssText = dMb;
        let l1 = this.ce('label');
        l1.innerText = 'Master Volume: ';
        l1.appendChild(v);
        d1.appendChild(l1);
        d1.appendChild(document.createElement('br'));
        d1.appendChild(r);
        this.tC[0].appendChild(d1);

        let c1 = this.ce('input', null, 'reduced-motion-chk'); c1.type = 'checkbox';
        let d2 = this.ce('div'); d2.style.cssText = dMb;
        let l2 = this.ce('label'); l2.appendChild(c1); l2.appendChild(document.createTextNode(' Reduced Motion'));
        d2.appendChild(l2); this.tC[0].appendChild(d2);

        let c2 = this.ce('input', null, 'high-contrast-chk'); c2.type = 'checkbox';
        let d3 = this.ce('div'); d3.style.cssText = dMb;
        let l3 = this.ce('label'); l3.appendChild(c2); l3.appendChild(document.createTextNode(' High Contrast Mode'));
        d3.appendChild(l3); this.tC[0].appendChild(d3);

        let c3 = this.ce('input', null, 'left-handed-chk'); c3.type = 'checkbox';
        let d4 = this.ce('div'); d4.style.cssText = dMb;
        let l4 = this.ce('label'); l4.appendChild(c3); l4.appendChild(document.createTextNode(' Left-Handed Touch Controls'));
        d4.appendChild(l4); this.tC[1].appendChild(d4);

        this.tC[2].id = 'milestones-container';

        let d5 = this.ce('details');
        let s5 = this.ce('summary', null, null, 'Export / Import Save Data');
        s5.style.cssText = 'cursor:pointer;color:#00e5ff;margin-bottom:10px;';
        d5.appendChild(s5);
        let txt = this.ce('textarea', null, 'save-data-text');
        txt.style.cssText = 'width:100%;height:100px;background:#050a12;color:#cdc3b9;border:1px solid #cdc3b9;font-family:monospace;margin-bottom:10px;';
        d5.appendChild(txt);

        let bStyle = 'flex:1;padding:10px;background:#061a2b;color:#cdc3b9;border:1px solid #00e5ff;cursor:pointer;';
        let bExp = this.ce('button', null, 'export-btn', 'Copy to Clipboard'); bExp.style.cssText = bStyle; bExp.type = 'button';
        let bImp = this.ce('button', null, 'import-btn', 'Import Save'); bImp.style.cssText = bStyle; bImp.type = 'button';
        let d6 = this.ce('div'); d6.style.cssText = 'display:flex;gap:10px;';
        d6.appendChild(bExp); d6.appendChild(bImp);
        d5.appendChild(d6);
        this.tC[3].appendChild(d5);

        let bRes = this.ce('button', null, 'reset-save-btn', 'Reset All Data');
        bRes.style.cssText = 'padding:10px 20px;background:#e74c3c;color:#fff;border:none;border-radius:4px;cursor:pointer;';
        bRes.type = 'button';
        let d7 = this.ce('div'); d7.style.cssText = 'margin-top:20px;text-align:center;';
        d7.appendChild(bRes);
        this.tC[3].appendChild(d7);

        let closeBtn = this.ce('button', null, null, 'Resume / Close [Esc]');
        closeBtn.style.cssText = 'margin-top:20px;padding:10px;background:#00e676;color:#050a12;border:none;font:bold 16px monospace;cursor:pointer;border-radius:4px;';
        closeBtn.type = 'button';
        closeBtn.onclick = () => {
            this.g.state = 'TITLE';
            this.g.inputManager.keys['Escape'] = false;
        };

        m.appendChild(tabs);
        for (let i = 0; i < this.tC.length; i++) m.appendChild(this.tC[i]);
        m.appendChild(closeBtn);
        this.overlay.appendChild(m);
        document.getElementById('ui-layer').appendChild(this.overlay);

        this.bindEvents();
    }

    bindEvents() {
        document.getElementById('vol-slider').oninput = (e) => {
            let v = parseInt(e.target.value, 10);
            document.getElementById('vol-val').innerText = v + '%';
            this.g.saveManager.data.options.soundVolume = v / 100.0;
            if (this.g.soundEngine && this.g.soundEngine.masterGain) {
                this.g.soundEngine.masterGain.gain.value = this.g.saveManager.data.options.soundVolume;
            }
            this.g.saveManager.save();
        };

        document.getElementById('reduced-motion-chk').onchange = (e) => {
            this.g.saveManager.data.options.reducedMotion = e.target.checked;
            this.g.saveManager.save();
        };

        document.getElementById('high-contrast-chk').onchange = (e) => {
            this.g.saveManager.data.options.highContrast = e.target.checked;
            this.g.saveManager.save();
        };

        document.getElementById('left-handed-chk').onchange = (e) => {
            this.g.saveManager.data.options.leftHanded = e.target.checked;
            this.g.saveManager.save();
            this.updateHandedness();
        };

        document.getElementById('export-btn').onclick = () => {
            let b64 = btoa(JSON.stringify(this.g.saveManager.data));
            let el = document.getElementById('save-data-text');
            el.value = b64;
            el.select();
            document.execCommand('copy');
        };

        document.getElementById('import-btn').onclick = () => {
            try {
                let b64 = document.getElementById('save-data-text').value.trim();
                if (b64.length > 0) {
                    let parsed = JSON.parse(atob(b64));
                    if (parsed && typeof parsed === 'object') {
                        Object.assign(this.g.saveManager.data, parsed);
                        this.g.saveManager.save();
                        this.refreshUI();
                        this.applyMilestoneBonuses();
                    }
                }
            } catch (e) {
                console.warn(e);
            }
        };

        document.getElementById('reset-save-btn').onclick = () => {
            localStorage.removeItem(this.g.saveManager.saveKey);
            this.g.saveManager.data.highScore = 0;
            this.g.saveManager.data.bestWaveOrCombo = 0;
            this.g.saveManager.data.totalGamesPlayed = 0;
            this.g.saveManager.data.totalScoreAccumulated = 0;
            this.g.saveManager.data.unlockedMilestones = [];
            this.g.saveManager.data.options = { soundVolume: 1, musicVolume: 1, reducedMotion: false, highContrast: false, leftHanded: false };
            this.g.saveManager.save();
            this.applyMilestoneBonuses();
            this.refreshUI();
        };
    }

    switchTab(idx) {
        for (let i = 0; i < this.tC.length; i++) {
            this.tC[i].style.display = i === idx ? 'block' : 'none';
            this.tB[i].style.color = i === idx ? '#00e5ff' : '#cdc3b9';
            this.tB[i].style.borderBottom = i === idx ? '2px solid #00e5ff' : 'none';
        }
    }

    refreshUI() {
        if (!this.g || !this.g.saveManager) return;
        let o = this.g.saveManager.data.options;
        let vs = document.getElementById('vol-slider');
        if (vs) {
            let v = Math.round(o.soundVolume * 100);
            vs.value = v;
            document.getElementById('vol-val').innerText = v + '%';
        }
        let rm = document.getElementById('reduced-motion-chk');
        if (rm) rm.checked = !!o.reducedMotion;

        let hc = document.getElementById('high-contrast-chk');
        if (hc) hc.checked = !!o.highContrast;

        let lh = document.getElementById('left-handed-chk');
        if (lh) lh.checked = !!o.leftHanded;

        this.updateHandedness();

        let c = document.getElementById('milestones-container');
        if (c) {
            c.innerHTML = '';
            for (let i = 0; i < this.mils.length; i++) {
                let m = this.mils[i];
                let unl = this.g.saveManager.data.unlockedMilestones.includes(m.id);
                let bc = unl ? '#00e676' : '#555';
                let div = this.ce('div');
                div.style.cssText = 'padding:10px;margin-bottom:10px;border:1px solid ' + bc + ';border-radius:4px;display:flex;justify-content:space-between;';

                let tc = unl ? '#00e676' : '#cdc3b9';
                let sc = unl ? '#00e676' : '#e74c3c';

                let dd1 = this.ce('div');
                let st = this.ce('strong'); st.style.color = tc; st.innerText = m.name;
                let sp = this.ce('span'); sp.style.cssText = 'font-size:12px;color:#aaa;'; sp.innerText = m.desc;
                dd1.appendChild(st); dd1.appendChild(document.createElement('br')); dd1.appendChild(sp);
                let dd2 = this.ce('div'); dd2.style.color = sc; dd2.innerText = unl ? 'UNLOCKED' : 'LOCKED';
                div.appendChild(dd1); div.appendChild(dd2);
                c.appendChild(div);
            }
        }
    }

    updateHandedness() {
        let db = document.getElementById('dash-button');
        if (db) {
            if (this.g.saveManager.data.options.leftHanded) {
                db.style.right = 'auto';
                db.style.left = '16px';
            } else {
                db.style.left = 'auto';
                db.style.right = '126px';
            }
        }
    }

    spawnCelebration() {
        let x = this.g.width / 2;
        let y = this.g.height / 2;
        for (let i = 0; i < 20; i++) {
            this.parts.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 400,
                vy: (Math.random() - 0.5) * 400,
                life: 1.5 + Math.random(),
                color: '#00e676'
            });
        }
    }

    checkMilestones() {
        let chg = false;
        let c = 0;
        for (let i = 0; i < this.mils.length; i++) {
            let m = this.mils[i];
            if (!this.g.saveManager.data.unlockedMilestones.includes(m.id)) {
                if (m.cond(this.g.saveManager.data)) {
                    this.g.saveManager.data.unlockedMilestones.push(m.id);
                    chg = true;
                    c++;
                    if (this.g.vfx) {
                        this.g.vfx.addFloatingText(this.g.width/2, 100 + c*20, 'Milestone Unlocked: ' + m.name + '!', '#00e676');
                    }
                }
            }
        }
        if (chg) {
            this.g.saveManager.save();
            this.applyMilestoneBonuses();
            this.refreshUI();
            this.spawnCelebration();
        }
    }

    updateUI() {
        if (this.g.state === 'OPTIONS') {
            if (this.overlay.style.display === 'none') {
                this.refreshUI();
                this.switchTab(0);
                this.overlay.style.display = 'flex';
                let t = document.getElementById('save-data-text');
                if (t) t.value = '';
            }
        } else {
            if (this.overlay.style.display !== 'none') {
                this.overlay.style.display = 'none';
            }
        }

        if (this.g.vfx) {
            this.g.vfx.reducedMotion = !!this.g.saveManager.data.options.reducedMotion;
        }
        if (this.g.world) {
            this.g.world.highContrast = !!this.g.saveManager.data.options.highContrast;
        }

        let dt = 0.016;
        for (let i = this.parts.length - 1; i >= 0; i--) {
            let p = this.parts[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.parts.splice(i, 1);
        }
        if (this.parts.length > 0 && this.g.ctx) {
            for (let i = 0; i < this.parts.length; i++) {
                let p = this.parts[i];
                this.g.ctx.fillStyle = p.color;
                this.g.ctx.globalAlpha = p.life;
                this.g.ctx.fillRect(p.x, p.y, 6, 6);
            }
            this.g.ctx.globalAlpha = 1.0;
        }

        if (this.g.state === 'PLAYING' || this.g.state === 'GAME_OVER') {
            if (Math.random() < 0.05) {
                this.checkMilestones();
            }
        }
    }
}
