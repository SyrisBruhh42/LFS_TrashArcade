// part1.js: Utilities, Constants, SaveManager, SoundEngine
const SAVE_KEY = 'arcade_game_075_075-neon-echo-protocol_v1';

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mul(s) { return new Vector2(this.x * s, this.y * s); }
    div(s) { return new Vector2(this.x / s, this.y / s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    magSq() { return this.x * this.x + this.y * this.y; }
    norm() {
        let m = this.mag();
        return m === 0 ? new Vector2(0, 0) : this.div(m);
    }
    copy() { return new Vector2(this.x, this.y); }
    dist(v) { return this.sub(v).mag(); }
    static distSq(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        return dx * dx + dy * dy;
    }
}

class Rect {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    contains(p) {
        return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
    }
    intersect(r) {
        return this.x < r.x + r.w && this.x + this.w > r.x &&
               this.y < r.y + r.h && this.y + this.h > r.y;
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
            options: {}
        };
        this.load();
    }
    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) {
            console.warn("Could not load save data", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Could not save data", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.filter = null;
        this.initialized = false;

        // BGM state
        this.bpm = 120;
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.bassSequence = [36, 0, 36, 0, 48, 0, 43, 0, 36, 0, 36, 0, 48, 0, 46, 0];
        this.arpSequence = [60, 63, 67, 72, 67, 63, 60, 55, 60, 63, 67, 72, 75, 72, 67, 63];
        this.playingBGM = false;

        // Dynamic modifiers
        this.bossMode = false;
        this.lowHpMode = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        // Add filter for dynamic soundtrack
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 5000;

        this.masterGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.filter);
        this.filter.connect(this.masterGain);

        this.masterGain.gain.value = 1.0;
        this.sfxGain.gain.value = 0.8;
        this.musicGain.gain.value = 0.5;
        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    scheduleNote(beatNumber, time) {
        if (!this.initialized || !this.ctx) return;

        // Calculate tempo based on game state
        let currentBpm = this.bpm;
        if (this.bossMode) currentBpm *= 1.2;
        if (this.lowHpMode) currentBpm *= 0.8;

        // Kick drum on beats 0, 4, 8, 12
        if (beatNumber % 4 === 0) {
            this.playKick(time);
        }

        // Hihat on odd 8ths (every other 16th)
        if (beatNumber % 2 !== 0) {
            this.playHihat(time);
        }

        // Snare on 2 and 4 (beats 4 and 12)
        if (beatNumber === 4 || beatNumber === 12) {
            this.playSnare(time);
        }

        // Bassline
        let bassNote = this.bassSequence[beatNumber];
        if (bassNote > 0) {
            this.playSynth(this.midiToFreq(bassNote), 'sawtooth', 0.15, time, 0.4);
        }

        // Arp
        if (this.bossMode) {
            let arpNote = this.arpSequence[beatNumber];
            this.playSynth(this.midiToFreq(arpNote), 'square', 0.1, time, 0.15);
        }
    }

    playSynth(freq, type, duration, time, vol=0.5) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';

        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.8, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time) {
        const osc = this.ctx.createOscillator();
        const noise = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();

        // Generate noise buffer
        const bufferSize = this.ctx.sampleRate * 0.2; // 0.2s
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.5, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        osc.connect(gain);
        noise.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        noise.start(time);
        osc.stop(time + 0.2);
    }

    playHihat(time) {
        const noise = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        filter.type = 'highpass';
        filter.frequency.value = 7000;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);
    }

    updateBGM() {
        if (!this.initialized || !this.ctx || !this.playingBGM) return;

        // Dynamic filter based on HP
        if (this.lowHpMode) {
            this.filter.frequency.setTargetAtTime(1000, this.ctx.currentTime, 0.5);
        } else if (this.bossMode) {
            this.filter.frequency.setTargetAtTime(8000, this.ctx.currentTime, 0.5);
        } else {
            this.filter.frequency.setTargetAtTime(4000, this.ctx.currentTime, 0.5);
        }

        let secondsPerBeat = 60.0 / (this.bossMode ? this.bpm * 1.2 : (this.lowHpMode ? this.bpm * 0.8 : this.bpm));
        let lookahead = 0.1;

        while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);

            // Advance to next note
            this.nextNoteTime += 0.25 * secondsPerBeat;
            this.current16thNote++;
            if (this.current16thNote === 16) {
                this.current16thNote = 0;
            }
        }
    }

    startBGM() {
        if (!this.initialized || !this.ctx) return;
        this.playingBGM = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.current16thNote = 0;
    }

    stopBGM() {
        this.playingBGM = false;
    }

    playTone(freq, type, duration, vol=1, slideFreq=null) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol=0.5) {
        if (!this.initialized || !this.ctx) return;
        const noise = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();

        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(gain);
        gain.connect(this.sfxGain);
        noise.start();
    }

    shoot() { this.playTone(600, 'square', 0.1, 0.4, 400); }
    hit() { this.playTone(150, 'sawtooth', 0.15, 0.5, 50); }
    echoSpawn() { this.playTone(800, 'sine', 0.3, 0.4, 1200); }
    gameOver() { this.playTone(100, 'sawtooth', 1.5, 0.8, 20); }



    start() {
        this.playTone(600, 'square', 0.2, 0.5);
        setTimeout(() => this.playTone(800, 'square', 0.3, 0.5), 200);
    }
    buttonClick() { this.playTone(1200, 'sine', 0.05, 0.3); }
    weaponUpgrade() {
        this.playTone(400, 'triangle', 0.2, 0.5, 600);
        setTimeout(() => this.playTone(600, 'triangle', 0.4, 0.5, 800), 200);
    }
    abilityUse() { this.playTone(300, 'sine', 0.4, 0.5, 900); }
    enemyHit() { this.playNoise(0.1, 0.3); }
    playerHit() {
        this.playTone(200, 'square', 0.2, 0.6, 100);
        this.playNoise(0.2, 0.4);
    }
    bossSpawn() {
        this.playTone(150, 'sawtooth', 1.0, 0.7, 300);
        setTimeout(() => this.playTone(100, 'sawtooth', 1.0, 0.7, 400), 500);
    }
    dash() { this.playNoise(0.15, 0.2); }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touches = [];
        this.leftStick = { active: false, id: null, base: new Vector2(), pos: new Vector2(), dir: new Vector2() };
        this.rightStick = { active: false, id: null, base: new Vector2(), pos: new Vector2(), dir: new Vector2() };

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', e => {
            // Map mouse to internal resolution
            let rect = window.game.canvas.getBoundingClientRect();
            let canvasWidth = window.game.width;
            let canvasHeight = window.game.height;
            let scaleX = canvasWidth / rect.width;
            let scaleY = canvasHeight / rect.height;


            let mappedX = (e.clientX - rect.left) * scaleX;
            let mappedY = (e.clientY - rect.top) * scaleY;
            if (window.game && window.game.uiManager && window.game.uiManager.handleClick(mappedX, mappedY)) return;
            if (window.game && window.game.uiManager && window.game.uiManager.handleClick(e.clientX, e.clientY)) return;
            this.mouse.down = true;
            if(window.game && window.game.sound) { window.game.sound.init(); window.game.sound.resume(); }
        });
        window.addEventListener('mouseup', e => this.mouse.down = false);

        // Touch events
        const handleTouch = (e) => {
            if (window.game && window.game.uiManager && window.game.uiManager.optionsOpen && e.touches.length > 0) {
                if (window.game.uiManager.handleClick(e.touches[0].clientX, e.touches[0].clientY)) return;
            }
            e.preventDefault();
            this.touches = Array.from(e.touches);
            if(window.game && window.game.sound) { window.game.sound.init(); window.game.sound.resume(); }
            this.updateSticks(e);
        };
        window.addEventListener('touchstart', handleTouch, {passive: false});
        window.addEventListener('touchmove', handleTouch, {passive: false});
        window.addEventListener('touchend', e => {
            handleTouch(e);
            this.endSticks(e);
        }, {passive: false});
        window.addEventListener('touchcancel', e => {
            handleTouch(e);
            this.endSticks(e);
        }, {passive: false});
    }

    updateSticks(e) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (e.type === 'touchstart') {
                if (t.clientX < w / 2 && !this.leftStick.active) {
                    this.leftStick.active = true;
                    this.leftStick.id = t.identifier;
                    this.leftStick.base = new Vector2(t.clientX, t.clientY);
                    this.leftStick.pos = new Vector2(t.clientX, t.clientY);
                } else if (t.clientX >= w / 2 && !this.rightStick.active) {
                    this.rightStick.active = true;
                    this.rightStick.id = t.identifier;
                    this.rightStick.base = new Vector2(t.clientX, t.clientY);
                    this.rightStick.pos = new Vector2(t.clientX, t.clientY);
                }
            }
        }
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (this.leftStick.active && t.identifier === this.leftStick.id) {
                this.leftStick.pos = new Vector2(t.clientX, t.clientY);
                this.leftStick.dir = this.leftStick.pos.sub(this.leftStick.base);
                if (this.leftStick.dir.mag() > 50) this.leftStick.dir = this.leftStick.dir.norm().mul(50);
            }
            if (this.rightStick.active && t.identifier === this.rightStick.id) {
                this.rightStick.pos = new Vector2(t.clientX, t.clientY);
                this.rightStick.dir = this.rightStick.pos.sub(this.rightStick.base);
                if (this.rightStick.dir.mag() > 50) this.rightStick.dir = this.rightStick.dir.norm().mul(50);
            }
        }
    }

    endSticks(e) {
        let leftStillActive = false;
        let rightStillActive = false;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === this.leftStick.id) leftStillActive = true;
            if (e.touches[i].identifier === this.rightStick.id) rightStillActive = true;
        }
        if (!leftStillActive) {
            this.leftStick.active = false;
            this.leftStick.id = null;
            this.leftStick.dir = new Vector2();
        }
        if (!rightStillActive) {
            this.rightStick.active = false;
            this.rightStick.id = null;
            this.rightStick.dir = new Vector2();
        }
    }

    getMovement() {
        let x = 0, y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
        let v = new Vector2(x, y);
        if (v.mag() > 0) return v.norm();
        if (this.leftStick.active && this.leftStick.dir.mag() > 10) {
            return this.leftStick.dir.norm();
        }
        return new Vector2();
    }

    getAim(playerPos, canvasTransform) {
        if (this.rightStick.active && this.rightStick.dir.mag() > 10) {
            return this.rightStick.dir.norm();
        }
        if (this.keys['ArrowUp'] && !this.keys['KeyW']) return new Vector2(0, -1);
        if (this.keys['ArrowDown'] && !this.keys['KeyS']) return new Vector2(0, 1);
        if (this.keys['ArrowLeft'] && !this.keys['KeyA']) return new Vector2(-1, 0);
        if (this.keys['ArrowRight'] && !this.keys['KeyD']) return new Vector2(1, 0);

        if (this.mouse.down) {
            const dx = this.mouse.x - canvasTransform.x;
            const dy = this.mouse.y - canvasTransform.y;
            return new Vector2(dx, dy).norm();
        }
        return null;
    }
}

