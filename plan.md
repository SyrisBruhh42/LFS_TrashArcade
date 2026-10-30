1. **Create `campaign.js`**
   - Create the `campaign.js` file with the complete `CampaignManager` implementation using bash:
```bash
cat << 'EOF2' > games/087-tokyo-high-school-rooftop-sakura-courtyard-d/campaign.js
class CampaignManager {
    constructor(game) {
        this.game = game;
        this.milestones = [
            { id: 'first_date', name: 'First Date', desc: 'Reach 10 affection with any lead.', unlocked: false },
            { id: 'popular', name: 'Rising Star', desc: 'Reach 50 Charm.', unlocked: false },
            { id: 'rich', name: 'Big Spender', desc: 'Accumulate ¥1000.', unlocked: false },
            { id: 'midterm', name: 'Midterm Cleared', desc: 'Survive the Day 15 Showdown.', unlocked: false },
            { id: 'finale', name: 'Festival Star', desc: 'Complete the 30-day campaign.', unlocked: false }
        ];

        if (!this.game.saveManager.data.milestones) {
            this.game.saveManager.data.milestones = {};
        }
        this.syncMilestones();
    }

    syncMilestones() {
        for (let m of this.milestones) {
            if (this.game.saveManager.data.milestones[m.id]) {
                m.unlocked = true;
            }
        }
    }

    update(dt) {
        if (!this.game.saveManager || !this.game.saveManager.data) return;
        const stats = this.game.saveManager.data.stats;
        const affection = this.game.saveManager.data.affection;
        if (!stats || !affection) return;

        if (!this.milestones[0].unlocked) {
            let maxAff = 0;
            for (let k in affection) maxAff = Math.max(maxAff, affection[k]);
            if (maxAff >= 10) this.unlock('first_date');
        }

        if (!this.milestones[1].unlocked && stats.charm >= 50) this.unlock('popular');
        if (!this.milestones[2].unlocked && stats.cash >= 1000) this.unlock('rich');
        if (!this.milestones[3].unlocked && this.game.saveManager.data.day > 15) this.unlock('midterm');
        if (!this.milestones[4].unlocked && this.game.saveManager.data.day > 30) this.unlock('finale');
    }

    unlock(id) {
        let m = this.milestones.find(x => x.id === id);
        if (m && !m.unlocked) {
            m.unlocked = true;
            this.game.saveManager.data.milestones[id] = true;
            this.game.saveManager.save();

            if (this.game.vfx) {
                this.game.vfx.addFloatingText(400, 300, `Milestone Unlocked: ${m.name}!`, '#7c4dff');
                this.game.vfx.burst(400, 300, 30, '#ff4081');
            }
            if (this.game.sound) {
                this.game.sound.playItemUnlock();
            }
        }
    }

    draw(ctx) {
        if (this.game.state === 'TITLE') {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(50, 350, 200, 220);
            ctx.strokeStyle = '#ff4081';
            ctx.strokeRect(50, 350, 200, 220);

            ctx.fillStyle = '#ff4081';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Milestones', 150, 375);

            ctx.textAlign = 'left';
            ctx.font = '12px sans-serif';
            for (let i = 0; i < this.milestones.length; i++) {
                let m = this.milestones[i];
                ctx.fillStyle = m.unlocked ? '#7c4dff' : '#999';
                ctx.fillText(`${m.unlocked ? '★' : '☆'} ${m.name}`, 60, 405 + i * 30);

                if (this.game.input.mouse.x >= 50 && this.game.input.mouse.x <= 250 &&
                    this.game.input.mouse.y >= 390 + i * 30 && this.game.input.mouse.y <= 415 + i * 30) {
                    ctx.fillStyle = '#333';
                    ctx.fillText(m.desc, 60, 560);
                }
            }
        }
    }
}
EOF2
```

2. **Verify `campaign.js` creation**
   - Run `ls -la games/087-tokyo-high-school-rooftop-sakura-courtyard-d/campaign.js` to verify.

