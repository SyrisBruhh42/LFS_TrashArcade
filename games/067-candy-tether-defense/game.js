// --- CONFIG & CONSTANTS ---
const GAME_ID = "067";
const GAME_SLUG = "067-candy-tether-defense";
const SAVE_KEY = "arcade_game_067_067-candy-tether-defense_v1";
const ACCENT_COLOR = "#468aa9";

// Game States
const STATES = {
    TITLE: 0,
    PLAYING: 1,
    GAME_OVER: 2,
    PAUSED: 3
};

// --- CORE UTILITIES ---
class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWave: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterMute: false
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
                if (!this.data.options) this.data.options = { masterMute: false };
            }
        } catch (e) {
            console.warn("Could not load save data:", e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Could not save data:", e);
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
        this.muted = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.masterGain.gain.value = this.muted ? 0 : 0.8;
            this.initialized = true;

            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        } catch (e) {
            console.warn("Audio Context failed to initialize", e);
        }
    }

    setMute(isMuted) {
        this.muted = isMuted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 0.8;
        }
    }

    playTone(freq, type, duration, vol = 1) {
        if (!this.initialized || !this.ctx || this.muted) return;
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

    playShoot() { this.playTone(800, 'square', 0.1, 0.3); }
    playHit() { this.playTone(300, 'sawtooth', 0.1, 0.4); }
    playExplosion() { this.playTone(100, 'square', 0.3, 0.5); }
    playStart() { this.playTone(600, 'sine', 0.4, 0.5); }
    playOver() { this.playTone(200, 'sawtooth', 0.6, 0.5); }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, isDown: false, justPressed: false };
        this.touch = { x: 0, y: 0, isDown: false, justPressed: false };

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        canvas.addEventListener('mousedown', (e) => {
            this.updateMouse(e);
            this.mouse.isDown = true;
            this.mouse.justPressed = true;
        });
        canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
        window.addEventListener('mouseup', () => this.mouse.isDown = false);

        canvas.addEventListener('touchstart', (e) => {
            this.updateTouch(e);
            this.touch.isDown = true;
            this.touch.justPressed = true;
        }, {passive: false});
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.updateTouch(e);
        }, {passive: false});
        window.addEventListener('touchend', () => this.touch.isDown = false);
    }

    updateMouse(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouse.x = (e.clientX - rect.left) * scaleX;
        this.mouse.y = (e.clientY - rect.top) * scaleY;
    }

    updateTouch(e) {
        if (e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.touch.x = (e.touches[0].clientX - rect.left) * scaleX;
            this.touch.y = (e.touches[0].clientY - rect.top) * scaleY;
        }
    }

    update() {
        this.mouse.justPressed = false;
        this.touch.justPressed = false;
    }

    isPointerDown() { return this.mouse.isDown || this.touch.isDown; }
    isPointerJustPressed() { return this.mouse.justPressed || this.touch.justPressed; }
    getPointerX() { return this.touch.isDown ? this.touch.x : this.mouse.x; }
    getPointerY() { return this.touch.isDown ? this.touch.y : this.mouse.y; }
}

// --- ENTITIES ---

class Tower {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 40;
        this.maxHealth = 100;
        this.health = 100;
        this.tetherAngle = 0;
        this.tetherBaseLength = 60;
        this.tetherMaxLength = 300;
        this.tetherCurrentLength = this.tetherBaseLength;
        this.isExtending = false;

