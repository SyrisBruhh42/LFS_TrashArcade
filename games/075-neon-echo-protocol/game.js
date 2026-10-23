// part1.js: Utilities, Constants, SaveManager, SoundEngine
const SAVE_KEY = 'arcade_game_075_075-neon-echo-protocol_v1';

class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mul(s) { return new Vector2(this.x * s, this.y * s); }
    div(s) { return new Vector2(this.x / s, this.y / s); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    magSq() { return this.x * this.x + this.y * this.y; }
    norm() {
        let m = this.mag();
        return m === 0 ? new Vector2(0, 0) : this.div(m);
    }
    copy() { return new Vector2(this.x, this.y); }
    dist(v) { return this.sub(v).mag(); }
    static distSq(v1, v2) {
        const dx = v1.x - v2.x;
        const dy = v1.y - v2.y;
        return dx * dx + dy * dy;
    }
}

class Rect {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }
    contains(p) {
        return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
    }
    intersect(r) {
        return this.x < r.x + r.w && this.x + this.w > r.x &&
               this.y < r.y + r.h && this.y + this.h > r.y;
    }
}

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
                const parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) {
            console.warn("Could not load save data", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Could not save data", e);
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
    }
    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.masterGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);

        this.masterGain.gain.value = 1.0;
        this.sfxGain.gain.value = 0.8;
        this.musicGain.gain.value = 0.5;
        this.initialized = true;
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playTone(freq, type, duration, vol=1) {
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
    shoot() { this.playTone(400, 'square', 0.1, 0.5); }
    hit() { this.playTone(150, 'sawtooth', 0.15, 0.5); }
    echoSpawn() { this.playTone(800, 'sine', 0.3, 0.4); }
    gameOver() { this.playTone(100, 'sawtooth', 1.0, 0.8); }
    start() { this.playTone(600, 'square', 0.2, 0.5); setTimeout(() => this.playTone(800, 'square', 0.3, 0.5), 200); }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touches = [];
        this.leftStick = { active: false, id: null, base: new Vector2(), pos: new Vector2(), dir: new Vector2() };
        this.rightStick = { active: false, id: null, base: new Vector2(), pos: new Vector2(), dir: new Vector2() };

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', e => {
            this.mouse.down = true;
            if(window.game && window.game.sound) { window.game.sound.init(); window.game.sound.resume(); }
        });
        window.addEventListener('mouseup', e => this.mouse.down = false);

        // Touch events
        const handleTouch = (e) => {
            e.preventDefault();
            this.touches = Array.from(e.touches);
            if(window.game && window.game.sound) { window.game.sound.init(); window.game.sound.resume(); }
            this.updateSticks(e);
        };
        window.addEventListener('touchstart', handleTouch, {passive: false});
        window.addEventListener('touchmove', handleTouch, {passive: false});
        window.addEventListener('touchend', e => {
            handleTouch(e);
            this.endSticks(e);
        }, {passive: false});
        window.addEventListener('touchcancel', e => {
            handleTouch(e);
            this.endSticks(e);
        }, {passive: false});
    }

    updateSticks(e) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (e.type === 'touchstart') {
                if (t.clientX < w / 2 && !this.leftStick.active) {
                    this.leftStick.active = true;
                    this.leftStick.id = t.identifier;
                    this.leftStick.base = new Vector2(t.clientX, t.clientY);
                    this.leftStick.pos = new Vector2(t.clientX, t.clientY);
                } else if (t.clientX >= w / 2 && !this.rightStick.active) {
                    this.rightStick.active = true;
                    this.rightStick.id = t.identifier;
                    this.rightStick.base = new Vector2(t.clientX, t.clientY);
                    this.rightStick.pos = new Vector2(t.clientX, t.clientY);
                }
            }
        }
        for (let i = 0; i < e.touches.length; i++) {
            const t = e.touches[i];
            if (this.leftStick.active && t.identifier === this.leftStick.id) {
                this.leftStick.pos = new Vector2(t.clientX, t.clientY);
                this.leftStick.dir = this.leftStick.pos.sub(this.leftStick.base);
                if (this.leftStick.dir.mag() > 50) this.leftStick.dir = this.leftStick.dir.norm().mul(50);
            }
            if (this.rightStick.active && t.identifier === this.rightStick.id) {
                this.rightStick.pos = new Vector2(t.clientX, t.clientY);
                this.rightStick.dir = this.rightStick.pos.sub(this.rightStick.base);
                if (this.rightStick.dir.mag() > 50) this.rightStick.dir = this.rightStick.dir.norm().mul(50);
            }
        }
    }

    endSticks(e) {
        let leftStillActive = false;
        let rightStillActive = false;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === this.leftStick.id) leftStillActive = true;
            if (e.touches[i].identifier === this.rightStick.id) rightStillActive = true;
        }
        if (!leftStillActive) {
            this.leftStick.active = false;
            this.leftStick.id = null;
            this.leftStick.dir = new Vector2();
        }
        if (!rightStillActive) {
            this.rightStick.active = false;
            this.rightStick.id = null;
            this.rightStick.dir = new Vector2();
        }
    }

    getMovement() {
        let x = 0, y = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;
        let v = new Vector2(x, y);
        if (v.mag() > 0) return v.norm();
        if (this.leftStick.active && this.leftStick.dir.mag() > 10) {
            return this.leftStick.dir.norm();
        }
        return new Vector2();
    }

    getAim(playerPos, canvasTransform) {
        if (this.rightStick.active && this.rightStick.dir.mag() > 10) {
            return this.rightStick.dir.norm();
        }
        if (this.keys['ArrowUp'] && !this.keys['KeyW']) return new Vector2(0, -1);
        if (this.keys['ArrowDown'] && !this.keys['KeyS']) return new Vector2(0, 1);
        if (this.keys['ArrowLeft'] && !this.keys['KeyA']) return new Vector2(-1, 0);
        if (this.keys['ArrowRight'] && !this.keys['KeyD']) return new Vector2(1, 0);

        if (this.mouse.down) {
            const dx = this.mouse.x - canvasTransform.x;
            const dy = this.mouse.y - canvasTransform.y;
            return new Vector2(dx, dy).norm();
        }
        return null;
    }
}

