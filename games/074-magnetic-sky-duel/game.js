const SAVE_KEY = 'arcade_game_074_074-magnetic-sky-duel_v1';
const ACCENT_COLOR = '#7751ef';

class MathUtils {
    static clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
    static rand(min, max) { return Math.random() * (max - min) + min; }
    static randInt(min, max) { return Math.floor(this.rand(min, max + 1)); }
    static distSq(x1, y1, x2, y2) { return (x2-x1)*(x2-x1) + (y2-y1)*(y2-y1); }
    static lerp(a, b, t) { return a + (b - a) * t; }
}

class Vector2 {
    constructor(x=0, y=0) { this.x = x; this.y = y; }
    set(x, y) { this.x = x; this.y = y; return this; }
    add(v) { this.x += v.x; this.y += v.y; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; return this; }
    mult(s) { this.x *= s; this.y *= s; return this; }
    magSq() { return this.x*this.x + this.y*this.y; }
    mag() { return Math.sqrt(this.magSq()); }
    normalize() { let m = this.mag(); if(m > 0) { this.x /= m; this.y /= m; } return this; }
    clone() { return new Vector2(this.x, this.y); }
}

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { sfxVolume: 1, musicVolume: 1 }
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
            console.error("SaveManager load error", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("SaveManager save error", e);
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
    playTone(freq, type, duration, vol=0.1) {
        if (!this.initialized || !this.ctx) return;
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

        setTimeout(() => {
            osc.disconnect();
            gain.disconnect();
        }, duration * 1000 + 100);
    }
    playShoot(isRed) {
        this.playTone(isRed ? 600 : 400, 'square', 0.1, 0.05);
    }
    playHit() {
        this.playTone(150, 'sawtooth', 0.2, 0.1);
    }
    playExplosion() {
        this.playTone(100, 'square', 0.5, 0.15);
    }
    playSwitch() {
        this.playTone(800, 'sine', 0.1, 0.05);
    }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.justPressed = {};
        this.pointers = {};
        this.touchMove = new Vector2();
        this.touchActive = false;

        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) this.justPressed[e.code] = true;
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        canvas.addEventListener('pointerdown', (e) => {
            this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            this.touchActive = true;
            this.touchMove.set(e.clientX, e.clientY);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (this.pointers[e.pointerId]) {
                this.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
                this.touchMove.set(e.clientX, e.clientY);
            }
        });
        const handleUp = (e) => {
            delete this.pointers[e.pointerId];
            if (Object.keys(this.pointers).length === 0) {
                this.touchActive = false;
            }
        };
        canvas.addEventListener('pointerup', handleUp);
        canvas.addEventListener('pointercancel', handleUp);
    }
    update() {
        this.justPressed = {};
    }
    isDown(code) { return !!this.keys[code]; }
    isJustPressed(code) { return !!this.justPressed[code]; }
}

class Entity {
    constructor(x, y, r) {
        this.pos = new Vector2(x, y);
        this.vel = new Vector2();
        this.radius = r;
        this.active = true;
        this.polarity = 1; // 1 for Red, -1 for Blue
    }
    update(dt) {
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff';
        ctx.fill();
    }
}

class Particle extends Entity {
    constructor(x, y, polarity, speed, life) {
        super(x, y, MathUtils.rand(2, 4));
        this.polarity = polarity;
        const angle = MathUtils.rand(0, Math.PI * 2);
        this.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.life = life;
        this.maxLife = life;
    }
    update(dt) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        super.draw(ctx);
        ctx.globalAlpha = 1;
    }
}

class Bullet extends Entity {
    constructor(x, y, vx, vy, polarity, isEnemy) {
        super(x, y, 4);
        this.vel.set(vx, vy);
        this.polarity = polarity;
        this.isEnemy = isEnemy;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.polarity === 1 ? '#ff3366' : '#33ccff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 10);
        this.speed = 300;
        this.shootTimer = 0;
        this.hp = 100;
        this.maxHp = 100;
        this.polarity = 1;
        this.energy = 0;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.invulnTimer = 0;
        this.recoil = 0;
        this.thrustLevel = 0;
        this.aimAngle = -Math.PI / 2;
    }
    update(dt, game) {
        let dx = 0;
        let dy = 0;

        if (this.invulnTimer > 0) this.invulnTimer -= dt;
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashTimer > 0) this.dashTimer -= dt;
        this.recoil = Math.max(0, this.recoil - dt * 20);

