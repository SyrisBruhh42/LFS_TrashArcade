// Neon Synthwave Slash
// Core Classes

class SaveManager {
    constructor() {
        this.key = 'arcade_game_050_050-neon-synthwave-slash_v1';
        this.data = this.getDefaults();
        this.load();
    }

    getDefaults() {
        return {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                volMaster: 100,
                volSfx: 100,
                volMusic: 80,
                shake: 1,
                particles: 'high',
                touch: 'auto'
            }
        };
    }

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = { ...this.getDefaults(), ...parsed };
                // Ensure options are merged deeply
                if (parsed.options) {
                    this.data.options = { ...this.getDefaults().options, ...parsed.options };
                }
            }
        } catch (e) {
            console.warn('Save load failed, using defaults.', e);
            this.data = this.getDefaults();
        }
    }

    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Save failed.', e);
        }
    }

    reset() {
        try {
            localStorage.removeItem(this.key);
        } catch(e) {}
        this.data = this.getDefaults();
        this.save();
    }

    export() {
        return btoa(JSON.stringify(this.data));
    }

    importData(b64) {
        try {
            const parsed = JSON.parse(atob(b64));
            if (parsed && typeof parsed === 'object') {
                this.data = { ...this.getDefaults(), ...parsed };
                this.save();
                return true;
            }
        } catch(e) {
            console.error('Import failed', e);
        }
        return false;
    }
}

class AudioEngine {
    constructor(saveMgr) {
        this.saveMgr = saveMgr;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.masterGain);

        this.updateVolumes();
        this.initialized = false;

