
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
            options: { soundVol: 1, musicVol: 1, screenShake: 1 }
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
        } catch(e) { console.warn("Save load failed", e); }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch(e) { console.warn("Save failed", e); }
    }
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
        const dashBtn = document.getElementById('touch-dash-btn');

        if (leftZone && rightZone) {
            leftZone.addEventListener('touchstart', e => this.handleTouchStart(e, 'left'), {passive: false});
            leftZone.addEventListener('touchmove', e => this.handleTouchMove(e, 'left'), {passive: false});
            leftZone.addEventListener('touchend', e => this.handleTouchEnd(e, 'left'), {passive: false});
            leftZone.addEventListener('touchcancel', e => this.handleTouchEnd(e, 'left'), {passive: false});

            rightZone.addEventListener('touchstart', e => this.handleTouchStart(e, 'right'), {passive: false});
            rightZone.addEventListener('touchmove', e => this.handleTouchMove(e, 'right'), {passive: false});
            rightZone.addEventListener('touchend', e => this.handleTouchEnd(e, 'right'), {passive: false});
            rightZone.addEventListener('touchcancel', e => this.handleTouchEnd(e, 'right'), {passive: false});

            if(dashBtn) {
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
    constructor(x, y, dx, dy, isPlayer, damage = 10, pierce = 0, radiusBonus = 0) {
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speed = 400;
        this.radius = 4 + radiusBonus;
        this.isPlayer = isPlayer;
        this.color = isPlayer ? '#fff' : '#e94560';
        this.active = true;
        this.damage = damage;
        this.pierceCount = pierce;
        this.hitEnemies = new Set();
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
        this.speed = 100;
        this.color = '#e94560';
        this.health = 20;
        this.active = true;
    }

    update(dt, playerX, playerY, arena, engine) {
        this.move(dt, playerX, playerY);

        if (this.x < arena.x || this.x > arena.x + arena.w || this.y < arena.y || this.y > arena.y + arena.h) {
            this.health -= 10 * dt;
        }

        if (this.health <= 0 && this.active) {
            this.active = false;
            if (this.onDeath) this.onDeath(engine);
        }
    }

    move(dt, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }

    onDeath(engine) {}

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Swarmer extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 8;
        this.speed = 150 + Math.random() * 50;
        this.color = '#ff9f43';
        this.health = 10;
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

class RangedSniper extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 12;
        this.speed = 50 + Math.random() * 20;
        this.color = '#10ac84';
        this.health = 20;
        this.fireTimer = 2;
        this.telegraphTimer = 0;
    }

    move(dt, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 300) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else if (dist < 200) {
            this.x -= (dx / dist) * this.speed * dt;
            this.y -= (dy / dist) * this.speed * dt;
        }
    }

    update(dt, playerX, playerY, arena, engine) {
        super.update(dt, playerX, playerY, arena, engine);
        this.fireTimer -= dt;
        if (this.fireTimer <= 0.5 && this.telegraphTimer <= 0) {
             this.telegraphTimer = 0.5;
        }
        if (this.telegraphTimer > 0) {
             this.telegraphTimer -= dt;
        }

        if (this.fireTimer <= 0) {
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                // start projectile slightly offset so it doesn't spawn inside
                let px = this.x + (dx/dist)*this.radius*1.5;
                let py = this.y + (dy/dist)*this.radius*1.5;
                engine.projectiles.push(new Projectile(px, py, dx/dist, dy/dist, false));
                engine.audio.playShoot();
            }
            this.fireTimer = 2 + Math.random();
            this.telegraphTimer = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;

        if (this.telegraphTimer > 0) {
             ctx.strokeStyle = 'red';
             ctx.lineWidth = 2;
             ctx.beginPath();
             ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2);
             ctx.stroke();
        }

        ctx.fillRect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-this.radius/2, -this.radius/2, this.radius, this.radius);
        ctx.restore();
    }
}

class ShieldedBruiser extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 18;
        this.speed = 40 + Math.random() * 20;
        this.color = '#2e86de';
        this.health = 80;
        this.chargeTimer = 3;
        this.isCharging = false;
    }

    update(dt, playerX, playerY, arena, engine) {
        super.update(dt, playerX, playerY, arena, engine);
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 1.0) {
            this.speed = 10; // slow down before charge
        }
        if (this.chargeTimer <= 0) {
            this.isCharging = true;
            this.speed = 200; // rush
            this.chargeTimer = 4;
        }
        if (this.isCharging && this.chargeTimer < 3.5) {
            this.isCharging = false;
            this.speed = 40 + Math.random() * 20;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.chargeTimer <= 1.0 ? '#ff4757' : this.color;
        ctx.beginPath();
        // Hexagon
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = this.isCharging ? 4 : 2;
        ctx.stroke();
        ctx.restore();
    }
}

