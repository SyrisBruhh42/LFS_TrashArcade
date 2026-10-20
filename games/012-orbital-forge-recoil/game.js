// 1. SaveManager - Namespaced fault-tolerant persistence
class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_012_012-orbital-forge-recoil_v1';
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                volMaster: 100,
                volSfx: 100,
                volMusic: 100,
                shake: 1,
                particles: 'high',
                touch: 'auto'
            }
        };
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = { ...this.data, ...parsed };
                // ensure options object merges correctly
                if (parsed.options) {
                    this.data.options = { ...this.data.options, ...parsed.options };
                }
            }
        } catch (e) {
            console.warn('SaveManager load failed, using fallback.', e);
        }
    }

    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn('SaveManager save failed.', e);
        }
    }

    reset() {
        try {
            localStorage.removeItem(this.saveKey);
        } catch (e) {
            console.warn('SaveManager reset failed.', e);
        }
        // Restore defaults
        this.data = {
            highScore: 0, bestWaveOrCombo: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0, unlockedMilestones: [],
            options: { volMaster: 100, volSfx: 100, volMusic: 100, shake: 1, particles: 'high', touch: 'auto' }
        };
        this.save();
    }

    exportSave() {
        return btoa(JSON.stringify(this.data));
    }

    importSave(base64Str) {
        try {
            const parsed = JSON.parse(atob(base64Str));
            if (parsed && typeof parsed === 'object') {
                this.data = { ...this.data, ...parsed };
                this.save();
                return true;
            }
        } catch (e) {
            console.warn('Import failed', e);
        }
        return false;
    }
}

// 2. InputManager - Unified inputs
class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
        this.justFired = false;

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        window.addEventListener('mousemove', e => this.updateMouse(e));
        window.addEventListener('mousedown', e => { this.updateMouse(e); this.mouse.down = true; this.justFired = true; });
        window.addEventListener('mouseup', e => { this.updateMouse(e); this.mouse.down = false; });

        window.addEventListener('touchstart', e => this.handleTouch(e, true), {passive: false});
        window.addEventListener('touchmove', e => this.handleTouch(e, true), {passive: false});
        window.addEventListener('touchend', e => this.handleTouch(e, false), {passive: false});
        window.addEventListener('pointerdown', e => {
            // marker requirement
            if(e.pointerType === 'touch') this.touch.active = true;
        });
    }

    updateMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
    }

    handleTouch(e, isDown) {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
            e.preventDefault();
        }
        this.touch.active = isDown;
        if (e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            this.touch.x = e.touches[0].clientX - rect.left;
            this.touch.y = e.touches[0].clientY - rect.top;
            if (e.type === 'touchstart') {
                this.touch.startX = this.touch.x;
                this.touch.startY = this.touch.y;
                this.justFired = true;
            }
        }
    }
}

// 3. GameEngine - State & Setup
class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.inputManager = new InputManager(this.canvas);

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.width = entry.contentRect.width;
                this.height = entry.contentRect.height;
                this.canvas.width = this.width;
                this.canvas.height = this.height;
            }
        });
        this.resizeObserver.observe(document.getElementById('game-container'));

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.bindUI();

        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.setState('PAUSED');
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.setState('PAUSED');
            }
        });
    }

    bindUI() {
        // We will implement UI binding shortly
        document.getElementById('btn-play').addEventListener('click', () => this.startGame());
        document.getElementById('pause-btn').addEventListener('click', () => this.setState('PAUSED'));
        document.getElementById('btn-resume').addEventListener('click', () => this.setState('PLAYING'));
        document.getElementById('btn-restart-pause').addEventListener('click', () => this.startGame());
        document.getElementById('btn-quit').addEventListener('click', () => this.setState('TITLE'));
        document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());
        document.getElementById('btn-go-title').addEventListener('click', () => this.setState('TITLE'));

        // title highscore
        document.getElementById('title-highscore').innerText = this.saveManager.data.highScore;
    }

    setState(newState) {
        this.state = newState;
        document.querySelectorAll('.ui-layer, .hud').forEach(el => el.classList.add('hidden'));

        if (newState === 'TITLE') {
            document.getElementById('ui-title').classList.remove('hidden');
            document.getElementById('title-highscore').innerText = this.saveManager.data.highScore;
        } else if (newState === 'PLAYING') {
            document.getElementById('ui-hud').classList.remove('hidden');
        } else if (newState === 'PAUSED') {
            document.getElementById('ui-paused').classList.remove('hidden');
        } else if (newState === 'GAME_OVER') {
            document.getElementById('ui-game-over').classList.remove('hidden');
        }
    }

    startGame() {
        this.setState('PLAYING');
    }

    start() {
        this.setState('TITLE');
    }
}
window.GameEngine = GameEngine;

