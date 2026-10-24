
class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_079_079-bazaar-bullet-retrieval_v1';
        this.data = this.load();
    }
    load() {
        try {
            const raw = localStorage.getItem(this.saveKey);
            if (raw) return JSON.parse(raw);
        } catch (e) { console.error('Save load failed', e); }
        return { highScore: 0, gamesPlayed: 0 };
    }
    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) { console.error('Save failed', e); }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.master.gain.value = 0.5;
        this.initialized = false;
    }
    init() {
        if (this.initialized) return;
        this.ctx.resume();
        this.initialized = true;
    }
    playShoot() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.master);
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }
    playPickup() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.master);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.1);
    }
    playHit() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.master);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.2);
    }
}

class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touches = [];
        this.canvas = canvas;

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        canvas.addEventListener('mousemove', e => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
        });
        canvas.addEventListener('mousedown', e => {
            this.mouse.down = true;
            window.game && window.game.sound.init();
        });
        canvas.addEventListener('mouseup', () => this.mouse.down = false);

        canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.updateTouches(e);
            window.game && window.game.sound.init();
        }, { passive: false });
        canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, { passive: false });
        canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, { passive: false });
    }

    updateTouches(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.touches = Array.from(e.touches).map(t => ({
            x: (t.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (t.clientY - rect.top) * (this.canvas.height / rect.height),
            id: t.identifier
        }));
    }

    getMovement() {
        let dx = 0;
        let dy = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;

        // Touch joystick logic (left side of screen)
        const leftTouch = this.touches.find(t => t.x < this.canvas.width / 2);
        if (leftTouch) {
            const centerX = this.canvas.width / 4;
            const centerY = this.canvas.height * 0.75;
            dx = (leftTouch.x - centerX) / 50;
            dy = (leftTouch.y - centerY) / 50;
            const mag = Math.sqrt(dx*dx + dy*dy);
            if (mag > 1) {
                dx /= mag;
                dy /= mag;
            }
        }

        return { dx, dy };
    }

    isShooting() {
        if (this.mouse.down) return true;
        // Touch shoot button (right side of screen)
        return this.touches.some(t => t.x > this.canvas.width / 2);
    }

    getAim(playerX, playerY) {
        if (this.touches.some(t => t.x > this.canvas.width / 2)) {
            const rightTouch = this.touches.find(t => t.x > this.canvas.width / 2);
            return { x: rightTouch.x, y: rightTouch.y };
        }
        return { x: this.mouse.x, y: this.mouse.y };
    }
}

class Entity {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.vx = 0;
        this.vy = 0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {}
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15);
        this.speed = 200;
        this.maxAmmo = 5;
        this.ammo = this.maxAmmo;
        this.shootCooldown = 0;
    }
    update(dt, input) {
        const move = input.getMovement();

        // Normalize movement
        const mag = Math.sqrt(move.dx * move.dx + move.dy * move.dy);
        if (mag > 1) {
            move.dx /= mag;
            move.dy /= mag;
        }

        this.x += move.dx * this.speed * dt;
        this.y += move.dy * this.speed * dt;

        if (this.shootCooldown > 0) this.shootCooldown -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = '#e2fc7a';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw ammo indicators
        for (let i = 0; i < this.maxAmmo; i++) {
            const angle = (i / this.maxAmmo) * Math.PI * 2;
            const px = this.x + Math.cos(angle) * (this.radius + 8);
            const py = this.y + Math.sin(angle) * (this.radius + 8);
            ctx.fillStyle = i < this.ammo ? '#fff' : '#444';
            ctx.beginPath();
            ctx.arc(px, py, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Bullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 5);
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0; // Seconds until it stops
        this.stopped = false;
    }
    update(dt) {
        if (!this.stopped) {
            super.update(dt);
            this.life -= dt;
            if (this.life <= 0) {
                this.stopped = true;
                this.vx = 0;
                this.vy = 0;
            }
        }
    }
    draw(ctx) {
        ctx.fillStyle = this.stopped ? '#888' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Enemy extends Entity {
    constructor(x, y, type) {
        super(x, y, 20);
        this.type = type;
        this.hp = type === 'boss' ? 50 : 3;
        this.speed = type === 'boss' ? 50 : 100;
        this.radius = type === 'boss' ? 40 : 20;
        this.shootTimer = 0;
    }
    update(dt, playerX, playerY) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }

        super.update(dt);

        if (this.type === 'boss') {
            this.shootTimer -= dt;
            if (this.shootTimer <= 0) {
                this.shootTimer = 2;
                return true; // Indicates boss shot
            }
        }
        return false;
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'boss' ? '#f55' : '#a5f';
        ctx.fillRect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
    }
}

