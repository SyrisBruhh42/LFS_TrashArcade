// --- CONFIG & CONSTANTS ---
const GAME_ID = "037";
const GAME_SLUG = "037-candy-conveyor-slash";
const SAVE_KEY = `arcade_game_037_037-candy-conveyor-slash_v1`; // Hardcoded per rules

const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const MAX_AMMO = 5;

// Colors matching game.json and UI
const COLORS = {
    bg: "#1a1a1a",
    accent: "#b6c9ba",
    danger: "#e74c3c",
    energy: "#f1c40f",
    belt: "#333333",
    beltLine: "#555555",
    player: "#4a90e2",
    enemy: "#e74c3c",
    parry: "#ffffff"
};

// --- SAVE MANAGER ---
class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            maxCombo: 0,
            totalPlays: 0,
            options: {
                volMaster: 100,
                volMusic: 80,
                volSfx: 100,
                shake: 1,
                particles: "high",
                touch: "auto"
            }
        };
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
            }
        } catch (e) {
            console.warn("SaveManager: Failed to load from localStorage, using in-memory defaults.", e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("SaveManager: Failed to save to localStorage.", e);
        }
    }

    reset() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch(e) {}
        this.data = {
            highScore: 0, maxCombo: 0, totalPlays: 0,
            options: { volMaster: 100, volMusic: 80, volSfx: 100, shake: 1, particles: "high", touch: "auto" }
        };
        this.save();
    }

    export() { return btoa(JSON.stringify(this.data)); }

    importSave(b64str) {
        try {
            const parsed = JSON.parse(atob(b64str));
            if (parsed && typeof parsed === 'object') {
                this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
                this.save();
                return true;
            }
        } catch (e) { console.error("Import failed", e); }
        return false;
    }
}

// --- AUDIO ENGINE ---
class SoundEngine {
    constructor(saveManager) {
        this.saveManager = saveManager;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.bgmOsc = null;
        this.bgmInterval = null;
        this.isPlayingBgm = false;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.updateVolumes();
            this.initialized = true;
        } catch (e) {
            console.warn("AudioContext not supported", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    updateVolumes() {
        if (!this.initialized) return;
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.volMaster / 100;
        this.sfxGain.gain.value = opts.volSfx / 100;
        this.musicGain.gain.value = opts.volMusic / 100;
    }

    playTone(freq, type, duration, vol, slideTo = null) {
        if (!this.initialized) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol) {
        if (!this.initialized) return;
        this.resume();

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
    }

    // Specific SFX
    sfxSlash() { this.playNoise(0.15, 0.5); this.playTone(800, 'sine', 0.1, 0.3, 400); }
    sfxParry() { this.playTone(1200, 'square', 0.1, 0.4, 2000); }
    sfxHit() { this.playNoise(0.3, 0.8); this.playTone(150, 'sawtooth', 0.2, 0.5, 50); }
    sfxPickup() { this.playTone(400, 'sine', 0.1, 0.3, 800); setTimeout(() => this.playTone(800, 'sine', 0.15, 0.3, 1200), 50); }
    sfxUI() { this.playTone(600, 'sine', 0.05, 0.2); }

    startBgm() {
        if (!this.initialized || this.isPlayingBgm) return;
        this.isPlayingBgm = true;
        this.resume();

        const notes = [220, 261.63, 329.63, 392.00]; // A minor arp
        let step = 0;

        const playArp = () => {
            if (!this.isPlayingBgm) return;
            const freq = notes[step % notes.length];
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.value = freq / 2; // bassy

            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);

            step++;
            this.bgmInterval = setTimeout(playArp, 250); // 120 BPM 8th notes
        };

        playArp();
    }

    stopBgm() {
        this.isPlayingBgm = false;
        if (this.bgmInterval) clearTimeout(this.bgmInterval);
    }
}

// --- INPUT MANAGER ---
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.justPressed = {};
        this.pointer = { x: LOGICAL_WIDTH/2, y: LOGICAL_HEIGHT/2, isDown: false, justDown: false };
        this.touchActive = false;