        if (game.input.isDown('KeyW') || game.input.isDown('ArrowUp')) dy -= 1;
        if (game.input.isDown('KeyS') || game.input.isDown('ArrowDown')) dy += 1;
        if (game.input.isDown('KeyA') || game.input.isDown('ArrowLeft')) dx -= 1;
        if (game.input.isDown('KeyD') || game.input.isDown('ArrowRight')) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const mag = Math.sqrt(dx*dx + dy*dy);
            const accel = 1500;
            this.vel.x += (dx/mag) * accel * dt;
            this.vel.y += (dy/mag) * accel * dt;
            this.thrustLevel = GameMathExtras.lerp(this.thrustLevel, 1, dt * 10);
            this.aimAngle = Math.atan2(dy, dx);
        } else {
            this.thrustLevel = GameMathExtras.lerp(this.thrustLevel, 0, dt * 10);
        }

        if (game.input.touchActive) {
            const tx = game.input.touchMove.x;
            const ty = game.input.touchMove.y;
            const canvasRect = game.canvas.getBoundingClientRect();
            const relX = (tx - canvasRect.left) * (game.canvas.width / canvasRect.width);
            const relY = (ty - canvasRect.top) * (game.canvas.height / canvasRect.height);

            const dist = Math.sqrt((relX - this.pos.x)**2 + (relY - this.pos.y)**2);
            if (dist > 10) {
                const accel = 1500;
                const ndx = (relX - this.pos.x)/dist;
                const ndy = (relY - this.pos.y)/dist;
                this.vel.x += ndx * accel * dt;
                this.vel.y += ndy * accel * dt;
                this.thrustLevel = GameMathExtras.lerp(this.thrustLevel, 1, dt * 10);
                this.aimAngle = Math.atan2(ndy, ndx);
            }
        }

        const friction = 0.92;
        this.vel.x *= friction;
        this.vel.y *= friction;

        const speedSq = this.vel.x*this.vel.x + this.vel.y*this.vel.y;
        if (this.dashTimer <= 0 && speedSq > this.speed * this.speed) {
            const mult = this.speed / Math.sqrt(speedSq);
            this.vel.x *= mult;
            this.vel.y *= mult;
        }

        if (game.input.isJustPressed('KeyF') && this.dashCooldown <= 0) {
            this.dashTimer = 0.2;
            this.dashCooldown = 1.5;
            this.invulnTimer = Math.max(this.invulnTimer, 0.3);
            const dSpd = 800;
            this.vel.x = Math.cos(this.aimAngle) * dSpd;
            this.vel.y = Math.sin(this.aimAngle) * dSpd;
            game.sound.playShoot(this.polarity === 1);
            game.spawnParticles(this.pos.x, this.pos.y, this.polarity, 15);
        }

        super.update(dt);

        this.pos.x = MathUtils.clamp(this.pos.x, this.radius, game.width - this.radius);
        this.pos.y = MathUtils.clamp(this.pos.y, this.radius, game.height - this.radius);

        if (game.input.isJustPressed('ShiftLeft') || game.input.isJustPressed('ShiftRight') || game.input.isJustPressed('KeyE')) {
            this.polarity *= -1;
            game.sound.playSwitch();
        }

        this.shootTimer -= dt;
        if ((game.input.isDown('Space') || game.input.touchActive) && this.shootTimer <= 0) {
            this.shootTimer = 0.15;
            this.recoil = 5;
            const bvx = Math.cos(this.aimAngle) * 600;
            const bvy = Math.sin(this.aimAngle) * 600;
            if (game.input.touchActive) {
                game.spawnBullet(this.pos.x, this.pos.y - 15, 0, -600, this.polarity, false);
            } else {
                game.spawnBullet(this.pos.x + Math.cos(this.aimAngle)*15, this.pos.y + Math.sin(this.aimAngle)*15, bvx, bvy, this.polarity, false);
            }
            game.sound.playShoot(this.polarity === 1);
        }
    }
    draw(ctx) {
        if (this.invulnTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);

        const color = this.polarity === 1 ? '#ff3366' : '#33ccff';
        const ringColor = this.polarity === 1 ? 'rgba(255,51,102,0.5)' : 'rgba(51,204,255,0.5)';

        if (typeof VectorRenderer !== 'undefined') {
            VectorRenderer.drawAimTelegraph(ctx, 0, 0, this.aimAngle, 60, ringColor);
            VectorRenderer.drawRing(ctx, 0, 0, this.radius + 4 + Math.sin(Date.now()*0.01)*2, ringColor, 2);
            ctx.translate(-Math.cos(this.aimAngle)*this.recoil, -Math.sin(this.aimAngle)*this.recoil);
            if (this.thrustLevel > 0) {
                VectorRenderer.drawThrust(ctx, -Math.cos(this.aimAngle)*this.radius, -Math.sin(this.aimAngle)*this.radius, this.aimAngle + Math.PI, 12, 10 + this.thrustLevel * 15 + Math.random()*5, '#ffa500');
            }
        }

        ctx.rotate(this.aimAngle + Math.PI/2);
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(0, this.radius - 4);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

class Boss extends Entity {
    constructor(x, y) {
        super(x, y, 40);
        this.hp = 1000;
        this.maxHp = 1000;
        this.timer = 0;
        this.state = 0;
        this.targetPos = new Vector2(x, y);
    }
    update(dt, game) {
        this.timer += dt;

        if (MathUtils.distSq(this.pos.x, this.pos.y, this.targetPos.x, this.targetPos.y) < 100) {
            this.targetPos.set(MathUtils.rand(100, game.width - 100), MathUtils.rand(100, game.height/3));
        }

        const dx = this.targetPos.x - this.pos.x;
        const dy = this.targetPos.y - this.pos.y;
        const mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > 0) {
            this.vel.set((dx/mag)*100, (dy/mag)*100);
        }

        super.update(dt);

        if (this.timer > 2) {
            this.timer = 0;
            const p = Math.random() > 0.5 ? 1 : -1;
            for(let i=0; i<12; i++) {
                const angle = (i/12) * Math.PI * 2;
                const speed = 150;
                game.spawnBullet(this.pos.x, this.pos.y, Math.cos(angle)*speed, Math.sin(angle)*speed, p, true);
            }
            game.sound.playShoot(p === 1);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.timer);

        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        ctx.fillStyle = '#444';
        ctx.fill();
        ctx.strokeStyle = '#7751ef';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI*2);
        ctx.fillStyle = '#222';
        ctx.fill();

        ctx.restore();

        ctx.fillStyle = '#f00';
        ctx.fillRect(this.pos.x - 50, this.pos.y - this.radius - 20, 100, 10);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(this.pos.x - 50, this.pos.y - this.radius - 20, 100 * (this.hp/this.maxHp), 10);
    }
}