// 4. SoundEngine - Procedural Audio
class SoundEngine {
    constructor(saveManager) {
        this.saveManager = saveManager;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.masterGain);

        this.updateVolumes();
        this.initialized = false;
    }

    updateVolumes() {
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.volMaster / 100;
        this.sfxGain.gain.value = opts.volSfx / 100;
        this.musicGain.gain.value = opts.volMusic / 100;
    }

    init() {
        if (!this.initialized && this.ctx.state === 'suspended') {
            this.ctx.resume();
            this.initialized = true;
            this.startMusic();
        }
    }

    playShoot() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.1);
    }

    playHit() {
        if (!this.initialized) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

        gain.gain.setValueAtTime(0.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(t);
        osc.stop(t + 0.2);
    }

    startMusic() {
        // Simple procedural background rhythm
        setInterval(() => {
            if (!this.initialized || this.musicGain.gain.value === 0) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);

            gain.gain.setValueAtTime(0.2, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.1);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(t);
            osc.stop(t + 0.1);
        }, 500);
    }
}

class GraphicsEngine {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.particles = [];
        this.shakeTimer = 0;
        this.shakeMag = 0;
    }

    resize(w, h) {
        this.width = w;
        this.height = h;
    }

    addShake(mag) {
        this.shakeTimer = 0.2;
        this.shakeMag = mag;
    }

    addParticle(x, y, vx, vy, color, life) {
        this.particles.push({x, y, vx, vy, color, life, maxLife: life});
    }

    render(dt, stateObj, opts) {
        this.ctx.save();

        // Screenshake
        if (this.shakeTimer > 0 && opts.shake > 0) {
            const mag = this.shakeMag * opts.shake;
            const dx = (Math.random() - 0.5) * mag;
            const dy = (Math.random() - 0.5) * mag;
            this.ctx.translate(dx, dy);
            this.shakeTimer -= dt;
        }

        // Draw background (Volcanic Forge)
        this.ctx.fillStyle = '#1a0b0b';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw magma pools (gravity wells)
        stateObj.wells.forEach(well => {
            const grad = this.ctx.createRadialGradient(well.x, well.y, 0, well.x, well.y, well.r);
            grad.addColorStop(0, '#ffaa00');
            grad.addColorStop(0.5, '#dd2200');
            grad.addColorStop(1, 'rgba(50,10,10,0)');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(well.x, well.y, well.r * 2, 0, Math.PI * 2);
            this.ctx.fill();

            // core
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(well.x, well.y, well.r * 0.2, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw Player
        if (stateObj.player.active) {
            const p = stateObj.player;
            this.ctx.fillStyle = '#ab4777';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            this.ctx.fill();

            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();

            // Aiming reticle (opposite of movement logic)
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.moveTo(p.x, p.y);
            this.ctx.lineTo(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30);
            this.ctx.stroke();
        }

        // Draw Enemies
        stateObj.enemies.forEach(e => {
            this.ctx.fillStyle = '#e8a55d';
            this.ctx.beginPath();
            this.ctx.rect(e.x - e.r, e.y - e.r, e.r*2, e.r*2);
            this.ctx.fill();
        });

        // Draw Projectiles
        stateObj.projectiles.forEach(p => {
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            this.ctx.fill();
        });

        // Update and Draw Particles
        const pLimit = opts.particles === 'high' ? 200 : 50;
        if (this.particles.length > pLimit) {
            this.particles.splice(0, this.particles.length - pLimit);
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;

        this.ctx.restore();
    }
}

// 5. Physics and Main Gameplay Logic integration into GameEngine
GameEngine.prototype.initGame = function() {
    this.soundEngine = new SoundEngine(this.saveManager);
    this.graphicsEngine = new GraphicsEngine(this.ctx, this.width, this.height);

    this.lastTime = performance.now();
    this.gameState = {
        player: { x: this.width/2, y: this.height/2, vx: 0, vy: 0, r: 10, angle: 0, active: true },
        wells: [],
        enemies: [],
        projectiles: [],
        score: 0,
        health: 3,
        wave: 1,
        waveTimer: 0
    };

    // Create initial gravity wells
    this.generateWells();

    if (!this.loopRunning) {
        this.loopRunning = true;
        requestAnimationFrame(t => this.loop(t));
    }
};

GameEngine.prototype.generateWells = function() {
    this.gameState.wells = [];
    for(let i=0; i<3; i++) {
        this.gameState.wells.push({
            x: Math.random() * (this.width - 100) + 50,
            y: Math.random() * (this.height - 100) + 50,
            r: Math.random() * 40 + 20,
            mass: Math.random() * 5000 + 2000
        });
    }
};

GameEngine.prototype.loop = function(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (this.state === 'PLAYING') {
        this.update(dt);
    }

    if (this.graphicsEngine) {
        this.graphicsEngine.resize(this.width, this.height);
        this.graphicsEngine.render(dt, this.gameState, this.saveManager.data.options);
    }

    requestAnimationFrame(t => this.loop(t));
};

GameEngine.prototype.update = function(dt) {
    const p = this.gameState.player;
    if (!p.active) return;

    // Recoil mechanic: aiming and shooting
    // WASD / Arrow keys aiming
    let aimX = 0, aimY = 0;
    if (this.inputManager.keys['ArrowLeft'] || this.inputManager.keys['KeyA']) aimX -= 1;
    if (this.inputManager.keys['ArrowRight'] || this.inputManager.keys['KeyD']) aimX += 1;
    if (this.inputManager.keys['ArrowUp'] || this.inputManager.keys['KeyW']) aimY -= 1;
    if (this.inputManager.keys['ArrowDown'] || this.inputManager.keys['KeyS']) aimY += 1;

    if (aimX !== 0 || aimY !== 0) {
        p.angle = Math.atan2(aimY, aimX);
    } else if (this.inputManager.touch.active || this.inputManager.mouse.down) {
        // pointer aiming
        const px = this.inputManager.touch.active ? this.inputManager.touch.x : this.inputManager.mouse.x;
        const py = this.inputManager.touch.active ? this.inputManager.touch.y : this.inputManager.mouse.y;
        p.angle = Math.atan2(py - p.y, px - p.x);
    }

    if (this.inputManager.justFired) {
        this.inputManager.justFired = false;
        this.soundEngine.init();
        this.soundEngine.playShoot();

        // Shoot projectile
        this.gameState.projectiles.push({
            x: p.x, y: p.y,
            vx: Math.cos(p.angle) * 500,
            vy: Math.sin(p.angle) * 500,
            r: 3, life: 2
        });

        // RECOIL! Move opposite to aim
        p.vx -= Math.cos(p.angle) * 150;
        p.vy -= Math.sin(p.angle) * 150;

        for(let i=0; i<5; i++) {
            this.graphicsEngine.addParticle(p.x, p.y, -Math.cos(p.angle)*50 + (Math.random()-0.5)*20, -Math.sin(p.angle)*50 + (Math.random()-0.5)*20, '#ab4777', 0.5);
        }
    }

    // Gravity from wells
    this.gameState.wells.forEach(well => {
        const dx = well.x - p.x;
        const dy = well.y - p.y;
        const distSq = dx*dx + dy*dy;
        const dist = Math.sqrt(distSq);

        if (dist > 5) {
            const force = (100 * well.mass) / distSq;
            p.vx += (dx/dist) * force * dt;
            p.vy += (dy/dist) * force * dt;
        }

        // Lava collision
        if (dist < well.r + p.r) {
            this.takeDamage();
            // bounce
            p.vx *= -1; p.vy *= -1;
            p.x += p.vx * dt; p.y += p.vy * dt;
        }
    });

    // Apply friction and move
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Screen wrap
    if (p.x < 0) p.x = this.width;
    if (p.x > this.width) p.x = 0;
    if (p.y < 0) p.y = this.height;
    if (p.y > this.height) p.y = 0;

    // Projectiles
    for (let i = this.gameState.projectiles.length - 1; i >= 0; i--) {
        let proj = this.gameState.projectiles[i];
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.life -= dt;
        if (proj.life <= 0) {
            this.gameState.projectiles.splice(i, 1);
            continue;
        }

        // Enemy collision
        for (let j = this.gameState.enemies.length - 1; j >= 0; j--) {
            let e = this.gameState.enemies[j];
            const dx = proj.x - e.x;
            const dy = proj.y - e.y;
            if (dx*dx + dy*dy < (e.r + proj.r)**2) {
                this.gameState.projectiles.splice(i, 1);
                this.gameState.enemies.splice(j, 1);
                this.soundEngine.playHit();
                this.graphicsEngine.addShake(5);
                for(let k=0; k<10; k++) this.graphicsEngine.addParticle(e.x, e.y, (Math.random()-0.5)*100, (Math.random()-0.5)*100, '#e8a55d', 0.5);
                this.addScore(100);
                break;
            }
        }
    }

    // Enemies spawning
    this.gameState.waveTimer -= dt;
    if (this.gameState.waveTimer <= 0) {
        this.gameState.waveTimer = 3 - Math.min(2.5, this.gameState.wave * 0.1);
        this.gameState.enemies.push({
            x: Math.random() > 0.5 ? 0 : this.width,
            y: Math.random() * this.height,
            r: 8,
            vx: 0, vy: 0
        });
    }

    // Enemies update
    for (let i = this.gameState.enemies.length - 1; i >= 0; i--) {
        let e = this.gameState.enemies[i];
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0) {
            e.x += (dx/dist) * 50 * dt;
            e.y += (dy/dist) * 50 * dt;
        }

        if (dist < p.r + e.r) {
            this.takeDamage();
            this.gameState.enemies.splice(i, 1);
        }
    }

    this.updateHUD();
};

GameEngine.prototype.addScore = function(pts) {
    this.gameState.score += pts;
    if (this.gameState.score % 1000 === 0) {
        this.gameState.wave++;
        this.generateWells();
    }
};

GameEngine.prototype.takeDamage = function() {
    this.gameState.health--;
    this.soundEngine.playHit();
    this.graphicsEngine.addShake(15);
    for(let k=0; k<20; k++) this.graphicsEngine.addParticle(this.gameState.player.x, this.gameState.player.y, (Math.random()-0.5)*200, (Math.random()-0.5)*200, '#ff4444', 1);

    if (this.gameState.health <= 0) {
        this.endGame();
    }
};

GameEngine.prototype.updateHUD = function() {
    document.getElementById('score-display').innerText = `SCORE: ${this.gameState.score}`;
    document.getElementById('health-display').innerText = '♥'.repeat(Math.max(0, this.gameState.health));
};

GameEngine.prototype.endGame = function() {
    this.gameState.player.active = false;
    this.saveManager.data.totalGamesPlayed++;
    this.saveManager.data.totalScoreAccumulated += this.gameState.score;

    let isNewHigh = false;
    if (this.gameState.score > this.saveManager.data.highScore) {
        this.saveManager.data.highScore = this.gameState.score;
        isNewHigh = true;
    }

    // Milestones check
    let newMilestones = [];
    if (this.gameState.score >= 5000 && !this.saveManager.data.unlockedMilestones.includes('Forge Master')) {
        this.saveManager.data.unlockedMilestones.push('Forge Master');
        newMilestones.push('Forge Master (5000 pts)');
    }
    if (this.gameState.wave >= 10 && !this.saveManager.data.unlockedMilestones.includes('Wave Survivor')) {
        this.saveManager.data.unlockedMilestones.push('Wave Survivor');
        newMilestones.push('Wave Survivor (Reach Wave 10)');
    }
    if (this.saveManager.data.totalGamesPlayed >= 5 && !this.saveManager.data.unlockedMilestones.includes('Dedicated Orbit')) {
        this.saveManager.data.unlockedMilestones.push('Dedicated Orbit');
        newMilestones.push('Dedicated Orbit (Play 5 times)');
    }

    this.saveManager.save();

    document.getElementById('go-score').innerText = this.gameState.score;
    document.getElementById('go-highscore-banner').style.display = isNewHigh ? 'block' : 'none';

    const mlDiv = document.getElementById('go-milestones');
    mlDiv.innerHTML = newMilestones.length > 0 ? `<p>Unlocked: ${newMilestones.join(', ')}</p>` : '';

    this.setState('GAME_OVER');
};

// Override existing startGame to initialize state
const originalStartGame = GameEngine.prototype.startGame;
GameEngine.prototype.startGame = function() {
    if (!this.gameState || this.state === 'GAME_OVER' || this.state === 'TITLE' || this.state === 'PAUSED' && this.gameState.health <= 0) {
        this.initGame();
    } else {
        // Resuming from pause
        if(this.soundEngine && this.soundEngine.ctx.state === 'suspended') {
            this.soundEngine.ctx.resume();
        }
    }
    this.setState('PLAYING');
};

// Final Options UI binding for GameEngine
GameEngine.prototype.bindOptionsUI = function() {
    const s = this.saveManager;
    const updateUI = () => {
        document.getElementById('opt-vol-master').value = s.data.options.volMaster;
        document.getElementById('opt-vol-sfx').value = s.data.options.volSfx;
        document.getElementById('opt-vol-music').value = s.data.options.volMusic;
        document.getElementById('opt-shake').value = s.data.options.shake;
        document.getElementById('opt-particles').value = s.data.options.particles;
        document.getElementById('opt-touch').value = s.data.options.touch;
    };
    updateUI();

    document.getElementById('opt-vol-master').addEventListener('input', e => { s.data.options.volMaster = e.target.value; if(this.soundEngine) this.soundEngine.updateVolumes(); s.save(); });
    document.getElementById('opt-vol-sfx').addEventListener('input', e => { s.data.options.volSfx = e.target.value; if(this.soundEngine) this.soundEngine.updateVolumes(); s.save(); });
    document.getElementById('opt-vol-music').addEventListener('input', e => { s.data.options.volMusic = e.target.value; if(this.soundEngine) this.soundEngine.updateVolumes(); s.save(); });
    document.getElementById('opt-shake').addEventListener('change', e => { s.data.options.shake = parseFloat(e.target.value); s.save(); });
    document.getElementById('opt-particles').addEventListener('change', e => { s.data.options.particles = e.target.value; s.save(); });
    document.getElementById('opt-touch').addEventListener('change', e => { s.data.options.touch = e.target.value; s.save(); });

    document.getElementById('btn-options-title').addEventListener('click', () => { document.getElementById('ui-options').classList.remove('hidden'); });
    document.getElementById('btn-options-pause').addEventListener('click', () => { document.getElementById('ui-options').classList.remove('hidden'); });
    document.getElementById('btn-options-close').addEventListener('click', () => { document.getElementById('ui-options').classList.add('hidden'); });

    document.getElementById('btn-howto').addEventListener('click', () => { document.getElementById('ui-howto').classList.remove('hidden'); });
    document.getElementById('btn-howto-close').addEventListener('click', () => { document.getElementById('ui-howto').classList.add('hidden'); });

    document.getElementById('btn-save-export').addEventListener('click', () => {
        const ta = document.getElementById('export-text');
        ta.value = s.exportSave();
        ta.style.display = 'block';
        ta.select();
    });

    document.getElementById('btn-save-import').addEventListener('click', () => {
        const val = prompt('Paste your save string:');
        if (val && s.importSave(val)) {
            alert('Import successful!');
            updateUI();
        } else if (val) {
            alert('Import failed.');
        }
    });

    let resetClicks = 0;
    document.getElementById('btn-save-reset').addEventListener('click', (e) => {
        resetClicks++;
        if (resetClicks === 1) {
            e.target.innerText = 'Click again to confirm reset';
            setTimeout(() => { resetClicks = 0; e.target.innerText = 'Reset Save'; }, 3000);
        } else {
            s.reset();
            updateUI();
            e.target.innerText = 'Reset Save';
            resetClicks = 0;
            alert('Save Reset!');
        }
    });
};

const originalBindUI = GameEngine.prototype.bindUI;
GameEngine.prototype.bindUI = function() {
    originalBindUI.call(this);
    this.bindOptionsUI();
};
