/**
 * Cytoplasm Recoil - Phase 1
 */

const SAVE_KEY = "arcade_game_078_078-cytoplasm-recoil_v1";
const STATES = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAME_OVER: 3, DRAFTING: 4 };

class MathUtils {
    static clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
    static lerp(a, b, t) { return a + (b - a) * t; }
    static randomRange(min, max) { return Math.random() * (max - min) + min; }
    static distance(x1, y1, x2, y2) { return Math.sqrt((x2 - x1)**2 + (y2 - y1)**2); }
}


const PERKS = [
    { name: "Rapid Ammo", desc: "+20% Ammo Speed", apply: (g) => { g.stats.ammoSpeedMultiplier += 0.2; } },
    { name: "Agility", desc: "+20% Move Speed", apply: (g) => { g.stats.moveSpeedMultiplier += 0.2; } },
    { name: "Bouncy", desc: "+2 Max Bounces", apply: (g) => { g.stats.maxBouncesBonus += 2; } },
    { name: "Large Ribosome", desc: "+30% Ammo Size", apply: (g) => { g.stats.ammoRadiusMultiplier += 0.3; } },
    { name: "Combo Master", desc: "+2s Combo Duration", apply: (g) => { g.stats.comboDuration += 2; } },
    { name: "Quick Dash", desc: "-20% Dash Cooldown", apply: (g) => { g.stats.dashCooldownMultiplier *= 0.8; } },
    { name: "Power Pierce", desc: "Ammo deals +1 Damage", apply: (g) => { g.stats.ammoDamageBonus += 1; } },
    { name: "Cellular Shield", desc: "Gain 1 Shield (Block hit)", apply: (g) => { g.player.shield = (g.player.shield || 0) + 1; } }
];

class Pickup {
    constructor(x, y, type) {
        this.pos = new Vector(x, y);
        this.type = type; // 0: score, 1: combo refresh, 2: shield
        this.radius = 8;
        this.markedForDeletion = false;
        this.lifeTime = 10.0;

        let angle = Math.random() * Math.PI * 2;
        let speed = MathUtils.randomRange(20, 50);
        this.vel = new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
    update(dt, gameWidth, gameHeight) {
        this.pos.add(new Vector(this.vel.x * dt, this.vel.y * dt));
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) this.markedForDeletion = true;

        if (this.pos.x < this.radius || this.pos.x > gameWidth - this.radius) this.vel.x *= -1;
        if (this.pos.y < this.radius || this.pos.y > gameHeight - this.radius) this.vel.y *= -1;
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.lifeTime);
        if (this.type === 0) {
            ctx.fillStyle = '#ffeb3b';
        } else if (this.type === 1) {
            ctx.fillStyle = '#03a9f4';
        } else if (this.type === 2) {
            ctx.fillStyle = '#4caf50';
        } else {
            ctx.fillStyle = '#ffffff';
        }