class Island {
    constructor(gameWidth, gameHeight) {
        this.pos = new Vector2(MathUtils.rand(0, gameWidth), MathUtils.rand(-gameHeight, gameHeight));
        this.size = MathUtils.rand(50, 150);
        this.speed = MathUtils.rand(20, 50);
    }
    update(dt, gameHeight) {
        this.pos.y += this.speed * dt;
        if (this.pos.y > gameHeight + this.size) {
            this.pos.y = -this.size;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.beginPath();
        ctx.moveTo(-this.size/2, -this.size/4);
        ctx.lineTo(this.size/2, -this.size/4);
        ctx.lineTo(this.size/3, this.size/2);
        ctx.lineTo(-this.size/3, this.size/2);
        ctx.closePath();
        ctx.fillStyle = '#2a3b2a';
        ctx.fill();
        ctx.strokeStyle = '#3a4b3a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        this.input = new InputManager(canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE';
        this.lastTime = performance.now();

        this.player = null;
        this.boss = null;
        this.bullets = [];
        this.particles = [];
        this.islands = [];

        this.score = 0;
        this.wave = 1;

        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                this.canvas.width = width;
                this.canvas.height = height;
                this.width = width;
                this.height = height;
            }
        });
        this.resizeObserver.observe(this.canvas);

        this.bindEvents();
        this.reset();
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }
    bindEvents() {
        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        const initSound = () => {
            this.sound.init();
            window.removeEventListener('keydown', initSound);
            this.canvas.removeEventListener('pointerdown', initSound);
        };
        window.addEventListener('keydown', initSound);
        this.canvas.addEventListener('pointerdown', initSound);
    }
    reset() {
        this.player = new Player(this.width / 2, this.height * 0.8);
        this.boss = new Boss(this.width / 2, 100);
        this.bullets = [];
        this.particles = [];
        this.islands = [];
        for (let i = 0; i < 5; i++) {
            this.islands.push(new Island(this.width, this.height));
        }
        this.worldManager = new WorldManager(this.width, this.height);
        this.score = 0;
        this.wave = 1;
    }
    spawnBullet(x, y, vx, vy, polarity, isEnemy) {
        this.bullets.push(new Bullet(x, y, vx, vy, polarity, isEnemy));
    }
    spawnParticles(x, y, colorCode, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, colorCode, MathUtils.rand(50, 150), MathUtils.rand(0.2, 0.6)));
        }
    }
    setState(newState) {
        this.state = newState;
    }
    update(dt) {
        if (this.state === 'TITLE') {
            if (this.input.isJustPressed('Space') || this.input.touchActive) {
                this.reset();
                this.setState('PLAYING');
            }
            this.input.update();
            return;
        }

        if (this.state === 'PAUSED') {
            if (this.input.isJustPressed('Space') || this.input.touchActive) {
                this.setState('PLAYING');
            }
            this.input.update();
            return;
        }

        if (this.state === 'GAME_OVER') {
            if (this.input.isJustPressed('Space') || this.input.touchActive) {
                this.setState('TITLE');
            }
            this.input.update();
            return;
        }

        if (this.input.isJustPressed('Escape')) {
            this.setState('PAUSED');
            this.input.update();
            return;
        }

        this.islands.forEach(i => i.update(dt, this.height));
        if (this.worldManager) this.worldManager.update(dt, this);
        this.player.update(dt, this);
        if (this.boss && this.boss.active) {
            this.boss.update(dt, this);
        }

        this.bullets.forEach(b => {
            b.update(dt);
            if (b.pos.x < -10 || b.pos.x > this.width + 10 || b.pos.y < -10 || b.pos.y > this.height + 10) {
                b.active = false;
            }
        });
        this.particles.forEach(p => p.update(dt));

        this.bullets.forEach(b => {
            if (!b.active) return;
            if (b.isEnemy) {
                if (MathUtils.distSq(b.pos.x, b.pos.y, this.player.pos.x, this.player.pos.y) < (b.radius + this.player.radius)**2) {
                    if (b.polarity === this.player.polarity) {
                        this.score += 10;
                        this.player.energy += 5;
                        b.active = false;
                        this.spawnParticles(b.pos.x, b.pos.y, b.polarity, 5);
                    } else if (this.player.invulnTimer <= 0) {
                        this.player.hp -= 10;
                        this.player.invulnTimer = 1.0;
                        b.active = false;
                        this.sound.playHit();
                        this.spawnParticles(this.player.pos.x, this.player.pos.y, -b.polarity, 10);
                        if (this.player.hp <= 0) {
                            this.endGame();
                        }
                    }
                }
            } else {
                if (this.boss && this.boss.active) {
                    if (MathUtils.distSq(b.pos.x, b.pos.y, this.boss.pos.x, this.boss.pos.y) < (b.radius + this.boss.radius)**2) {
                        const dmg = b.polarity !== 0 ? 20 : 10;
                        this.boss.hp -= dmg;
                        b.active = false;
                        this.score += 5;
                        this.spawnParticles(b.pos.x, b.pos.y, b.polarity, 3);
                        if (this.boss.hp <= 0) {
                            this.boss.active = false;
                            this.sound.playExplosion();
                            this.spawnParticles(this.boss.pos.x, this.boss.pos.y, 1, 30);
                            this.spawnParticles(this.boss.pos.x, this.boss.pos.y, -1, 30);
                            this.score += 1000;
                            setTimeout(() => {
                                this.wave++;
                                this.boss = new Boss(this.width/2, -100);
                                this.boss.hp = 1000 * this.wave;
                                this.boss.maxHp = this.boss.hp;
                            }, 2000);
                        }
                    }
                }
            }
        });

        this.bullets = this.bullets.filter(b => b.active);
        this.particles = this.particles.filter(p => p.active);
        this.input.update();
    }
    endGame() {
        this.setState('GAME_OVER');
        this.sound.playExplosion();
        this.saveManager.data.totalGamesPlayed++;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        this.saveManager.save();
    }
    draw() {
        this.ctx.fillStyle = '#000810';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.worldManager) this.worldManager.drawBackground(this.ctx);
        this.islands.forEach(i => i.draw(this.ctx));
        if (this.worldManager) this.worldManager.drawForeground(this.ctx);

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            this.particles.forEach(p => p.draw(this.ctx));
            this.bullets.forEach(b => b.draw(this.ctx));
            if (this.boss && this.boss.active) this.boss.draw(this.ctx);
            if (this.player.hp > 0) this.player.draw(this.ctx);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 10, 30);
            this.ctx.fillText(`Wave: ${this.wave}`, 10, 60);

            this.ctx.fillStyle = '#f00';
            this.ctx.fillRect(10, this.height - 30, 200, 20);
            this.ctx.fillStyle = '#0f0';
            this.ctx.fillRect(10, this.height - 30, 200 * (this.player.hp/this.player.maxHp), 20);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText(`Polarity: ${this.player.polarity === 1 ? 'RED (+)' : 'BLUE (-)'}`, 10, this.height - 40);

            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(10, this.height - 65, 100, 15);
            if (this.player.dashCooldown <= 0) {
                this.ctx.fillStyle = '#ff0';
                this.ctx.fillRect(10, this.height - 65, 100, 15);
                this.ctx.fillStyle = '#000';
                this.ctx.fillText('DASH READY [F]', 12, this.height - 53);
            } else {
                this.ctx.fillStyle = '#555';
                const ratio = 1 - (this.player.dashCooldown / 1.5);
                this.ctx.fillRect(10, this.height - 65, 100 * ratio, 15);
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText('COOLDOWN', 12, this.height - 53);
            }
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px sans-serif';
            this.ctx.fillText('Magnetic Sky Duel', this.width/2, this.height/2 - 40);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText('Press Space or Tap to Start', this.width/2, this.height/2 + 20);
            this.ctx.fillText('WASD to move, Space to shoot, Shift to switch polarity', this.width/2, this.height/2 + 60);

            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height - 40);
        }

        if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px sans-serif';
            this.ctx.fillText('PAUSED', this.width/2, this.height/2);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText('Press Space or Tap to Resume', this.width/2, this.height/2 + 40);
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height - 40);
        }

        if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px sans-serif';
            this.ctx.fillText('GAME OVER', this.width/2, this.height/2 - 40);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width/2, this.height/2 + 20);
            this.ctx.fillText('Press Space or Tap to Restart', this.width/2, this.height/2 + 60);
        }
    }
    loop(time) {
        requestAnimationFrame(this.loop);
        let dt = (time - this.lastTime) / 1000;
        this.lastTime = time;
        if (dt > 0.1) dt = 0.1;
        this.update(dt);
        this.draw();
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
};
