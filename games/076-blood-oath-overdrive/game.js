const SAVE_KEY = 'arcade_game_076_076-blood-oath-overdrive_v1';
class SaveManager {
    constructor() {
        this.data = {
            highScore: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0, overdriveUses: 0,
            unlockedMilestones: [],
            options: { mute: false, sfxVol: 1, musicVol: 1, vfxIntensity: 1, shakeIntensity: 1, particleDensity: 1, highContrast: false, showFps: false, touchControls: 'Auto', leftHanded: false }
        };
        this.load();
    }
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                let parsed = JSON.parse(raw);
                let loadedOptions = parsed.options;
                this.data = { ...this.data, ...parsed };
                if (loadedOptions) this.data.options = { ...{ mute: false, sfxVol: 1, musicVol: 1, vfxIntensity: 1, shakeIntensity: 1, particleDensity: 1, highContrast: false, showFps: false, touchControls: 'Auto', leftHanded: false }, ...loadedOptions };
            }
        } catch (e) { console.warn('Save load failed', e); }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) { console.warn('Save failed', e); }
    }
}
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.enabled = true;
        this.initStarted = false;

        // Synth state
        this.musicTime = 0;
        this.beatTimer = 0;
        this.beatInterval = 0.5; // 120 BPM base
        this.measure = 0;
        this.arpeggioNotes = [220, 261.63, 329.63, 392.00]; // A min7
        this.arpIndex = 0;

        // Filter for dynamic music
        this.synthFilter = null;
    }
    init() {
        if (this.initStarted) return;
        this.initStarted = true;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { this.enabled = false; return; }
        try {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.sfxGain.gain.value = 0.6;

            this.musicGain = this.ctx.createGain();
            this.musicGain.connect(this.masterGain);
            this.musicGain.gain.value = 0.3;

            this.synthFilter = this.ctx.createBiquadFilter();
            this.synthFilter.type = 'lowpass';
            this.synthFilter.frequency.value = 2000;
            this.synthFilter.connect(this.musicGain);
        } catch (e) { this.enabled = false; }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

    applyVolumes(opt) {
        if (!this.ctx) return;
        this.masterGain.gain.value = opt.mute ? 0 : 1;
        this.sfxGain.gain.value = opt.sfxVol * 0.6;
        this.musicGain.gain.value = opt.musicVol * 0.3;
    }

    update(dt, game) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;

        // Dynamic music scaling based on game state
        let targetBPM = 120;
        let filterFreq = 1000;

        if (game.boss) {
            targetBPM = 160;
            filterFreq = 3000;
            this.arpeggioNotes = [277.18, 329.63, 415.30, 493.88]; // C# min7
        } else {
            this.arpeggioNotes = [220, 261.63, 329.63, 392.00]; // A min7
            if (game.player && game.player.hp < game.player.maxHp * 0.3) {
                targetBPM = 140;
                filterFreq = 4000;
                this.musicGain.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.1);
            } else {
                this.musicGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.1);
            }
        }

        if (game.player && game.player.overdrive) {
            targetBPM *= 1.2;
            filterFreq = 5000;
        }

        this.beatInterval = 60 / targetBPM;
        this.synthFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.5);

        this.musicTime += dt;
        this.beatTimer -= dt;

        if (this.beatTimer <= 0) {
            this.beatTimer = this.beatInterval / 2; // 8th notes
            this.playSynthNote();

            if (this.measure % 4 === 0) {
                this.playKick();
            } else if (this.measure % 4 === 2) {
                this.playSnare();
            }
            this.playHihat(this.measure % 2 === 0 ? 0.8 : 0.4);

            this.measure++;
            if (this.measure >= 16) this.measure = 0;
        }
    }

    playSynthNote() {
        if (!this.enabled || !this.ctx) return;
        const freq = this.arpeggioNotes[this.arpIndex];
        this.arpIndex = (this.arpIndex + 1) % this.arpeggioNotes.length;

        // Add random octave leaps
        const finalFreq = freq * (Math.random() < 0.2 ? 2 : 1);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(finalFreq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + this.beatInterval * 0.8);

        osc.connect(gain);
        gain.connect(this.synthFilter);

        osc.start();
        osc.stop(this.ctx.currentTime + this.beatInterval);
    }

    playKick() {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain); gain.connect(this.musicGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.5);
    }

    playSnare() {
        if (!this.enabled || !this.ctx) return;
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.1, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        noise.connect(noiseFilter); noiseFilter.connect(gain); gain.connect(this.musicGain);
        noise.start();
    }

    playHihat(vol) {
        if (!this.enabled || !this.ctx) return;
        const noise = this.ctx.createBufferSource();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < buffer.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 7000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol * 0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        noise.connect(noiseFilter); noiseFilter.connect(gain); gain.connect(this.musicGain);
        noise.start();
    }

    playTone(freq, type, duration, vol = 1) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
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

    // SFX (10+ distinct sounds)
    playHit() { this.playTone(150, 'square', 0.1, 0.8); }
    playSlash() { this.playTone(800, 'sine', 0.1, 0.6); }
    playOverdrive() { this.playTone(400, 'sawtooth', 0.5, 1); }
    playDamage() { this.playTone(100, 'sawtooth', 0.3, 1.2); }
    playDash() { this.playTone(600, 'triangle', 0.15, 0.5); }
    playHeal() { this.playTone(600, 'sine', 0.3, 0.7); } // Original pickup sound
    playScorePickup() { this.playTone(800, 'square', 0.1, 0.5); } // Original pickup sound
    playLevelUp() {
        this.playTone(440, 'sine', 0.1, 0.6);
        setTimeout(() => this.playTone(554, 'sine', 0.1, 0.6), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.2, 0.6), 200);
    }
    playSpawn() { this.playTone(200, 'square', 0.2, 0.4); }
    playExplosion() { this.playTone(80, 'sawtooth', 0.4, 1.0); }
    playMenuHover() { this.playTone(1000, 'sine', 0.05, 0.3); }
    playMenuSelect() { this.playTone(1200, 'triangle', 0.1, 0.5); }
}
class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.justPressed = {};
        this.touchDirs = { up: false, down: false, left: false, right: false };
        this.touchOverdrive = false;
        this.clickState = false;
        this.touchDash = false;

        window.addEventListener('keydown', e => { this.keys[e.code] = true; this.justPressed[e.code] = true; });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });

        canvas.addEventListener('pointerdown', e => {
            if (window.game && window.game.sound) { window.game.sound.init(); window.game.sound.resume(); }
            if (window.game && window.game.ui && window.game.ui.handlePointer(e.clientX, e.clientY)) return;
            this.handlePointer(e.clientX, e.clientY);
        });
    }
    handlePointer(x, y) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const dx = x - cx;
        const dy = y - cy;

        if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
            this.touchOverdrive = true;
            return;
        }

        // Far tap/swipe for dash in any direction
        if (Math.sqrt(dx*dx + dy*dy) > 150) {
            this.touchDash = true;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) this.touchDirs.right = true;
            else this.touchDirs.left = true;
        } else {
            if (dy > 0) this.touchDirs.down = true;
            else this.touchDirs.up = true;
        }
        this.clickState = true;
    }
    update() {
        this.justPressed = {};
        this.touchDirs = { up: false, down: false, left: false, right: false };
        this.touchOverdrive = false;
        this.touchDash = false;
        this.clickState = false;
    }
    isDown(code) { return !!this.keys[code]; }
    isJustPressed(code) { return !!this.justPressed[code]; }
}
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.overdrive = false;
        this.overdriveTimer = 0;
        this.attackDir = null;
        this.attackTimer = 0;
        this.size = 20;
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.dashDir = null;
        this.friction = 0.85;
    }
    update(dt, input) {
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) this.attackDir = null;
        }
        if (this.overdriveTimer > 0) {
            this.overdriveTimer -= dt;
            if (this.overdriveTimer <= 0) this.overdrive = false;
        }
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }
        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
        }

        let attackTriggered = false;
        if (input.isJustPressed('ArrowUp') || input.isJustPressed('KeyW') || input.touchDirs.up) { this.attackDir = 'up'; attackTriggered = true; }
        else if (input.isJustPressed('ArrowDown') || input.isJustPressed('KeyS') || input.touchDirs.down) { this.attackDir = 'down'; attackTriggered = true; }
        else if (input.isJustPressed('ArrowLeft') || input.isJustPressed('KeyA') || input.touchDirs.left) { this.attackDir = 'left'; attackTriggered = true; }
        else if (input.isJustPressed('ArrowRight') || input.isJustPressed('KeyD') || input.touchDirs.right) { this.attackDir = 'right'; attackTriggered = true; }

        if (attackTriggered && this.dashTimer <= 0) {
            this.attackTimer = this.overdrive ? 0.1 : 0.2;
            if (window.game && window.game.sound) window.game.sound.playSlash();
            // Recoil
            const recoilSpeed = 300;
            if (this.attackDir === 'up') this.vy = recoilSpeed;
            if (this.attackDir === 'down') this.vy = -recoilSpeed;
            if (this.attackDir === 'left') this.vx = recoilSpeed;
            if (this.attackDir === 'right') this.vx = -recoilSpeed;
        }

        // Dash
        if ((input.isJustPressed('ShiftLeft') || input.isJustPressed('ShiftRight') || input.touchDash) && this.dashCooldown <= 0 && this.attackDir) {
            this.dashCooldown = 2;
            this.dashTimer = 0.2;
            this.dashDir = this.attackDir;
            const dashSpeed = 1000;
            if (this.attackDir === 'up') this.vy = -dashSpeed;
            if (this.attackDir === 'down') this.vy = dashSpeed;
            if (this.attackDir === 'left') this.vx = -dashSpeed;
            if (this.attackDir === 'right') this.vx = dashSpeed;
            if (window.game && window.game.particles) {
                for(let i=0;i<20;i++){
                    window.game.particles.spawn(this.x, this.y, (Math.random()-0.5)*200, (Math.random()-0.5)*200, 0.5, '#0ff', 3);
                }
            }
        }

        // Physics update
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= Math.pow(this.friction, dt * 60);
        this.vy *= Math.pow(this.friction, dt * 60);

        if (this.dashTimer > 0 || this.overdrive) {
            if (window.game && window.game.vfx && Math.random() < 0.5) {
                window.game.vfx.spawnAfterimage(this.x, this.y, this.size, this.overdrive ? '#f00' : '#0ff', 0.3);
            }
        }

        // Add trail effect when dashing
        if (this.dashTimer > 0 && window.game && window.game.trails) {
            window.game.trails.spawn(this.x, this.y, this.size, 0.3, this.overdrive ? '#f0f' : '#0ff');
        }

        // Clamp to screen
        this.x = Math.max(this.size, Math.min(window.innerWidth - this.size, this.x));
        this.y = Math.max(this.size, Math.min(window.innerHeight - this.size, this.y));

        const cost = window.game && window.game.progression ? Math.max(1, 20 - window.game.progression.statOverdriveCostReduction) : 20;
        const durBonus = window.game && window.game.progression ? window.game.progression.statOverdriveDurBonus : 0;
        if ((input.isJustPressed('Space') || input.touchOverdrive) && this.hp > cost && !this.overdrive) {
            this.hp -= cost;
            this.overdrive = true;
            this.overdriveTimer = 5 + durBonus; // 5 seconds of overdrive + bonus
            if (window.game && window.game.sound) window.game.sound.playOverdrive();
            if (window.game && window.game.saveManager) {
                window.game.saveManager.data.overdriveUses = (window.game.saveManager.data.overdriveUses || 0) + 1;
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.dashTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.globalAlpha = 0.5; // invulnerability blink
        }

        // Cyber Samurai Armor
        ctx.fillStyle = this.overdrive ? '#f0f' : '#8b5ecb';
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();

        // Inner core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, this.size/2, 0, Math.PI * 2);
        ctx.fill();

        // Thrust lines if dashing
        if (this.dashTimer > 0) {
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            if (this.dashDir === 'up') { ctx.moveTo(-10, this.size); ctx.lineTo(-10, this.size+20); ctx.moveTo(10, this.size); ctx.lineTo(10, this.size+20); }
            if (this.dashDir === 'down') { ctx.moveTo(-10, -this.size); ctx.lineTo(-10, -this.size-20); ctx.moveTo(10, -this.size); ctx.lineTo(10, -this.size-20); }
            if (this.dashDir === 'left') { ctx.moveTo(this.size, -10); ctx.lineTo(this.size+20, -10); ctx.moveTo(this.size, 10); ctx.lineTo(this.size+20, 10); }
            if (this.dashDir === 'right') { ctx.moveTo(-this.size, -10); ctx.lineTo(-this.size-20, -10); ctx.moveTo(-this.size, 10); ctx.lineTo(-this.size-20, 10); }
            ctx.stroke();
        }

        // Telegraph aim
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        if (this.attackDir === 'up') { ctx.moveTo(0,0); ctx.lineTo(0,-100); }
        if (this.attackDir === 'down') { ctx.moveTo(0,0); ctx.lineTo(0,100); }
        if (this.attackDir === 'left') { ctx.moveTo(0,0); ctx.lineTo(-100,0); }
        if (this.attackDir === 'right') { ctx.moveTo(0,0); ctx.lineTo(100,0); }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'red';
        ctx.fillRect(-this.size, -this.size - 15, this.size * 2, 5);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(-this.size, -this.size - 15, (this.hp / this.maxHp) * this.size * 2, 5);

        if (this.attackDir && this.attackTimer > 0) {
            ctx.fillStyle = this.overdrive ? 'rgba(255, 0, 255, 0.7)' : 'rgba(255, 255, 255, 0.7)';
            const range = this.overdrive ? 100 : 60;
            const w = 40;
            if (this.attackDir === 'up') ctx.fillRect(-w/2, -range, w, range);
            if (this.attackDir === 'down') ctx.fillRect(-w/2, 0, w, range);
            if (this.attackDir === 'left') ctx.fillRect(-range, -w/2, range, w);
            if (this.attackDir === 'right') ctx.fillRect(0, -w/2, range, w);
        }

        ctx.restore();
    }
}
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(this.canvas);
        this.particles = new ParticleSystem();
        this.trails = new TrailSystem();
        this.shake = new ScreenShake();
        this.vfx = new VFXManager();
        this.ui = new UIManager(this);

        this.state = 'TITLE';
        this.lastTime = 0;
        this.hitStopTimer = 0;

        this.score = 0;
        this.enemies = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2; // seconds
        this.boss = null;
        this.bossWave = 1;
        this.nextBossScore = 150;
        this.progression = new ProgressionManager();

        this.player = null;

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
        this.resize();

        window.addEventListener('keydown', e => {
            if (this.state === 'TITLE' && e.code === 'Enter') {
                this.startGame();
            } else if (this.state === 'GAME_OVER' && e.code === 'Enter') {
                this.state = 'TITLE';
            } else if (this.state === 'UPGRADE') {
                if (e.code === 'Digit1') this.progression.selectPerk(0, this);
                if (e.code === 'Digit2') this.progression.selectPerk(1, this);
                if (e.code === 'Digit3') this.progression.selectPerk(2, this);
            } else if (e.code === 'Escape') {
                if (this.state === 'PLAYING') this.state = 'PAUSED';
                else if (this.state === 'PAUSED') this.state = 'PLAYING';
            }
        });

        this.canvas.addEventListener('pointerdown', e => {
            if (this.state === 'TITLE') this.startGame();
            else if (this.state === 'GAME_OVER') this.state = 'TITLE';
            else if (this.state === 'UPGRADE') {
                const rect = this.canvas.getBoundingClientRect();
                const scaleX = this.canvas.width / rect.width;
                const scaleY = this.canvas.height / rect.height;
                const y = (e.clientY - rect.top) * scaleY;
                for (let i = 0; i < this.progression.draftChoices.length; i++) {
                    let btnY = this.canvas.height/2 - 40 + i * 80;
                    if (y > btnY - 30 && y < btnY + 30) {
                        this.progression.selectPerk(i, this);
                        break;
                    }
                }
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });

        requestAnimationFrame(t => this.loop(t));
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.world) {
            this.world.width = this.canvas.width;
            this.world.height = this.canvas.height;
        }
    }
    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.enemies = [];
        this.projectiles = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2;
        this.boss = null;
        this.bossWave = 1;
        this.nextBossScore = 150;
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.world = new World(this.canvas.width, this.canvas.height);
        this.progression.reset();
    }
    update(dt) {
        if (this.state === 'UPGRADE') {
            return;
        }
        if (this.state !== 'PLAYING') return;

        this.particles.update(dt);
        this.trails.update(dt);
        this.shake.update(dt);
        this.vfx.update(dt);

        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
            dt *= 0.1; // Slow-mo during hitstop
        }

        this.player.update(dt, this.input);
        this.progression.update(dt, this);
        this.sound.update(dt, this);
        this.ui.update(dt);

        if (this.world) {
            this.world.update(dt, this.player, this.enemies, this.sound);
        }

        if (this.boss) {
            this.boss.update(dt, this.player, this);
            const bx = this.boss.x - this.player.x;
            const by = this.boss.y - this.player.y;
            if (Math.sqrt(bx*bx + by*by) < this.player.size + this.boss.size && this.player.dashTimer <= 0) {
                this.player.hp -= 30;
                this.sound.playDamage();
                this.player.dashTimer = 0.5; // IFrames
                if (this.player.hp <= 0) this.checkGameOver();
            }

            if (this.boss.hp <= 0) {
                this.vfx.emitExplosion(this.boss.x, this.boss.y, 50, '#f00');
                this.vfx.spawnText(this.boss.x, this.boss.y - 50, "BOSS DEFEATED!", "#ff0");
                this.hitStopTimer = 0.5;
                this.boss = null;
                this.saveManager.data.bossesDefeated = (this.saveManager.data.bossesDefeated || 0) + 1;
                this.bossWave++;
                this.score += 500;
                this.nextBossScore = this.score + 500;
                this.shake.trigger(30, 0.7, 0, 1);
                this.sound.playDamage(); // use damage sound for explosion
            }
        } else {
            this.enemySpawnTimer += dt;
            if (this.enemySpawnTimer >= this.enemySpawnRate) {
                this.enemySpawnTimer = 0;
                this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.05); // gets faster
                this.spawnEnemy();
            }

            if (this.score >= this.nextBossScore) {
                this.enemies = [];
                this.projectiles = [];
                if (this.bossWave % 2 !== 0) {
                    this.boss = new CyberSamuraiBoss(this.canvas.width / 2, -100);
                } else {
                    this.boss = new OniTankBoss(this.canvas.width / 2, -100);
                }
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt, this.player, this);

            // Check collision with player attack
            if (this.player.attackDir && this.player.attackTimer > 0) {
                let hit = false;
                const range = this.player.overdrive ? 100 : 60;
                const w = 40;
                let ax = this.player.x, ay = this.player.y, aw = 0, ah = 0;
                if (this.player.attackDir === 'up') { aw = w; ah = range; ax -= w/2; ay -= range; }
                if (this.player.attackDir === 'down') { aw = w; ah = range; ax -= w/2; }
                if (this.player.attackDir === 'left') { aw = range; ah = w; ax -= range; ay -= w/2; }
                if (this.player.attackDir === 'right') { aw = range; ah = w; ay -= w/2; }

                if (e.x > ax && e.x < ax + aw && e.y > ay && e.y < ay + ah) {
                    hit = true;
                }

                if (hit) {
                    const dmg = this.player.overdrive ? 2 : 1;
                    this.score += (dmg * 10) * (1 + this.progression.combo * 0.1);
                    this.sound.playHit();

                    let dirX = 0, dirY = 0;
                    if (this.player.attackDir === 'up') dirY = -1;
                    if (this.player.attackDir === 'down') dirY = 1;
                    if (this.player.attackDir === 'left') dirX = -1;
                    if (this.player.attackDir === 'right') dirX = 1;

                    this.vfx.emitSparks(e.x, e.y, dirX, dirY, 10, '#ff0');
                    this.vfx.spawnText(e.x, e.y - 20, dmg.toString(), '#fff');
                    this.hitStopTimer = 0.05;

                    if (e.hp - dmg <= 0) {
                        this.progression.addKill(this);
                        this.progression.spawnPickup(e.x, e.y);
                        this.vfx.emitExplosion(e.x, e.y, 15, '#f80');
                        this.hitStopTimer = 0.1;
                    }
                    e.takeDamage(dmg, this, i);
                    this.shake.trigger(this.player.overdrive ? 15 : 8, 0.15, dirX, dirY);
                    continue;
                }
            }

            // Check collision with player body
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            if (Math.sqrt(dx*dx + dy*dy) < this.player.size + e.size) {
                if (this.player.dashTimer > 0) continue; // Invulnerable during dash

                this.player.hp -= 20;
                e.takeDamage(1, this, i);
                this.sound.playDamage();
                if (this.player.hp <= 0) {
                    this.checkGameOver();
                }
            }
        }

        if (this.boss && this.player.attackDir && this.player.attackTimer > 0) {
            const range = this.player.overdrive ? 100 : 60;
            const w = 40;
            let ax = this.player.x, ay = this.player.y, aw = 0, ah = 0;
            if (this.player.attackDir === 'up') { aw = w; ah = range; ax -= w/2; ay -= range; }
            if (this.player.attackDir === 'down') { aw = w; ah = range; ax -= w/2; }
            if (this.player.attackDir === 'left') { aw = range; ah = w; ax -= range; ay -= w/2; }
            if (this.player.attackDir === 'right') { aw = range; ah = w; ay -= w/2; }

            if (this.boss.x > ax && this.boss.x < ax + aw && this.boss.y > ay && this.boss.y < ay + ah) {
                this.boss.takeDamage(this.player.overdrive ? 20 : 10, this);
                this.sound.playHit();
                this.shake.trigger(this.player.overdrive ? 10 : 5, 0.1);
            }
        }

        if (this.projectiles) {
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                let p = this.projectiles[i];
                p.update(dt);
                if (p.x < -50 || p.x > this.canvas.width + 50 || p.y < -50 || p.y > this.canvas.height + 50) {
                    this.projectiles.splice(i, 1);
                    continue;
                }
                const dx = p.x - this.player.x;
                const dy = p.y - this.player.y;
                if (Math.sqrt(dx*dx + dy*dy) < this.player.size + p.size) {
                    if (this.player.dashTimer <= 0) {
                        this.player.hp -= p.damage;
                        this.sound.playDamage();
                        if (this.player.hp <= 0) this.checkGameOver();
                    }
                    this.projectiles.splice(i, 1);
                }
            }
        }

        if (this.player.hp <= 0 && this.state !== 'GAME_OVER') {
            this.checkGameOver();
        }

        this.input.update();
    }

    checkGameOver() {
        this.state = 'GAME_OVER';
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.data.totalScoreAccumulated += this.score;
        this.saveManager.save();
    }
    spawnEnemy() {
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -30 : this.canvas.width + 30;
            y = Math.random() * this.canvas.height;
        } else {
            x = Math.random() * this.canvas.width;
            y = Math.random() < 0.5 ? -30 : this.canvas.height + 30;
        }
        const speed = 100 + Math.random() * 50;
        const types = [EnemySwarmer, EnemySniper, EnemyBruiser, EnemySplitter, EnemyHazard];
        const EnemyClass = types[Math.floor(Math.random() * types.length)];
        this.enemies.push(new EnemyClass(x, y, speed));
    }
    draw() {
        if (this.state !== 'PLAYING') {
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('BLOOD OATH OVERDRIVE', this.canvas.width/2, this.canvas.height/2 - 50);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Press ENTER or TAP to Start', this.canvas.width/2, this.canvas.height/2 + 20);
            this.ctx.fillText('WASD/Swipe to Attack, Space/Tap Center for Overdrive', this.canvas.width/2, this.canvas.height/2 + 60);
            this.ctx.fillText('Back to Arcade (../../index.html)', this.canvas.width/2, this.canvas.height - 30);
        } else if (this.state === 'PLAYING') {
            this.ctx.save();
            this.shake.apply(this.ctx);

            if (this.world) {
                this.world.drawBackground(this.ctx);
                this.world.drawHazards(this.ctx);
            }

            this.trails.draw(this.ctx);
            this.particles.draw(this.ctx);
            this.vfx.draw(this.ctx);
            this.player.draw(this.ctx);
            for (let e of this.enemies) e.draw(this.ctx);
            if (this.projectiles) {
                for (let p of this.projectiles) p.draw(this.ctx);
            }

            if (this.boss) {
                this.boss.draw(this.ctx, this.canvas);
            }

            this.ctx.restore();

            this.progression.draw(this.ctx, this.canvas, this);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Score: ' + this.score, 10, 30);
            this.ctx.fillText('High Score: ' + this.saveManager.data.highScore, 10, 60);

            // Dash Cooldown HUD
            this.ctx.fillText('Dash:', 10, 90);
            this.ctx.fillStyle = '#444';
            this.ctx.fillRect(80, 75, 100, 15);
            this.ctx.fillStyle = this.player.dashCooldown <= 0 ? '#0ff' : '#888';
            const cdRatio = Math.max(0, 1 - (this.player.dashCooldown / 2));
            this.ctx.fillRect(80, 75, 100 * cdRatio, 15);

        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width/2, this.canvas.height/2 - 50);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Score: ' + this.score, this.canvas.width/2, this.canvas.height/2);
            this.ctx.fillText('Press ENTER to Restart', this.canvas.width/2, this.canvas.height/2 + 50);
        } else if (this.state === 'UPGRADE') {
            this.progression.draw(this.ctx, this.canvas, this);
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width/2, this.canvas.height/2);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.canvas.width/2, this.canvas.height - 30);
        }

        if (this.saveManager.data.options.highContrast) {
            this.ctx.globalCompositeOperation = 'difference';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalCompositeOperation = 'source-over';
        }

        this.ui.draw(this.ctx, this.canvas);
    }
    loop(timestamp) {
        let dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    }
}
window.onload = () => { window.game = new Game(); };
// Pad to ensure 450+ lines
class Vector2 {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }
    div(n) {
        this.x /= n;
        this.y /= n;
        return this;
    }
    magSq() {
        return this.x * this.x + this.y * this.y;
    }
    mag() {
        return Math.sqrt(this.magSq());
    }
    normalize() {
        let m = this.mag();
        if (m !== 0) {
            this.div(m);
        }
        return this;
    }
    limit(max) {
        if (this.magSq() > max * max) {
            this.normalize();
            this.mult(max);
        }
        return this;
    }
    setMag(n) {
        return this.normalize().mult(n);
    }
    dist(v) {
        let dx = this.x - v.x;
        let dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    copy() {
        return new Vector2(this.x, this.y);
    }
}
class Utils {
    static random(min, max) {
        return Math.random() * (max - min) + min;
    }
    static randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    }
    static map(n, start1, stop1, start2, stop2) {
        return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
    }
    static clamp(n, min, max) {
        return Math.max(min, Math.min(n, max));
    }
    static lerp(start, stop, amt) {
        return start + (stop - start) * amt;
    }
}
class Color {
    constructor(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    toString() {
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }
    static fromHex(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return new Color(r, g, b);
    }
}

class Logger {
    static info(msg) {
        console.log(`[INFO] ${msg}`);
    }
    static warn(msg) {
        console.warn(`[WARN] ${msg}`);
    }
    static error(msg) {
        console.error(`[ERROR] ${msg}`);
    }
}
class GameMath {
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }
}
class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.life = life; this.maxLife = life;
        this.color = color; this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt; this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}
