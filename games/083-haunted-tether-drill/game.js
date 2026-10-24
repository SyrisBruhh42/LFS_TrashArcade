// Haunted Tether Drill - Phase 1

const SAVE_KEY = 'arcade_game_083_083-haunted-tether-drill_v1';
const ACCENT_COLOR = '#65bb98';

class SaveManager {
    constructor() {
        this.data = SaveManager.defaults();
        this.load();
    }

    static defaults() {
        return {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            highestWave: 0,
            maxTailReached: 0,
            bossesDefeated: 0,
            bestRunScore: 0,
            unlockedMilestones: [],
            options: {
                mute: false,
                sfxVolume: 100,
                musicVolume: 100,
                highContrast: false,
                fpsCounter: false,
                touchControls: 'Auto',
                touchHandedness: 'Right',
                particles: 'High',
                screenShake: 100
            }
        };
    }

    static validate(candidate) {
        const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
        if (!object(candidate)) throw new Error('Save must be an object');
        const data = SaveManager.defaults();
        if (!Object.keys(data).some(key => Object.hasOwn(candidate, key))) {
            throw new Error('Save has no recognized fields');
        }
        for (const key of Object.keys(data)) {
            if (!Object.hasOwn(candidate, key) || key === 'options') continue;
            const value = candidate[key];
            if (key === 'unlockedMilestones') {
                if (!Array.isArray(value) || !value.every(id => typeof id === 'string')) {
                    throw new Error('Invalid milestones');
                }
                data[key] = [...new Set(value)];
            } else {
                if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
                    throw new Error('Invalid statistic: ' + key);
                }
                data[key] = value;
            }
        }
        if (Object.hasOwn(candidate, 'options')) {
            if (!object(candidate.options)) throw new Error('Invalid options');
            const choices = {
                touchControls: ['Auto', 'Always', 'Off'], touchHandedness: ['Right', 'Left'],
                particles: ['High', 'Low'], screenShake: [100, 50, 0]
            };
            for (const key of Object.keys(data.options)) {
                if (!Object.hasOwn(candidate.options, key)) continue;
                const value = candidate.options[key];
                const valid = choices[key] ? choices[key].includes(value)
                    : typeof data.options[key] === 'boolean' ? typeof value === 'boolean'
                    : typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
                if (!valid) throw new Error('Invalid option: ' + key);
                data.options[key] = value;
            }
        }
        return data;
    }

    importData(encoded) {
        let candidate;
        try {
            candidate = SaveManager.validate(JSON.parse(atob(encoded)));
        } catch (e) {
            return { ok: false, message: 'Invalid save data.' };
        }
        try {
            // Explicit replacement must be durable before changing the working save.
            localStorage.setItem(SAVE_KEY, JSON.stringify(candidate));
        } catch (e) {
            return { ok: false, message: 'Save storage is unavailable. Your previous save was kept.' };
        }
        this.data = candidate;
        return { ok: true, message: 'Save imported successfully!' };
    }

    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                this.data = SaveManager.validate(JSON.parse(stored));
            }
        } catch (e) {
            console.error('SaveManager load error:', e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('SaveManager save error:', e);
        }
    }

    updateHighScore(score) {
        if (score > this.data.highScore) {
            this.data.highScore = score;
        if (score > this.data.bestRunScore) this.data.bestRunScore = score;
        }
        this.data.totalScoreAccumulated += score;
        this.data.totalGamesPlayed += 1;
        this.save();
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
        this.muted = false;

        this.musicFilter = null;
        this.musicLfo = null;
        this.tempoMultiplier = 1.0;
        this.nextNoteTime = 0;
        this.currentNote = 0;
        this.currentBeat = 0;
        this.scale = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00]; // A Minor
        this.baseTempo = 120;
    }

    init() {
        if (this.initialized) {
            return;
        }
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.musicFilter = this.ctx.createBiquadFilter();
            this.musicFilter.type = 'lowpass';
            this.musicFilter.frequency.value = 1000;

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.musicFilter);
            this.musicFilter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.masterGain.gain.value = 1.0;
            this.sfxGain.gain.value = 0.5;
            this.musicGain.gain.value = 0.3;

            this.initialized = true;
            this.nextNoteTime = this.ctx.currentTime + 0.1;
            console.log('SoundEngine initialized.');
        } catch (e) {
            console.error('SoundEngine init error:', e);
        }
    }

    resume() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }
    }

    setMute(mute) {
        this.muted = mute;
        if (this.masterGain) {
            if (this.muted) {
                this.masterGain.gain.value = 0;
            } else {
                this.masterGain.gain.value = 1.0;
            }
        }
    }

    update(dt, game) {
        if (!this.initialized) return;
        if (game && game.saveManager) {
            const opts = game.saveManager.data.options;
            this.muted = opts.mute;
            this.masterGain.gain.value = this.muted ? 0 : 1;
            this.sfxGain.gain.value = 0.5 * (opts.sfxVolume / 100);
            this.musicGain.gain.value = 0.3 * (opts.musicVolume / 100);
        }
        if (this.muted) return;

        let targetTempoMulti = 1.0;
        let targetFilterFreq = 1000;

        if (game.activeBoss) {
            targetTempoMulti = 1.5;
            targetFilterFreq = 2000;
        }

        if (game.player && game.player.hp <= 1) {
            targetTempoMulti = 0.8;
            targetFilterFreq = 500;
        }

        this.tempoMultiplier += (targetTempoMulti - this.tempoMultiplier) * dt * 2;
        this.musicFilter.frequency.value += (targetFilterFreq - this.musicFilter.frequency.value) * dt * 2;

        const secondsPerBeat = 60.0 / (this.baseTempo * this.tempoMultiplier);

        if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
            this.nextNoteTime = this.ctx.currentTime;
        }

        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.nextNoteTime, secondsPerBeat);
            this.nextNoteTime += secondsPerBeat / 4; // 16th notes
        }
    }

    scheduleNote(time, secondsPerBeat) {
        if (this.currentNote % 4 === 0) {
            this.playKick(time);
        }
        if (this.currentNote % 8 === 4) {
            this.playSnare(time);
        }
        if (this.currentNote % 2 === 0) {
            this.playHihat(time);
        }

        if (Math.random() > 0.3) {
            const noteIndex = Math.floor(Math.random() * this.scale.length);
            const freq = this.scale[noteIndex] / (Math.random() > 0.5 ? 2 : 1);
            this.playArp(time, freq, secondsPerBeat / 4);
        }

        this.currentNote++;
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.start(time);
        osc.stop(time + 0.1);
    }

    playSnare(time) {
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        noise.connect(noiseFilter);

        const gain = this.ctx.createGain();
        noiseFilter.connect(gain);
        gain.connect(this.musicGain);

        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        noise.start(time);
    }

    playHihat(time) {
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 7000;
        noise.connect(noiseFilter);

        const gain = this.ctx.createGain();
        noiseFilter.connect(gain);
        gain.connect(this.musicGain);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.start(time);
    }

    playArp(time, freq, dur) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(this.musicGain);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + dur * 0.2);
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

        osc.start(time);
        osc.stop(time + dur);
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (!this.initialized) {
            return;
        }
        if (this.muted) {
            return;
        }
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('playTone error', e);
        }
    }

    playShoot() {
        this.playTone(400, 'square', 0.1, 0.3);
    }

    playCollect() {
        this.playTone(800, 'sine', 0.15, 0.4);
    }

    playHit() {
        this.playTone(150, 'sawtooth', 0.2, 0.5);
        setTimeout(() => {
            this.playTone(100, 'square', 0.3, 0.5);
        }, 50);
    }

    playDeposit() {
        this.playTone(1200, 'sine', 0.4, 0.6);
        setTimeout(() => {
            this.playTone(1600, 'sine', 0.4, 0.6);
        }, 100);
    }

    playDash() {
        if (!this.initialized) return;
        if (game && game.saveManager) {
            const opts = game.saveManager.data.options;
            this.muted = opts.mute;
            this.masterGain.gain.value = this.muted ? 0 : 1;
            this.sfxGain.gain.value = 0.5 * (opts.sfxVolume / 100);
            this.musicGain.gain.value = 0.3 * (opts.musicVolume / 100);
        }
        if (this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playBossSpawn() {
        if (!this.initialized) return;
        if (game && game.saveManager) {
            const opts = game.saveManager.data.options;
            this.muted = opts.mute;
            this.masterGain.gain.value = this.muted ? 0 : 1;
            this.sfxGain.gain.value = 0.5 * (opts.sfxVolume / 100);
            this.musicGain.gain.value = 0.3 * (opts.musicVolume / 100);
        }
        if (this.muted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 2.0);
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 3.0);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 3.0);
    }

    playUpgradeSelect() {
        this.playTone(1000, 'sine', 0.1, 0.4);
        setTimeout(() => this.playTone(1500, 'sine', 0.2, 0.5), 100);
    }

    playGameOver() {
        this.playTone(200, 'sawtooth', 0.5, 0.6);
        setTimeout(() => this.playTone(150, 'sawtooth', 0.5, 0.6), 500);
        setTimeout(() => this.playTone(100, 'sawtooth', 1.0, 0.6), 1000);
    }

    playMenuHover() {
        this.playTone(600, 'sine', 0.05, 0.2);
    }

    playMenuClick() {
        this.playTone(800, 'triangle', 0.1, 0.3);
    }

    playEnemyDeath() {
        if (!this.initialized) return;
        if (game && game.saveManager) {
            const opts = game.saveManager.data.options;
            this.muted = opts.mute;
            this.masterGain.gain.value = this.muted ? 0 : 1;
            this.sfxGain.gain.value = 0.5 * (opts.sfxVolume / 100);
            this.musicGain.gain.value = 0.3 * (opts.musicVolume / 100);
        }
        if (this.muted) return;
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) output[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noise.start(this.ctx.currentTime);
    }

    playPlayerDamage() {
        this.playTone(100, 'sawtooth', 0.3, 0.7);
        setTimeout(() => this.playTone(80, 'square', 0.4, 0.7), 100);
    }
}