        // Key mapping
        this.map = {
            'w': 'up', 'ArrowUp': 'up',
            's': 'down', 'ArrowDown': 'down',
            'a': 'left', 'ArrowLeft': 'left',
            'd': 'right', 'ArrowRight': 'right',
            ' ': 'action', 'Enter': 'start', 'Escape': 'pause'
        };

        this.initListeners();
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            const action = this.map[e.key] || this.map[e.key.toLowerCase()];
            if (action) {
                if (!this.keys[action]) this.justPressed[action] = true;
                this.keys[action] = true;
                if (['up', 'down', 'left', 'right', 'action', 'start'].includes(action)) e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            const action = this.map[e.key] || this.map[e.key.toLowerCase()];
            if (action) this.keys[action] = false;
        });

        const updatePointer = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = LOGICAL_WIDTH / rect.width;
            const scaleY = LOGICAL_HEIGHT / rect.height;
            let clientX, clientY;

            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
                this.touchActive = true;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            this.pointer.x = (clientX - rect.left) * scaleX;
            this.pointer.y = (clientY - rect.top) * scaleY;
        };

        this.canvas.addEventListener('pointermove', updatePointer);

        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse') this.touchActive = false;
            if (e.pointerType === 'touch') this.touchActive = true;

            updatePointer(e);
            if (!this.pointer.isDown) this.pointer.justDown = true;
            this.pointer.isDown = true;
        });

        this.canvas.addEventListener('pointerup', () => { this.pointer.isDown = false; });
        this.canvas.addEventListener('pointerleave', () => { this.pointer.isDown = false; });

        // Touch UI controls
        const attachTouch = (id, action) => {
            const el = document.getElementById(id);
            if (!el) return;
            const down = (e) => { e.preventDefault(); e.stopPropagation(); if (!this.keys[action]) this.justPressed[action] = true; this.keys[action] = true; this.touchActive = true; };
            const up = (e) => { e.preventDefault(); e.stopPropagation(); this.keys[action] = false; };
            el.addEventListener('touchstart', down, {passive: false});
            el.addEventListener('pointerdown', down);
            el.addEventListener('touchend', up, {passive: false});
            el.addEventListener('pointerup', up);
            el.addEventListener('pointerleave', up);
        };

        attachTouch('touch-action', 'action');

        document.querySelectorAll('.dpad-btn').forEach(btn => {
            const dir = btn.dataset.dir;
            const down = (e) => { e.preventDefault(); e.stopPropagation(); if (!this.keys[dir]) this.justPressed[dir] = true; this.keys[dir] = true; this.touchActive = true; };
            const up = (e) => { e.preventDefault(); e.stopPropagation(); this.keys[dir] = false; };
            btn.addEventListener('touchstart', down, {passive: false});
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('touchend', up, {passive: false});
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointerleave', up);
        });
    }

    update() {
        this.justPressed = {};
        this.pointer.justDown = false;
    }

    isPressed(action) { return !!this.keys[action]; }
    isJustPressed(action) { return !!this.justPressed[action]; }
}