        ctx.beginPath();
        let bounce = Math.sin(this.lifeTime * Math.PI * 2) * 2;
        ctx.arc(this.pos.x, this.pos.y + bounce, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y + bounce, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.min(1, this.lifeTime) * 0.5;
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}
class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { musicVolume: 1, sfxVolume: 1, mute: false }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) { console.warn("SaveManager error.", e); }
    }
    save() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); }
        catch (e) { console.warn("SaveManager error.", e); }
    }
    updateHighScore(score) {
        if (score > this.data.highScore) {
            this.data.highScore = score;
            this.save();
        }
    }
    addGamePlayed(score) {
        this.data.totalGamesPlayed++;
        this.data.totalScoreAccumulated += score;
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

        // Procedural music/synth state
        this.musicTime = 0;
        this.tempo = 120;
        this.nextNoteTime = 0;
        this.currentNote = 0;
        this.arpSequence = [0, 3, 7, 10, 12, 10, 7, 3];
        this.bassSequence = [0, 0, 0, 0, -5, -5, 2, 2];
        this.drumTime = 0;
        this.nextDrumTime = 0;
        this.drumBeat = 0;
        this.isBoss = false;
        this.isLowHp = false;
        this.musicFilter = null;
    }
    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.6;

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.sfxGain.gain.value = 0.8;

        this.musicFilter = this.ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = 2000;
        this.musicFilter.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.musicFilter);
        this.musicGain.gain.value = 0.4;

        this.initialized = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.nextDrumTime = this.ctx.currentTime + 0.1;
    }

    updateMusic(dt, isBoss, isLowHp) {
        if (!this.initialized || !this.ctx) return;

        this.isBoss = isBoss;
        this.isLowHp = isLowHp;

        // Dynamic tempo and filter
        let targetTempo = 120;
        if (isBoss) targetTempo = 160;
        if (isLowHp) targetTempo = 140;
        this.tempo += (targetTempo - this.tempo) * dt * 2;

        let targetFilter = 2000;
        if (isBoss) targetFilter = 4000;
        if (isLowHp) targetFilter = 800; // muffled when dying
        this.musicFilter.frequency.setTargetAtTime(targetFilter, this.ctx.currentTime, 0.5);

        const secondsPerBeat = 60.0 / this.tempo;

        // Prevent audio glitch on tab resume
        if (this.nextNoteTime < this.ctx.currentTime) this.nextNoteTime = this.ctx.currentTime + 0.1;
        if (this.nextDrumTime < this.ctx.currentTime) this.nextDrumTime = this.ctx.currentTime + 0.1;

        // Arpeggiator & Bass
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.playSynthNote(this.nextNoteTime);
            this.nextNoteTime += secondsPerBeat / 4; // 16th notes
            this.currentNote = (this.currentNote + 1) % 16;
        }

        // Drums
        while (this.nextDrumTime < this.ctx.currentTime + 0.1) {
            this.playDrumNote(this.nextDrumTime);
            this.nextDrumTime += secondsPerBeat / 2; // 8th notes
            this.drumBeat = (this.drumBeat + 1) % 8;
        }
    }

    playSynthNote(time) {
        // Arp
        let noteIdx = this.currentNote % this.arpSequence.length;
        let note = this.arpSequence[noteIdx];
        if (this.isBoss) note += 2; // shift up for tension
        if (this.isLowHp && noteIdx % 2 === 0) return; // sparser when low hp

        let freq = 220 * Math.pow(2, note / 12);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = this.isBoss ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.1, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.2);

        // Bass on downbeats
        if (this.currentNote % 4 === 0) {
            let bassNote = this.bassSequence[(Math.floor(this.currentNote / 4)) % this.bassSequence.length];
            let bassFreq = 55 * Math.pow(2, bassNote / 12);

            const bOsc = this.ctx.createOscillator();
            const bGain = this.ctx.createGain();
            bOsc.type = 'square';
            bOsc.frequency.setValueAtTime(bassFreq, time);

            bGain.gain.setValueAtTime(0, time);
            bGain.gain.linearRampToValueAtTime(0.15, time + 0.02);
            bGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

            // basic lowpass on bass
            const bFilter = this.ctx.createBiquadFilter();
            bFilter.type = 'lowpass';
            bFilter.frequency.setValueAtTime(400, time);
            bFilter.frequency.exponentialRampToValueAtTime(100, time + 0.2);

            bOsc.connect(bGain);
            bGain.connect(bFilter);
            bFilter.connect(this.musicGain);

            bOsc.start(time);
            bOsc.stop(time + 0.3);
        }
    }

    playDrumNote(time) {
        // Kick on 0 and 4
        if (this.drumBeat === 0 || this.drumBeat === 4) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
            gain.gain.setValueAtTime(0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + 0.5);
        }
        // Snare on 2 and 6
        if (this.drumBeat === 2 || this.drumBeat === 6) {
            // Noise burst
            const bufferSize = this.ctx.sampleRate * 0.2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = 1000;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
            noise.connect(noiseFilter);
            noiseFilter.connect(gain);
            gain.connect(this.musicGain);
            noise.start(time);
            noise.stop(time + 0.2);
        }

        // Hihat on all 8ths
        const hhBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const hhData = hhBuffer.getChannelData(0);
        for (let i = 0; i < hhBuffer.length; i++) hhData[i] = Math.random() * 2 - 1;
        const hhNoise = this.ctx.createBufferSource();
        hhNoise.buffer = hhBuffer;
        const hhFilter = this.ctx.createBiquadFilter();
        hhFilter.type = 'highpass';
        hhFilter.frequency.value = 7000;
        const hhGain = this.ctx.createGain();
        hhGain.gain.setValueAtTime(0.1, time);
        hhGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        hhNoise.connect(hhFilter);
        hhFilter.connect(hhGain);
        hhGain.connect(this.musicGain);
        hhNoise.start(time);
        hhNoise.stop(time + 0.1);
    }

    // SFX Helper
    playAdvancedTone(freq1, freq2, type, duration, vol, env) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq1, this.ctx.currentTime);
        if (freq2) {
            osc.frequency.exponentialRampToValueAtTime(freq2, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        if (env === 'percussive') {
            gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        } else if (env === 'swell') {
            gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + duration/2);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        } else {
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        }

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Replace basic tones with rich SFX
    shoot() { this.playAdvancedTone(600, 200, 'square', 0.15, 0.4, 'percussive'); }
    bounce() { this.playAdvancedTone(800, 600, 'sine', 0.1, 0.3, 'percussive'); }
    hit() { this.playAdvancedTone(150, 50, 'sawtooth', 0.2, 0.4, 'percussive'); }
    pickup() { this.playAdvancedTone(400, 800, 'sine', 0.2, 0.4, 'swell'); }
    death() { this.playAdvancedTone(100, 20, 'sawtooth', 0.8, 0.6, 'percussive'); }
    start() { this.playAdvancedTone(440, 880, 'square', 0.4, 0.5, 'swell'); }
    dash() { this.playAdvancedTone(300, 100, 'triangle', 0.2, 0.5, 'percussive'); }

    // Additional SFX (10+ total)
    enemySpawn() { this.playAdvancedTone(200, 300, 'sine', 0.3, 0.3, 'swell'); }
    bossSpawn() { this.playAdvancedTone(100, 50, 'sawtooth', 1.0, 0.7, 'percussive'); }
    bossHit() { this.playAdvancedTone(80, 40, 'square', 0.3, 0.6, 'percussive'); }
    shieldBreak() { this.playAdvancedTone(1000, 100, 'sawtooth', 0.3, 0.5, 'percussive'); }
    uiHover() { this.playAdvancedTone(800, 800, 'sine', 0.05, 0.1, 'percussive'); }
    uiClick() { this.playAdvancedTone(1000, 1200, 'sine', 0.1, 0.2, 'percussive'); }
    comboUp() { this.playAdvancedTone(600, 1200, 'square', 0.3, 0.3, 'swell'); }
    draftSelect() { this.playAdvancedTone(400, 800, 'triangle', 0.3, 0.4, 'swell'); }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, clicked: false };
        this.joystick = { active: false, baseX: 0, baseY: 0, curX: 0, curY: 0, nx: 0, ny: 0 };
        this.bindEvents();
    }
    bindEvents() {
        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        this.canvas.addEventListener('mousedown', (e) => {
            this.updateMousePos(e);
            this.mouse.down = true;
            this.mouse.clicked = true;
            this.resumeAudio();
        });
        this.canvas.addEventListener('mousemove', (e) => this.updateMousePos(e));
        this.canvas.addEventListener('mouseup', () => { this.mouse.down = false; });
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.resumeAudio();
            const touch = e.changedTouches[0];
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            const x = (touch.clientX - rect.left) * scaleX;
            const y = (touch.clientY - rect.top) * scaleY;
            if (x < window.innerWidth / 2) {
                if (!this.joystick.active) {
                    this.joystick.active = true;
                    this.joystick.baseX = x;
                    this.joystick.baseY = y;
                    this.joystick.curX = x;
                    this.joystick.curY = y;
                }
            } else {
                this.mouse.x = x;
                this.mouse.y = y;
                this.mouse.clicked = true;
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const x = (touch.clientX - rect.left) * scaleX;
                const y = (touch.clientY - rect.top) * scaleY;
                if (this.joystick.active && touch.clientX < window.innerWidth / 2) {
                    this.joystick.curX = x;
                    this.joystick.curY = y;
                    let dx = this.joystick.curX - this.joystick.baseX;
                    let dy = this.joystick.curY - this.joystick.baseY;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        this.joystick.nx = dx / dist;
                        this.joystick.ny = dy / dist;
                    }
                }
            }
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.clientX < window.innerWidth / 2) {
                    this.joystick.active = false;
                    this.joystick.nx = 0;
                    this.joystick.ny = 0;
                }
            }
        }, { passive: false });
        window.addEventListener('keydown', () => this.resumeAudio());
    }
    resumeAudio() {
        if (window.game && window.game.sound && window.game.sound.ctx && window.game.sound.ctx.state === 'suspended') {
            window.game.sound.ctx.resume();
        }
    }
    updateMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouse.x = (e.clientX - rect.left) * scaleX;
        this.mouse.y = (e.clientY - rect.top) * scaleY;
    }
    update() { this.mouse.clicked = false; }
}

class Vector {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(n) { this.x *= n; this.y *= n; return this; }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        let m = this.mag();
        if (m !== 0) { this.x /= m; this.y /= m; }
        return this;
    }
    copy() { return new Vector(this.x, this.y); }
    dot(v) { return this.x * v.x + this.y * v.y; }
}