class InputManager {
    constructor() {
        this.keys = {};
        this.virtualKeys = {};
        this.prevKeys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.prevMouse = { x: 0, y: 0, down: false };
        this.touch = { active: false, x: 0, y: 0 };
        this.prevTouch = { active: false, x: 0, y: 0 };
        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return; // A held key cannot reactivate after focus-loss cleanup.
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
        window.addEventListener('blur', () => this.releaseAll());
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.releaseAll();
        });

        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => {
                this.updateMouse(e);
                this.mouse.down = true;
            });
            window.addEventListener('mouseup', () => {
                this.mouse.down = false;
            });
            canvas.addEventListener('mousemove', (e) => {
                this.updateMouse(e);
            });

            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (e.touches.length > 0) {
                    this.updateTouch(e.touches[0]);
                    this.mouse.down = true;
                    this.touch.active = true;
                }
            }, { passive: false });
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (e.touches.length > 0) {
                    this.updateTouch(e.touches[0]);
                }
            }, { passive: false });
            window.addEventListener('touchend', (e) => {
                this.releaseTouch();
                if (e.touches && e.touches.length > 0) {
                    this.updateTouch(e.touches[0]);
                    this.mouse.down = true;
                    this.touch.active = true;
                }
            });
            window.addEventListener('touchcancel', () => this.releaseTouch());
        }
    }

    releaseTouch() {
        this.mouse.down = false;
        this.touch.active = false;
        this.virtualKeys = {};
    }

    releaseAll() {
        this.keys = {};
        this.releaseTouch();
    }

    updateMouse(e) {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        }
    }

    updateTouch(touch) {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouse.x = (touch.clientX - rect.left) * scaleX;
            this.mouse.y = (touch.clientY - rect.top) * scaleY;
        }
    }

    isDown(code) {
        return !!(this.keys[code] || this.virtualKeys[code]);
    }

    justPressed(code) {
        if (this.isDown(code) && !this.prevKeys[code]) {
            return true;
        }
        return false;
    }

    justReleased(code) {
        if (!this.isDown(code) && this.prevKeys[code]) {
            return true;
        }
        return false;
    }

    mouseJustPressed() {
        if (this.mouse.down && !this.prevMouse.down) {
            return true;
        }
        return false;
    }

    mouseJustReleased() {
        if (!this.mouse.down && this.prevMouse.down) {
            return true;
        }
        return false;
    }

    touchJustPressed() {
        if (this.touch.active && !this.prevTouch.active) {
            return true;
        }
        return false;
    }

    touchJustReleased() {
        if (!this.touch.active && this.prevTouch.active) {
            return true;
        }
        return false;
    }

    update() {
        this.prevKeys = { ...this.keys, ...this.virtualKeys };
        this.prevMouse = { ...this.mouse };
        this.prevTouch = { ...this.touch };
    }
}

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    collides(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + other.radius) {
            return true;
        }
        return false;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15, ACCENT_COLOR);
        this.speed = 200;
        this.tail = [];
        this.tailLength = 0;
        this.maxTailLength = 50;
        this.nodeSpacing = 12;
        this.history = [];
        this.energy = 100;
        this.baseDepositTimer = 0;

        this.dashCooldown = 0;
        this.dashCooldownMax = 3.0;
        this.dashActiveTimer = 0;
        this.dashActiveMax = 0.2;
        this.lastMoveDirection = { x: 0, y: 0 };
        this.isInvulnerable = false;
        this.particles = [];
    }

    update(dt, input, width, height) {
        let dx = 0;
        let dy = 0;

        if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
            dy -= 1;
        }
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
            dy += 1;
        }
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
            dx -= 1;
        }
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
            dx += 1;
        }

        const virtualDirection = input.virtualKeys['ArrowUp'] || input.virtualKeys['ArrowDown'] ||
            input.virtualKeys['ArrowLeft'] || input.virtualKeys['ArrowRight'];
        const virtualDash = !!input.virtualKeys['Space'];
        const virtualControl = virtualDirection || virtualDash;
        // A control touch belongs to its button, not to world-space steering.
        if (!virtualControl && (input.touch.active || input.mouse.down) && dx === 0 && dy === 0) {
            const mx = input.mouse.x;
            const my = input.mouse.y;
            const angle = Math.atan2(my - this.y, mx - this.x);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
        } else if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        if (dx !== 0 || dy !== 0) this.lastMoveDirection = { x: dx, y: dy };

        this.dashCooldown -= dt;
        if (this.dashCooldown < 0) this.dashCooldown = 0;

        this.dashActiveTimer -= dt;
        if (this.dashActiveTimer < 0) this.dashActiveTimer = 0;

        const dashPressed = input.justPressed('Space') || (!virtualControl &&
            ((input.mouse.down && !input.prevMouse.down) || (input.touch.active && !input.prevTouch.active)));
        // Single-finger users can leave the pad and dash along their last heading.
        // The fallback ends on release, cancellation, or expiry of this dash.
        if (virtualDash && dx === 0 && dy === 0 &&
            (this.dashActiveTimer > 0 || (this.dashCooldown <= 0 && dashPressed))) {
            dx = this.lastMoveDirection.x;
            dy = this.lastMoveDirection.y;
        }

        let isDashing = false;
        if (this.dashCooldown <= 0 && dashPressed) {
            this.dashCooldown = this.dashCooldownMax;
            this.dashActiveTimer = this.dashActiveMax;
            isDashing = true;
            if (window.game && window.game.soundEngine && window.game.soundEngine.playDash) window.game.soundEngine.playDash();

            // Add some particles
            for (let i = 0; i < 10; i++) {
                this.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: (Math.random() - 0.5) * 100 - dx * 50,
                    vy: (Math.random() - 0.5) * 100 - dy * 50,
                    life: 0.5 + Math.random() * 0.5
                });
            }
        }

        let currentSpeed = this.speed;
        if (this.dashActiveTimer > 0) {
            currentSpeed = this.speed * 3;
            this.isInvulnerable = true;
        } else {
            this.isInvulnerable = false;
        }

        this.vx = dx * currentSpeed;
        this.vy = dy * currentSpeed;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        super.update(dt);

        if (this.x < this.radius) {
            this.x = this.radius;
        }
        if (this.x > width - this.radius) {
            this.x = width - this.radius;
        }
        if (this.y < this.radius) {
            this.y = this.radius;
        }
        if (this.y > height - this.radius) {
            this.y = height - this.radius;
        }

        if (this.vx !== 0 || this.vy !== 0) {
            this.history.unshift({ x: this.x, y: this.y });
            const limit = this.maxTailLength * (this.nodeSpacing / 2);
            if (this.history.length > limit) {
                this.history.pop();
            }
        }

        this.tail = [];
        for (let i = 1; i <= this.tailLength; i++) {
            const histIndex = i * 4;
            if (histIndex < this.history.length) {
                this.tail.push(this.history[histIndex]);
            } else if (this.history.length > 0) {
                this.tail.push(this.history[this.history.length - 1]);
            }
        }
    }

    draw(ctx) {
        if (this.particles) {
            for (let p of this.particles) {
                ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (this.tail.length > 0) {
            ctx.moveTo(this.x, this.y);
            for (let i = 0; i < this.tail.length; i++) {
                ctx.lineTo(this.tail[i].x, this.tail[i].y);
            }
            ctx.stroke();

            ctx.fillStyle = '#65bb98';
            for (let i = 0; i < this.tail.length; i++) {
                ctx.beginPath();
                ctx.arc(this.tail[i].x, this.tail[i].y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.fillStyle = this.isInvulnerable ? '#ffffff' : this.color;
        ctx.beginPath();
        const angle = Math.atan2(this.vy, this.vx);

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.vx !== 0 || this.vy !== 0) {
            ctx.rotate(angle);
        }

        let recoil = 0;
        if (this.dashActiveTimer > 0) {
            recoil = -5; // move back slightly
            ctx.fillStyle = '#ffeb3b'; // flash color
        }

        // multi-part vector sprite
        ctx.beginPath();
        ctx.moveTo(15 + recoil, 0);
        ctx.lineTo(-10 + recoil, 10);
        ctx.lineTo(-10 + recoil, -10);
        ctx.closePath();
        ctx.fill();

        // Thrust flame
        if (this.vx !== 0 || this.vy !== 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(-10 + recoil, -5);
            ctx.lineTo(-10 + recoil, 5);
            ctx.lineTo(-20 + recoil - Math.random() * 5, 0);
            ctx.closePath();
            ctx.fill();
        }

        // Telegraph (aim line)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20 + recoil, 0);
        ctx.lineTo(50 + recoil, 0);
        ctx.stroke();

        ctx.restore();
    }

    addTailNode() {
        if (this.tailLength < this.maxTailLength) {
            this.tailLength++;
        }
    }
}

class Enemy extends Entity {
    constructor(x, y, target) {
        super(x, y, 12, '#e74c3c');
        this.speed = 100 + Math.random() * 50;
        this.target = target;
        this.hp = 1;
    }

    update(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }

        this.vx += (Math.random() - 0.5) * 50;
        this.vy += (Math.random() - 0.5) * 50;

        super.update(dt);
    }

    takeDamage() {
        this.hp--;
        if (this.hp <= 0) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - 2, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Swarmer extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 8;
        this.speed = 150 + Math.random() * 50;
        this.color = '#ff9ff3';
        this.wobble = Math.random() * Math.PI * 2;
        this.hp = 1;
        this.state = 'CHASE';
        this.telegraphTimer = 0;
    }
    update(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        if (this.state === 'CHASE') {
            this.wobble += dt * 10;
            this.vx = (dx / dist) * this.speed + Math.cos(this.wobble) * 100;
            this.vy = (dy / dist) * this.speed + Math.sin(this.wobble) * 100;
            if (dist < 100 && Math.random() < 0.05) {
                this.state = 'TELEGRAPH';
                this.telegraphTimer = 0;
            }
        } else if (this.state === 'TELEGRAPH') {
            this.telegraphTimer += dt;
            this.vx = 0;
            this.vy = 0;
            if (this.telegraphTimer > 0.4) {
                this.state = 'DASH';
                this.telegraphTimer = 0;
                this.vx = (dx / dist) * this.speed * 3;
                this.vy = (dy / dist) * this.speed * 3;
            }
        } else if (this.state === 'DASH') {
            this.telegraphTimer += dt;
            if (this.telegraphTimer > 0.3) {
                this.state = 'CHASE';
            }
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.fillStyle = this.state === 'TELEGRAPH' ? '#fff' : this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y - this.radius);
        ctx.fill();
        if (this.state === 'TELEGRAPH') {
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

class Bruiser extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 20;
        this.speed = 40;
        this.color = '#c0392b';
        this.hp = 3;
        this.state = 'WALK';
        this.telegraphTimer = 0;
    }
    update(dt) {
        if (this.state === 'WALK') {
            if (Math.random() < 0.01) {
                this.state = 'TELEGRAPH';
                this.telegraphTimer = 0;
            }
        } else if (this.state === 'TELEGRAPH') {
            this.telegraphTimer += dt;
            this.vx = 0; this.vy = 0;
            if (this.telegraphTimer > 1) {
                this.state = 'WALK';
            }
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        if (this.state === 'TELEGRAPH') {
            ctx.fillStyle = (Math.floor(this.telegraphTimer * 10) % 2 === 0) ? '#fff' : this.color;
        }
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            const px = this.x + Math.cos(angle) * this.radius;
            const py = this.y + Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        if (this.state === 'TELEGRAPH') {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < this.hp; i++) {
            ctx.arc(this.x - 6 + i * 6, this.y - 10, 2, 0, Math.PI * 2);
        }
        ctx.stroke();
    }
}

class Sniper extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 10;
        this.speed = 60;
        this.color = '#9b59b6';
        this.hp = 1;
        this.state = 'IDLE';
        this.timer = 0;
        this.dashDir = {x:0, y:0};
    }
    update(dt) {
        if (this.state === 'IDLE') {
            this.timer += dt;
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;
            if (dist > 150) {
                this.vx = (dx/dist) * this.speed;
                this.vy = (dy/dist) * this.speed;
            } else {
                this.vx = -(dx/dist) * this.speed;
                this.vy = -(dy/dist) * this.speed;
            }
            if (this.timer > 3 && dist < 300) {
                this.state = 'TELEGRAPH';
                this.timer = 0;
                this.dashDir = { x: dx/dist, y: dy/dist };
                this.vx = 0; this.vy = 0;
            }
        } else if (this.state === 'TELEGRAPH') {
            this.timer += dt;
            if (this.timer > 1) {
                this.state = 'DASH';
                this.timer = 0;
            }
        } else if (this.state === 'DASH') {
            this.timer += dt;
            this.vx = this.dashDir.x * 400;
            this.vy = this.dashDir.y * 400;
            if (this.timer > 0.5) {
                this.state = 'IDLE';
                this.timer = 0;
            }
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.lineTo(this.x, this.y - this.radius);
        ctx.fill();
        if (this.state === 'TELEGRAPH') {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.dashDir.x * 300, this.y + this.dashDir.y * 300);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + this.timer * 20, 0, Math.PI*2);
            ctx.stroke();
        }
    }
}

class Splitter extends Enemy {
    constructor(x, y, target, game) {
        super(x, y, target);
        this.radius = 16;
        this.color = '#3498db';
        this.game = game;
        this.hp = 1;
        this.state = 'MOVE';
        this.telegraphTimer = 0;
    }
    update(dt) {
        if (this.state === 'MOVE') {
            if (Math.random() < 0.02) {
                this.state = 'TELEGRAPH';
                this.telegraphTimer = 0;
            }
        } else if (this.state === 'TELEGRAPH') {
            this.telegraphTimer += dt;
            this.vx = 0; this.vy = 0;
            if (this.telegraphTimer > 0.5) {
                this.state = 'MOVE';
            }
        }
        super.update(dt);
    }
    takeDamage() {
        this.hp--;
        if (this.hp <= 0) {
            this.active = false;
            if (this.game && this.game.enemies) {
                this.game.enemies.push(new Swarmer(this.x - 10, this.y, this.target));
                this.game.enemies.push(new Swarmer(this.x + 10, this.y, this.target));
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.state === 'TELEGRAPH' ? '#fff' : this.color;
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);

        if (this.state === 'TELEGRAPH') {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - this.radius - 5, this.y - this.radius - 5);
            ctx.lineTo(this.x + this.radius + 5, this.y + this.radius + 5);
            ctx.moveTo(this.x + this.radius + 5, this.y - this.radius - 5);
            ctx.lineTo(this.x - this.radius - 5, this.y + this.radius + 5);
            ctx.stroke();
        }

        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.stroke();
    }
}

class Haunt extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 14;
        this.color = '#2ecc71';
        this.phase = 0;
        this.hp = 2;
        this.state = 'FADE';
        this.telegraphTimer = 0;
    }
    update(dt) {
        this.phase += dt * 2;
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;

        if (this.state === 'FADE') {
            this.vx = (dx/dist) * this.speed * Math.sin(this.phase);
            this.vy = (dy/dist) * this.speed * Math.cos(this.phase);
            if (Math.sin(this.phase) > 0.9) {
                this.state = 'TELEGRAPH';
                this.telegraphTimer = 0;
            }
        } else if (this.state === 'TELEGRAPH') {
            this.telegraphTimer += dt;
            this.vx = 0; this.vy = 0;
            if (this.telegraphTimer > 0.8) {
                this.state = 'FADE';
            }
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.globalAlpha = this.state === 'TELEGRAPH' ? 1.0 : 0.5 + Math.sin(this.phase) * 0.5;
        ctx.fillStyle = this.state === 'TELEGRAPH' ? ((Math.floor(this.telegraphTimer * 15) % 2 === 0) ? '#fff' : this.color) : this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI, true);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius/2, this.y + this.radius/2);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x + this.radius/2, this.y + this.radius/2);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        if (this.state === 'TELEGRAPH') {
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 15 - this.telegraphTimer * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
}