3. **Update UI in `index.html`**
   - Use `replace_with_git_merge_diff` to add the mute checkbox and `campaign.js` script to `index.html`:
```
<<<<<<< SEARCH
                    <div class="controls-row">
                        <span>Master Volume</span>
                        <input type="range" id="vol-master" min="0" max="1" step="0.1" value="1">
                    </div>
=======
                    <div class="controls-row">
                        <span>Master Volume</span>
                        <input type="range" id="vol-master" min="0" max="1" step="0.1" value="1">
                    </div>
                    <div class="controls-row">
                        <span>Mute Audio</span>
                        <input type="checkbox" id="toggle-mute">
                    </div>
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
    <script defer src="audio.js"></script>
    <script src="game.js"></script>
</body>
=======
    <script defer src="audio.js"></script>
    <script defer src="campaign.js"></script>
    <script src="game.js"></script>
</body>
>>>>>>> REPLACE
```

4. **Verify `index.html` update**
   - Use `sed -n '50,70p' games/087-tokyo-high-school-rooftop-sakura-courtyard-d/index.html` and `tail -n 20 games/087-tokyo-high-school-rooftop-sakura-courtyard-d/index.html`.

5. **Update `game.js` integration**
   - Use `replace_with_git_merge_diff` to initialize `CampaignManager`, wire mute, and handle touch handedness:
