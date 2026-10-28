/**
 * engine.js
 * Contains core engine systems: SaveManager, SoundEngine, and InputManager.
 */

// --- Constants & Config ---
const SAVE_KEY = "arcade_game_005_005-sky-recoil-rhythm_v1";

const DEFAULT_OPTIONS = {
    masterVolume: 100,
    sfxVolume: 100,
    musicVolume: 100,
    screenShake: 1, // 1, 0.5, 0
    particles: 'high' // 'high', 'low'
};

const DEFAULT_STATS = {
    highScore: 0,
    maxCombo: 0,
    totalGamesPlayed: 0,
    totalScoreAccumulated: 0,
    unlockedMilestones: []
};

// --- SaveManager ---
class SaveManager {
    constructor() {
        this.memoryFallback = {
            options: { ...DEFAULT_OPTIONS },
            stats: { ...DEFAULT_STATS }
        };
        this.load();
    }

    load() {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                this.memoryFallback = {
                    options: { ...DEFAULT_OPTIONS, ...(parsed.options || {}) },
                    stats: { ...DEFAULT_STATS, ...(parsed.stats || {}) }
                };
            }
        } catch (e) {
            console.warn("SaveManager: Failed to load from localStorage. Using memory fallback.", e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.memoryFallback));
        } catch (e) {
            console.warn("SaveManager: Failed to save to localStorage.", e);
        }
    }

    getOption(key) {
        return this.memoryFallback.options[key];
    }

    setOption(key, value) {
        this.memoryFallback.options[key] = value;
        this.save();
    }

    getStat(key) {
        return this.memoryFallback.stats[key];
    }

    setStat(key, value) {
        this.memoryFallback.stats[key] = value;
        this.save();
    }

    updateHighscore(score) {
        if (score > this.getStat('highScore')) {
            this.setStat('highScore', score);
            return true;
        }
        return false;
    }

    updateCombo(combo) {
        if (combo > this.getStat('maxCombo')) {
            this.setStat('maxCombo', combo);
        }
    }

    incrementGamesPlayed() {
        this.setStat('totalGamesPlayed', this.getStat('totalGamesPlayed') + 1);
    }

    addScore(score) {
        this.setStat('totalScoreAccumulated', this.getStat('totalScoreAccumulated') + score);
    }

    unlockMilestone(id) {
        const milestones = this.getStat('unlockedMilestones');
        if (!milestones.includes(id)) {
            milestones.push(id);
            this.setStat('unlockedMilestones', milestones);
            return true; // Just unlocked
        }
        return false;
    }

    exportSave() {
        return btoa(JSON.stringify(this.memoryFallback));
    }

    importSave(base64Data) {
        try {
            const parsed = JSON.parse(atob(base64Data));
            if (parsed && parsed.options && parsed.stats) {
                this.memoryFallback = parsed;
                this.save();
                return true;
            }
        } catch (e) {
            console.error("SaveManager: Failed to import save.", e);
        }
        return false;
    }

    resetSave() {
        this.memoryFallback = {
            options: { ...DEFAULT_OPTIONS },
            stats: { ...DEFAULT_STATS }
        };
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (e) {
             console.warn("SaveManager: Failed to remove from localStorage.", e);
        }
        this.save();
    }
}

const saveManager = new SaveManager();

// --- SoundEngine ---
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Rhythm properties
        this.bpm = 120;
        this.beatInterval = 60 / this.bpm; // in seconds
        this.nextBeatTime = 0;
        this.isPlayingMusic = false;

        // Synths
        this.bassOsc = null;
        this.arpOsc = null;
    }

    init() {
        if (this.initialized) return;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return; // Audio not supported

        this.ctx = new AudioContextClass();

        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.updateVolumes();
        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    updateVolumes() {
        if (!this.initialized) return;
        const master = saveManager.getOption('masterVolume') / 100;
        const sfx = saveManager.getOption('sfxVolume') / 100;
        const music = saveManager.getOption('musicVolume') / 100;

        this.masterGain.gain.setValueAtTime(master, this.ctx.currentTime);
        this.sfxGain.gain.setValueAtTime(sfx, this.ctx.currentTime);
        this.musicGain.gain.setValueAtTime(music, this.ctx.currentTime);
    }

    playTone(freq, type, duration, vol, slideToFreq = null) {
        if (!this.initialized) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.connect(gain);
        gain.connect(this.sfxGain);

        const now = this.ctx.currentTime;
        osc.frequency.setValueAtTime(freq, now);
        if (slideToFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideToFreq, now + duration);
        }

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    }

    playNoise(duration, vol) {
        if (!this.initialized) return;

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

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.start(now);
    }

    // specific sound effects
    playShoot(onBeat) {
        if (onBeat) {
            this.playTone(440, 'square', 0.15, 0.5, 880);
            this.playTone(660, 'sine', 0.15, 0.3);
        } else {
            this.playTone(220, 'square', 0.1, 0.3, 110);
            this.playNoise(0.1, 0.2);
        }
    }

    playExplosion() {
        this.playNoise(0.4, 0.5);
        this.playTone(100, 'sawtooth', 0.4, 0.5, 20);
    }

    playHit() {
        this.playNoise(0.1, 0.3);
    }

    playUI() {
        this.playTone(800, 'sine', 0.05, 0.2, 1200);
    }

    playGameOver() {
        this.playTone(300, 'sawtooth', 1, 0.5, 50);
        this.playTone(200, 'square', 1, 0.5, 30);
    }

    // Rhythm Background Loop
    startMusic() {
        if (!this.initialized || this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.nextBeatTime = this.ctx.currentTime + 0.1;
        this.scheduleMusic();
    }

    stopMusic() {
        this.isPlayingMusic = false;
    }

    scheduleMusic() {
        if (!this.isPlayingMusic) return;

        const now = this.ctx.currentTime;
        // Schedule beats slightly ahead
        while (this.nextBeatTime < now + 0.2) {
            this.playBeat(this.nextBeatTime);
            this.nextBeatTime += this.beatInterval;
        }

        // Loop
        setTimeout(() => this.scheduleMusic(), 50);
    }

    playBeat(time) {
        // Kick
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.connect(kickGain);
        kickGain.connect(this.musicGain);

        kickOsc.frequency.setValueAtTime(150, time);
        kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        kickGain.gain.setValueAtTime(0.5, time);
        kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        kickOsc.start(time);
        kickOsc.stop(time + 0.5);

        // Hat (every half beat)
        setTimeout(() => {
            if(!this.isPlayingMusic) return;
            const hatTime = time + (this.beatInterval / 2);
            if(hatTime < this.ctx.currentTime) return;

            const hatGain = this.ctx.createGain();
            hatGain.connect(this.musicGain);
            hatGain.gain.setValueAtTime(0.1, hatTime);
            hatGain.gain.exponentialRampToValueAtTime(0.01, hatTime + 0.1);

            // Reusing noise for hat would be complex with setTimeout, just use a high pitch short burst
            const hatOsc = this.ctx.createOscillator();
            hatOsc.type = 'square';
            hatOsc.frequency.value = 8000;
            hatOsc.connect(hatGain);
            hatOsc.start(hatTime);
            hatOsc.stop(hatTime + 0.1);

        }, (this.beatInterval/2) * 1000);
    }
}