// --- GAME ENGINE SKELETON ---
class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.canvas.width = LOGICAL_WIDTH;
        this.canvas.height = LOGICAL_HEIGHT;

        this.saveManager = new SaveManager();
        this.sound = new SoundEngine(this.saveManager);
        this.input = new InputManager(this.canvas);

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;
        this.rafId = null;

        // Viewport resize handling
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(document.getElementById('game-container'));

        // Visibility API for auto-pause
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.setPause(true);
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.setPause(true);
        });

        this.initUI();
    }

    resize() {
        // Handled via CSS object-fit: contain
        this.updateTouchUI();
    }

    updateTouchUI() {
        const touchOpt = this.saveManager.data.options.touch;
        const controls = document.getElementById('touch-controls');
        const show = touchOpt === 'always' || (touchOpt === 'auto' && this.input.touchActive) || window.innerWidth <= 768;

        if (show && this.state === 'PLAYING') {
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
        }
    }

    initUI() {
        const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', (e) => { this.sound.init(); this.sound.resume(); this.sound.sfxUI(); fn(e); }); };

        bind('btn-play', () => this.startGame());
        bind('btn-howto', () => { document.getElementById('ui-howto').classList.remove('hidden'); });
        bind('btn-close-howto', () => { document.getElementById('ui-howto').classList.add('hidden'); });
        bind('btn-options-title', () => { this.openOptions(); });

        bind('btn-pause-game', () => this.setPause(true));
        bind('btn-resume', () => this.setPause(false));
        bind('btn-restart-pause', () => { this.setPause(false); this.startGame(); });
        bind('btn-options-pause', () => this.openOptions());
        bind('btn-quit', () => { this.setPause(false); this.setState('TITLE'); });

        bind('btn-play-again', () => this.startGame());
        bind('btn-title-go', () => this.setState('TITLE'));

        bind('btn-close-options', () => { document.getElementById('ui-options').classList.add('hidden'); this.saveManager.save(); this.sound.updateVolumes(); this.updateTouchUI(); });

        // Options logic
        const syncOpt = (id, key, parser = parseFloat) => {
            const el = document.getElementById(id);
            if(el) {
                el.value = this.saveManager.data.options[key];
                el.addEventListener('input', (e) => {
                    this.saveManager.data.options[key] = parser ? parser(e.target.value) : e.target.value;
                    if(id.startsWith('opt-vol')) { this.sound.init(); this.sound.updateVolumes(); if(id==='opt-vol-sfx') this.sound.sfxHit(); }
                });
            }
        };

        syncOpt('opt-vol-master', 'volMaster');
        syncOpt('opt-vol-music', 'volMusic');
        syncOpt('opt-vol-sfx', 'volSfx');
        syncOpt('opt-shake', 'shake');
        syncOpt('opt-particles', 'particles', v=>v);
        syncOpt('opt-touch', 'touch', v=>v);

        bind('btn-export-save', () => {
            const txt = document.getElementById('save-data-text');
            txt.classList.remove('hidden');
            txt.value = this.saveManager.export();
            txt.select();
        });

        bind('btn-import-save', () => {
            const txt = document.getElementById('save-data-text');
            const btn = document.getElementById('btn-confirm-import');
            txt.classList.remove('hidden');
            btn.classList.remove('hidden');
            txt.value = '';
            txt.placeholder = "Paste data here and click Confirm...";
        });

        bind('btn-confirm-import', () => {
            const val = document.getElementById('save-data-text').value;
            if(this.saveManager.importSave(val)) {
                alert("Save imported!");
                document.getElementById('ui-options').classList.add('hidden');
                this.updateTitleStats();
            } else {
                alert("Invalid save data.");
            }
        });

        let resetClicks = 0;
        bind('btn-reset-save', (e) => {
            resetClicks++;
            if (resetClicks === 1) {
                e.target.innerText = "Click Again to Confirm Reset";
                setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset Data"; }, 3000);
            } else {
                this.saveManager.reset();
                syncOpt('opt-vol-master', 'volMaster'); syncOpt('opt-vol-music', 'volMusic'); syncOpt('opt-vol-sfx', 'volSfx');
                syncOpt('opt-shake', 'shake'); syncOpt('opt-particles', 'particles', v=>v); syncOpt('opt-touch', 'touch', v=>v);
                this.updateTitleStats();
                e.target.innerText = "Data Reset!";
                setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset Data"; }, 2000);
            }
        });

        this.updateTitleStats();
    }

    updateTitleStats() {
        document.getElementById('stat-highscore').innerText = this.saveManager.data.highScore;
        document.getElementById('stat-maxcombo').innerText = this.saveManager.data.maxCombo;
        document.getElementById('stat-plays').innerText = this.saveManager.data.totalPlays;
    }

    openOptions() {
        document.getElementById('ui-options').classList.remove('hidden');
        document.getElementById('save-data-text').classList.add('hidden');
        document.getElementById('btn-confirm-import').classList.add('hidden');
    }

    setState(newState) {
        this.state = newState;
        ['ui-title', 'ui-hud', 'btn-pause-game', 'ui-paused', 'ui-gameover', 'touch-controls'].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.classList.add('hidden');
        });

        if (newState === 'TITLE') {
            document.getElementById('ui-title').classList.remove('hidden');
            this.sound.stopBgm();
            this.updateTitleStats();
        } else if (newState === 'PLAYING') {
            document.getElementById('ui-hud').classList.remove('hidden');
            document.getElementById('btn-pause-game').classList.remove('hidden');
            this.updateTouchUI();
            this.sound.startBgm();
        } else if (newState === 'PAUSED') {
            document.getElementById('ui-paused').classList.remove('hidden');
            this.sound.stopBgm();
        } else if (newState === 'GAME_OVER') {
            document.getElementById('ui-gameover').classList.remove('hidden');
            this.sound.stopBgm();
        }
    }

    setPause(pause) {
        if (this.state === 'PLAYING' && pause) {
            this.setState('PAUSED');
        } else if (this.state === 'PAUSED' && !pause) {
            this.setState('PLAYING');
            this.lastTime = performance.now();
        }
    }

    startGame() {
        this.sound.init();
        this.sound.resume();

        this.saveManager.data.totalPlays++;
        this.saveManager.save();

        // Reset game state variables here

        this.setState('PLAYING');
    }

    loop(now) {
        if (!this.lastTime) this.lastTime = now;
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.state === 'PLAYING') {
            // Check global inputs
            if (this.input.isJustPressed('pause')) this.setPause(true);

            // Update logic (to be added)
        } else if (this.state === 'TITLE') {
            // Background animation (to be added)
        }

        // Draw (to be added)
        this.ctx.fillStyle = COLORS.bg;
        this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        this.input.update();
        this.rafId = requestAnimationFrame((n) => this.loop(n));
    }

    start() {
        this.rafId = requestAnimationFrame((n) => this.loop(n));
    }
}