class Splitter extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 14;
        this.speed = 80 + Math.random() * 30;
        this.color = '#9b59b6';
        this.health = 30;
    }

    onDeath(engine) {
        engine.enemies.push(new Splitterling(this.x - 10, this.y - 10));
        engine.enemies.push(new Splitterling(this.x + 10, this.y + 10));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-5, -5, 3, 0, Math.PI*2);
        ctx.arc(5, 5, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
}

class Splitterling extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 7;
        this.speed = 180 + Math.random() * 40;
        this.color = '#8e44ad';
        this.health = 10;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class EnemyHazard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 30;
        this.duration = 5;
    }
    update(dt, playerX, playerY, engine) {
        this.duration -= dt;
        const dist = Math.hypot(this.x - playerX, this.y - playerY);
        if (dist < this.radius + engine.player.radius) {
            engine.player.health -= 5 * dt;
            engine.updateHUD();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.duration);
        ctx.fillStyle = 'rgba(211, 84, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#d35400';
        ctx.stroke();
        ctx.restore();
    }
}

class HazardSpawner extends Enemy {
    constructor(x, y) {
        super(x, y);
        this.radius = 15;
        this.speed = 90 + Math.random() * 20;
        this.color = '#feca57';
        this.health = 40;
        this.dropTimer = 3;
        this.telegraphTimer = 0;
    }

