// 087-tokyo-high-school-rooftop-sakura-courtyard-d - Phase 1

window.ARCADE_CARTRIDGE_META = {
    lore: "You have 30 days before the Grand Starlight Festival to balance your daily schedule, build your personal stats (Charm, Wit, Talent, Cash), navigate rival drama, and win the heart of one of 5 distinct romanceable leads—or claim solo superstardom.",
    objective: "Manage your Stamina and Cash across Morning/Afternoon/Evening slots, raise the stats required for your chosen character route, choose perceptive dialogue responses, and unlock a True Ending CG before Day 30.",
    inspiration: "Pacthesis Dating Sims (Chrono Days, Number Days, Star Days, Lunar Days, Idol Days, Kingdom Days), Love Hina Sim Date RPG, SimGirl & Date Ariane, Cute Knight & Magical Diary Flash.",
    howItWorks: "1. Plan Your Daily Schedule: Spend Stamina on Work, Study, Studio Practice, or Shopping to boost Charm, Wit, Talent, and Cash. | 2. Explore Locations & Converse: Visit the Cafe, Rooftop, Arcade, or VIP Lounge to trigger branching dialogue and give favorite gifts. | 3. Trigger Milestone Dates & Endings: Cross Affection thresholds at Day 10, 20, and 30 to unlock Festival confessions and persistent Album endings.",
    sessionLength: "10-15 Min 30-Day Calendar Campaign (Quick-Save Any Day)",
    palette: "Background #fff8f6 -> #ffe4ec, Primary Accent #ff4081, Secondary Accent #7c4dff"
};

