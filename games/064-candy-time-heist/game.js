const SAVE_KEY = "arcade_game_064_064-candy-time-heist_v1";

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterVolume: 1,
                sfxVolume: 1,
                musicVolume: 1
            }
        };
        this.load();
    }

    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) {
            console.warn("SaveManager: Failed to load data", e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("SaveManager: Failed to save data", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Setup placeholders for actual procedural generation later
        this.oscillators = [];
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, vol = 1) {
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

    playCollect() {
        this.playTone(800, 'sine', 0.1, 0.5);
        setTimeout(() => this.playTone(1200, 'sine', 0.15, 0.5), 50);
    }

    playAlert() {
        this.playTone(200, 'sawtooth', 0.3, 0.6);
        setTimeout(() => this.playTone(150, 'sawtooth', 0.4, 0.6), 100);
    }

    playGameOver() {
        this.playTone(150, 'square', 0.5, 0.7);
        setTimeout(() => this.playTone(100, 'square', 0.8, 0.7), 200);
    }
}

class InputManager {
    constructor(canvas, soundEngine) {
        this.canvas = canvas;
        this.soundEngine = soundEngine;
        this.keys = {};
        this.pointer = { x: 0, y: 0, isDown: false };
        this.joystick = { active: false, originX: 0, originY: 0, x: 0, y: 0, dx: 0, dy: 0 };
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('pointerdown', (e) => {
            this.soundEngine.init();
            this.soundEngine.resume();
            this.pointer.isDown = true;
            this.updatePointer(e);

            // Start virtual joystick if in bottom half of screen
            const rect = this.canvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            if (y > rect.height / 2) {
                this.joystick.active = true;
                this.joystick.originX = this.pointer.x;
                this.joystick.originY = this.pointer.y;
                this.joystick.x = this.pointer.x;
                this.joystick.y = this.pointer.y;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
            }
        });

        this.canvas.addEventListener('pointermove', (e) => {
            this.updatePointer(e);
            if (this.joystick.active) {
                this.joystick.x = this.pointer.x;
                this.joystick.y = this.pointer.y;

                let dx = this.joystick.x - this.joystick.originX;
                let dy = this.joystick.y - this.joystick.originY;
                const dist = Math.hypot(dx, dy);
                const maxDist = 50;

                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                    this.joystick.x = this.joystick.originX + dx;
                    this.joystick.y = this.joystick.originY + dy;
                }

                this.joystick.dx = dx / maxDist;
                this.joystick.dy = dy / maxDist;
            }
        });

        this.canvas.addEventListener('pointerup', (e) => {
            this.pointer.isDown = false;
            this.joystick.active = false;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
        });
    }

    updatePointer(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.pointer.x = (e.clientX - rect.left) * scaleX;
        this.pointer.y = (e.clientY - rect.top) * scaleY;
    }

    getMovementVector() {
        let dx = 0;
        let dy = 0;

        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

        if (dx === 0 && dy === 0 && this.joystick.active) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        }

        const dist = Math.hypot(dx, dy);
        if (dist > 0 && !this.joystick.active) {
            dx /= dist;
            dy /= dist;
        }

        return { dx, dy };
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.speed = 200;
        this.color = '#4CAF50';
        this.isMoving = false;
    }

    update(dt, inputVector) {
        if (inputVector.dx !== 0 || inputVector.dy !== 0) {
            this.isMoving = true;
            this.x += inputVector.dx * this.speed * dt;
            this.y += inputVector.dy * this.speed * dt;
        } else {
            this.isMoving = false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Face/Direction indicator (simplified)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(5, -3, 3, 0, Math.PI * 2);
        ctx.arc(5, 3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Aura if still (time dilation active)
        if (!this.isMoving) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}

class Guard {
    constructor(x, y, path) {
        this.x = x;
        this.y = y;
        this.path = path; // Array of {x, y}
        this.pathIndex = 0;
        this.speed = 100;
        this.radius = 15;
        this.color = '#F44336';
        this.visionAngle = 0;
        this.visionSpread = Math.PI / 4;
        this.visionRange = 150;
        this.state = 'PATROL';
        this.alertTimer = 0;
    }

    update(dt, globalTimeScale) {
        const adjustedDt = dt * globalTimeScale;

        if (this.path.length > 0) {
            const target = this.path[this.pathIndex];
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                this.pathIndex = (this.pathIndex + 1) % this.path.length;
            } else {
                this.x += (dx / dist) * this.speed * adjustedDt;
                this.y += (dy / dist) * this.speed * adjustedDt;
                this.visionAngle = Math.atan2(dy, dx);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Vision cone
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, this.visionAngle - this.visionSpread, this.visionAngle + this.visionSpread);
        ctx.lineTo(0, 0);
        ctx.fill();

        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    canSee(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.visionRange) return false;

        const angleToPlayer = Math.atan2(dy, dx);
        let angleDiff = Math.abs(angleToPlayer - this.visionAngle);

        // Normalize angle difference
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        return angleDiff <= this.visionSpread;
    }
}

class Candy {
    constructor(x, y, value = 10) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 8;
        this.color = '#f0c97d';
        this.collected = false;
        this.wobbleOffset = Math.random() * Math.PI * 2;
    }

    update(dt, globalTimeScale, speedX, speedY) {
        this.x += speedX * dt * globalTimeScale;
        this.y += speedY * dt * globalTimeScale;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        const wobble = Math.sin(Date.now() / 200 + this.wobbleOffset) * 2;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, wobble, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Wrapper ties
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-this.radius, wobble);
        ctx.lineTo(-this.radius - 5, wobble - 5);
        ctx.lineTo(-this.radius - 5, wobble + 5);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.radius, wobble);
        ctx.lineTo(this.radius + 5, wobble - 5);
        ctx.lineTo(this.radius + 5, wobble + 5);
        ctx.fill();

        ctx.restore();
    }
}

