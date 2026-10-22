// Clockwork Polarity Parry - Phase 1
// Core Engine & Systems

const SAVE_KEY = 'arcade_game_065_065-clockwork-polarity-parry_v1';
const ACCENT_COLOR = '#634a60';
const POLARITY_COLORS = {
    POSITIVE: '#d45d5d', // Red/Copper
    NEGATIVE: '#5d9ed4'  // Blue/Steel
};

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterMute: false,
                sfxVolume: 1.0,
                musicVolume: 1.0
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
                if (!this.data.options) this.data.options = { masterMute: false, sfxVolume: 1.0, musicVolume: 1.0 };
            }
        } catch (e) {
            console.warn('SaveManager: Failed to load data, using defaults.', e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('SaveManager: Failed to save data.', e);
        }
    }
}

class SoundEngine {
    constructor(saveManager) {
        this.saveManager = saveManager;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
    }
    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.connect(this.masterGain);

            this.updateVolumes();
            this.initialized = true;
        } catch (e) {
            console.warn('SoundEngine: AudioContext not supported.', e);
        }
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    updateVolumes() {
        if (!this.initialized) return;
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.masterMute ? 0 : 1;
        this.sfxGain.gain.value = opts.sfxVolume;
        this.musicGain.gain.value = opts.musicVolume;
    }
    playTone(freq, type, duration, vol = 0.5) {
        if (!this.initialized) return;
        this.resume();
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
    playParry() { this.playTone(800, 'square', 0.1, 0.3); }
    playHit() { this.playTone(200, 'sawtooth', 0.2, 0.4); }
    playSwitch() { this.playTone(600, 'sine', 0.1, 0.2); }
}

