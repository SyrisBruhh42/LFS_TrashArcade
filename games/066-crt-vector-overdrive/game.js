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
    DASH_SPEED: 800,
    DASH_DURATION: 0.2,
    DASH_COOLDOWN: 1.5,
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
    dash() { this.playTone(500, 'triangle', 0.2, 0.4); }
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
        this.dashTouch = false;
        this.dashTouch = false;

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
        if (y < rect.height * 0.2 && x > rect.width * 0.2 && x < rect.width * 0.4) {
            this.dashTouch = true;
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
    isDashPressed() {
        return this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.dashTouch;
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
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.dashVector = {x: 0, y: 0};
        this.afterimages = [];
        this.recoilOffset = {x: 0, y: 0};
        this.thrustAnim = 0;
    }
    update(dt) {
        // Movement
        const move = this.game.input.getMoveVector();

        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;

        if (this.game.input.isDashPressed() && this.dashCooldownTimer <= 0 && this.dashTimer <= 0 && (move.x !== 0 || move.y !== 0)) {
            this.dashTimer = CONSTANTS.DASH_DURATION;
            this.dashCooldownTimer = CONSTANTS.DASH_COOLDOWN;
            this.dashVector = {x: move.x, y: move.y};
            this.game.sound.dash && this.game.sound.dash();
        }

        if (this.dashTimer > 0) {
            this.dashTimer -= dt;
            this.vx = this.dashVector.x * CONSTANTS.DASH_SPEED;
            this.vy = this.dashVector.y * CONSTANTS.DASH_SPEED;
            // spawn afterimage
            if (Math.random() < 0.5) {
                const aim = this.game.input.getAimVector(this.x, this.y, this.game.scaleX, this.game.scaleY);
                let angle = aim ? Math.atan2(aim.y, aim.x) : Math.atan2(this.vy, this.vx);
                this.afterimages.push(new Afterimage(this.x, this.y, angle, this.radius, 0.3, this.inOverdrive ? COLORS.overdrive : COLORS.player));
            }
        } else {
            // Apply tight momentum tuning
            const targetVx = move.x * CONSTANTS.PLAYER_SPEED;
            const targetVy = move.y * CONSTANTS.PLAYER_SPEED;
            this.vx += (targetVx - this.vx) * 15 * dt;
            this.vy += (targetVy - this.vy) * 15 * dt;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // recoil decay
        this.recoilOffset.x *= 0.8;
        this.recoilOffset.y *= 0.8;
        this.thrustAnim += dt * 10;

        this.afterimages.forEach(a => a.update(dt));
        this.afterimages = this.afterimages.filter(a => a.life > 0);


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

                // apply recoil
                this.recoilOffset.x = -aim.x * 5;
                this.recoilOffset.y = -aim.y * 5;
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


        this.afterimages.forEach(a => a.draw(ctx));

        ctx.save();
        ctx.translate(this.x + this.recoilOffset.x, this.y + this.recoilOffset.y);

        ctx.strokeStyle = this.inOverdrive ? COLORS.overdrive : COLORS.player;
        ctx.lineWidth = 2;

        const aim = this.game.input.getAimVector(this.x, this.y, this.game.scaleX, this.game.scaleY);
        let angle = aim ? Math.atan2(aim.y, aim.x) : Math.atan2(this.vy, this.vx);
        if (aim === null && this.vx === 0 && this.vy === 0) angle = -Math.PI / 2;

        ctx.rotate(angle);

        // Core ship body
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.stroke();

        // Aim telegraph
        if (aim) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(this.radius + 30, 0);
            ctx.stroke();
        }

        // Thrust flame
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 50 && this.dashTimer <= 0) {
            const flicker = Math.sin(this.thrustAnim) * 5;
            ctx.beginPath();
            ctx.strokeStyle = '#ff8800';
            ctx.moveTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius * 1.5 - flicker, 0);
            ctx.stroke();
        }
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
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { this.x = Math.random() * CONSTANTS.CANVAS_BASE_W; this.y = -20; }
        else if (side === 1) { this.x = CONSTANTS.CANVAS_BASE_W + 20; this.y = Math.random() * CONSTANTS.CANVAS_BASE_H; }
        else if (side === 2) { this.x = Math.random() * CONSTANTS.CANVAS_BASE_W; this.y = CONSTANTS.CANVAS_BASE_H + 20; }
        else { this.x = -20; this.y = Math.random() * CONSTANTS.CANVAS_BASE_H; }

        this.radius = 12;
        this.hp = 1;
        this.active = true;
        this.speed = CONSTANTS.ENEMY_SPEED * randomRange(0.8, 1.2);
        this.color = COLORS.enemy;
    }
    update(dt) {
        if (!this.game.player) return;
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }

        if (dist < this.radius + this.game.player.radius) {
            this.game.player.takeDamage(10);
            this.takeDamage(1);
        }
    }
    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            this.game.score += CONSTANTS.SCORE_PER_ENEMY;
            this.game.sound.explosion();
            this.game.spawnParticles(this.x, this.y, this.color, 10);
        }
    }
    draw(ctx) {
        if (!this.game.player) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        ctx.rotate(Math.atan2(dy, dx));
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.lineTo(0, -this.radius);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

class Swarmer extends Enemy {
    constructor(game) {
        super(game);
        this.radius = 8;
        this.hp = 1;
        this.speed = CONSTANTS.ENEMY_SPEED * 1.5;
        this.color = '#ff3366';
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(dt) {
        if (!this.game.player) return;
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.hypot(dx, dy);

        this.wobble += dt * 10;

        if (dist > 0) {
            const angle = Math.atan2(dy, dx) + Math.sin(this.wobble) * 0.5;
            this.x += Math.cos(angle) * this.speed * dt;
            this.y += Math.sin(angle) * this.speed * dt;
        }

        if (dist < this.radius + this.game.player.radius) {
            this.game.player.takeDamage(10);
            this.takeDamage(1);
        }
    }
    draw(ctx) {
        if (!this.game.player) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x));
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}

class Sniper extends Enemy {
    constructor(game) {
        super(game);
        this.radius = 14;
        this.hp = 2;
        this.speed = CONSTANTS.ENEMY_SPEED * 0.6;
        this.color = '#33ccff';
        this.chargeTimer = 0;
        this.chargeTime = 2.5; // seconds to charge
        this.telegraphing = false;
    }
    update(dt) {
        if (!this.game.player) return;
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Try to maintain a distance of 250
        const targetDist = 250;
        if (Math.abs(dist - targetDist) > 10) {
            const moveSpeed = dist > targetDist ? this.speed : -this.speed;
            this.x += (dx / dist) * moveSpeed * dt;
            this.y += (dy / dist) * moveSpeed * dt;
        }

        // Shooting logic
        this.chargeTimer += dt;
        if (this.chargeTimer > this.chargeTime - 1.0) {
            this.telegraphing = true;
        }
        if (this.chargeTimer >= this.chargeTime) {
            this.chargeTimer = 0;
            this.telegraphing = false;
            const px = dx / dist;
            const py = dy / dist;
            // enemy projectile! wait, Projectile is usually player's. Let's make an EnemyProjectile class or reuse Projectile with a flag.
            // In original code: this.projectiles are player projectiles. Let's add enemy projectiles.
            this.game.enemyProjectiles.push(new EnemyProjectile(this.x, this.y, px, py));
            this.game.sound.hit(); // reuse sound
        }

        if (dist < this.radius + this.game.player.radius) {
            this.game.player.takeDamage(15);
            this.takeDamage(2);
        }
    }
    draw(ctx) {
        if (!this.game.player) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x));

        // Telegraph
        if (this.telegraphing) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(800, 0); // long laser sight
            ctx.strokeStyle = 'rgba(51, 204, 255, ' + (Math.sin(this.chargeTimer * 20) * 0.5 + 0.5) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(this.radius + 6, 0);
        ctx.stroke();
        ctx.restore();
    }
}

