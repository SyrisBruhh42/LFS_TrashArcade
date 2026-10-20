
const SAVE_KEY = 'arcade_game_042_042-vector-stealth-retrieve_v1';

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                mute: false,
                sfxVol: 100,
                musicVol: 100,
                shake: 1,
                particles: 'high'
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
                // ensure options exist
                if(parsed.options) this.data.options = { ...this.data.options, ...parsed.options };
            }
        } catch (e) {
            console.warn("Save load failed, using in-memory");
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Save failed");
        }
    }
    export() {
        return btoa(JSON.stringify(this.data));
    }
    importData(b64) {
        try {
            const parsed = JSON.parse(atob(b64));
            if(parsed) {
                this.data = { ...this.data, ...parsed };
                this.save();
                return true;
            }
        } catch(e) {
            return false;
        }
    }
    reset() {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch(e) {}
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { mute: false, sfxVol: 100, musicVol: 100, shake: 1, particles: 'high' }
        };
        this.save();
    }
}

class SoundEngine {
    constructor(saveMgr) {
        this.saveMgr = saveMgr;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
        this.musicOsc = null;
        this.musicInterval = null;
        this.noteIndex = 0;
        this.notes = [220, 261.63, 329.63, 392, 220, 261.63, 196, 164.81]; // A minor arp
    }
    init() {
        if (this.initialized) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.updateVolumes();
        this.initialized = true;
        this.startMusic();
    }
    updateVolumes() {
        if (!this.initialized) return;
        const opts = this.saveMgr.data.options;
        this.masterGain.gain.value = opts.mute ? 0 : 1;
        this.sfxGain.gain.value = opts.sfxVol / 100;
        this.musicGain.gain.value = (opts.musicVol / 100) * 0.1; // bgm is quieter
    }
    playTone(freq, type, duration, vol=1) {
        if (!this.initialized || this.ctx.state === 'suspended') return;
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
    playShoot() { this.playTone(800, 'square', 0.1, 0.5); }
    playHit() { this.playTone(150, 'sawtooth', 0.2, 0.8); }
    playRetrieve() { this.playTone(1200, 'sine', 0.1, 0.6); }
    playStart() { this.playTone(400, 'square', 0.3, 0.7); }
    playAlert() { this.playTone(200, 'sawtooth', 0.4, 0.9); }

    startMusic() {
        if(this.musicInterval) clearInterval(this.musicInterval);
        this.musicInterval = setInterval(() => {
            if(!this.initialized || this.ctx.state === 'suspended' || window.gameState !== 'PLAYING') return;
            const freq = this.notes[this.noteIndex % this.notes.length];
            this.noteIndex++;

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

            // lowpass filter for retro muffled sound
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);
        }, 200);
    }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touchMove = { x: 0, y: 0, active: false, id: null, startX: 0, startY: 0 };
        this.touchShoot = { active: false, id: null };
        this.scale = { x: 1, y: 1 };
        this.bounds = canvas.getBoundingClientRect();

