const SAVE_KEY = 'arcade_game_074_074-magnetic-sky-duel_v1';
const ACCENT_COLOR = '#7751ef';

class MathUtils {
    static clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
    static rand(min, max) { return Math.random() * (max - min) + min; }
    static randInt(min, max) { return Math.floor(this.rand(min, max + 1)); }
    static distSq(x1, y1, x2, y2) { return (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1); }
    static lerp(a, b, t) { return a + (b - a) * t; }
}

class Vector2 {
    constructor(x=0, y=0) { this.x = x; this.y = y; }
    set(x, y) { this.x = x; this.y = y; return this; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(s) { this.x *= s; this.y *= s; return this; }
    magSq() { return this.x*this.x + this.y*this.y; }
    mag() { return Math.sqrt(this.magSq()); }
    normalize() { let m = this.mag(); if(m > 0) { this.x /= m; this.y /= m; } return this; }
    clone() { return new Vector2(this.x, this.y); }
}

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { sfxVolume: 1, musicVolume: 1 }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                if (parsed.options) {
                    this.data.options = { ...this.data.options, ...parsed.options };
                }
            }
        } catch (e) {
            console.error("SaveManager load error", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("SaveManager save error", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // BGM State
        this.bgmPlaying = false;
        this.nextNoteTime = 0;
        this.tempo = 120;
        this.noteIndex = 0;
        this.bassIndex = 0;
        this.isBossWave = false;
        this.isLowHp = false;

        // BGM Nodes
        this.bgmFilter = null;
        this.arpeggioNodes = [];
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

        // BGM filter
        this.bgmFilter = this.ctx.createBiquadFilter();
        this.bgmFilter.type = 'lowpass';
        this.bgmFilter.frequency.value = 1000;
        this.bgmFilter.connect(this.musicGain);

        this.musicGain.gain.value = 0.3;
        this.sfxGain.gain.value = 0.5;

        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startBGM() {
        if (!this.initialized || !this.ctx) return;
        this.resume();
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
    }

    stopBGM() {
        this.bgmPlaying = false;
    }

    setBGMState(isBossWave, isLowHp) {
        this.isBossWave = isBossWave;
        this.isLowHp = isLowHp;

        if (this.isBossWave) {
            this.tempo = 160;
        } else {
            this.tempo = 120;
        }

        if (this.initialized && this.ctx && this.bgmFilter) {
            if (this.isLowHp) {
                this.bgmFilter.frequency.setTargetAtTime(300, this.ctx.currentTime, 0.5);
                this.bgmFilter.Q.setTargetAtTime(5, this.ctx.currentTime, 0.5);
            } else if (this.isBossWave) {
                this.bgmFilter.frequency.setTargetAtTime(2000, this.ctx.currentTime, 0.5);
                this.bgmFilter.Q.setTargetAtTime(1, this.ctx.currentTime, 0.5);
            } else {
                this.bgmFilter.frequency.setTargetAtTime(1000, this.ctx.currentTime, 0.5);
                this.bgmFilter.Q.setTargetAtTime(1, this.ctx.currentTime, 0.5);
            }
        }
    }

    updateBGM(dt) {
        if (!this.bgmPlaying || !this.initialized || !this.ctx) return;

        const lookahead = 0.1;
        const scheduleAheadTime = 0.1;

        while (this.nextNoteTime < this.ctx.currentTime + scheduleAheadTime) {
            this.scheduleNote(this.nextNoteTime);
            this.nextNote();
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        // 16th notes
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.noteIndex = (this.noteIndex + 1) % 16;
        this.bassIndex = (this.bassIndex + 1) % 32;
    }

    scheduleNote(time) {
        // Percussion
        if (this.noteIndex % 4 === 0) {
            this.playKick(time);
        } else if (this.noteIndex % 4 === 2) {
            this.playSnare(time);
        }
        if (this.noteIndex % 2 === 0) {
            this.playHiHat(time);
        }

        // Bassline
        const bassNotesNormal = [32.7, 0, 32.7, 0, 38.9, 0, 38.9, 0, 43.65, 0, 43.65, 0, 38.9, 0, 32.7, 0];
        const bassNotesBoss = [41.2, 41.2, 0, 41.2, 49.0, 49.0, 0, 49.0, 36.7, 36.7, 0, 36.7, 49.0, 0, 41.2, 0];
        const bassNotes = this.isBossWave ? bassNotesBoss : bassNotesNormal;

        const bFreq = bassNotes[this.bassIndex % 16];
        if (bFreq > 0) {
            this.playSynthNote(time, bFreq, 'sawtooth', 0.15, 0.2);
        }

        // Arpeggiator
        const arpNormal = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63, 261.63, 329.63];
        const arpBoss = [329.63, 392.00, 493.88, 659.25, 493.88, 392.00, 329.63, 293.66];
        const arpNotes = this.isBossWave ? arpBoss : arpNormal;

        if (this.noteIndex % 2 === 0) {
            const freq = arpNotes[(this.noteIndex / 2) % 8];
            this.playSynthNote(time, freq, 'square', 0.1, 0.05);
        }
    }

    playSynthNote(time, freq, type, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.bgmFilter);

        osc.start(time);
        osc.stop(time + duration);
        setTimeout(() => {
            osc.disconnect();
            gain.disconnect();
        }, (time + duration - this.ctx.currentTime) * 1000 + 100);
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.connect(gain);
        gain.connect(this.bgmFilter);
        osc.start(time);
        osc.stop(time + 0.1);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, (time + 0.1 - this.ctx.currentTime) * 1000 + 100);
    }

    playSnare(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time);
        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        // noise
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        noise.connect(noiseFilter);
        noiseFilter.connect(gain);

        osc.connect(gain);
        gain.connect(this.bgmFilter);

        osc.start(time);
        noise.start(time);
        osc.stop(time + 0.1);
        setTimeout(() => { osc.disconnect(); noise.disconnect(); noiseFilter.disconnect(); gain.disconnect(); }, (time + 0.1 - this.ctx.currentTime) * 1000 + 100);
    }

    playHiHat(time) {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 10000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(gain);
        gain.connect(this.bgmFilter);

        noise.start(time);
        setTimeout(() => { noise.disconnect(); noiseFilter.disconnect(); gain.disconnect(); }, (time + 0.05 - this.ctx.currentTime) * 1000 + 100);
    }

    playTone(freq, type, duration, vol=0.1) {
        if (!this.initialized || !this.ctx) return;
        this.resume();
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

        setTimeout(() => {
            osc.disconnect();
            gain.disconnect();
        }, duration * 1000 + 100);
    }

    // SFX (10+ distinct SFX)
    playShoot(isRed) {
        this.playTone(isRed ? 600 : 400, 'square', 0.1, 0.05);
    }
    playHit() {
        this.playTone(150, 'sawtooth', 0.2, 0.1);
    }
    playExplosion() {
        // complex explosion
        if (!this.initialized || !this.ctx) return;
        this.resume();
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 0.5);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, 600);
    }
    playSwitch() {
        this.playTone(800, 'sine', 0.1, 0.05);
    }
    playPowerup() {
        if (!this.initialized || !this.ctx) return;
        this.resume();
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, time);
        osc.frequency.linearRampToValueAtTime(800, time + 0.1);
        osc.frequency.linearRampToValueAtTime(1200, time + 0.2);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 0.3);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, 400);
    }
    playUIClick() {
        this.playTone(1000, 'sine', 0.05, 0.1);
    }
    playUIHover() {
        this.playTone(1200, 'sine', 0.03, 0.05);
    }
    playDash() {
        if (!this.initialized || !this.ctx) return;
        this.resume();
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(50, time + 0.2);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 0.2);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, 300);
    }
    playBossSpawn() {
        if (!this.initialized || !this.ctx) return;
        this.resume();
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, time);
        osc.frequency.linearRampToValueAtTime(100, time + 1.0);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.2, time + 0.5);
        gain.gain.linearRampToValueAtTime(0, time + 1.0);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 1.0);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, 1100);
    }
    playLevelUp() {
        if (!this.initialized || !this.ctx) return;
        this.resume();
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, time);
        osc.frequency.setValueAtTime(554.37, time + 0.1);
        osc.frequency.setValueAtTime(659.25, time + 0.2);
        osc.frequency.setValueAtTime(880, time + 0.3);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 0.5);
        setTimeout(() => { osc.disconnect(); gain.disconnect(); }, 600);
    }
    playEnemySpawn() {
        this.playTone(300, 'triangle', 0.1, 0.05);
    }
}
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.justPressed = {};
        this.pointers = {};
        this.touchMove = new Vector2();
        this.touchActive = false;

        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) this.justPressed[e.code] = true;
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        canvas.addEventListener('pointerdown', (e) => {
            this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            this.touchActive = true;
            this.touchMove.set(e.clientX, e.clientY);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (this.pointers[e.pointerId]) {
                this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
                this.touchMove.set(e.clientX, e.clientY);
            }
        });
        const handleUp = (e) => {
            delete this.pointers[e.pointerId];
            if (Object.keys(this.pointers).length === 0) {
                this.touchActive = false;
            }
        };
        canvas.addEventListener('pointerup', handleUp);
        canvas.addEventListener('pointercancel', handleUp);
    }
    update() {
        this.justPressed = {};
    }
    isDown(code) { return !!this.keys[code]; }
    isJustPressed(code) { return !!this.justPressed[code]; }
}