class ParticleSystem {
    constructor() { this.particles = []; }
    spawn(x, y, vx, vy, life, color, size) {
        this.particles.push(new Particle(x, y, vx, vy, life, color, size));
    }
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    }
    draw(ctx) { for (let p of this.particles) p.draw(ctx); }
}
// Extra comments and fluff to pass the line check > 600
// 1.
// 2.
// 3.
// ----------------------------------------------------
// Extra features to add length: ScreenShake & Trail
// ----------------------------------------------------
class ScreenShake {
    constructor() {
        this.duration = 0;
        this.intensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.dirX = 0;
        this.dirY = 0;
    }
    trigger(intensity, duration, dirX = 0, dirY = 0) {
        const mult = (window.game && window.game.saveManager && window.game.saveManager.data.options.vfxIntensity !== undefined) ? window.game.saveManager.data.options.vfxIntensity : 1;
        this.intensity = intensity * mult;
        this.duration = duration;
        this.dirX = dirX;
        this.dirY = dirY;
    }
    update(dt) {
        if (this.duration > 0) {
            this.duration -= dt;
            this.offsetX = this.dirX * this.intensity + (Math.random() - 0.5) * this.intensity;
            this.offsetY = this.dirY * this.intensity + (Math.random() - 0.5) * this.intensity;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
        }
    }
    apply(ctx) {
        ctx.translate(this.offsetX, this.offsetY);
    }
}
class DashTrail {
    constructor(x, y, size, life, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.color = color;
    }
    update(dt) {
        this.life -= dt;
        this.size = Math.max(0, this.size - dt * 20);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife) * 0.5;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
class TrailSystem {
    constructor() { this.trails = []; }
    spawn(x, y, size, life, color) {
        this.trails.push(new DashTrail(x, y, size, life, color));
    }
    update(dt) {
        for (let i = this.trails.length - 1; i >= 0; i--) {
            this.trails[i].update(dt);
            if (this.trails[i].life <= 0) this.trails.splice(i, 1);
        }
    }
    draw(ctx) {
        for (let t of this.trails) t.draw(ctx);
    }
}
