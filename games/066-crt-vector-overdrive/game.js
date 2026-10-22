// game.js

// --- CONFIG & CONSTANTS ---
const GAME_ID = "066";
const GAME_SLUG = "066-crt-vector-overdrive";
const SAVE_KEY = `arcade_game_066_066-crt-vector-overdrive_v1`;

const COLORS = {
    bg: "#051005",
    grid: "#0a2a0a",
    text: "#faf7bd",
    player: "#00ffcc",
    playerHurt: "#ff0000",
    enemy: "#ff3366",
    projectile: "#faf7bd",
    overdrive: "#ffaa00",
    health: "#ff3333"
};

const CONSTANTS = {
    CANVAS_BASE_W: 800,
    CANVAS_BASE_H: 600,
    PLAYER_SPEED: 250,
    PLAYER_FIRE_RATE: 0.15, // seconds between shots
    OVERDRIVE_FIRE_RATE: 0.05,
    OVERDRIVE_COST: 10,
    OVERDRIVE_DURATION: 3.0,
    PROJECTILE_SPEED: 600,
    MAX_HEALTH: 100,
    GRID_SIZE: 50,
    ENEMY_SPAWN_RATE_BASE: 2.0,
    ENEMY_SPEED: 100,
    SCORE_PER_ENEMY: 100
};

// --- UTILS ---
const randomRange = (min, max) => Math.random() * (max - min) + min;
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const lerp = (a, b, t) => a + (b - a) * t;