class EnemyBullet extends Entity {
    constructor(x, y, vx, vy) {
        super(x, y, 6);
        this.vx = vx;
        this.vy = vy;
    }
    draw(ctx) {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputManager(this.canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE';
        this.lastTime = performance.now();

        this.resize();
        this.observer = new ResizeObserver(() => this.resize());
        this.observer.observe(document.body);

        this.reset();

        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });

        requestAnimationFrame((time) => this.loop(time));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    reset() {
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.bullets = [];
        this.enemies = [];
        this.enemyBullets = [];
        this.score = 0;
        this.wave = 1;
        this.waveTimer = 0;
        this.spawnTimer = 0;
        this.particles = [];
        this.gameOverTimer = 0;
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.state === 'TITLE') {
            if (this.input.isShooting() || this.input.keys['Enter']) {
                this.sound.init();
                this.reset();
                this.state = 'PLAYING';
            }
            return;
        }

        if (this.state === 'PAUSED') {
            if (this.input.keys['Escape'] || this.input.isShooting()) {
                this.state = 'PLAYING';
            }
            return;
        }

        if (this.state === 'GAME_OVER') {
            this.gameOverTimer += dt;
            if (this.gameOverTimer > 1 && (this.input.isShooting() || this.input.keys['Enter'])) {
                this.state = 'TITLE';
            }
            return;
        }

        // --- PLAYING STATE ---

        // Update Player
        this.player.update(dt, this.input);

        // Constrain player to screen
        this.player.x = Math.max(this.player.radius, Math.min(this.canvas.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.canvas.height - this.player.radius, this.player.y));

        // Player Shooting
        if (this.input.isShooting() && this.player.ammo > 0 && this.player.shootCooldown <= 0) {
            const aim = this.input.getAim(this.player.x, this.player.y);
            const dx = aim.x - this.player.x;
            const dy = aim.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const speed = 400;

            this.bullets.push(new Bullet(this.player.x, this.player.y, (dx / dist) * speed, (dy / dist) * speed));
            this.player.ammo--;
            this.player.shootCooldown = 0.25;
            this.sound.playShoot();
        }

        // Bullet Retrieval & Update
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.update(dt);

            // Constrain bullets
            b.x = Math.max(0, Math.min(this.canvas.width, b.x));
            b.y = Math.max(0, Math.min(this.canvas.height, b.y));

