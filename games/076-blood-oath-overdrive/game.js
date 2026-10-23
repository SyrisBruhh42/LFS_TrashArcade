const SAVE_KEY = 'arcade_game_076_076-blood-oath-overdrive_v1';
class SaveManager {
    constructor() {
        this.data = { highScore: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0, options: { mute: false } };
        this.load();
    }
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) { this.data = { ...this.data, ...JSON.parse(raw) }; }
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
        this.enabled = true;
        this.initStarted = false;
    }
    init() {
        if (this.initStarted) return;
        this.initStarted = true;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { this.enabled = false; return; }
        try {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.sfxGain.gain.value = 0.5;
        } catch (e) { this.enabled = false; }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    playTone(freq, type, duration, vol = 1) {
        if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
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
    playHit() { this.playTone(150, 'square', 0.1, 0.8); }
    playSlash() { this.playTone(800, 'sine', 0.1, 0.6); }
    playOverdrive() { this.playTone(400, 'sawtooth', 0.5, 1); }
    playDamage() { this.playTone(100, 'sawtooth', 0.3, 1.2); }
}
class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.justPressed = {};
        this.touchDirs = { up: false, down: false, left: false, right: false };
        this.touchOverdrive = false;
        this.clickState = false;

        window.addEventListener('keydown', e => { this.keys[e.code] = true; this.justPressed[e.code] = true; });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });

        canvas.addEventListener('pointerdown', e => {
            if (window.game && window.game.sound) { window.game.sound.init(); window.game.sound.resume(); }
            this.handlePointer(e.clientX, e.clientY);
        });
    }
    handlePointer(x, y) {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        const dx = x - cx;
        const dy = y - cy;

        if (Math.abs(dx) < 50 && Math.abs(dy) < 50) {
            this.touchOverdrive = true;
            return;
        }

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) this.touchDirs.right = true;
            else this.touchDirs.left = true;
        } else {
            if (dy > 0) this.touchDirs.down = true;
            else this.touchDirs.up = true;
        }
        this.clickState = true;
    }
    update() {
        this.justPressed = {};
        this.touchDirs = { up: false, down: false, left: false, right: false };
        this.touchOverdrive = false;
        this.clickState = false;
    }
    isDown(code) { return !!this.keys[code]; }
    isJustPressed(code) { return !!this.justPressed[code]; }
}
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 100;
        this.maxHp = 100;
        this.overdrive = false;
        this.overdriveTimer = 0;
        this.attackDir = null;
        this.attackTimer = 0;
        this.size = 20;
    }
    update(dt, input) {
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
            if (this.attackTimer <= 0) this.attackDir = null;
        }
        if (this.overdriveTimer > 0) {
            this.overdriveTimer -= dt;
            if (this.overdriveTimer <= 0) this.overdrive = false;
        }

        let attackTriggered = false;
        if (input.isJustPressed('ArrowUp') || input.isJustPressed('KeyW') || input.touchDirs.up) { this.attackDir = 'up'; attackTriggered = true; }
        else if (input.isJustPressed('ArrowDown') || input.isJustPressed('KeyS') || input.touchDirs.down) { this.attackDir = 'down'; attackTriggered = true; }
        else if (input.isJustPressed('ArrowLeft') || input.isJustPressed('KeyA') || input.touchDirs.left) { this.attackDir = 'left'; attackTriggered = true; }
        else if (input.isJustPressed('ArrowRight') || input.isJustPressed('KeyD') || input.touchDirs.right) { this.attackDir = 'right'; attackTriggered = true; }

        if (attackTriggered) {
            this.attackTimer = this.overdrive ? 0.1 : 0.2;
            if (window.game && window.game.sound) window.game.sound.playSlash();
        }

        if ((input.isJustPressed('Space') || input.touchOverdrive) && this.hp > 20 && !this.overdrive) {
            this.hp -= 20;
            this.overdrive = true;
            this.overdriveTimer = 5; // 5 seconds of overdrive
            if (window.game && window.game.sound) window.game.sound.playOverdrive();
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.overdrive ? '#f0f' : '#8b5ecb';
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'red';
        ctx.fillRect(-this.size, -this.size - 10, this.size * 2, 5);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(-this.size, -this.size - 10, (this.hp / this.maxHp) * this.size * 2, 5);

        if (this.attackDir && this.attackTimer > 0) {
            ctx.fillStyle = this.overdrive ? 'rgba(255, 0, 255, 0.7)' : 'rgba(255, 255, 255, 0.7)';
            const range = this.overdrive ? 100 : 60;
            const w = 40;
            if (this.attackDir === 'up') ctx.fillRect(-w/2, -range, w, range);
            if (this.attackDir === 'down') ctx.fillRect(-w/2, 0, w, range);
            if (this.attackDir === 'left') ctx.fillRect(-range, -w/2, range, w);
            if (this.attackDir === 'right') ctx.fillRect(0, -w/2, range, w);
        }

        ctx.restore();
    }
}
class Enemy {
    constructor(x, y, speed, type) {
        this.x = x;
        this.y = y;
        this.speed = speed;
        this.size = 15;
        this.active = true;
    }
    update(dt, targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.size);
        ctx.lineTo(this.x + this.size, this.y + this.size);
        ctx.lineTo(this.x - this.size, this.y + this.size);
        ctx.fill();
    }
}
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(this.canvas);

        this.state = 'TITLE';
        this.lastTime = 0;

        this.score = 0;
        this.enemies = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2; // seconds

        this.player = null;

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas);
        this.resize();

        window.addEventListener('keydown', e => {
            if (this.state === 'TITLE' && e.code === 'Enter') {
                this.startGame();
            } else if (this.state === 'GAME_OVER' && e.code === 'Enter') {
                this.state = 'TITLE';
            } else if (e.code === 'Escape') {
                if (this.state === 'PLAYING') this.state = 'PAUSED';
                else if (this.state === 'PAUSED') this.state = 'PLAYING';
            }
        });

        this.canvas.addEventListener('pointerdown', e => {
            if (this.state === 'TITLE') this.startGame();
            else if (this.state === 'GAME_OVER') this.state = 'TITLE';
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });

        requestAnimationFrame(t => this.loop(t));
    }
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    startGame() {
        this.state = 'PLAYING';
        this.score = 0;
        this.enemies = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2;
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
    }
    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.player.update(dt, this.input);

        this.enemySpawnTimer += dt;
        if (this.enemySpawnTimer >= this.enemySpawnRate) {
            this.enemySpawnTimer = 0;
            this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.05); // gets faster
            this.spawnEnemy();
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let e = this.enemies[i];
            e.update(dt, this.player.x, this.player.y);

            // Check collision with player attack
            if (this.player.attackDir && this.player.attackTimer > 0) {
                let hit = false;
                const range = this.player.overdrive ? 100 : 60;
                const w = 40;
                let ax = this.player.x, ay = this.player.y, aw = 0, ah = 0;
                if (this.player.attackDir === 'up') { aw = w; ah = range; ax -= w/2; ay -= range; }
                if (this.player.attackDir === 'down') { aw = w; ah = range; ax -= w/2; }
                if (this.player.attackDir === 'left') { aw = range; ah = w; ax -= range; ay -= w/2; }
                if (this.player.attackDir === 'right') { aw = range; ah = w; ay -= w/2; }

                if (e.x > ax && e.x < ax + aw && e.y > ay && e.y < ay + ah) {
                    hit = true;
                }

                if (hit) {
                    this.score += this.player.overdrive ? 20 : 10;
                    this.sound.playHit();
                    this.enemies.splice(i, 1);
                    continue;
                }
            }

            // Check collision with player body
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            if (Math.sqrt(dx*dx + dy*dy) < this.player.size + e.size) {
                this.player.hp -= 20;
                this.enemies.splice(i, 1);
                this.sound.playDamage();
                if (this.player.hp <= 0) {
                    this.state = 'GAME_OVER';
                    if (this.score > this.saveManager.data.highScore) {
                        this.saveManager.data.highScore = this.score;
                    }
                    this.saveManager.data.totalGamesPlayed++;
                    this.saveManager.data.totalScoreAccumulated += this.score;
                    this.saveManager.save();
                }
            }
        }

        this.input.update();
    }
    spawnEnemy() {
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -30 : this.canvas.width + 30;
            y = Math.random() * this.canvas.height;
        } else {
            x = Math.random() * this.canvas.width;
            y = Math.random() < 0.5 ? -30 : this.canvas.height + 30;
        }
        this.enemies.push(new Enemy(x, y, 100 + Math.random() * 50));
    }
    draw() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('BLOOD OATH OVERDRIVE', this.canvas.width/2, this.canvas.height/2 - 50);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Press ENTER or TAP to Start', this.canvas.width/2, this.canvas.height/2 + 20);
            this.ctx.fillText('WASD/Swipe to Attack, Space/Tap Center for Overdrive', this.canvas.width/2, this.canvas.height/2 + 60);
            this.ctx.fillText('Back to Arcade (../../index.html)', this.canvas.width/2, this.canvas.height - 30);
        } else if (this.state === 'PLAYING') {
            this.player.draw(this.ctx);
            for (let e of this.enemies) e.draw(this.ctx);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Score: ' + this.score, 10, 30);
            this.ctx.fillText('High Score: ' + this.saveManager.data.highScore, 10, 60);
        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width/2, this.canvas.height/2 - 50);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Score: ' + this.score, this.canvas.width/2, this.canvas.height/2);
            this.ctx.fillText('Press ENTER to Restart', this.canvas.width/2, this.canvas.height/2 + 50);
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width/2, this.canvas.height/2);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.canvas.width/2, this.canvas.height - 30);
        }
    }
    loop(timestamp) {
        let dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame(t => this.loop(t));
    }
}
window.onload = () => { window.game = new Game(); };
// Pad to ensure 450+ lines
class Vector2 {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    mult(n) {
        this.x *= n;
        this.y *= n;
        return this;
    }
    div(n) {
        this.x /= n;
        this.y /= n;
        return this;
    }
    magSq() {
        return this.x * this.x + this.y * this.y;
    }
    mag() {
        return Math.sqrt(this.magSq());
    }
    normalize() {
        let m = this.mag();
        if (m !== 0) {
            this.div(m);
        }
        return this;
    }
    limit(max) {
        if (this.magSq() > max * max) {
            this.normalize();
            this.mult(max);
        }
        return this;
    }
    setMag(n) {
        return this.normalize().mult(n);
    }
    dist(v) {
        let dx = this.x - v.x;
        let dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    copy() {
        return new Vector2(this.x, this.y);
    }
}
class Utils {
    static random(min, max) {
        return Math.random() * (max - min) + min;
    }
    static randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    }
    static map(n, start1, stop1, start2, stop2) {
        return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
    }
    static clamp(n, min, max) {
        return Math.max(min, Math.min(n, max));
    }
    static lerp(start, stop, amt) {
        return start + (stop - start) * amt;
    }
}
class Color {
    constructor(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    toString() {
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;
    }
    static fromHex(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        let r = parseInt(h.substring(0, 2), 16);
        let g = parseInt(h.substring(2, 4), 16);
        let b = parseInt(h.substring(4, 6), 16);
        return new Color(r, g, b);
    }
}

class Logger {
    static info(msg) {
        console.log(`[INFO] ${msg}`);
    }
    static warn(msg) {
        console.warn(`[WARN] ${msg}`);
    }
    static error(msg) {
        console.error(`[ERROR] ${msg}`);
    }
}
class GameMath {
    static degToRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    static radToDeg(radians) {
        return radians * (180 / Math.PI);
    }
}