// --- SUBSYSTEMS ---
class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterMute: false,
                sfxVol: 1,
                musicVol: 1
            }
        };
        this.load();
    }
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = { ...this.data, ...parsed };
                // Ensure options exists
                if (!this.data.options) {
                    this.data.options = { masterMute: false, sfxVol: 1, musicVol: 1 };
                }
            }
        } catch (e) {
            console.warn("Failed to load save", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Failed to write save", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.initialized = false;
    }
    init() {
        if (this.initialized) return;
        try {
            this.audioCtx = new this.ctx();
            this.masterGain = this.audioCtx.createGain();
            this.sfxGain = this.audioCtx.createGain();

            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.audioCtx.destination);

            this.masterGain.gain.value = 0.5;
            this.initialized = true;
        } catch (e) {
            console.warn("Audio setup failed", e);
        }
    }
    resume() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }
    playTone(freq, type, duration, vol=0.5) {
        if (!this.initialized || !this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }
    shoot() { this.playTone(400, 'square', 0.1, 0.2); }
    shootOverdrive() { this.playTone(800, 'sawtooth', 0.1, 0.3); }
    hit() { this.playTone(200, 'square', 0.2, 0.4); }
    explosion() { this.playTone(100, 'triangle', 0.4, 0.5); }
    overdriveStart() { this.playTone(600, 'sine', 0.5, 0.6); }
    hurt() { this.playTone(150, 'sawtooth', 0.3, 0.6); }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.pointers = new Map();

        // Virtual joysticks for touch
        this.joystickLeft = { active: false, id: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, vector: { x: 0, y: 0 } };
        this.joystickRight = { active: false, id: null, origin: { x: 0, y: 0 }, current: { x: 0, y: 0 }, vector: { x: 0, y: 0 } };
        this.overdriveTouch = false;

        this.bindEvents();
    }
    bindEvents() {
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        this.canvas.addEventListener('mousedown', e => {
            if(e.button === 0) this.mouse.down = true;
        });
        this.canvas.addEventListener('mouseup', e => {
            if(e.button === 0) this.mouse.down = false;
        });

        this.canvas.addEventListener('pointerdown', e => this.handlePointerDown(e));
        this.canvas.addEventListener('pointermove', e => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerup', e => this.handlePointerUp(e));
        this.canvas.addEventListener('pointercancel', e => this.handlePointerUp(e));
    }
    handlePointerDown(e) {
        this.pointers.set(e.pointerId, e);
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Touch overdrive button area (top center)
        if (y < rect.height * 0.2 && x > rect.width * 0.4 && x < rect.width * 0.6) {
            this.overdriveTouch = true;
            return;
        }

        if (x < rect.width / 2) {
            if (!this.joystickLeft.active) {
                this.joystickLeft.active = true;
                this.joystickLeft.id = e.pointerId;
                this.joystickLeft.origin = { x, y };
                this.joystickLeft.current = { x, y };
                this.joystickLeft.vector = { x: 0, y: 0 };
            }
        } else {
            if (!this.joystickRight.active) {
                this.joystickRight.active = true;
                this.joystickRight.id = e.pointerId;
                this.joystickRight.origin = { x, y };
                this.joystickRight.current = { x, y };
                this.joystickRight.vector = { x: 0, y: 0 };
            }
        }
    }
    handlePointerMove(e) {
        if (!this.pointers.has(e.pointerId)) return;
        this.pointers.set(e.pointerId, e);
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.joystickLeft.active && this.joystickLeft.id === e.pointerId) {
            this.joystickLeft.current = { x, y };
            this.updateJoystickVector(this.joystickLeft);
        } else if (this.joystickRight.active && this.joystickRight.id === e.pointerId) {
            this.joystickRight.current = { x, y };
            this.updateJoystickVector(this.joystickRight);
        }
    }
    handlePointerUp(e) {
        this.pointers.delete(e.pointerId);
        if (this.joystickLeft.id === e.pointerId) {
            this.joystickLeft.active = false;
            this.joystickLeft.vector = { x: 0, y: 0 };
        }
        if (this.joystickRight.id === e.pointerId) {
            this.joystickRight.active = false;
            this.joystickRight.vector = { x: 0, y: 0 };
        }
        this.overdriveTouch = false;
    }
    updateJoystickVector(joystick) {
        const dx = joystick.current.x - joystick.origin.x;
        const dy = joystick.current.y - joystick.origin.y;
        const dist = Math.hypot(dx, dy);
        const maxRadius = 50;
        if (dist > 0) {
            const clamped = Math.min(dist, maxRadius);
            joystick.vector = { x: (dx / dist) * (clamped / maxRadius), y: (dy / dist) * (clamped / maxRadius) };
        } else {
            joystick.vector = { x: 0, y: 0 };
        }
    }

    getMoveVector() {
        let vx = 0, vy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) vy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) vy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) vx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) vx += 1;

        if (vx !== 0 || vy !== 0) {
            const len = Math.hypot(vx, vy);
            return { x: vx / len, y: vy / len };
        }

        if (this.joystickLeft.active) {
            return this.joystickLeft.vector;
        }
        return { x: 0, y: 0 };
    }

    getAimVector(playerX, playerY, scaleX, scaleY) {
        let vx = 0, vy = 0;
        // Keyboard arrow aim (if not using WASD for movement, or secondary keys)
        // Usually, twin stick is WASD move + Mouse aim or arrows aim
        if (this.keys['ArrowUp']) vy -= 1;
        if (this.keys['ArrowDown']) vy += 1;
        if (this.keys['ArrowLeft']) vx -= 1;
        if (this.keys['ArrowRight']) vx += 1;

        if (vx !== 0 || vy !== 0) {
            const len = Math.hypot(vx, vy);
            return { x: vx / len, y: vy / len };
        }

        if (this.joystickRight.active) {
            return this.joystickRight.vector;
        }

        if (this.mouse.down) {
            // Mouse aim relative to player
            const dx = this.mouse.x / scaleX - playerX;
            const dy = this.mouse.y / scaleY - playerY;
            const len = Math.hypot(dx, dy);
            if (len > 0) {
                return { x: dx / len, y: dy / len };
            }
        }

        return null; // Not aiming
    }

    isOverdrivePressed() {
        return this.keys['Space'] || this.overdriveTouch;
    }

    isActionPressed() {
        return this.keys['Space'] || this.keys['Enter'] || this.mouse.down || this.pointers.size > 0;
    }
}