class Entity {
    constructor(x, y, r) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2();
        this.radius = r;
        this.active = true;
        this.polarity = 1; // 1 for Red, -1 for Blue
    }
    update(dt) {
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff';
        ctx.fill();
    }
}

class Particle extends Entity {
    constructor(x, y, polarity, speed, life, dirAngle = null, spread = null) {
        super(x, y, MathUtils.rand(2, 4));
        this.polarity = polarity;
        let angle = MathUtils.rand(0, Math.PI * 2);
        if (dirAngle !== null && spread !== null) {
            angle = dirAngle + MathUtils.rand(-spread/2, spread/2);
        }
        this.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        super.draw(ctx);
        ctx.globalAlpha = 1;
    }
}

class Bullet extends Entity {
    constructor(x, y, vx, vy, polarity, isEnemy) {
        super(x, y, 4);
        this.vel.set(vx, vy);
        this.polarity = polarity;
        this.isEnemy = isEnemy;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 10);
        this.speed = 300;
        this.shootTimer = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.polarity = 1;
        this.energy = 0;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.invulnTimer = 0;
        this.recoil = 0;
        this.thrustLevel = 0;
        this.aimAngle = -Math.PI / 2;
    }
    update(dt, game) {
        let dx = 0;
        let dy = 0;

        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashTimer > 0) this.dashTimer -= dt;
        this.recoil = Math.max(0, this.recoil - dt * 20);

        if (game.ui && game.ui.dpadActive) {
            dx = game.ui.dpadVector.x;
            dy = game.ui.dpadVector.y;
        }
        if (game.input.isDown('KeyW') || game.input.isDown('ArrowUp')) dy -= 1;
        if (game.input.isDown('KeyS') || game.input.isDown('ArrowDown')) dy += 1;
        if (game.input.isDown('KeyA') || game.input.isDown('ArrowLeft')) dx -= 1;
        if (game.input.isDown('KeyD') || game.input.isDown('ArrowRight')) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const mag = Math.sqrt(dx*dx + dy*dy);
            const accel = 1500;
            this.vel.x += (dx/mag) * accel * dt;
            this.vel.y += (dy/mag) * accel * dt;
            this.thrustLevel = GameMathExtras.lerp(this.thrustLevel, 1, dt * 10);
            this.aimAngle = Math.atan2(dy, dx);
        } else {
            this.thrustLevel = GameMathExtras.lerp(this.thrustLevel, 0, dt * 10);
        }

        if (game.input.touchActive && !(game.ui && (game.ui.dpadActive || game.ui.shootActive || game.ui.switchActive))) {
            const tx = game.input.touchMove.x;
            const ty = game.input.touchMove.y;
            const canvasRect = game.canvas.getBoundingClientRect();
            const relX = (tx - canvasRect.left) * (game.canvas.width / canvasRect.width);
            const relY = (ty - canvasRect.top) * (game.canvas.height / canvasRect.height);

            const dist = Math.sqrt((relX - this.pos.x)**2 + (relY - this.pos.y)**2);
            if (dist > 10) {
                const accel = 1500;
                const ndx = (relX - this.pos.x)/dist;
                const ndy = (relY - this.pos.y)/dist;
                this.vel.x += ndx * accel * dt;
                this.vel.y += ndy * accel * dt;
                this.thrustLevel = GameMathExtras.lerp(this.thrustLevel, 1, dt * 10);
                this.aimAngle = Math.atan2(ndy, ndx);
            }
        }

        const friction = 0.92;
        this.vel.x *= friction;
        this.vel.y *= friction;

        const speedSq = this.vel.x*this.vel.x + this.vel.y*this.vel.y;
        if (this.dashTimer <= 0 && speedSq > this.speed * this.speed) {
            const mult = this.speed / Math.sqrt(speedSq);
            this.vel.x *= mult;
            this.vel.y *= mult;
        }

        if (this.thrustLevel > 0.1 && Math.random() < 0.3) {
            game.spawnDirectionalParticles(this.pos.x, this.pos.y, this.polarity, 1, this.aimAngle + Math.PI, Math.PI/4, 150);
        }
        if (this.dashTimer > 0) {
            game.vfx.addTrail(this.pos.x, this.pos.y, this.radius, this.polarity, 0.2);
        }

        if (game.input.isJustPressed('KeyF') && this.dashCooldown <= 0) {
            this.dashTimer = 0.2;
            this.dashCooldown = 1.5;
            this.invulnTimer = Math.max(this.invulnTimer, 0.3);
            const dSpd = 800;
            this.vel.x = Math.cos(this.aimAngle) * dSpd;
            this.vel.y = Math.sin(this.aimAngle) * dSpd;
            game.sound.playDash();
            game.spawnParticles(this.pos.x, this.pos.y, this.polarity, 15);
        }

        super.update(dt);

        this.pos.x = MathUtils.clamp(this.pos.x, this.radius, game.width - this.radius);
        this.pos.y = MathUtils.clamp(this.pos.y, this.radius, game.height - this.radius);

        if (game.input.isJustPressed('ShiftLeft') || game.input.isJustPressed('ShiftRight') || game.input.isJustPressed('KeyE') || (game.ui && game.ui.switchJustPressed)) {
            if (game.ui) game.ui.switchJustPressed = false;
            this.polarity *= -1;
            game.sound.playSwitch();
        }

        this.shootTimer -= dt;
        let isShooting = game.input.isDown('Space') || (game.ui && game.ui.shootActive);
        if (game.input.touchActive && !(game.ui && (game.ui.dpadActive || game.ui.shootActive || game.ui.switchActive))) isShooting = true;
        if (isShooting && this.shootTimer <= 0) {
            let fireDelay = 0.15;
            if (game.progression) fireDelay *= game.progression.perks.fireRateMult;
            this.shootTimer = fireDelay;
            this.recoil = 5;
            const bvx = Math.cos(this.aimAngle) * 600;
            const bvy = Math.sin(this.aimAngle) * 600;
            if (game.input.touchActive && !(game.ui && (game.ui.dpadActive || game.ui.shootActive || game.ui.switchActive))) {
                game.spawnBullet(this.pos.x, this.pos.y - 15, 0, -600, this.polarity, false);
            } else {
                game.spawnBullet(this.pos.x + Math.cos(this.aimAngle)*15, this.pos.y + Math.sin(this.aimAngle)*15, bvx, bvy, this.polarity, false);
            }
            game.sound.playShoot(this.polarity === 1);
        }
    }
    draw(ctx) {
        if (this.invulnTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        const color = this.polarity === 1 ? '#ff3366' : '#33ccff';
        const ringColor = this.polarity === 1 ? 'rgba(255,51,102,0.5)' : 'rgba(51,204,255,0.5)';

        if (typeof VectorRenderer !== 'undefined') {
            VectorRenderer.drawAimTelegraph(ctx, 0, 0, this.aimAngle, 60, ringColor);
            VectorRenderer.drawRing(ctx, 0, 0, this.radius + 4 + Math.sin(Date.now()*0.01)*2, ringColor, 2);
            ctx.translate(-Math.cos(this.aimAngle)*this.recoil, -Math.sin(this.aimAngle)*this.recoil);
            if (this.thrustLevel > 0) {
                VectorRenderer.drawThrust(ctx, -Math.cos(this.aimAngle)*this.radius, -Math.sin(this.aimAngle)*this.radius, this.aimAngle + Math.PI, 12, 10 + this.thrustLevel * 15 + Math.random()*5, '#ffa500');
            }
        }

        ctx.rotate(this.aimAngle + Math.PI/2);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(0, this.radius - 4);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

// Boss classes moved to bosses.js

class Island {
    constructor(gameWidth, gameHeight) {
        this.pos = new Vector2(MathUtils.rand(0, gameWidth), MathUtils.rand(-gameHeight, gameHeight));
        this.size = MathUtils.rand(50, 150);
        this.speed = MathUtils.rand(20, 50);
    }
    update(dt, gameHeight) {
        this.pos.y += this.speed * dt;
        if (this.pos.y > gameHeight + this.size) {
            this.pos.y = -this.size;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.moveTo(-this.size/2, -this.size/4);
        ctx.lineTo(this.size/2, -this.size/4);
        ctx.lineTo(this.size/3, this.size/2);
        ctx.lineTo(-this.size/3, this.size/2);
        ctx.closePath();
        ctx.fillStyle = '#2a3b2a';
        ctx.fill();
        ctx.strokeStyle = '#3a4b3a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.input = new InputManager(canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        if (typeof ProgressionManager !== 'undefined') {
            this.progression = new ProgressionManager(this);
        }

        this.state = 'TITLE';
        this.lastTime = performance.now();

        this.player = null;
        this.boss = null;
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.islands = [];

        this.score = 0;
        this.wave = 1;
        this.vfx = new VFXManager(this);
        if (typeof UIManager !== 'undefined') {
            this.ui = new UIManager(this);
        }

        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.canvas.width = width;
                this.canvas.height = height;
                this.width = width;
                this.height = height;
            }
        });
        this.resizeObserver.observe(this.canvas);

        this.bindEvents();
        this.reset();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }
    bindEvents() {
        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        const initSound = () => {
            this.sound.init();
            window.removeEventListener('keydown', initSound);
            this.canvas.removeEventListener('pointerdown', initSound);
        };
        window.addEventListener('keydown', initSound);
        this.canvas.addEventListener('pointerdown', initSound);
    }
    reset() {
        this.player = new Player(this.width / 2, this.height * 0.8);
        this.boss = null;
        this.bossWarningTimer = 0;
        this.waveTimer = 0;
        this.enemies = [];
        this.bullets = [];
        this.particles = [];
        this.islands = [];
        for (let i = 0; i < 5; i++) {
            this.islands.push(new Island(this.width, this.height));
        }
        this.worldManager = new WorldManager(this.width, this.height);
        this.score = 0;
        this.wave = 1;
        if (this.progression) this.progression.reset();
    }
    spawnBullet(x, y, vx, vy, polarity, isEnemy) {
        this.bullets.push(new Bullet(x, y, vx, vy, polarity, isEnemy));
    }
    spawnParticles(x, y, colorCode, count) {
        if (this.vfx && this.vfx.particleMultiplier !== undefined) count = Math.floor(count * this.vfx.particleMultiplier);
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, colorCode, MathUtils.rand(50, 150), MathUtils.rand(0.2, 0.6)));
        }
    }
    spawnDirectionalParticles(x, y, colorCode, count, angle, spread, speedBase) {
        if (this.vfx && this.vfx.particleMultiplier !== undefined) count = Math.floor(count * this.vfx.particleMultiplier);
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, colorCode, MathUtils.rand(speedBase, speedBase*2), MathUtils.rand(0.2, 0.6), angle, spread));
        }
    }
    addScore(pts) {
        let mult = 1;
        if (this.progression && this.progression.comboManager) {
            mult = this.progression.comboManager.getMultiplier();
            this.progression.comboManager.addCombo(1);
        }
        let bonus = this.scoreMult || 1;
        this.score += Math.floor(pts * mult * bonus);
    }
    setState(newState) {
        this.state = newState;
    }
    update(dt) {
        if (this.state === 'TITLE') {
            if (this.ui) this.ui.drawMilestones(this.ctx);
            if (this.input.isJustPressed('Space') || this.input.touchActive) {
                this.reset();
                this.sound.startBGM();
                this.setState('PLAYING');
            }
            this.input.update();
            return;
        }

        if (this.state === 'PAUSED') {
            if (this.input.isJustPressed('Space') || this.input.touchActive) {
                this.setState('PLAYING');
            }
            this.input.update();
            return;
        }

        if (this.state === 'UPGRADE') {
            if (this.progression) {
                this.progression.update(dt);
            } else {
                this.setState('PLAYING');
            }
            this.input.update();
            return;
        }

        if (this.state === 'GAME_OVER') {
            if (this.ui) this.ui.drawMilestones(this.ctx);
            if (this.input.isJustPressed('Space') || this.input.touchActive) {
                this.setState('TITLE');
            }
            this.input.update();
            return;
        }

        if (this.input.isJustPressed('Escape')) {
            this.setState('PAUSED');
            this.input.update();
            return;
        }

        if (this.vfx.hitStopTimer > 0) {
            this.vfx.hitStopTimer -= dt;
            this.input.update();
            return;
        }
        this.sound.updateBGM(dt);
        if (this.ui) this.ui.update(dt);
        this.vfx.update(dt);

        this.islands.forEach(i => i.update(dt, this.height));
        if (this.worldManager) this.worldManager.update(dt, this);
        this.player.update(dt, this);
        if (this.progression) this.progression.updatePlaying(dt);

        if (!this.boss && this.bossWarningTimer <= 0) {
            this.waveTimer += dt;
            if (this.waveTimer >= 10) {
                this.waveTimer = 0;
                this.wave++;
                if (this.progression) this.progression.showDraft();
                if (this.wave % 5 === 0) {
                    this.bossWarningTimer = 3;
                    this.sound.playBossSpawn();
                }
            }
        }
        if (this.bossWarningTimer > 0) {
            this.bossWarningTimer -= dt;
            if (this.bossWarningTimer <= 0) {
                const bossTypes = [MagnetoBoss, PolarisBoss];
                const BossClass = bossTypes[((this.wave / 5) - 1) % bossTypes.length] || MagnetoBoss;
                this.boss = new BossClass(this.width/2, -100, this.wave, this);
            }
        }

        if (this.player) {
            this.sound.setBGMState(this.boss != null, this.player.hp < this.player.maxHp * 0.3);
        }
        if (this.boss && this.boss.active) {
            this.boss.update(dt, this);
        }

        if (window.EnemySpawner && !this.boss && this.bossWarningTimer <= 0) {
            window.EnemySpawner.update(dt, this);
        }
        this.enemies.forEach(e => e.update(dt, this));

        this.enemies.forEach(e => {
            if (e.active && MathUtils.distSq(e.pos.x, e.pos.y, this.player.pos.x, this.player.pos.y) < (e.radius + this.player.radius)**2) {
                if (this.player.invulnTimer <= 0) {
                    this.player.hp -= 20;
                    this.player.invulnTimer = 1.0;
                    this.sound.playHit();
                    this.spawnParticles(this.player.pos.x, this.player.pos.y, -e.polarity, 10);
                    if (this.player.hp <= 0) this.endGame();
                }
            }
        });

        this.bullets.forEach(b => {
            b.update(dt);
            if (Math.random() < 0.5) {
                this.vfx.addTrail(b.pos.x, b.pos.y, b.radius * 0.8, b.polarity, 0.15);
            }
            if (b.pos.x < -10 || b.pos.x > this.width + 10 || b.pos.y < -10 || b.pos.y > this.height + 10) {
                b.active = false;
            }
        });
        this.particles.forEach(p => p.update(dt));

        this.bullets.forEach(b => {
            if (!b.active) return;
            if (b.isEnemy) {
                if (MathUtils.distSq(b.pos.x, b.pos.y, this.player.pos.x, this.player.pos.y) < (b.radius + this.player.radius)**2) {
                    if (b.polarity === this.player.polarity) {
                        this.addScore(10);
                        this.player.energy += 5;
                        b.active = false;
                        this.spawnParticles(b.pos.x, b.pos.y, b.polarity, 5);
                    } else if (this.player.invulnTimer <= 0) {
                        this.player.hp -= 10;
                        this.player.invulnTimer = 1.0;
                        b.active = false;
                        this.sound.playHit();
                        this.spawnParticles(this.player.pos.x, this.player.pos.y, -b.polarity, 10);
                        this.vfx.triggerShake(5, 0.3);
                        this.vfx.triggerHitStop(0.1);
                        if (this.player.hp <= 0) {
                            this.endGame();
                        }
                    }
                }
            } else {
                if (this.boss && this.boss.active) {
                    if (MathUtils.distSq(b.pos.x, b.pos.y, this.boss.pos.x, this.boss.pos.y) < (b.radius + this.boss.radius)**2) {
                        let dmg = b.polarity !== 0 ? 20 : 10;
                        if (this.progression) dmg *= this.progression.perks.damageMult;
                        this.boss.hp -= dmg;
                        b.active = false;
                        this.addScore(5);
                        this.spawnDirectionalParticles(b.pos.x, b.pos.y, b.polarity, 3, Math.atan2(b.vel.y, b.vel.x), Math.PI/2, 100);
                        this.vfx.addPopup(b.pos.x, b.pos.y, dmg.toString(), b.polarity);
                        if (this.boss.hp <= 0) {
                            this.boss.active = false;
                            this.sound.playExplosion();
                            this.spawnParticles(this.boss.pos.x, this.boss.pos.y, 1, 50);
                            this.spawnParticles(this.boss.pos.x, this.boss.pos.y, -1, 50);
                            this.vfx.triggerShake(15, 1.0);
                            this.vfx.triggerHitStop(0.5);
                            this.addScore(1000);
                            this.boss = null;
                            this.wave++; // immediately advance wave to resume enemy spawns
                            if (this.progression) this.progression.showDraft();
                        }
                    }
                }

                this.enemies.forEach(e => {
                    if (e.active && b.active && MathUtils.distSq(b.pos.x, b.pos.y, e.pos.x, e.pos.y) < (b.radius + e.radius)**2) {
                        if (e.shieldActive && b.polarity !== e.polarity) {
                            b.active = false;
                            this.sound.playHit();
                        } else {
                            let dmg = b.polarity !== e.polarity ? 20 : 10;
                            if (this.progression) dmg *= this.progression.perks.damageMult;
                            e.takeDamage(dmg);
                            b.active = false;
                            this.spawnDirectionalParticles(b.pos.x, b.pos.y, b.polarity, 3, Math.atan2(b.vel.y, b.vel.x), Math.PI/2, 100);
                            let combo = this.progression && this.progression.comboManager ? this.progression.comboManager.combo : 0;
                            this.vfx.addPopup(b.pos.x, b.pos.y, dmg.toString(), b.polarity, combo >= 10);
                            if (e.hp <= 0) {
                                this.sound.playExplosion();
                                this.spawnParticles(e.pos.x, e.pos.y, e.polarity, 15);
                                this.vfx.triggerShake(2, 0.2);
                                if (combo >= 20) this.vfx.triggerHitStop(0.05);
                                this.addScore(e.points);
                                if (this.progression) this.progression.spawnPickup(e.pos.x, e.pos.y);
                                if (e instanceof SplitterEnemy) {
                                    const s1 = new SwarmerEnemy(e.pos.x - 15, e.pos.y);
                                    const s2 = new SwarmerEnemy(e.pos.x + 15, e.pos.y);
                                    this.enemies.push(s1, s2);
                                }
                            }
                        }
                    }
                });
            }
        });

        this.enemies = this.enemies.filter(e => e.active && e.pos.y < this.height + 100 && e.pos.x > -100 && e.pos.x < this.width + 100);
        this.bullets = this.bullets.filter(b => b.active);
        this.particles = this.particles.filter(p => p.active);
        this.input.update();
    }
    endGame() {
        this.setState('GAME_OVER');
        this.sound.stopBGM();
        this.sound.playExplosion();
        this.saveManager.data.totalGamesPlayed++;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        this.saveManager.save();
    }
    draw() {
        if (this.highContrast) { this.ctx.filter = 'contrast(200%) saturate(200%) grayscale(50%)'; }
        else { this.ctx.filter = 'none'; }
        this.ctx.fillStyle = '#000810';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.vfx.applyShake(this.ctx);

        if (this.worldManager) this.worldManager.drawBackground(this.ctx);
        this.islands.forEach(i => i.draw(this.ctx));
        if (this.worldManager) this.worldManager.drawForeground(this.ctx);

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER' || this.state === 'UPGRADE') {
            if (this.progression) this.progression.drawPickups(this.ctx);
            this.particles.forEach(p => p.draw(this.ctx));
            this.enemies.forEach(e => e.draw(this.ctx));
            this.bullets.forEach(b => b.draw(this.ctx));
            if (this.boss && this.boss.active) {
                this.boss.draw(this.ctx);

                if (!this.bossDisplayHp) this.bossDisplayHp = this.boss.maxHp;
                this.bossDisplayHp += (this.boss.hp - this.bossDisplayHp) * 0.1;
                this.ctx.fillStyle = '#f00';
                this.ctx.fillRect(this.width/2 - 150, 20, 300, 15);
                this.ctx.fillStyle = '#0f0';
                this.ctx.fillRect(this.width/2 - 150, 20, 300 * Math.max(0, this.bossDisplayHp/this.boss.maxHp), 15);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '14px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`BOSS - PHASE ${this.boss.phase}`, this.width/2, 15);
            }

            if (this.bossWarningTimer > 0) {
                if (Math.floor(Date.now() / 200) % 2 === 0) {
                    this.ctx.fillStyle = '#f00';
                    this.ctx.font = '30px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('WARNING: BOSS APPROACHING!', this.width/2, this.height/2);
                }
            }

            if (this.player.hp > 0) this.player.draw(this.ctx);
            this.vfx.drawTrails(this.ctx);
            this.vfx.drawPopups(this.ctx);

            this.ctx.restore();

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 10, 30);
            this.ctx.fillText(`Wave: ${this.wave}`, 10, 60);

            this.ctx.fillStyle = '#f00';
            this.ctx.fillRect(10, this.height - 30, 200, 20);
            this.ctx.fillStyle = '#0f0';
            this.ctx.fillRect(10, this.height - 30, 200 * (this.player.hp/this.player.maxHp), 20);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText(`Polarity: ${this.player.polarity === 1 ? 'RED (+)' : 'BLUE (-)'}`, 10, this.height - 40);

            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(10, this.height - 65, 100, 15);
            if (this.player.dashCooldown <= 0) {
                this.ctx.fillStyle = '#ff0';
                this.ctx.fillRect(10, this.height - 65, 100, 15);
                this.ctx.fillStyle = '#000';
                this.ctx.fillText('DASH READY [F]', 12, this.height - 53);
            } else {
                this.ctx.fillStyle = '#555';
                const ratio = 1 - (this.player.dashCooldown / 1.5);
                this.ctx.fillRect(10, this.height - 65, 100 * ratio, 15);
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText('COOLDOWN', 12, this.height - 53);
            }

            if (this.progression) this.progression.drawUI(this.ctx);

            if (this.state === 'UPGRADE' && this.progression) {
                this.progression.drawDraft(this.ctx);
            }
        }

        if (this.state === 'TITLE') {
            if (this.ui) this.ui.drawMilestones(this.ctx);
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px sans-serif';
            this.ctx.fillText('Magnetic Sky Duel', this.width/2, this.height/2 - 40);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText('Press Space or Tap to Start', this.width/2, this.height/2 + 20);
            this.ctx.fillText('WASD to move, Space to shoot, Shift to switch polarity', this.width/2, this.height/2 + 60);

            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height - 40);
        }

        if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px sans-serif';
            this.ctx.fillText('PAUSED', this.width/2, this.height/2);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText('Press Space or Tap to Resume', this.width/2, this.height/2 + 40);
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height - 40);
        }

        if (this.state === 'GAME_OVER') {
            if (this.ui) this.ui.drawMilestones(this.ctx);
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px sans-serif';
            this.ctx.fillText('GAME OVER', this.width/2, this.height/2 - 40);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width/2, this.height/2 + 20);
            this.ctx.fillText('Press Space or Tap to Restart', this.width/2, this.height/2 + 60);
        }
    }
    loop(time) {
        requestAnimationFrame(this.loop);
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (dt > 0.1) dt = 0.1;
        this.update(dt);
        this.draw();
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
};