class ResourceNode extends Entity {
    constructor(x, y) {
        super(x, y, 8, '#f1c40f');
        this.pulse = 0;
    }

    update(dt) {
        this.pulse += dt * 5;
    }

    draw(ctx) {
        const pulseRadius = this.radius + Math.sin(this.pulse) * 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class BaseCamp extends Entity {
    constructor(x, y) {
        super(x, y, 40, '#8e44ad');
        this.rotation = 0;
    }

    update(dt) {
        this.rotation += dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(142, 68, 173, 0.2)';
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BASE', 0, 0);

        ctx.restore();
    }
}

class ParallaxBackground {
    constructor() {
        this.layers = [
            { speed: 0.1, color: '#1a111a', pattern: 'dots', offset: 0, density: 0.01 }, // deep background
            { speed: 0.3, color: '#2a1a2a', pattern: 'lines', offset: 0, density: 0.02 }, // mid ground
            { speed: 0.6, color: '#3d253d', pattern: 'arches', offset: 0, density: 0.03 } // foreground manor elements
        ];
        this.dots = [];
        for (let i=0; i<100; i++) {
            this.dots.push({x: Math.random(), y: Math.random(), s: Math.random() * 2 + 1});
        }
    }

    update(dt, playerVx, playerVy) {
        // Player moves the camera effectively, so parallax moves opposite
        this.layers.forEach(layer => {
            layer.offsetX = (layer.offsetX || 0) - playerVx * dt * layer.speed;
            layer.offsetY = (layer.offsetY || 0) - playerVy * dt * layer.speed;
        });
    }

    draw(ctx, width, height) {
        ctx.fillStyle = '#0f0a0f'; // deepest background
        ctx.fillRect(0, 0, width, height);

        this.layers.forEach((layer, idx) => {
            ctx.fillStyle = layer.color;
            ctx.strokeStyle = layer.color;

            if (layer.pattern === 'dots') {
                for(let d of this.dots) {
                    let px = (d.x * width + layer.offsetX) % width;
                    let py = (d.y * height + layer.offsetY) % height;
                    if (px < 0) px += width;
                    if (py < 0) py += height;

                    ctx.beginPath();
                    ctx.arc(px, py, d.s, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (layer.pattern === 'lines') {
                ctx.lineWidth = 2;
                const spacing = 150;
                let startX = layer.offsetX % spacing;
                if (startX > 0) startX -= spacing;

                for (let x = startX; x < width + spacing; x += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x, height);
                    ctx.stroke();
                }

                let startY = layer.offsetY % spacing;
                if (startY > 0) startY -= spacing;
                for (let y = startY; y < height + spacing; y += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(0, y);
                    ctx.lineTo(width, y);
                    ctx.stroke();
                }
            } else if (layer.pattern === 'arches') {
                ctx.lineWidth = 4;
                const spacing = 300;
                let startX = layer.offsetX % spacing;
                if (startX > 0) startX -= spacing;

                for (let x = startX; x < width + spacing; x += spacing) {
                    ctx.beginPath();
                    ctx.moveTo(x, height);
                    ctx.lineTo(x, height / 2);
                    ctx.arc(x + spacing/2, height/2, spacing/2, Math.PI, 0);
                    ctx.lineTo(x + spacing, height);
                    ctx.stroke();
                }
            }
        });
    }
}

class Hazard extends Entity {
    constructor(x, y, radius, color) {
        super(x, y, radius, color);
    }
    affect(entity, dt) {}
}

class GhostlyVortex extends Hazard {
    constructor(x, y) {
        super(x, y, 60, '#7d3c98');
        this.angle = 0;
        this.pullForce = 150;
    }

    update(dt) {
        this.angle += dt * 2;
        super.update(dt);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i=0; i<3; i++) {
            ctx.arc(0, 0, this.radius - i * 15, i*Math.PI/2, i*Math.PI/2 + Math.PI);
        }
        ctx.stroke();

        ctx.restore();
    }

    affect(entity, dt) {
        const dx = this.x - entity.x;
        const dy = this.y - entity.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < this.radius * 2 && dist > 5) {
            const pull = this.pullForce * (1 - dist / (this.radius * 2));
            entity.x += (dx / dist) * pull * dt;
            entity.y += (dy / dist) * pull * dt;
        }
    }
}

class CrumblingPillar extends Hazard {
    constructor(x, y) {
        super(x, y, 25, '#7f8c8d');
        this.hp = 3; // takes 3 hits to destroy
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);

        // cracks based on hp
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.hp <= 2) {
            ctx.moveTo(this.x - this.radius, this.y - this.radius);
            ctx.lineTo(this.x, this.y);
        }
        if (this.hp <= 1) {
            ctx.moveTo(this.x + this.radius, this.y - this.radius);
            ctx.lineTo(this.x - 10, this.y + 10);
        }
        ctx.stroke();
    }