// --- ENTITIES ---
class Player {
    constructor(game) {
        this.game = game;
        this.x = CONSTANTS.CANVAS_BASE_W / 2;
        this.y = CONSTANTS.CANVAS_BASE_H / 2;
        this.radius = 15;
        this.health = CONSTANTS.MAX_HEALTH;
        this.fireTimer = 0;

        this.inOverdrive = false;
        this.overdriveTimer = 0;
        this.vx = 0;
        this.vy = 0;
        this.invulnTimer = 0;
    }
    update(dt) {
        // Movement
        const move = this.game.input.getMoveVector();
        this.vx = move.x * CONSTANTS.PLAYER_SPEED;
        this.vy = move.y * CONSTANTS.PLAYER_SPEED;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Constrain to bounds
        this.x = Math.max(this.radius, Math.min(CONSTANTS.CANVAS_BASE_W - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(CONSTANTS.CANVAS_BASE_H - this.radius, this.y));

        // Overdrive mechanic
        if (this.game.input.isOverdrivePressed() && !this.inOverdrive && this.health > CONSTANTS.OVERDRIVE_COST) {
            this.health -= CONSTANTS.OVERDRIVE_COST;
            this.inOverdrive = true;
            this.overdriveTimer = CONSTANTS.OVERDRIVE_DURATION;
            this.game.sound.overdriveStart();
            this.game.spawnParticles(this.x, this.y, COLORS.overdrive, 20);
        }

        if (this.inOverdrive) {
            this.overdriveTimer -= dt;
            if (this.overdriveTimer <= 0) {
                this.inOverdrive = false;
            }
        }

        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Aiming & Shooting
        this.fireTimer -= dt;
        const aim = this.game.input.getAimVector(this.x, this.y, this.game.scaleX, this.game.scaleY);

        if (aim) {
            const currentFireRate = this.inOverdrive ? CONSTANTS.OVERDRIVE_FIRE_RATE : CONSTANTS.PLAYER_FIRE_RATE;
            if (this.fireTimer <= 0) {
                this.fireTimer = currentFireRate;

                if (this.inOverdrive) {
                    // Spread shot
                    const angle = Math.atan2(aim.y, aim.x);
                    const spread = 0.2;
                    for(let i = -1; i <= 1; i++) {
                        const a = angle + i * spread;
                        this.game.projectiles.push(new Projectile(this.x, this.y, Math.cos(a), Math.sin(a), true));
                    }
                    this.game.sound.shootOverdrive();
                } else {
                    // Single shot
                    this.game.projectiles.push(new Projectile(this.x, this.y, aim.x, aim.y, false));
                    this.game.sound.shoot();
                }
            }
        }
    }
    takeDamage(amount) {
        if (this.invulnTimer > 0) return;
        this.health -= amount;
        this.invulnTimer = 0.5;
        this.game.sound.hurt();
        this.game.spawnParticles(this.x, this.y, COLORS.playerHurt, 15);
        if (this.health <= 0) {
            this.health = 0;
            this.game.gameOver();
        }
    }
    draw(ctx) {
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) return; // blink

        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.strokeStyle = this.inOverdrive ? COLORS.overdrive : COLORS.player;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Draw ship vector shape
        const aim = this.game.input.getAimVector(this.x, this.y, this.game.scaleX, this.game.scaleY);
        let angle = aim ? Math.atan2(aim.y, aim.x) : Math.atan2(this.vy, this.vx);
        if (aim === null && this.vx === 0 && this.vy === 0) angle = -Math.PI / 2;

        ctx.rotate(angle);

        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.stroke();

        if (this.inOverdrive) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS.overdrive;
            ctx.stroke();
            // aura
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 1.5, 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.overdrive + "66";
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, vx, vy, isOverdrive) {
        this.x = x;
        this.y = y;
        this.vx = vx * CONSTANTS.PROJECTILE_SPEED;
        this.vy = vy * CONSTANTS.PROJECTILE_SPEED;
        this.isOverdrive = isOverdrive;
        this.radius = isOverdrive ? 4 : 2;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < 0 || this.x > CONSTANTS.CANVAS_BASE_W || this.y < 0 || this.y > CONSTANTS.CANVAS_BASE_H) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.isOverdrive ? COLORS.overdrive : COLORS.projectile;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 5;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy {
    constructor(game) {
        this.game = game;
        // Spawn outside bounds
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { this.x = Math.random() * CONSTANTS.CANVAS_BASE_W; this.y = -20; }
        else if (side === 1) { this.x = CONSTANTS.CANVAS_BASE_W + 20; this.y = Math.random() * CONSTANTS.CANVAS_BASE_H; }
        else if (side === 2) { this.x = Math.random() * CONSTANTS.CANVAS_BASE_W; this.y = CONSTANTS.CANVAS_BASE_H + 20; }
        else { this.x = -20; this.y = Math.random() * CONSTANTS.CANVAS_BASE_H; }

        this.radius = 12;
        this.hp = 1; // Basic one hit
        this.active = true;
        this.speed = CONSTANTS.ENEMY_SPEED * randomRange(0.8, 1.2);
    }
    update(dt) {
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        // Collision with player
        if (dist < this.radius + this.game.player.radius) {
            this.game.player.takeDamage(10);
            this.takeDamage(1); // Die on impact
        }
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            this.game.score += CONSTANTS.SCORE_PER_ENEMY;
            this.game.sound.explosion();
            this.game.spawnParticles(this.x, this.y, COLORS.enemy, 10);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const angle = Math.atan2(dy, dx);
        ctx.rotate(angle);

        ctx.strokeStyle = COLORS.enemy;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Diamond shape
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.lineTo(0, -this.radius);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = randomRange(50, 150);
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = randomRange(0.2, 0.6);
        this.maxLife = this.life;
        this.radius = randomRange(1, 3);
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}


// --- MAIN GAME ---
class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.scaleX = 1;
        this.scaleY = 1;

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;
        this.reqId = null;

        this.input = new InputManager(this.canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.player = null;
        this.projectiles = [];
        this.enemies = [];
        this.particles = [];

        this.score = 0;
        this.wave = 1;
        this.enemySpawnTimer = 0;

        this.setupResizeObserver();
        this.bindEvents();
    }

    setupResizeObserver() {
        const resize = () => {
            const container = this.canvas.parentElement;
            const w = container.clientWidth;
            const h = container.clientHeight;

            this.canvas.width = w;
            this.canvas.height = h;

            // Maintain aspect ratio scaling
            const scale = Math.min(w / CONSTANTS.CANVAS_BASE_W, h / CONSTANTS.CANVAS_BASE_H);
            this.scaleX = w / CONSTANTS.CANVAS_BASE_W; // if stretch
            this.scaleY = h / CONSTANTS.CANVAS_BASE_H; // if stretch

            // We'll just stretch for responsive simplicity
            this.ctx.scale(this.scaleX, this.scaleY);
        };

        const ro = new ResizeObserver(resize);
        ro.observe(this.canvas.parentElement);
        resize(); // initial
    }

    bindEvents() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
    }