class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_087_087-tokyo-high-school-rooftop-sakura-courtyard-d_v1';
        this.data = {
            day: 1,
            timeSlot: 0, // 0: Morning, 1: Afternoon, 2: Evening
            stats: { charm: 0, wit: 0, talent: 0, cash: 100, stamina: 100, maxStamina: 100 },
            affection: { lead1: 0, lead2: 0, lead3: 0, lead4: 0, lead5: 0 },
            inventory: [],
            flags: {},
            options: { masterVol: 1, sfxVol: 1, musicVol: 1, highContrast: false, reduceMotion: false }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(this.saveKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                if (parsed.options) this.data.options = { ...this.data.options, ...parsed.options };
                if (parsed.stats) this.data.stats = { ...this.data.stats, ...parsed.stats };
                if (parsed.affection) this.data.affection = { ...this.data.affection, ...parsed.affection };
            }
        } catch (e) { console.warn("Save load failed:", e); }
    }
    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) { console.warn("Save failed:", e); }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
    }
    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }
    setVolumes(master, sfx, music) {
        if (!this.initialized) return;
        this.masterGain.gain.value = master;
        this.sfxGain.gain.value = sfx;
        this.musicGain.gain.value = music;
    }
    playTone(freq, type, duration, vol = 0.5) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playBlip() { this.playTone(800, 'sine', 0.05, 0.2); }
    playConfirm() { this.playTone(1200, 'square', 0.1, 0.2); }
    playError() { this.playTone(300, 'sawtooth', 0.2, 0.3); }
    playStatUp() { this.playTone(600, 'triangle', 0.15, 0.3); setTimeout(() => this.playTone(800, 'triangle', 0.2, 0.3), 100); }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.justPressed = {};
        this.mouse = { x: 0, y: 0, down: false, justDown: false };
        this.touches = [];

        window.addEventListener('keydown', e => {
            this.keys[e.key] = true;
            this.justPressed[e.key] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.key] = false;
        });

        canvas.addEventListener('mousedown', e => {
            this.updateMousePos(e);
            this.mouse.down = true;
            this.mouse.justDown = true;
        });
        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });
        canvas.addEventListener('mousemove', e => {
            this.updateMousePos(e);
        });

        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.updateTouchPos(e);
            this.mouse.down = true;
            this.mouse.justDown = true;
        }, {passive: false});
        window.addEventListener('touchend', e => {
            this.mouse.down = false;
        });
        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouchPos(e);
        }, {passive: false});
    }

    updateMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    }

    updateTouchPos(e) {
        if (e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouse.y = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
        }
    }

    update() {
        this.justPressed = {};
        this.mouse.justDown = false;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(this.canvas);
        if (typeof GadgetRig !== 'undefined') this.gadgetRig = new GadgetRig(this);
        if (typeof WorldRenderer !== 'undefined') this.world = new WorldRenderer(this);
        if (typeof RosterManager !== 'undefined') this.rosters = new RosterManager(this);
        if (typeof BossManager !== 'undefined') this.bosses = new BossManager(this);
        if (typeof ProgressionManager !== 'undefined') this.progression = new ProgressionManager(this);
        if (typeof VFXManager !== 'undefined') this.vfx = new VFXManager(this);

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, EVENT, GAMEOVER, SHOWDOWN, SHOP
        this.lastTime = 0;
        this.buttons = [];

        // Resize harness
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.canvas.parentElement);
        this.handleResize();

        this.initUI();
    }

    handleResize() {
        const parent = this.canvas.parentElement;
        const aspect = 800 / 600;
        let w = parent.clientWidth;
        let h = parent.clientHeight;
        if (w / h > aspect) {
            w = h * aspect;
        } else {
            h = w / aspect;
        }
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
    }

    initUI() {
        const updateOpt = () => { this.applyOptions(); this.saveManager.save(); };
        document.getElementById('vol-master').addEventListener('input', e => { this.saveManager.data.options.masterVol = parseFloat(e.target.value); updateOpt(); });
        document.getElementById('vol-music').addEventListener('input', e => { this.saveManager.data.options.musicVol = parseFloat(e.target.value); updateOpt(); });
        document.getElementById('vol-sfx').addEventListener('input', e => { this.saveManager.data.options.sfxVol = parseFloat(e.target.value); updateOpt(); });
        document.getElementById('toggle-contrast').addEventListener('change', e => { this.saveManager.data.options.highContrast = e.target.checked; updateOpt(); });
        document.getElementById('toggle-motion').addEventListener('change', e => { this.saveManager.data.options.reduceMotion = e.target.checked; updateOpt(); });
        if(document.getElementById('toggle-lefthand')) document.getElementById('toggle-lefthand').addEventListener('change', e => { this.saveManager.data.options.leftHand = e.target.checked; updateOpt(); });
        this.applyOptions();
    }

    applyOptions() {
        const opt = this.saveManager.data.options;
        this.sound.setVolumes(opt.masterVol, opt.sfxVol, opt.musicVol);
        document.getElementById('vol-master').value = opt.masterVol;
    }

    start() {
        requestAnimationFrame(t => this.loop(t));
    }

    pause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
            document.getElementById('options-modal').classList.add('active');
        }
    }

    resume() {
        if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
            this.saveManager.save();
        }
    }

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.update(dt);
        if ((this.state === 'PLAYING' || this.state === 'SHOWDOWN') && this.gadgetRig) this.gadgetRig.update(dt);
        if (this.world && (this.state === 'PLAYING' || this.state === 'TITLE' || this.state === 'SHOWDOWN' || this.state === 'SHOP')) this.world.update(dt, this.input);
        if (this.state === 'SHOWDOWN' && this.bosses) this.bosses.update(dt);
        if (this.progression) this.progression.update(dt);
        if (this.vfx) this.vfx.update(dt);
        this.draw();
        this.input.update();

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (this.input.justPressed['Escape']) {
            if (this.state === 'PLAYING') this.pause();
            else if (this.state === 'PAUSED') {
                document.getElementById('options-modal').classList.remove('active');
                this.resume();
            }
        }

        if (this.state === 'TITLE') {
            if (this.input.justPressed['Enter'] || this.input.mouse.justDown) {
                this.sound.init();
                this.sound.resume();

                // Check if clicking buttons
                let clickedBtn = false;
                for (let b of this.buttons) {
                    if (this.input.mouse.justDown && this.isHover(b)) {
                        b.onClick();
                        clickedBtn = true;
                    }
                }

                if (!clickedBtn) {
                    this.state = 'PLAYING';
                    this.sound.playConfirm();
                    if (this.vfx) {
                        this.vfx.burst(400, 300, 30, '#ff4081');
                        this.vfx.addShake(5, 0.5);
                    }
                }
            }

            this.buttons = [
                { x: 300, y: 450, w: 200, h: 40, text: 'Start (Enter)', onClick: () => { this.state = 'PLAYING'; this.sound.playConfirm(); } },
                { x: 300, y: 500, w: 200, h: 40, text: 'How to Play', onClick: () => { document.getElementById('help-modal').classList.add('active'); } },
                { x: 300, y: 550, w: 200, h: 40, text: 'Options', onClick: () => { document.getElementById('options-modal').classList.add('active'); } }
            ];
        } else if (this.state === 'PLAYING') {
            this.buttons = [
                { x: 100, y: 200, w: 120, h: 60, text: 'Study', onClick: () => this.doAction('study') },
                { x: 100, y: 280, w: 120, h: 60, text: 'Work', onClick: () => this.doAction('work') },
                { x: 100, y: 360, w: 120, h: 60, text: 'Practice', onClick: () => this.doAction('practice') },
                { x: 100, y: 440, w: 120, h: 60, text: 'Explore', onClick: () => this.doAction('explore') },
                { x: 100, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },
                { x: 680, y: 20, w: 100, h: 40, text: 'Menu', onClick: () => this.pause() }
            ];

            if (this.rosters) {
                this.buttons.push({ x: 320, y: 200, w: 60, h: 30, text: 'Prev', onClick: () => { this.rosters.prevLead(); this.sound.playConfirm(); } });
                this.buttons.push({ x: 700, y: 200, w: 60, h: 30, text: 'Next', onClick: () => { this.rosters.nextLead(); this.sound.playConfirm(); } });
            }

            this.buttons.push({ x: 680, y: 70, w: 100, h: 40, text: 'Boutique', onClick: () => { this.state = 'SHOP'; this.sound.playConfirm(); } });

            if (this.input.mouse.justDown) {
                this.sound.init();
                this.sound.resume();
                for (let b of this.buttons) {
                    if (this.isHover(b)) {
                        b.onClick();
                    }
                }
            }
        } else if (this.state === 'SHOP') {
            this.buttons = [
                { x: 340, y: 500, w: 120, h: 40, text: 'Back', onClick: () => { this.state = 'PLAYING'; this.sound.playConfirm(); } }
            ];

            if (this.input.mouse.justDown) {
                this.sound.init();
                this.sound.resume();
                for (let b of this.buttons) {
                    if (this.isHover(b)) {
                        b.onClick();
                    }
                }
            }

            if (this.saveManager.data.day > 30) {
                this.state = 'GAMEOVER';
            }
        } else if (this.state === 'SHOWDOWN') {
            this.buttons = [
                { x: 100, y: 520, w: 120, h: 40, text: 'Combine', onClick: () => { if (this.gadgetRig) this.gadgetRig.activateOverdrive(); } },
                { x: 100, y: 440, w: 120, h: 40, text: 'Attack', onClick: () => { if (this.bosses && this.bosses.activeShowdown) this.bosses.activeShowdown.hp -= 2; this.sound.playStatUp(); } }
            ];

            if (this.input.mouse.justDown) {
                this.sound.init();
                this.sound.resume();
                for (let b of this.buttons) {
                    if (this.isHover(b)) {
                        b.onClick();
                    }
                }
                if (this.progression) this.progression.handleShopClick();
            }
        } else if (this.state === 'GAMEOVER') {
            if (this.input.justPressed['Enter'] || this.input.mouse.justDown) {
                this.saveManager.data.day = 1;
                this.saveManager.save();
                this.state = 'TITLE';
            }
        }
    }

    doAction(type) {
        let staminaCost = 20;
        if (this.saveManager.data.perks && this.saveManager.data.perks.includes('p2')) staminaCost = 15;

        if (this.saveManager.data.stats.stamina < staminaCost) {
            this.sound.playError();
            return;
        }

        let multi = this.progression ? this.progression.synergyMultiplier : 1;
        let charmMod = (this.saveManager.data.perks && this.saveManager.data.perks.includes('p1')) ? 2 : 0;
        let witMod = (this.saveManager.data.perks && this.saveManager.data.perks.includes('p4')) ? 2 : 0;

        this.saveManager.data.stats.stamina -= staminaCost;
        if (type === 'study') {
            let gain = Math.floor((5 + witMod) * multi);
            this.saveManager.data.stats.wit += gain;
            if(this.vfx) { this.vfx.burst(160, 230, 10, '#7c4dff'); this.vfx.addFloatingText(160, 230, `+${gain} Wit`, '#7c4dff'); }
        }
        if (type === 'work') {
            let gain = Math.floor(20 * multi);
            this.saveManager.data.stats.cash += gain;
            if(this.vfx) { this.vfx.burst(160, 310, 10, '#ffff00'); this.vfx.addFloatingText(160, 310, `+¥${gain}`, '#ffff00'); }
        }
        if (type === 'practice') {
            let gainT = Math.floor(5 * multi);
            let gainC = Math.floor((2 + charmMod) * multi);
            this.saveManager.data.stats.talent += gainT;
            this.saveManager.data.stats.charm += gainC;
            if(this.vfx) { this.vfx.burst(160, 390, 15, '#ff4081'); this.vfx.addFloatingText(160, 390, `+${gainT} Talent, +${gainC} Charm`, '#ff4081'); }
        }
        if (type === 'explore') {
            if (this.rosters) {
                const lead = this.rosters.getActiveLead();
                if (this.saveManager.data.affection[lead.id] === undefined) this.saveManager.data.affection[lead.id] = 0;
                this.saveManager.data.affection[lead.id] += 1;
            } else {
                this.saveManager.data.affection.lead1 += 1;
            }
            this.saveManager.data.inventory.push("Clue");
            this.saveManager.data.stats.charm += 3;
            if (this.gadgetRig) this.gadgetRig.addCluePower(25);
            if(this.vfx) { this.vfx.burst(160, 470, 20, '#ffb6c1'); this.vfx.addFloatingText(160, 470, '+3 Charm, Clue Found!', '#ffb6c1'); }
        }

        if (this.gadgetRig && this.gadgetRig.overdriveActive) {
            let odRefund = 10;
            if (this.saveManager.data.perks && this.saveManager.data.perks.includes('p3')) odRefund = 20;
            this.saveManager.data.stats.stamina += odRefund; // Overdrive refund
            this.saveManager.data.stats.charm += Math.floor(5 * (this.progression ? this.progression.synergyMultiplier : 1));
            if(this.vfx) { this.vfx.burst(160, 550, 30, '#ff4081'); this.vfx.addFloatingText(160, 550, `+${odRefund} Stamina!`, '#7c4dff'); this.vfx.addShake(3, 0.2); }
        }

        this.sound.playStatUp();
        this.advanceTime();
    }

    advanceTime() {
        this.saveManager.data.timeSlot++;
        if (this.saveManager.data.timeSlot > 2) {
            this.saveManager.data.timeSlot = 0;
            this.saveManager.data.day++;
            this.saveManager.data.stats.stamina = this.saveManager.data.stats.maxStamina;
            this.saveManager.save();

            if (this.bosses && (this.saveManager.data.day === 15 || this.saveManager.data.day === 30)) {
                this.bosses.startShowdown(this.saveManager.data.day);
            }
        }
    }

    isHover(b) {
        return this.input.mouse.x >= b.x && this.input.mouse.x <= b.x + b.w &&
               this.input.mouse.y >= b.y && this.input.mouse.y <= b.y + b.h;
    }

    draw() {
        if (this.world) {
            this.world.draw(this.ctx);
        } else {
            this.ctx.fillStyle = '#fff8f6';
            this.ctx.fillRect(0, 0, 800, 600);
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#ff4081';
            this.ctx.font = 'bold 32px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Tokyo High-School Rooftop', 400, 150);
            this.ctx.fillText('& Sakura Courtyard Dating 087', 400, 200);

            this.ctx.font = '16px sans-serif';
            this.ctx.fillStyle = '#7c4dff';
            this.ctx.fillText('30 Days to the Grand Starlight Festival...', 400, 250);

            this.drawButtons();
        } else if (this.state === 'PLAYING') {
            // Draw stats
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(10, 10, 250, 150);
            this.ctx.strokeStyle = '#ff4081';
            this.ctx.strokeRect(10, 10, 250, 150);

            this.ctx.fillStyle = '#333';
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'left';
            const stats = this.saveManager.data.stats;
            this.ctx.fillText(`Day: ${this.saveManager.data.day}/30`, 20, 30);
            const timeStr = ['Morning', 'Afternoon', 'Evening'][this.saveManager.data.timeSlot];
            this.ctx.fillText(`Time: ${timeStr}`, 120, 30);
            this.ctx.fillText(`Stamina: ${stats.stamina}/${stats.maxStamina}`, 20, 60);
            this.ctx.fillText(`Cash: ¥${stats.cash}`, 150, 60);
            this.ctx.fillText(`Charm: ${stats.charm}`, 20, 90);
            this.ctx.fillText(`Wit: ${stats.wit}`, 150, 90);
            this.ctx.fillText(`Talent: ${stats.talent}`, 20, 120);

            // Main area background handled by world.js, we draw just the text/overlay here
            this.ctx.fillStyle = 'rgba(255, 228, 236, 0.7)';
            this.ctx.fillRect(280, 50, 500, 400);
            this.ctx.fillStyle = '#ff4081';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Courtyard', 530, 250);
            if (this.rosters) this.rosters.draw(this.ctx);

            this.drawButtons();
            if (this.progression) this.progression.draw(this.ctx);
            if (this.gadgetRig) this.gadgetRig.draw(this.ctx);
        } else if (this.state === 'SHOP') {
            if (this.progression) this.progression.drawShop(this.ctx);
            this.drawButtons();
        } else if (this.state === 'SHOWDOWN') {
            if (this.bosses) this.bosses.draw(this.ctx);
            this.drawButtons();
        } else if (this.state === 'GAMEOVER') {
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

    drawButtons() {
        for (let b of this.buttons) {
            this.ctx.fillStyle = this.isHover(b) ? '#7c4dff' : '#ff4081';
            this.ctx.fillRect(b.x, b.y, b.w, b.h);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(b.text, b.x + b.w/2, b.y + b.h/2);
        }
    }
}

window.onload = () => {
    window.game = new Game();
    window.game.start();
};