        this.musicOsc = null;
        this.musicActive = false;
        this.beatTime = 0;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.initialized = true;
    }

    updateVolumes() {
        const opts = this.saveMgr.data.options;
        this.masterGain.gain.value = opts.volMaster / 100;
        this.sfxGain.gain.value = opts.volSfx / 100;
        this.musicGain.gain.value = opts.volMusic / 100;
    }

    playSfx(type) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        const now = this.ctx.currentTime;

        switch(type) {
            case 'slash':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
                gain.gain.setValueAtTime(0.5, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'hit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(150, now);
                osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
                gain.gain.setValueAtTime(0.7, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'ui':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.setValueAtTime(800, now + 0.05);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.linearRampToValueAtTime(0, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
        }
    }

    startMusic() {
        if (!this.initialized || this.musicActive) return;
        this.musicActive = true;
        this.playBeat();
    }

    stopMusic() {
        this.musicActive = false;
    }

    playBeat() {
        if (!this.musicActive) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.musicGain);

        osc.type = 'square';
        osc.frequency.setValueAtTime(65, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.start(now);
        osc.stop(now + 0.2);

        setTimeout(() => this.playBeat(), 500);
    }
}

class InputManager {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.container = container;

        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, active: false };
        this.touches = [];

        this.scale = { x: 1, y: 1 };
        this.rect = canvas.getBoundingClientRect();

        // Touch joysticks
        this.leftStick = { active: false, dx: 0, dy: 0, id: null };
        this.rightStick = { active: false, dx: 0, dy: 0, id: null };

        this.bind();

        // Resize observer
        this.ro = new ResizeObserver(() => this.updateBounds());
        this.ro.observe(this.container);
        window.addEventListener('resize', () => this.updateBounds());
        setTimeout(() => this.updateBounds(), 100);
    }

    updateBounds() {
        this.rect = this.canvas.getBoundingClientRect();

        // Calculate fit scale (maintaining aspect ratio)
        const targetRatio = 1280 / 720;
        const currentRatio = window.innerWidth / window.innerHeight;

        let scale = 1;
        if (currentRatio > targetRatio) {
            scale = window.innerHeight / 720;
        } else {
            scale = window.innerWidth / 1280;
        }

        this.container.style.transform = `scale(${scale})`;

        // Recalculate exact rect after transform applied to parent container
        // Actually, since we scale the container, mouse events on canvas need to account for this.
        // Wait a frame for DOM to update transform
        requestAnimationFrame(() => {
            this.rect = this.canvas.getBoundingClientRect();
            this.scale.x = 1280 / this.rect.width;
            this.scale.y = 720 / this.rect.height;
        });
    }

    getMappedPos(clientX, clientY) {
        return {
            x: (clientX - this.rect.left) * this.scale.x,
            y: (clientY - this.rect.top) * this.scale.y
        };
    }

    bind() {
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        this.canvas.addEventListener('mousedown', e => {
            this.mouse.active = true;
            this.mouse.down = true;
            const p = this.getMappedPos(e.clientX, e.clientY);
            this.mouse.x = p.x;
            this.mouse.y = p.y;
        });

        this.canvas.addEventListener('mousemove', e => {
            if (this.mouse.active) {
                const p = this.getMappedPos(e.clientX, e.clientY);
                this.mouse.x = p.x;
                this.mouse.y = p.y;
            }
        });

        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        // Touch
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, {passive: false});

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, {passive: false});

        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, {passive: false});

        this.canvas.addEventListener('touchcancel', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, {passive: false});
    }

    updateTouches(e) {
        this.touches = [];
        this.leftStick.active = false;
        this.rightStick.active = false;

        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            const p = this.getMappedPos(t.clientX, t.clientY);
            this.touches.push({x: p.x, y: p.y, id: t.identifier});

            // Simple half-screen stick split
            if (p.x < 1280 / 2) {
                this.leftStick.active = true;
                this.leftStick.id = t.identifier;
                // Center around touch move zone roughly
                const cx = 120; // 40 + 80
                const cy = 720 - 100; // bottom 20 + 80
                this.leftStick.dx = Math.max(-1, Math.min(1, (p.x - cx) / 80));
                this.leftStick.dy = Math.max(-1, Math.min(1, (p.y - cy) / 80));
            } else {
                this.rightStick.active = true;
                this.rightStick.id = t.identifier;
                const cx = 1280 - 120;
                const cy = 720 - 100;
                this.rightStick.dx = Math.max(-1, Math.min(1, (p.x - cx) / 80));
                this.rightStick.dy = Math.max(-1, Math.min(1, (p.y - cy) / 80));
            }
        }
    }

    getMovement() {
        let dx = 0, dy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        if (this.leftStick.active) {
            dx = this.leftStick.dx;
            dy = this.leftStick.dy;
        }

        // Normalize
        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }
        return { x: dx, y: dy, active: len > 0 };
    }

    getActionDir(playerX, playerY) {
        let dx = 0, dy = 0;
        let active = false;

        // IJKL as secondary keys
        if (this.keys['KeyI']) { dy -= 1; active = true; }
        if (this.keys['KeyK']) { dy += 1; active = true; }
        if (this.keys['KeyJ']) { dx -= 1; active = true; }
        if (this.keys['KeyL']) { dx += 1; active = true; }

        // Mouse
        if (this.mouse.down && !active) {
            dx = this.mouse.x - playerX;
            dy = this.mouse.y - playerY;
            active = true;
        }

        // Touch right stick
        if (this.rightStick.active && !active) {
            dx = this.rightStick.dx;
            dy = this.rightStick.dy;
            active = true;
        }

        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }
        return { x: dx, y: dy, active };
    }

    anyInput() {
        return Object.values(this.keys).some(v => v) || this.mouse.down || this.touches.length > 0;
    }
}


// State Machine & UI