    start() {
        this.lastTime = performance.now();
        this.reqId = requestAnimationFrame(t => this.loop(t));
    }

    resetGame() {
        this.player = new Player(this);
        this.projectiles = [];
        this.enemies = [];
        this.particles = [];
        this.score = 0;
        this.wave = 1;
        this.enemySpawnTimer = 0;
    }

    spawnParticles(x, y, color, count) {
        for(let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.data.totalScoreAccumulated += this.score;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        if (this.wave > this.saveManager.data.bestWaveOrCombo) {
            this.saveManager.data.bestWaveOrCombo = this.wave;
        }
        this.saveManager.save();
    }

    loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.update(dt);
        this.draw();

        this.reqId = requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (this.state === 'TITLE' || this.state === 'GAME_OVER' || this.state === 'PAUSED') {
            if (this.input.isActionPressed()) {
                // simple debounce hack
                if (!this.wasActionPressed) {
                    this.sound.init();
                    this.sound.resume();
                    if (this.state === 'TITLE' || this.state === 'GAME_OVER') {
                        this.resetGame();
                        this.state = 'PLAYING';
                    } else if (this.state === 'PAUSED') {
                        this.state = 'PLAYING';
                    }
                }
                this.wasActionPressed = true;
            } else {
                this.wasActionPressed = false;
            }
            return;
        }

        if (this.state !== 'PLAYING') return;

        if (this.input.keys['Escape'] || this.input.keys['KeyP']) {
            if (!this.wasEscapePressed) {
                this.state = 'PAUSED';
            }
            this.wasEscapePressed = true;
        } else {
            this.wasEscapePressed = false;
        }

        // Gameplay update
        this.player.update(dt);

        this.projectiles.forEach(p => p.update(dt));
        this.projectiles = this.projectiles.filter(p => p.active);

        this.enemies.forEach(e => e.update(dt));
        this.enemies = this.enemies.filter(e => e.active);

        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.active);