    affect(entity, dt) {
        // Acts as solid obstacle, push entity out
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;

        // AABB approximation for circle-rect
        const closestX = Math.max(this.x - this.radius, Math.min(entity.x, this.x + this.radius));
        const closestY = Math.max(this.y - this.radius, Math.min(entity.y, this.y + this.radius));

        const distanceX = entity.x - closestX;
        const distanceY = entity.y - closestY;
        const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

        if (distanceSquared < (entity.radius * entity.radius)) {
            // Collision!
            const dist = Math.sqrt(distanceSquared) || 1;
            const pushOut = entity.radius - dist;

            // if entity is player dashing, break pillar
            if (entity instanceof Player && entity.isInvulnerable) {
                this.hp--;
                if (this.hp <= 0) {
                    this.active = false;
                }
                // bounce player slightly
                entity.x += (distanceX / dist) * pushOut * 2;
                entity.y += (distanceY / dist) * pushOut * 2;
            } else {
                entity.x += (distanceX / dist) * pushOut;
                entity.y += (distanceY / dist) * pushOut;
            }
        }
    }
}

class SpectralSpikes extends Hazard {
    constructor(x, y) {
        super(x, y, 20, '#16a085');
        this.timer = Math.random() * 4;
        this.state = 'hidden'; // hidden, warning, active
    }

    update(dt) {
        this.timer += dt;
        const cycle = this.timer % 4;
        if (cycle < 2) {
            this.state = 'hidden';
        } else if (cycle < 3) {
            this.state = 'warning';
        } else {
            this.state = 'active';
        }
        super.update(dt);
    }

    draw(ctx) {
        if (this.state === 'hidden') return;

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'warning') {
            ctx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius * 0.8, this.radius * 0.8);
            ctx.lineTo(-this.radius * 0.8, this.radius * 0.8);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }

        ctx.restore();
    }

    affect(entity, dt) {
        if (this.state !== 'active') return;

        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < this.radius + entity.radius) {
            if (entity instanceof Player && !entity.isInvulnerable) {
                // Instakill or damage? Let Game handle it if possible, but here we can just set a flag on player or call something if Game is accessible.
                // Alternatively, we just drastically slow them down and hurt tail
                entity.vx *= 0.5;
                entity.vy *= 0.5;
                if (entity.tailLength > 0 && Math.random() < 0.1) {
                   entity.tailLength = Math.max(0, entity.tailLength - 1);
                }
            } else if (entity instanceof Enemy) {
                // Spikes kill enemies!
                entity.active = false;
            }
        }
    }
}


class Boss extends Enemy {
    constructor(x, y, target, name, maxHp, color) {
        super(x, y, target);
        this.name = name;
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.displayHp = maxHp;
        this.color = color;
        this.radius = 30;
        this.phase = 1;
        this.warningTimer = 3.0; // 3 seconds of warning banner before active
        this.active = true;
    }

    update(dt) {
        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            return;
        }

        // Lerp display HP
        this.displayHp += (this.hp - this.displayHp) * 5 * dt;