const soundEngine = new SoundEngine();

// --- InputManager ---
class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = {
            active: false,
            joystick: { x: 0, y: 0, active: false },
            shoot: false
        };
        this.firstInput = false;

        // Listeners
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Touch events
        window.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        window.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
        window.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    }

    checkFirstInput() {
        if (!this.firstInput) {
            this.firstInput = true;
            soundEngine.init();
            soundEngine.resume();
        }
    }

    onKeyDown(e) {
        this.keys[e.code] = true;
        this.checkFirstInput();
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
    }

    onMouseMove(e) {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
    }

    onMouseDown(e) {
        this.mouse.down = true;
        this.checkFirstInput();
    }

    onMouseUp(e) {
        this.mouse.down = false;
    }

    onPointerDown(e) {
        this.checkFirstInput();
    }

    // Touch Handling (Joystick logic)
    onTouchStart(e) {
        this.touch.active = true;
        this.checkFirstInput();
        this.handleTouches(e.touches);
        // Don't prevent default here if touching UI elements
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'A') {
             e.preventDefault();
        }
    }

    onTouchMove(e) {
        this.handleTouches(e.touches);
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'A') {
             e.preventDefault();
        }
    }

    onTouchEnd(e) {
        this.handleTouches(e.touches);
    }

    handleTouches(touches) {
        this.touch.joystick.active = false;
        this.touch.shoot = false;

        const base = document.getElementById('touch-joystick-base');
        const shootBtn = document.getElementById('touch-btn-shoot');
        const knob = document.getElementById('touch-joystick-knob');

        if (!base || !shootBtn || !knob) return;

        const baseRect = base.getBoundingClientRect();
        const shootRect = shootBtn.getBoundingClientRect();

        // Reset knob
        knob.style.transform = `translate(-50%, -50%)`;

        for (let i = 0; i < touches.length; i++) {
            const t = touches[i];

            // Check joystick
            const dx = t.clientX - (baseRect.left + baseRect.width / 2);
            const dy = t.clientY - (baseRect.top + baseRect.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Give a generous touch area around the visual joystick
            if (dist < baseRect.width * 1.5) {
                this.touch.joystick.active = true;

                // Limit knob movement
                const maxDist = baseRect.width / 2;
                let knobX = dx;
                let knobY = dy;

                if (dist > maxDist) {
                    knobX = (dx / dist) * maxDist;
                    knobY = (dy / dist) * maxDist;
                }

                knob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

                // Normalize joystick output (-1 to 1)
                this.touch.joystick.x = knobX / maxDist;
                this.touch.joystick.y = knobY / maxDist;
            }

            // Check shoot button
            if (t.clientX >= shootRect.left && t.clientX <= shootRect.right &&
                t.clientY >= shootRect.top && t.clientY <= shootRect.bottom) {
                this.touch.shoot = true;
            }
        }
    }

    getAimVector() {
        let x = 0;
        let y = 0;

        if (this.touch.active && this.touch.joystick.active) {
            x = this.touch.joystick.x;
            y = this.touch.joystick.y;
        } else {
            // Keyboard WASD/Arrows override
            if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
            if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
            if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
            if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

            // Mouse override if no keys
            if (x === 0 && y === 0 && this.mouse.down) {
                 // Mouse aim is relative to screen center (handled in game logic if needed)
                 // We return 0 here and let the game check mouse pos directly if needed
                 // For now, let's just make it simple: only use keys or touch joystick for *aim direction*
                 // Actually, it's better to have mouse follow cursor from player.
                 // We'll let the game handle mouse-based aiming by checking inputManager.mouse directly.
            }
        }

        // Normalize
        const len = Math.sqrt(x * x + y * y);
        if (len > 0) {
            x /= len;
            y /= len;
        }

        return { x, y };
    }

    isShooting() {
        return this.keys['Space'] || this.keys['Enter'] || this.mouse.down || this.touch.shoot;
    }
}

const inputManager = new InputManager();

// --- Utilities ---
const Utils = {
    rand: (min, max) => Math.random() * (max - min) + min,
    randInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    lerp: (a, b, t) => a + (b - a) * t,
    dist: (x1, y1, x2, y2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2),
    clamp: (val, min, max) => Math.max(min, Math.min(max, val))
};
