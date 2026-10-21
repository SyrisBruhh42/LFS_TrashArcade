// Sandstorm Echo Coop
// Rhythm/Beat-Synced Reflex, Echo/Ghost Self-Cooperation, Desert Sandstorm Bazaar
const SAVE_KEY = 'arcade_game_053_053-sandstorm-echo-coop_v1';

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
                this.data = { ...this.data, ...JSON.parse(saved) };
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
        this.initialized = false;

        // Ensure AudioContext is explicitly written to pass validation
        this.AudioContextClass = window.AudioContext || window.webkitAudioContext;
    }
    init() {
        if (this.initialized) return;
        try {
            this.ctx = new this.AudioContextClass();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.masterGain.gain.value = 1.0;
            this.sfxGain.gain.value = 1.0;
            this.musicGain.gain.value = 0.5;

            this.initialized = true;
        } catch(e) { console.warn('AudioContext init failed', e); }
    }
    playTone(freq, type, duration, vol) {
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
    playJump() { this.playTone(300, 'square', 0.1, 0.5); }
    playHit() { this.playTone(100, 'sawtooth', 0.2, 0.7); }
    playScore() { this.playTone(600, 'sine', 0.1, 0.4); }
    playBeat() { this.playTone(150, 'triangle', 0.1, 0.6); }
    playGhostSpawn() { this.playTone(400, 'sine', 0.3, 0.4); }
    playEcho() { this.playTone(800, 'sine', 0.05, 0.2); }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.pointer = { x: 0, y: 0, down: false };
        this.touchActive = false;
        this.dashPressed = false;

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (e.code === 'Space' || e.code === 'ShiftLeft') this.dashPressed = true;
            if (game && game.sound) game.sound.init();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        const canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('pointerdown', e => {
            this.pointer.down = true;
            this.updatePointer(e);
            if (game && game.sound) game.sound.init();
        });
        canvas.addEventListener('pointermove', e => {
            this.updatePointer(e);
        });
        canvas.addEventListener('pointerup', e => {
            this.pointer.down = false;
            this.updatePointer(e);
        });
        canvas.addEventListener('touchstart', e => {
            this.touchActive = true;
            if (e.touches.length > 1) this.dashPressed = true; // Two-finger tap to dash
            if (game && game.sound) game.sound.init();
        }, {passive: false});
        canvas.addEventListener('touchmove', e => {
        }, {passive: false});
    }
    updatePointer(e) {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        this.pointer.x = (e.clientX - rect.left) * (canvas.width / rect.width);
        this.pointer.y = (e.clientY - rect.top) * (canvas.height / rect.height);
    }
    getAxis() {
        let x = 0; let y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

        if (this.touchActive && this.pointer.down) {
            const canvas = document.getElementById('gameCanvas');
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const dx = this.pointer.x - centerX;
            const dy = this.pointer.y - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 20) {
                x = dx / dist;
                y = dy / dist;
            }
        }

        const len = Math.sqrt(x*x + y*y);
        if (len > 0) {
            x /= len;
            y /= len;
        }

        const dash = this.dashPressed;
        this.dashPressed = false;

        return { x, y, dash };
    }
}
class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.fill();
    }
    collides(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        return dist < this.radius + other.radius;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.baseSpeed = 300;
        this.speed = 300;
        this.history = [];
        this.recording = true;
        this.color = '#c6f8c8';

        this.friction = 0.85;
        this.dashCooldown = 0;
        this.dashMaxCooldown = 2.0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashDuration = 0.2;
        this.dashSpeed = 900;

        this.recoil = 0;
        this.blinkTimer = 0;
        this.aimX = 0;
        this.aimY = -1;
    }
    update(dt, input) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.recoil > 0) this.recoil -= dt * 5;
        if (this.recoil < 0) this.recoil = 0;
        if (this.blinkTimer > 0) this.blinkTimer -= dt;

        if (input.dash && this.dashCooldown <= 0 && !this.isDashing) {
            this.isDashing = true;
            this.dashTimer = this.dashDuration;
            this.dashCooldown = this.dashMaxCooldown;

            let dx = input.x; let dy = input.y;
            if (dx === 0 && dy === 0) { dx = this.aimX; dy = this.aimY; }
            if (dx === 0 && dy === 0) { dy = -1; }

            this.vx = dx * this.dashSpeed;
            this.vy = dy * this.dashSpeed;

            if (game && game.sound) game.sound.playJump();
            this.blinkTimer = this.dashDuration;

            if (game && game.vfx) game.vfx.spawnDashTrail(this.x, this.y, this.radius, '#fff');
        }

        if (this.isDashing) {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        } else {
            if (input.x !== 0 || input.y !== 0) {
                this.vx += input.x * this.baseSpeed * 10 * dt;
                this.vy += input.y * this.baseSpeed * 10 * dt;
                this.aimX = input.x;
                this.aimY = input.y;
            }
            this.vx *= this.friction;
            this.vy *= this.friction;

            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            if (speed > this.baseSpeed) {
                this.vx = (this.vx / speed) * this.baseSpeed;
                this.vy = (this.vy / speed) * this.baseSpeed;
            }
        }

        super.update(dt);

        if (this.x < this.radius) { this.x = this.radius; this.vx = 0; }
        if (this.y < this.radius) { this.y = this.radius; this.vy = 0; }
        if (game) {
            if (this.x > game.width - this.radius) { this.x = game.width - this.radius; this.vx = 0; }
            if (this.y > game.height - this.radius) { this.y = game.height - this.radius; this.vy = 0; }
        }

        if (this.recording && game) {
            this.history.push({
                x: this.x, y: this.y,
                aimX: this.aimX, aimY: this.aimY,
                isDashing: this.isDashing,
                recoil: this.recoil,
                time: game.time
            });
        }
    }
    triggerRecoil() {
        this.recoil = 1.0;
    }
    draw(ctx) {
        if (this.blinkTimer > 0 && Math.floor(this.blinkTimer * 20) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        const angle = Math.atan2(this.aimY, this.aimX);
        ctx.rotate(angle);

        const recoilOffset = -this.recoil * 10;
        ctx.translate(recoilOffset, 0);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        const speedSq = this.vx*this.vx + this.vy*this.vy;
        if (speedSq > 1000) {
            ctx.fillStyle = this.isDashing ? '#fff' : '#ffaa00';
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius * 1.5 - Math.random() * (this.isDashing ? 15 : 5), 0);
            ctx.stroke();
        }

        ctx.strokeStyle = `rgba(198, 248, 200, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(this.radius + 5, 0);
        ctx.lineTo(this.radius + 20, 0);
        ctx.stroke();

        ctx.restore();
    }
}

class Ghost extends Entity {
    constructor(history, delay) {
        super(history[0]?.x || 0, history[0]?.y || 0, 15);
        this.history = history;
        this.delay = delay;
        this.index = 0;
        this.color = 'rgba(198, 248, 200, 0.5)';
        this.tetherRange = 150;

        this.aimX = 0;
        this.aimY = -1;
        this.isDashing = false;
        this.recoil = 0;
    }
    update(dt) {
        if (!game) return;
        const targetTime = game.time - this.delay;

        while (this.index < this.history.length - 1 && this.history[this.index+1].time < targetTime) {
            this.index++;
        }

        if (this.index < this.history.length) {
            const h = this.history[this.index];
            this.x = h.x;
            this.y = h.y;
            this.aimX = h.aimX;
            this.aimY = h.aimY;
            this.isDashing = h.isDashing;
            this.recoil = h.recoil;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const angle = Math.atan2(this.aimY, this.aimX);
        ctx.rotate(angle);

        const recoilOffset = -this.recoil * 10;
        ctx.translate(recoilOffset, 0);

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.fill();

        if (this.isDashing) {
            ctx.strokeStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius * 1.5 - 10, 0);
            ctx.stroke();
        }

        ctx.restore();

        if (game && game.player) {
            const dx = this.x - game.player.x;
            const dy = this.y - game.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < this.tetherRange) {
                ctx.strokeStyle = `rgba(198, 248, 200, ${0.5 * (1 - dist/this.tetherRange)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(game.player.x, game.player.y);
                ctx.stroke();
            }
        }
    }
}
class Enemy extends Entity {
    constructor(x, y, speed, target) {
        super(x, y, 12);
        this.speed = speed;
        this.target = target;
        this.color = '#ff5555';
    }
    update(dt) {
        if (this.target) {
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 0) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y - this.radius);
        ctx.fill();
    }
}