// --- ENTITIES & MECHANICS ---

class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.color = color; this.size = size;
    }
    update(dt, speedFactor) {
        this.x += this.vx * dt * speedFactor;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class AmmoDrop {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.radius = 15;
        this.active = true;
        this.pulse = 0;
    }
    update(dt, scrollSpeed) {
        this.x -= scrollSpeed * dt;
        if (this.x < -50) this.active = false;
        this.pulse += dt * 5;
    }
    draw(ctx) {
        const r = this.radius + Math.sin(this.pulse) * 3;
        ctx.fillStyle = COLORS.energy;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - r);
        ctx.lineTo(this.x + r, this.y);
        ctx.lineTo(this.x, this.y + r);
        ctx.lineTo(this.x - r, this.y);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Enemy {
    constructor(wave) {
        this.x = LOGICAL_WIDTH + 50;
        this.y = LOGICAL_HEIGHT/2 + (Math.random() * 400 - 200);
        this.radius = 30;
        this.hp = 1 + Math.floor(wave / 3);
        this.speed = 100 + (Math.random() * 50 * wave);
        this.active = true;
        this.attackTimer = Math.random() * 2 + 1;
        this.isAttacking = false;
        this.attackFlash = 0;
        this.type = Math.random() > 0.5 ? 'gummy' : 'jawbreaker';
    }
    update(dt, player, scrollSpeed) {
        this.x -= (this.speed + scrollSpeed) * dt;
        if (this.x < -100) this.active = false; // Missed

        // Move towards player Y slightly
        if (this.x > player.x) {
            this.y += Math.sign(player.y - this.y) * 50 * dt;
        }

        // Attack logic
        if (Math.abs(this.x - player.x) < 200 && !this.isAttacking) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) {
                this.isAttacking = true;
                this.attackFlash = 0.5; // Telegraf attack
            }
        }

        if (this.attackFlash > 0) this.attackFlash -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'gummy') {
            ctx.fillStyle = this.attackFlash > 0 ? '#fff' : '#e67e22';
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius, this.radius * 1.5, 0, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillStyle = this.attackFlash > 0 ? '#fff' : '#9b59b6';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI*2);
            ctx.fill();
            // Swirl
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0,0, 15, 0, Math.PI); ctx.stroke();
        }

        if (this.isAttacking) {
            ctx.strokeStyle = COLORS.danger;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-this.radius, 0);
            ctx.lineTo(-this.radius - 40, 0);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Player {
    constructor() {
        this.x = 200;
        this.y = LOGICAL_HEIGHT / 2;
        this.radius = 25;
        this.speed = 400;
        this.ammo = MAX_AMMO;
        this.hp = 3;

        this.slashTimer = 0;
        this.slashDuration = 0.2;
        this.slashAngle = 0;

        this.parryWindow = 0;
        this.invuln = 0;
    }

    update(dt, input, engine) {
        // Movement
        let dx = 0, dy = 0;
        if (input.isPressed('left')) dx -= 1;
        if (input.isPressed('right')) dx += 1;
        if (input.isPressed('up')) dy -= 1;
        if (input.isPressed('down')) dy += 1;

        if (input.touchActive && input.pointer.isDown && input.pointer.x > 0) {
             // Direct touch follow if not using D-Pad
             if (!input.isPressed('up') && !input.isPressed('down') && !input.isPressed('left') && !input.isPressed('right')) {
                 const tx = input.pointer.x - this.x;
                 const ty = input.pointer.y - this.y;
                 const dist = Math.hypot(tx, ty);
                 if (dist > 10) {
                     dx = tx / dist;
                     dy = ty / dist;
                 }
             }
        }

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            this.x += (dx / len) * this.speed * dt;
            this.y += (dy / len) * this.speed * dt;
        }

        // Bounds
        this.x = Math.max(this.radius, Math.min(LOGICAL_WIDTH - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(LOGICAL_HEIGHT - this.radius, this.y));

        // Action (Slash)
        if ((input.isJustPressed('action') || (input.touchActive && input.pointer.justDown)) && this.slashTimer <= 0) {
            if (this.ammo > 0) {
                this.ammo--;
                this.slashTimer = this.slashDuration;
                this.parryWindow = 0.1; // 100ms parry window

                // Determine direction
                if (input.pointer.isDown || input.touchActive) {
                    this.slashAngle = Math.atan2(input.pointer.y - this.y, input.pointer.x - this.x);
                } else {
                    this.slashAngle = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx);
                }

                engine.sound.sfxSlash();
                engine.spawnAmmoDrop(this.x + Math.cos(this.slashAngle) * 60, this.y + Math.sin(this.slashAngle) * 60);
                engine.updateHUD();
            } else {
                engine.sound.sfxHit(); // Error buzz
            }
        }

        if (this.slashTimer > 0) this.slashTimer -= dt;
        if (this.parryWindow > 0) this.parryWindow -= dt;
        if (this.invuln > 0) this.invuln -= dt;
    }

    draw(ctx) {
        if (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0) return; // Blink

        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.fillStyle = this.parryWindow > 0 ? COLORS.parry : COLORS.player;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Slash Arc
        if (this.slashTimer > 0) {
            ctx.rotate(this.slashAngle);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 80, -Math.PI/4, Math.PI/4);
            ctx.fill();
        }

        ctx.restore();
    }
}