            if (b.stopped) {
                const dx = b.x - this.player.x;
                const dy = b.y - this.player.y;
                if (dx * dx + dy * dy < (this.player.radius + b.radius + 10) ** 2) {
                    if (this.player.ammo < this.player.maxAmmo) {
                        this.player.ammo++;
                        this.bullets.splice(i, 1);
                        this.sound.playPickup();
                    }
                }
            }
        }

        // Spawn Enemies
        this.waveTimer += dt;
        this.spawnTimer -= dt;

        if (this.waveTimer > 10) {
            this.wave++;
            this.waveTimer = 0;
            if (this.wave % 5 === 0) {
                // Spawn boss
                this.enemies.push(new Enemy(this.canvas.width / 2, -50, 'boss'));
            }
        }

        if (this.spawnTimer <= 0 && this.enemies.length < 5 + this.wave) {
            this.spawnTimer = 2 - Math.min(this.wave * 0.1, 1.5);
            // Spawn random edge
            let sx, sy;
            if (Math.random() < 0.5) {
                sx = Math.random() < 0.5 ? -30 : this.canvas.width + 30;
                sy = Math.random() * this.canvas.height;
            } else {
                sx = Math.random() * this.canvas.width;
                sy = Math.random() < 0.5 ? -30 : this.canvas.height + 30;
            }
            this.enemies.push(new Enemy(sx, sy, 'normal'));
        }

        // Update Enemies & Collisions
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            const bossShot = e.update(dt, this.player.x, this.player.y);

            if (bossShot) {
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    this.enemyBullets.push(new EnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150));
                }
            }

            // Check collision with moving bullets
            for (let j = this.bullets.length - 1; j >= 0; j--) {
                const b = this.bullets[j];
                if (!b.stopped) {
                    const dx = e.x - b.x;
                    const dy = e.y - b.y;
                    if (dx * dx + dy * dy < (e.radius + b.radius) ** 2) {
                        e.hp--;
                        b.stopped = true; // Bullet drops on hit
                        this.sound.playHit();
                        break;
                    }
                }
            }

            // Check collision with player
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            if (dx * dx + dy * dy < (e.radius + this.player.radius) ** 2) {
                this.endGame();
            }

            if (e.hp <= 0) {
                this.score += e.type === 'boss' ? 500 : 10;
                this.enemies.splice(i, 1);
            }
        }

        // Update Enemy Bullets
        for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
            const eb = this.enemyBullets[i];
            eb.update(dt);

            const dx = eb.x - this.player.x;
            const dy = eb.y - this.player.y;
            if (dx * dx + dy * dy < (eb.radius + this.player.radius) ** 2) {
                this.endGame();
            }

            if (eb.x < 0 || eb.x > this.canvas.width || eb.y < 0 || eb.y > this.canvas.height) {
                this.enemyBullets.splice(i, 1);
            }
        }
    }

    endGame() {
        this.state = 'GAME_OVER';
        this.gameOverTimer = 0;
        this.saveManager.data.gamesPlayed++;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        this.saveManager.save();
    }

    draw() {
        this.ctx.fillStyle = '#1a1515'; // Desert night
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Grid / Bazaar floor pattern
        this.ctx.strokeStyle = '#2a2525';
        this.ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); this.ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); this.ctx.stroke();
        }

        this.bullets.forEach(b => b.draw(this.ctx));
        this.enemies.forEach(e => e.draw(this.ctx));
        this.enemyBullets.forEach(eb => eb.draw(this.ctx));
        this.player.draw(this.ctx);

        // UI
        this.ctx.fillStyle = '#e2fc7a';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';

        if (this.state === 'TITLE') {
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText('BAZAAR BULLET RETRIEVAL', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Click or Press Enter to Start', this.canvas.width / 2, this.canvas.height / 2 + 20);
            this.ctx.font = '16px monospace';
            this.ctx.fillText('Move: WASD / Joystick. Shoot: Mouse / Button.', this.canvas.width / 2, this.canvas.height / 2 + 60);
            this.ctx.fillText('RETRIEVE YOUR DROPPED AMMO!', this.canvas.width / 2, this.canvas.height / 2 + 90);
        } else if (this.state === 'PLAYING' || this.state === 'PAUSED') {
            this.ctx.fillText(`Score: ${this.score}`, 20, 30);
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 60);
            this.ctx.fillText(`Ammo: ${this.player.ammo}/${this.player.maxAmmo}`, 20, 90);

            if (this.state === 'PAUSED') {
                this.ctx.textAlign = 'center';
                this.ctx.font = '40px monospace';
                this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
            }
        } else if (this.state === 'GAME_OVER') {
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillStyle = '#f55';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
            this.ctx.fillStyle = '#e2fc7a';
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 10);
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
            if (this.gameOverTimer > 1) {
                this.ctx.fillText('Click or Press Enter to Restart', this.canvas.width / 2, this.canvas.height / 2 + 80);
            }
        }
    }
}

window.onload = () => {
    window.game = new Game();
};
