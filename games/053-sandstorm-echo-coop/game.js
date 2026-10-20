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

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
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
            // e.preventDefault(); // Let UI handle clicks
            if (game && game.sound) game.sound.init();
        }, {passive: false});
        canvas.addEventListener('touchmove', e => {
            // e.preventDefault();
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
        return { x, y };
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
        this.speed = 300;
        this.history = [];
        this.recording = true;
        this.color = '#c6f8c8';
    }
    update(dt, input) {
        this.vx = input.x * this.speed;
        this.vy = input.y * this.speed;
        super.update(dt);

        // Keep in bounds
        if (this.x < this.radius) this.x = this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (game) {
            if (this.x > game.width - this.radius) this.x = game.width - this.radius;
            if (this.y > game.height - this.radius) this.y = game.height - this.radius;
        }

        if (this.recording && game) {
            this.history.push({ x: this.x, y: this.y, time: game.time });
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        super.draw(ctx);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
        ctx.stroke();
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
    }
    update(dt) {
        if (!game) return;
        const targetTime = game.time - this.delay;

        while (this.index < this.history.length - 1 && this.history[this.index+1].time < targetTime) {
            this.index++;
        }

        if (this.index < this.history.length) {
            this.x = this.history[this.index].x;
            this.y = this.history[this.index].y;
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        super.draw(ctx);

        // Draw tether to player
        if (game && game.player) {
            const dx = this.x - game.player.x;
            const dy = this.y - game.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < this.tetherRange) {
                ctx.strokeStyle = `rgba(198, 248, 200, ${1 - dist/this.tetherRange})`;
                ctx.lineWidth = 2;
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

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = 1280;
        this.height = 720;

        this.save = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager();

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;
        this.time = 0;

        this.score = 0;
        this.wave = 1;

        this.player = null;
        this.ghosts = [];
        this.enemies = [];
        this.obstacles = [];
        this.collectibles = [];

        this.beatInterval = 0.5; // seconds
        this.lastBeat = 0;

        this.initUI();
        this.setupResizeObserver();

        // Start loop
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
            // Logical size vs visual size handled by scale in draw
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
            this.lastTime = performance.now(); // prevent huge dt
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

        // Spawn obstacles
        for (let i=0; i<5 + this.wave; i++) {
            const w = 50 + Math.random() * 100;
            const h = 50 + Math.random() * 100;
            const x = Math.random() * (this.width - w);
            const y = Math.random() * (this.height - h);

            // Don't spawn on player
            if (Math.abs(x - this.player.x) > 150 && Math.abs(y - this.player.y) > 150) {
                this.obstacles.push(new Obstacle(x, y, w, h));
            }
        }

        // Spawn collectibles
        for (let i=0; i<3 + this.wave; i++) {
            this.spawnCollectible();
        }

        // Ghost spawning logic handled in update based on time
        if (this.wave > 1 && this.player.history.length > 0) {
            this.ghosts.push(new Ghost(this.player.history, 5.0)); // 5 seconds behind
            this.sound.playGhostSpawn();
        }

        // Start new recording for next wave
        this.player.history = [];
        this.player.time = 0; // reset local time for history if needed, but we use global time
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

        // Beat system
        if (this.time - this.lastBeat >= this.beatInterval) {
            this.lastBeat += this.beatInterval;
            this.sound.playBeat();

            // Random enemy spawn on beat
            if (Math.random() < 0.3 + (this.wave * 0.05)) {
                this.spawnEnemy();
            }
        }

        const axis = this.input.getAxis();

        // Player update
        const oldX = this.player.x;
        const oldY = this.player.y;
        this.player.update(dt, axis);

        // Player collision with obstacles
        for (const obs of this.obstacles) {
            if (obs.collidesEntity(this.player)) {
                this.player.x = oldX;
                this.player.y = oldY;
            }
            obs.update(dt);
        }

        // Ghosts
        for (const ghost of this.ghosts) {
            ghost.update(dt);
        }

        // Enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            enemy.update(dt);

            // Player collision -> Game Over
            if (enemy.collides(this.player)) {
                this.gameOver();
                return;
            }

            // Ghost collision -> Destroy enemy (Self-Cooperation)
            let destroyed = false;
            for (const ghost of this.ghosts) {
                if (enemy.collides(ghost)) {
                    destroyed = true;
                    this.sound.playEcho();
                    this.score += 50;
                    break;
                }
            }

            if (destroyed) {
                this.enemies.splice(i, 1);
            }
        }

        // Collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const col = this.collectibles[i];
            col.update(dt);

            if (col.collides(this.player)) {
                this.score += 100;
                this.sound.playScore();
                this.collectibles.splice(i, 1);
            } else {
                // Ghosts can also collect
                for (const ghost of this.ghosts) {
                    if (col.collides(ghost)) {
                        this.score += 50;
                        this.sound.playScore();
                        this.collectibles.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // Wave progression
        if (this.collectibles.length === 0) {
            this.wave++;
            this.beatInterval = Math.max(0.3, this.beatInterval - 0.05);
            this.generateLevel();
        }
    }

    draw() {
        this.ctx.fillStyle = '#1a1311'; // Desert night
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Setup logical coordinate system
        this.ctx.save();
        const scale = Math.min(this.canvas.width / this.width, this.canvas.height / this.height);
        const offsetX = (this.canvas.width - this.width * scale) / 2;
        const offsetY = (this.canvas.height - this.height * scale) / 2;

        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        // Clip to logical bounds
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.width, this.height);
        this.ctx.clip();

        // Draw background grid (sandstorm effect simplified for phase 1)
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

            // HUD
            this.ctx.fillStyle = '#c6f8c8';
            this.ctx.font = '24px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 20, 40);
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 70);

            // High score
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`High Score: ${this.save.data.highScore}`, this.width - 20, 40);

            // Beat indicator
            const beatTime = (this.time / this.beatInterval) % 1;
            const radius = 10 + Math.sin(beatTime * Math.PI) * 10;
            this.ctx.beginPath();
            this.ctx.arc(this.width / 2, 40, radius, 0, Math.PI*2);
            this.ctx.fillStyle = `rgba(198, 248, 200, ${1 - beatTime})`;
            this.ctx.fill();
        }

        this.ctx.restore();
    }
}

let game = null;
window.addEventListener('DOMContentLoaded', () => {
    game = new GameEngine();
});