// Inject logic into GameEngine
GameEngine.prototype.startGame = function() {
    this.sound.init();
    this.sound.resume();

    this.saveManager.data.totalPlays++;
    this.saveManager.save();

    this.player = new Player();
    this.enemies = [];
    this.drops = [];
    this.particles = [];

    this.score = 0;
    this.wave = 1;
    this.combo = 0;
    this.comboTimer = 0;

    this.scrollSpeed = 200;
    this.enemyTimer = 2;
    this.shakeTime = 0;
    this.bgOffset = 0;

    this.updateHUD();
    this.setState('PLAYING');
};

GameEngine.prototype.spawnAmmoDrop = function(x, y) {
    this.drops.push(new AmmoDrop(x, y));
};

GameEngine.prototype.spawnParticles = function(x, y, color, count) {
    if (this.saveManager.data.options.particles === 'low') count = Math.floor(count/3);
    if (count <= 0) return;
    for(let i=0; i<count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 200 + 50;
        this.particles.push(new Particle(x, y, Math.cos(a)*s, Math.sin(a)*s, Math.random()*0.5+0.2, color, Math.random()*4+2));
    }
};

GameEngine.prototype.addScore = function(pts) {
    this.score += pts * Math.max(1, this.combo);
    this.combo++;
    this.comboTimer = 3; // 3 seconds to keep combo
    if (this.combo > this.saveManager.data.maxCombo) this.saveManager.data.maxCombo = this.combo;
    this.updateHUD();
};