    update(dt, playerX, playerY, arena, engine) {
        super.update(dt, playerX, playerY, arena, engine);
        this.dropTimer -= dt;
        if (this.dropTimer <= 1.0 && this.telegraphTimer <= 0) {
             this.telegraphTimer = 1.0;
        }
        if (this.telegraphTimer > 0) {
             this.telegraphTimer -= dt;
        }

        if (this.dropTimer <= 0) {
            // Drop a hazard zone
            if (!engine.enemyHazards) engine.enemyHazards = [];
            engine.enemyHazards.push(new EnemyHazard(this.x, this.y));
            this.dropTimer = 3 + Math.random() * 2;
            this.telegraphTimer = 0;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        if (this.telegraphTimer > 0) {
             // flash white
             if (Math.floor(Date.now() / 100) % 2 === 0) ctx.fillStyle = '#fff';
        }
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#d35400';
        ctx.lineWidth = 2;
        ctx.stroke();
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

        this.comboManager = new ComboManager(this);
        this.upgradeManager = new UpgradeManager(this);
        this.pickupManager = new PickupManager(this);
        this.vfx = new VFXManager(this);


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
        // UI event bindings are mostly handled by ui.js now
        // Bind hover and click to .btn
        document.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => { if (this.audio.playUIHover) this.audio.playUIHover(); });
            btn.addEventListener('click', () => { if (this.audio.playUIClick) this.audio.playUIClick(); });
        });

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
        const upg = document.getElementById('upgrade-screen');
        if (upg) upg.classList.add('hidden');

        if (newState === 'TITLE') {
            document.getElementById('title-screen').classList.remove('hidden');
        } else if (newState === 'PLAYING') {
            document.getElementById('hud-screen').classList.remove('hidden');
                } else if (newState === 'PAUSED') {
            document.getElementById('pause-screen').classList.remove('hidden');
        } else if (newState === 'UPGRADING') {
            document.getElementById('upgrade-screen').classList.remove('hidden');
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
        this.enemyHazards = [];
        this.updateHUD();
    }


    continueNextWave() {
        this.wave++;
        this.arena.shiftInterval = Math.max(2, 5 - this.wave * 0.2);
        this.updateHUD();
        this.setState('PLAYING');
    }

    spawnEnemy() {
        if (this.audio.playEnemySpawn) this.audio.playEnemySpawn();

        // Spawn outside arena bounds
        const angle = Math.random() * Math.PI * 2;
        const r = Math.max(this.arena.w, this.arena.h) * 0.8;
        const ex = this.arena.x + this.arena.w/2 + Math.cos(angle) * r;
        const ey = this.arena.y + this.arena.h/2 + Math.sin(angle) * r;
        const types = [Swarmer, RangedSniper, ShieldedBruiser, Splitter, HazardSpawner];
        const EnemyClass = types[Math.floor(Math.random() * types.length)];
        this.enemies.push(new EnemyClass(ex, ey));
    }

    updateComboHUD() {
        const comboFill = document.getElementById('combo-bar-fill');
        const comboMult = document.getElementById('combo-multiplier');
        if (comboFill && comboMult && this.comboManager) {
            comboMult.innerText = `${this.comboManager.multiplier.toFixed(1)}x`;
            const comboPercent = (this.comboManager.timer / this.comboManager.maxTime) * 100;
            comboFill.style.width = `${Math.max(0, comboPercent)}%`;
        }
    }

    updateHUD() {
        document.getElementById('hud-score').innerText = `Score: ${this.score}`;
        document.getElementById('hud-wave').innerText = `Wave: ${this.wave}`;

        this.updateComboHUD();

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
        if (this.state === 'UPGRADING') return;
        if (this.state !== 'PLAYING') return;

        this.vfx.update(dt);
        if (this.vfx.hitStopTimer > 0) return;

        // Ensure dt is capped
        if (dt > 0.1) dt = 0.1;

        if (this.audio.setMusicState) {
            this.audio.setMusicState(this.isBossWave, this.player.health <= this.player.maxHealth * 0.3);
        }

        const moveVec = this.input.getMovementVector();
        const aimVec = this.input.getAimVector(this.logicalWidth/2, this.logicalHeight/2);

        let wasDashing = this.player.isDashing;

        this.player.update(dt, moveVec, aimVec, this.arena);
        if (!wasDashing && this.player.isDashing) {
            if (this.audio.playDash) this.audio.playDash();
        }
        if (this.player.isDashing) {
            this.vfx.spawnTrail(this.player.x, this.player.y, this.player.radius * 2, this.player.radius * 2, this.player.color, 0.2, 'circle');
        }
        this.arena.update(dt);
        this.worldBg.update(dt);
        this.hazards.update(dt, this.arena, this.player, this.enemies, this.projectiles, this.audio);
        if (this.comboManager) this.comboManager.update(dt);
        if (this.pickupManager) this.pickupManager.update(dt, this.player);
        this.updateComboHUD();
        if (this.enemyHazards) {
            for (let i = this.enemyHazards.length - 1; i >= 0; i--) {
                this.enemyHazards[i].update(dt, this.player.x, this.player.y, this);
                if (this.enemyHazards[i].duration <= 0) {
                    this.enemyHazards.splice(i, 1);
                }
            }
        }


        if (aimVec.firing && this.player.fireCooldown <= 0) {
            const baseDmg = 10 + this.player.bonusDamage;
            const pPierce = this.player.pierceCount;
            const pRad = this.player.bulletScale;

            // Base projectile
            this.projectiles.push(new Projectile(this.player.x, this.player.y, aimVec.x, aimVec.y, true, baseDmg, pPierce, pRad));

            // Multishot
            if (this.player.multishot > 0) {
                const spread = 0.15;
                let angle = Math.atan2(aimVec.y, aimVec.x);
                for (let i = 1; i <= this.player.multishot; i++) {
                    const offset = spread * Math.ceil(i/2) * (i % 2 === 0 ? -1 : 1);
                    const nx = Math.cos(angle + offset);
                    const ny = Math.sin(angle + offset);
                    this.projectiles.push(new Projectile(this.player.x, this.player.y, nx, ny, true, baseDmg, pPierce, pRad));
                }
            }

            this.player.fireCooldown = this.player.fireRate;
            this.player.recoilOffset = 5;
            this.audio.playShoot();
        }

        // Projectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            let p = this.projectiles[i];
            p.update(dt, this.arena);
            if (!p.isPlayer && p.active) {
                const dist = Math.hypot(p.x - this.player.x, p.y - this.player.y);
                if (dist < p.radius + this.player.radius) {
                    this.player.health -= 10;
                    p.active = false;
                    this.audio.playHit();
                    this.vfx.emitParticles(this.player.x, this.player.y, 15, '#ff0000', 150, p.vx, p.vy);
                    this.vfx.triggerScreenShake(0.2, 8);
                    this.vfx.triggerHitStop(0.05);
                    this.updateHUD();
                }
            }
            if (!p.active) this.projectiles.splice(i, 1);
        }

        // Enemies & Collisions
        if (this.isBossWave) {
            if (!this.currentBoss || !this.currentBoss.active) {
                this.vfx.triggerHitStop(0.5);
                this.vfx.triggerScreenShake(1.0, 20);
                this.vfx.emitParticles(this.currentBoss.x || this.logicalWidth/2, this.currentBoss.y || this.logicalHeight/2, 100, '#ffffff', 300);
                // Boss defeated
                this.isBossWave = false;
                this.waveTimer = 0;
                this.upgradeManager.showUpgrades();

                // Clear enemies/projectiles on boss kill
                this.enemies = [];
                this.projectiles = [];
                this.hazards.covers = [];
                this.hazards.traps = [];
            }
        } else {
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                this.spawnTimer = 2.0 / Math.sqrt(this.wave);
            }

            this.waveTimer += dt;
            if (this.waveTimer > 30) {
                this.waveTimer = 0;

                if ((this.wave + 1) % 5 === 0) {
                    this.isBossWave = true;
                    this.bossBannerTimer = 3.0; // 3 seconds banner

                    // Spawn boss
                    const cx = this.arena.x + this.arena.w / 2;
                    const cy = this.arena.y + this.arena.h / 2;
                    if (Math.random() > 0.5) {
                        this.currentBoss = new TitanBoss(cx, cy);
                    } else {
                        this.currentBoss = new PhantomBoss(cx, cy);
                    }
                    if (this.audio.playBossSpawn) this.audio.playBossSpawn();
                    this.enemies.push(this.currentBoss);
                } else {
                    this.upgradeManager.showUpgrades();
                }
            }
        }

        if (this.bossBannerTimer > 0) {
            this.bossBannerTimer -= dt;
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt, this.player.x, this.player.y, this.arena, this);

            // Player vs Enemy
            const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
            if (dist < this.player.radius + e.radius) {
                this.player.health -= 10;
                e.active = false;
                this.audio.playHit();
                this.vfx.emitParticles(this.player.x, this.player.y, 20, '#ff0000', 120);
                this.vfx.triggerScreenShake(0.25, 10);
                this.vfx.triggerHitStop(0.08);
                this.updateHUD();
            }

            // Proj vs Enemy
            for (let j = this.projectiles.length - 1; j >= 0; j--) {
                let p = this.projectiles[j];
                if (p.isPlayer) {
                    const pd = Math.hypot(p.x - e.x, p.y - e.y);
                    if (pd < p.radius + e.radius && p.active && !p.hitEnemies.has(e)) {
                        e.health -= p.damage || 10;
                        if (e.isBoss) {
                            if (this.audio.playBossHit) this.audio.playBossHit();
                        }
                        p.hitEnemies.add(e);
                        const dmg = p.damage || 10;
                        this.vfx.emitParticles(e.x, e.y, 8, e.color || '#ff8800', 100, p.vx, p.vy, Math.PI / 4);
                        this.vfx.spawnFloatingText(e.x, e.y - 20, Math.floor(dmg), '#ffdd00');
                        this.vfx.triggerScreenShake(0.05, 2, p.vx, p.vy);

                        if (p.pierceCount > 0) {
                            p.pierceCount--;
                        } else {
                            p.active = false;
                        }

                        if (e.health <= 0) {
                            if (e.onDeath) e.onDeath(this);
                            this.comboManager.addScore(10 * this.wave);
                            this.pickupManager.spawn(e.x, e.y);
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
            if (this.state !== 'GAME_OVER' && this.audio.playPlayerDeath) {
                this.audio.playPlayerDeath();
            }

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
        this.vfx.applyShake(this.ctx);

        this.arena.draw(this.ctx);

        if (this.hazards) {
            this.hazards.draw(this.ctx);
        }
        if (this.enemyHazards) {
            this.enemyHazards.forEach(h => h.draw(this.ctx));
        }

        if (this.pickupManager) {
            this.pickupManager.draw(this.ctx, 0.016);
        }

        this.projectiles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);

        this.vfx.draw(this.ctx);
        this.ctx.restore();

        // Draw Boss UI on top of everything (untransformed)
        if (this.isBossWave && this.currentBoss && this.currentBoss.active) {
            // Boss Banner
            if (this.bossBannerTimer > 0) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
                this.ctx.fillRect(0, this.logicalHeight / 2 - 50, this.logicalWidth, 100);
                this.ctx.fillStyle = 'white';
                this.ctx.font = '40px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`WARNING: ${this.currentBoss.name} APPROACHES!`, this.logicalWidth / 2, this.logicalHeight / 2 + 15);
            }

            // Boss Health Bar
            const hpPercent = Math.max(0, this.currentBoss.health / this.currentBoss.maxHealth);
            const barW = 600;
            const barH = 20;
            const barX = (this.logicalWidth - barW) / 2;
            const barY = 40;

            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

            this.ctx.fillStyle = this.currentBoss.phase === 1 ? '#ff4500' : '#8b0000';
            this.ctx.fillRect(barX, barY, barW * hpPercent, barH);

            this.ctx.fillStyle = 'white';
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.currentBoss.name, this.logicalWidth / 2, barY + 15);
        }
    }

    loop(now) {
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        this.update(dt);
        this.draw();

        this._rafId = requestAnimationFrame((t) => this.loop(t));
    }

    start() {
        requestAnimationFrame((t) => {
            this.lastTime = t;
            this.loop(t);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.engine = new GameEngine(); const engine = window.engine;
    engine.start();
});
