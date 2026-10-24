const SAVE_KEY = 'arcade_game_084_084-echo-forge-fusion_v1';

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
            console.warn('LocalStorage error:', e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn('LocalStorage error:', e);
        }
    }
}

class InputManager {
    constructor(canvas) {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, clicked: false };
        this.touches = [];
        this.canvas = canvas;
        this.rect = canvas.getBoundingClientRect();

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);

        canvas.addEventListener('mousemove', (e) => {
            this.updateMousePos(e);
        });
        canvas.addEventListener('mousedown', (e) => {
            this.updateMousePos(e);
            this.mouse.down = true;
            this.mouse.clicked = true;
        });
        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.updateTouches(e);
            if(e.touches.length > 0) {
                this.mouse.x = e.touches[0].clientX - this.rect.left;
                this.mouse.y = e.touches[0].clientY - this.rect.top;
                this.mouse.clicked = true;
            }
        }, {passive: false});
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.updateTouches(e);
        }, {passive: false});
        window.addEventListener('touchend', (e) => {
            this.updateTouches(e);
        });
        window.addEventListener('touchcancel', (e) => {
            this.updateTouches(e);
        });

        // Handle canvas resize
        const observer = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.rect = entry.target.getBoundingClientRect();
            }
        });
        observer.observe(canvas);
    }

    updateMousePos(e) {
        this.mouse.x = e.clientX - this.rect.left;
        this.mouse.y = e.clientY - this.rect.top;
    }

    updateTouches(e) {
        this.touches = [];
        for (let i = 0; i < e.touches.length; i++) {
            this.touches.push({
                x: e.touches[i].clientX - this.rect.left,
                y: e.touches[i].clientY - this.rect.top
            });
        }
    }

    resetFrame() {
        this.mouse.clicked = false;
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.ready = false;
    }

    init() {
        if (this.ready) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.ready = true;
        } catch (e) {
            console.warn('AudioContext not supported');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playSynth(freq, type, duration, vol = 1) {
        if (!this.ready || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playShoot() {
        this.playSynth(400, 'square', 0.1, 0.3);
        setTimeout(() => this.playSynth(200, 'square', 0.1, 0.2), 50);
    }

    playHit() {
        this.playSynth(150, 'sawtooth', 0.2, 0.4);
    }

    playBeat() {
        this.playSynth(100, 'sine', 0.1, 0.5);
    }

    playEcho() {
        this.playSynth(600, 'sine', 0.2, 0.2);
    }
}

class Entity {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = radius;
        this.color = color;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y, 15, '#e857ce');
        this.speed = 1000; // Acceleration
        this.maxSpeed = 300;
        this.friction = 0.9;
        this.echoTimer = 0;
        this.echoInterval = 2.0; // Place echo every 2 seconds

        // Dash abilities
        this.dashTimer = 0;
        this.dashCooldown = 2.0;
        this.isDashing = false;
        this.dashDuration = 0.2;
        this.dashTime = 0;

        // Recoil
        this.recoil = 0;
        this.angle = 0;
    }
    update(dt, input, game) {
        // Dash cooldown
        if (this.dashTimer > 0) this.dashTimer -= dt;

        if (this.isDashing) {
            this.dashTime -= dt;
            if (this.dashTime <= 0) {
                this.isDashing = false;
            }
        } else {
            let ax = 0;
            let ay = 0;
            if (input.keys['KeyW'] || input.keys['ArrowUp']) ay -= this.speed;
            if (input.keys['KeyS'] || input.keys['ArrowDown']) ay += this.speed;
            if (input.keys['KeyA'] || input.keys['ArrowLeft']) ax -= this.speed;
            if (input.keys['KeyD'] || input.keys['ArrowRight']) ax += this.speed;

            // Touch movement fallback
            if (input.mouse.down) {
                const dx = input.mouse.x - this.x;
                const dy = input.mouse.y - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > this.radius) {
                    ax = (dx / dist) * this.speed;
                    ay = (dy / dist) * this.speed;
                }
            }

            this.vx += ax * dt;
            this.vy += ay * dt;

            // Friction
            this.vx *= this.friction;
            this.vy *= this.friction;

            // Max speed clamp
            const currentSpeed = Math.hypot(this.vx, this.vy);
            if (currentSpeed > this.maxSpeed) {
                this.vx = (this.vx / currentSpeed) * this.maxSpeed;
                this.vy = (this.vy / currentSpeed) * this.maxSpeed;
            }

            // Trigger dash
            if ((input.keys['ShiftLeft'] || input.keys['ShiftRight']) && this.dashTimer <= 0) {
                this.isDashing = true;
                this.dashTime = this.dashDuration;
                this.dashTimer = this.dashCooldown;

                // Dash velocity boost
                let dashVx = this.vx;
                let dashVy = this.vy;
                const dashSpeed = 1000;

                if (Math.hypot(dashVx, dashVy) < 10) {
                    dashVx = dashSpeed; // Default right if not moving
                    dashVy = 0;
                } else {
                    const norm = Math.hypot(dashVx, dashVy);
                    dashVx = (dashVx / norm) * dashSpeed;
                    dashVy = (dashVy / norm) * dashSpeed;
                }

                this.vx = dashVx;
                this.vy = dashVy;
                game.sounds.playShoot(); // Reuse shoot sound for dash
                game.spawnParticles(this.x, this.y, 20, '#ffffff');
            }
        }

        super.update(dt);

        // Recoil decay
        if (this.recoil > 0) {
            this.recoil -= dt * 10;
            if (this.recoil < 0) this.recoil = 0;
        }

        // Aim angle towards mouse/touch or closest enemy
        let targetX = input.mouse.x;
        let targetY = input.mouse.y;
        if (!input.mouse.down && game.enemies.length > 0) {
            let closest = null;
            let minDist = Infinity;
            for(let e of game.enemies) {
                let dx = e.x - this.x;
                let dy = e.y - this.y;
                let dist = Math.hypot(dx, dy);
                if (dist < minDist) {
                    minDist = dist;
                    closest = e;
                }
            }
            if (closest) {
                targetX = closest.x;
                targetY = closest.y;
            }
        }
        this.angle = Math.atan2(targetY - this.y, targetX - this.x);

        // Clamp to screen
        this.x = Math.max(this.radius, Math.min(game.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(game.height - this.radius, this.y));

        this.echoTimer += dt;
        if (this.echoTimer >= this.echoInterval) {
            this.echoTimer = 0;
            game.spawnEcho(this.x, this.y);
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Apply recoil offset
        ctx.translate(-Math.cos(this.angle) * this.recoil, -Math.sin(this.angle) * this.recoil);

        // Blink if dashing
        if (this.isDashing && Math.random() < 0.5) {
            ctx.globalAlpha = 0.5;
        }

        // Rotate for telegraph
        ctx.rotate(this.angle);

        // Multi-part procedural player vector sprite
        // Core body
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Thrust trail
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 50) {
            ctx.beginPath();
            ctx.moveTo(-this.radius, -this.radius/2);
            ctx.lineTo(-this.radius - speed/10, 0);
            ctx.lineTo(-this.radius, this.radius/2);
            ctx.fillStyle = 'rgba(232, 87, 206, 0.5)';
            ctx.fill();
        }

        // Aim telegraph (barrel)
        ctx.beginPath();
        ctx.moveTo(this.radius, -4);
        ctx.lineTo(this.radius + 8, 0);
        ctx.lineTo(this.radius, 4);
        ctx.fillStyle = '#00ffff';
        ctx.fill();

        // Organelle detailing for Microscopic Cell Interior
        ctx.rotate(-this.angle); // rotate back for internal details to not spin crazily
        ctx.beginPath();
        ctx.arc(-4, -4, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, 3, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();

        ctx.restore();
    }
}

class Echo extends Entity {
    constructor(x, y) {
        super(x, y, 12, 'rgba(232, 87, 206, 0.5)');
        this.life = 6.0; // Lasts 6 seconds
    }
    update(dt) {
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        // Outline pulses with rhythm maybe
        ctx.strokeStyle = `rgba(255,255,255,${this.life/6})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Small nucleus
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }
}

class Projectile extends Entity {
    constructor(x, y, vx, vy, color) {
        super(x, y, 4, color);
        this.vx = vx;
        this.vy = vy;
        this.life = 2.0;
    }
    update(dt) {
        super.update(dt);
        this.life -= dt;
        if (this.life <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Enemy extends Entity {
    constructor(x, y, type) {
        super(x, y, 14, '#44ff44');
        this.type = type;
        this.hp = 1;
        this.speed = 100 + Math.random() * 50;
        if (type === 'fast') {
            this.speed = 200;
            this.radius = 10;
            this.color = '#ffcc00';
        } else if (type === 'tank') {
            this.speed = 60;
            this.radius = 22;
            this.color = '#ff4444';
            this.hp = 3;
        }
    }
    update(dt, player) {
        // Pathogen behavior: track player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
            this.vx = (dx / dist) * this.speed;
            this.vy = (dy / dist) * this.speed;
        }
        super.update(dt);
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));

        ctx.beginPath();
        if (this.type === 'tank') {
            ctx.rect(-15, -15, 30, 30);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
            // Membrane
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fill();
        } else {
            // Spiky virus
            for(let i=0; i<6; i++) {
                ctx.moveTo(0, 0);
                const angle = (i/6) * Math.PI * 2;
                ctx.lineTo(Math.cos(angle) * this.radius * 1.5, Math.sin(angle) * this.radius * 1.5);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#222';
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = new InputManager(canvas);
        this.saves = new SaveManager();
        this.sounds = new SoundEngine();

        this.width = canvas.width;
        this.height = canvas.height;

        this.state = 'TITLE';

        this.lastTime = performance.now();
        this.resize();

        const observer = new ResizeObserver(() => this.resize());
        observer.observe(canvas);

        this.resetGame();

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

        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        if (this.world) this.world.resize(this.width, this.height);
    }

    resetGame() {
        this.world = new World(this.width, this.height);
        this.player = new Player(this.width / 2, this.height / 2);
        this.echoes = [];
        this.projectiles = [];
        this.enemies = [];
        this.particles = [];

        this.score = 0;
        this.wave = 1;
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;

        // Rhythm
        this.bpm = 120;
        this.beatInterval = 60 / this.bpm;
        this.beatTimer = 0;
    }

    spawnEcho(x, y) {
        this.echoes.push(new Echo(x, y));
        this.sounds.playEcho();
        this.spawnParticles(x, y, 10, '#e857ce');
    }

    spawnParticles(x, y, count, color) {
        for(let i=0; i<count; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * 200,
                vy: (Math.random() - 0.5) * 200,
                life: 0.5 + Math.random() * 0.5,
                color: color
            });
        }
    }

    spawnEnemy() {
        let x, y;
        if (Math.random() < 0.5) {
            x = Math.random() < 0.5 ? -30 : this.width + 30;
            y = Math.random() * this.height;
        } else {
            x = Math.random() * this.width;
            y = Math.random() < 0.5 ? -30 : this.height + 30;
        }

        let type = 'normal';
        if (this.wave > 2 && Math.random() < 0.3) type = 'fast';
        if (this.wave > 4 && Math.random() < 0.2) type = 'tank';

        this.enemies.push(new Enemy(x, y, type));
    }

    triggerBeat() {
        this.sounds.playBeat();
        // Fire projectiles from player and all echoes towards mouse or closest enemy
        let targetX = this.input.mouse.x;
        let targetY = this.input.mouse.y;

        // If no active touch/mouse, auto aim to closest enemy
        if (!this.input.mouse.down && this.enemies.length > 0) {
            let closest = null;
            let minDist = Infinity;
            for(let e of this.enemies) {
                let dx = e.x - this.player.x;
                let dy = e.y - this.player.y;
                let dist = Math.hypot(dx, dy);
                if (dist < minDist) {
                    minDist = dist;
                    closest = e;
                }
            }
            if (closest) {
                targetX = closest.x;
                targetY = closest.y;
            }
        }

        const sources = [this.player, ...this.echoes];
        for (let s of sources) {
            const dx = targetX - s.x;
            const dy = targetY - s.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                const vx = (dx / dist) * 500;
                const vy = (dy / dist) * 500;
                this.projectiles.push(new Projectile(s.x, s.y, vx, vy, '#00ffff'));
                if (s === this.player) {
                    this.player.recoil = 5;
                }
            }
        }
        this.sounds.playShoot();

        // Background pulse effect
        this.bgPulse = 0.2;
    }

    update(dt) {
        if (this.input.keys['Escape']) {
            this.input.keys['Escape'] = false;
            this.state = 'PAUSED';
            return;
        }

        this.beatTimer += dt;
        if (this.beatTimer >= this.beatInterval) {
            this.beatTimer -= this.beatInterval;
            this.triggerBeat();
        }

        this.enemySpawnTimer += dt;
        if (this.enemySpawnTimer >= this.enemySpawnRate) {
            this.enemySpawnTimer = 0;
            this.spawnEnemy();
            this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.02); // gets faster
        }

        if (this.bgPulse > 0) {
            this.bgPulse -= dt;
        }

        this.world.update(dt, this.player, this.enemies, this.echoes, this.projectiles);
        if (this.player.inHazard) {
            this.sounds.playHit();
            this.gameOver();
            this.player.inHazard = false;
            return;
        }

        this.player.update(dt, this.input, this);

        this.echoes.forEach(e => e.update(dt));
        this.projectiles.forEach(p => p.update(dt));
        this.enemies.forEach(e => e.update(dt, this.player));

        // Particles
        for (let p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        // Collisions
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            let enemy = this.enemies[i];

            // Player collision
            const dx = this.player.x - enemy.x;
            const dy = this.player.y - enemy.y;
            if (Math.hypot(dx, dy) < this.player.radius + enemy.radius) {
                if (!this.player.isDashing) {
                    this.sounds.playHit();
                    this.gameOver();
                    return;
                } else {
                    // Dash damage
                    enemy.hp -= 1;
                    if (enemy.hp <= 0) {
                        enemy.active = false;
                        this.score += 10;
                        this.sounds.playHit(); // Using hit sound for enemy death during dash
                        this.spawnParticles(enemy.x, enemy.y, 15, enemy.color);
                    }
                }
            }

            // Projectile collision
            for (let j = this.projectiles.length - 1; j >= 0; j--) {
                let proj = this.projectiles[j];
                const pdx = proj.x - enemy.x;
                const pdy = proj.y - enemy.y;
                if (Math.hypot(pdx, pdy) < proj.radius + enemy.radius) {
                    proj.active = false;
                    enemy.hp--;
                    this.spawnParticles(enemy.x, enemy.y, 5, enemy.color);
                    if (enemy.hp <= 0) {
                        enemy.active = false;
                        this.score += (enemy.type === 'tank' ? 50 : 10);
                        this.spawnParticles(enemy.x, enemy.y, 20, enemy.color);
                        this.sounds.playHit();
                    }
                    break; // one hit per projectile
                }
            }
        }

        // Cleanup inactive
        this.echoes = this.echoes.filter(e => e.active);
        this.projectiles = this.projectiles.filter(p => p.active);
        this.enemies = this.enemies.filter(e => e.active);

        // Wave progression (simple)
        if (this.score > this.wave * 200) {
            this.wave++;
            this.bpm = Math.min(180, this.bpm + 5);
            this.beatInterval = 60 / this.bpm;
        }
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.saves.data.totalGamesPlayed++;
        this.saves.data.totalScoreAccumulated += this.score;
        if (this.score > this.saves.data.highScore) {
            this.saves.data.highScore = this.score;
        }
        if (this.wave > this.saves.data.bestWaveOrCombo) {
            this.saves.data.bestWaveOrCombo = this.wave;
        }
        this.saves.save();
    }

    drawBackground() {
        // Microscopic Cell Interior
        const g = this.ctx.createRadialGradient(this.width/2, this.height/2, 0, this.width/2, this.height/2, this.width);
        g.addColorStop(0, '#1a0515');
        g.addColorStop(1, '#050005');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.world) {
            this.world.drawBackground(this.ctx);
        }

        if (this.bgPulse > 0) {
            this.ctx.fillStyle = `rgba(232, 87, 206, ${this.bgPulse * 0.2})`;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
    }

    drawHUD() {
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Wave: ${this.wave}`, 20, 60);
        this.ctx.fillText(`BPM: ${this.bpm}`, 20, 90);

        // Progress to next beat
        const progress = this.beatTimer / this.beatInterval;
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(20, 100, 100, 10);
        this.ctx.fillStyle = '#e857ce';
        this.ctx.fillRect(20, 100, 100 * progress, 10);

        // Dash cooldown
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px monospace';
        this.ctx.fillText('DASH', 20, 130);
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(60, 120, 60, 10);

        if (this.player.dashTimer <= 0) {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.fillRect(60, 120, 60, 10);
        } else {
            const dashProg = 1 - (this.player.dashTimer / this.player.dashCooldown);
            this.ctx.fillStyle = '#888';
            this.ctx.fillRect(60, 120, 60 * dashProg, 10);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawBackground();

        this.echoes.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);
        this.enemies.forEach(e => e.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));

        for (let p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life * 2;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 2, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }

        if (this.world) {
            this.world.drawForeground(this.ctx);
        }

        this.drawHUD();
    }

    loop(now) {
        requestAnimationFrame((t) => this.loop(t));
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.input.mouse.clicked || Object.keys(this.input.keys).length > 0) {
            this.sounds.init();
            this.sounds.resume();
        }

        if (this.state === 'TITLE') {
            this.drawBackground();
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText('ECHO FORGE FUSION', this.width/2, this.height/2 - 40);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Click or Press Space to Start', this.width/2, this.height/2 + 20);
            this.ctx.fillText('Move: WASD/Arrows | Aim: Mouse/Touch', this.width/2, this.height/2 + 50);
            this.ctx.font = '16px monospace';
            this.ctx.fillStyle = '#aaa';
            this.ctx.fillText(`High Score: ${this.saves.data.highScore}`, this.width/2, this.height/2 + 90);
            this.ctx.fillText('<- Back to Arcade', this.width/2, this.height - 30); // requirement

            if (this.input.keys['Space'] || this.input.mouse.clicked) {
                // simple hack for back to arcade area check
                if (this.input.mouse.clicked && this.input.mouse.y > this.height - 60) {
                    window.location.href = '../../index.html';
                } else {
                    this.input.keys['Space'] = false;
                    this.resetGame();
                    this.state = 'PLAYING';
                }
            }
        } else if (this.state === 'PLAYING') {
            this.update(dt);
            this.draw();
        } else if (this.state === 'PAUSED') {
            this.draw();
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText('PAUSED', this.width/2, this.height/2);
            this.ctx.font = '20px monospace';
            this.ctx.fillText('Press Esc to Resume', this.width/2, this.height/2 + 40);
            this.ctx.fillText('<- Back to Arcade', this.width/2, this.height - 30); // requirement

            if (this.input.keys['Escape']) {
                this.input.keys['Escape'] = false;
                this.state = 'PLAYING';
            }
            if (this.input.mouse.clicked && this.input.mouse.y > this.height - 60) {
                window.location.href = '../../index.html';
            }
        } else if (this.state === 'GAME_OVER') {
            this.draw();
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '40px monospace';
            this.ctx.fillText('CELL COLLAPSE', this.width/2, this.height/2 - 40);
            this.ctx.font = '20px monospace';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width/2, this.height/2 + 10);
            this.ctx.fillText('Click or Press Space to Restart', this.width/2, this.height/2 + 50);
            this.ctx.fillText('<- Back to Arcade', this.width/2, this.height - 30);

            if (this.input.keys['Space'] || this.input.mouse.clicked) {
                if (this.input.mouse.clicked && this.input.mouse.y > this.height - 60) {
                    window.location.href = '../../index.html';
                } else {
                    this.input.keys['Space'] = false;
                    this.resetGame();
                    this.state = 'PLAYING';
                }
            }
        }

        this.input.resetFrame();
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
};