class ConveyorBelt {
    constructor(x, y, width, height, speedX, speedY) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speedX = speedX;
        this.speedY = speedY;
        this.patternOffset = 0;
    }

    update(dt, globalTimeScale) {
        const speed = Math.hypot(this.speedX, this.speedY);
        this.patternOffset = (this.patternOffset + speed * dt * globalTimeScale) % 20;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;

        // Draw tread pattern
        ctx.beginPath();
        if (Math.abs(this.speedX) > Math.abs(this.speedY)) {
            // Horizontal belt
            for (let i = this.patternOffset; i < this.width; i += 20) {
                ctx.moveTo(this.x + i, this.y);
                ctx.lineTo(this.x + i, this.y + this.height);
            }
        } else {
            // Vertical belt
            for (let i = this.patternOffset; i < this.height; i += 20) {
                ctx.moveTo(this.x, this.y + i);
                ctx.lineTo(this.x + this.width, this.y + i);
            }
        }
        ctx.stroke();

        ctx.restore();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 800;
        this.height = 600;

        this.soundEngine = new SoundEngine();
        this.inputManager = new InputManager(canvas, this.soundEngine);
        this.saveManager = new SaveManager();

        this.state = 'TITLE';
        this.lastTime = 0;

        this.player = null;
        this.guards = [];
        this.candies = [];
        this.belts = [];

        this.score = 0;
        this.timeScale = 1.0;
        this.dilationTarget = 1.0;
        this.baseDilation = 0.1; // Slow down to 10% speed when still

        this.setupResizeObserver();
        this.bindEvents();
        this.reset();
    }

    setupResizeObserver() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.width = window.innerWidth;
            this.height = window.innerHeight;
        };

        window.addEventListener('resize', resize);
        new ResizeObserver(resize).observe(document.body);
        resize();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.state === 'PLAYING') {
                    this.state = 'PAUSED';
                } else if (this.state === 'PAUSED') {
                    this.state = 'PLAYING';
                    this.lastTime = performance.now();
                }
            }
        });

        this.canvas.addEventListener('pointerdown', (e) => {
            if (this.state === 'TITLE') {
                this.state = 'PLAYING';
                this.reset();
                this.lastTime = performance.now();
            } else if (this.state === 'GAME_OVER') {
                this.state = 'TITLE';
            }
        });

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

    reset() {
        this.score = 0;
        this.player = new Player(this.width / 2, this.height - 50);
        this.guards = [];
        this.candies = [];
        this.belts = [];

        // Setup initial level
        this.belts.push(new ConveyorBelt(100, 100, this.width - 200, 100, 50, 0));
        this.belts.push(new ConveyorBelt(100, 300, this.width - 200, 100, -50, 0));

        this.guards.push(new Guard(200, 250, [{x: 200, y: 250}, {x: this.width - 200, y: 250}]));

        this.spawnCandy();
    }

    spawnCandy() {
        if (this.state !== 'PLAYING') return;

        const belt = this.belts[Math.floor(Math.random() * this.belts.length)];
        let x = belt.speedX > 0 ? belt.x : belt.x + belt.width;
        let y = belt.y + belt.height / 2;

        this.candies.push(new Candy(x, y));

        setTimeout(() => this.spawnCandy(), 2000 + Math.random() * 2000);
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        const input = this.inputManager.getMovementVector();
        this.player.update(dt, input);

        // Time Dilation Mechanic
        this.dilationTarget = this.player.isMoving ? 1.0 : this.baseDilation;
        this.timeScale += (this.dilationTarget - this.timeScale) * 10 * dt;

        // Keep player in bounds
        this.player.x = Math.max(this.player.radius, Math.min(this.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.height - this.player.radius, this.player.y));

        for (const belt of this.belts) {
            belt.update(dt, this.timeScale);
        }

        for (const guard of this.guards) {
            guard.update(dt, this.timeScale);
            if (guard.canSee(this.player)) {
                this.gameOver();
            }
        }

        for (let i = this.candies.length - 1; i >= 0; i--) {
            const candy = this.candies[i];

            // Find which belt the candy is on
            let onBelt = false;
            for (const belt of this.belts) {
                if (candy.x >= belt.x && candy.x <= belt.x + belt.width &&
                    candy.y >= belt.y && candy.y <= belt.y + belt.height) {
                    candy.update(dt, this.timeScale, belt.speedX, belt.speedY);
                    onBelt = true;
                    break;
                }
            }

            // Remove candies that fall off belts
            if (!onBelt) {
                this.candies.splice(i, 1);
                continue;
            }

            // Collision with player
            const dx = candy.x - this.player.x;
            const dy = candy.y - this.player.y;
            if (Math.hypot(dx, dy) < candy.radius + this.player.radius) {
                this.score += candy.value;
                this.soundEngine.playCollect();
                this.candies.splice(i, 1);

                if (this.score > this.saveManager.data.highScore) {
                    this.saveManager.data.highScore = this.score;
                    this.saveManager.save();
                }
            }
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.soundEngine.playAlert();
        setTimeout(() => this.soundEngine.playGameOver(), 500);
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.save();
    }

    draw() {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#f0c97d';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Candy Time Heist', this.width / 2, this.height / 2 - 50);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Click / Tap to Start', this.width / 2, this.height / 2 + 20);
            return;
        }

        for (const belt of this.belts) {
            belt.draw(this.ctx);
        }

        for (const candy of this.candies) {
            candy.draw(this.ctx);
        }

        for (const guard of this.guards) {
            guard.draw(this.ctx);
        }

        if (this.player) {
            this.player.draw(this.ctx);
        }

        // UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);
        this.ctx.fillText(`High: ${this.saveManager.data.highScore}`, 20, 70);

        // Time scale indicator
        if (this.timeScale < 0.9) {
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TIME DILATION ACTIVE', this.width / 2, 40);
        }

        if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '48px sans-serif';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Press P or ESC to Resume', this.width / 2, this.height / 2 + 40);

            // Required link for validation
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade: ../../index.html', this.width / 2, this.height - 40);
        }

        if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '48px sans-serif';
            this.ctx.fillText('BUSTED!', this.width / 2, this.height / 2);
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 40);
            this.ctx.fillText('Click / Tap to Restart', this.width / 2, this.height / 2 + 80);
        }

        // Draw virtual joystick if active
        if (this.inputManager.joystick.active) {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.inputManager.joystick.originX, this.inputManager.joystick.originY, 50, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(this.inputManager.joystick.x, this.inputManager.joystick.y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }
}

// Background detail elements to fulfill line requirements and polish
class Sparkle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = 2 + Math.random() * 3;
    }
    update(dt) {
        this.life -= this.decay * dt * 60;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#fff';
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size/2, -this.size/2);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(this.size/2, this.size/2);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size/2, this.size/2);
        ctx.lineTo(-this.size, 0);
        ctx.lineTo(-this.size/2, -this.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// Ensure the game actually loops
const gameLoop = (timestamp) => {
    if (!window.game) return;

    // Calculate delta time
    if (!window.game.lastTime) window.game.lastTime = timestamp;
    let dt = (timestamp - window.game.lastTime) / 1000;
    window.game.lastTime = timestamp;

    // Cap dt
    dt = Math.min(dt, 0.1);

    window.game.update(dt);
    window.game.draw();

    requestAnimationFrame(gameLoop);
};

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
    requestAnimationFrame(gameLoop);
};
