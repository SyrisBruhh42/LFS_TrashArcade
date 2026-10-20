const SAVE_KEY = "arcade_game_010_010-ricochet-retrieval_v1";

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterVol: 100,
                sfxVol: 100,
                musicVol: 100,
                shake: 1
            }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                this.data.options = { ...this.data.options, ...(parsed.options || {}) };
            }
        } catch (e) {
            console.warn("localStorage load failed", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("localStorage save failed", e);
        }
    }
    reset() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (e) {}
        this.data = {
            highScore: 0, bestWaveOrCombo: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { masterVol: 100, sfxVol: 100, musicVol: 100, shake: 1 }
        };
        this.save();
    }
    export() {
        return btoa(JSON.stringify(this.data));
    }
    importData(base64str) {
        try {
            const parsed = JSON.parse(atob(base64str));
            if (parsed && typeof parsed === 'object') {
                this.data = { ...this.data, ...parsed };
                this.save();
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
}

class SoundEngine {
    constructor(saveManager) {
        this.saveManager = saveManager;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.connect(this.masterGain);
        }
        this.updateVolumes();
        this.initialized = false;
    }
    init() {
        if (!this.initialized && this.ctx) {
            this.ctx.resume();
            this.initialized = true;
        }
    }
    updateVolumes() {
        if (!this.ctx) return;
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.masterVol / 100;
        this.sfxGain.gain.value = opts.sfxVol / 100;
        this.musicGain.gain.value = opts.musicVol / 100;
    }
    playTone(freq, type, duration) {
        if (!this.ctx || !this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playShoot() { this.playTone(400, 'square', 0.1); }
    playBounce() { this.playTone(600, 'sine', 0.05); }
    playHit() { this.playTone(150, 'sawtooth', 0.2); }
    playRetrieve() { this.playTone(800, 'sine', 0.1); }
}

class InputManager {
    constructor(soundEngine) {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, justDown: false };
        this.touches = [];
        this.soundEngine = soundEngine;
        this.touchActive = false;

        window.addEventListener('keydown', e => { this.keys[e.code] = true; this.soundEngine.init(); });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });

        window.addEventListener('pointerdown', e => {
            this.soundEngine.init();
            if (e.pointerType === 'touch') this.touchActive = true;
            this.updateMouse(e);
            this.mouse.down = true;
            this.mouse.justDown = true;
        });
        window.addEventListener('pointermove', e => { this.updateMouse(e); });
        window.addEventListener('pointerup', e => { this.mouse.down = false; });

        window.addEventListener('touchstart', e => {
            this.soundEngine.init();
            this.touchActive = true;
            this.updateTouches(e);
        }, {passive: false});
        window.addEventListener('touchmove', e => { this.updateTouches(e); }, {passive: false});
        window.addEventListener('touchend', e => { this.updateTouches(e); }, {passive: false});

        this.scaleX = 1;
        this.scaleY = 1;
        this.offsetX = 0;
        this.offsetY = 0;
    }
    updateMouse(e) {
        this.mouse.x = (e.clientX - this.offsetX) / this.scaleX;
        this.mouse.y = (e.clientY - this.offsetY) / this.scaleY;
    }
    updateTouches(e) {
        this.touches = Array.from(e.touches).map(t => ({
            x: (t.clientX - this.offsetX) / this.scaleX,
            y: (t.clientY - this.offsetY) / this.scaleY,
            id: t.identifier
        }));
    }
    update() {
        this.mouse.justDown = false;
    }
    setScale(sx, sy, ox, oy) {
        this.scaleX = sx;
        this.scaleY = sy;
        this.offsetX = ox;
        this.offsetY = oy;
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.soundEngine = new SoundEngine(this.saveManager);
        this.inputManager = new InputManager(this.soundEngine);

        this.logicalWidth = 1280;
        this.logicalHeight = 720;

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;

        this.setupResizeObserver();
        this.setupUI();

        this.resetGame();
    }

    setupResizeObserver() {
        const resize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            this.canvas.width = w;
            this.canvas.height = h;

            const scale = Math.min(w / this.logicalWidth, h / this.logicalHeight);
            const ox = (w - this.logicalWidth * scale) / 2;
            const oy = (h - this.logicalHeight * scale) / 2;

            this.inputManager.setScale(scale, scale, ox, oy);

            // Show virtual controls if touch is active or screen is small
            if (this.inputManager.touchActive || w < 800) {
                document.getElementById('virtual-controls').classList.remove('hidden');
            }
        };
        const ro = new ResizeObserver(resize);
        ro.observe(document.body);
        resize();
    }

    setupUI() {
        const get = id => document.getElementById(id);
        const setScreen = id => {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            get(id).classList.add('active');
        };

        // Title
        get('btn-play').onclick = () => { this.resetGame(); this.state = 'PLAYING'; setScreen('state-playing'); };
        get('btn-how-to-play').onclick = () => get('modal-how-to-play').classList.remove('hidden');
        get('btn-options-title').onclick = () => this.openOptions();

        // Playing
        get('btn-pause').onclick = () => { this.state = 'PAUSED'; setScreen('state-paused'); };
        window.addEventListener('blur', () => { if (this.state === 'PLAYING') get('btn-pause').click(); });
        document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'PLAYING') get('btn-pause').click(); });

        // Paused
        get('btn-resume').onclick = () => { this.state = 'PLAYING'; setScreen('state-playing'); };
        get('btn-restart-paused').onclick = () => { this.resetGame(); this.state = 'PLAYING'; setScreen('state-playing'); };
        get('btn-options-paused').onclick = () => this.openOptions();
        get('btn-how-to-play-paused').onclick = () => get('modal-how-to-play').classList.remove('hidden');

        // Game Over
        get('btn-play-again').onclick = () => { this.resetGame(); this.state = 'PLAYING'; setScreen('state-playing'); };
        get('btn-title-from-game-over').onclick = () => { this.state = 'TITLE'; setScreen('state-title'); };

        // Modals
        get('btn-close-how-to-play').onclick = () => get('modal-how-to-play').classList.add('hidden');
        get('btn-close-options').onclick = () => {
            get('modal-options').classList.add('hidden');
            this.soundEngine.updateVolumes();
        };

        // Options Data Binding
        const bindOpt = (id, key) => {
            get(id).value = this.saveManager.data.options[key];
            get(id).onchange = (e) => {
                this.saveManager.data.options[key] = parseFloat(e.target.value);
                this.saveManager.save();
                this.soundEngine.updateVolumes();
            };
        };
        bindOpt('opt-master-vol', 'masterVol');
        bindOpt('opt-sfx-vol', 'sfxVol');
        bindOpt('opt-music-vol', 'musicVol');
        bindOpt('opt-shake', 'shake');

        get('btn-export-save').onclick = () => {
            prompt("Copy this save data:", this.saveManager.export());
        };
        get('btn-import-save').onclick = () => {
            const data = prompt("Paste save data here:");
            if (data && this.saveManager.importData(data)) {
                alert("Import successful!");
                location.reload();
            }
        };
        get('btn-reset-save').onclick = () => {
            if (confirm("Click again to confirm reset")) {
                this.saveManager.reset();
                location.reload();
            }
        };

        get('title-stats').innerText = `High Score: ${this.saveManager.data.highScore}`;
    }

    openOptions() {
        document.getElementById('modal-options').classList.remove('hidden');
    }

    resetGame() {
        this.score = 0;
        this.wave = 1;
        this.ammo = 3;
        this.health = 3;

        this.player = {
            x: this.logicalWidth / 2,
            y: this.logicalHeight / 2,
            r: 20,
            vx: 0,
            vy: 0
        };

        this.bumpers = [
            { x: 300, y: 200, r: 40 },
            { x: 980, y: 200, r: 40 },
            { x: 300, y: 520, r: 40 },
            { x: 980, y: 520, r: 40 },
            { x: 640, y: 360, r: 60 }
        ];

        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('hud-score').innerText = this.score;
        document.getElementById('hud-wave').innerText = this.wave;
        document.getElementById('hud-ammo').innerText = this.ammo;
        document.getElementById('hud-health').innerText = this.health;
    }

    gameOver() {
        this.state = 'GAME_OVER';
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('state-game-over').classList.add('active');

        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.data.totalScoreAccumulated += this.score;

        document.getElementById('final-score').innerText = this.score;
        document.getElementById('final-wave').innerText = this.wave;

        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
            document.getElementById('new-high-score-banner').classList.remove('hidden');
        } else {
            document.getElementById('new-high-score-banner').classList.add('hidden');
        }
        if (this.wave > this.saveManager.data.bestWaveOrCombo) {
            this.saveManager.data.bestWaveOrCombo = this.wave;
        }
        this.saveManager.save();
    }

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame(t => this.loop(t));
    }

    loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.state === 'PLAYING') {
            this.update(dt);
        }
        this.draw();

        this.inputManager.update();
        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        // Player Movement
        let dx = 0;
        let dy = 0;
        const speed = 300;

        if (this.inputManager.keys['KeyW'] || this.inputManager.keys['ArrowUp']) dy -= 1;
        if (this.inputManager.keys['KeyS'] || this.inputManager.keys['ArrowDown']) dy += 1;
        if (this.inputManager.keys['KeyA'] || this.inputManager.keys['ArrowLeft']) dx -= 1;
        if (this.inputManager.keys['KeyD'] || this.inputManager.keys['ArrowRight']) dx += 1;

        // Touch joystick handling
        if (this.inputManager.touchActive && this.inputManager.touches.length > 0) {
            // Find touch on the left side of the screen
            const leftTouch = this.inputManager.touches.find(t => t.x < this.logicalWidth / 2);
            if (leftTouch) {
                // Approximate virtual joystick origin in logical coords
                const jx = 80;
                const jy = this.logicalHeight - 80;
                const tx = leftTouch.x - jx;
                const ty = leftTouch.y - jy;
                const dist = Math.hypot(tx, ty);
                if (dist > 10) {
                    dx = tx / dist;
                    dy = ty / dist;
                }
            }
        }

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            this.player.vx = (dx / len) * speed;
            this.player.vy = (dy / len) * speed;
        } else {
            this.player.vx *= 0.8; // friction
            this.player.vy *= 0.8;
        }

        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;

        // Keep player in bounds
        if (this.player.x < this.player.r) this.player.x = this.player.r;
        if (this.player.x > this.logicalWidth - this.player.r) this.player.x = this.logicalWidth - this.player.r;
        if (this.player.y < this.player.r) this.player.y = this.player.r;
        if (this.player.y > this.logicalHeight - this.player.r) this.player.y = this.logicalHeight - this.player.r;

        // Player Collision with Bumpers
        for (const bumper of this.bumpers) {
            const bx = this.player.x - bumper.x;
            const by = this.player.y - bumper.y;
            const dist = Math.hypot(bx, by);
            const minDist = this.player.r + bumper.r;
            if (dist < minDist) {
                // Resolve overlap
                const overlap = minDist - dist;
                if (dist > 0) {
                    this.player.x += (bx / dist) * overlap;
                    this.player.y += (by / dist) * overlap;
                }
            }
        }
    }

    draw() {
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        this.ctx.fillStyle = '#0a0e17';
        this.ctx.fillRect(0, 0, cw, ch);

        this.ctx.save();
        const scale = Math.min(cw / this.logicalWidth, ch / this.logicalHeight);
        const ox = (cw - this.logicalWidth * scale) / 2;
        const oy = (ch - this.logicalHeight * scale) / 2;
        this.ctx.translate(ox, oy);
        this.ctx.scale(scale, scale);

        // Draw playable area bounds
        this.ctx.strokeStyle = '#6fa1a2';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(0, 0, this.logicalWidth, this.logicalHeight);

        // To be implemented in step 5

        this.ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.start();
});
