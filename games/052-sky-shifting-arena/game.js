
// --- ENGINE FUNDAMENTALS ---
const GAME_ID = "052";
const GAME_SLUG = "052-sky-shifting-arena";
const SAVE_KEY = "arcade_game_052_052-sky-shifting-arena_v1";

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWave: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { soundVol: 1, musicVol: 1 }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                this.data = { ...this.data, ...JSON.parse(stored) };
            }
        } catch(e) { console.warn("Save load failed", e); }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch(e) { console.warn("Save failed", e); }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.initialized = false;
    }
    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch(e) { console.warn("AudioContext init failed", e); }
    }
    playTone(freq, type, duration, vol = 0.1) {
        if (!this.initialized || !this.ctx) return;
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
    playShoot() { this.playTone(400, 'square', 0.1, 0.05); }
    playHit() { this.playTone(150, 'sawtooth', 0.2, 0.1); }
    playExplosion() { this.playTone(80, 'square', 0.3, 0.2); }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touchLeft = { active: false, id: null, originX: 0, originY: 0, dx: 0, dy: 0 };
        this.touchRight = { active: false, id: null, originX: 0, originY: 0, dx: 0, dy: 0 };
        this.dashPressed = false;
        this.isTouchDevice = false;

        window.addEventListener('keydown', e => { this.keys[e.code] = true; if(e.code === 'Space' || e.code === 'ShiftLeft') this.dashPressed = true; });
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('mousemove', e => this.updateMouse(e));
        window.addEventListener('mousedown', e => { if (e.button === 0) this.mouse.down = true; if (e.button === 2) this.dashPressed = true; this.updateMouse(e); });
        window.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('mouseup', () => this.mouse.down = false);

        // Touch events on specific zones
        const leftZone = document.getElementById('touch-left-zone');
        const rightZone = document.getElementById('touch-right-zone');

        if (leftZone && rightZone) {
            leftZone.addEventListener('touchstart', e => this.handleTouchStart(e, 'left'), {passive: false});
            leftZone.addEventListener('touchmove', e => this.handleTouchMove(e, 'left'), {passive: false});
            leftZone.addEventListener('touchend', e => this.handleTouchEnd(e, 'left'));
            leftZone.addEventListener('touchcancel', e => this.handleTouchEnd(e, 'left'));

            rightZone.addEventListener('touchstart', e => this.handleTouchStart(e, 'right'), {passive: false});
            rightZone.addEventListener('touchmove', e => this.handleTouchMove(e, 'right'), {passive: false});
            rightZone.addEventListener('touchend', e => this.handleTouchEnd(e, 'right'));
            rightZone.addEventListener('touchcancel', e => this.handleTouchEnd(e, 'right'));

            const dashBtn = document.getElementById('touch-dash-btn');
            if (dashBtn) {
                dashBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.dashPressed = true; }, {passive: false});
            }

            // Generic touch start to detect device and init audio
            window.addEventListener('touchstart', () => { this.isTouchDevice = true; document.getElementById('touch-controls').classList.remove('hidden'); }, {once:true});
        }
    }

    updateMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    }

    handleTouchStart(e, side) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        const state = side === 'left' ? this.touchLeft : this.touchRight;
        if (!state.active) {
            state.active = true;
            state.id = touch.identifier;
            state.originX = touch.clientX;
            state.originY = touch.clientY;
            state.dx = 0;
            state.dy = 0;
        }
    }

    handleTouchMove(e, side) {
        e.preventDefault();
        const state = side === 'left' ? this.touchLeft : this.touchRight;
        if (!state.active) return;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === state.id) {
                // Normalize dx, dy to -1..1 range (max radius 50px)
                const dx = touch.clientX - state.originX;
                const dy = touch.clientY - state.originY;
                const dist = Math.hypot(dx, dy);
                const maxDist = 50;
                if (dist > maxDist) {
                    state.dx = (dx / dist);
                    state.dy = (dy / dist);
                } else {
                    state.dx = dx / maxDist;
                    state.dy = dy / maxDist;
                }
            }
        }
    }

    handleTouchEnd(e, side) {
        const state = side === 'left' ? this.touchLeft : this.touchRight;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === state.id) {
                state.active = false;
                state.id = null;
                state.dx = 0;
                state.dy = 0;
            }
        }
    }

    getMovementVector() {
        let vx = 0, vy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) vy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) vy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) vx += 1;

        if (this.touchLeft.active) {
            vx = this.touchLeft.dx;
            vy = this.touchLeft.dy;
        }

        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
            vx /= mag; vy /= mag;
        }
        const dash = this.dashPressed;
        this.dashPressed = false; // consume
        return { x: vx, y: vy, dash: dash };
    }

    getAimVector(playerX, playerY) {
        if (this.touchRight.active) {
             const mag = Math.hypot(this.touchRight.dx, this.touchRight.dy);
             if(mag > 0.1) return { x: this.touchRight.dx, y: this.touchRight.dy, firing: true };
             return {x: 0, y: 0, firing: false};
        }
        // Mouse aiming
        const dx = this.mouse.x - playerX;
        const dy = this.mouse.y - playerY;
        const mag = Math.hypot(dx, dy);
        if (mag > 0 && this.mouse.down) {
            return { x: dx/mag, y: dy/mag, firing: true };
        } else if (mag > 0) {
            return { x: dx/mag, y: dy/mag, firing: false };
        }
        return { x: 1, y: 0, firing: false }; // Default facing
    }
}