        // Weapon stats
        this.baseAngularVelocity = Math.PI * 1.5; // rad/sec
    }

    update(dt, input, game) {
        // Calculate target angle based on pointer
        const pointerX = input.getPointerX();
        const pointerY = input.getPointerY();

        // Input decides extension
        this.isExtending = input.isPointerDown();

        if (this.isExtending) {
            this.tetherCurrentLength += 300 * dt;
            if (this.tetherCurrentLength > this.tetherMaxLength) {
                this.tetherCurrentLength = this.tetherMaxLength;
            }
        } else {
            this.tetherCurrentLength -= 500 * dt;
            if (this.tetherCurrentLength < this.tetherBaseLength) {
                this.tetherCurrentLength = this.tetherBaseLength;
            }
        }

        // Calculate dynamic angular velocity (longer = slower)
        const lengthFactor = (this.tetherCurrentLength - this.tetherBaseLength) / (this.tetherMaxLength - this.tetherBaseLength);
        const currentSpeed = this.baseAngularVelocity * (1 - lengthFactor * 0.7); // min speed is 30%

        this.tetherAngle += currentSpeed * dt;

        // Damage multiplier
        this.damageMultiplier = 1 + lengthFactor * 2; // Up to 3x damage
    }

    draw(ctx) {
        // Draw tether
        const endX = this.x + Math.cos(this.tetherAngle) * this.tetherCurrentLength;
        const endY = this.y + Math.sin(this.tetherAngle) * this.tetherCurrentLength;

        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Tether Head (The ball)
        ctx.beginPath();
        ctx.arc(endX, endY, 15, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT_COLOR;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Tower Base (Candy Processor)
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Health Bar
        const barWidth = 60;
        const barHeight = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 20, barWidth, barHeight);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(this.x - barWidth/2, this.y - this.radius - 20, barWidth * (this.health/this.maxHealth), barHeight);
    }

    getTetherHeadPos() {
        return {
            x: this.x + Math.cos(this.tetherAngle) * this.tetherCurrentLength,
            y: this.y + Math.sin(this.tetherAngle) * this.tetherCurrentLength,
            radius: 15
        };
    }
}