        if (this.hp <= this.maxHp / 2 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseTransition();
        }
    }

    takeDamage() {
        if (this.warningTimer > 0) return;
        this.hp--;
        if (this.hp <= 0) {
            this.active = false;
        }
    }

    onPhaseTransition() {}

    drawBossUI(ctx, width, height) {
        if (this.warningTimer > 0) {
            // Draw Warning Banner
            ctx.fillStyle = 'rgba(231, 76, 60, 0.5)';
            ctx.fillRect(0, height / 2 - 50, width, 100);
            ctx.fillStyle = '#fff';
            ctx.font = '40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`WARNING: ${this.name} APPROACHING!`, width / 2, height / 2);

            // Blink effect
            if (Math.floor(this.warningTimer * 5) % 2 === 0) {
                ctx.fillStyle = '#e74c3c';
                ctx.fillText(`WARNING: ${this.name} APPROACHING!`, width / 2, height / 2);
            }
            return;
        }

        // Draw Health Bar
        const barWidth = width * 0.6;
        const barHeight = 20;
        const barX = (width - barWidth) / 2;
        const barY = 20;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const hpPercent = Math.max(0, this.displayHp / this.maxHp);
        ctx.fillStyle = this.color;
        ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${this.name} - PHASE ${this.phase}`, width / 2, barY + barHeight / 2);
    }
}

class PoltergeistBoss extends Boss {
    constructor(x, y, target, game) {
        super(x, y, target, 'Poltergeist Alpha', 40 + (game.wave * 15), '#9b59b6');
        this.game = game;
        this.attackTimer = 0;
        this.wobble = 0;
    }
    update(dt) {
        super.update(dt);
        if (this.warningTimer > 0) return;

        this.wobble += dt * 5;

        // Target tail if exists, else player
        let targetX = this.target.x;
        let targetY = this.target.y;
        if (this.target.tail && this.target.tail.length > 0) {
            const lastNode = this.target.tail[this.target.tail.length - 1];
            targetX = lastNode.x;
            targetY = lastNode.y;
        }

        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;

        this.speed = this.phase === 1 ? 50 : 90;

        this.vx = (dx / dist) * this.speed + Math.cos(this.wobble) * 20;
        this.vy = (dy / dist) * this.speed + Math.sin(this.wobble) * 20;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase === 1 ? 3.0 : 1.5;
            // Spawn hazard at target location
            if (this.game && this.game.hazards) {
                this.game.hazards.push(new SpectralSpikes(targetX, targetY));
            }
        }
    }
    onPhaseTransition() {
        this.radius = 40;
    }
    draw(ctx) {
        if (this.warningTimer > 0) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

class SpecterKingBoss extends Boss {
    constructor(x, y, target, game) {
        super(x, y, target, 'Specter King', 60 + (game.wave * 20), '#f1c40f');
        this.game = game;
        this.state = 'CHARGE'; // CHARGE, SPAWN
        this.stateTimer = 2.0;
        this.speed = 120;
    }
    update(dt) {
        super.update(dt);
        if (this.warningTimer > 0) return;

        this.stateTimer -= dt;

        if (this.state === 'CHARGE') {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy) || 1;

            const currentSpeed = this.phase === 1 ? this.speed : this.speed * 1.5;
            this.vx = (dx / dist) * currentSpeed;
            this.vy = (dy / dist) * currentSpeed;

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (this.stateTimer <= 0) {
                this.state = 'SPAWN';
                this.stateTimer = this.phase === 1 ? 2.0 : 1.0;
                this.vx = 0;
                this.vy = 0;
            }
        } else if (this.state === 'SPAWN') {
            if (this.stateTimer <= 0) {
                // Spawn swarmers
                if (this.game && this.game.enemies) {
                    for(let i=0; i < (this.phase === 1 ? 2 : 4); i++) {
                        this.game.enemies.push(new Swarmer(this.x + (Math.random()-0.5)*50, this.y + (Math.random()-0.5)*50, this.target));
                    }
                }
                this.state = 'CHARGE';
                this.stateTimer = 3.0;
            }
        }
    }
    draw(ctx) {
        if (this.warningTimer > 0) return;
        ctx.fillStyle = this.state === 'SPAWN' ? '#fff' : this.color;
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(this.x - this.radius, this.y - this.radius, this.radius*2, this.radius*2);
    }
}


class Pickup extends Entity {
    constructor(x, y, type) {
        super(x, y, 8, '#f1c40f');
        this.type = type;
        this.life = 10.0;
        if (this.type === 'COMBO') this.color = '#e74c3c';
        else if (this.type === 'SCORE') this.color = '#f1c40f';
        else if (this.type === 'SPEED') this.color = '#3498db';
    }
    update(dt) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

class Game {

    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.saveManager = new SaveManager();
        this.soundEngine = new SoundEngine();
        this.inputManager = new InputManager();

        this.state = 'TITLE';
        this.lastTime = 0;
        this.dt = 0;

        this.score = 0;
        this.multiplier = 1;

        this.player = null;
        this.baseCamp = null;
        this.enemies = [];
        this.resources = [];
        this.hazards = [];
        this.pickups = [];
        this.parallax = new ParallaxBackground();
        this.vfxManager = new VFXManager(this);
        this.uiManager = new UIManager(this);

        this.spawnTimer = 0;
        this.resourceTimer = 0;

        this.resize();
        this.resizeObserver = new ResizeObserver(() => {
            this.resize();
        });
        this.resizeObserver.observe(this.canvas);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === 'PLAYING') {
                    this.state = 'PAUSED';
                }
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
        }
    }

    initGame() {
        this.score = 0;
        this.multiplier = 1;
        this.player = new Player(this.width / 2, this.height / 2);
        this.baseCamp = new BaseCamp(this.width / 2, this.height / 2);
        this.enemies = [];
        this.resources = [];
        this.spawnTimer = 0;
        this.resourceTimer = 0;
        this.bossesSpawned = 0;
        this.activeBoss = null;
        this.state = 'PLAYING';
        this.pickups = this.pickups || [];

        this.wave = 1;
        this.killsThisWave = 0;
        this.killsRequired = 10;
        this.currentUpgrades = [];
        this.pickups = this.pickups || [];
        this.pickupChance = 0.1;
        this.comboTimer = 0;
        this.comboMaxTimer = 3.0;
        this.comboLevel = 0;

        this.soundEngine.init();
        this.soundEngine.resume();

        for(let i = 0; i < 5; i++) {
            this.spawnResource();
        }

        this.spawnHazards();
    }

    spawnHazards() {
        this.hazards = [];

        // Spawn Vortexes
        for (let i = 0; i < 3; i++) {
            this.hazards.push(new GhostlyVortex(
                Math.random() * this.width,
                Math.random() * this.height
            ));
        }

        // Spawn Crumbling Pillars
        for (let i = 0; i < 6; i++) {
            this.hazards.push(new CrumblingPillar(
                Math.random() * this.width,
                Math.random() * this.height
            ));
        }

        // Spawn Spectral Spikes
        for (let i = 0; i < 4; i++) {
            this.hazards.push(new SpectralSpikes(
                Math.random() * this.width,
                Math.random() * this.height
            ));
        }
    }

    spawnResource(attempts = 0) {
        if (attempts > 10) return;
        const x = Math.random() * (this.width - 40) + 20;
        const y = Math.random() * (this.height - 40) + 20;

        const dx = x - this.baseCamp.x;
        const dy = y - this.baseCamp.y;

        if (Math.sqrt(dx*dx + dy*dy) > 150) {
            this.resources.push(new ResourceNode(x, y));
        } else {
            this.spawnResource(attempts + 1);
        }
    }

    spawnEnemy() {
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -20 : this.width + 20;
            y = Math.random() * this.height;
        } else {
            x = Math.random() * this.width;
            y = Math.random() < 0.5 ? -20 : this.height + 20;
        }

        const r = Math.random();
        let swarmerChance = Math.max(0.05, 0.4 - this.wave * 0.05);
        let bruiserChance = swarmerChance + Math.max(0.1, 0.3 - this.wave * 0.02);
        let sniperChance = bruiserChance + Math.min(0.25, 0.05 + this.wave * 0.05);
        let splitterChance = sniperChance + Math.min(0.25, this.wave * 0.05);

        if (this.wave < 2) {
            if (r < 0.6) this.enemies.push(new Swarmer(x, y, this.player));
            else this.enemies.push(new Bruiser(x, y, this.player));
        } else {
            if (r < swarmerChance) {
                this.enemies.push(new Swarmer(x, y, this.player));
            } else if (r < bruiserChance) {
                this.enemies.push(new Bruiser(x, y, this.player));
            } else if (r < sniperChance) {
                this.enemies.push(new Sniper(x, y, this.player));
            } else if (r < splitterChance) {
                this.enemies.push(new Splitter(x, y, this.player, this));
            } else {
                this.enemies.push(new Haunt(x, y, this.player));
            }
        }
    }

    updatePlaying(dt) {
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboLevel = 0;
                this.multiplier = 1;
            }
        }

        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.update(dt);
            if (this.player.collides(p)) {
                if (p.type === 'COMBO') { this.comboTimer = this.comboMaxTimer; this.comboLevel += 2; this.multiplier = 1 + Math.floor(this.comboLevel / 5); }
                else if (p.type === 'SCORE') { this.score += 50 * this.multiplier; }
                else if (p.type === 'SPEED') { this.player.speed = Math.min(300, this.player.speed + 15); }
                p.active = false;
                this.soundEngine.playCollect();
            }
            if (!p.active) this.pickups.splice(i, 1);
        }

        this.player.update(dt, this.inputManager, this.width, this.height);
        if (this.player.dashActiveTimer > 0) {
            this.vfxManager.spawnTrail(this.player.x, this.player.y, this.player.radius, '#0ff');
            this.vfxManager.spawnHitParticles(this.player.x, this.player.y, -this.player.vx, -this.player.vy, '#0ff');
        }
        this.baseCamp.update(dt);
        this.parallax.update(dt, this.player.vx, this.player.vy);

        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const hazard = this.hazards[i];
            if (hazard.active) {
                hazard.update(dt);
                hazard.affect(this.player, dt);

                this.enemies.forEach(enemy => {
                    if (enemy.active) {
                        hazard.affect(enemy, dt);
                    }
                });
            } else {
                this.hazards.splice(i, 1);
            }
        }

        if (!this.activeBoss && this.score >= (this.bossesSpawned + 1) * 500) {
            this.bossesSpawned++;
            const bossType = Math.random() < 0.5 ? PoltergeistBoss : SpecterKingBoss;
            this.activeBoss = new bossType(this.width / 2, -50, this.player, this);
            this.enemies.push(this.activeBoss);
            if (this.soundEngine && this.soundEngine.playBossSpawn) this.soundEngine.playBossSpawn();
        }

        if (this.activeBoss && !this.activeBoss.active) {
            this.activeBoss = null;
            this.comboLevel += 5;
            this.multiplier = 1 + Math.floor(this.comboLevel / 5);
            this.comboTimer = this.comboMaxTimer;
            this.score += 250 * this.multiplier; // Bonus for killing boss
            this.killsThisWave++;
                        this.saveManager.data.bossesDefeated++;
        }

        if (this.killsThisWave >= this.killsRequired && !this.activeBoss) {
            this.state = 'UPGRADE';
            this.generateUpgrades();
            return;
        }

        if (!this.activeBoss || this.activeBoss.warningTimer <= 0) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                this.spawnTimer = Math.max(0.5, 2.5 - (this.wave * 0.15) - (this.score / 2000));
            }
        }

        this.resourceTimer -= dt;
        if (this.resourceTimer <= 0) {
            this.spawnResource();
            this.resourceTimer = 3.0;
        }

        for (let i = this.resources.length - 1; i >= 0; i--) {
            const res = this.resources[i];
            res.update(dt);
            if (this.player.collides(res)) {
                this.player.addTailNode();
                this.soundEngine.playCollect();
                this.vfxManager.spawnText(res.x, res.y, '+Tether', '#0f0');
                this.resources.splice(i, 1);
            }
        }

        if (this.player.collides(this.baseCamp)) {
            if (this.player.tailLength > 0) {
                this.player.baseDepositTimer += dt;
                if (this.player.baseDepositTimer > 0.1) {
                    this.comboLevel++;
                    this.multiplier = 1 + Math.floor(this.comboLevel / 5);
                    this.comboTimer = this.comboMaxTimer;
                    this.score += 10 * this.multiplier;
                    this.player.tailLength--;
                    this.player.baseDepositTimer = 0;
                    this.soundEngine.playDeposit();
                }
            } else {
                this.player.baseDepositTimer = 0;
            }
        } else {
            this.player.baseDepositTimer = 0;
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt);

            if (this.player.collides(enemy)) {
                if (!this.player.isInvulnerable) {
                    this.soundEngine.playHit();
                    this.gameOver();
                    return;
                } else {
                    // Dash hits enemy
                    this.soundEngine.playHit();
                    enemy.takeDamage();
                    this.vfxManager.spawnHitParticles(enemy.x, enemy.y, enemy.x - this.player.x, enemy.y - this.player.y, '#f00');
                    this.vfxManager.spawnText(enemy.x, enemy.y - 20, '-1', '#f00');
                    this.vfxManager.addShake(5, 0.1);
                    this.vfxManager.triggerHitStop(0.05);
                    if (!enemy.active) {
                        this.comboLevel++;
                        this.multiplier = 1 + Math.floor(this.comboLevel / 5);
                        this.comboTimer = this.comboMaxTimer;
                        this.score += 20 * this.multiplier;
                        if (this.score > this.saveManager.data.bestRunScore) this.saveManager.data.bestRunScore = this.score;
                        this.killsThisWave++;
                        this.saveManager.data.bossesDefeated++;
                        if (Math.random() < this.pickupChance) {
                            const types = ['COMBO', 'SCORE', 'SPEED'];
                            this.pickups.push(new Pickup(enemy.x, enemy.y, types[Math.floor(Math.random()*types.length)]));
                        }
                    }
                }
            }

            let tailCut = false;
            for (let j = 0; j < this.player.tail.length; j++) {
                const node = this.player.tail[j];
                const dx = enemy.x - node.x;
                const dy = enemy.y - node.y;
                if (Math.sqrt(dx*dx + dy*dy) < enemy.radius + 5) {
                    this.player.tailLength = j;
                    this.soundEngine.playHit();
                    enemy.takeDamage();
                    this.vfxManager.spawnHitParticles(enemy.x, enemy.y, enemy.x - this.player.x, enemy.y - this.player.y, '#f00');
                    this.vfxManager.spawnText(enemy.x, enemy.y - 20, '-1', '#f00');
                    this.vfxManager.addShake(5, 0.1);
                    this.vfxManager.triggerHitStop(0.05);
                    tailCut = true;
                    this.score = Math.max(0, this.score - 50);
                    break;
                }
            }

            if (!enemy.active || tailCut) {
                this.enemies.splice(i, 1);
            }
        }

        while(this.player.history.length > (this.player.maxTailLength * 10)) {
            this.player.history.pop();
        }

        // Memory leak prevention caps
        if (this.enemies.length > 50) this.enemies.splice(0, this.enemies.length - 50);
        if (this.hazards.length > 30) this.hazards.splice(0, this.hazards.length - 30);
        if (this.pickups.length > 20) this.pickups.splice(0, this.pickups.length - 20);

        if (this.inputManager.isDown('Escape')) {
            this.state = 'PAUSED';
            this.inputManager.keys['Escape'] = false;
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.saveManager.updateHighScore(this.score);
        if (this.soundEngine && this.soundEngine.playGameOver) this.soundEngine.playGameOver();
    }


    generateUpgrades() {
        const pool = [
            { name: 'Max Tail +10', desc: 'Increases max tether length', apply: () => this.player.maxTailLength += 10 },
            { name: 'Dash Cooldown -0.2s', desc: 'Faster dash recharge', apply: () => this.player.dashCooldownMax = Math.max(0.5, this.player.dashCooldownMax - 0.2) },
            { name: 'Speed Up', desc: 'Increase base speed', apply: () => this.player.speed = Math.min(300, this.player.speed + 15) },
            { name: 'Max Combo Time +1s', desc: 'Longer combo duration', apply: () => { this.comboMaxTimer += 1.0; this.comboTimer = this.comboMaxTimer; } },
            { name: 'More Pickups', desc: '+5% drop chance', apply: () => this.pickupChance += 0.05 },
            { name: 'Drill Power', desc: 'Dash is faster', apply: () => this.player.dashSpeed += 50 }
        ];
        this.currentUpgrades = [];
        let poolCopy = [...pool];
        for(let i=0; i<3; i++) {
            if (poolCopy.length === 0) break;
            const idx = Math.floor(Math.random() * poolCopy.length);
            this.currentUpgrades.push(poolCopy[idx]);
            poolCopy.splice(idx, 1);
        }
        this.inputManager.mouse.down = false;
        this.inputManager.touch.active = false;
    }

    applyUpgrade(index) {
        if (this.currentUpgrades[index]) {
            this.currentUpgrades[index].apply();
        }
        this.wave++;
        this.killsRequired += 10 + Math.floor(Math.pow(this.wave, 1.5));
        this.killsThisWave = 0;
        this.state = 'PLAYING';
        if (this.soundEngine && this.soundEngine.playUpgradeSelect) this.soundEngine.playUpgradeSelect();
    }
    update(dt) {
        if (this.soundEngine && this.soundEngine.update) {
            this.soundEngine.update(dt, this);
        }
        if (this.state === 'TITLE') {
            if (this.inputManager.isDown('Space') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.initGame();
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        } else if (this.state === 'PLAYING') {
            this.updatePlaying(dt);
        } else if (this.state === 'UPGRADE') {
            if (this.inputManager.mouse.down || this.inputManager.touch.active) {
                const mx = this.inputManager.mouse.x || this.inputManager.touch.x;
                const my = this.inputManager.mouse.y || this.inputManager.touch.y;
                const cardWidth = 200;
                const cardHeight = 300;
                const spacing = 40;
                const startX = this.width / 2 - (cardWidth * 1.5 + spacing);
                const startY = this.height / 2 - cardHeight / 2;

                for(let i=0; i<3; i++) {
                    const cx = startX + i * (cardWidth + spacing);
                    if (mx >= cx && mx <= cx + cardWidth && my >= startY && my <= startY + cardHeight) {
                        this.applyUpgrade(i);
                        this.inputManager.mouse.down = false;
                        this.inputManager.touch.active = false;
                        break;
                    }
                }
            }
        } else if (this.state === 'PAUSED') {
            if (this.inputManager.isDown('Space') || this.inputManager.isDown('Escape') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.state = 'PLAYING';
                this.inputManager.keys['Space'] = false;
                this.inputManager.keys['Escape'] = false;
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.inputManager.isDown('Space') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.state = 'TITLE';
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        }

    }

    draw() {
        this.ctx.save();
        if (this.vfxManager && this.vfxManager.shakeTimer > 0) {
            this.ctx.translate(this.vfxManager.shakeX, this.vfxManager.shakeY);
        }
        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.parallax.draw(this.ctx, this.width, this.height);
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER' || this.state === 'UPGRADE') {
            this.hazards.forEach(h => {
                if (h.active) h.draw(this.ctx);
            });

            if (this.baseCamp) {
                this.baseCamp.draw(this.ctx);
            }
            this.resources.forEach(r => r.draw(this.ctx));

            if (this.pickups) this.pickups.forEach(p => p.draw(this.ctx));
            if (this.state !== 'GAME_OVER') {
                if (this.player) {
                    this.player.draw(this.ctx);
                }
            }

            this.enemies.forEach(e => e.draw(this.ctx));

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 10, 30);

            this.ctx.fillText(`Wave: ${this.wave}`, 10, 50);
            this.ctx.fillText(`Combo: x${this.multiplier}`, this.width - 150, 30);
            if (this.comboTimer > 0) {
                this.ctx.fillStyle = '#e74c3c';
                this.ctx.fillRect(this.width - 150, 40, 140 * (this.comboTimer / this.comboMaxTimer), 10);
            }
            this.ctx.fillStyle = '#fff';

            const currentTail = this.player ? this.player.tailLength : 0;
            const maxTail = this.player ? this.player.maxTailLength : 50;
            this.ctx.fillText(`Tail: ${currentTail}/${maxTail}`, 10, 80);

            if (this.player) {
                this.ctx.fillText(`Dash: ${this.player.dashCooldown <= 0 ? 'READY' : this.player.dashCooldown.toFixed(1)}s`, 10, 110);

                // Dash cooldown bar
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(10, 120, 100, 10);
                this.ctx.fillStyle = this.player.dashCooldown <= 0 ? '#65bb98' : '#e74c3c';
                const fillRatio = this.player.dashCooldown <= 0 ? 1 : 1 - (this.player.dashCooldown / this.player.dashCooldownMax);
                this.ctx.fillRect(10, 120, 100 * fillRatio, 10);
            }

            // Tutorial Overlay for Wave 1
            if (this.wave === 1 && this.state === 'PLAYING') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(this.width / 2 - 250, 10, 500, 40);
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.font = '16px monospace';

                let hint = "Move with WASD/Arrows or Touch.";
                if (this.player && this.player.tailLength === 0 && this.resources.length > 0) {
                    hint = "Collect Ectoplasm to grow your tether.";
                } else if (this.player && this.player.tailLength > 0 && !this.enemies.length) {
                    hint = "Return to the Base Camp to bank points!";
                } else if (this.enemies.length > 0 && this.player && this.player.dashCooldown <= 0) {
                    hint = "Press SPACE or click/tap to dash through enemies.";
                }

                this.ctx.fillText(hint, this.width / 2, 35);
                this.ctx.textAlign = 'left'; // reset
            }

            if (this.activeBoss) {
                this.activeBoss.drawBossUI(this.ctx, this.width, this.height);
            }
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = ACCENT_COLOR;
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('HAUNTED TETHER DRILL', this.width / 2, this.height / 2 - 40);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Click or Press Space to Start', this.width / 2, this.height / 2 + 20);
            this.ctx.font = '16px monospace';
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width / 2, this.height / 2 + 60);

            const cardWidth = 200;
            const cardHeight = 300;
            const spacing = 40;
            const startX = this.width / 2 - (cardWidth * 1.5 + spacing);
            const startY = this.height / 2 - cardHeight / 2;

            for(let i=0; i<3; i++) {
                const cx = startX + i * (cardWidth + spacing);
                this.ctx.fillStyle = '#222';
                this.ctx.fillRect(cx, startY, cardWidth, cardHeight);
                this.ctx.strokeStyle = ACCENT_COLOR;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(cx, startY, cardWidth, cardHeight);

                if (this.currentUpgrades[i]) {
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '20px monospace';
                    this.ctx.fillText(this.currentUpgrades[i].name, cx + cardWidth/2, startY + 50);

                    this.ctx.font = '14px monospace';
                    this.ctx.fillStyle = '#aaa';
                    const words = this.currentUpgrades[i].desc.split(' ');
                    let line = '';
                    let y = startY + 100;
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = this.ctx.measureText(testLine);
                        if (metrics.width > cardWidth - 20 && n > 0) {
                            this.ctx.fillText(line, cx + cardWidth/2, y);
                            line = words[n] + ' ';
                            y += 20;
                        } else {
                            line = testLine;
                        }
                    }
                    this.ctx.fillText(line, cx + cardWidth/2, y);
                }
            }
        } else if (this.state === 'PAUSED') {
            if (this.inputManager.isDown('Space') || this.inputManager.isDown('Escape') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.state = 'PLAYING';
                this.inputManager.keys['Space'] = false;
                this.inputManager.keys['Escape'] = false;
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.inputManager.isDown('Space') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.state = 'TITLE';
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        }

    }

    draw() {
        this.ctx.save();
        if (this.vfxManager && this.vfxManager.shakeTimer > 0) {
            this.ctx.translate(this.vfxManager.shakeX, this.vfxManager.shakeY);
        }
        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.parallax.draw(this.ctx, this.width, this.height);
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            this.hazards.forEach(h => {
                if (h.active) h.draw(this.ctx);
            });

            if (this.baseCamp) {
                this.baseCamp.draw(this.ctx);
            }
            this.resources.forEach(r => r.draw(this.ctx));

            if (this.pickups) this.pickups.forEach(p => p.draw(this.ctx));
            if (this.state !== 'GAME_OVER') {
                if (this.player) {
                    this.player.draw(this.ctx);
                }
            }

            this.enemies.forEach(e => e.draw(this.ctx));

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 10, 30);

            this.ctx.fillText(`Wave: ${this.wave}`, 10, 50);
            this.ctx.fillText(`Combo: x${this.multiplier}`, this.width - 150, 30);
            if (this.comboTimer > 0) {
                this.ctx.fillStyle = '#e74c3c';
                this.ctx.fillRect(this.width - 150, 40, 140 * (this.comboTimer / this.comboMaxTimer), 10);
            }
            this.ctx.fillStyle = '#fff';

            const currentTail = this.player ? this.player.tailLength : 0;
            const maxTail = this.player ? this.player.maxTailLength : 50;
            this.ctx.fillText(`Tail: ${currentTail}/${maxTail}`, 10, 80);

            if (this.player) {
                this.ctx.fillText(`Dash: ${this.player.dashCooldown <= 0 ? 'READY' : this.player.dashCooldown.toFixed(1)}s`, 10, 110);

                // Dash cooldown bar
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(10, 120, 100, 10);
                this.ctx.fillStyle = this.player.dashCooldown <= 0 ? '#65bb98' : '#e74c3c';
                const fillRatio = this.player.dashCooldown <= 0 ? 1 : 1 - (this.player.dashCooldown / this.player.dashCooldownMax);
                this.ctx.fillRect(10, 120, 100 * fillRatio, 10);
            }

            if (this.activeBoss) {
                this.activeBoss.drawBossUI(this.ctx, this.width, this.height);
            }
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = ACCENT_COLOR;
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('HAUNTED TETHER DRILL', this.width / 2, this.height / 2 - 40);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Click or Press Space to Start', this.width / 2, this.height / 2 + 20);
            this.ctx.font = '16px monospace';
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width / 2, this.height / 2 + 60);
        } else if (this.state === 'UPGRADE') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = ACCENT_COLOR;
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('WAVE CLEAR! SELECT UPGRADE', this.width / 2, this.height / 2 - 200);

            const cardWidth = 200;
            const cardHeight = 300;
            const spacing = 40;
            const startX = this.width / 2 - (cardWidth * 1.5 + spacing);
            const startY = this.height / 2 - cardHeight / 2;

            for(let i=0; i<3; i++) {
                const cx = startX + i * (cardWidth + spacing);
                this.ctx.fillStyle = '#222';
                this.ctx.fillRect(cx, startY, cardWidth, cardHeight);
                this.ctx.strokeStyle = ACCENT_COLOR;
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(cx, startY, cardWidth, cardHeight);

                if (this.currentUpgrades[i]) {
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '20px monospace';
                    this.ctx.fillText(this.currentUpgrades[i].name, cx + cardWidth/2, startY + 50);

                    this.ctx.font = '14px monospace';
                    this.ctx.fillStyle = '#aaa';
                    const words = this.currentUpgrades[i].desc.split(' ');
                    let line = '';
                    let y = startY + 100;
                    for (let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = this.ctx.measureText(testLine);
                        if (metrics.width > cardWidth - 20 && n > 0) {
                            this.ctx.fillText(line, cx + cardWidth/2, y);
                            line = words[n] + ' ';
                            y += 20;
                        } else {
                            line = testLine;
                        }
                    }
                    this.ctx.fillText(line, cx + cardWidth/2, y);
                }
            }
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 40);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2);
            this.ctx.fillText('Click or Press Space to Restart', this.width / 2, this.height / 2 + 40);
        }

        if (this.vfxManager && this.state !== 'TITLE') {
            this.vfxManager.draw(this.ctx);
        }

        this.ctx.restore();
    }

    loop(timestamp) {
        const now = timestamp || performance.now();
        this.dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        if (this.uiManager) this.uiManager.updateTouchControls();

        if (this.state === 'OPTIONS') {
            if (this.uiManager) this.uiManager.update(this.dt);
        } else if (this.vfxManager && this.vfxManager.hitStopTimer > 0) {
            this.vfxManager.update(this.dt);
            // Hit stop freezes game logic, not menu input.
            if (this.uiManager) this.uiManager.update(this.dt);
        } else {
            if (this.vfxManager) this.vfxManager.update(this.dt);
            this.update(this.dt);
            if (this.uiManager) this.uiManager.update(this.dt);
        }
        // All game and UI consumers see the same input edge before it expires.
        if (this.inputManager) this.inputManager.update();

        this.draw();
        if (this.uiManager) this.uiManager.draw(this.ctx);

        requestAnimationFrame(this.loop);
    }
}


class VFXManager {
    constructor(game) {
        this.game = game;
        this.particles = [];
        this.floatingTexts = [];
        this.trails = [];
        this.shakeX = 0;
        this.shakeY = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.hitStopTimer = 0;
    }

    update(dt) {
        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let t = this.floatingTexts[i];
            t.y += t.vy * dt;
            t.life -= dt;
            if (t.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
        for (let i = this.trails.length - 1; i >= 0; i--) {
            let tr = this.trails[i];
            tr.life -= dt;
            if (tr.life <= 0) {
                this.trails.splice(i, 1);
            }
        }
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
            let intensity = this.shakeIntensity * (this.game.saveManager.data.options.screenShake / 100);
            this.shakeX = (Math.random() - 0.5) * intensity;
            this.shakeY = (Math.random() - 0.5) * intensity;
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
        }
    }

    draw(ctx) {
        for (let tr of this.trails) {
            ctx.fillStyle = tr.color;
            ctx.globalAlpha = tr.life / tr.maxLife;
            ctx.beginPath();
            ctx.arc(tr.x, tr.y, tr.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (let p of this.particles) {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        for (let t of this.floatingTexts) {
            ctx.fillStyle = t.color;
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
            ctx.fillText(t.text, t.x, t.y);
        }
        ctx.globalAlpha = 1;
    }

    spawnHitParticles(x, y, dx, dy, color = '#fff') {

        const count = this.game.saveManager.data.options.particles === 'High' ? 15 : 5;
        for (let i = 0; i < count; i++) {
            let angle = Math.atan2(dy, dx) + (Math.random() - 0.5);
            let speed = 50 + Math.random() * 100;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.2 + Math.random() * 0.3,
                color: color,
                size: 2 + Math.random() * 2
            });
        }
    }

    spawnExplosion(x, y, color = '#ff0') {

        const count = this.game.saveManager.data.options.particles === 'High' ? 30 : 10;
        for (let i = 0; i < count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = 50 + Math.random() * 150;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.3 + Math.random() * 0.5,
                color: color,
                size: 3 + Math.random() * 3
            });
        }
    }

    spawnText(x, y, text, color = '#fff') {
        this.floatingTexts.push({
            x: x, y: y, text: text, color: color,
            vy: -30, life: 1, maxLife: 1
        });
    }

    spawnTrail(x, y, radius, color) {
        this.trails.push({
            x: x, y: y, radius: radius, color: color,
            life: 0.2, maxLife: 0.2
        });
    }

    addShake(intensity, duration = 0.2) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    triggerHitStop(duration) {
        if (this.hitStopTimer < duration) {
            this.hitStopTimer = duration;
        }
    }

    spawnExplosionCluster(x, y, color) {
        // Generates a cluster of explosions to add more impact
        const count = 3;
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 40;
            const offsetY = (Math.random() - 0.5) * 40;
            this.spawnExplosion(x + offsetX, y + offsetY, color);
        }
    }

    spawnSparkles(x, y, color) {
        // Generates small sparkles for magical effects
        const count = this.game.saveManager.data.options.particles === 'High' ? 15 : 5;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 20 + Math.random() * 40;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.3,
                color: color,
                size: 1 + Math.random() * 2
            });
        }
    }

    spawnWarningRing(x, y, radius, color) {
        // Spawns a hollow ring to warn of incoming attacks
        this.trails.push({
            x: x, y: y, radius: radius, color: color,
            life: 0.5, maxLife: 0.5, hollow: true
        });
    }

    updateAmbientVFX(dt) {
        // Could be called in update to add ambient floating dust
        if (Math.random() < 0.05 && this.game.saveManager.data.options.particles === 'High') {
            this.particles.push({
                x: Math.random() * this.game.width,
                y: Math.random() * this.game.height,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 2.0 + Math.random(),
                color: 'rgba(255, 255, 255, 0.3)',
                size: 1 + Math.random()
            });
        }
    }

}


window.onload = () => {
    window.game = new Game();
};

class UIManager {
    constructor(game) {
        this.game = game;
        this.fps = 0;
        this.frameCount = 0;
        this.lastFpsTime = 0;

        this.optionsMenu = {
            selectedIdx: 0,
            items: [
                { label: 'Master Mute', key: 'mute', type: 'toggle' },
                { label: 'SFX Volume', key: 'sfxVolume', type: 'slider', min: 0, max: 100, step: 10 },
                { label: 'Music Volume', key: 'musicVolume', type: 'slider', min: 0, max: 100, step: 10 },
                { label: 'Screen Shake', key: 'screenShake', type: 'choice', choices: [100, 50, 0] },
                { label: 'Particles', key: 'particles', type: 'choice', choices: ['High', 'Low'] },
                { label: 'High Contrast', key: 'highContrast', type: 'toggle' },
                { label: 'FPS Counter', key: 'fpsCounter', type: 'toggle' },
                { label: 'Touch Controls', key: 'touchControls', type: 'choice', choices: ['Auto', 'Always', 'Off'] },
                { label: 'Touch Hand', key: 'touchHandedness', type: 'choice', choices: ['Right', 'Left'] },
                { label: 'Export Save', type: 'action', action: 'export' },
                { label: 'Import Save', type: 'action', action: 'import' },
                { label: 'Reset Save', type: 'action', action: 'reset' },
                { label: 'Back', type: 'action', action: 'back' }
            ],
            resetState: 0
        };

        this.milestones = [
            { id: 'first_dig', label: 'First Dig', desc: 'Play 1 game', req: (s) => s.totalGamesPlayed >= 1 },
            { id: 'score_master', label: 'Score Master', desc: 'Score 5000 in one run', req: (s) => s.bestRunScore >= 5000 },
            { id: 'combo_king', label: 'Combo King', desc: 'Reach 10x combo', req: (s) => s.bestCombo >= 10 },
            { id: 'deep_diver', label: 'Deep Diver', desc: 'Reach Wave 5', req: (s) => s.highestWave >= 5 },
            { id: 'tail_growth', label: 'Tail Growth', desc: 'Max tail length', req: (s) => s.maxTailReached >= 50 },
            { id: 'boss_slayer', label: 'Boss Slayer', desc: 'Defeat a boss', req: (s) => s.bossesDefeated >= 1 }
        ];
    }

    checkMilestones() {
        const stats = this.game.saveManager.data;
        let unlockedAny = false;
        if (!stats.unlockedMilestones) stats.unlockedMilestones = [];

        for (let m of this.milestones) {
            if (!stats.unlockedMilestones.includes(m.id) && m.req(stats)) {
                stats.unlockedMilestones.push(m.id);
                unlockedAny = true;
            }
        }
        if (unlockedAny) this.game.saveManager.save();
    }

    update(dt) {
        if (this.game.wave > this.game.saveManager.data.highestWave) {
            this.game.saveManager.data.highestWave = this.game.wave;
        }
        if (this.game.player && this.game.player.tailLength > this.game.saveManager.data.maxTailReached) {
            this.game.saveManager.data.maxTailReached = this.game.player.tailLength;
        }
        if (this.game.multiplier > this.game.saveManager.data.bestCombo) {
            this.game.saveManager.data.bestCombo = this.game.multiplier;
        }

        this.checkMilestones();
        if (this.game.state === 'OPTIONS') {
            this.updateOptionsMenu();
        } else if (this.game.state === 'TITLE' || this.game.state === 'PAUSED') {
            if (this.game.inputManager.justPressed('KeyO')) {
                this.game.previousState = this.game.state;
                this.game.state = 'OPTIONS';
            }
        }

        // FPS Counter
        this.frameCount++;
        if (performance.now() - this.lastFpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = performance.now();
        }
    }

    updateOptionsMenu() {
        const input = this.game.inputManager;

        if (input.justPressed('ArrowUp') || input.justPressed('KeyW')) {
            this.optionsMenu.selectedIdx = (this.optionsMenu.selectedIdx - 1 + this.optionsMenu.items.length) % this.optionsMenu.items.length;
            this.optionsMenu.resetState = 0;
            if (this.game.soundEngine) this.game.soundEngine.playMenuHover();
        }
        if (input.justPressed('ArrowDown') || input.justPressed('KeyS')) {
            this.optionsMenu.selectedIdx = (this.optionsMenu.selectedIdx + 1) % this.optionsMenu.items.length;
            this.optionsMenu.resetState = 0;
            if (this.game.soundEngine) this.game.soundEngine.playMenuHover();
        }

        const item = this.optionsMenu.items[this.optionsMenu.selectedIdx];
        const data = this.game.saveManager.data.options;

        if (input.justPressed('ArrowLeft') || input.justPressed('KeyA')) {
            this.adjustOption(item, data, -1);
        }
        if (input.justPressed('ArrowRight') || input.justPressed('KeyD')) {
            this.adjustOption(item, data, 1);
        }
        if (input.justPressed('Enter') || input.justPressed('Space')) {
            this.activateOption(item, data);
        }
    }

    adjustOption(item, data, dir) {
        if (item.type === 'slider') {
            data[item.key] = Math.max(item.min, Math.min(item.max, data[item.key] + dir * item.step));
            this.game.saveManager.save();
            if (this.game.soundEngine) this.game.soundEngine.playMenuClick();
        } else if (item.type === 'choice') {
            let idx = item.choices.indexOf(data[item.key]);
            idx = (idx + dir + item.choices.length) % item.choices.length;
            data[item.key] = item.choices[idx];
            this.game.saveManager.save();
            if (this.game.soundEngine) this.game.soundEngine.playMenuClick();
        }
    }

    activateOption(item, data) {
        if (item.type === 'toggle') {
            data[item.key] = !data[item.key];
            this.game.saveManager.save();
            if (this.game.soundEngine) this.game.soundEngine.playMenuClick();
        } else if (item.type === 'action') {
            if (item.action === 'back') {
                this.game.state = this.game.previousState || 'TITLE';
                this.optionsMenu.resetState = 0;
                if (this.game.soundEngine) this.game.soundEngine.playMenuClick();
            } else if (item.action === 'export') {
                const saveString = btoa(JSON.stringify(this.game.saveManager.data));
                prompt("Copy your save data:", saveString);
            } else if (item.action === 'import') {
                const inputStr = prompt("Paste your save data:");
                if (inputStr) {
                    const result = this.game.saveManager.importData(inputStr);
                    alert(result.message);
                }
            } else if (item.action === 'reset') {
                if (this.optionsMenu.resetState === 0) {
                    this.optionsMenu.resetState = 1;
                } else {
                    localStorage.removeItem('arcade_game_083_083-haunted-tether-drill_v1');
                    window.location.reload();
                }
            }
        }
    }

    draw(ctx) {
        const data = this.game.saveManager.data.options;

        if (this.game.state === 'OPTIONS') {
            ctx.fillStyle = 'rgba(0,0,0,0.9)';
            ctx.fillRect(0, 0, this.game.width, this.game.height);
            ctx.fillStyle = '#fff';
            ctx.font = '30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('OPTIONS', this.game.width / 2, 50);

            ctx.font = '20px monospace';
            const startY = 120;
            const spacing = 35;

            for (let i = 0; i < this.optionsMenu.items.length; i++) {
                const item = this.optionsMenu.items[i];
                let text = item.label;

                if (item.type === 'toggle') {
                    text += ': ' + (data[item.key] ? 'ON' : 'OFF');
                } else if (item.type === 'slider' || item.type === 'choice') {
                    text += ': < ' + data[item.key] + ' >';
                } else if (item.action === 'reset') {
                    text = this.optionsMenu.resetState === 1 ? 'Are you sure? (Press again)' : item.label;
                }

                ctx.fillStyle = i === this.optionsMenu.selectedIdx ? ACCENT_COLOR : '#aaa';
                ctx.fillText(text, this.game.width / 2, startY + i * spacing);
            }
        }

        if (data.fpsCounter) {
            ctx.fillStyle = '#0f0';
            ctx.font = '16px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('FPS: ' + this.fps, this.game.width - 10, 20);
        }

        const isTouchActive = data.touchControls === 'Always' || (data.touchControls === 'Auto' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

        if (isTouchActive && this.game.state === 'PLAYING') {
            this.drawTouchControls(ctx, data.touchHandedness);
        }

        if (this.game.state === 'TITLE' || this.game.state === 'PAUSED') {
            ctx.fillStyle = '#fff';
            ctx.font = '24px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('⚙️ [O]ptions', this.game.width - 20, this.game.height - 20);


        }

        if (this.game.state === 'TITLE' || this.game.state === 'GAME_OVER') {
            this.drawMilestones(ctx, 20, this.game.height - 150);
        }

        if (data.highContrast) {
            this.game.canvas.style.filter = 'contrast(1.5) saturate(1.5) hue-rotate(45deg)';
        } else {
            this.game.canvas.style.filter = 'none';
        }
    }


    updateTouchControls() {
        const input = this.game.inputManager;
        const data = this.game.saveManager.data.options;
        const isTouchActive = data.touchControls === 'Always' || (data.touchControls === 'Auto' && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

        // Touch never writes physical keys; release or disabling controls clears only this layer.
        input.virtualKeys = {};
        if (!isTouchActive || this.game.state !== 'PLAYING') return;

        const hand = data.touchHandedness;
        const padX = hand === 'Right' ? 100 : this.game.width - 100;
        const padY = this.game.height - 100;
        const dashX = hand === 'Right' ? this.game.width - 100 : 100;
        const dashY = this.game.height - 100;

        if (input.touch.active) {
            const tx = input.mouse.x;
            const ty = input.mouse.y;

            const distDash = Math.hypot(tx - dashX, ty - dashY);
            if (distDash < 60) {
                input.virtualKeys['Space'] = true;
            }

            const distPad = Math.hypot(tx - padX, ty - padY);
            if (distPad < 100) {
                const angle = Math.atan2(ty - padY, tx - padX);
                if (angle > -Math.PI*5/8 && angle < -Math.PI*3/8) input.virtualKeys['ArrowUp'] = true;
                if (angle > Math.PI*3/8 && angle < Math.PI*5/8) input.virtualKeys['ArrowDown'] = true;
                if (angle > Math.PI*7/8 || angle < -Math.PI*7/8) input.virtualKeys['ArrowLeft'] = true;
                if (angle > -Math.PI/8 && angle < Math.PI/8) input.virtualKeys['ArrowRight'] = true;

                if (angle >= -Math.PI*7/8 && angle <= -Math.PI*5/8) { input.virtualKeys['ArrowLeft'] = true; input.virtualKeys['ArrowUp'] = true; }
                if (angle >= -Math.PI*3/8 && angle <= -Math.PI/8) { input.virtualKeys['ArrowRight'] = true; input.virtualKeys['ArrowUp'] = true; }
                if (angle >= Math.PI/8 && angle <= Math.PI*3/8) { input.virtualKeys['ArrowRight'] = true; input.virtualKeys['ArrowDown'] = true; }
                if (angle >= Math.PI*5/8 && angle <= Math.PI*7/8) { input.virtualKeys['ArrowLeft'] = true; input.virtualKeys['ArrowDown'] = true; }
            }
        }
    }

    drawTouchControls(ctx, hand) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;

        const padX = hand === 'Right' ? 100 : this.game.width - 100;
        const padY = this.game.height - 100;
        const dashX = hand === 'Right' ? this.game.width - 100 : 100;
        const dashY = this.game.height - 100;

        ctx.beginPath();
        ctx.arc(padX, padY, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(dashX, dashY, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DASH', dashX, dashY);

        ctx.restore();
    }

    drawMilestones(ctx, x, y) {
        ctx.save();
        ctx.textAlign = 'left';
        ctx.font = '14px monospace';
        const stats = this.game.saveManager.data;
        let count = 0;
        ctx.fillStyle = '#fff';
        ctx.fillText('MILESTONES', x, y - 20);
        for (let m of this.milestones) {
            const unlocked = stats.unlockedMilestones && stats.unlockedMilestones.includes(m.id);
            ctx.fillStyle = unlocked ? ACCENT_COLOR : '#555';
            ctx.fillText('[' + (unlocked ? 'X' : ' ') + '] ' + m.label, x, y + count * 20);
            count++;
        }
        ctx.restore();
    }
}