// --- ENGINE BASE ---

class Projectile {
    constructor(x, y, dx, dy, isPlayer) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = 400;
        this.radius = 4;
        this.isPlayer = isPlayer;
        this.color = isPlayer ? '#fff' : '#e94560';
        this.active = true;
    }

    update(dt, arena) {
        this.x += this.dx * this.speed * dt;
        this.y += this.dy * this.speed * dt;

        if (this.x < arena.x || this.x > arena.x + arena.w || this.y < arena.y || this.y > arena.y + arena.h) {
            this.active = false;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Arena {
    constructor(w, h) {
        this.baseW = w;
        this.baseH = h;
        this.w = w;
        this.h = h;
        this.x = 0;
        this.y = 0;

        this.targetW = w;
        this.targetH = h;
        this.targetX = 0;
        this.targetY = 0;

        this.shiftTimer = 0;
        this.shiftInterval = 5; // seconds
        this.shrinkFactor = 1.0;
    }

    update(dt) {
        this.shiftTimer += dt;
        if (this.shiftTimer >= this.shiftInterval) {
            this.shiftTimer = 0;
            this.pickNewTarget();
        }

        // Lerp bounds
        const lerpSpeed = 1.5;
        this.w += (this.targetW - this.w) * lerpSpeed * dt;
        this.h += (this.targetH - this.h) * lerpSpeed * dt;
        this.x += (this.targetX - this.x) * lerpSpeed * dt;
        this.y += (this.targetY - this.y) * lerpSpeed * dt;


    }

    pickNewTarget() {
        this.shrinkFactor = Math.max(0.4, this.shrinkFactor - 0.05);
        const nextW = this.baseW * this.shrinkFactor * (0.8 + Math.random() * 0.4);
        const nextH = this.baseH * this.shrinkFactor * (0.8 + Math.random() * 0.4);

        // Keep center somewhat constrained
        const maxOffsetX = (this.baseW - nextW) / 2;
        const maxOffsetY = (this.baseH - nextH) / 2;

        const nextX = -maxOffsetX + Math.random() * (maxOffsetX * 2);
        const nextY = -maxOffsetY + Math.random() * (maxOffsetY * 2);

        this.targetW = Math.max(300, nextW);
        this.targetH = Math.max(300, nextH);
        this.targetX = nextX;
        this.targetY = nextY;
    }

    draw(ctx) {
        // Draw Arena Grid / Platform
        ctx.save();
        ctx.translate(this.x, this.y);

        // Floor
        ctx.fillStyle = '#16213e';
        ctx.fillRect(0, 0, this.w, this.h);

        // Grid lines
        ctx.strokeStyle = 'rgba(89, 194, 151, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0; i<this.w; i+=40) { ctx.moveTo(i, 0); ctx.lineTo(i, this.h); }
        for(let i=0; i<this.h; i+=40) { ctx.moveTo(0, i); ctx.lineTo(this.w, i); }
        ctx.stroke();

        // Border
        ctx.strokeStyle = '#59c297';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, this.w, this.h);

        ctx.restore();
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.speed = 100 + Math.random() * 50;
        this.color = '#e94560';
        this.health = 20;
        this.active = true;
    }

    update(dt, playerX, playerY, arena) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        // Arena bounds (take damage if outside)
        if (this.x < arena.x || this.x > arena.x + arena.w || this.y < arena.y || this.y > arena.y + arena.h) {
            this.health -= 10 * dt;
        }

        if (this.health <= 0) this.active = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputManager(this.canvas);
        this.audio = new SoundEngine();
        this.saveManager = new SaveManager();

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = performance.now();

        this.logicalWidth = 1280;
        this.logicalHeight = 720;

        this.setupUI();
        this.resize();

        const ro = new ResizeObserver(() => this.resize());
        ro.observe(this.canvas.parentElement);

        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.setState('PAUSED');
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.setState('PAUSED');
        });

        this.resetGame();
    }

    setupUI() {
        document.getElementById('btn-start').addEventListener('click', () => {
            this.audio.init();
            this.setState('PLAYING');
        });
        document.getElementById('btn-resume').addEventListener('click', () => {
            this.setState('PLAYING');
        });
        document.getElementById('btn-restart').addEventListener('click', () => {
            this.resetGame();
            this.setState('PLAYING');
        });

        window.addEventListener('keydown', e => {
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.state === 'PLAYING') this.setState('PAUSED');
                else if (this.state === 'PAUSED') this.setState('PLAYING');
            }
        });
    }

    resize() {
        const parent = this.canvas.parentElement;
        const rect = parent.getBoundingClientRect();

        const aspect = this.logicalWidth / this.logicalHeight;
        let w = rect.width;
        let h = w / aspect;

        if (h > rect.height) {
            h = rect.height;
            w = h * aspect;
        }

        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        // Logical resolution
        this.canvas.width = this.logicalWidth;
        this.canvas.height = this.logicalHeight;
    }

    setState(newState) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

        if (newState === 'TITLE') {
            document.getElementById('title-screen').classList.remove('hidden');
        } else if (newState === 'PLAYING') {
            document.getElementById('hud-screen').classList.remove('hidden');
        } else if (newState === 'PAUSED') {
            document.getElementById('pause-screen').classList.remove('hidden');
        } else if (newState === 'GAME_OVER') {
            document.getElementById('game-over-screen').classList.remove('hidden');
            document.getElementById('final-score').innerText = `Score: ${this.score}`;
            document.getElementById('best-score').innerText = `Best: ${this.saveManager.data.highScore}`;
        }
        this.state = newState;
    }

    resetGame() {
        this.arena = new Arena(800, 600);
        this.player = new Player(0, 0);
        this.projectiles = [];
        this.enemies = [];
        this.particles = [];

        this.score = 0;
        this.wave = 1;
        this.spawnTimer = 0;
        this.waveTimer = 0;

        this.worldBg = new ParallaxBackground();
        this.hazards = new HazardManager();
        this.updateHUD();
    }

    spawnEnemy() {
        // Spawn outside arena bounds
        const angle = Math.random() * Math.PI * 2;
        const r = Math.max(this.arena.w, this.arena.h) * 0.8;
        const ex = this.arena.x + this.arena.w/2 + Math.cos(angle) * r;
        const ey = this.arena.y + this.arena.h/2 + Math.sin(angle) * r;
        this.enemies.push(new Enemy(ex, ey));
    }

    updateHUD() {
        document.getElementById('hud-score').innerText = `Score: ${this.score}`;
        document.getElementById('hud-wave').innerText = `Wave: ${this.wave}`;

        const healthBar = document.getElementById('health-bar');
        const hpPercent = Math.max(0, this.player.health / this.player.maxHealth) * 100;
        healthBar.style.width = `${hpPercent}%`;
        healthBar.style.backgroundColor = hpPercent > 30 ? '#59c297' : '#e94560';

        const dashBar = document.getElementById('dash-bar');
        if (dashBar) {
            const dashReadyPercent = Math.max(0, 1 - (this.player.dashCooldown / this.player.dashCooldownMax)) * 100;
            dashBar.style.width = `${dashReadyPercent}%`;
            dashBar.style.backgroundColor = dashReadyPercent >= 100 ? '#00d2ff' : '#555555';
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        // Ensure dt is capped
        if (dt > 0.1) dt = 0.1;

        const moveVec = this.input.getMovementVector();
        const aimVec = this.input.getAimVector(this.logicalWidth/2, this.logicalHeight/2);

        this.player.update(dt, moveVec, aimVec, this.arena);
        this.arena.update(dt);
        this.worldBg.update(dt);
        this.hazards.update(dt, this.arena, this.player, this.enemies, this.projectiles, this.audio);


        if (aimVec.firing && this.player.fireCooldown <= 0) {
            this.projectiles.push(new Projectile(this.player.x, this.player.y, aimVec.x, aimVec.y, true));
            this.player.fireCooldown = this.player.fireRate;
            this.player.recoilOffset = 5;
            this.audio.playShoot();
        }

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.update(dt, this.arena);
            if (!p.active) this.projectiles.splice(i, 1);
        }

        // Enemies & Collisions
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = 2.0 / Math.sqrt(this.wave);
        }

        this.waveTimer += dt;
        if (this.waveTimer > 30) {
            this.waveTimer = 0;
            this.wave++;
            this.arena.shiftInterval = Math.max(2, 5 - this.wave * 0.2);
            this.updateHUD();
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt, this.player.x, this.player.y, this.arena);

            // Player vs Enemy
            const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
            if (dist < this.player.radius + e.radius) {
                this.player.health -= 10;
                e.active = false;
                this.audio.playHit();
                this.updateHUD();
            }

            // Proj vs Enemy
            for (let j = this.projectiles.length - 1; j >= 0; j--) {
                let p = this.projectiles[j];
                if (p.isPlayer) {
                    const pd = Math.hypot(p.x - e.x, p.y - e.y);
                    if (pd < p.radius + e.radius) {
                        e.health -= 10;
                        p.active = false;
                        if (e.health <= 0) {
                            this.score += 10 * this.wave;
                            this.audio.playExplosion();
                            this.updateHUD();
                        }
                    }
                }
            }

            if (!e.active) this.enemies.splice(i, 1);
        }

        // Damage if outside arena bounds
        if (this.player.x <= this.arena.x + this.player.radius + 1 ||
            this.player.x >= this.arena.x + this.arena.w - this.player.radius - 1 ||
            this.player.y <= this.arena.y + this.player.radius + 1 ||
            this.player.y >= this.arena.y + this.arena.h - this.player.radius - 1) {

            this.player.health -= 5 * dt;
            this.updateHUD();
        }

        if (this.player.health <= 0) {
            if (this.score > this.saveManager.data.highScore) {
                this.saveManager.data.highScore = this.score;
            }
            this.saveManager.data.totalGamesPlayed++;
            this.saveManager.data.totalScoreAccumulated += this.score;
            if (this.wave > this.saveManager.data.bestWave) {
                this.saveManager.data.bestWave = this.wave;
            }
            this.saveManager.save();
            this.setState('GAME_OVER');
        }
    }

    draw() {
        if (this.state !== 'TITLE' && this.worldBg) {
            this.worldBg.draw(this.ctx);
        } else {
            this.ctx.fillStyle = '#0f0f1a';
            this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
        }

        if (this.state === 'TITLE') return;

        this.ctx.save();
        // Camera follow player
        const camX = this.logicalWidth/2 - this.player.x;
        const camY = this.logicalHeight/2 - this.player.y;
        this.ctx.translate(camX, camY);

        this.arena.draw(this.ctx);

        if (this.hazards) {
            this.hazards.draw(this.ctx);
        }

        this.projectiles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);

        this.ctx.restore();
    }

    loop(now) {
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        requestAnimationFrame((t) => {
            this.lastTime = t;
            this.loop(t);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.start();
});