// part2.js: Game Entities (Player, Echo, Bullet, Enemy, Core)

class Player {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2();
        this.speed = 200;
        this.radius = 12;
        this.color = '#00ffff';
        this.shootTimer = 0;
        this.shootCooldown = 0.15;
        this.history = []; // Array of {t: time, pos: Vector2, shootDir: Vector2|null}
        this.recordingTime = 0;

        // Phase 2 additions
        this.dashTimer = 0;
        this.dashCooldown = 3.0; // 3 seconds cooldown
        this.isDashing = false;
        this.dashDuration = 0.2;
        this.invulnerableTimer = 0;
        this.facing = new Vector2(1, 0);
        this.recoilOffset = 0;
        this.thrustIntensity = 0;

        // Physics
        this.friction = 0.9;
        this.acceleration = 1200;
    }
    update(dt, input, game) {
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.recoilOffset > 0) this.recoilOffset -= dt * 15; // Recover from recoil

        let move = input.getMovement();

        let dashTrigger = input.keys['ShiftLeft'] || input.keys['ShiftRight'] || input.dashTouched;
        if (dashTrigger && this.dashTimer <= 0) {
            this.dashTimer = this.dashCooldown;
            this.isDashing = true;
            this.invulnerableTimer = this.dashDuration;
            if (game.sound && game.sound.dash) game.sound.dash();
            let dashDir = move.mag() > 0 ? move.norm() : this.facing;
            this.vel = dashDir.mul(this.speed * 4); // Burst speed
            game.sound.playTone(800, 'sine', 0.2, 0.7); // Dash sound
        }

        if (this.isDashing) {
            if (this.dashTimer <= this.dashCooldown - this.dashDuration) {
                this.isDashing = false;
            }
            if (game.vfx) game.vfx.spawnTrail(this);
        } else {
            if (move.mag() > 0) {
                this.vel = this.vel.add(move.mul(this.acceleration * dt));
                this.thrustIntensity = 1;
                if (game.vfx && Math.random() < 0.2) game.vfx.spawnTrail(this);
            } else {
                this.thrustIntensity = Math.max(0, this.thrustIntensity - dt * 5);
            }
        }

        // Apply friction
        if (!this.isDashing) {
            this.vel = this.vel.mul(Math.pow(this.friction, dt * 60));
        }

        // Limit max speed
        if (!this.isDashing && this.vel.mag() > this.speed) {
            this.vel = this.vel.norm().mul(this.speed);
        }

        this.pos = this.pos.add(this.vel.mul(dt));

        // Boundaries
        this.pos.x = Math.max(this.radius, Math.min(game.width - this.radius, this.pos.x));
        this.pos.y = Math.max(this.radius, Math.min(game.height - this.radius, this.pos.y));

        let aim = input.getAim(this.pos, {
            x: game.canvas.width/2 + (this.pos.x - game.camera.x),
            y: game.canvas.height/2 + (this.pos.y - game.camera.y)
        });

        if (aim) {
            this.facing = aim.norm();
        } else if (this.vel.mag() > 10) {
            this.facing = this.vel.norm();
        }

        let shootDir = null;
        let isDashingThisFrame = this.isDashing;

        if (this.shootTimer > 0) this.shootTimer -= dt;
        if ((aim || input.keys['Space']) && this.shootTimer <= 0 && !this.isDashing) {
            shootDir = aim || (this.vel.mag() > 0 ? this.vel.norm() : this.facing);
            game.spawnBullet(this.pos.copy(), shootDir, true);
            this.shootTimer = this.shootCooldown;
            this.recoilOffset = 5; // Pixels of recoil
            game.sound.shoot();
        }

        if (game.isRecording) {
            this.recordingTime += dt;
            this.history.push({
                t: this.recordingTime,
                pos: this.pos.copy(),
                shootDir: shootDir,
                dash: isDashingThisFrame,
                facing: this.facing.copy()
            });

            // Cap history to 20 seconds to prevent memory leak
            while (this.history.length > 0 && this.recordingTime - this.history[0].t > 20) {
                this.history.shift();
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        // Recoil effect
        let recoilDir = this.facing.mul(-this.recoilOffset);
        ctx.translate(recoilDir.x, recoilDir.y);

        // Invulnerability Blink
        if (this.invulnerableTimer > 0) {
            if (Math.floor(Date.now() / 50) % 2 === 0) {
                ctx.globalAlpha = 0.3;
            }
        }

        // Aim telegraph
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.facing.x * 200, this.facing.y * 200);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.rotate(Math.atan2(this.facing.y, this.facing.x));

        // Thrust particle logic or visuals
        if (this.thrustIntensity > 0 && !this.isDashing) {
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            let thrusterLen = 8 + Math.random() * 8 * this.thrustIntensity;
            ctx.moveTo(-this.radius, -4);
            ctx.lineTo(-this.radius - thrusterLen, 0);
            ctx.lineTo(-this.radius, 4);
            ctx.fill();
        }

        // Draw multi-part procedural ship
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        // Main body
        ctx.beginPath();
        ctx.moveTo(this.radius, 0); // Nose
        ctx.lineTo(-this.radius, this.radius); // Back right
        ctx.lineTo(-this.radius + 4, 0); // Back center indentation
        ctx.lineTo(-this.radius, -this.radius); // Back left
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cockpit
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-4, 3);
        ctx.lineTo(-4, -3);
        ctx.fill();

        ctx.restore();
    }
}