        // Collisions: Projectile vs Enemy
        for(let p of this.projectiles) {
            for(let e of this.enemies) {
                if (p.active && e.active) {
                    if (distance(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
                        p.active = false;
                        e.takeDamage(1);
                        this.sound.hit();
                    }
                }
            }
        }

        // Enemy spawner
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
            this.enemies.push(new Enemy(this));
            // ramp up difficulty slightly
            const rate = Math.max(0.5, CONSTANTS.ENEMY_SPAWN_RATE_BASE - (this.score / 5000));
            this.enemySpawnTimer = rate;

            // Health regen over time naturally very slow to encourage overdrive use but keep player alive
            if (Math.random() < 0.2 && this.player.health < CONSTANTS.MAX_HEALTH) {
                this.player.health += 2;
                if (this.player.health > CONSTANTS.MAX_HEALTH) this.player.health = CONSTANTS.MAX_HEALTH;
            }
        }
    }

    drawGrid(ctx) {
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= CONSTANTS.CANVAS_BASE_W; x += CONSTANTS.GRID_SIZE) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONSTANTS.CANVAS_BASE_H);
        }
        for (let y = 0; y <= CONSTANTS.CANVAS_BASE_H; y += CONSTANTS.GRID_SIZE) {
            ctx.moveTo(0, y);
            ctx.lineTo(CONSTANTS.CANVAS_BASE_W, y);
        }
        ctx.stroke();
    }

    drawHUD(ctx) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SCORE: ${this.score}`, 20, 30);
        ctx.fillText(`HI: ${this.saveManager.data.highScore}`, 20, 60);

        // Health bar
        const maxW = 200;
        const hW = (this.player.health / CONSTANTS.MAX_HEALTH) * maxW;
        ctx.fillStyle = COLORS.health;
        ctx.fillRect(20, 80, hW, 15);
        ctx.strokeStyle = COLORS.text;
        ctx.strokeRect(20, 80, maxW, 15);

        // Overdrive UI
        if (this.player.inOverdrive) {
            ctx.fillStyle = COLORS.overdrive;
            ctx.fillText(`OVERDRIVE ACTIVE!`, 20, 120);
        } else if (this.player.health > CONSTANTS.OVERDRIVE_COST) {
            ctx.fillStyle = COLORS.text;
            ctx.fillText(`[SPACE] TO OVERDRIVE`, 20, 120);
        }
    }

    draw() {
        // We assume context is scaled by resize observer
        this.ctx.fillStyle = COLORS.bg;
        this.ctx.fillRect(0, 0, CONSTANTS.CANVAS_BASE_W, CONSTANTS.CANVAS_BASE_H);

        this.drawGrid(this.ctx);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = COLORS.text;
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText(this.saveManager.data.options.title || "CRT VECTOR OVERDRIVE", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/3);
            this.ctx.font = '20px monospace';
            this.ctx.fillText("Click or Press SPACE to Start", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/2);
            this.ctx.font = '14px monospace';
            this.ctx.fillText("WASD/Arrows: Move | Mouse/Arrows: Aim & Shoot", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/1.5);
            this.ctx.fillText("SPACE: Sacrifice Health for Overdrive Power", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/1.5 + 20);

            // Draw a fake player for visual
            this.ctx.save();
            this.ctx.translate(CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/1.2);
            this.ctx.strokeStyle = COLORS.player;
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(-15, 12);
            this.ctx.lineTo(-7.5, 0);
            this.ctx.lineTo(-15, -12);
            this.ctx.closePath();
            this.ctx.stroke();
            this.ctx.restore();
            return;
        }

        this.particles.forEach(p => p.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));

        if (this.player) {
            this.player.draw(this.ctx);
            this.drawHUD(this.ctx);
        }

        if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, CONSTANTS.CANVAS_BASE_W, CONSTANTS.CANVAS_BASE_H);
            this.ctx.fillStyle = COLORS.text;
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText("PAUSED", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/2);
            this.ctx.font = '20px monospace';
            this.ctx.fillText("Click or Press SPACE to Resume", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/1.8);
            this.ctx.fillText("Back to Arcade", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H - 50); // Need click logic to go back to arcade but text must be present according to specs
        }

        if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, CONSTANTS.CANVAS_BASE_W, CONSTANTS.CANVAS_BASE_H);
            this.ctx.fillStyle = COLORS.text;
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText("GAME OVER", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/2.5);
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`SCORE: ${this.score}`, CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/2);
            this.ctx.fillText("Click or Press SPACE to Restart", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H/1.5);
            this.ctx.fillText("Back to Arcade", CONSTANTS.CANVAS_BASE_W/2, CONSTANTS.CANVAS_BASE_H - 50);
        }
    }
}

// Ensure Back to Arcade can be clicked
window.addEventListener('click', (e) => {
    if (window.game && (window.game.state === 'PAUSED' || window.game.state === 'GAME_OVER' || window.game.state === 'TITLE')) {
        const rect = window.game.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Simple bounding box for the Back to Arcade text area at the bottom
        if (y > rect.height - 80) {
            window.location.href = '../../index.html';
        }
    }
});

// Boot
window.onload = () => {
    const canvas = document.getElementById('game-canvas');
    window.game = new Game(canvas);
    window.game.start();
};