class GameEngine {
    constructor() {
        this.saveMgr = new SaveManager();
        this.audio = new AudioEngine(this.saveMgr);

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('game-container');

        this.input = new InputManager(this.canvas, this.container);

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;

        // Game State variables
        this.score = 0;
        this.combo = 1;
        this.hp = 3;
        this.wave = 1;

        this.entities = [];
        this.particles = [];

        // Time dilation
        this.timeScale = 1.0;
        this.targetTimeScale = 1.0;
        this.cameraShake = 0;

        this.setupUI();
        this.updateOptionsUI();

        // Start loop
        requestAnimationFrame(t => this.loop(t));

        // Handle visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.setPause(true);
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.setPause(true);
            }
        });
    }

    setupUI() {
        const bind = (id, fn) => document.getElementById(id).addEventListener('click', fn);

        // Title
        document.getElementById('title-highscore').textContent = this.saveMgr.data.highScore;
        bind('btn-play', () => this.startGame());
        bind('btn-howto', () => this.showLayer('ui-howto'));
        bind('btn-options-title', () => { this.updateOptionsUI(); this.showLayer('ui-options'); });

        // How To
        bind('btn-howto-close', () => {
            if (this.state === 'TITLE') this.showLayer('ui-title');
            else if (this.state === 'PAUSED') this.showLayer('ui-paused');
        });

        // Options
        bind('btn-options-close', () => {
            if (this.state === 'TITLE') this.showLayer('ui-title');
            else if (this.state === 'PAUSED') this.showLayer('ui-paused');
        });

        // Options Sync
        const opt = id => document.getElementById(id);
        const updateOpt = () => {
            this.saveMgr.data.options.volMaster = parseInt(opt('opt-vol-master').value);
            this.saveMgr.data.options.volSfx = parseInt(opt('opt-vol-sfx').value);
            this.saveMgr.data.options.volMusic = parseInt(opt('opt-vol-music').value);
            this.saveMgr.data.options.shake = parseFloat(opt('opt-shake').value);
            this.saveMgr.data.options.particles = opt('opt-particles').value;
            this.saveMgr.data.options.touch = opt('opt-touch').value;

            document.getElementById('val-vol-master').textContent = this.saveMgr.data.options.volMaster + '%';
            document.getElementById('val-vol-sfx').textContent = this.saveMgr.data.options.volSfx + '%';
            document.getElementById('val-vol-music').textContent = this.saveMgr.data.options.volMusic + '%';

            this.saveMgr.save();
            this.audio.updateVolumes();
            this.updateTouchControlsVisibility();
        };

        opt('opt-vol-master').addEventListener('input', updateOpt);
        opt('opt-vol-sfx').addEventListener('input', updateOpt);
        opt('opt-vol-music').addEventListener('input', updateOpt);
        opt('opt-shake').addEventListener('change', updateOpt);
        opt('opt-particles').addEventListener('change', updateOpt);
        opt('opt-touch').addEventListener('change', updateOpt);

        // Save Data
        bind('btn-export', () => {
            const b64 = this.saveMgr.export();
            opt('save-data-area').value = b64;
            opt('save-data-area').select();
            document.execCommand('copy');
            alert('Save copied to clipboard!');
        });

        bind('btn-import', () => {
            const val = opt('save-data-area').value;
            if (this.saveMgr.importData(val)) {
                alert('Save imported!');
                this.updateOptionsUI();
            } else {
                alert('Invalid save data.');
            }
        });

        let resetClicks = 0;
        bind('btn-reset', () => {
            resetClicks++;
            if (resetClicks === 1) {
                opt('btn-reset').textContent = 'Click again to confirm';
                setTimeout(() => { resetClicks = 0; opt('btn-reset').textContent = 'Reset Save'; }, 3000);
            } else {
                this.saveMgr.reset();
                this.updateOptionsUI();
                alert('Save reset.');
                resetClicks = 0;
                opt('btn-reset').textContent = 'Reset Save';
            }
        });

        // Playing
        bind('btn-pause', () => this.setPause(true));

        // Paused
        bind('btn-resume', () => this.setPause(false));
        bind('btn-restart', () => this.startGame());
        bind('btn-options-pause', () => { this.updateOptionsUI(); this.showLayer('ui-options'); });
        bind('btn-quit', () => { this.state = 'TITLE'; this.showLayer('ui-title'); this.audio.stopMusic(); });

        // Game Over
        bind('btn-play-again', () => this.startGame());
        bind('btn-title-from-go', () => { this.state = 'TITLE'; this.showLayer('ui-title'); });
    }

    updateOptionsUI() {
        const opts = this.saveMgr.data.options;
        document.getElementById('opt-vol-master').value = opts.volMaster;
        document.getElementById('opt-vol-sfx').value = opts.volSfx;
        document.getElementById('opt-vol-music').value = opts.volMusic;
        document.getElementById('val-vol-master').textContent = opts.volMaster + '%';
        document.getElementById('val-vol-sfx').textContent = opts.volSfx + '%';
        document.getElementById('val-vol-music').textContent = opts.volMusic + '%';
        document.getElementById('opt-shake').value = opts.shake;
        document.getElementById('opt-particles').value = opts.particles;
        document.getElementById('opt-touch').value = opts.touch;
        document.getElementById('save-data-area').value = '';
    }

    showLayer(id) {
        document.querySelectorAll('.ui-layer').forEach(l => l.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        this.updateTouchControlsVisibility();
    }

    updateTouchControlsVisibility() {
        const tc = document.getElementById('touch-controls');
        if (this.state !== 'PLAYING') {
            tc.classList.remove('active');
            return;
        }

        const opt = this.saveMgr.data.options.touch;
        const isMobile = window.innerWidth <= 800 || ('ontouchstart' in window);

        if (opt === 'always' || (opt === 'auto' && isMobile)) {
            tc.classList.add('active');
        } else {
            tc.classList.remove('active');
        }
    }

    startGame() {
        this.audio.resume();
        this.audio.playSfx('ui');
        this.audio.startMusic();

        this.state = 'PLAYING';
        this.showLayer('ui-playing');

        this.score = 0;
        this.combo = 1;
        this.hp = 3;
        this.wave = 1;
        this.entities = [];
        this.particles = [];
        this.timeScale = 1.0;
        this.targetTimeScale = 1.0;

        this.updateHUD();
        this.initGameWorld();
    }

    setPause(paused) {
        if (this.state === 'GAME_OVER') return;
        this.audio.playSfx('ui');
        if (paused) {
            this.state = 'PAUSED';
            this.showLayer('ui-paused');
        } else {
            this.state = 'PLAYING';
            this.showLayer('ui-playing');
        }
    }

    endGame() {
        this.state = 'GAME_OVER';
        this.showLayer('ui-gameover');
        this.audio.playSfx('hit');
        this.audio.stopMusic();

        let newHigh = false;
        if (this.score > this.saveMgr.data.highScore) {
            this.saveMgr.data.highScore = this.score;
            newHigh = true;
        }
        if (this.combo > this.saveMgr.data.bestCombo) {
            this.saveMgr.data.bestCombo = this.combo;
        }
        this.saveMgr.data.totalGamesPlayed++;
        this.saveMgr.data.totalScoreAccumulated += this.score;
        this.saveMgr.save();

        document.getElementById('go-score').textContent = this.score;
        document.getElementById('go-combo').textContent = this.combo;
        document.getElementById('go-wave').textContent = this.wave;
        document.getElementById('go-new-high').style.display = newHigh ? 'block' : 'none';
        document.getElementById('title-highscore').textContent = this.saveMgr.data.highScore;

        // Milestones
        const msDiv = document.getElementById('go-milestones');
        msDiv.innerHTML = '';
        if (this.score > 5000 && !this.saveMgr.data.unlockedMilestones.includes('Neon Initiate')) {
            this.saveMgr.data.unlockedMilestones.push('Neon Initiate');
            msDiv.innerHTML += '<div>&#11088; Unlocked: Neon Initiate!</div>';
        }
        if (this.combo >= 20 && !this.saveMgr.data.unlockedMilestones.includes('Combo Master')) {
            this.saveMgr.data.unlockedMilestones.push('Combo Master');
            msDiv.innerHTML += '<div>&#11088; Unlocked: Combo Master!</div>';
        }
        if (this.wave >= 10 && !this.saveMgr.data.unlockedMilestones.includes('Wave Survivor')) {
            this.saveMgr.data.unlockedMilestones.push('Wave Survivor');
            msDiv.innerHTML += '<div>&#11088; Unlocked: Wave Survivor!</div>';
        }
        this.saveMgr.save();
    }

    updateHUD() {
        document.getElementById('hud-score').textContent = this.score;
        document.getElementById('hud-combo').textContent = 'x' + this.combo;
        document.getElementById('hud-hp').textContent = this.hp;
    }

    addScore(pts) {
        this.score += pts * this.combo;
        this.updateHUD();
    }

    initGameWorld() {
        this.player = {
            x: 1280 / 2,
            y: 720 / 2,
            radius: 20,
            color: '#00ffff',
            vx: 0, vy: 0,
            speed: 400,
            dashTimer: 0,
            slashDir: {x: 1, y: 0},
            slashTimer: 0,
            comboTimer: 0
        };
        this.entities = [];
        this.particles = [];
        this.waveTimer = 0;
        this.spawnRate = 2.0;

        // Synthwave grid offset
        this.gridOffsetY = 0;
    }

    loop(timestamp) {
        let rawDt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (rawDt > 0.1) rawDt = 0.1;

        if (this.state === 'PLAYING') {
            this.update(rawDt);
        }

        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }

    update(rawDt) {
        // Core Mechanic: Time-Dilation on Stillness
        let inputMove = this.input.getMovement();
        let inputAction = this.input.getActionDir(this.player.x, this.player.y);

        let isActive = inputMove.active || inputAction.active;
        this.targetTimeScale = isActive ? 1.0 : 0.05;

        // Smooth time scale transition
        this.timeScale += (this.targetTimeScale - this.timeScale) * 10 * rawDt;

        let dt = rawDt * this.timeScale;

        // Grid animation (always moves a bit, faster with time)
        this.gridOffsetY = (this.gridOffsetY + 100 * dt + 10 * rawDt) % 100;

        // Camera shake decay (real time)
        if (this.cameraShake > 0) {
            this.cameraShake -= rawDt * 10;
            if (this.cameraShake < 0) this.cameraShake = 0;
        }

        // --- Player Logic ---

        // Movement (real time feeling but affected by dt for consistency)
        // Player moves closer to full speed to feel responsive
        let pDt = isActive ? rawDt : dt;

        this.player.vx = inputMove.x * this.player.speed;
        this.player.vy = inputMove.y * this.player.speed;

        this.player.x += this.player.vx * pDt;
        this.player.y += this.player.vy * pDt;

        // Bounds
        this.player.x = Math.max(20, Math.min(1260, this.player.x));
        this.player.y = Math.max(20, Math.min(700, this.player.y));

        // Slash / Parry action
        if (this.player.slashTimer > 0) {
            this.player.slashTimer -= pDt;
        }

        if (inputAction.active && this.player.slashTimer <= 0) {
            this.player.slashDir = { x: inputAction.x, y: inputAction.y };
            this.player.slashTimer = 0.3; // Slash cooldown/duration
            this.audio.playSfx('slash');
            this.spawnSlashParticles(this.player.x, this.player.y, this.player.slashDir);

            // Perform hit detection immediately
            this.checkSlashCollisions();
        }

        // Combo decay (real time)
        if (this.combo > 1) {
            this.player.comboTimer -= rawDt;
            if (this.player.comboTimer <= 0) {
                this.combo = 1;
                this.updateHUD();
            }
        }

        // --- Wave & Enemy Logic ---
        this.waveTimer -= dt;
        if (this.waveTimer <= 0) {
            this.spawnEnemy();
            this.spawnRate = Math.max(0.5, 2.0 - (this.wave * 0.1));
            this.waveTimer = this.spawnRate;
            this.wave += 0.1; // Slowly increase wave diff
            document.getElementById('hud-combo').textContent = 'x' + this.combo; // Just to ensure update
        }

        // Update Entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            let e = this.entities[i];
            e.x += e.vx * dt;
            e.y += e.vy * dt;

            if (e.type === 'enemy') {
                // Homing
                let dx = this.player.x - e.x;
                let dy = this.player.y - e.y;
                let dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    // Keep distance if shooter, else home in
                    if (e.isShooter && dist < 300) {
                        e.vx -= (dx / dist) * 50 * dt;
                        e.vy -= (dy / dist) * 50 * dt;
                    } else {
                        e.vx += (dx / dist) * 100 * dt;
                        e.vy += (dy / dist) * 100 * dt;
                    }
                }

                // Friction
                e.vx *= 0.99;
                e.vy *= 0.99;

                // Shooting
                if (e.isShooter && e.shootTimer !== undefined) {
                    e.shootTimer -= dt;
                    if (e.shootTimer <= 0) {
                        e.shootTimer = Math.random() * 2 + 1.5;
                        if (dist > 0) {
                            let pvx = (dx / dist) * 200;
                            let pvy = (dy / dist) * 200;
                            this.entities.push({
                                type: 'projectile',
                                x: e.x + (dx / dist) * e.radius,
                                y: e.y + (dy / dist) * e.radius,
                                vx: pvx,
                                vy: pvy,
                                radius: 8,
                                color: '#ff00ff'
                            });
                        }
                    }
                }

                // Collision with player
                if (dist < this.player.radius + e.radius) {
                    this.takeDamage();
                    this.entities.splice(i, 1);
                    this.spawnExplosion(e.x, e.y, '#ff0055');
                    continue;
                }
            } else if (e.type === 'projectile') {
                let dx = this.player.x - e.x;
                let dy = this.player.y - e.y;
                let dist = Math.hypot(dx, dy);
                if (dist < this.player.radius + e.radius) {
                    this.takeDamage();
                    this.entities.splice(i, 1);
                    this.spawnExplosion(e.x, e.y, '#ff0055');
                    continue;
                }

                // Out of bounds
                if (e.x < -100 || e.x > 1380 || e.y < -100 || e.y > 820) {
                    this.entities.splice(i, 1);
                    continue;
                }
            }
        }

        // Update Particles (real time to look smooth even in dilation)
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * rawDt;
            p.y += p.vy * rawDt;
            p.life -= rawDt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    checkSlashCollisions() {
        let arcSpan = Math.PI / 2; // 90 degree slash arc
        let slashAngle = Math.atan2(this.player.slashDir.y, this.player.slashDir.x);
        let reach = 120;

        let hitSomething = false;

        for (let i = this.entities.length - 1; i >= 0; i--) {
            let e = this.entities[i];
            let dx = e.x - this.player.x;
            let dy = e.y - this.player.y;
            let dist = Math.hypot(dx, dy);

            if (dist < reach + e.radius) {
                let angle = Math.atan2(dy, dx);
                // Normalize angles to compare
                let angleDiff = Math.abs(angle - slashAngle);
                if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

                if (angleDiff <= arcSpan / 2) {
                    // Hit!
                    hitSomething = true;
                    if (e.type === 'enemy') {
                        this.entities.splice(i, 1);
                        this.spawnExplosion(e.x, e.y, e.color);
                        this.addScore(100);
                    } else if (e.type === 'projectile') {
                        // Parry! Refiect it
                        e.vx = this.player.slashDir.x * 600;
                        e.vy = this.player.slashDir.y * 600;
                        e.type = 'parried_projectile';
                        e.color = '#00ffff';
                        this.addScore(50);
                    }
                }
            }
        }

        // Check parried projectiles hitting enemies
        for (let i = this.entities.length - 1; i >= 0; i--) {
            let e = this.entities[i];
            if (e.type === 'parried_projectile') {
                for (let j = this.entities.length - 1; j >= 0; j--) {
                    let enemy = this.entities[j];
                    if (enemy.type === 'enemy' && i !== j) {
                        let dist = Math.hypot(e.x - enemy.x, e.y - enemy.y);
                        if (dist < e.radius + enemy.radius) {
                            this.entities.splice(j, 1); // kill enemy
                            if (i < j) i++; // adjust index if needed but we break anyway
                            this.entities.splice(i, 1); // kill proj
                            this.spawnExplosion(enemy.x, enemy.y, enemy.color);
                            this.addScore(200); // Bonus for parry kill
                            hitSomething = true;
                            break;
                        }
                    }
                }
            }
        }

        if (hitSomething) {
            this.combo++;
            this.player.comboTimer = 3.0; // 3 seconds to keep combo
            this.addCameraShake(0.5);
            this.audio.playSfx('hit');
            this.updateHUD();
        }
    }

    takeDamage() {
        this.hp--;
        this.combo = 1;
        this.updateHUD();
        this.addCameraShake(1.0);
        this.audio.playSfx('hit');

        if (this.hp <= 0) {
            this.endGame();
        } else {
            // Flash red
            this.ctx.fillStyle = 'rgba(255,0,0,0.5)';
            this.ctx.fillRect(0,0,1280,720);

            // push enemies away
            for (let e of this.entities) {
                let dx = e.x - this.player.x;
                let dy = e.y - this.player.y;
                let dist = Math.hypot(dx, dy) || 1;
                e.vx = (dx/dist) * 500;
                e.vy = (dy/dist) * 500;
            }
        }
    }

    spawnEnemy() {
        // Spawn edge
        let side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * 1280; y = -50; }
        else if (side === 1) { x = 1330; y = Math.random() * 720; }
        else if (side === 2) { x = Math.random() * 1280; y = 770; }
        else { x = -50; y = Math.random() * 720; }

        let isShooter = Math.random() > 0.7;

        this.entities.push({
            type: 'enemy',
            x: x, y: y,
            vx: 0, vy: 0,
            radius: 15,
            color: isShooter ? '#ff00ff' : '#ff0055',
            isShooter: isShooter,
            shootTimer: Math.random() * 2 + 1
        });
    }

    addCameraShake(amt) {
        let opt = this.saveMgr.data.options.shake;
        this.cameraShake += amt * opt;
        if (this.cameraShake > 2.0) this.cameraShake = 2.0;
    }

    spawnSlashParticles(px, py, dir) {
        let count = this.saveMgr.data.options.particles === 'high' ? 20 : 5;
        let baseAngle = Math.atan2(dir.y, dir.x);
        for(let i=0; i<count; i++) {
            let angle = baseAngle + (Math.random() - 0.5) * Math.PI/2;
            let speed = Math.random() * 500 + 200;
            this.particles.push({
                x: px + dir.x * 20,
                y: py + dir.y * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 0.2 + 0.1,
                maxLife: 0.3,
                color: '#00ffff'
            });
        }
    }

    spawnExplosion(px, py, color) {
        let count = this.saveMgr.data.options.particles === 'high' ? 30 : 10;
        for(let i=0; i<count; i++) {
            let angle = Math.random() * Math.PI * 2;
            let speed = Math.random() * 300 + 50;
            this.particles.push({
                x: px, y: py,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: Math.random() * 0.5 + 0.2,
                maxLife: 0.7,
                color: color
            });
        }
    }

    draw() {
        // Pre-calculate shake
        let sx = (Math.random() - 0.5) * 20 * this.cameraShake;
        let sy = (Math.random() - 0.5) * 20 * this.cameraShake;

        this.ctx.save();
        this.ctx.translate(sx, sy);

        // Background
        this.ctx.fillStyle = '#05050f';
        this.ctx.fillRect(0, 0, 1280, 720);

        // Time Dilation overlay
        if (this.state === 'PLAYING') {
            this.ctx.fillStyle = `rgba(10, 0, 30, ${1.0 - this.timeScale})`;
            this.ctx.fillRect(0, 0, 1280, 720);
        }

        // Procedural Grid (Synthwave style)
        this.ctx.strokeStyle = `rgba(194, 157, 126, ${0.1 + 0.2 * this.timeScale})`;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();

        // Perspective horizontal lines
        let vanishY = 200;
        for(let i=0; i<15; i++) {
            let y = vanishY + Math.pow(i + (this.gridOffsetY/100), 2) * 3;
            if (y > 720) break;
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(1280, y);
        }

        // Perspective vertical lines
        for(let i=-20; i<=20; i++) {
            let startX = 640 + i * 10;
            let endX = 640 + i * 80;
            this.ctx.moveTo(startX, vanishY);
            this.ctx.lineTo(endX, 720);
        }
        this.ctx.stroke();

        // Sun
        let grad = this.ctx.createLinearGradient(0, 50, 0, vanishY);
        grad.addColorStop(0, '#ff0055');
        grad.addColorStop(1, '#ffaa00');
        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.arc(640, vanishY, 100, Math.PI, 0);
        this.ctx.fill();

        // Glow effect setup
        this.ctx.globalCompositeOperation = 'lighter';

        // Draw Particles
        for (let p of this.particles) {
            let alpha = Math.max(0, p.life / p.maxLife);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = alpha;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3 + alpha * 2, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;
        this.ctx.shadowBlur = 0;

        // Draw Entities
        for (let e of this.entities) {
            this.ctx.fillStyle = e.color;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = e.color;
            this.ctx.beginPath();

            if (e.type === 'enemy') {
                if (e.isShooter) {
                    this.ctx.moveTo(e.x, e.y - e.radius);
                    this.ctx.lineTo(e.x + e.radius, e.y + e.radius);
                    this.ctx.lineTo(e.x - e.radius, e.y + e.radius);
                } else {
                    this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
                }
            } else if (e.type === 'projectile' || e.type === 'parried_projectile') {
                this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI*2);
            }
            this.ctx.fill();

            // Eyes/Core
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowBlur = 0;
            this.ctx.beginPath();
            this.ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI*2);
            this.ctx.fill();
        }

        if (this.state === 'PLAYING' || this.state === 'GAME_OVER') {
            // Draw Player
            this.ctx.fillStyle = this.player.color;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = this.player.color;

            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y - this.player.radius);
            this.ctx.lineTo(this.player.x + this.player.radius, this.player.y + this.player.radius);
            this.ctx.lineTo(this.player.x - this.player.radius, this.player.y + this.player.radius);
            this.ctx.fill();

            // Slash Arc visual
            if (this.player.slashTimer > 0) {
                let arcSpan = Math.PI / 2;
                let slashAngle = Math.atan2(this.player.slashDir.y, this.player.slashDir.x);
                let reach = 120;

                this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
                this.ctx.lineWidth = 5 * (this.player.slashTimer / 0.3);
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = '#00ffff';
                this.ctx.beginPath();
                this.ctx.arc(this.player.x, this.player.y, reach, slashAngle - arcSpan/2, slashAngle + arcSpan/2);
                this.ctx.stroke();
            }

            this.ctx.shadowBlur = 0;
        }

        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.restore();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
});