class Echo {
    constructor(history, color) {
        this.history = history; // Copy of player history
        this.color = color;
        this.pos = history.length > 0 ? history[0].pos.copy() : new Vector2();
        this.radius = 12;
        this.time = 0;
        this.index = 0;
        this.active = true;
    }
    update(dt, game) {
        if (!this.active || this.history.length === 0) return;
        this.time += dt;

        while (this.index < this.history.length - 1 && this.history[this.index + 1].t <= this.time) {
            this.index++;
            let frame = this.history[this.index];
            if (frame.shootDir) {
                game.spawnBullet(frame.pos.copy(), frame.shootDir, true, this.color);
            }
        }

        if (this.index < this.history.length) {
            let frame = this.history[this.index];
            this.pos = frame.pos.copy();
            this.facing = frame.facing || new Vector2(1, 0);
            this.isDashing = frame.dash || false;
        } else {
            this.active = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        ctx.globalAlpha = 0.6;

        let rot = 0;
        if (this.facing) {
             rot = Math.atan2(this.facing.y, this.facing.x);
        }
        ctx.rotate(rot);

        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.lineTo(-this.radius + 4, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, dir, isPlayer, color) {
        this.pos = new Vector2(x, y);
        this.dir = dir;
        this.speed = 400;
        this.isPlayer = isPlayer;
        this.color = color || (isPlayer ? '#00ffff' : '#ff0055');
        this.radius = 4;
        this.active = true;
    }
    update(dt, game) {
        this.pos = this.pos.add(this.dir.mul(this.speed * dt));
        if (this.pos.x < 0 || this.pos.x > game.width || this.pos.y < 0 || this.pos.y > game.height) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BaseEnemy {
    constructor(x, y, type) {
        this.pos = new Vector2(x, y);
        this.type = type;
        this.radius = 10;
        this.hp = 10;
        this.maxHp = 10;
        this.speed = 80;
        this.color = '#ff0055';
        this.active = true;
        this.value = 10;
        this.state = 'move';
        this.stateTimer = 0;
        this.createdAt = Date.now();
    }
    update(dt, game) {
        let target = game.core.pos;
        let dir = target.sub(this.pos).norm();
        this.pos = this.pos.add(dir.mul(this.speed * dt));

        if (this.pos.dist(game.core.pos) < this.radius + game.core.radius) {
            game.core.takeDamage(this.hp);
            this.active = false;
        }
    }
    takeDamage(amount) {
        this.hp -= amount;
        if(window.game && window.game.sound && window.game.sound.enemyHit) window.game.sound.enemyHit();
    }
    die(game) {
        // override if needed
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.strokeStyle = this.color;
        ctx.fillStyle = '#0b0b1a';
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        this.drawGeometry(ctx);
        ctx.fill();
        ctx.stroke();

        this.drawTelegraph(ctx);
        this.drawHP(ctx);

        ctx.restore();
    }
    drawGeometry(ctx) {
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
    }
    drawTelegraph(ctx) {}
    drawHP(ctx) {
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'red';
            ctx.fillRect(-this.radius, -this.radius - 8, this.radius * 2, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(-this.radius, -this.radius - 8, (this.radius * 2) * (this.hp / this.maxHp), 4);
        }
    }
}

class SwarmerEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 'swarmer');
        this.radius = 8;
        this.hp = 5;
        this.maxHp = 5;
        this.speed = 120;
        this.color = '#ff00aa';
        this.value = 5;
        this.sinOffset = Math.random() * Math.PI * 2;
    }
    update(dt, game) {
        let target = game.core.pos;
        let dist = this.pos.dist(target);

        let dir = target.sub(this.pos).norm();
        let perp = new Vector2(-dir.y, dir.x);
        let wobble = Math.sin((Date.now() / 1000) * 10 + this.sinOffset) * 50;

        let finalVel = dir.mul(this.speed).add(perp.mul(wobble));
        this.pos = this.pos.add(finalVel.mul(dt));

        if (dist < this.radius + game.core.radius) {
            game.core.takeDamage(this.hp);
            this.active = false;
        }
    }
    drawGeometry(ctx) {
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius / 2);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, this.radius / 2);
        ctx.closePath();
    }
}

class SniperEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 'sniper');
        this.radius = 12;
        this.hp = 15;
        this.maxHp = 15;
        this.speed = 50;
        this.color = '#00ffaa';
        this.value = 20;
        this.range = 250;
        this.state = 'approach';
    }
    update(dt, game) {
        let target = game.core.pos;
        let dist = this.pos.dist(target);
        let dir = target.sub(this.pos).norm();

        if (this.state === 'approach') {
            this.pos = this.pos.add(dir.mul(this.speed * dt));
            if (dist < this.range) {
                this.state = 'aim';
                this.stateTimer = 1.5;
            }
        } else if (this.state === 'aim') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'shoot';
                this.stateTimer = 0.5;
                game.spawnBullet(this.pos.copy(), dir, false, this.color);
                game.sound.playTone(600, 'square', 0.1, 0.5);
            }
        } else if (this.state === 'shoot') {
            this.stateTimer -= dt;
            if (this.stateTimer <= 0) {
                this.state = 'retreat';
                this.stateTimer = 2.0;
            }
        } else if (this.state === 'retreat') {
            this.stateTimer -= dt;
            this.pos = this.pos.add(dir.mul(-this.speed * 0.5 * dt));
            if (this.stateTimer <= 0) {
                this.state = 'approach';
            }
        }
    }
    drawGeometry(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.lineTo(0, -this.radius);
        ctx.closePath();
    }
    drawTelegraph(ctx) {
        if (this.state === 'aim') {
            let game = window.game;
            let dir = game.core.pos.sub(this.pos).norm();
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(dir.x * this.range, dir.y * this.range);
            ctx.strokeStyle = `rgba(0, 255, 170, ${(1.5 - this.stateTimer)/1.5})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }
    }
}

class BruiserEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 'bruiser');
        this.radius = 20;
        this.hp = 30;
        this.maxHp = 30;
        this.shieldHp = 30;
        this.maxShieldHp = 30;
        this.speed = 35;
        this.color = '#ffaa00';
        this.value = 30;
    }
    update(dt, game) {
        super.update(dt, game);
        if (this.shieldHp < this.maxShieldHp) {
            this.shieldHp += dt * 2;
        }
    }
    takeDamage(amount) {
        if (this.shieldHp > 0) {
            this.shieldHp -= amount;
            if (this.shieldHp < 0) {
                this.hp += this.shieldHp;
                this.shieldHp = 0;
            }
        } else {
            this.hp -= amount;
        }
    }
    drawGeometry(ctx) {
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
    }
    drawHP(ctx) {
        super.drawHP(ctx);
        // Draw shield bar above HP
        if (this.shieldHp > 0) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(-this.radius, -this.radius - 14, this.radius * 2, 4);
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(-this.radius, -this.radius - 14, (this.radius * 2) * (this.shieldHp / this.maxShieldHp), 4);
        }
    }
}

class SplitterEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 'splitter');
        this.radius = 16;
        this.hp = 20;
        this.maxHp = 20;
        this.speed = 60;
        this.color = '#aa00ff';
        this.value = 15;
    }
    die(game) {
        game.enemies.push(new SwarmerEnemy(this.pos.x - 10, this.pos.y));
        game.enemies.push(new SwarmerEnemy(this.pos.x + 10, this.pos.y));
    }
    drawGeometry(ctx) {
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        // Inner line to show split
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
    }
}

class HazardEnemy extends BaseEnemy {
    constructor(x, y) {
        super(x, y, 'hazard');
        this.radius = 14;
        this.hp = 25;
        this.maxHp = 25;
        this.speed = 40;
        this.color = '#ff4400';
        this.value = 25;
        this.pulse = 0;
    }
    update(dt, game) {
        super.update(dt, game);
        this.pulse += dt * 5;
    }
    die(game) {
        for(let i=0; i<8; i++) {
            let angle = (i/8) * Math.PI * 2;
            let dir = new Vector2(Math.cos(angle), Math.sin(angle));
            game.spawnBullet(this.pos.copy(), dir, false, this.color);
        }
        game.sound.playTone(400, 'sawtooth', 0.2, 0.4);
    }
    drawGeometry(ctx) {
        let r = this.radius + Math.sin(this.pulse) * 3;
        ctx.beginPath();
        for(let i=0; i<6; i++) {
            let angle = (i/6) * Math.PI * 2;
            let px = Math.cos(angle) * r;
            let py = Math.sin(angle) * r;
            if(i===0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
    }
}


class Core {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.radius = 30;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.color = '#ff62ac';
    }
    takeDamage(amount) {
        this.hp -= amount;
        if(window.game) {
            window.game.sound.hit();
            if (window.game.sound.playerHit) window.game.sound.playerHit();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20 + Math.sin(Date.now() / 200) * 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = 'red';
        ctx.fillRect(-this.radius, -this.radius - 15, this.radius * 2, 6);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-this.radius, -this.radius - 15, (this.radius * 2) * Math.max(0, this.hp / this.maxHp), 6);
        ctx.restore();
    }
}

// part3.js: Main Game Class

class Particle {
    constructor(x, y, color) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
        this.life = 0.5 + Math.random() * 0.5;
        this.maxLife = this.life;
        this.color = color;
        this.active = true;
    }
    update(dt) {
        this.pos = this.pos.add(this.vel.mul(dt));
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.pos.x - 2, this.pos.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        this.camera = { x: 0, y: 0 };
        this.vfx = new VFXManager();

        this.input = new InputManager();
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.progression = new ProgressionManager();

        this.world = new World(this.width, this.height);
        this.bossManager = new BossManager();
        this.uiManager = new UIManager(this);
        this.applyOptions();

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.score = 0;
        this.wave = 1;

        this.player = null;
        this.core = null;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.echoes = [];

        this.isRecording = false;
        this.echoCooldown = 0;
        this.echoColors = ['#ff00ff', '#00ff00', '#ffff00'];
        this.currentEchoColor = 0;

        this.spawnTimer = 0;

        this.lastTime = performance.now();

        this.resize();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas.parentElement || document.body);

        window.addEventListener('resize', () => this.resize());

        // Ensure keys trigger things
        window.addEventListener('keydown', (e) => {
            if (this.state === 'UPGRADE') {
                if (e.code === 'Digit1' && this.progression.selectUpgrade(this, 0)) {
                    this.wave++;
                    this.state = 'PLAYING';
                } else if (e.code === 'Digit2' && this.progression.selectUpgrade(this, 1)) {
                    this.wave++;
                    this.state = 'PLAYING';
                } else if (e.code === 'Digit3' && this.progression.selectUpgrade(this, 2)) {
                    this.wave++;
                    this.state = 'PLAYING';
                }
            } else if (this.state === 'TITLE' && e.code === 'Enter') {
                this.sound.init();
                this.sound.resume();
                this.sound.start();
                this.sound.startBGM();
                this.resetGame();
                this.state = 'PLAYING';
            } else if (this.state === 'PLAYING' && e.code === 'KeyP') {
                this.state = 'PAUSED';
            } else if (this.state === 'PAUSED' && e.code === 'KeyP') {
                this.state = 'PLAYING';
            } else if (this.state === 'GAME_OVER' && e.code === 'Enter') {
                this.state = 'TITLE';
            } else if (this.state === 'PLAYING' && e.code === 'KeyE') {
                this.deployEcho();
            }
        });

        // Touch to start
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.state === 'TITLE') {
                this.sound.init();
                this.sound.resume();
                this.sound.start();
                this.sound.startBGM();
                this.resetGame();
                this.state = 'PLAYING';
            } else if (this.state === 'GAME_OVER') {
                this.state = 'TITLE';
            }
        }, {passive: false});

        requestAnimationFrame((t) => this.loop(t));
    }


    applyOptions() {
        let opts = this.saveManager.data.options;
        if (this.sound && this.sound.initialized) {
            this.sound.masterGain.gain.value = opts.masterMute ? 0 : 1.0;
            this.sound.sfxGain.gain.value = opts.sfxVol !== undefined ? opts.sfxVol : 1.0;
            this.sound.musicGain.gain.value = opts.musicVol !== undefined ? opts.musicVol : 0.5;
        }
    }

    resize() {
        let aspect = this.width / this.height;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > aspect) {
            this.canvas.height = h;
            this.canvas.width = h * aspect;
        } else {
            this.canvas.width = w;
            this.canvas.height = w / aspect;
        }
    }

    resetGame() {
        this.player = new Player(this.width/2 + 100, this.height/2);
        this.core = new Core(this.width/2, this.height/2);
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.echoes = [];
        this.score = 0;
        this.wave = 1;
        this.isRecording = true; // Always recording in phase 1
        this.echoCooldown = 0;
        this.world.reset();
    }

    deployEcho() {
        if (this.echoCooldown > 0) return;
        if (this.player.history.length === 0) return;
        if (this.sound && this.sound.abilityUse) this.sound.abilityUse();

        let color = this.echoColors[this.currentEchoColor % this.echoColors.length];
        this.currentEchoColor++;

        // Deep copy history
        let historyCopy = this.player.history.map(h => ({t: h.t, pos: h.pos.copy(), shootDir: h.shootDir ? h.shootDir.copy() : null}));

        this.echoes.push(new Echo(historyCopy, color));

        // Reset player recording
        this.player.history = [];
        this.player.recordingTime = 0;

        this.echoCooldown = 10; // 10 seconds cooldown
        this.sound.echoSpawn();
    }

    spawnBullet(pos, dir, isPlayer, color) {
        this.bullets.push(new Bullet(pos.x, pos.y, dir, isPlayer, color));
    }

    spawnParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    loop(time) {
        let dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        if (this.vfx) this.vfx.update(dt, this);

        if (this.vfx && this.vfx.hitStopTimer > 0) {
            this.draw();
            requestAnimationFrame((t) => this.loop(t));
            return;
        }

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.world) this.world.update(dt, this);
        if (this.sound) {
            this.sound.bossMode = (this.bosses && this.bosses.length > 0);
            this.sound.lowHpMode = (this.core && this.core.hp < this.core.maxHp * 0.3);
            this.sound.updateBGM();
        }

        if (this.state !== 'PLAYING') return;

        if (this.echoCooldown > 0) {
            let reduction = this.player.echoCooldownReduction || 0;
            this.echoCooldown -= dt * (1 + reduction * 0.1);
        }

        if (this.core.regenRate) {
            this.core.hp = Math.min(this.core.maxHp, this.core.hp + this.core.regenRate * dt);
        }

        this.player.update(dt, this.input, this);
        this.progression.update(dt, this);
        this.uiManager.update(dt);

        // Camera follow core, static for now
        this.camera.x = 0;
        this.camera.y = 0;

        this.echoes.forEach(e => e.update(dt, this));
        this.echoes = this.echoes.filter(e => e.active);

        this.bullets.forEach(b => b.update(dt, this));

        this.bossManager.update(dt, this);

        // Wave spawning
        if (!this.bossManager.bossWaveActive) {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                let side = Math.floor(Math.random() * 4);
                let ex, ey;
                if (side === 0) { ex = Math.random() * this.width; ey = -20; }
                else if (side === 1) { ex = this.width + 20; ey = Math.random() * this.height; }
                else if (side === 2) { ex = Math.random() * this.width; ey = this.height + 20; }
                else { ex = -20; ey = Math.random() * this.height; }

                let type = Math.random() > 0.8 ? 'big' : 'normal';

                let r = Math.random();
                let enemy;

                // Dynamic spawn weights based on wave progression
                let w = Math.min(1.0, this.wave / 20.0);
                let swarmerW = 0.4 - w * 0.1;
                let sniperW = 0.2 + w * 0.05;
                let bruiserW = 0.2 + w * 0.05;
                let splitterW = 0.1 + w * 0.1;
                // Hazard gets remainder (0.1 -> 0)

                if (r < swarmerW) enemy = new SwarmerEnemy(ex, ey);
                else if (r < swarmerW + sniperW) enemy = new SniperEnemy(ex, ey);
                else if (r < swarmerW + sniperW + bruiserW) enemy = new BruiserEnemy(ex, ey);
                else if (r < swarmerW + sniperW + bruiserW + splitterW) enemy = new SplitterEnemy(ex, ey);
                else enemy = new HazardEnemy(ex, ey);
                this.enemies.push(enemy);

                // Smoother spawn timer scaling (asymptotic approach to 0.4s)
                this.spawnTimer = Math.max(0.4, 2.5 * Math.pow(0.9, this.wave - 1));
            }
        }

        this.enemies.forEach(e => e.update(dt, this));

        // Collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            if (!b.active) continue;

            if (b.isPlayer) {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    let e = this.enemies[j];
                    if (!e.active) continue;
                    if (b.pos.dist(e.pos) < b.radius + e.radius) {
                        e.takeDamage(10);
                        b.active = false;
                        this.spawnParticles(b.pos.x, b.pos.y, '#ffffff', 5);

                        if (this.vfx) {
                            this.vfx.spawnHitSparks(b.pos.x, b.pos.y, b.vel.x, b.vel.y, 5, '#ffffff');
                            this.vfx.spawnFloatingText(e.pos.x, e.pos.y - 15, '10', '#ffffff');
                        }

                        this.sound.hit();
                        if (e.hp <= 0) {
                            e.die(this);
                            e.active = false;
                            this.score += e.value;
                            this.spawnParticles(e.pos.x, e.pos.y, e.color, 15);

                            if (this.vfx) {
                                this.vfx.spawnExplosion(e.pos.x, e.pos.y, e.color, 20);
                                this.vfx.shakeScreen(5, 0.2);
                                this.vfx.hitStop(0.04);
                            }

                            if (Math.random() < 0.2) this.progression.spawnPickup(e.pos.x, e.pos.y);
                            this.progression.addCombo(1);

                            if (this.score > this.wave * 200) {
                                this.state = 'UPGRADE';
                                this.progression.triggerDraft();
                            }
                        }
                        break;
                    }
                }
            } else {
                if (b.pos.dist(this.player.pos) < b.radius + this.player.radius) {
                    if (this.player.invulnerableTimer <= 0) {
                        this.core.takeDamage(5);
                    }
                    b.active = false;
                }
            }
        }

        // Enemy vs Player collision (enemies damaging core via player proxy)
        for (let j = this.enemies.length - 1; j >= 0; j--) {
            let e = this.enemies[j];
            if (!e.active) continue;
            if (e.pos.dist(this.player.pos) < e.radius + this.player.radius) {
                 if (this.player.invulnerableTimer <= 0) {
                     this.core.takeDamage(10);
                     // Briefly make invulnerable so we don't drain HP in 1 frame
                     this.player.invulnerableTimer = 0.5;
                 }
            }
        }

        this.bullets = this.bullets.filter(b => b.active);
        this.enemies = this.enemies.filter(e => e.active);

        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.active);

        if (this.core.hp <= 0) {
            this.state = 'GAME_OVER';
            this.sound.stopBGM();
            this.sound.gameOver();
            if (this.score > this.saveManager.data.highScore) {
                this.saveManager.data.highScore = this.score;
            }
            this.saveManager.save();
        }
    }

    draw() {
        this.ctx.fillStyle = '#0b0b1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.scale(this.canvas.width / this.width, this.canvas.height / this.height);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        if (this.vfx) this.vfx.applyShake(this.ctx);

        if (this.world) {
            this.world.drawBackground(this.ctx);
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER' || this.state === 'UPGRADE') {
            if (this.world) {
                this.world.drawHazards(this.ctx);
            }
            this.core.draw(this.ctx);
            this.echoes.forEach(e => e.draw(this.ctx));
            if (this.state !== 'GAME_OVER') {
                this.player.draw(this.ctx);
            }
            this.enemies.forEach(e => e.draw(this.ctx));
            this.bullets.forEach(b => b.draw(this.ctx));
            this.particles.forEach(p => p.draw(this.ctx));

            if (this.vfx) this.vfx.draw(this.ctx, this);

            this.bossManager.draw(this.ctx, this);

            // HUD
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.font = '20px Courier New';
            this.ctx.fillText(`SCORE: ${this.score}`, 10, 30);
            this.ctx.fillText(`WAVE: ${this.wave}`, 10, 60);

            if (this.echoCooldown <= 0) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillText(`ECHO READY (Press E / Deploy button)`, this.width/2 - 150, 30);
            } else {
                this.ctx.fillStyle = 'red';
                this.ctx.fillText(`ECHO COOLDOWN: ${Math.ceil(this.echoCooldown)}s`, this.width/2 - 100, 30);
            }

            // Dash HUD
            if (this.player && this.player.dashTimer <= 0) {
                this.ctx.fillStyle = '#00ffff';
                this.ctx.fillText(`DASH READY (Shift)`, 10, 90);
            } else if (this.player) {
                this.ctx.fillStyle = 'gray';
                this.ctx.fillText(`DASH: ${Math.ceil(this.player.dashTimer)}s`, 10, 90);
            }

            this.progression.draw(this.ctx, this);
            if (this.uiManager) this.uiManager.draw(this.ctx);

            // Draw Virtual Joysticks if active
            this.drawJoysticks();
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('NEON ECHO PROTOCOL', this.width/2, this.height/2 - 50);
            this.ctx.font = '20px Courier New';
            this.ctx.fillText('Press ENTER or Tap to Start', this.width/2, this.height/2 + 20);
            this.ctx.fillText('WASD/Arrows to Move, Mouse/Arrows to Aim/Shoot', this.width/2, this.height/2 + 60);
            this.ctx.fillText('Press E to deploy an Echo of your past actions', this.width/2, this.height/2 + 90);
            if (this.uiManager) this.uiManager.draw(this.ctx);
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('PAUSED', this.width/2, this.height/2);
            this.ctx.font = '20px Courier New';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height/2 + 40);
            if (this.uiManager) this.uiManager.draw(this.ctx);
        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff0055';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('CORE DESTROYED', this.width/2, this.height/2 - 50);
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.font = '20px Courier New';
            this.ctx.fillText(`FINAL SCORE: ${this.score}`, this.width/2, this.height/2);
            this.ctx.fillText(`HIGH SCORE: ${this.saveManager.data.highScore}`, this.width/2, this.height/2 + 30);
            this.ctx.fillText('Press ENTER or Tap to Return to Title', this.width/2, this.height/2 + 70);
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height/2 + 110);
            if (this.uiManager) this.uiManager.draw(this.ctx);
        }

        this.ctx.textAlign = 'left';
        this.ctx.restore();
    }

    drawJoysticks() {
        let opts = this.saveManager.data.options;
        let mode = opts.touchMode || 'Auto';
        let isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (mode === 'Off') return;
        if (mode === 'Auto' && !isTouch && this.input.touches.length === 0) return;

        let leftH = opts.leftHanded || false;

        if (this.input.leftStick.active) {
            this.ctx.beginPath();
            this.ctx.arc(this.input.leftStick.base.x * (this.width / this.canvas.width), this.input.leftStick.base.y * (this.height / this.canvas.height), 50, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(this.input.leftStick.pos.x * (this.width / this.canvas.width), this.input.leftStick.pos.y * (this.height / this.canvas.height), 20, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
        }
        if (this.input.rightStick.active) {
            this.ctx.beginPath();
            this.ctx.arc(this.input.rightStick.base.x * (this.width / this.canvas.width), this.input.rightStick.base.y * (this.height / this.canvas.height), 50, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(this.input.rightStick.pos.x * (this.width / this.canvas.width), this.input.rightStick.pos.y * (this.height / this.canvas.height), 20, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
        }

        this.input.dashTouched = false;
        // Touch button for echo and dash if touch is active
        if (this.input.touches.length > 0) {
            // Swap if leftHanded is true
            let echoX = leftH ? this.width/2 - 100 : this.width/2 + 20;
            let dashX = leftH ? this.width/2 + 20 : this.width/2 - 100;

            this.ctx.fillStyle = this.echoCooldown <= 0 ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(echoX, this.height - 80, 80, 60);
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('ECHO', echoX + 40, this.height - 45);

            let dashTimer = this.player ? this.player.dashTimer : 0;
            this.ctx.fillStyle = dashTimer <= 0 ? 'rgba(0, 255, 255, 0.5)' : 'rgba(128, 128, 128, 0.5)';
            this.ctx.fillRect(dashX, this.height - 80, 80, 60);
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('DASH', dashX + 40, this.height - 45);

            this.ctx.textAlign = 'left';

            // Basic touch check for button
            for(let t of this.input.touches) {
                let tx = t.clientX * (this.width / this.canvas.width);
                let ty = t.clientY * (this.height / this.canvas.height);
                if (tx > echoX && tx < echoX + 80 && ty > this.height - 80 && ty < this.height - 20) {
                    if (this.echoCooldown <= 0) {
                        this.deployEcho();
                    }
                }
                if (tx > dashX && tx < dashX + 80 && ty > this.height - 80 && ty < this.height - 20) {
                    this.input.dashTouched = true;
                }
            }
        }
    }
}

window.onload = () => {
    window.game = new Game();
};