class InputManager {
    constructor(canvas, soundEngine) {
        this.canvas = canvas;
        this.soundEngine = soundEngine;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, rightDown: false, middleDown: false };
        this.touchActive = false;
        this.touches = [];
        this.actions = {
            up: false, down: false, left: false, right: false,
            parry: false, switchPolarity: false, back: false, dash: false
        };
        this.lastSwitchTime = 0;
        this.bindEvents();
    }
    bindEvents() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            this.soundEngine.init();
            this.soundEngine.resume();
            this.updateActions();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.updateActions();
        });

        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        this.canvas.addEventListener('mousedown', e => {
            if (e.button === 0) this.mouse.down = true;
            if (e.button === 1) this.mouse.middleDown = true;
            if (e.button === 2) this.mouse.rightDown = true;
            this.soundEngine.init();
            this.soundEngine.resume();
            this.updateActions();
        });
        this.canvas.addEventListener('mouseup', e => {
            if (e.button === 0) this.mouse.down = false;
        this.actions.dash = false;
            if (e.button === 2) this.mouse.rightDown = false;
            this.updateActions();
        });
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.touchActive = true;
            this.updateTouches(e);
            this.soundEngine.init();
            this.soundEngine.resume();
            this.handleDoubleTap(e);
            this.updateActions();
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouches(e);
            this.updateActions();
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.updateTouches(e);
            this.updateActions();
        }, { passive: false });
        this.canvas.addEventListener('touchcancel', e => {
            e.preventDefault();
            this.updateTouches(e);
            this.updateActions();
        }, { passive: false });
    }
    updateTouches(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.touches = Array.from(e.touches).map(t => ({
            x: t.clientX - rect.left,
            y: t.clientY - rect.top,
            id: t.identifier
        }));
    }
    handleDoubleTap(e) {
        const now = Date.now();
        if (now - this.lastSwitchTime < 300) {
            this.actions.switchPolarity = true;
            // Clear so it doesn't trigger multiple times in one frame, handled in updateActions
        }
        this.lastSwitchTime = now;
    }
    updateActions() {
        this.actions.up = this.keys['KeyW'] || this.keys['ArrowUp'];
        this.actions.down = this.keys['KeyS'] || this.keys['ArrowDown'];
        this.actions.left = this.keys['KeyA'] || this.keys['ArrowLeft'];
        this.actions.right = this.keys['KeyD'] || this.keys['ArrowRight'];

        this.actions.parry = this.keys['Space'] || this.mouse.down || this.touches.length > 0;
        this.actions.switchPolarity = this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.mouse.rightDown || this.actions.switchPolarity;

        this.actions.back = this.keys['Escape'];
        this.actions.dash = this.keys['KeyE'] || this.keys['KeyQ'] || this.mouse.middleDown || this.actions.dash;

        // Touch analog stick emulation
        if (this.touchActive && this.touches.length > 0) {
            // Left side for movement, right side for parry
            const leftTouches = this.touches.filter(t => t.x < this.canvas.width / 2);
            if (leftTouches.length > 0) {
                const lt = leftTouches[0];
                const cx = this.canvas.width / 4;
                const cy = this.canvas.height * 0.75;
                const dx = lt.x - cx;
                const dy = lt.y - cy;
                if (Math.abs(dx) > 20) this.actions.right = dx > 0, this.actions.left = dx < 0;
                if (Math.abs(dy) > 20) this.actions.down = dy > 0, this.actions.up = dy < 0;
            }
        }
    }
    resetActions() {
        this.actions.parry = false;
        this.actions.switchPolarity = false;
        this.actions.back = false;
        this.mouse.down = false;
        this.actions.dash = false;
        this.mouse.rightDown = false;
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 16;
        this.vx = 0;
        this.vy = 0;
        this.speed = 250;
        this.polarity = 'POSITIVE'; // POSITIVE or NEGATIVE

        this.parryActive = false;
        this.parryTimer = 0;
        this.parryDuration = 0.2;
        this.parryCooldown = 0;
        this.parryMaxCooldown = 0.4;

        this.slashAngle = 0;

        this.health = 3;
        this.invulnTimer = 0;

        this.dashActive = false;
        this.dashTimer = 0;
        this.dashDuration = 0.2;
        this.dashCooldown = 0;
        this.dashMaxCooldown = 1.0;
        this.dashSpeedMultiplier = 3.0;

        // Visuals
        this.particles = [];
        this.recoil = 0;
        this.thrustAnim = 0;
    }
    update(dt, input, width, height, soundEngine) {
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Movement
        let dx = 0, dy = 0;
        if (input.actions.up) dy -= 1;
        if (input.actions.down) dy += 1;
        if (input.actions.left) dx -= 1;
        if (input.actions.right) dx += 1;

        const len = Math.hypot(dx, dy);
        if (len > 0) {
            dx /= len;
            dy /= len;
        }

        // Dash Logic
        if (this.dashCooldown > 0) this.dashCooldown -= dt;

        if (input.actions.dash && this.dashCooldown <= 0 && (dx !== 0 || dy !== 0)) {
            this.dashActive = true;
            this.dashTimer = this.dashDuration;
            this.dashCooldown = this.dashMaxCooldown;
            soundEngine.playSwitch(); // Re-using sound
            input.actions.dash = false;
        }

        if (this.dashActive) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.dashActive = false;
            }
            this.vx = dx * this.speed * this.dashSpeedMultiplier;
            this.vy = dy * this.speed * this.dashSpeedMultiplier;

            // Invulnerability during dash
            this.invulnTimer = 0.1;
        } else {
            this.vx = dx * this.speed;
            this.vy = dy * this.speed;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Recoil logic
        if (this.recoil > 0) {
            this.x -= Math.cos(this.slashAngle) * this.recoil * dt * 500;
            this.y -= Math.sin(this.slashAngle) * this.recoil * dt * 500;
            this.recoil -= dt * 5;
        }

        // Thrust animation
        if (len > 0) {
            this.thrustAnim += dt * 10;
        } else {
            this.thrustAnim = 0;
        }

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
        if (this.dashActive) {
            if (Math.random() < 0.8) {
                this.particles.push({
                    x: this.x + (Math.random() - 0.5) * 10,
                    y: this.y + (Math.random() - 0.5) * 10,
                    vx: -this.vx * 0.3 + (Math.random() - 0.5) * 100,
                    vy: -this.vy * 0.3 + (Math.random() - 0.5) * 100,
                    life: 0.3 + Math.random() * 0.3,
                    color: this.polarity === 'POSITIVE' ? '#f44' : '#44f',
                    size: 2 + Math.random() * 3
                });
            }
            // Dash phantom trail
            if (Math.random() < 0.3) {
                this.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: 0,
                    vy: 0,
                    life: 0.2,
                    color: POLARITY_COLORS[this.polarity],
                    size: this.radius,
                    isPhantom: true
                });
            }
        }

        // Bounds
        this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(height - this.radius, this.y));

        // Polarity Switch
        if (input.actions.switchPolarity) {
            this.polarity = this.polarity === 'POSITIVE' ? 'NEGATIVE' : 'POSITIVE';
            soundEngine.playSwitch();
            input.actions.switchPolarity = false;
        }

        // Parry / Slash
        if (this.parryCooldown > 0) {
            this.parryCooldown -= dt;
        }

        if (this.parryActive) {
            this.parryTimer -= dt;
            if (this.parryTimer <= 0) {
                this.parryActive = false;
            }
        } else if (input.actions.parry && this.parryCooldown <= 0) {
            this.parryActive = true;
            this.parryTimer = this.parryDuration;
            this.parryCooldown = this.parryMaxCooldown;
            soundEngine.playParry();
            input.actions.parry = false;
            this.recoil = 0.5; // Recoil on parry/slash

            // Aim parry based on input/mouse
            if (input.touchActive && input.touches.length > 0) {
                const rt = input.touches.find(t => t.x >= width / 2);
                if (rt) {
                    this.slashAngle = Math.atan2(rt.y - this.y, rt.x - this.x);
                } else {
                    this.slashAngle = Math.atan2(input.touches[0].y - this.y, input.touches[0].x - this.x);
                }
            } else if (input.mouse.x !== 0 || input.mouse.y !== 0) {
                this.slashAngle = Math.atan2(input.mouse.y - this.y, input.mouse.x - this.x);
            } else if (dx !== 0 || dy !== 0) {
                this.slashAngle = Math.atan2(dy, dx);
            } else {
                this.slashAngle = 0; // Default right
            }
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 10) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Particles
        this.particles.forEach(p => {
            ctx.save();
            ctx.translate(p.x - this.x, p.y - this.y);

            if (p.isPhantom) {
                ctx.globalAlpha = p.life / 0.2 * 0.5;
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const angle = (i * Math.PI) / 3;
                    if (i === 0) ctx.moveTo(Math.cos(angle) * p.size, Math.sin(angle) * p.size);
                    else ctx.lineTo(Math.cos(angle) * p.size, Math.sin(angle) * p.size);
                }
                ctx.closePath();
                ctx.fillStyle = p.color;
                ctx.fill();
            } else {
                ctx.globalAlpha = p.life / 0.6;
                ctx.fillStyle = p.color || '#fff';
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            }
            ctx.restore();
        });

        // Procedural Vector Sprite
        ctx.rotate(this.slashAngle); // Rotate player body towards aim

        // Thruster
        if (this.thrustAnim > 0) {
            ctx.beginPath();
            const thrusterLength = 10 + Math.sin(this.thrustAnim) * 5;
            ctx.moveTo(-this.radius, -5);
            ctx.lineTo(-this.radius - thrusterLength, 0);
            ctx.lineTo(-this.radius, 5);
            ctx.fillStyle = '#f88';
            ctx.fill();
        }

        // Main Body (Hexagon/Gear shape)
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            if (i === 0) ctx.moveTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
            else ctx.lineTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
        }
        ctx.closePath();
        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // Eye / Aim Telegraph
        ctx.beginPath();
        ctx.arc(this.radius * 0.5, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Inner Core
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#111';
        ctx.fill();

        // Parry Arc
        if (this.parryActive) {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 2.5, -Math.PI/3, Math.PI/3);
            ctx.lineWidth = 4;
            ctx.strokeStyle = POLARITY_COLORS[this.polarity];
            ctx.stroke();

            // Inner glow
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 2, -Math.PI/3, Math.PI/3);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, polarity) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.speed = 100 + Math.random() * 50;
        this.polarity = polarity;
        this.active = true;
        this.type = 'GEAR'; // Simple homing enemy for Phase 1
    }
    update(dt, player) {
        if (!this.active) return;

        // Basic homing
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Gear shape
        ctx.beginPath();
        const teeth = 8;
        for (let i = 0; i < teeth * 2; i++) {
            const angle = (i * Math.PI) / teeth;
            const r = i % 2 === 0 ? this.radius : this.radius * 0.7;
            if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
            else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();

        ctx.fillStyle = POLARITY_COLORS[this.polarity];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.stroke();

        // Center hole
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();

        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.saveManager = new SaveManager();
        this.soundEngine = new SoundEngine(this.saveManager);
        this.inputManager = new InputManager(this.canvas, this.soundEngine);

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;

        this.width = 800;
        this.height = 600;
        this.scale = 1;

        this.player = null;
        this.enemies = [];
        this.environment = new Environment(this.width, this.height);
        this.score = 0;
        this.combo = 0;

        this.spawnTimer = 0;
        this.spawnRate = 2.0;

        this.initResize();
        requestAnimationFrame(this.loop.bind(this));
    }
    initResize() {
        const resize = () => {
            const ww = window.innerWidth;
            const wh = window.innerHeight;
            const aspect = this.width / this.height;
            if (ww / wh < aspect) {
                this.scale = ww / this.width;
            } else {
                this.scale = wh / this.height;
            }
            this.canvas.width = this.width * this.scale;
            this.canvas.height = this.height * this.scale;
            this.ctx.scale(this.scale, this.scale);
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(document.body);
        resize();

        // Auto pause on visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
    }
    startGame() {
        this.state = 'PLAYING';
        this.player = new Player(this.width / 2, this.height / 2);
        this.enemies = [];
        this.score = 0;
        this.combo = 0;
        this.spawnTimer = 0;
        this.spawnRate = 2.0;
    }
    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * this.width; y = -30; }
        else if (side === 1) { x = this.width + 30; y = Math.random() * this.height; }
        else if (side === 2) { x = Math.random() * this.width; y = this.height + 30; }
        else { x = -30; y = Math.random() * this.height; }

        const polarity = Math.random() > 0.5 ? 'POSITIVE' : 'NEGATIVE';

        const rand = Math.random();
        if (rand < 0.2) {
            this.enemies.push(new Swarmer(x, y, polarity));
        } else if (rand < 0.4) {
            this.enemies.push(new RangedSniper(x, y, polarity));
        } else if (rand < 0.6) {
            this.enemies.push(new ShieldedBruiser(x, y, polarity));
        } else if (rand < 0.8) {
            this.enemies.push(new Splitter(x, y, polarity, 1));
        } else if (rand < 0.9) {
            this.enemies.push(new AreaDenialHazard(x, y, polarity));
        } else {
            this.enemies.push(new Enemy(x, y, polarity));
        }
    }
    update(dt) {
        if (this.state === 'TITLE') {
            if (this.inputManager.actions.parry) {
                this.startGame();
                this.inputManager.actions.parry = false;
            }
            // Title screen back to arcade logic
            if (this.inputManager.mouse.down || (this.inputManager.touchActive && this.inputManager.touches.length > 0)) {
                let px = this.inputManager.mouse.x / this.scale;
                let py = this.inputManager.mouse.y / this.scale;
                if (this.inputManager.touchActive && this.inputManager.touches.length > 0) {
                     px = this.inputManager.touches[0].x / this.scale;
                     py = this.inputManager.touches[0].y / this.scale;
                }

                // Back button rect
                if (px > 20 && px < 160 && py > 20 && py < 50) {
                     window.location.href = '../../index.html';
                }
            }
            return;
        }
        if (this.state === 'PAUSED') {
            if (this.inputManager.actions.parry || this.inputManager.actions.back) {
                this.state = 'PLAYING';
                this.inputManager.resetActions();
            }

             // Pause screen back to arcade logic
            if (this.inputManager.mouse.down || (this.inputManager.touchActive && this.inputManager.touches.length > 0)) {
                let px = this.inputManager.mouse.x / this.scale;
                let py = this.inputManager.mouse.y / this.scale;
                if (this.inputManager.touchActive && this.inputManager.touches.length > 0) {
                     px = this.inputManager.touches[0].x / this.scale;
                     py = this.inputManager.touches[0].y / this.scale;
                }

                // Back button rect
                if (px > 20 && px < 160 && py > 20 && py < 50) {
                     window.location.href = '../../index.html';
                }
            }
            return;
        }
        if (this.state === 'GAME_OVER') {
            if (this.inputManager.actions.parry) {
                this.state = 'TITLE';
                this.inputManager.actions.parry = false;
            }
            return;
        }

        if (this.inputManager.actions.back) {
            this.state = 'PAUSED';
            this.inputManager.actions.back = false;
        }

        this.player.update(dt, this.inputManager, this.width, this.height, this.soundEngine);
        this.environment.update(dt, this.player, this.enemies, this.soundEngine);

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = this.spawnRate;
            this.spawnRate = Math.max(0.5, this.spawnRate - 0.05); // Ramp up difficulty
        }

        // Collisions
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.player, this.environment);

            // Check parry (tightened bounds for Phase 2)
            if (this.player.parryActive) {
                const dx = e.x - this.player.x;
                const dy = e.y - this.player.y;
                const dist = Math.hypot(dx, dy);

                if (dist < this.player.radius * 3) {
                    const angleToEnemy = Math.atan2(dy, dx);
                    // Normalize angles
                    let angleDiff = angleToEnemy - this.player.slashAngle;
                    while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                    if (Math.abs(angleDiff) < Math.PI/3) {
                        // Successful parry?
                        if (this.player.polarity === e.polarity) {
                            // Opposite polarity attracts/destroys (Wait, brief says "Switch polarities to parry... and repel")
                            // Let's say: Same polarity = Repel/Destroy (Magnetism logic)
                            // Opposite polarity = Absorbs/Damages
                            if (e.type === 'BRUISER' && e.shieldActive) {
                                e.shieldActive = false;
                                e.state = 'STUNNED';
                                e.chargeTimer = 2.0;
                                this.score += 50;
                                this.soundEngine.playHit();
                            } else {
                                e.active = false;
                                this.score += 100;
                                this.soundEngine.playHit();
                                if (e.type === 'SPLITTER' && e.size === 1) {
                                    // Spawn smaller splitters
                                    this.enemies.push(new Splitter(e.x - 10, e.y - 10, e.polarity, 0));
                                    this.enemies.push(new Splitter(e.x + 10, e.y + 10, e.polarity, 0));
                                }
                            }
                        } else {
                            // Parrying with wrong polarity - maybe bounces off but no score, or hurts?
                            // Let's just say it bounces off but stays active for now, or just destroys with no score.
                            // Better yet, Genre is Parry/Slash + Polarity.
                            // If same polarity -> Perfect Parry (destroy, score)
                            // If different -> Missed Parry (take damage)
                            if (this.player.invulnTimer <= 0) {
                                this.player.health--;
                                this.player.invulnTimer = 1.0;
                                this.soundEngine.playHit();
                            }
                        }
                    }
                }
            }

            // Check body collision
            if (e.active) {
                const dist = Math.hypot(this.player.x - e.x, this.player.y - e.y);
                // Area Denial Hazard logic
                if (e.type === 'HAZARD' && e.state !== 'IDLE') {
                    if (dist < this.player.radius + e.pulseRadius) {
                        if (this.player.invulnTimer <= 0) {
                            this.player.health--;
                            this.player.invulnTimer = 1.0;
                            this.soundEngine.playHit();
                        }
                    }
                }
                if (dist < this.player.radius + e.radius) {
                    if (this.player.invulnTimer <= 0) {
                        this.player.health--;
                        this.player.invulnTimer = 1.0;
                        this.soundEngine.playHit();
                        if (e.type !== 'BRUISER') {
                            e.active = false; // Destroy enemy on hit unless bruiser
                        }
                    }
                }
            }
        }

        this.enemies = this.enemies.filter(e => e.active);

        // Projectile collisions
        for (let p of this.environment.projectiles) {
            if (!p.active) continue;

            // check parry on projectiles
            if (this.player.parryActive) {
                const dx = p.x - this.player.x;
                const dy = p.y - this.player.y;
                const dist = Math.hypot(dx, dy);
                if (dist < this.player.radius * 3) {
                    const angleToProj = Math.atan2(dy, dx);
                    let angleDiff = angleToProj - this.player.slashAngle;
                    while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
                    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                    if (Math.abs(angleDiff) < Math.PI/3) {
                        p.active = false;
                        this.score += 25;
                        this.soundEngine.playHit();
                        continue;
                    }
                }
            }

            const dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
            if (dist < this.player.radius + p.radius) {
                if (this.player.invulnTimer <= 0) {
                    this.player.health--;
                    this.player.invulnTimer = 1.0;
                    this.soundEngine.playHit();
                    p.active = false;
                }
            }
        }

        if (this.player.health <= 0) {
            this.state = 'GAME_OVER';
            if (this.score > this.saveManager.data.highScore) {
                this.saveManager.data.highScore = this.score;
            }
            this.saveManager.data.totalGamesPlayed++;
            this.saveManager.data.totalScoreAccumulated += this.score;
            this.saveManager.save();
        }
    }
    draw() {
        // Clear
        this.ctx.fillStyle = '#2a2029'; // Base bg color
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.environment) {
            // Fake camera based on player pos
            let cx = this.player ? this.player.x - this.width/2 : 0;
            let cy = this.player ? this.player.y - this.height/2 : 0;
            this.environment.drawBackground(this.ctx, cx, cy);
        } else {
            // Grid background fallback
            this.ctx.strokeStyle = '#3a2e38';
            this.ctx.lineWidth = 1;
            for(let x=0; x<this.width; x+=40) {
                this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
            }
            for(let y=0; y<this.height; y+=40) {
                this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
            }
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = ACCENT_COLOR;
            this.ctx.font = '48px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Clockwork Polarity Parry', this.width/2, this.height/3);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px monospace';
            this.ctx.fillText('Press SPACE, CLICK, or TAP to Start', this.width/2, this.height/2);

            this.ctx.font = '16px monospace';
            this.ctx.fillText('WASD/Move | Space/L-Click/Tap to Parry | Shift/R-Click/Dbl-Tap to Switch Polarity | E/Q/M-Click to Dash', this.width/2, this.height/2 + 50);

            // Draw Back to Arcade button
            this.ctx.fillStyle = '#443';
            this.ctx.fillRect(20, 20, 140, 30);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('< Back to Arcade', 25, 40);
            return;
        }

        // Game render
        this.enemies.forEach(e => e.draw(this.ctx));
        if (this.player) this.player.draw(this.ctx);

        // HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Score: ' + this.score, 20, 30);

        this.ctx.textAlign = 'right';
        this.ctx.fillText('Health: ' + this.player.health, this.width - 20, 30);

        // Current Polarity Indicator UI
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = POLARITY_COLORS[this.player.polarity];
        this.ctx.font = '24px monospace';
        this.ctx.fillText('POLARITY: ' + this.player.polarity, this.width/2, 30);

        // Dash Cooldown HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '16px monospace';
        this.ctx.fillText('DASH', this.width/2, this.height - 40);

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.width/2 - 50, this.height - 30, 100, 10);

        if (this.player.dashCooldown <= 0) {
            this.ctx.fillStyle = '#0f0';
            this.ctx.fillRect(this.width/2 - 50, this.height - 30, 100, 10);
        } else {
            const fillWidth = (1 - (this.player.dashCooldown / this.player.dashMaxCooldown)) * 100;
            this.ctx.fillStyle = '#f88';
            this.ctx.fillRect(this.width/2 - 50, this.height - 30, fillWidth, 10);
        }

        if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '48px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width/2, this.height/2);

            // Draw Back to Arcade button
            this.ctx.fillStyle = '#443';
            this.ctx.fillRect(20, 20, 140, 30);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('< Back to Arcade', 25, 40);
        }

        if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '48px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width/2, this.height/2 - 40);

            this.ctx.font = '24px monospace';
            this.ctx.fillText('Final Score: ' + this.score, this.width/2, this.height/2 + 10);
            this.ctx.fillText('High Score: ' + this.saveManager.data.highScore, this.width/2, this.height/2 + 40);

            this.ctx.font = '16px monospace';
            this.ctx.fillText('Press SPACE/CLICK to Restart', this.width/2, this.height/2 + 90);
        }
    }
    loop(now) {
        requestAnimationFrame(this.loop.bind(this));
        let dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        if (dt > 0.1) dt = 0.1; // Cap dt
        if (Number.isNaN(dt)) dt = 0.016;

        this.update(dt);
        this.draw();
    }
}

window.onload = () => {
    window.game = new Game();
};