class Enemy {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.radius = 12;
        this.speed = 50 + Math.random() * 30;
        this.health = 10;
        this.maxHealth = 10;
        this.damage = 10;
        this.active = true;
    }

    update(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#555';
        ctx.fill();
        ctx.strokeStyle = '#f00';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

// --- MAIN ENGINE ---

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 800;
        this.height = 600;

        this.input = new InputManager(canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = STATES.TITLE;
        this.lastTime = 0;

        this.tower = null;
        this.enemies = [];
        this.score = 0;
        this.wave = 1;

        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;

        // Resize handling
        this.setupResize();

        // Pause handling
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === STATES.PLAYING) {
                this.state = STATES.PAUSED;
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === STATES.PLAYING) {
                this.state = STATES.PAUSED;
            }
        });
    }

    setupResize() {
        const resize = () => {
            const container = this.canvas.parentElement;
            const aspect = this.width / this.height;
            let newWidth = container.clientWidth;
            let newHeight = container.clientHeight;

            if (newWidth / newHeight > aspect) {
                newWidth = newHeight * aspect;
            } else {
                newHeight = newWidth / aspect;
            }

            this.canvas.style.width = `${newWidth}px`;
            this.canvas.style.height = `${newHeight}px`;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        };

        const observer = new ResizeObserver(resize);
        observer.observe(this.canvas.parentElement);
        resize();
    }

    resetGame() {
        this.tower = new Tower(this.width / 2, this.height / 2);
        this.enemies = [];
        this.score = 0;
        this.wave = 1;
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;
    }

    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(now) {
        let rawDt = (now - this.lastTime) / 1000;
        this.lastTime = now;

        // Cap dt to prevent huge leaps
        let dt = Math.min(rawDt, 0.1);

        this.update(dt);
        this.draw();

        this.input.update(); // clear justPressed flags
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.input.isPointerJustPressed() || this.input.keys['Space']) {
            this.sound.init();
        }

        switch (this.state) {
            case STATES.TITLE:
                if (this.input.isPointerJustPressed() || this.input.keys['Space']) {
                    this.resetGame();
                    this.state = STATES.PLAYING;
                    this.sound.playStart();
                }
                break;

            case STATES.PLAYING:
                if (this.input.keys['Escape']) {
                    this.input.keys['Escape'] = false;
                    this.state = STATES.PAUSED;
                }

                this.tower.update(dt, this.input, this);

                // Spawn enemies
                this.enemySpawnTimer += dt;
                if (this.enemySpawnTimer >= this.enemySpawnRate) {
                    this.enemySpawnTimer = 0;
                    this.spawnEnemy();
                    // slowly increase difficulty
                    this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.05);
                }

                // Update enemies & collisions
                const tetherHead = this.tower.getTetherHeadPos();

                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    let e = this.enemies[i];
                    e.update(dt);

                    // Check collision with tower
                    const distToTower = Math.hypot(e.x - this.tower.x, e.y - this.tower.y);
                    if (distToTower < e.radius + this.tower.radius) {
                        this.tower.health -= e.damage;
                        this.sound.playHit();
                        e.active = false;
                    }

                    // Check collision with tether head
                    const distToTether = Math.hypot(e.x - tetherHead.x, e.y - tetherHead.y);
                    if (distToTether < e.radius + tetherHead.radius) {
                        e.health -= 10 * this.tower.damageMultiplier;
                        if (e.health <= 0) {
                            e.active = false;
                            this.score += Math.floor(10 * this.tower.damageMultiplier);
                            this.sound.playExplosion();
                        } else {
                            this.sound.playHit();
                        }
                    }

                    // Also check collision with tether line (simple line-point distance)
                    // (Line segment distance)
                    const lDist = this.distToSegmentSquared(e, {x:this.tower.x, y:this.tower.y}, tetherHead);
                    if (lDist < e.radius * e.radius) {
                         // Line hits do less damage
                         e.health -= 20 * dt;
                         if (e.health <= 0) {
                            e.active = false;
                            this.score += 5;
                            this.sound.playExplosion();
                         }
                    }

                    if (!e.active) {
                        this.enemies.splice(i, 1);
                    }
                }

                if (this.tower.health <= 0) {
                    this.state = STATES.GAME_OVER;
                    this.sound.playOver();
                    this.saveManager.data.totalGamesPlayed++;
                    this.saveManager.data.totalScoreAccumulated += this.score;
                    if (this.score > this.saveManager.data.highScore) {
                        this.saveManager.data.highScore = this.score;
                    }
                    this.saveManager.save();
                }
                break;

            case STATES.PAUSED:
                if (this.input.keys['Escape'] || this.input.isPointerJustPressed()) {
                    this.input.keys['Escape'] = false;
                    this.state = STATES.PLAYING;
                }
                break;

            case STATES.GAME_OVER:
                if (this.input.isPointerJustPressed() || this.input.keys['Space']) {
                    this.state = STATES.TITLE;
                }
                break;
        }
    }

    // Helper for line collision
    distToSegmentSquared(p, v, w) {
        let l2 = (w.x - v.x)*(w.x - v.x) + (w.y - v.y)*(w.y - v.y);
        if (l2 === 0) return (p.x - v.x)*(p.x - v.x) + (p.y - v.y)*(p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return (p.x - (v.x + t * (w.x - v.x)))**2 + (p.y - (v.y + t * (w.y - v.y)))**2;
    }

    spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(this.width, this.height) * 0.7; // spawn outside screen
        const x = this.tower.x + Math.cos(angle) * dist;
        const y = this.tower.y + Math.sin(angle) * dist;
        this.enemies.push(new Enemy(x, y, this.tower));
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.width, this.height);

        switch (this.state) {
            case STATES.TITLE:
                this.drawTitle();
                break;
            case STATES.PLAYING:
                this.drawPlaying();
                break;
            case STATES.PAUSED:
                this.drawPlaying(); // draw background
                this.drawPaused();
                break;
            case STATES.GAME_OVER:
                this.drawPlaying(); // draw background
                this.drawGameOver();
                break;
        }
    }

    drawPlaying() {
        // Draw grid or background if needed
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i+= 50) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.height); this.ctx.stroke();
        }
        for (let i = 0; i < this.height; i+= 50) {
            this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(this.width, i); this.ctx.stroke();
        }

        this.tower.draw(this.ctx);
        for (let e of this.enemies) {
            e.draw(this.ctx);
        }

        // HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);
        this.ctx.fillText(`High: ${this.saveManager.data.highScore}`, 20, 70);
    }

    drawTitle() {
        this.ctx.fillStyle = ACCENT_COLOR;
        this.ctx.font = '48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Candy Tether Defense", this.width/2, this.height/3);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.fillText("Hold Mouse/Touch to extend tether", this.width/2, this.height/2);
        this.ctx.fillText("Click to Start", this.width/2, this.height/2 + 60);

        this.ctx.font = '16px monospace';
        this.ctx.fillText("Back to Arcade (../../index.html)", 70, 30);
    }

    drawPaused() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("PAUSED", this.width/2, this.height/2);

        this.ctx.font = '16px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText("Back to Arcade (../../index.html)", 70, 30);
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.font = '48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("GAME OVER", this.width/2, this.height/3);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.fillText(`Final Score: ${this.score}`, this.width/2, this.height/2);
        this.ctx.fillText("Click to Restart", this.width/2, this.height/2 + 60);
    }
}

// --- BOOT ---
window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
    window.game.start();
};