GameEngine.prototype.takeDamage = function() {
    if (this.player.invuln > 0) return;
    this.player.hp--;
    this.combo = 0;
    this.player.invuln = 1.5;
    this.shakeTime = 0.5;
    this.sound.sfxHit();
    this.spawnParticles(this.player.x, this.player.y, COLORS.danger, 30);
    this.updateHUD();

    if (this.player.hp <= 0) {
        this.gameOver();
    }
};

GameEngine.prototype.updateHUD = function() {
    document.getElementById('hud-score').innerText = this.score;
    document.getElementById('hud-wave').innerText = this.wave;
    document.getElementById('hud-combo').innerText = this.combo;
    document.getElementById('hud-hp').innerText = this.player.hp;

    const ammoContainer = document.getElementById('hud-ammo');
    ammoContainer.innerHTML = '';
    for(let i=0; i<MAX_AMMO; i++) {
        const slot = document.createElement('div');
        slot.className = 'ammo-slot' + (i < this.player.ammo ? ' ammo-filled' : '');
        ammoContainer.appendChild(slot);
    }
};

GameEngine.prototype.gameOver = function() {
    this.sound.sfxHit();
    this.setState('GAME_OVER');
    document.getElementById('go-score').innerText = `Score: ${this.score}`;
    document.getElementById('go-wave').innerText = this.wave;
    document.getElementById('go-combo').innerText = this.saveManager.data.maxCombo;

    const hsBanner = document.getElementById('go-highscore-banner');
    if (this.score > this.saveManager.data.highScore) {
        this.saveManager.data.highScore = this.score;
        hsBanner.classList.remove('hidden');
    } else {
        hsBanner.classList.add('hidden');
    }
    this.saveManager.save();
};