class Bruiser extends Enemy {
    constructor(game) {
        super(game);
        this.radius = 20;
        this.hp = 8;
        this.speed = CONSTANTS.ENEMY_SPEED * 0.4;
        this.color = '#ff9900';
        this.shieldHp = 5;
    }
    takeDamage(amount) {
        if (this.shieldHp > 0) {
            this.shieldHp -= amount;
            this.game.sound.hit();
            this.game.spawnParticles(this.x, this.y, '#ffffff', 5);
            return;
        }
        super.takeDamage(amount);
    }
    draw(ctx) {
        if (!this.game.player) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        ctx.rotate(Math.atan2(dy, dx));

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        // Hexagon
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            if (i === 0) ctx.moveTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
            else ctx.lineTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
        }
        ctx.closePath();
        ctx.stroke();

        // Shield
        if (this.shieldHp > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.3 + (this.shieldHp / 5) * 0.7) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Spawner extends Enemy {
    constructor(game) {
        super(game);
        this.radius = 16;
        this.hp = 4;
        this.speed = CONSTANTS.ENEMY_SPEED * 0.5;
        this.color = '#cc33ff';
        this.spawnTimer = 0;
        this.spawnInterval = 4.0; // seconds
        this.moveAngle = Math.random() * Math.PI * 2;
    }
    update(dt) {
        if (!this.game.player) return;

        // Move erratically/circularly
        this.moveAngle += dt * 0.5;
        this.x += Math.cos(this.moveAngle) * this.speed * dt;
        this.y += Math.sin(this.moveAngle) * this.speed * dt;

        // Keep inside bounds roughly
        if (this.x < 50) { this.x = 50; this.moveAngle = 0; }
        if (this.x > CONSTANTS.CANVAS_BASE_W - 50) { this.x = CONSTANTS.CANVAS_BASE_W - 50; this.moveAngle = Math.PI; }
        if (this.y < 50) { this.y = 50; this.moveAngle = Math.PI/2; }
        if (this.y > CONSTANTS.CANVAS_BASE_H - 50) { this.y = CONSTANTS.CANVAS_BASE_H - 50; this.moveAngle = -Math.PI/2; }

        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            // Spawn 2 swarmers
            for (let i = 0; i < 2; i++) {
                let s = new Swarmer(this.game);
                s.x = this.x + (Math.random() - 0.5) * 20;
                s.y = this.y + (Math.random() - 0.5) * 20;
                this.game.enemies.push(s);
            }
            this.game.spawnParticles(this.x, this.y, this.color, 15);
        }

        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        if (Math.hypot(dx, dy) < this.radius + this.game.player.radius) {
            this.game.player.takeDamage(10);
            this.takeDamage(1);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.moveAngle);

        // Visual telegraph for spawn
        const progress = this.spawnTimer / this.spawnInterval;
        ctx.fillStyle = `rgba(204, 51, 255, ${progress * 0.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * progress, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.moveTo(-this.radius, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.moveTo(this.radius, -this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.stroke();
        ctx.restore();
    }
}

class HazardEnemy extends Enemy {
    constructor(game) {
        super(game);
        this.radius = 12;
        this.hp = 3;
        this.speed = CONSTANTS.ENEMY_SPEED * 0.9;
        this.color = '#33ff33'; // green
        this.dropTimer = 0;
    }
    update(dt) {
        if (!this.game.player) return;
        const dx = this.game.player.x - this.x;
        const dy = this.game.player.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Move away if too close, else move randomly/around
        if (dist < 150) {
            this.x -= (dx / dist) * this.speed * dt;
            this.y -= (dy / dist) * this.speed * dt;
        } else {
            this.x += Math.sin(this.game.score/1000 + this.y*0.01) * this.speed * dt;
            this.y += Math.cos(this.game.score/1000 + this.x*0.01) * this.speed * dt;
        }

        // Keep inside bounds roughly
        if (this.x < 50) this.x = 50;
        if (this.x > CONSTANTS.CANVAS_BASE_W - 50) this.x = CONSTANTS.CANVAS_BASE_W - 50;
        if (this.y < 50) this.y = 50;
        if (this.y > CONSTANTS.CANVAS_BASE_H - 50) this.y = CONSTANTS.CANVAS_BASE_H - 50;

        this.dropTimer += dt;
        if (this.dropTimer > 1.5) {
            this.dropTimer = 0;
            this.game.hazards.push(new DamageZone(this.x, this.y, 25, 4.0));
        }

        if (dist < this.radius + this.game.player.radius) {
            this.game.player.takeDamage(10);
            this.takeDamage(1);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.game.score / 100);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Star shape or cross
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(this.radius, 0);
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // Telegraph for drop
        ctx.fillStyle = `rgba(51, 255, 51, ${this.dropTimer / 1.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class DamageZone {
    constructor(x, y, radius, lifeTime) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.lifeTime = lifeTime;
        this.maxLife = lifeTime;
        this.active = true;
    }
    update(dt, game) {
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) {
            this.active = false;
        }
        if (game.player && this.active) {
            const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (dist < this.radius + game.player.radius) {
                game.player.takeDamage(20 * dt); // continuous damage
            }
        }
    }
    draw(ctx) {
        if (!this.active) return;
        const alpha = (this.lifeTime / this.maxLife) * 0.5;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = `rgba(51, 255, 51, ${alpha})`;
        ctx.strokeStyle = '#33ff33';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // inner ring
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * (1 - (this.lifeTime % 1)), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class EnemyProjectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx * CONSTANTS.PROJECTILE_SPEED * 0.6;
        this.vy = vy * CONSTANTS.PROJECTILE_SPEED * 0.6;
        this.radius = 4;
        this.active = true;
    }
    update(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.x < -50 || this.x > CONSTANTS.CANVAS_BASE_W + 50 || this.y < -50 || this.y > CONSTANTS.CANVAS_BASE_H + 50) {
            this.active = false;
        }
        if (game.player && this.active) {
            const dist = Math.hypot(game.player.x - this.x, game.player.y - this.y);
            if (dist < this.radius + game.player.radius) {
                game.player.takeDamage(10);
                this.active = false;
                game.spawnParticles(this.x, this.y, '#33ccff', 10);
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = '#33ccff';
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#33ccff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}


class Afterimage {
    constructor(x, y, angle, radius, life, color) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.radius = radius;
        this.life = life;
        this.maxLife = life;
        this.color = color;
    }
    update(dt) {
        this.life -= dt;
    }
    draw(ctx) {
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
}


class VectorGrid {
    constructor(game) {
        this.game = game;
        this.spacing = CONSTANTS.GRID_SIZE;
        this.offset = {x: 0, y: 0};
        this.pulseAnim = 0;
    }
    update(dt) {
        this.pulseAnim += dt * 2;
    }
    draw(ctx, dx, dy) {
        ctx.save();
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;

        // Dynamic grid pulse based on player movement and overdrive
        const isOverdrive = this.game.player && this.game.player.inOverdrive;
        if (isOverdrive) {
            ctx.strokeStyle = 'rgba(255, 170, 0, 0.2)';
            ctx.lineWidth = 2 + Math.sin(this.pulseAnim) * 1;
        }

        const offsetX = -(dx * 0.2) % this.spacing;
        const offsetY = -(dy * 0.2) % this.spacing;

        ctx.beginPath();
        for (let x = offsetX; x < CONSTANTS.CANVAS_BASE_W; x += this.spacing) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONSTANTS.CANVAS_BASE_H);
        }
        for (let y = offsetY; y < CONSTANTS.CANVAS_BASE_H; y += this.spacing) {
            ctx.moveTo(0, y);
            ctx.lineTo(CONSTANTS.CANVAS_BASE_W, y);
        }
        ctx.stroke();
        ctx.restore();
    }
}


// --- PHASE 3: ENVIRONMENT SUBSYSTEM ---
class ParallaxLayer {
    constructor(game, speed, color, count, zIndex) {
        this.game = game;
        this.speed = speed;
        this.color = color;
        this.zIndex = zIndex;
        this.shapes = [];
        for(let i=0; i<count; i++) {
            this.shapes.push({
                x: randomRange(0, CONSTANTS.CANVAS_BASE_W),
                y: randomRange(0, CONSTANTS.CANVAS_BASE_H),
                size: randomRange(10, 40) / zIndex,
                rot: randomRange(0, Math.PI * 2),
                type: Math.floor(randomRange(0, 3)) // 0: square, 1: triangle, 2: hex
            });
        }
    }
    update(dt) {
        // move slowly, affected slightly by player movement context
        let dx = 0;
        let dy = 0;
        if (this.game.player) {
            dx = this.game.player.vx * dt * this.speed;
            dy = this.game.player.vy * dt * this.speed;
        } else {
            dx = this.speed * 10 * dt;
            dy = this.speed * 5 * dt;
        }

        this.shapes.forEach(s => {
            s.x -= dx;
            s.y -= dy;
            s.rot += dt * 0.5 * this.speed;
            if (s.x < -50) s.x = CONSTANTS.CANVAS_BASE_W + 50;
            if (s.x > CONSTANTS.CANVAS_BASE_W + 50) s.x = -50;
            if (s.y < -50) s.y = CONSTANTS.CANVAS_BASE_H + 50;
            if (s.y > CONSTANTS.CANVAS_BASE_H + 50) s.y = -50;
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1;
        this.shapes.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot);
            ctx.beginPath();
            if (s.type === 0) {
                ctx.rect(-s.size/2, -s.size/2, s.size, s.size);
            } else if (s.type === 1) {
                ctx.moveTo(0, -s.size/2);
                ctx.lineTo(s.size/2, s.size/2);
                ctx.lineTo(-s.size/2, s.size/2);
                ctx.closePath();
            } else {
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const px = Math.cos(angle) * s.size;
                    const py = Math.sin(angle) * s.size;
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
            }
            ctx.stroke();
            ctx.restore();
        });
        ctx.restore();
    }
}

class EnvironmentManager {
    constructor(game) {
        this.game = game;
        this.layers = [
            new ParallaxLayer(game, 0.05, 'rgba(0, 255, 204, 0.1)', 15, 3),
            new ParallaxLayer(game, 0.1, 'rgba(255, 51, 102, 0.15)', 20, 2),
            new ParallaxLayer(game, 0.2, 'rgba(250, 247, 189, 0.2)', 25, 1)
        ];
        this.hazards = [];
        this.initHazards();
    }
    initHazards() {
        this.hazards = [];
        // Destructible Cover
        for (let i = 0; i < 5; i++) {
            this.hazards.push(new DestructibleCover(
                randomRange(100, CONSTANTS.CANVAS_BASE_W - 100),
                randomRange(100, CONSTANTS.CANVAS_BASE_H - 100)
            ));
        }
        // Gravity Zones
        this.hazards.push(new GravityZone(
            CONSTANTS.CANVAS_BASE_W / 2,
            CONSTANTS.CANVAS_BASE_H / 2,
            150,
            500 // pull strength
        ));
        // Shifting Geometry (Laser fence)
        this.hazards.push(new LaserFence(
            150, 100, 150, CONSTANTS.CANVAS_BASE_H - 100
        ));
        this.hazards.push(new LaserFence(
            CONSTANTS.CANVAS_BASE_W - 150, 100, CONSTANTS.CANVAS_BASE_W - 150, CONSTANTS.CANVAS_BASE_H - 100
        ));
    }
    update(dt) {
        this.layers.forEach(l => l.update(dt));
        this.hazards.forEach(h => h.update(dt, this.game));
        this.hazards = this.hazards.filter(h => h.active);
    }
    drawBackground(ctx) {
        this.layers.forEach(l => l.draw(ctx));
    }
    drawForeground(ctx) {
        this.hazards.forEach(h => h.draw(ctx));
    }
}

class DestructibleCover {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 60;
        this.hp = 10;
        this.active = true;
    }
    update(dt, game) {
        // block player and enemies
        const checkCollision = (entity) => {
            if (entity.x > this.x && entity.x < this.x + this.width &&
                entity.y > this.y && entity.y < this.y + this.height) {
                // push out
                const cx = this.x + this.width/2;
                const cy = this.y + this.height/2;
                const dx = entity.x - cx;
                const dy = entity.y - cy;
                if (Math.abs(dx) > Math.abs(dy)) {
                    entity.x = dx > 0 ? this.x + this.width + entity.radius : this.x - entity.radius;
                } else {
                    entity.y = dy > 0 ? this.y + this.height + entity.radius : this.y - entity.radius;
                }
            }
        };
        if (game.player) checkCollision(game.player);
        game.enemies.forEach(e => checkCollision(e));

        // absorb projectiles
        game.projectiles.forEach(p => {
            if (p.active && p.x > this.x && p.x < this.x + this.width && p.y > this.y && p.y < this.y + this.height) {
                p.active = false;
                this.hp -= p.isOverdrive ? 3 : 1;
                game.spawnParticles(p.x, p.y, COLORS.text, 3);
            }
        });

        if (this.hp <= 0) {
            this.active = false;
            game.sound.explosion();
            game.spawnParticles(this.x + this.width/2, this.y + this.height/2, COLORS.text, 20);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = COLORS.text;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // draw crack lines based on hp
        ctx.beginPath();
        if (this.hp < 8) { ctx.moveTo(this.x, this.y); ctx.lineTo(this.x + 20, this.y + 30); }
        if (this.hp < 5) { ctx.moveTo(this.x + this.width, this.y); ctx.lineTo(this.x + 30, this.y + 40); }
        if (this.hp < 3) { ctx.moveTo(this.x + this.width/2, this.y + this.height); ctx.lineTo(this.x + 10, this.y + 10); }
        ctx.stroke();
        ctx.restore();
    }
}

class GravityZone {
    constructor(x, y, radius, force) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.force = force;
        this.active = true;
        this.angle = 0;
    }
    update(dt, game) {
        this.angle += dt;
        const applyGravity = (entity) => {
            const dx = this.x - entity.x;
            const dy = this.y - entity.y;
            const dist = Math.hypot(dx, dy);
            if (dist < this.radius && dist > 10) {
                const pull = (this.force * (1 - dist / this.radius)) * dt;
                entity.x += (dx / dist) * pull;
                entity.y += (dy / dist) * pull;
            }
        };
        if (game.player) applyGravity(game.player);
        game.enemies.forEach(e => applyGravity(e));
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class LaserFence {
    constructor(x1, y1, x2, y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.active = true;
        this.timer = 0;
        this.isOn = true;
    }
    update(dt, game) {
        this.timer += dt;
        if (this.timer > 3) {
            this.isOn = !this.isOn;
            this.timer = 0;
        }
        if (!this.isOn) return;

        const checkLineCollision = (entity) => {
            // Distance from point to line segment
            const l2 = Math.pow(this.x1 - this.x2, 2) + Math.pow(this.y1 - this.y2, 2);
            if (l2 === 0) return distance(entity.x, entity.y, this.x1, this.y1) < entity.radius;
            let t = ((entity.x - this.x1) * (this.x2 - this.x1) + (entity.y - this.y1) * (this.y2 - this.y1)) / l2;
            t = Math.max(0, Math.min(1, t));
            const projX = this.x1 + t * (this.x2 - this.x1);
            const projY = this.y1 + t * (this.y2 - this.y1);
            if (distance(entity.x, entity.y, projX, projY) < entity.radius + 5) {
                return true;
            }
            return false;
        };

        if (game.player && checkLineCollision(game.player)) {
            game.player.takeDamage(20 * dt); // continuous damage
        }
        game.enemies.forEach(e => {
            if (checkLineCollision(e)) {
                e.takeDamage(10 * dt);
            }
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.strokeStyle = COLORS.enemy;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);

        if (this.isOn) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLORS.enemy;
            ctx.stroke();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        } else {
            ctx.strokeStyle = 'rgba(255, 51, 102, 0.2)';
            ctx.stroke();
        }

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
        this.enemyProjectiles = [];
        this.hazards = [];
        this.particles = [];
        this.vectorGrid = new VectorGrid(this);
        this.envManager = new EnvironmentManager(this);

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
        this.enemyProjectiles = [];
        this.hazards = [];
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

        this.enemyProjectiles.forEach(p => p.update(dt, this));
        this.enemyProjectiles = this.enemyProjectiles.filter(p => p.active);

        this.hazards.forEach(h => h.update(dt, this));
        this.hazards = this.hazards.filter(h => h.active);

        this.particles.forEach(p => p.update(dt));
        this.vectorGrid.update(dt);
        this.envManager.update(dt);
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
            const r = Math.random();
            let newEnemy;
            if (r < 0.3) newEnemy = new Swarmer(this);
            else if (r < 0.5) newEnemy = new Sniper(this);
            else if (r < 0.7) newEnemy = new Bruiser(this);
            else if (r < 0.85) newEnemy = new Spawner(this);
            else if (r < 0.95) newEnemy = new HazardEnemy(this);
            else newEnemy = new Enemy(this);
            this.enemies.push(newEnemy);
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
        ctx.fillText(`DASH: ${Math.max(0, this.player.dashCooldownTimer).toFixed(1)}s`, 20, 150);
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

        if (this.player) { this.vectorGrid.draw(this.ctx, this.player.x, this.player.y); } else { this.drawGrid(this.ctx); }
        if (this.envManager) { this.envManager.drawBackground(this.ctx); }

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
        this.hazards.forEach(h => h.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.enemyProjectiles.forEach(p => p.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        if (this.envManager) { this.envManager.drawForeground(this.ctx); }

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
