// Haunted Tether Drill - Phase 1

const SAVE_KEY = 'arcade_game_083_083-haunted-tether-drill_v1';
const ACCENT_COLOR = '#65bb98';

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                mute: false,
                particles: 'High',
                screenShake: 100
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
                if (parsed.options) {
                    this.data.options = { ...this.data.options, ...parsed.options };
                }
            }
        } catch (e) {
            console.error('SaveManager load error:', e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error('SaveManager save error:', e);
        }
    }

    updateHighScore(score) {
        if (score > this.data.highScore) {
            this.data.highScore = score;
        }
        this.data.totalScoreAccumulated += score;
        this.data.totalGamesPlayed += 1;
        this.save();
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
        this.muted = false;
    }

    init() {
        if (this.initialized) {
            return;
        }
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.masterGain.gain.value = 1.0;
            this.sfxGain.gain.value = 0.5;
            this.musicGain.gain.value = 0.3;

            this.initialized = true;
            console.log('SoundEngine initialized.');
        } catch (e) {
            console.error('SoundEngine init error:', e);
        }
    }

    resume() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        }
    }

    setMute(mute) {
        this.muted = mute;
        if (this.masterGain) {
            if (this.muted) {
                this.masterGain.gain.value = 0;
            } else {
                this.masterGain.gain.value = 1.0;
            }
        }
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (!this.initialized) {
            return;
        }
        if (this.muted) {
            return;
        }
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.sfxGain);

            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('playTone error', e);
        }
    }

    playShoot() {
        this.playTone(400, 'square', 0.1, 0.3);
    }

    playCollect() {
        this.playTone(800, 'sine', 0.15, 0.4);
    }

    playHit() {
        this.playTone(150, 'sawtooth', 0.2, 0.5);
        setTimeout(() => {
            this.playTone(100, 'square', 0.3, 0.5);
        }, 50);
    }

    playDeposit() {
        this.playTone(1200, 'sine', 0.4, 0.6);
        setTimeout(() => {
            this.playTone(1600, 'sine', 0.4, 0.6);
        }, 100);
    }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.prevMouse = { x: 0, y: 0, down: false };
        this.touch = { active: false, x: 0, y: 0 };
        this.prevTouch = { active: false, x: 0, y: 0 };
        this.bindEvents();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.addEventListener('mousedown', (e) => {
                this.updateMouse(e);
                this.mouse.down = true;
            });
            window.addEventListener('mouseup', () => {
                this.mouse.down = false;
            });
            canvas.addEventListener('mousemove', (e) => {
                this.updateMouse(e);
            });

            canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (e.touches.length > 0) {
                    this.updateTouch(e.touches[0]);
                    this.mouse.down = true;
                    this.touch.active = true;
                }
            }, { passive: false });
            canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (e.touches.length > 0) {
                    this.updateTouch(e.touches[0]);
                }
            }, { passive: false });
            window.addEventListener('touchend', () => {
                this.mouse.down = false;
                this.touch.active = false;
            });
        }
    }

    updateMouse(e) {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        }
    }

    updateTouch(touch) {
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            this.mouse.x = (touch.clientX - rect.left) * scaleX;
            this.mouse.y = (touch.clientY - rect.top) * scaleY;
        }
    }

    isDown(code) {
        if (this.keys[code]) {
            return true;
        }
        return false;
    }

    justPressed(code) {
        if (this.keys[code] && !this.prevKeys[code]) {
            return true;
        }
        return false;
    }

    justReleased(code) {
        if (!this.keys[code] && this.prevKeys[code]) {
            return true;
        }
        return false;
    }

    mouseJustPressed() {
        if (this.mouse.down && !this.prevMouse.down) {
            return true;
        }
        return false;
    }

    mouseJustReleased() {
        if (!this.mouse.down && this.prevMouse.down) {
            return true;
        }
        return false;
    }

    touchJustPressed() {
        if (this.touch.active && !this.prevTouch.active) {
            return true;
        }
        return false;
    }

    touchJustReleased() {
        if (!this.touch.active && this.prevTouch.active) {
            return true;
        }
        return false;
    }

    update() {
        this.prevKeys = { ...this.keys };
        this.prevMouse = { ...this.mouse };
        this.prevTouch = { ...this.touch };
    }
}

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    collides(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.radius + other.radius) {
            return true;
        }
        return false;
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15, ACCENT_COLOR);
        this.speed = 200;
        this.tail = [];
        this.tailLength = 0;
        this.maxTailLength = 50;
        this.nodeSpacing = 12;
        this.history = [];
        this.energy = 100;
        this.baseDepositTimer = 0;

        this.dashCooldown = 0;
        this.dashCooldownMax = 3.0;
        this.dashActiveTimer = 0;
        this.dashActiveMax = 0.2;
        this.isInvulnerable = false;
        this.particles = [];
    }

    update(dt, input, width, height) {
        let dx = 0;
        let dy = 0;

        if (input.isDown('KeyW') || input.isDown('ArrowUp')) {
            dy -= 1;
        }
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) {
            dy += 1;
        }
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) {
            dx -= 1;
        }
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) {
            dx += 1;
        }

        if (input.touch.active || (input.mouse.down && dx === 0 && dy === 0)) {
            const mx = input.mouse.x;
            const my = input.mouse.y;
            const angle = Math.atan2(my - this.y, mx - this.x);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
        } else if (dx !== 0 || dy !== 0) {
            const length = Math.sqrt(dx * dx + dy * dy);
            dx /= length;
            dy /= length;
        }

        this.dashCooldown -= dt;
        if (this.dashCooldown < 0) this.dashCooldown = 0;

        this.dashActiveTimer -= dt;
        if (this.dashActiveTimer < 0) this.dashActiveTimer = 0;

        let isDashing = false;
        if (this.dashCooldown <= 0 && (input.justPressed('Space') || (input.mouse.down && !input.prevMouse.down) || (input.touch.active && !input.prevTouch.active))) {
            this.dashCooldown = this.dashCooldownMax;
            this.dashActiveTimer = this.dashActiveMax;
            isDashing = true;

            // Add some particles
            for (let i = 0; i < 10; i++) {
                this.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: (Math.random() - 0.5) * 100 - dx * 50,
                    vy: (Math.random() - 0.5) * 100 - dy * 50,
                    life: 0.5 + Math.random() * 0.5
                });
            }
        }

        let currentSpeed = this.speed;
        if (this.dashActiveTimer > 0) {
            currentSpeed = this.speed * 3;
            this.isInvulnerable = true;
        } else {
            this.isInvulnerable = false;
        }

        this.vx = dx * currentSpeed;
        this.vy = dy * currentSpeed;

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        super.update(dt);

        if (this.x < this.radius) {
            this.x = this.radius;
        }
        if (this.x > width - this.radius) {
            this.x = width - this.radius;
        }
        if (this.y < this.radius) {
            this.y = this.radius;
        }
        if (this.y > height - this.radius) {
            this.y = height - this.radius;
        }

        if (this.vx !== 0 || this.vy !== 0) {
            this.history.unshift({ x: this.x, y: this.y });
            const limit = this.maxTailLength * (this.nodeSpacing / 2);
            if (this.history.length > limit) {
                this.history.pop();
            }
        }

        this.tail = [];
        for (let i = 1; i <= this.tailLength; i++) {
            const histIndex = i * 4;
            if (histIndex < this.history.length) {
                this.tail.push(this.history[histIndex]);
            } else if (this.history.length > 0) {
                this.tail.push(this.history[this.history.length - 1]);
            }
        }
    }

    draw(ctx) {
        if (this.particles) {
            for (let p of this.particles) {
                ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (this.tail.length > 0) {
            ctx.moveTo(this.x, this.y);
            for (let i = 0; i < this.tail.length; i++) {
                ctx.lineTo(this.tail[i].x, this.tail[i].y);
            }
            ctx.stroke();

            ctx.fillStyle = '#65bb98';
            for (let i = 0; i < this.tail.length; i++) {
                ctx.beginPath();
                ctx.arc(this.tail[i].x, this.tail[i].y, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        ctx.fillStyle = this.isInvulnerable ? '#ffffff' : this.color;
        ctx.beginPath();
        const angle = Math.atan2(this.vy, this.vx);

        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.vx !== 0 || this.vy !== 0) {
            ctx.rotate(angle);
        }

        let recoil = 0;
        if (this.dashActiveTimer > 0) {
            recoil = -5; // move back slightly
            ctx.fillStyle = '#ffeb3b'; // flash color
        }

        // multi-part vector sprite
        ctx.beginPath();
        ctx.moveTo(15 + recoil, 0);
        ctx.lineTo(-10 + recoil, 10);
        ctx.lineTo(-10 + recoil, -10);
        ctx.closePath();
        ctx.fill();

        // Thrust flame
        if (this.vx !== 0 || this.vy !== 0) {
            ctx.fillStyle = '#e74c3c';
            ctx.beginPath();
            ctx.moveTo(-10 + recoil, -5);
            ctx.lineTo(-10 + recoil, 5);
            ctx.lineTo(-20 + recoil - Math.random() * 5, 0);
            ctx.closePath();
            ctx.fill();
        }

        // Telegraph (aim line)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(20 + recoil, 0);
        ctx.lineTo(50 + recoil, 0);
        ctx.stroke();

        ctx.restore();
    }

    addTailNode() {
        if (this.tailLength < this.maxTailLength) {
            this.tailLength++;
        }
    }
}

class Enemy extends Entity {
    constructor(x, y, target) {
        super(x, y, 12, '#e74c3c');
        this.speed = 100 + Math.random() * 50;
        this.target = target;
        this.hp = 1;
    }

    update(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }

        this.vx += (Math.random() - 0.5) * 50;
        this.vy += (Math.random() - 0.5) * 50;

        super.update(dt);
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x - 4, this.y - 2, 2, 0, Math.PI * 2);
        ctx.arc(this.x + 4, this.y - 2, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class ResourceNode extends Entity {
    constructor(x, y) {
        super(x, y, 8, '#f1c40f');
        this.pulse = 0;
    }

    update(dt) {
        this.pulse += dt * 5;
    }

    draw(ctx) {
        const pulseRadius = this.radius + Math.sin(this.pulse) * 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class BaseCamp extends Entity {
    constructor(x, y) {
        super(x, y, 40, '#8e44ad');
        this.rotation = 0;
    }

    update(dt) {
        this.rotation += dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(142, 68, 173, 0.2)';
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BASE', 0, 0);

        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.saveManager = new SaveManager();
        this.soundEngine = new SoundEngine();
        this.inputManager = new InputManager();

        this.state = 'TITLE';
        this.lastTime = 0;
        this.dt = 0;

        this.score = 0;
        this.multiplier = 1;

        this.player = null;
        this.baseCamp = null;
        this.enemies = [];
        this.resources = [];

        this.spawnTimer = 0;
        this.resourceTimer = 0;

        this.resize();
        this.resizeObserver = new ResizeObserver(() => {
            this.resize();
        });
        this.resizeObserver.observe(this.canvas);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === 'PLAYING') {
                    this.state = 'PAUSED';
                }
            }
        });

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
        }
    }

    initGame() {
        this.score = 0;
        this.multiplier = 1;
        this.player = new Player(this.width / 2, this.height / 2);
        this.baseCamp = new BaseCamp(this.width / 2, this.height / 2);
        this.enemies = [];
        this.resources = [];
        this.spawnTimer = 0;
        this.resourceTimer = 0;
        this.state = 'PLAYING';

        this.soundEngine.init();
        this.soundEngine.resume();

        for(let i = 0; i < 5; i++) {
            this.spawnResource();
        }
    }

    spawnResource() {
        const x = Math.random() * (this.width - 40) + 20;
        const y = Math.random() * (this.height - 40) + 20;

        const dx = x - this.baseCamp.x;
        const dy = y - this.baseCamp.y;

        if (Math.sqrt(dx*dx + dy*dy) > 150) {
            this.resources.push(new ResourceNode(x, y));
        } else {
            this.spawnResource();
        }
    }

    spawnEnemy() {
        let x, y;
        if (Math.random() < 0.5) {
            if (Math.random() < 0.5) {
                x = -20;
            } else {
                x = this.width + 20;
            }
            y = Math.random() * this.height;
        } else {
            x = Math.random() * this.width;
            if (Math.random() < 0.5) {
                y = -20;
            } else {
                y = this.height + 20;
            }
        }
        this.enemies.push(new Enemy(x, y, this.player));
    }

    updatePlaying(dt) {
        this.player.update(dt, this.inputManager, this.width, this.height);
        this.baseCamp.update(dt);

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            this.spawnTimer = 2.0 - Math.min((this.score / 1000), 1.5);
        }

        this.resourceTimer -= dt;
        if (this.resourceTimer <= 0) {
            this.spawnResource();
            this.resourceTimer = 3.0;
        }

        for (let i = this.resources.length - 1; i >= 0; i--) {
            const res = this.resources[i];
            res.update(dt);
            if (this.player.collides(res)) {
                this.player.addTailNode();
                this.soundEngine.playCollect();
                this.resources.splice(i, 1);
            }
        }

        if (this.player.collides(this.baseCamp)) {
            if (this.player.tailLength > 0) {
                this.player.baseDepositTimer += dt;
                if (this.player.baseDepositTimer > 0.1) {
                    this.score += 10 * this.multiplier;
                    this.player.tailLength--;
                    this.player.baseDepositTimer = 0;
                    this.soundEngine.playDeposit();
                }
            } else {
                this.player.baseDepositTimer = 0;
            }
        } else {
            this.player.baseDepositTimer = 0;
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt);

            if (this.player.collides(enemy)) {
                if (!this.player.isInvulnerable) {
                    this.soundEngine.playHit();
                    this.gameOver();
                    return;
                } else {
                    // Dash kills enemy
                    this.soundEngine.playHit();
                    enemy.active = false;
                    this.score += 20 * this.multiplier;
                }
            }

            let tailCut = false;
            for (let j = 0; j < this.player.tail.length; j++) {
                const node = this.player.tail[j];
                const dx = enemy.x - node.x;
                const dy = enemy.y - node.y;
                if (Math.sqrt(dx*dx + dy*dy) < enemy.radius + 5) {
                    this.player.tailLength = j;
                    this.soundEngine.playHit();
                    enemy.active = false;
                    tailCut = true;
                    this.score = Math.max(0, this.score - 50);
                    break;
                }
            }

            if (!enemy.active || tailCut) {
                this.enemies.splice(i, 1);
            }
        }

        while(this.player.history.length > (this.player.maxTailLength * 10)) {
            this.player.history.pop();
        }

        if (this.inputManager.isDown('Escape')) {
            this.state = 'PAUSED';
            this.inputManager.keys['Escape'] = false;
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.saveManager.updateHighScore(this.score);
    }

    update(dt) {
        if (this.state === 'TITLE') {
            if (this.inputManager.isDown('Space') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.initGame();
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        } else if (this.state === 'PLAYING') {
            this.updatePlaying(dt);
        } else if (this.state === 'PAUSED') {
            if (this.inputManager.isDown('Space') || this.inputManager.isDown('Escape') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.state = 'PLAYING';
                this.inputManager.keys['Space'] = false;
                this.inputManager.keys['Escape'] = false;
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.inputManager.isDown('Space') || this.inputManager.mouse.down || this.inputManager.touch.active) {
                this.state = 'TITLE';
                this.inputManager.mouse.down = false;
                this.inputManager.touch.active = false;
            }
        }

        this.inputManager.update();
    }

    draw() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        const gridSize = 40;
        for(let x=0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for(let y=0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            if (this.baseCamp) {
                this.baseCamp.draw(this.ctx);
            }
            this.resources.forEach(r => r.draw(this.ctx));

            if (this.state !== 'GAME_OVER') {
                if (this.player) {
                    this.player.draw(this.ctx);
                }
            }

            this.enemies.forEach(e => e.draw(this.ctx));

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 10, 30);

            const currentTail = this.player ? this.player.tailLength : 0;
            const maxTail = this.player ? this.player.maxTailLength : 50;
            this.ctx.fillText(`Tail: ${currentTail}/${maxTail}`, 10, 60);

            if (this.player) {
                this.ctx.fillText(`Dash: ${this.player.dashCooldown <= 0 ? 'READY' : this.player.dashCooldown.toFixed(1)}s`, 10, 90);

                // Dash cooldown bar
                this.ctx.fillStyle = '#333';
                this.ctx.fillRect(10, 100, 100, 10);
                this.ctx.fillStyle = this.player.dashCooldown <= 0 ? '#65bb98' : '#e74c3c';
                const fillRatio = this.player.dashCooldown <= 0 ? 1 : 1 - (this.player.dashCooldown / this.player.dashCooldownMax);
                this.ctx.fillRect(10, 100, 100 * fillRatio, 10);
            }
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = ACCENT_COLOR;
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('HAUNTED TETHER DRILL', this.width / 2, this.height / 2 - 40);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Click or Press Space to Start', this.width / 2, this.height / 2 + 20);
            this.ctx.font = '16px monospace';
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width / 2, this.height / 2 + 60);
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 40);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2);
            this.ctx.fillText('Click or Press Space to Restart', this.width / 2, this.height / 2 + 40);
        }
    }

    loop(timestamp) {
        const now = timestamp || performance.now();
        this.dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.update(this.dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }
}

window.onload = () => {
    window.game = new Game();
};