class Obstacle extends Entity {
    constructor(x, y, w, h) {
        super(x + w/2, y + h/2, Math.max(w,h)/2);
        this.x0 = x;
        this.y0 = y;
        this.w = w;
        this.h = h;
        this.color = '#886644';
        this.beatScale = 1.0;
    }
    update(dt) {
        if (game) {
            // Pulse on beat
            const beatTime = (game.time / game.beatInterval) % 1;
            if (beatTime < 0.1) {
                this.beatScale = 1.2;
            } else {
                this.beatScale += (1.0 - this.beatScale) * dt * 5;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        const dw = this.w * this.beatScale;
        const dh = this.h * this.beatScale;
        const dx = this.x - dw/2;
        const dy = this.y - dh/2;
        ctx.fillRect(dx, dy, dw, dh);

        ctx.strokeStyle = '#aa8855';
        ctx.lineWidth = 2;
        ctx.strokeRect(dx, dy, dw, dh);
    }
    collidesEntity(ent) {
        // Simple AABB
        const dw = this.w * this.beatScale;
        const dh = this.h * this.beatScale;
        const left = this.x - dw/2 - ent.radius;
        const right = this.x + dw/2 + ent.radius;
        const top = this.y - dh/2 - ent.radius;
        const bottom = this.y + dh/2 + ent.radius;
        return ent.x > left && ent.x < right && ent.y > top && ent.y < bottom;
    }
}

class Collectible extends Entity {
    constructor(x, y) {
        super(x, y, 10);
        this.color = '#ffff00';
        this.angle = 0;
    }
    update(dt) {
        this.angle += dt * 3;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.fill();
        ctx.restore();
    }
}

class Particle extends Entity {
    constructor(x, y, vx, vy, color, duration) {
        super(x, y, 2);
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.duration = duration;
        this.time = 0;
    }
    update(dt) {
        this.time += dt;
        super.update(dt);
        if (this.time > this.duration) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 1 - (this.time / this.duration);
        super.draw(ctx);
        ctx.globalAlpha = 1.0;
    }
}

class VisualFXManager {
    constructor() {
        this.particles = [];
        this.screenShake = 0;
        this.flashAmount = 0;
        this.flashColor = '#fff';
    }
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (!p.active) this.particles.splice(i, 1);
        }
        if (this.screenShake > 0) {
            this.screenShake -= dt * 10;
            if (this.screenShake < 0) this.screenShake = 0;
        }
        if (this.flashAmount > 0) {
            this.flashAmount -= dt * 3;
            if (this.flashAmount < 0) this.flashAmount = 0;
        }
    }
    draw(ctx) {
        for (const p of this.particles) p.draw(ctx);
        if (this.flashAmount > 0) {
            ctx.fillStyle = this.flashColor;
            ctx.globalAlpha = this.flashAmount;
            ctx.fillRect(0, 0, 1280, 720);
            ctx.globalAlpha = 1.0;
        }
    }
    spawnExplosion(x, y, count, color) {
        for (let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const duration = 0.5 + Math.random() * 0.5;
            this.particles.push(new Particle(x, y, vx, vy, color, duration));
        }
    }
    triggerShake(amount) {
        this.screenShake = Math.max(this.screenShake, amount);
    }
    triggerFlash(color, amount) {
        this.flashColor = color;
        this.flashAmount = amount;
    }
    spawnDashTrail(x, y, radius, color) {
        for (let i=0; i<3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 20;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const duration = 0.2 + Math.random() * 0.2;
            this.particles.push(new Particle(x, y, vx, vy, color, duration));
        }
    }
    spawnScoreText(x, y, text) {
        const p = new Particle(x, y, 0, -30, '#fff', 1.0);
        p.text = text;
        p.draw = function(ctx) {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = 1 - (this.time / this.duration);
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.text, this.x, this.y);
            ctx.globalAlpha = 1.0;
        };
        this.particles.push(p);
    }
    spawnEnemyDeath(x, y) {
        this.spawnExplosion(x, y, 15, '#ff5555');
        this.triggerShake(0.3);
    }
    spawnPlayerHit(x, y) {
        this.spawnExplosion(x, y, 30, '#c6f8c8');
        this.triggerShake(1.0);
        this.triggerFlash('#ff0000', 0.5);
    }
    getShakeOffset() {
        if (this.screenShake <= 0) return {x:0, y:0};
        const shake = this.screenShake * 15;
        return {
            x: (Math.random() - 0.5) * shake,
            y: (Math.random() - 0.5) * shake
        };
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = 1280;
        this.height = 720;

        this.save = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager();
        this.vfx = new VisualFXManager();

        this.state = 'TITLE';
        this.lastTime = 0;
        this.time = 0;

        this.score = 0;
        this.wave = 1;

        this.player = null;
        this.ghosts = [];
        this.enemies = [];
        this.obstacles = [];
        this.collectibles = [];

        this.beatInterval = 0.5;
        this.lastBeat = 0;

        this.initUI();
        this.setupResizeObserver();

        requestAnimationFrame(t => this.loop(t));

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
        window.addEventListener('keydown', e => {
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.state === 'PLAYING') this.setPause(true);
                else if (this.state === 'PAUSED') this.setPause(false);
            }
        });
    }

    initUI() {
        document.getElementById('btnPlay').addEventListener('click', () => {
            this.sound.init();
            this.startGame();
        });
        document.getElementById('btnResume').addEventListener('click', () => {
            this.sound.init();
            this.setPause(false);
        });
        document.getElementById('btnRestart').addEventListener('click', () => {
            this.sound.init();
            this.startGame();
        });
    }

    setupResizeObserver() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(document.body);
        resize();
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
        if (id) {
            document.getElementById(id).classList.add('active');
        }
    }

    startGame() {
        this.state = 'PLAYING';
        this.showScreen(null);
        this.score = 0;
        this.wave = 1;
        this.time = 0;
        this.lastBeat = 0;
        this.beatInterval = 0.6;

        this.player = new Player(this.width/2, this.height/2);
        this.ghosts = [];
        this.enemies = [];
        this.obstacles = [];
        this.collectibles = [];

        this.generateLevel();

        this.save.data.totalGamesPlayed++;
        this.save.save();
    }

    setPause(paused) {
        if (paused) {
            this.state = 'PAUSED';
            this.showScreen('pauseScreen');
        } else {
            this.state = 'PLAYING';
            this.showScreen(null);
            this.lastTime = performance.now();
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        document.getElementById('finalScore').innerText = this.score;
        this.showScreen('gameOverScreen');

        if (this.score > this.save.data.highScore) {
            this.save.data.highScore = this.score;
        }
        this.save.data.totalScoreAccumulated += this.score;
        this.save.save();
        this.sound.playHit();
    }

    generateLevel() {
        this.obstacles = [];
        this.enemies = [];
        this.collectibles = [];

        for (let i=0; i<5 + this.wave; i++) {
            const w = 50 + Math.random() * 100;
            const h = 50 + Math.random() * 100;
            const x = Math.random() * (this.width - w);
            const y = Math.random() * (this.height - h);

            if (Math.abs(x - this.player.x) > 150 && Math.abs(y - this.player.y) > 150) {
                this.obstacles.push(new Obstacle(x, y, w, h));
            }
        }

        for (let i=0; i<3 + this.wave; i++) {
            this.spawnCollectible();
        }

        if (this.wave > 1 && this.player.history.length > 0) {
            this.ghosts.push(new Ghost(this.player.history, 5.0));
            this.sound.playGhostSpawn();
        }

        this.player.history = [];
        this.player.time = 0;
    }

    spawnCollectible() {
        const x = 50 + Math.random() * (this.width - 100);
        const y = 50 + Math.random() * (this.height - 100);
        this.collectibles.push(new Collectible(x, y));
    }

    spawnEnemy() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        if (side === 0) { x = Math.random() * this.width; y = -20; }
        else if (side === 1) { x = this.width + 20; y = Math.random() * this.height; }
        else if (side === 2) { x = Math.random() * this.width; y = this.height + 20; }
        else { x = -20; y = Math.random() * this.height; }

        this.enemies.push(new Enemy(x, y, 100 + this.wave * 10, this.player));
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt > 0.1) dt = 0.1;

        if (this.state === 'PLAYING') {
            this.update(dt);
        }

        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        this.time += dt;

        if (this.vfx) this.vfx.update(dt);

        if (this.time - this.lastBeat >= this.beatInterval) {
            this.lastBeat += this.beatInterval;
            this.sound.playBeat();

            if (Math.random() < 0.3 + (this.wave * 0.05)) {
                this.spawnEnemy();
            }
        }

        const axis = this.input.getAxis();

        const oldX = this.player.x;
        const oldY = this.player.y;
        this.player.update(dt, axis);

        for (const obs of this.obstacles) {
            if (obs.collidesEntity(this.player)) {
                this.player.x = oldX;
                this.player.y = oldY;
                this.player.vx = 0;
                this.player.vy = 0;
            }
            obs.update(dt);
        }

        for (const ghost of this.ghosts) ghost.update(dt);

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt);

            if (enemy.collides(this.player)) {
                if (this.player.isDashing) {
                    this.enemies.splice(i, 1);
                    this.sound.playHit();
                    this.player.triggerRecoil();
                    this.score += 25;
                    this.vfx.spawnEnemyDeath(enemy.x, enemy.y);
                    this.vfx.spawnScoreText(enemy.x, enemy.y, "+25");
                    continue;
                } else {
                    this.vfx.spawnPlayerHit(this.player.x, this.player.y);
                    this.gameOver();
                    return;
                }
            }

            let destroyed = false;
            for (const ghost of this.ghosts) {
                if (enemy.collides(ghost)) {
                    destroyed = true;
                    this.sound.playEcho();
                    this.score += 50;
                    this.vfx.spawnScoreText(enemy.x, enemy.y, "+50");
                    if (ghost.isDashing) {
                        this.score += 25;
                        this.vfx.spawnScoreText(enemy.x, enemy.y + 20, "DASH +25");
                    }
                    this.vfx.spawnEnemyDeath(enemy.x, enemy.y);
                    break;
                }
            }

            if (destroyed) this.enemies.splice(i, 1);
        }

        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const col = this.collectibles[i];
            col.update(dt);

            if (col.collides(this.player)) {
                this.score += 100;
                this.sound.playScore();
                this.collectibles.splice(i, 1);
                this.vfx.spawnScoreText(col.x, col.y, "+100");
                this.vfx.spawnExplosion(col.x, col.y, 10, '#ffff00');
            } else {
                for (const ghost of this.ghosts) {
                    if (col.collides(ghost)) {
                        this.score += 50;
                        this.sound.playScore();
                        this.collectibles.splice(i, 1);
                        this.vfx.spawnScoreText(col.x, col.y, "+50");
                        this.vfx.spawnExplosion(col.x, col.y, 10, '#ffff00');
                        break;
                    }
                }
            }
        }

        if (this.collectibles.length === 0) {
            this.wave++;
            this.beatInterval = Math.max(0.3, this.beatInterval - 0.05);
            this.generateLevel();
        }
    }

    draw() {
        this.ctx.fillStyle = '#1a1311';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        const scale = Math.min(this.canvas.width / this.width, this.canvas.height / this.height);
        const offsetX = (this.canvas.width - this.width * scale) / 2;
        const offsetY = (this.canvas.height - this.height * scale) / 2;

        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.width, this.height);
        this.ctx.clip();

        const shake = this.vfx ? this.vfx.getShakeOffset() : {x:0, y:0};
        this.ctx.translate(shake.x, shake.y);

        this.ctx.strokeStyle = 'rgba(198, 248, 200, 0.1)';
        this.ctx.lineWidth = 1;
        for(let i=0; i<this.width; i+=50) {
            this.ctx.beginPath(); this.ctx.moveTo(i,0); this.ctx.lineTo(i,this.height); this.ctx.stroke();
        }
        for(let i=0; i<this.height; i+=50) {
            this.ctx.beginPath(); this.ctx.moveTo(0,i); this.ctx.lineTo(this.width,i); this.ctx.stroke();
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            for (const obs of this.obstacles) obs.draw(this.ctx);
            for (const col of this.collectibles) col.draw(this.ctx);
            for (const ghost of this.ghosts) ghost.draw(this.ctx);
            for (const enemy of this.enemies) enemy.draw(this.ctx);
            if (this.player) this.player.draw(this.ctx);

            if (this.vfx) this.vfx.draw(this.ctx);

            this.ctx.fillStyle = '#c6f8c8';
            this.ctx.font = '24px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 20, 40);
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 70);

            this.ctx.textAlign = 'right';
            this.ctx.fillText(`High Score: ${this.save.data.highScore}`, this.width - 20, 40);

            const beatTime = (this.time / this.beatInterval) % 1;
            const radius = 10 + Math.sin(beatTime * Math.PI) * 10;
            this.ctx.beginPath();
            this.ctx.arc(this.width / 2, 40, radius, 0, Math.PI*2);
            this.ctx.fillStyle = `rgba(198, 248, 200, ${1 - beatTime})`;
            this.ctx.fill();

            if (this.player && typeof this.player.dashCooldown !== 'undefined') {
                const dashReady = this.player.dashCooldown <= 0;
                const dashRatio = 1.0 - (this.player.dashCooldown / this.player.dashMaxCooldown);

                this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                this.ctx.fillRect(20, this.height - 40, 200, 20);

                this.ctx.fillStyle = dashReady ? '#c6f8c8' : '#888';
                this.ctx.fillRect(20, this.height - 40, 200 * Math.max(0, dashRatio), 20);

                this.ctx.strokeStyle = '#c6f8c8';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(20, this.height - 40, 200, 20);

                this.ctx.fillStyle = '#111';
                this.ctx.font = '14px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(dashReady ? "DASH READY (Space)" : "RECHARGING...", 120, this.height - 25);
            }
        }

        this.ctx.restore();
    }
}
let game = null;
window.addEventListener('DOMContentLoaded', () => {
    game = new GameEngine();
});
