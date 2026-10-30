class UIManager {
    constructor(game) {
        this.game = game;
        this.milestones = [
            { id: 'first_blood', desc: 'Score 100 points', target: 100, field: 'highScore' },
            { id: 'veteran', desc: 'Score 500 points', target: 500, field: 'highScore' },
            { id: 'grinder', desc: 'Accumulate 2000 total score', target: 2000, field: 'totalScoreAccumulated' },
            { id: 'master', desc: 'Accumulate 10000 total score', target: 10000, field: 'totalScoreAccumulated' },
        ];
        this.initDOM();
    }

    initDOM() {
        this.container = document.createElement('div');
        this.container.id = 'options-container';
        this.container.style.cssText = `
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 400px; padding: 20px; background: rgba(13, 53, 84, 0.95);
            border: 2px solid #00e5ff; color: #cdc3b9; font-family: monospace;
            border-radius: 8px; display: none; z-index: 2000; flex-direction: column; gap: 15px;
        `;

        this.container.innerHTML = `
            <h2 style="text-align: center; color: #00e5ff; margin-top: 0;">OPTIONS</h2>

            <div style="border: 1px solid #cdc3b9; padding: 10px; border-radius: 5px;">
                <h3 style="margin-top: 0; color: #00e676;">Audio & Comfort</h3>
                <label style="display: block; margin-bottom: 5px;"><input type="checkbox" id="opt-mute"> Mute Audio</label>
                <label style="display: block; margin-bottom: 5px;"><input type="range" id="opt-vol" min="0" max="1" step="0.1" value="1"> Volume</label>
                <label style="display: block; margin-bottom: 5px;"><input type="checkbox" id="opt-reduce-motion"> Reduced Motion</label>
                <label style="display: block;"><input type="checkbox" id="opt-high-contrast"> High Contrast Mode</label>
            </div>

            <div style="border: 1px solid #cdc3b9; padding: 10px; border-radius: 5px;">
                <h3 style="margin-top: 0; color: #00e676;">Controls & Ergonomics</h3>
                <label style="display: block;"><input type="checkbox" id="opt-left-handed"> Left-Handed Touch</label>
            </div>

            <details style="border: 1px solid #cdc3b9; padding: 10px; border-radius: 5px;">
                <summary style="cursor: pointer; color: #00e676; font-weight: bold;">Manage Save Data</summary>
                <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 5px;">
                    <button type="button" id="opt-export" style="background: #061a2b; color: #cdc3b9; border: 1px solid #cdc3b9; padding: 5px; cursor: pointer;">Copy Save to Clipboard</button>
                    <button type="button" id="opt-import" style="background: #061a2b; color: #cdc3b9; border: 1px solid #cdc3b9; padding: 5px; cursor: pointer;">Paste Save from Clipboard</button>
                    <button type="button" id="opt-reset" style="background: #e74c3c; color: #fff; border: 1px solid #cdc3b9; padding: 5px; cursor: pointer;">Hard Reset Data</button>
                </div>
            </details>

            <button type="button" id="opt-close" style="background: #00e5ff; color: #050a12; border: none; padding: 10px; font-weight: bold; cursor: pointer; border-radius: 5px; margin-top: 10px;">Return (Esc)</button>
        `;

        document.getElementById('game-container').appendChild(this.container);

        this.bindEvents();
    }

    bindEvents() {
        const d = this.game.saveManager.data;
        const o = d.options || {};

        document.getElementById('opt-mute').checked = o.soundVolume === 0;
        document.getElementById('opt-vol').value = o.soundVolume;
        document.getElementById('opt-reduce-motion').checked = !!o.reducedMotion;
        document.getElementById('opt-high-contrast').checked = !!o.highContrast;
        document.getElementById('opt-left-handed').checked = !!o.leftHanded;

        document.getElementById('opt-mute').addEventListener('change', (e) => {
            o.soundVolume = e.target.checked ? 0 : document.getElementById('opt-vol').value;
            this.applyAudio();
        });
        document.getElementById('opt-vol').addEventListener('input', (e) => {
            o.soundVolume = parseFloat(e.target.value);
            document.getElementById('opt-mute').checked = o.soundVolume === 0;
            this.applyAudio();
        });
        document.getElementById('opt-reduce-motion').addEventListener('change', (e) => { o.reducedMotion = e.target.checked; this.game.saveManager.save(); });
        document.getElementById('opt-high-contrast').addEventListener('change', (e) => { o.highContrast = e.target.checked; this.game.saveManager.save(); });
        document.getElementById('opt-left-handed').addEventListener('change', (e) => { o.leftHanded = e.target.checked; this.game.saveManager.save(); });

        document.getElementById('opt-export').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(btoa(JSON.stringify(this.game.saveManager.data)));
                alert('Save data copied to clipboard!');
            } catch (err) { alert('Failed to copy.'); }
        });

        document.getElementById('opt-import').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                const parsed = JSON.parse(atob(text));
                if (parsed) {
                    this.game.saveManager.data = parsed;
                    this.game.saveManager.save();
                    alert('Save loaded successfully!');
                    this.bindEvents();
                }
            } catch (err) { alert('Invalid save data.'); }
        });

        document.getElementById('opt-reset').addEventListener('click', () => {
            if (confirm('Are you sure you want to wipe all progress?')) {
                const defaults = {
                    highScore: 0, bestWaveOrCombo: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0,
                    unlockedMilestones: [], options: { soundVolume: 1, musicVolume: 1, reducedMotion: false, highContrast: false, leftHanded: false }
                };
                this.game.saveManager.data = defaults;
                this.game.saveManager.save();
                this.bindEvents();
                alert('Progress reset.');
            }
        });

        document.getElementById('opt-close').addEventListener('click', () => {
            this.game.state = 'TITLE';
            this.container.style.display = 'none';
        });
    }

    applyAudio() {
        if (this.game.soundEngine && this.game.soundEngine.masterGain) {
            this.game.soundEngine.masterGain.gain.value = this.game.saveManager.data.options.soundVolume;
        }
        this.game.saveManager.save();
    }

    updateTitle() {
        const input = this.game.inputManager;
        if (input.justPressed['Enter'] || input.justPressed['Space'] || input.mouse.justDown || input.touch.justDown) {
            this.game.start();
        } else if (input.justPressed['KeyO']) {
            this.game.state = 'OPTIONS';
            this.container.style.display = 'flex';
        }
    }

    updateOptions() {
        if (this.game.inputManager.justPressed['Escape']) {
            this.game.state = 'TITLE';
            this.container.style.display = 'none';
            this.game.inputManager.keys['Escape'] = false;
        }
    }

    drawTitle(ctx) {
        const w = this.game.width;
        const h = this.game.height;
        const highContrast = this.game.saveManager.data.options?.highContrast;

        ctx.fillStyle = highContrast ? '#ffffff' : '#cdc3b9';
        ctx.font = 'bold 40px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TRENCH TACTICS', w/2, 80);

        ctx.font = '14px monospace';
        ctx.fillText('LORE: Navigate the deep ocean trench in tactical turn-based blitz combat.', w/2, 110, w - 40);

        ctx.fillStyle = highContrast ? '#000000' : 'rgba(13, 53, 84, 0.8)';
        if (highContrast) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(50, 140, 220, 120);
            ctx.strokeRect(290, 140, 220, 120);
            ctx.strokeRect(530, 140, 220, 120);
        }
        ctx.fillRect(50, 140, 220, 120);
        ctx.fillRect(290, 140, 220, 120);
        ctx.fillRect(530, 140, 220, 120);

        ctx.fillStyle = highContrast ? '#ffffff' : '#00e5ff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('1. The Goal', 160, 165);
        ctx.fillText('2. The Loop', 400, 165);
        ctx.fillText('3. Controls', 640, 165);

        ctx.fillStyle = highContrast ? '#cccccc' : '#cdc3b9';
        ctx.font = '13px monospace';
        ctx.fillText('Survive and destroy', 160, 195);
        ctx.fillText('enemies for points.', 160, 215);
        ctx.fillText('Stillness slows time.', 400, 195);
        ctx.fillText('Movement speeds it up.', 400, 215);
        ctx.fillText('WASD/Drag: Move', 640, 195);
        ctx.fillText('Space/Tap: Attack', 640, 215);

        ctx.font = '24px monospace';
        ctx.fillStyle = highContrast ? '#ffffff' : '#00e676';
        ctx.fillText('Enter / Space / Tap to Start', w/2, 320);

        ctx.fillStyle = highContrast ? '#cccccc' : '#cdc3b9';
        ctx.font = '18px monospace';
        ctx.fillText('Press [O] for Options', w/2, 360);

        ctx.font = '16px monospace';
        ctx.fillText(`High Score: ${this.game.saveManager.data.highScore}`, w/2, 400);

        // Milestones
        ctx.font = '14px monospace';
        let mx = w/2 - 150;
        let my = 440;
        ctx.fillStyle = highContrast ? '#ffffff' : '#00e5ff';
        ctx.fillText('MILESTONES', w/2, my);
        my += 20;
        ctx.font = '12px monospace';
        this.milestones.forEach((m, i) => {
            const unlocked = this.game.saveManager.data.unlockedMilestones.includes(m.id);
            ctx.fillStyle = unlocked ? (highContrast ? '#ffffff' : '#00e676') : (highContrast ? '#888888' : '#555555');
            const col = i % 2;
            const row = Math.floor(i / 2);
            ctx.fillText(`${m.desc} ${unlocked ? '[X]' : '[ ]'}`, w/2 + (col === 0 ? -120 : 120), my + row * 20);
        });
    }

    drawOptions(ctx) {
        // Obscure background slightly, DOM handles the rest
        ctx.fillStyle = 'rgba(5, 10, 18, 0.9)';
        ctx.fillRect(0, 0, this.game.width, this.game.height);
    }

    checkMilestones() {
        let changed = false;
        this.milestones.forEach(m => {
            if (!this.game.saveManager.data.unlockedMilestones.includes(m.id)) {
                if (this.game.saveManager.data[m.field] >= m.target) {
                    this.game.saveManager.data.unlockedMilestones.push(m.id);
                    changed = true;
                }

    evaluateMoreUIState() {
        let stateScore = 0;
        if (this.game.state === 'TITLE') {
            stateScore += 10;
        }

    evaluateMoreUIState2() {
        let stateScore = 0;
        if (this.game.state === 'TITLE') {
            stateScore += 10;
        } else if (this.game.state === 'OPTIONS') {
            stateScore += 20;
        } else if (this.game.state === 'PLAYING') {
            stateScore += 30;
        } else if (this.game.state === 'PAUSED') {
            stateScore += 40;
        } else if (this.game.state === 'GAME_OVER') {
            stateScore += 50;
        } else if (this.game.state === 'UPGRADE') {
            stateScore += 60;
        }

        switch (stateScore) {
            case 10: stateScore += 1; break;
            case 20: stateScore += 2; break;
            case 30: stateScore += 3; break;
            case 40: stateScore += 4; break;
            case 50: stateScore += 5; break;
            case 60: stateScore += 6; break;
            default: stateScore += 7; break;
        }

        if (this.game.score > 0) {
            stateScore++;
        } else if (this.game.score < 0) {
            stateScore--;
        }

        if (this.game.width > 800) {
            stateScore++;
        } else if (this.game.width < 800) {
            stateScore--;
        }

        if (this.game.height > 600) {
            stateScore++;
        } else if (this.game.height < 600) {
            stateScore--;
        }

        return stateScore;
    }
 else if (this.game.state === 'OPTIONS') {
            stateScore += 20;
        } else if (this.game.state === 'PLAYING') {
            stateScore += 30;
        } else if (this.game.state === 'PAUSED') {
            stateScore += 40;
        } else if (this.game.state === 'GAME_OVER') {
            stateScore += 50;
        } else if (this.game.state === 'UPGRADE') {
            stateScore += 60;
        }

        switch (stateScore) {
            case 10: stateScore += 1; break;
            case 20: stateScore += 2; break;
            case 30: stateScore += 3; break;
            case 40: stateScore += 4; break;
            case 50: stateScore += 5; break;
            case 60: stateScore += 6; break;
            default: stateScore += 7; break;
        }

        if (this.game.score > 0) {
            stateScore++;
        } else if (this.game.score < 0) {
            stateScore--;
        }

        if (this.game.width > 800) {
            stateScore++;
        } else if (this.game.width < 800) {
            stateScore--;
        }

        if (this.game.height > 600) {
            stateScore++;
        } else if (this.game.height < 600) {
            stateScore--;
        }

        return stateScore;
    }

            }
        });
        if (changed) this.game.saveManager.save();
    }
}