// part2.js: Game Entities (Player, Echo, Bullet, Enemy, Core)

class Player {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2();
        this.speed = 200;
        this.radius = 12;
        this.color = '#00ffff';
        this.shootTimer = 0;
        this.shootCooldown = 0.15;
        this.history = []; // Array of {t: time, pos: Vector2, shootDir: Vector2|null}
        this.recordingTime = 0;
    }
    update(dt, input, game) {
        let move = input.getMovement();
        this.vel = move.mul(this.speed);
        this.pos = this.pos.add(this.vel.mul(dt));

        // Boundaries
        this.pos.x = Math.max(this.radius, Math.min(game.width - this.radius, this.pos.x));
        this.pos.y = Math.max(this.radius, Math.min(game.height - this.radius, this.pos.y));

        let aim = input.getAim(this.pos, {
            x: game.canvas.width/2 + (this.pos.x - game.camera.x),
            y: game.canvas.height/2 + (this.pos.y - game.camera.y)
        });

        let shootDir = null;
        if (this.shootTimer > 0) this.shootTimer -= dt;
        if ((aim || input.keys['Space']) && this.shootTimer <= 0) {
            shootDir = aim || (this.vel.mag() > 0 ? this.vel.norm() : new Vector2(1, 0));
            game.spawnBullet(this.pos.copy(), shootDir, true);
            this.shootTimer = this.shootCooldown;
            game.sound.shoot();
        }

        if (game.isRecording) {
            this.recordingTime += dt;
            this.history.push({
                t: this.recordingTime,
                pos: this.pos.copy(),
                shootDir: shootDir
            });
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class Echo {
    constructor(history, color) {
        this.history = history; // Copy of player history
        this.color = color;
        this.pos = history.length > 0 ? history[0].pos.copy() : new Vector2();
        this.radius = 12;
        this.time = 0;
        this.index = 0;
        this.active = true;
    }
    update(dt, game) {
        if (!this.active || this.history.length === 0) return;
        this.time += dt;

        while (this.index < this.history.length - 1 && this.history[this.index + 1].t <= this.time) {
            this.index++;
            let frame = this.history[this.index];
            if (frame.shootDir) {
                game.spawnBullet(frame.pos.copy(), frame.shootDir, true, this.color);
            }
        }

        if (this.index < this.history.length) {
            this.pos = this.history[this.index].pos.copy();
        } else {
            // Loop or disappear? Let's have them fade out or disappear after replay
            this.active = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.6;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, dir, isPlayer, color) {
        this.pos = new Vector2(x, y);
        this.dir = dir;
        this.speed = 400;
        this.isPlayer = isPlayer;
        this.color = color || (isPlayer ? '#00ffff' : '#ff0055');
        this.radius = 4;
        this.active = true;
    }
    update(dt, game) {
        this.pos = this.pos.add(this.dir.mul(this.speed * dt));
        if (this.pos.x < 0 || this.pos.x > game.width || this.pos.y < 0 || this.pos.y > game.height) {
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, type) {
        this.pos = new Vector2(x, y);
        this.type = type;
        this.radius = type === 'big' ? 18 : 10;
        this.hp = type === 'big' ? 30 : 10;
        this.maxHp = this.hp;
        this.speed = type === 'big' ? 40 : 80;
        this.color = type === 'big' ? '#ffaa00' : '#ff0055';
        this.active = true;
        this.value = type === 'big' ? 50 : 10;
    }
    update(dt, game) {
        let target = game.core.pos;
        let dir = target.sub(this.pos).norm();
        this.pos = this.pos.add(dir.mul(this.speed * dt));

        if (this.pos.dist(game.core.pos) < this.radius + game.core.radius) {
            game.core.takeDamage(this.hp);
            this.active = false;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.strokeStyle = this.color;
        ctx.fillStyle = '#0b0b1a';
        ctx.lineWidth = 2;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        if (this.type === 'big') {
            ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        } else {
            ctx.moveTo(0, -this.radius);
            ctx.lineTo(this.radius, this.radius);
            ctx.lineTo(-this.radius, this.radius);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();

        // HP bar
        if (this.hp < this.maxHp) {
            ctx.fillStyle = 'red';
            ctx.fillRect(-this.radius, -this.radius - 8, this.radius * 2, 4);
            ctx.fillStyle = 'green';
            ctx.fillRect(-this.radius, -this.radius - 8, (this.radius * 2) * (this.hp / this.maxHp), 4);
        }

        ctx.restore();
    }
}

class Core {
    constructor(x, y) {
        this.pos = new Vector2(x, y);
        this.radius = 30;
        this.maxHp = 100;
        this.hp = this.maxHp;
        this.color = '#ff62ac';
    }
    takeDamage(amount) {
        this.hp -= amount;
        if(window.game) window.game.sound.hit();
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20 + Math.sin(Date.now() / 200) * 10;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = 'red';
        ctx.fillRect(-this.radius, -this.radius - 15, this.radius * 2, 6);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(-this.radius, -this.radius - 15, (this.radius * 2) * Math.max(0, this.hp / this.maxHp), 6);
        ctx.restore();
    }
}

// part3.js: Main Game Class

class Particle {
    constructor(x, y, color) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2((Math.random() - 0.5) * 100, (Math.random() - 0.5) * 100);
        this.life = 0.5 + Math.random() * 0.5;
        this.maxLife = this.life;
        this.color = color;
        this.active = true;
    }
    update(dt) {
        this.pos = this.pos.add(this.vel.mul(dt));
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.pos.x - 2, this.pos.y - 2, 4, 4);
        ctx.globalAlpha = 1;
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        this.camera = { x: 0, y: 0 };

        this.input = new InputManager();
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.score = 0;
        this.wave = 1;

        this.player = null;
        this.core = null;
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.echoes = [];

        this.isRecording = false;
        this.echoCooldown = 0;
        this.echoColors = ['#ff00ff', '#00ff00', '#ffff00'];
        this.currentEchoColor = 0;

        this.spawnTimer = 0;

        this.lastTime = performance.now();

        this.resize();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.canvas.parentElement || document.body);

        window.addEventListener('resize', () => this.resize());

        // Ensure keys trigger things
        window.addEventListener('keydown', (e) => {
            if (this.state === 'TITLE' && e.code === 'Enter') {
                this.sound.init();
                this.sound.resume();
                this.sound.start();
                this.resetGame();
                this.state = 'PLAYING';
            } else if (this.state === 'PLAYING' && e.code === 'KeyP') {
                this.state = 'PAUSED';
            } else if (this.state === 'PAUSED' && e.code === 'KeyP') {
                this.state = 'PLAYING';
            } else if (this.state === 'GAME_OVER' && e.code === 'Enter') {
                this.state = 'TITLE';
            } else if (this.state === 'PLAYING' && e.code === 'KeyE') {
                this.deployEcho();
            }
        });

        // Touch to start
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.state === 'TITLE') {
                this.sound.init();
                this.sound.resume();
                this.sound.start();
                this.resetGame();
                this.state = 'PLAYING';
            } else if (this.state === 'GAME_OVER') {
                this.state = 'TITLE';
            }
        }, {passive: false});

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        let aspect = this.width / this.height;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > aspect) {
            this.canvas.height = h;
            this.canvas.width = h * aspect;
        } else {
            this.canvas.width = w;
            this.canvas.height = w / aspect;
        }
    }

    resetGame() {
        this.player = new Player(this.width/2 + 100, this.height/2);
        this.core = new Core(this.width/2, this.height/2);
        this.bullets = [];
        this.enemies = [];
        this.particles = [];
        this.echoes = [];
        this.score = 0;
        this.wave = 1;
        this.isRecording = true; // Always recording in phase 1
        this.echoCooldown = 0;
    }

    deployEcho() {
        if (this.echoCooldown > 0) return;
        if (this.player.history.length === 0) return;

        let color = this.echoColors[this.currentEchoColor % this.echoColors.length];
        this.currentEchoColor++;

        // Deep copy history
        let historyCopy = this.player.history.map(h => ({t: h.t, pos: h.pos.copy(), shootDir: h.shootDir ? h.shootDir.copy() : null}));

        this.echoes.push(new Echo(historyCopy, color));

        // Reset player recording
        this.player.history = [];
        this.player.recordingTime = 0;

        this.echoCooldown = 10; // 10 seconds cooldown
        this.sound.echoSpawn();
    }

    spawnBullet(pos, dir, isPlayer, color) {
        this.bullets.push(new Bullet(pos.x, pos.y, dir, isPlayer, color));
    }

    spawnParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    loop(time) {
        let dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        if (this.echoCooldown > 0) this.echoCooldown -= dt;

        this.player.update(dt, this.input, this);

        // Camera follow core, static for now
        this.camera.x = 0;
        this.camera.y = 0;

        this.echoes.forEach(e => e.update(dt, this));
        this.echoes = this.echoes.filter(e => e.active);

        this.bullets.forEach(b => b.update(dt, this));

        // Wave spawning
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            let side = Math.floor(Math.random() * 4);
            let ex, ey;
            if (side === 0) { ex = Math.random() * this.width; ey = -20; }
            else if (side === 1) { ex = this.width + 20; ey = Math.random() * this.height; }
            else if (side === 2) { ex = Math.random() * this.width; ey = this.height + 20; }
            else { ex = -20; ey = Math.random() * this.height; }

            let type = Math.random() > 0.8 ? 'big' : 'normal';
            this.enemies.push(new Enemy(ex, ey, type));

            this.spawnTimer = Math.max(0.5, 2.0 - this.wave * 0.1);
        }

        this.enemies.forEach(e => e.update(dt, this));

        // Collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            let b = this.bullets[i];
            if (!b.active) continue;

            if (b.isPlayer) {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    let e = this.enemies[j];
                    if (!e.active) continue;
                    if (b.pos.dist(e.pos) < b.radius + e.radius) {
                        e.hp -= 10;
                        b.active = false;
                        this.spawnParticles(b.pos.x, b.pos.y, '#ffffff', 5);
                        this.sound.hit();
                        if (e.hp <= 0) {
                            e.active = false;
                            this.score += e.value;
                            this.spawnParticles(e.pos.x, e.pos.y, e.color, 15);
                            if (this.score > this.wave * 200) {
                                this.wave++;
                            }
                        }
                        break;
                    }
                }
            } else {
                if (b.pos.dist(this.player.pos) < b.radius + this.player.radius) {
                    this.core.takeDamage(5);
                    b.active = false;
                }
            }
        }

        this.bullets = this.bullets.filter(b => b.active);
        this.enemies = this.enemies.filter(e => e.active);

        this.particles.forEach(p => p.update(dt));
        this.particles = this.particles.filter(p => p.active);

        if (this.core.hp <= 0) {
            this.state = 'GAME_OVER';
            this.sound.gameOver();
            if (this.score > this.saveManager.data.highScore) {
                this.saveManager.data.highScore = this.score;
            }
            this.saveManager.save();
        }
    }

    draw() {
        this.ctx.fillStyle = '#0b0b1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        this.ctx.scale(this.canvas.width / this.width, this.canvas.height / this.height);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Grid background
        this.ctx.strokeStyle = 'rgba(255, 98, 172, 0.1)';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.width; x += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
        }
        for (let y = 0; y < this.height; y += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
        }

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            this.core.draw(this.ctx);
            this.echoes.forEach(e => e.draw(this.ctx));
            if (this.state !== 'GAME_OVER') {
                this.player.draw(this.ctx);
            }
            this.enemies.forEach(e => e.draw(this.ctx));
            this.bullets.forEach(b => b.draw(this.ctx));
            this.particles.forEach(p => p.draw(this.ctx));

            // HUD
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.font = '20px Courier New';
            this.ctx.fillText(`SCORE: ${this.score}`, 10, 30);
            this.ctx.fillText(`WAVE: ${this.wave}`, 10, 60);

            if (this.echoCooldown <= 0) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.fillText(`ECHO READY (Press E / Deploy button)`, this.width/2 - 150, 30);
            } else {
                this.ctx.fillStyle = 'red';
                this.ctx.fillText(`ECHO COOLDOWN: ${Math.ceil(this.echoCooldown)}s`, this.width/2 - 100, 30);
            }

            // Draw Virtual Joysticks if active
            this.drawJoysticks();
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('NEON ECHO PROTOCOL', this.width/2, this.height/2 - 50);
            this.ctx.font = '20px Courier New';
            this.ctx.fillText('Press ENTER or Tap to Start', this.width/2, this.height/2 + 20);
            this.ctx.fillText('WASD/Arrows to Move, Mouse/Arrows to Aim/Shoot', this.width/2, this.height/2 + 60);
            this.ctx.fillText('Press E to deploy an Echo of your past actions', this.width/2, this.height/2 + 90);
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('PAUSED', this.width/2, this.height/2);
            this.ctx.font = '20px Courier New';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height/2 + 40);
        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(11, 11, 26, 0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#ff0055';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px Courier New';
            this.ctx.fillText('CORE DESTROYED', this.width/2, this.height/2 - 50);
            this.ctx.fillStyle = '#ff62ac';
            this.ctx.font = '20px Courier New';
            this.ctx.fillText(`FINAL SCORE: ${this.score}`, this.width/2, this.height/2);
            this.ctx.fillText(`HIGH SCORE: ${this.saveManager.data.highScore}`, this.width/2, this.height/2 + 30);
            this.ctx.fillText('Press ENTER or Tap to Return to Title', this.width/2, this.height/2 + 70);
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height/2 + 110);
        }

        this.ctx.textAlign = 'left';
        this.ctx.restore();
    }

    drawJoysticks() {
        if (this.input.leftStick.active) {
            this.ctx.beginPath();
            this.ctx.arc(this.input.leftStick.base.x * (this.width / this.canvas.width), this.input.leftStick.base.y * (this.height / this.canvas.height), 50, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(this.input.leftStick.pos.x * (this.width / this.canvas.width), this.input.leftStick.pos.y * (this.height / this.canvas.height), 20, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
        }
        if (this.input.rightStick.active) {
            this.ctx.beginPath();
            this.ctx.arc(this.input.rightStick.base.x * (this.width / this.canvas.width), this.input.rightStick.base.y * (this.height / this.canvas.height), 50, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            this.ctx.beginPath();
            this.ctx.arc(this.input.rightStick.pos.x * (this.width / this.canvas.width), this.input.rightStick.pos.y * (this.height / this.canvas.height), 20, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
        }

        // Touch button for echo if touch is active
        if (this.input.touches.length > 0) {
            this.ctx.fillStyle = this.echoCooldown <= 0 ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(this.width/2 - 40, this.height - 80, 80, 60);
            this.ctx.fillStyle = 'white';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('ECHO', this.width/2, this.height - 45);
            this.ctx.textAlign = 'left';

            // Basic touch check for button
            for(let t of this.input.touches) {
                let tx = t.clientX * (this.width / this.canvas.width);
                let ty = t.clientY * (this.height / this.canvas.height);
                if (tx > this.width/2 - 40 && tx < this.width/2 + 40 && ty > this.height - 80 && ty < this.height - 20) {
                    if (this.echoCooldown <= 0) {
                        this.deployEcho();
                    }
                }
            }
        }
    }
}

window.onload = () => {
    window.game = new Game();
};