GameEngine.prototype.loop = function(now) {
    if (!this.lastTime) this.lastTime = now;
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
        if (this.input.isJustPressed('pause')) this.setPause(true);

        // Progression
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) { this.combo = 0; this.updateHUD(); }
        }

        this.bgOffset = (this.bgOffset + this.scrollSpeed * dt) % 100;

        // Spawning
        this.enemyTimer -= dt;
        if (this.enemyTimer <= 0) {
            this.enemies.push(new Enemy(this.wave));
            this.enemyTimer = Math.max(0.5, 2 - (this.wave * 0.1));
            // Wave progression
            if (Math.random() < 0.1) { this.wave++; this.updateHUD(); }
        }

        this.player.update(dt, this.input, this);

        // Update Drops (Ammo)
        for (let i = this.drops.length - 1; i >= 0; i--) {
            let d = this.drops[i];
            d.update(dt, this.scrollSpeed);

            // Pickup collision
            if (d.active && Math.hypot(d.x - this.player.x, d.y - this.player.y) < this.player.radius + d.radius) {
                if (this.player.ammo < MAX_AMMO) {
                    this.player.ammo++;
                    d.active = false;
                    this.sound.sfxPickup();
                    this.updateHUD();
                }
            }
            if (!d.active) this.drops.splice(i, 1);
        }

        // Update Enemies & Combat
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt, this.player, this.scrollSpeed);

            // Check Hit on Player
            let distToPlayer = Math.hypot(e.x - this.player.x, e.y - this.player.y);

            // Parry mechanic: If enemy is attacking and player slashes with correct timing/angle
            if (this.player.parryWindow > 0 && distToPlayer < e.radius + this.player.radius + 60) {
                // Check angle
                let angleToEnemy = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                let angleDiff = Math.abs(angleToEnemy - this.player.slashAngle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                if (angleDiff < Math.PI/3) { // 60 degree cone
                    this.sound.sfxParry();
                    this.spawnParticles(e.x, e.y, COLORS.parry, 20);
                    e.hp -= 2; // Critical damage on parry
                    this.player.parryWindow = 0; // consume parry
                    this.shakeTime = 0.2;
                }
            } else if (this.player.slashTimer > 0 && distToPlayer < e.radius + this.player.radius + 50) {
                 // Normal Slash hit
                 let angleToEnemy = Math.atan2(e.y - this.player.y, e.x - this.player.x);
                 let angleDiff = Math.abs(angleToEnemy - this.player.slashAngle);
                 if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                 if (angleDiff < Math.PI/4) { // 45 degree cone
                     e.hp -= 1;
                     this.spawnParticles(e.x, e.y, COLORS.accent, 10);
                     // knockback
                     e.x += 30;
                     this.player.slashTimer = 0; // single hit per slash
                 }
            }

            // Enemy hits player
            if (distToPlayer < e.radius + this.player.radius) {
                this.takeDamage();
                e.active = false; // consume enemy
            }

            if (e.hp <= 0) {
                e.active = false;
                this.spawnParticles(e.x, e.y, e.type==='gummy'?'#e67e22':'#9b59b6', 20);
                this.addScore(100);
            }

            if (!e.active) this.enemies.splice(i, 1);
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt, 1);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }

        if (this.shakeTime > 0) this.shakeTime -= dt;
    }

    this.draw();
    this.input.update();
    this.rafId = requestAnimationFrame((n) => this.loop(n));
};

GameEngine.prototype.draw = function() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    this.ctx.save();

    // Screen Shake
    if (this.shakeTime > 0 && this.state === 'PLAYING') {
        const amt = 10 * this.shakeTime * parseFloat(this.saveManager.data.options.shake);
        this.ctx.translate(Math.random() * amt - amt/2, Math.random() * amt - amt/2);
    }

    // Conveyor Belt Background
    this.ctx.fillStyle = COLORS.belt;
    this.ctx.fillRect(0, 100, LOGICAL_WIDTH, LOGICAL_HEIGHT - 200);

    this.ctx.strokeStyle = COLORS.beltLine;
    this.ctx.lineWidth = 4;
    for(let x = -this.bgOffset; x < LOGICAL_WIDTH; x += 100) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 100);
        this.ctx.lineTo(x, LOGICAL_HEIGHT - 100);
        this.ctx.stroke();
    }

    if (this.state === 'PLAYING') {
        this.drops.forEach(d => d.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);
        this.particles.forEach(p => p.draw(this.ctx));
    }

    if (this.state === 'TITLE') {
        // Simple title animation
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(0,0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        this.bgOffset = (this.bgOffset + 50 * 0.016) % 100;
    }

    this.ctx.restore();
};

// Start
window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.start();
});