```
<<<<<<< SEARCH
        if (typeof BossManager !== 'undefined') this.bosses = new BossManager(this);
        if (typeof ProgressionManager !== 'undefined') this.progression = new ProgressionManager(this);
        if (typeof VFXManager !== 'undefined') this.vfx = new VFXManager(this);
=======
        if (typeof BossManager !== 'undefined') this.bosses = new BossManager(this);
        if (typeof ProgressionManager !== 'undefined') this.progression = new ProgressionManager(this);
        if (typeof VFXManager !== 'undefined') this.vfx = new VFXManager(this);
        if (typeof CampaignManager !== 'undefined') this.campaign = new CampaignManager(this);
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
    initUI() {
        const updateOpt = () => { this.applyOptions(); this.saveManager.save(); };
        document.getElementById('vol-master').addEventListener('input', e => { this.saveManager.data.options.masterVol = parseFloat(e.target.value); updateOpt(); });
=======
    initUI() {
        const updateOpt = () => { this.applyOptions(); this.saveManager.save(); };
        document.getElementById('vol-master').addEventListener('input', e => { this.saveManager.data.options.masterVol = parseFloat(e.target.value); updateOpt(); });
        if (document.getElementById('toggle-mute')) document.getElementById('toggle-mute').addEventListener('change', e => { this.saveManager.data.options.mute = e.target.checked; updateOpt(); });
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
    applyOptions() {
        const opt = this.saveManager.data.options;
        this.sound.setVolumes(opt.masterVol, opt.sfxVol, opt.musicVol);
        document.getElementById('vol-master').value = opt.masterVol;
    }
=======
    applyOptions() {
        const opt = this.saveManager.data.options;
        let master = opt.mute ? 0 : opt.masterVol;
        this.sound.setVolumes(master, opt.sfxVol, opt.musicVol);
        document.getElementById('vol-master').value = opt.masterVol;
        if(document.getElementById('toggle-mute')) document.getElementById('toggle-mute').checked = !!opt.mute;
        if(document.getElementById('toggle-lefthand')) document.getElementById('toggle-lefthand').checked = !!opt.leftHand;
    }
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
        } else if (this.state === 'PLAYING') {
            this.buttons = [
                { x: 100, y: 200, w: 120, h: 60, text: 'Study', onClick: () => this.doAction('study') },
                { x: 100, y: 280, w: 120, h: 60, text: 'Work', onClick: () => this.doAction('work') },
                { x: 100, y: 360, w: 120, h: 60, text: 'Practice', onClick: () => this.doAction('practice') },
                { x: 100, y: 440, w: 120, h: 60, text: 'Explore', onClick: () => this.doAction('explore') },
                { x: 100, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },
                { x: 680, y: 20, w: 100, h: 40, text: 'Menu', onClick: () => this.pause() }
            ];
=======
        } else if (this.state === 'PLAYING') {
            const bx = this.saveManager.data.options.leftHand ? 660 : 100;
            const bMenuX = this.saveManager.data.options.leftHand ? 20 : 680;
            this.buttons = [
                { x: bx, y: 200, w: 120, h: 60, text: 'Study', onClick: () => this.doAction('study') },
                { x: bx, y: 280, w: 120, h: 60, text: 'Work', onClick: () => this.doAction('work') },
                { x: bx, y: 360, w: 120, h: 60, text: 'Practice', onClick: () => this.doAction('practice') },
                { x: bx, y: 440, w: 120, h: 60, text: 'Explore', onClick: () => this.doAction('explore') },
                { x: bx, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },
                { x: bMenuX, y: 20, w: 100, h: 40, text: 'Menu', onClick: () => this.pause() }
            ];
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
        } else if (this.state === 'SHOWDOWN') {
            this.buttons = [
                { x: 100, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },
                { x: 100, y: 440, w: 120, h: 40, text: 'Attack', onClick: () => { if (this.bosses && this.bosses.activeShowdown) this.bosses.activeShowdown.hp -= 2; this.sound.playStatUp(); } }
            ];
=======
        } else if (this.state === 'SHOWDOWN') {
            const bx = this.saveManager.data.options.leftHand ? 660 : 100;
            this.buttons = [
                { x: bx, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },
                { x: bx, y: 440, w: 120, h: 40, text: 'Attack', onClick: () => { if (this.bosses && this.bosses.activeShowdown) this.bosses.activeShowdown.hp -= 2; this.sound.playStatUp(); } }
            ];
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
        if (this.progression) this.progression.update(dt);
        if (this.vfx) this.vfx.update(dt);
=======
        if (this.progression) this.progression.update(dt);
        if (this.vfx) this.vfx.update(dt);
        if (this.campaign) this.campaign.update(dt);
>>>>>>> REPLACE
```
```
<<<<<<< SEARCH
        if (this.state === 'GAMEOVER') {
            this.ctx.fillStyle = '#ff4081';
            this.ctx.font = 'bold 36px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Festival Day!', 400, 250);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText(`Final Charm: ${this.saveManager.data.stats.charm}`, 400, 300);
            this.ctx.fillText('Click to Restart', 400, 400);
        }
        if (this.vfx) this.vfx.draw(this.ctx);
    }
=======
        if (this.state === 'GAMEOVER') {
            this.ctx.fillStyle = '#ff4081';
            this.ctx.font = 'bold 36px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Festival Day!', 400, 250);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText(`Final Charm: ${this.saveManager.data.stats.charm}`, 400, 300);
            this.ctx.fillText('Click to Restart', 400, 400);
        }
        if (this.campaign) this.campaign.draw(this.ctx);
        if (this.vfx) this.vfx.draw(this.ctx);
    }
>>>>>>> REPLACE
```

6. **Verify `game.js` update**
   - Run `sed -n '101,130p' games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.js` to ensure the modifications applied successfully.

7. **Update `game.json`**
   - Set `"phase": "9"` using `replace_with_git_merge_diff`.
```
<<<<<<< SEARCH
  "phase": "8",
=======
  "phase": "9",
>>>>>>> REPLACE
```

8. **Verify `game.json`**
   - Run `cat games/087-tokyo-high-school-rooftop-sakura-courtyard-d/game.json`.

9. **Generate Registry**
   - Run `python3 tools/build_registry.py`.

10. **Preflight Checks**
   - Run `python3 tools/preflight.py`.

11. **Pre-commit Checks**
    - Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.

12. **Submit PR**
    - Use the submit tool.