class Player {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.radius = 15;
        this.accel = 1500;
        this.friction = 0.92;
        this.maxSpeed = 300;
        this.hasAmmo = true;
        this.dashCooldown = 0;
        this.dashCooldownMax = 3.0;
        this.isDashing = false;
        this.dashDuration = 0.2;
        this.dashTimer = 0;
        this.invulnTimer = 0;
        this.facingAngle = 0;
    }
    update(dt, input, gameWidth, gameHeight) {
        let dx = 0;
        let dy = 0;
        if (input.keys['KeyW'] || input.keys['ArrowUp']) dy -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) dy += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) dx -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += 1;
        if (input.joystick.active) {
            dx = input.joystick.nx;
            dy = input.joystick.ny;
        }
        let move = new Vector(dx, dy);
        if (move.mag() > 0) {
            move.normalize();
            this.facingAngle = Math.atan2(move.y, move.x);
        }

        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.dashCooldownMax = 3.0 * (window.game ? window.game.stats.dashCooldownMultiplier : 1.0);
        if ((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && this.dashCooldown <= 0 && !this.isDashing && move.mag() > 0 && this.hasAmmo) {
            this.isDashing = true;
            this.dashTimer = this.dashDuration;
            this.dashCooldown = this.dashCooldownMax;
            this.invulnTimer = this.dashDuration;
            if (window.game && window.game.sound) window.game.sound.dash();
            this.vel = move.mult(800);
        }

        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            this.vel.add(move.mult(this.accel * dt));
            this.vel.mult(this.friction);
            let speed = this.vel.mag();
            let currentMaxSpeed = this.maxSpeed * (window.game ? window.game.stats.moveSpeedMultiplier : 1.0);
            if (speed > currentMaxSpeed) {
                this.vel.normalize().mult(currentMaxSpeed);
            }
        }

        this.pos.add(new Vector(this.vel.x * dt, this.vel.y * dt));

        if (this.pos.x - this.radius < 0) { this.pos.x = this.radius; this.vel.x *= -0.5; }
        if (this.pos.x + this.radius > gameWidth) { this.pos.x = gameWidth - this.radius; this.vel.x *= -0.5; }
        if (this.pos.y - this.radius < 0) { this.pos.y = this.radius; this.vel.y *= -0.5; }
        if (this.pos.y + this.radius > gameHeight) { this.pos.y = gameHeight - this.radius; this.vel.y *= -0.5; }
    }
    draw(ctx) {
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.facingAngle);

        if (this.isDashing) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(-30, 0);
            ctx.lineTo(-this.radius, -this.radius);
            ctx.lineTo(-this.radius, this.radius);
            ctx.fill();
        }

        let speed = this.vel.mag();
        if (speed > 50 && !this.isDashing) {
            ctx.fillStyle = '#ff9800';
            ctx.beginPath();
            ctx.moveTo(-this.radius, 0);
            ctx.lineTo(-this.radius - 10 - Math.random() * 10, -5);
            ctx.lineTo(-this.radius - 5, 0);
            ctx.lineTo(-this.radius - 10 - Math.random() * 10, 5);
            ctx.fill();
        }

        ctx.fillStyle = '#448b6f';
        ctx.beginPath();
        let sides = 6;
        for (let i = 0; i < sides; i++) {
            let a = (i * Math.PI * 2) / sides;
            let r = this.radius;
            let x = Math.cos(a) * r;
            let y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#2e4a3b';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.hasAmmo) {
            ctx.fillStyle = '#ffeb3b';
            ctx.beginPath();
            ctx.arc(0, 0, 5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();

        if (this.hasAmmo && window.game && window.game.input.mouse.down && !window.game.input.joystick.active) {
            let dx = window.game.input.mouse.x - this.pos.x;
            let dy = window.game.input.mouse.y - this.pos.y;
            let dir = new Vector(dx, dy);
            if (dir.mag() > 0) {
                dir.normalize();
                ctx.strokeStyle = 'rgba(255, 235, 59, 0.5)';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(this.pos.x + dir.x * this.radius, this.pos.y + dir.y * this.radius);
                ctx.lineTo(this.pos.x + dir.x * 100, this.pos.y + dir.y * 100);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
}

class Ammo {
    constructor(x, y, dir, game) {
        this.pos = new Vector(x, y);
        let speed = 800 * (game ? game.stats.ammoSpeedMultiplier : 1.0);
        this.vel = dir.mult(speed);
        this.radius = 8 * (game ? game.stats.ammoRadiusMultiplier : 1.0);
        this.active = true;
        this.bounces = 0;
        this.maxBounces = 5 + (game ? game.stats.maxBouncesBonus : 0);
        this.damage = 1 + (game ? game.stats.ammoDamageBonus : 0);
    }
    update(dt, gameWidth, gameHeight, bumpers) {
        if (!this.active) return false;
        this.pos.add(new Vector(this.vel.x * dt, this.vel.y * dt));
        let bounced = false;

        if (this.pos.x - this.radius < 0) { this.pos.x = this.radius; this.vel.x *= -1; bounced = true; }
        if (this.pos.x + this.radius > gameWidth) { this.pos.x = gameWidth - this.radius; this.vel.x *= -1; bounced = true; }
        if (this.pos.y - this.radius < 0) { this.pos.y = this.radius; this.vel.y *= -1; bounced = true; }
        if (this.pos.y + this.radius > gameHeight) { this.pos.y = gameHeight - this.radius; this.vel.y *= -1; bounced = true; }

        for (let b of bumpers) {
            let dist = MathUtils.distance(this.pos.x, this.pos.y, b.pos.x, b.pos.y);
            if (dist < this.radius + b.radius) {
                let dx = this.pos.x - b.pos.x;
                let dy = this.pos.y - b.pos.y;
                let n = new Vector(dx, dy).normalize();
                let v = this.vel.mag();
                this.vel = n.mult(v);
                let overlap = (this.radius + b.radius) - dist;
                this.pos.add(n.normalize().mult(overlap));
                bounced = true;
            }
        }

        if (bounced) {
            this.bounces++;
            if (this.bounces >= this.maxBounces) {
                this.active = false;
                this.vel = new Vector(0, 0);
            }
            return true;
        }
        return false;
    }
    draw(ctx) {
        ctx.fillStyle = this.active ? '#ffeb3b' : '#9e9e9e';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class EnemyProjectile {
    constructor(x, y, dirX, dirY, speed) {
        this.pos = new Vector(x, y);
        let n = new Vector(dirX, dirY);
        if (n.mag() > 0) n.normalize();
        this.vel = new Vector(n.x * speed, n.y * speed);
        this.radius = 4;
        this.markedForDeletion = false;
    }
    update(dt) {
        this.pos.add(new Vector(this.vel.x * dt, this.vel.y * dt));
    }
    draw(ctx) {
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class ToxicPuddle {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.radius = 25;
        this.timer = 5;
        this.markedForDeletion = false;
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) this.markedForDeletion = true;
    }
    draw(ctx) {
        ctx.fillStyle = 'rgba(76, 175, 80, 0.4)';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Enemy {
    constructor(x, y) {
        this.pos = new Vector(x, y);
        this.radius = 12;
        this.hp = 1;
        this.markedForDeletion = false;
        this.speed = MathUtils.randomRange(100, 150);
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) this.markedForDeletion = true;
        return this.hp <= 0;
    }
    update(dt, game) {
        let dir = new Vector(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y);
        if (dir.mag() > 0) dir.normalize();
        dir.x += MathUtils.randomRange(-0.25, 0.25);
        dir.y += MathUtils.randomRange(-0.25, 0.25);
        dir.normalize();
        this.pos.add(new Vector(dir.x * this.speed * dt, dir.y * this.speed * dt));
    }
    draw(ctx) {
        ctx.fillStyle = '#e91e63';
        ctx.beginPath();
        let numSpikes = 8;
        for (let i = 0; i < numSpikes * 2; i++) {
            let angle = (i * Math.PI * 2) / (numSpikes * 2);
            let r = i % 2 === 0 ? this.radius : this.radius * 0.6;
            let x = this.pos.x + Math.cos(angle) * r;
            let y = this.pos.y + Math.sin(angle) * r;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#880e4f';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Swarmer extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = MathUtils.randomRange(160, 200);
        this.radius = 8;
    }
    draw(ctx) {
        ctx.fillStyle = '#ff5722';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#bf360c';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class RangedSniper extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 40;
        this.shootTimer = 3;
    }
    update(dt, game) {
        let dist = MathUtils.distance(this.pos.x, this.pos.y, game.player.pos.x, game.player.pos.y);
        if (dist > 150) {
            let dir = new Vector(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y);
            if (dir.mag() > 0) dir.normalize();
            this.pos.add(new Vector(dir.x * this.speed * dt, dir.y * this.speed * dt));
        }
        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            let dx = game.player.pos.x - this.pos.x;
            let dy = game.player.pos.y - this.pos.y;
            game.enemyProjectiles.push(new EnemyProjectile(this.pos.x, this.pos.y, dx, dy, 250));
            this.shootTimer = 3;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#9c27b0';
        ctx.beginPath();
        ctx.moveTo(this.pos.x + this.radius, this.pos.y);
        ctx.lineTo(this.pos.x - this.radius, this.pos.y + this.radius);
        ctx.lineTo(this.pos.x - this.radius, this.pos.y - this.radius);
        ctx.closePath();
        ctx.fill();
        if (this.shootTimer < 1) {
            ctx.beginPath();
            ctx.arc(this.pos.x, this.pos.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 0, 0, ' + (1 - this.shootTimer) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

class ShieldedBruiser extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 60;
        this.radius = 18;
        this.hp = 3;
    }
    draw(ctx) {
        ctx.fillStyle = '#607d8b';
        ctx.fillRect(this.pos.x - this.radius, this.pos.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.strokeStyle = '#263238';
        ctx.lineWidth = 4;
        ctx.strokeRect(this.pos.x - this.radius, this.pos.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class SplitterSpawner extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 50;
        this.radius = 20;
        this.hp = 2;
    }
    draw(ctx) {
        ctx.fillStyle = '#00bcd4';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#006064';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class AreaDenialHazard extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.speed = 70;
        this.puddleTimer = 2;
    }
    update(dt, game) {
        super.update(dt, game);
        this.puddleTimer -= dt;
        if (this.puddleTimer <= 0) {
            game.enemyPuddles.push(new ToxicPuddle(this.pos.x, this.pos.y));
            this.puddleTimer = 2;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#cddc39';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#827717';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Boss extends Enemy {
    constructor(x, y, maxHp, name) {
        super(x, y);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.name = name;
        this.radius = 40;
        this.phase = 1;
        this.stateTimer = 0;
    }
    takeDamage(amount) {
        let died = super.takeDamage(amount);
        if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
            this.phase = 2;
            this.onPhaseTransition();
        }
        return died;
    }
    onPhaseTransition() {}
    drawHpBar(ctx, width) {
        let barWidth = width * 0.6;
        let barHeight = 20;
        let x = (width - barWidth) / 2;
        let y = 30;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, barWidth, barHeight);

        let hpRatio = Math.max(0, this.hp / this.maxHp);
        ctx.fillStyle = this.phase === 1 ? '#e91e63' : '#d50000';
        ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.name + (this.phase === 2 ? " (ENRAGED)" : ""), width / 2, y + 15);
    }
}

class BossMacrophage extends Boss {
    constructor(x, y) {
        super(x, y, 40, "Macrophage Alpha");
        this.speed = 50;
        this.shootTimer = 2;
    }
    onPhaseTransition() {
        this.speed = 80;
        this.radius = 35;
    }
    update(dt, game) {
        let dir = new Vector(game.player.pos.x - this.pos.x, game.player.pos.y - this.pos.y);
        if (dir.mag() > 0) dir.normalize();
        this.pos.add(new Vector(dir.x * this.speed * dt, dir.y * this.speed * dt));

        this.shootTimer -= dt;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.phase === 1 ? 2 : 1;
            let numShots = this.phase === 1 ? 5 : 9;
            for (let i = 0; i < numShots; i++) {
                let angle = (i / numShots) * Math.PI * 2;
                game.enemyProjectiles.push(new EnemyProjectile(this.pos.x, this.pos.y, Math.cos(angle), Math.sin(angle), 100));
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.phase === 1 ? '#9c27b0' : '#4a148c';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ea80fc';
        ctx.beginPath();
        ctx.arc(this.pos.x - 10, this.pos.y - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.pos.x + 10, this.pos.y + 5, 6, 0, Math.PI * 2);
        ctx.fill();
    }
}

class BossViralConstruct extends Boss {
    constructor(x, y) {
        super(x, y, 50, "Viral Construct Omega");
        this.speed = 40;
        this.spawnTimer = 3;
        this.puddleTimer = 4;
        this.angle = 0;
    }
    onPhaseTransition() {
        this.speed = 60;
    }
    update(dt, game) {
        this.angle += dt;
        let targetX = game.player.pos.x + Math.cos(this.angle) * 150;
        let targetY = game.player.pos.y + Math.sin(this.angle) * 150;

        let dir = new Vector(targetX - this.pos.x, targetY - this.pos.y);
        if (dir.mag() > 0) dir.normalize();
        this.pos.add(new Vector(dir.x * this.speed * dt, dir.y * this.speed * dt));

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = this.phase === 1 ? 4 : 2;
            game.enemies.push(new Swarmer(this.pos.x, this.pos.y));
            if (this.phase === 2) {
                game.enemies.push(new Swarmer(this.pos.x, this.pos.y));
            }
        }

        this.puddleTimer -= dt;
        if (this.puddleTimer <= 0) {
            this.puddleTimer = this.phase === 1 ? 5 : 3;
            game.enemyPuddles.push(new ToxicPuddle(this.pos.x, this.pos.y));
            if (this.phase === 2) {
                game.enemyPuddles.push(new ToxicPuddle(this.pos.x + 40, this.pos.y));
                game.enemyPuddles.push(new ToxicPuddle(this.pos.x - 40, this.pos.y));
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.phase === 1 ? '#00bcd4' : '#006064';
        ctx.beginPath();
        ctx.moveTo(this.pos.x, this.pos.y - this.radius);
        ctx.lineTo(this.pos.x + this.radius, this.pos.y);
        ctx.lineTo(this.pos.x, this.pos.y + this.radius);
        ctx.lineTo(this.pos.x - this.radius, this.pos.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

class Bumper {
    constructor(x, y, r) {
        this.pos = new Vector(x, y);
        this.radius = r;
    }
    draw(ctx) {
        ctx.fillStyle = '#8bc34a';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#33691e';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(this.pos.x - this.radius*0.3, this.pos.y - this.radius*0.3, this.radius*0.3, 0, Math.PI*2);
        ctx.fill();
    }
}

class FloatingText {
    constructor(text, x, y, color, duration = 1.0) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.color = color;
        this.life = duration;
        this.maxLife = duration;
        this.vy = -50;
        this.vx = (Math.random() - 0.5) * 20;
        this.scaleMult = 1.0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;

        if (this.life < this.maxLife * 0.5) {
            this.vy *= 0.95;
            this.vx *= 0.95;
        }
    }
    draw(ctx) {
        if (this.life <= 0) {
            return;
        }
        ctx.save();
        let alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        let scale = 1 + Math.sin(Math.PI * (1 - this.life / this.maxLife)) * 0.5;
        ctx.font = `bold ${Math.floor(20 * scale * this.scaleMult)}px monospace`;
        ctx.textAlign = 'center';

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class MotionTrail {
    constructor(x, y, radius, color, duration = 0.3) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.life = duration;
        this.maxLife = duration;
        this.shrinkRate = 1.0;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) {
            return;
        }
        ctx.save();
        let alpha = Math.max(0, this.life / this.maxLife) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        let currentRadius = this.radius * (this.life / this.maxLife) * this.shrinkRate;
        ctx.arc(this.x, this.y, Math.max(0, currentRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, inputAngle = null, spread = Math.PI * 2) {
        this.pos = new Vector(x, y);
        let angle = inputAngle !== null ? inputAngle + (Math.random() - 0.5) * spread : Math.random() * Math.PI * 2;
        let speed = MathUtils.randomRange(50, 150);
        this.vel = new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.life = 1.0;
        this.maxLife = 1.0;
        this.color = color;
        this.size = MathUtils.randomRange(2, 5);
        this.friction = 0.98;
        this.gravity = 0;
    }
    update(dt) {
        this.vel.mult(this.friction);
        this.vel.y += this.gravity * dt;
        this.pos.add(new Vector(this.vel.x * dt, this.vel.y * dt));
        this.life -= dt * 2;
    }
    draw(ctx) {
        if (this.life <= 0) {
            return;
        }
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}


class ParallaxLayer {
    constructor(speedX, speedY, density, radiusMin, radiusMax, color) {
        this.speedX = speedX;
        this.speedY = speedY;
        this.density = density;
        this.radiusMin = radiusMin;
        this.radiusMax = radiusMax;
        this.color = color;
        this.elements = [];
    }

    init(width, height) {
        this.elements = [];
        for (let i = 0; i < this.density; i++) {
            this.elements.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: MathUtils.randomRange(this.radiusMin, this.radiusMax)
            });
        }
    }

    update(dt, playerMoveVector, width, height) {
        for (let el of this.elements) {
            el.x -= playerMoveVector.x * this.speedX * dt;
            el.y -= playerMoveVector.y * this.speedY * dt;

            if (el.x < -el.r) el.x = width + el.r;
            if (el.x > width + el.r) el.x = -el.r;
            if (el.y < -el.r) el.y = height + el.r;
            if (el.y > height + el.r) el.y = -el.r;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        for (let el of this.elements) {
            ctx.beginPath();
            ctx.arc(el.x, el.y, el.r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class CytoskeletonConveyor {
    constructor(x, y, width, height, dirX, dirY, strength) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.dir = new Vector(dirX, dirY).normalize();
        this.strength = strength;
        this.time = 0;
    }

    update(dt) {
        this.time += dt;
    }

    applyForce(entity, dt) {
        if (entity.pos.x > this.x && entity.pos.x < this.x + this.width &&
            entity.pos.y > this.y && entity.pos.y < this.y + this.height) {
            let force = this.dir.copy().mult(this.strength * dt);
            if (entity.vel) entity.vel.add(force);
            else entity.pos.add(force);
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(0, 150, 150, 0.15)';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = 'rgba(0, 200, 200, 0.4)';
        ctx.lineWidth = 1;

        let step = 30;
        let offset = (this.time * this.strength * 0.5) % step;

        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.clip();

        let startX = this.dir.x > 0 ? this.x - step : this.x;
        let startY = this.dir.y > 0 ? this.y - step : this.y;

        for (let ix = startX; ix <= this.x + this.width + step; ix += step) {
            for (let iy = startY; iy <= this.y + this.height + step; iy += step) {
                let px = ix + this.dir.x * offset;
                let py = iy + this.dir.y * offset;

                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px + this.dir.x * 10 - this.dir.y * 5, py + this.dir.y * 10 + this.dir.x * 5);
                ctx.lineTo(px + this.dir.x * 10 + this.dir.y * 5, py + this.dir.y * 10 - this.dir.x * 5);
                ctx.closePath();
                ctx.stroke();
            }
        }

        ctx.restore();
    }
}

class DestructibleCover {
    constructor(x, y, radius) {
        this.pos = new Vector(x, y);
        this.radius = radius;
        this.hp = 3;
        this.markedForDeletion = false;
        this.wobble = 0;
    }

    hit() {
        this.hp--;
        this.wobble = 1.0;
        if (this.hp <= 0) {
            this.markedForDeletion = true;
        }
    }

    update(dt) {
        if (this.wobble > 0) {
            this.wobble -= dt * 5;
            if (this.wobble < 0) this.wobble = 0;
        }
    }

    draw(ctx) {
        let r = this.radius + Math.sin(this.wobble * Math.PI * 4) * 3;
        ctx.fillStyle = '#8b4513';
        if (this.hp === 2) ctx.fillStyle = '#a0522d';
        if (this.hp === 1) ctx.fillStyle = '#cd853f';

        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            let angle = (i * Math.PI * 2) / 8;
            let offsetR = r * (0.9 + 0.1 * Math.sin(angle * 3 + this.hp));
            let x = this.pos.x + Math.cos(angle) * offsetR;
            let y = this.pos.y + Math.sin(angle) * offsetR;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#5c4033';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.input = new InputManager(this.canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.state = STATES.TITLE;
        this.lastTime = 0;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.pickups = [];
        this.stats = { comboDuration: 5.0 };
        this.player = null;
        this.ammo = null;
        this.enemies = [];
        this.bumpers = [];
        this.particles = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;
        this.bossEncounterCounter = 1;
        this.nextBossThreshold = 150;
        this.activeBoss = null;
        this.warningTimer = 0;
        this.bgLayers = [];
        this.streams = [];
        this.hazards = [];
        this.enemyProjectiles = [];
        this.enemyPuddles = [];
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
        this.resize();
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === STATES.PLAYING) this.state = STATES.PAUSED;
        });
        window.addEventListener('blur', () => {
            if (this.state === STATES.PLAYING) this.state = STATES.PAUSED;
        });
        requestAnimationFrame((t) => this.loop(t));
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }

    addScore(points) {
        let gained = Math.floor(points * (1 + this.combo * 0.1));
        this.score += gained;
        this.combo++;
        this.comboTimer = this.stats.comboDuration;
    }
    startDraft() {
        this.state = STATES.DRAFTING;
        let shuffled = PERKS.slice().sort(() => 0.5 - Math.random());
        this.draftChoices = shuffled.slice(0, 3);
    }
    initGame() {
        this.stats = {
            ammoSpeedMultiplier: 1.0,
            moveSpeedMultiplier: 1.0,
            maxBouncesBonus: 0,
            ammoRadiusMultiplier: 1.0,
            comboDuration: 5.0,
            dashCooldownMultiplier: 1.0,
            ammoDamageBonus: 0
        };
        this.combo = 0;
        this.comboTimer = 0;
        this.pickups = [];
        this.player = new Player(this.width / 2, this.height / 2);
        this.player.shield = 0;
        this.ammo = null;
        this.enemies = [];
        this.particles = [];
        this.score = 0;
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;
        this.bossEncounterCounter = 1;
        this.nextBossThreshold = 150;
        this.activeBoss = null;
        this.warningTimer = 0;
        this.enemyProjectiles = [];
        this.enemyPuddles = [];
        this.bumpers = [];
        for (let i = 0; i < 6; i++) {
            this.bumpers.push(new Bumper(
                MathUtils.randomRange(50, this.width - 50),
                MathUtils.randomRange(50, this.height - 50),
                MathUtils.randomRange(20, 40)
            ));
        }

        this.bgLayers = [
            new ParallaxLayer(0.2, 0.2, 40, 2, 4, 'rgba(46, 74, 59, 0.4)'),
            new ParallaxLayer(0.5, 0.5, 20, 4, 8, 'rgba(68, 139, 111, 0.3)'),
            new ParallaxLayer(0.8, 0.8, 10, 8, 15, 'rgba(100, 180, 140, 0.2)')
        ];
        for (let layer of this.bgLayers) layer.init(this.width, this.height);

        this.streams = [
            new CytoskeletonConveyor(this.width * 0.2, 0, 100, this.height, 0, 1, 80),
            new CytoskeletonConveyor(0, this.height * 0.7, this.width, 100, 1, 0, 80)
        ];

        this.hazards = [];
        for (let i = 0; i < 4; i++) {
            this.hazards.push(new DestructibleCover(
                MathUtils.randomRange(100, this.width - 100),
                MathUtils.randomRange(100, this.height - 100),
                30
            ));
        }

        this.sound.init();
        this.sound.start();
        this.state = STATES.PLAYING;
    }
    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
    }
    update(dt) {
        if (this.state === STATES.TITLE) {
            if (this.input.mouse.clicked || this.input.keys['Enter'] || this.input.keys['Space']) {
                this.initGame();
                this.triggerShake(5, 0.2);
            }
            return;
        }
        if (this.state === STATES.DRAFTING) {
            if (this.input.mouse.clicked) {
                let mx = this.input.mouse.x;
                let my = this.input.mouse.y;
                let bw = 250;
                let bh = 80;
                let startY = this.height / 2 - 100;
                for (let i = 0; i < 3; i++) {
                    let bx = this.width / 2 - bw / 2;
                    let by = startY + i * (bh + 20);
                    if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
                        this.draftChoices[i].apply(this);
                        this.state = STATES.PLAYING;
                        this.sound.pickup();
                        this.input.mouse.clicked = false;
                        break;
                    }
                }
            }
            return;
        }

        if (this.state === STATES.GAME_OVER) {
            if (this.input.mouse.clicked || this.input.keys['Enter']) {
                this.state = STATES.TITLE;
            }
            return;
        }
        if (this.state === STATES.PAUSED) {
            if (this.input.keys['KeyP'] || this.input.mouse.clicked) {
                this.state = STATES.PLAYING;
                this.input.keys['KeyP'] = false;
            }
            return;
        }
        if (this.input.keys['KeyP']) {
            this.state = STATES.PAUSED;
            this.input.keys['KeyP'] = false;
            return;
        }

        let isLowHp = (this.player && (!this.player.shield || this.player.shield <= 0));
        let isBoss = !!this.activeBoss;
        this.sound.updateMusic(dt, isBoss, isLowHp);

        this.player.update(dt, this.input, this.width, this.height);

        let pMove = new Vector(0, 0);
        if (this.player.vel) {
            pMove = this.player.vel.copy().mult(dt);
        }
        for (let layer of this.bgLayers) layer.update(dt, pMove, this.width, this.height);

        for (let p of this.pickups) {
            p.update(dt, this.width, this.height);
            let dist = MathUtils.distance(this.player.pos.x, this.player.pos.y, p.pos.x, p.pos.y);
            if (dist < this.player.radius + p.radius) {
                p.markedForDeletion = true;
                this.sound.pickup();
                if (p.type === 0) {
                    this.addScore(50);
                    this.floatingTexts.push(new FloatingText("+50", p.pos.x, p.pos.y, "#ffeb3b", 1.0));
                } else if (p.type === 1) {
                    this.comboTimer = this.stats.comboDuration;
                    this.floatingTexts.push(new FloatingText("COMBO", p.pos.x, p.pos.y, "#03a9f4", 1.0));
                } else if (p.type === 2) {
                    this.player.shield = (this.player.shield || 0) + 1;
                    this.floatingTexts.push(new FloatingText("SHIELD", p.pos.x, p.pos.y, "#4caf50", 1.0));
                }
            }
        }
        this.pickups = this.pickups.filter(p => !p.markedForDeletion);

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }

        for (let stream of this.streams) {
            stream.update(dt);
            stream.applyForce(this.player, dt);
            if (this.ammo) stream.applyForce(this.ammo, dt);
            for (let e of this.enemies) stream.applyForce(e, dt);
        }

        for (let b of this.bumpers) {
            let dist = MathUtils.distance(this.player.pos.x, this.player.pos.y, b.pos.x, b.pos.y);
            if (dist < this.player.radius + b.radius) {
                let dx = this.player.pos.x - b.pos.x;
                let dy = this.player.pos.y - b.pos.y;
                let n = new Vector(dx, dy).normalize();
                let overlap = (this.player.radius + b.radius) - dist;
                this.player.pos.add(n.copy().mult(overlap));
                let dot = this.player.vel.dot(n);
                if (dot < 0) {
                    this.player.vel.sub(n.copy().mult(2 * dot));
                    this.player.vel.mult(0.8);
                }
            }
        }

        if (this.player.hasAmmo && this.input.mouse.clicked) {
            this.sound.init();
            let dx = this.input.mouse.x - this.player.pos.x;
            let dy = this.input.mouse.y - this.player.pos.y;
            let dir = new Vector(dx, dy);
            if (dir.mag() > 0) dir.normalize();
            else dir = new Vector(1, 0);

            this.ammo = new Ammo(this.player.pos.x, this.player.pos.y, dir, this);
            this.player.hasAmmo = false;

            this.player.vel.sub(dir.copy().mult(400));
            this.player.invulnTimer = 0.1;

            let oppositeAngle = Math.atan2(-dir.y, -dir.x);
            this.spawnParticles(this.player.pos.x, this.player.pos.y, '#fff', 10, oppositeAngle, Math.PI / 4);

            this.sound.shoot();
        }

        if (this.ammo) {
            this.trails.push(new MotionTrail(this.ammo.pos.x, this.ammo.pos.y, this.ammo.radius, '#ffeb3b', 0.1));
            let bounced = this.ammo.update(dt, this.width, this.height, this.bumpers);

            if (bounced) {
                this.sound.bounce();
                this.spawnParticles(this.ammo.pos.x, this.ammo.pos.y, '#ffeb3b', 3);
                this.triggerShake(1, 0.05);
            }

            if (!this.ammo.active) {
                let dist = MathUtils.distance(this.player.pos.x, this.player.pos.y, this.ammo.pos.x, this.ammo.pos.y);
                if (dist < this.player.radius + this.ammo.radius) {
                    this.player.hasAmmo = true;
                    this.ammo = null;
                    this.sound.pickup();
                    this.spawnParticles(this.player.pos.x, this.player.pos.y, '#ffeb3b', 5);
                } else {
                    let dX = this.player.pos.x - this.ammo.pos.x;
                    let dY = this.player.pos.y - this.ammo.pos.y;
                    let mag = Math.sqrt(dX * dX + dY * dY);

                    if (mag > 0 && mag < 150 && this.player.isDashing) {
                        this.ammo.pos.x += (dX / mag) * 50 * dt;
                        this.ammo.pos.y += (dY / mag) * 50 * dt;
                        this.trails.push(new MotionTrail(this.ammo.pos.x, this.ammo.pos.y, this.ammo.radius * 0.5, '#fff', 0.1));
                    }
                }
            }
        }

        if (this.activeBoss) {
            if (this.activeBoss.markedForDeletion) {

                this.triggerShake(15, 0.5);
                this.hitStop = 0.2;
                this.spawnParticles(this.activeBoss.pos.x, this.activeBoss.pos.y, '#ffeb3b', 50);
                this.floatingTexts.push(new FloatingText("BOSS VANQUISHED", this.activeBoss.pos.x, this.activeBoss.pos.y, "#ffeb3b", 2.0));

                this.activeBoss = null;
                this.nextBossThreshold += 300;
                this.bossEncounterCounter++;
                this.addScore(100);
                this.sound.bossHit();
                this.enemySpawnTimer = 3.0; // Break before next waves
                this.startDraft();
            }
        } else {
            if (this.score >= this.nextBossThreshold && this.warningTimer <= 0) {
                this.warningTimer = 3.0;
                this.enemies.forEach(e => e.markedForDeletion = true);
                this.enemyProjectiles.forEach(ep => ep.markedForDeletion = true);
            }
        }

        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            if (this.warningTimer <= 0) {
                let ex = this.width / 2;
                let ey = -50;
                if (this.bossEncounterCounter % 2 === 1) {
                    this.activeBoss = new BossMacrophage(ex, ey);
                } else {
                    this.activeBoss = new BossViralConstruct(ex, ey);
                }
                this.enemies.push(this.activeBoss);
            }
        }

        if (!this.activeBoss && this.warningTimer <= 0) {
            this.enemySpawnTimer -= dt;
            if (this.enemySpawnTimer <= 0) {
                let side = Math.floor(Math.random() * 4);
                let ex = 0, ey = 0;
                if (side === 0) { ex = Math.random() * this.width; ey = -20; }
                if (side === 1) { ex = Math.random() * this.width; ey = this.height + 20; }
                if (side === 2) { ex = -20; ey = Math.random() * this.height; }
                if (side === 3) { ex = this.width + 20; ey = Math.random() * this.height; }

                let rand = Math.random();
                if (rand < 0.2) this.enemies.push(new Swarmer(ex, ey));
                else if (rand < 0.4) this.enemies.push(new RangedSniper(ex, ey));
                else if (rand < 0.6) this.enemies.push(new ShieldedBruiser(ex, ey));
                else if (rand < 0.8) this.enemies.push(new SplitterSpawner(ex, ey));
                else if (rand < 0.9) this.enemies.push(new AreaDenialHazard(ex, ey));
                else this.enemies.push(new Enemy(ex, ey));

                this.enemySpawnTimer = this.enemySpawnRate;
                this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.02);
            }
        }

        for (let e of this.enemies) {
            e.update(dt, this);
            let dist = MathUtils.distance(this.player.pos.x, this.player.pos.y, e.pos.x, e.pos.y);
            if (dist < this.player.radius + e.radius) {
                if (this.player.isDashing) {
                    if (e.takeDamage(1)) {
                        if (e instanceof SplitterSpawner) {
                            this.enemies.push(new Swarmer(e.pos.x - 10, e.pos.y));
                            this.enemies.push(new Swarmer(e.pos.x + 10, e.pos.y));
                        }
                        this.sound.hit();
                        this.addScore(20);

                        let hitAngle = Math.atan2(e.pos.y - this.player.pos.y, e.pos.x - this.player.pos.x);
                        this.spawnParticles(e.pos.x, e.pos.y, '#e91e63', 15, hitAngle, Math.PI / 2);

                        this.triggerShake(5, 0.1);
                        this.hitStop = 0.05;
                        this.floatingTexts.push(new FloatingText("+20", e.pos.x, e.pos.y, "#fff", 0.5));

                        if (Math.random() < 0.3) {
                            let type = Math.random() < 0.6 ? 0 : (Math.random() < 0.8 ? 1 : 2);
                            this.pickups.push(new Pickup(e.pos.x, e.pos.y, type));
                        }
                    } else {
                        this.spawnParticles(e.pos.x, e.pos.y, '#fff', 5);
                    }
                } else if (this.player.invulnTimer <= 0) {
                    if (this.player.shield > 0) {
                        this.player.shield--;
                        this.player.invulnTimer = 1.0;
                        this.sound.hit();
                        this.spawnParticles(this.player.pos.x, this.player.pos.y, '#4caf50', 20);
                    } else {
                        this.sound.death();
                        this.saveManager.updateHighScore(this.score);
                        this.saveManager.addGamePlayed(this.score);
                        this.state = STATES.GAME_OVER;
                    }
                }
            }
            if (this.ammo && this.ammo.active) {
                let adist = MathUtils.distance(this.ammo.pos.x, this.ammo.pos.y, e.pos.x, e.pos.y);
                if (adist < this.ammo.radius + e.radius) {
                    if (e.takeDamage(this.ammo.damage)) {
                        if (e instanceof SplitterSpawner) {
                            this.enemies.push(new Swarmer(e.pos.x - 10, e.pos.y));
                            this.enemies.push(new Swarmer(e.pos.x + 10, e.pos.y));
                        }
                        this.sound.hit();
                        this.addScore(10);

                        let hitAngle = Math.atan2(e.pos.y - this.ammo.pos.y, e.pos.x - this.ammo.pos.x);
                        this.spawnParticles(e.pos.x, e.pos.y, '#e91e63', 10, hitAngle, Math.PI / 2);

                        this.triggerShake(3, 0.05);
                        this.hitStop = 0.02;
                        this.floatingTexts.push(new FloatingText("+10", e.pos.x, e.pos.y, "#fff", 0.5));

                        if (Math.random() < 0.2) {
                            let type = Math.random() < 0.6 ? 0 : (Math.random() < 0.8 ? 1 : 2);
                            this.pickups.push(new Pickup(e.pos.x, e.pos.y, type));
                        }
                    } else {
                        this.spawnParticles(e.pos.x, e.pos.y, '#fff', 5);
                    }
                }
            }
        }
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);

        for (let ep of this.enemyProjectiles) {
            ep.update(dt);
            let pdist = MathUtils.distance(this.player.pos.x, this.player.pos.y, ep.pos.x, ep.pos.y);
            if (pdist < this.player.radius + ep.radius && this.player.invulnTimer <= 0 && !this.player.isDashing) {
                if (this.player.shield > 0) {
                    this.player.shield--;
                    this.player.invulnTimer = 1.0;
                    this.sound.hit();
                    this.spawnParticles(this.player.pos.x, this.player.pos.y, '#4caf50', 20);
                } else {
                    this.sound.death();
                    this.saveManager.updateHighScore(this.score);
                    this.saveManager.addGamePlayed(this.score);
                    this.state = STATES.GAME_OVER;
                }
            }
        }
        this.enemyProjectiles = this.enemyProjectiles.filter(ep => !ep.markedForDeletion && ep.pos.x > -50 && ep.pos.x < this.width + 50 && ep.pos.y > -50 && ep.pos.y < this.height + 50);

        for (let pud of this.enemyPuddles) {
            pud.update(dt);
            let pdist = MathUtils.distance(this.player.pos.x, this.player.pos.y, pud.pos.x, pud.pos.y);
            if (pdist < this.player.radius + pud.radius && this.player.invulnTimer <= 0 && !this.player.isDashing) {
                if (this.player.shield > 0) {
                    this.player.shield--;
                    this.player.invulnTimer = 1.0;
                    this.sound.hit();
                    this.spawnParticles(this.player.pos.x, this.player.pos.y, '#4caf50', 20);
                } else {
                    this.sound.death();
                    this.saveManager.updateHighScore(this.score);
                    this.saveManager.addGamePlayed(this.score);
                    this.state = STATES.GAME_OVER;
                }
            }
        }
        this.enemyPuddles = this.enemyPuddles.filter(p => !p.markedForDeletion);

        for (let h of this.hazards) {
            h.update(dt);

            let distP = MathUtils.distance(this.player.pos.x, this.player.pos.y, h.pos.x, h.pos.y);
            if (distP < this.player.radius + h.radius) {
                let dx = this.player.pos.x - h.pos.x;
                let dy = this.player.pos.y - h.pos.y;
                let n = new Vector(dx, dy).normalize();
                let overlap = (this.player.radius + h.radius) - distP;
                this.player.pos.add(n.copy().mult(overlap));

                if (this.player.isDashing) {
                    h.hit();
                    this.sound.hit();
                    this.spawnParticles(h.pos.x, h.pos.y, '#8b4513', 5);
                } else {
                    let dot = this.player.vel.dot(n);
                    if (dot < 0) {
                        this.player.vel.sub(n.copy().mult(2 * dot));
                        this.player.vel.mult(0.8);
                    }
                }
            }

            if (this.ammo && this.ammo.active) {
                let distA = MathUtils.distance(this.ammo.pos.x, this.ammo.pos.y, h.pos.x, h.pos.y);
                if (distA < this.ammo.radius + h.radius) {
                    h.hit();
                    this.sound.hit();
                    this.spawnParticles(h.pos.x, h.pos.y, '#8b4513', 5);

                    let dx = this.ammo.pos.x - h.pos.x;
                    let dy = this.ammo.pos.y - h.pos.y;
                    let n = new Vector(dx, dy).normalize();
                    let dot = this.ammo.vel.dot(n);
                    if (dot < 0) this.ammo.vel.sub(n.copy().mult(2 * dot));
                }
            }
        }
        this.hazards = this.hazards.filter(h => !h.markedForDeletion);

        for (let p of this.particles) p.update(dt);
        this.particles = this.particles.filter(p => p.life > 0);

        this.input.update();
    }
    draw() {
        this.ctx.fillStyle = '#1a2a22';
        this.ctx.fillRect(0, 0, this.width, this.height);

        for (let layer of this.bgLayers) layer.draw(this.ctx);
        for (let stream of this.streams) stream.draw(this.ctx);

        if (this.state === STATES.TITLE) {
            this.drawText("CYTOPLASM RECOIL", this.width/2, this.height/3, 50, '#448b6f');
            this.drawText("Click or Press Enter to Start", this.width/2, this.height/2, 24, '#fff');
            this.drawText(`High Score: ${this.saveManager.data.highScore}`, this.width/2, this.height/2 + 40, 20, '#aaa');
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("Back to Arcade", this.width/2, this.height - 50);
            return;
        }

        for (let b of this.bumpers) b.draw(this.ctx);
        for (let h of this.hazards) h.draw(this.ctx);
        for (let pud of this.enemyPuddles) pud.draw(this.ctx);
        if (this.ammo) this.ammo.draw(this.ctx);
        for (let e of this.enemies) e.draw(this.ctx);
        for (let ep of this.enemyProjectiles) ep.draw(this.ctx);
        for (let p of this.particles) p.draw(this.ctx);
        if (this.player) this.player.draw(this.ctx);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);

        if (this.combo > 0) {
            this.ctx.fillStyle = '#f39c12';
            this.ctx.fillText(`Combo: x${(1 + this.combo * 0.1).toFixed(1)}`, 20, 70);

            // Combo Bar
            this.ctx.fillStyle = '#e67e22';
            let ratio = Math.max(0, this.comboTimer / this.stats.comboDuration);
            this.ctx.fillRect(20, 80, 100 * ratio, 5);
        }

        if (this.player && this.player.shield > 0) {
            this.ctx.fillStyle = '#4caf50';
            this.ctx.fillText(`Shield: ${this.player.shield}`, 20, this.combo > 0 ? 110 : 70);
        }

        for (let p of this.pickups) p.draw(this.ctx);

        if (this.activeBoss && !this.activeBoss.markedForDeletion) {
            this.activeBoss.drawHpBar(this.ctx, this.width);
        }

        if (this.warningTimer > 0 && Math.floor(this.warningTimer * 5) % 2 === 0) {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(0, this.height / 2 - 40, this.width, 80);
            this.drawText("WARNING: BOSS APPROACHING", this.width / 2, this.height / 2 + 10, 40, '#fff');
        }

        if (this.player) {
            this.ctx.fillStyle = '#2e4a3b';
            this.ctx.fillRect(20, 50, 100, 10);
            let cdRatio = Math.max(0, 1 - (this.player.dashCooldown / this.player.dashCooldownMax));
            this.ctx.fillStyle = cdRatio >= 1 ? '#4caf50' : '#ff9800';
            this.ctx.fillRect(20, 50, 100 * cdRatio, 10);
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(20, 50, 100, 10);
        }

        if (this.state === STATES.DRAFTING) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.drawText("WAVE CLEARED!", this.width/2, this.height/2 - 150, 40, '#fff');
            this.drawText("CHOOSE AN UPGRADE", this.width/2, this.height/2 - 110, 20, '#aaa');

            let bw = 250;
            let bh = 80;
            let startY = this.height / 2 - 100;

            for (let i = 0; i < 3; i++) {
                let bx = this.width / 2 - bw / 2;
                let by = startY + i * (bh + 20);

                this.ctx.fillStyle = '#2c3e50';
                this.ctx.fillRect(bx, by, bw, bh);
                this.ctx.strokeStyle = '#34495e';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(bx, by, bw, bh);

                if (this.draftChoices && this.draftChoices[i]) {
                    this.drawText(this.draftChoices[i].name, this.width/2, by + 30, 20, '#f1c40f');
                    this.drawText(this.draftChoices[i].desc, this.width/2, by + 60, 14, '#bdc3c7');
                }
            }
        }

        if (this.state === STATES.GAME_OVER) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.drawText("CELL DESTROYED", this.width/2, this.height/3, 50, '#e91e63');
            this.drawText(`Final Score: ${this.score}`, this.width/2, this.height/2, 30, '#fff');
            this.drawText("Click to Return", this.width/2, this.height/2 + 50, 20, '#aaa');
        }
        if (this.state === STATES.PAUSED) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.drawText("PAUSED", this.width/2, this.height/2, 50, '#fff');
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("Back to Arcade", this.width/2, this.height - 50);
        }

        if (this.input.joystick.active) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            this.ctx.beginPath();
            this.ctx.arc(this.input.joystick.baseX, this.input.joystick.baseY, 50, 0, Math.PI*2);
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(this.input.joystick.curX, this.input.joystick.curY, 20, 0, Math.PI*2);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }
    drawText(text, x, y, size, color) {
        this.ctx.fillStyle = color;
        this.ctx.font = `bold ${size}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(text, x, y);
    }
    loop(time) {
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (dt > 0.1) dt = 0.1;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}
window.onload = () => { window.game = new Game(); };