        window.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if(window.engine && window.engine.sound) window.engine.sound.init();
        });
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);

        canvas.addEventListener('mousemove', e => {
            this.updateBounds();
            this.mouse.x = (e.clientX - this.bounds.left) * (this.canvas.width / this.bounds.width);
            this.mouse.y = (e.clientY - this.bounds.top) * (this.canvas.height / this.bounds.height);
        });
        canvas.addEventListener('mousedown', e => {
            this.mouse.down = true;
            if(window.engine && window.engine.sound) window.engine.sound.init();
        });
        canvas.addEventListener('mouseup', e => this.mouse.down = false);

        canvas.addEventListener('touchstart', e => {
            e.preventDefault(); // careful with this globally, but ok on canvas if we handle UI separately
            if(window.engine && window.engine.sound) window.engine.sound.init();
            this.updateBounds();
            for(let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if(t.clientX < window.innerWidth / 2) { // left half for movement
                    if(!this.touchMove.active) {
                        this.touchMove.active = true;
                        this.touchMove.id = t.identifier;
                        this.touchMove.startX = t.clientX;
                        this.touchMove.startY = t.clientY;
                        this.touchMove.x = 0;
                        this.touchMove.y = 0;
                    }
                } else { // right half for shooting
                    if(!this.touchShoot.active) {
                        this.touchShoot.active = true;
                        this.touchShoot.id = t.identifier;
                        this.mouse.down = true; // map to mouse down
                        this.mouse.x = (t.clientX - this.bounds.left) * (this.canvas.width / this.bounds.width);
                        this.mouse.y = (t.clientY - this.bounds.top) * (this.canvas.height / this.bounds.height);
                    }
                }
            }
        }, {passive: false});

        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            for(let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if(t.identifier === this.touchMove.id) {
                    this.touchMove.x = t.clientX - this.touchMove.startX;
                    this.touchMove.y = t.clientY - this.touchMove.startY;
                    // normalize
                    const len = Math.hypot(this.touchMove.x, this.touchMove.y);
                    const maxDist = 50;
                    if(len > maxDist) {
                        this.touchMove.x = (this.touchMove.x / len) * maxDist;
                        this.touchMove.y = (this.touchMove.y / len) * maxDist;
                    }
                } else if(t.identifier === this.touchShoot.id) {
                    this.mouse.x = (t.clientX - this.bounds.left) * (this.canvas.width / this.bounds.width);
                    this.mouse.y = (t.clientY - this.bounds.top) * (this.canvas.height / this.bounds.height);
                }
            }
        }, {passive: false});

        const touchEnd = e => {
            for(let i=0; i<e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if(t.identifier === this.touchMove.id) {
                    this.touchMove.active = false;
                    this.touchMove.id = null;
                    this.touchMove.x = 0;
                    this.touchMove.y = 0;
                }
                if(t.identifier === this.touchShoot.id) {
                    this.touchShoot.active = false;
                    this.touchShoot.id = null;
                    this.mouse.down = false;
                }
            }
        };
        canvas.addEventListener('touchend', touchEnd);
        canvas.addEventListener('touchcancel', touchEnd);
    }
    updateBounds() {
        this.bounds = this.canvas.getBoundingClientRect();
    }
    getAxis() {
        let dx = 0, dy = 0;
        if(this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if(this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if(this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if(this.keys['d'] || this.keys['arrowright']) dx += 1;

        if(this.touchMove.active) {
            dx += this.touchMove.x / 50; // maxDist
            dy += this.touchMove.y / 50;
        }

        // normalize keyboard
        if(dx !== 0 && dy !== 0 && !this.touchMove.active) {
            const invSqrt2 = 0.7071;
            dx *= invSqrt2;
            dy *= invSqrt2;
        }
        // clamp touch
        const len = Math.hypot(dx, dy);
        if(len > 1) {
            dx /= len;
            dy /= len;
        }
        return {x: dx, y: dy};
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveMgr = new SaveManager();
        this.sound = new SoundEngine(this.saveMgr);
        this.input = new InputManager(this.canvas);

        this.logicalWidth = 1280;
        this.logicalHeight = 720;

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(document.getElementById('game-container'));

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        window.gameState = this.state;

        this.lastTime = 0;
        this.score = 0;
        this.wave = 1;
        this.health = 3;

        this.player = { x: 100, y: 100, radius: 15, speed: 300, vx: 0, vy: 0 };
        this.ammo = { active: false, x: 0, y: 0, vx: 0, vy: 0, speed: 800, radius: 5, lifetime: 0 };
        this.objective = { x: 1000, y: 360, radius: 20, collected: false };
        this.exit = { x: 1200, y: 360, radius: 30, active: false };
        this.guards = [];
        this.particles = [];

        this.setupUI();
        this.resize();
        this.changeState('TITLE');

        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.changeState('PAUSED');
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.changeState('PAUSED');
        });

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const container = document.getElementById('game-container');
        const cr = container.getBoundingClientRect();
        const scale = Math.min(cr.width / this.logicalWidth, cr.height / this.logicalHeight);
        this.canvas.width = this.logicalWidth;
        this.canvas.height = this.logicalHeight;
        this.canvas.style.width = `${this.logicalWidth * scale}px`;
        this.canvas.style.height = `${this.logicalHeight * scale}px`;
        this.input.scale = { x: scale, y: scale };
        this.input.updateBounds();
    }

    setupUI() {
        const bind = (id, fn) => document.getElementById(id).addEventListener('click', fn);

        bind('btn-play', () => this.startGame());
        bind('btn-howto', () => this.showScreen('screen-howto'));
        bind('btn-options-title', () => this.showScreen('screen-options'));
        bind('btn-options-pause', () => this.showScreen('screen-options'));
        bind('btn-resume', () => {
            if (this.sound.ctx && this.sound.ctx.state === 'suspended') this.sound.ctx.resume();
            this.changeState('PLAYING');
        });
        bind('btn-restart', () => this.startGame());
        bind('btn-playagain', () => this.startGame());
        bind('btn-title', () => this.changeState('TITLE'));
        bind('btn-pause', () => this.changeState('PAUSED'));
        bind('btn-howto-back', () => this.changeState(this.state)); // Go back to whatever state is active under the modal
        bind('btn-options-back', () => {
            this.saveMgr.save();
            this.sound.updateVolumes();
            this.changeState(this.state);
        });

        // Options
        const syncOpt = () => {
            const opts = this.saveMgr.data.options;
            document.getElementById('opt-mute').checked = opts.mute;
            document.getElementById('opt-sfx').value = opts.sfxVol;
            document.getElementById('opt-music').value = opts.musicVol;
            document.getElementById('opt-shake').value = opts.shake;
            document.getElementById('opt-particles').value = opts.particles;
        };
        syncOpt();

        document.getElementById('opt-mute').addEventListener('change', e => { this.saveMgr.data.options.mute = e.target.checked; this.sound.updateVolumes(); });
        document.getElementById('opt-sfx').addEventListener('input', e => { this.saveMgr.data.options.sfxVol = e.target.value; this.sound.updateVolumes(); });
        document.getElementById('opt-music').addEventListener('input', e => { this.saveMgr.data.options.musicVol = e.target.value; this.sound.updateVolumes(); });
        document.getElementById('opt-shake').addEventListener('change', e => { this.saveMgr.data.options.shake = parseFloat(e.target.value); });
        document.getElementById('opt-particles').addEventListener('change', e => { this.saveMgr.data.options.particles = e.target.value; });

        bind('btn-export', () => {
            const b64 = this.saveMgr.export();
            navigator.clipboard.writeText(b64).then(() => alert('Save copied to clipboard!'));
        });
        bind('btn-import', () => {
            const b64 = prompt("Paste save data here:");
            if(b64) {
                if(this.saveMgr.importData(b64)) {
                    alert('Save imported!');
                    syncOpt();
                    this.sound.updateVolumes();
                    document.getElementById('title-highscore').innerText = this.saveMgr.data.highScore;
                } else {
                    alert('Invalid save data.');
                }
            }
        });
        let resetClicks = 0;
        bind('btn-reset', (e) => {
            resetClicks++;
            if(resetClicks === 1) {
                e.target.innerText = "Click again to confirm reset";
                setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset Save"; }, 3000);
            } else {
                this.saveMgr.reset();
                syncOpt();
                this.sound.updateVolumes();
                document.getElementById('title-highscore').innerText = "0";
                e.target.innerText = "Save Reset!";
                resetClicks = 0;
                setTimeout(() => { e.target.innerText = "Reset Save"; }, 2000);
            }
        });
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if(id) document.getElementById(id).classList.add('active');
    }

    changeState(newState) {
        // Only change actual logical game state if we aren't just opening a sub-menu
        if (newState === 'TITLE' || newState === 'PLAYING' || newState === 'PAUSED' || newState === 'GAME_OVER') {
            this.state = newState;
            window.gameState = this.state;
        }

        this.showScreen(null); // hide all screens by default
        document.getElementById('hud').classList.remove('active');

        if (this.state === 'TITLE') {
            document.getElementById('title-highscore').innerText = this.saveMgr.data.highScore;
            this.showScreen('screen-title');
            this.generateTitleBackground();
        } else if (this.state === 'PLAYING') {
            document.getElementById('hud').classList.add('active');
            if (this.sound.ctx && this.sound.ctx.state === 'suspended') this.sound.ctx.resume();
        } else if (this.state === 'PAUSED') {
            this.showScreen('screen-pause');
        } else if (this.state === 'GAME_OVER') {
            document.getElementById('go-score').innerText = this.score;
            if (this.score > this.saveMgr.data.highScore) {
                this.saveMgr.data.highScore = this.score;
                this.saveMgr.save();
                document.getElementById('new-highscore-msg').style.display = 'block';
            } else {
                document.getElementById('new-highscore-msg').style.display = 'none';
            }
            this.saveMgr.data.totalGamesPlayed++;
            this.saveMgr.data.totalScoreAccumulated += this.score;
            if(this.wave > this.saveMgr.data.bestWaveOrCombo) this.saveMgr.data.bestWaveOrCombo = this.wave;
            this.saveMgr.save();
            this.showScreen('screen-gameover');
        }
    }

    generateTitleBackground() {
        this.guards = [];
        for(let i=0; i<5; i++) {
            this.guards.push({
                x: Math.random() * this.logicalWidth,
                y: Math.random() * this.logicalHeight,
                radius: 20,
                angle: Math.random() * Math.PI * 2,
                speed: 50,
                patrolCenter: {x: Math.random() * this.logicalWidth, y: Math.random() * this.logicalHeight},
                patrolRadius: 100 + Math.random()*100,
                patrolAngle: Math.random() * Math.PI * 2,
                disabled: false
            });
        }
    }

    startGame() {
        this.sound.init();
        this.sound.playStart();
        this.score = 0;
        this.wave = 1;
        this.health = 3;
        this.player = { x: 100, y: this.logicalHeight/2, radius: 15, speed: 300, vx: 0, vy: 0 };
        this.ammo = { active: false, x: 0, y: 0, vx: 0, vy: 0, speed: 800, radius: 5, lifetime: 0 };
        this.particles = [];
        this.loadWave();
        this.changeState('PLAYING');
    }

    loadWave() {
        this.player.x = 100;
        this.player.y = this.logicalHeight/2;
        this.objective = { x: this.logicalWidth - 100, y: this.logicalHeight/2, radius: 20, collected: false };
        this.exit = { x: 50, y: this.logicalHeight/2, radius: 30, active: false };
        this.guards = [];

        const numGuards = Math.min(2 + this.wave, 10);
        for(let i=0; i<numGuards; i++) {
            this.guards.push({
                x: 300 + Math.random() * (this.logicalWidth - 500),
                y: 100 + Math.random() * (this.logicalHeight - 200),
                radius: 20,
                angle: Math.random() * Math.PI * 2,
                speed: 50 + this.wave * 10,
                patrolCenter: {x: 300 + Math.random() * (this.logicalWidth - 500), y: 100 + Math.random() * (this.logicalHeight - 200)},
                patrolRadius: 100 + Math.random()*100,
                patrolAngle: Math.random() * Math.PI * 2,
                disabled: false,
                disabledTimer: 0
            });
        }
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('score-display').innerText = `Score: ${this.score}`;
        document.getElementById('wave-display').innerText = `Wave: ${this.wave}`;
        document.getElementById('ammo-display').innerText = `Ammo: ${this.ammo.active ? '0' : '1'}/1`;
        document.getElementById('health-display').innerText = `Health: ${this.health}`;
    }

    loop(time) {
        requestAnimationFrame((t) => this.loop(t));
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        if (this.state === 'PLAYING') {
            this.update(dt);
        } else if (this.state === 'TITLE') {
            // animate background
            this.guards.forEach(g => {
                g.patrolAngle += g.speed * dt * 0.01;
                g.x = g.patrolCenter.x + Math.cos(g.patrolAngle) * g.patrolRadius;
                g.y = g.patrolCenter.y + Math.sin(g.patrolAngle) * g.patrolRadius;
                g.angle = g.patrolAngle + Math.PI/2;
            });
        }

        this.draw();
    }

    update(dt) {
        // Player movement
        const axis = this.input.getAxis();
        this.player.vx = axis.x * this.player.speed;
        this.player.vy = axis.y * this.player.speed;

        this.player.x += this.player.vx * dt;
        this.player.y += this.player.vy * dt;

        // Clamp player to screen
        this.player.x = Math.max(this.player.radius, Math.min(this.logicalWidth - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.logicalHeight - this.player.radius, this.player.y));

        // Shooting
        if (this.input.mouse.down && !this.ammo.active) {
            this.ammo.active = true;
            this.ammo.x = this.player.x;
            this.ammo.y = this.player.y;
            const dx = this.input.mouse.x - this.player.x;
            const dy = this.input.mouse.y - this.player.y;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
                this.ammo.vx = (dx / len) * this.ammo.speed;
                this.ammo.vy = (dy / len) * this.ammo.speed;
            } else {
                this.ammo.vx = this.ammo.speed;
                this.ammo.vy = 0;
            }
            this.sound.playShoot();
            this.input.mouse.down = false; // consume click
            this.updateHUD();
        }

        // Ammo logic
        if (this.ammo.active) {
            this.ammo.x += this.ammo.vx * dt;
            this.ammo.y += this.ammo.vy * dt;

            // Ammo physics - slow down over time to simulate a thrown object landing
            this.ammo.vx *= 0.98;
            this.ammo.vy *= 0.98;

            // Wall bounce
            if (this.ammo.x < 0 || this.ammo.x > this.logicalWidth) this.ammo.vx *= -1;
            if (this.ammo.y < 0 || this.ammo.y > this.logicalHeight) this.ammo.vy *= -1;

            // Clamp ammo
            this.ammo.x = Math.max(0, Math.min(this.logicalWidth, this.ammo.x));
            this.ammo.y = Math.max(0, Math.min(this.logicalHeight, this.ammo.y));

            // Guard collision
            let hitGuard = false;
            for(let g of this.guards) {
                if(!g.disabled && Math.hypot(this.ammo.x - g.x, this.ammo.y - g.y) < g.radius + this.ammo.radius) {
                    g.disabled = true;
                    g.disabledTimer = 5; // seconds
                    hitGuard = true;
                    this.score += 100;
                    this.sound.playHit();
                    this.spawnParticles(g.x, g.y, '#ff0000', 10);
                    break;
                }
            }

            if (hitGuard) {
                // Ammo drops to floor immediately
                this.ammo.vx = 0;
                this.ammo.vy = 0;
            }

            // Retrieve ammo
            if (Math.hypot(this.player.x - this.ammo.x, this.player.y - this.ammo.y) < this.player.radius + this.ammo.radius + 10) {
                // Can only retrieve if it's slow enough (laying on ground)
                if (Math.hypot(this.ammo.vx, this.ammo.vy) < 100) {
                    this.ammo.active = false;
                    this.sound.playRetrieve();
                    this.updateHUD();
                    this.spawnParticles(this.player.x, this.player.y, '#56b587', 5);
                }
            }
        }

        // Objective logic
        if (!this.objective.collected && Math.hypot(this.player.x - this.objective.x, this.player.y - this.objective.y) < this.player.radius + this.objective.radius) {
            this.objective.collected = true;
            this.exit.active = true;
            this.score += 500;
            this.sound.playRetrieve();
            this.spawnParticles(this.objective.x, this.objective.y, '#ffff00', 20);
            this.updateHUD();
        }

        // Exit logic
        if (this.exit.active && Math.hypot(this.player.x - this.exit.x, this.player.y - this.exit.y) < this.player.radius + this.exit.radius) {
            this.score += this.wave * 1000;
            this.wave++;
            this.sound.playStart();
            this.loadWave();
            return;
        }

        // Guard logic
        let spotted = false;
        for(let g of this.guards) {
            if (g.disabled) {
                g.disabledTimer -= dt;
                if(g.disabledTimer <= 0) g.disabled = false;
                continue;
            }

            // Patrol
            g.patrolAngle += g.speed * dt * 0.01;
            g.x = g.patrolCenter.x + Math.cos(g.patrolAngle) * g.patrolRadius;
            g.y = g.patrolCenter.y + Math.sin(g.patrolAngle) * g.patrolRadius;

            // Look towards player occasionally or just sweep
            // Simple sweep
            g.angle = g.patrolAngle + Math.PI/2 + Math.sin(time/500)*0.5;

            // Vision cone check
            const dx = this.player.x - g.x;
            const dy = this.player.y - g.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 200) {
                const angleToPlayer = Math.atan2(dy, dx);
                let angleDiff = angleToPlayer - g.angle;
                // Normalize angleDiff to -PI to PI
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

                if (Math.abs(angleDiff) < Math.PI / 4) { // 90 degree cone
                    spotted = true;
                    // Move guard towards player if spotted
                    g.x += Math.cos(angleToPlayer) * g.speed * 2 * dt;
                    g.y += Math.sin(angleToPlayer) * g.speed * 2 * dt;

                    // Collision with player
                    if (dist < g.radius + this.player.radius) {
                        this.health--;
                        this.sound.playAlert();
                        this.screenShake(10);
                        if (this.health <= 0) {
                            this.changeState('GAME_OVER');
                            return;
                        } else {
                            // Reset position but keep wave progress
                            this.player.x = 100;
                            this.player.y = this.logicalHeight/2;
                            this.ammo.active = false; // Give ammo back
                            this.updateHUD();
                        }
                    }
                }
            }
        }

        // Particles
        for(let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update shake
        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }
    }

    screenShake(amount) {
        const shakeMult = this.saveMgr.data.options.shake;
        if (shakeMult === 0) return;
        this.shakeAmount = amount * shakeMult;
        this.shakeTimer = 0.2;
    }

    spawnParticles(x, y, color, count) {
        if (this.saveMgr.data.options.particles === 'low') count = Math.ceil(count / 3);
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 200;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color,
                life: 0.2 + Math.random() * 0.3,
                maxLife: 0.5
            });
        }
    }

    draw() {
        this.ctx.fillStyle = '#05100a';
        this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

        this.ctx.save();

        // Screen shake
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * this.shakeAmount;
            const dy = (Math.random() - 0.5) * this.shakeAmount;
            this.ctx.translate(dx, dy);
        }

        // Grid background
        this.ctx.strokeStyle = 'rgba(86, 181, 135, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for(let x=0; x<=this.logicalWidth; x+=40) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.logicalHeight); }
        for(let y=0; y<=this.logicalHeight; y+=40) { this.ctx.moveTo(0, y); this.ctx.lineTo(this.logicalWidth, y); }
        this.ctx.stroke();

        if (this.state === 'PLAYING') {
            // Draw Objective
            if (!this.objective.collected) {
                this.ctx.fillStyle = '#ffff00'; // Yellow objective
                this.ctx.beginPath();
                this.ctx.arc(this.objective.x, this.objective.y, this.objective.radius, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#fff';
                this.ctx.stroke();
            }

            // Draw Exit
            if (this.exit.active) {
                this.ctx.fillStyle = 'rgba(0, 100, 255, 0.3)'; // Blue exit
                this.ctx.beginPath();
                this.ctx.arc(this.exit.x, this.exit.y, this.exit.radius, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#00aaff';
                this.ctx.lineWidth = 3;
                this.ctx.stroke();
            }

            // Draw Ammo
            if (this.ammo.active) {
                this.ctx.fillStyle = '#56b587';
                this.ctx.beginPath();
                this.ctx.arc(this.ammo.x, this.ammo.y, this.ammo.radius, 0, Math.PI*2);
                this.ctx.fill();

                // Draw line to ammo if on ground to help find it
                if (Math.hypot(this.ammo.vx, this.ammo.vy) < 100) {
                    this.ctx.strokeStyle = 'rgba(86, 181, 135, 0.3)';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.player.x, this.player.y);
                    this.ctx.lineTo(this.ammo.x, this.ammo.y);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);
                }
            } else {
                // Draw ammo indicator on player
                this.ctx.fillStyle = '#56b587';
                this.ctx.beginPath();
                this.ctx.arc(this.player.x + 5, this.player.y - 5, this.ammo.radius, 0, Math.PI*2);
                this.ctx.fill();
            }

            // Draw Player
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(this.player.x, this.player.y, this.player.radius, 0, Math.PI*2);
            this.ctx.fill();

            // Draw aiming line
            if (!this.ammo.active) {
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                this.ctx.beginPath();
                this.ctx.moveTo(this.player.x, this.player.y);
                this.ctx.lineTo(this.input.mouse.x, this.input.mouse.y);
                this.ctx.stroke();
            }

        }

        // Draw Guards (also in TITLE screen)
        for(let g of this.guards) {
            // Draw vision cone
            if (!g.disabled) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.15)';
                this.ctx.beginPath();
                this.ctx.moveTo(g.x, g.y);
                this.ctx.arc(g.x, g.y, 200, g.angle - Math.PI/4, g.angle + Math.PI/4);
                this.ctx.closePath();
                this.ctx.fill();

                this.ctx.strokeStyle = '#ff0000';
                this.ctx.beginPath();
                this.ctx.moveTo(g.x, g.y);
                this.ctx.lineTo(g.x + Math.cos(g.angle - Math.PI/4) * 200, g.y + Math.sin(g.angle - Math.PI/4) * 200);
                this.ctx.moveTo(g.x, g.y);
                this.ctx.lineTo(g.x + Math.cos(g.angle + Math.PI/4) * 200, g.y + Math.sin(g.angle + Math.PI/4) * 200);
                this.ctx.stroke();
            }

            // Draw Guard body
            this.ctx.fillStyle = g.disabled ? '#555555' : '#ff0000';
            this.ctx.beginPath();
            this.ctx.arc(g.x, g.y, g.radius, 0, Math.PI*2);
            this.ctx.fill();

            if (g.disabled) {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '16px monospace';
                this.ctx.fillText(Math.ceil(g.disabledTimer), g.x - 5, g.y + 5);
            } else {
                // Eye
                this.ctx.fillStyle = '#fff';
                this.ctx.beginPath();
                this.ctx.arc(g.x + Math.cos(g.angle)*10, g.y + Math.sin(g.angle)*10, 5, 0, Math.PI*2);
                this.ctx.fill();
            }
        }

        // Draw Particles
        for(let p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;

        // Draw Virtual Controls if on mobile/touch
        if (this.state === 'PLAYING' && (this.input.touchMove.active || this.input.touchShoot.active || window.innerWidth < 800)) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';

            // Move Zone (Left)
            if (this.input.touchMove.active) {
                const mx = (this.input.touchMove.startX - this.input.bounds.left) * (this.canvas.width / this.input.bounds.width);
                const my = (this.input.touchMove.startY - this.input.bounds.top) * (this.canvas.height / this.input.bounds.height);
                this.ctx.beginPath();
                this.ctx.arc(mx, my, 50, 0, Math.PI*2);
                this.ctx.stroke();

                const kx = mx + this.input.touchMove.x * (this.canvas.width / this.input.bounds.width);
                const ky = my + this.input.touchMove.y * (this.canvas.height / this.input.bounds.height);
                this.ctx.beginPath();
                this.ctx.arc(kx, ky, 20, 0, Math.PI*2);
                this.ctx.fill();
            } else {
                // Hint
                this.ctx.beginPath();
                this.ctx.arc(150, this.logicalHeight - 150, 50, 0, Math.PI*2);
                this.ctx.stroke();
            }
        }

        this.ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.engine = new GameEngine();
});
