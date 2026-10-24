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


class EnemyProjectile extends Entity {
    constructor(x, y, vx, vy, color) {
        super(x, y, 4, color);
        this.vx = vx;
        this.vy = vy;
        this.life = 3.0;
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
        this.timer = 0;
        this.state = 'idle';
        this.maxHp = 1;

        if (type === 'swarmer') {
            this.speed = 150 + Math.random() * 50;
            this.radius = 8;
            this.color = '#44ff44';
            this.offset = Math.random() * Math.PI * 2;
        } else if (type === 'dasher') {
            this.speed = 250;
            this.radius = 10;
            this.color = '#ffcc00';
            this.dashDirX = 0;
            this.dashDirY = 0;
            this.state = 'prep';
        } else if (type === 'bruiser') {
            this.speed = 50;
            this.radius = 22;
            this.color = '#ff4444';
            this.hp = 5;
            this.maxHp = 5;
            this.shieldRot = 0;
        } else if (type === 'sniper') {
            this.speed = 90;
            this.radius = 12;
            this.color = '#00ffff';
            this.state = 'reposition';
            this.targetX = 0;
            this.targetY = 0;
        } else if (type === 'spawner') {
            this.speed = 60;
            this.radius = 18;
            this.color = '#ff00ff';
            this.hp = 3;
            this.maxHp = 3;
            this.pulse = 0;
        }
    }
    update(dt, player, game) {
        this.timer += dt;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (this.type === 'swarmer') {
            // Erratic sine wave tracking
            if (dist > 0) {
                let angle = Math.atan2(dy, dx);
                angle += Math.sin(this.timer * 5 + this.offset) * 0.5;
                this.vx = Math.cos(angle) * this.speed;
                this.vy = Math.sin(angle) * this.speed;
            }
        } else if (this.type === 'dasher') {
            if (this.state === 'prep') {
                this.vx = 0;
                this.vy = 0;
                if (this.timer > 1.0) {
                    this.state = 'dash';
                    this.timer = 0;
                    if (dist > 0) {
                        this.dashDirX = (dx / dist) * this.speed;
                        this.dashDirY = (dy / dist) * this.speed;
                    }
                }
            } else if (this.state === 'dash') {
                this.vx = this.dashDirX;
                this.vy = this.dashDirY;
                if (this.timer > 0.5) {
                    this.state = 'prep';
                    this.timer = 0;
                }
            }
        } else if (this.type === 'bruiser') {
            if (dist > 0) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
            this.shieldRot += dt * 2;
        } else if (this.type === 'sniper') {
            if (this.state === 'reposition') {
                // Keep distance of ~200
                if (dist < 200) {
                    this.vx = -(dx / dist) * this.speed;
                    this.vy = -(dy / dist) * this.speed;
                } else if (dist > 300) {
                    this.vx = (dx / dist) * this.speed;
                    this.vy = (dy / dist) * this.speed;
                } else {
                    this.vx = 0;
                    this.vy = 0;
                }

                if (this.timer > 2.0 && dist < 400) {
                    this.state = 'aim';
                    this.timer = 0;
                    this.targetX = player.x;
                    this.targetY = player.y;
                    this.vx = 0;
                    this.vy = 0;
                }
            } else if (this.state === 'aim') {
                // Tracking target
                this.targetX = player.x;
                this.targetY = player.y;
                if (this.timer > 1.0) {
                    this.state = 'shoot';
                    this.timer = 0;
                    // Fire projectile
                    const p_dx = this.targetX - this.x;
                    const p_dy = this.targetY - this.y;
                    const p_dist = Math.hypot(p_dx, p_dy);
                    if (p_dist > 0 && game && game.enemyProjectiles) {
                        game.enemyProjectiles.push(new EnemyProjectile(
                            this.x, this.y,
                            (p_dx / p_dist) * 200,
                            (p_dy / p_dist) * 200,
                            this.color
                        ));
                        game.sounds.playHit(); // reuse sound
                    }
                }
            } else if (this.state === 'shoot') {
                if (this.timer > 0.5) {
                    this.state = 'reposition';
                    this.timer = 0;
                }
            }
        } else if (this.type === 'spawner') {
            this.pulse = Math.sin(this.timer * 4) * 0.5 + 0.5;
            // Move slowly towards center or player
            if (dist > 0) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
            if (this.timer > 3.0) {
                this.timer = 0;
                // Spawn a swarmer
                if (game && game.enemies) {
                    game.enemies.push(new Enemy(this.x, this.y, 'swarmer'));
                    game.spawnParticles(this.x, this.y, 5, this.color);
                }
            }
        }

        super.update(dt);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.vy, this.vx));

        ctx.beginPath();
        if (this.type === 'swarmer') {
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(0, this.radius);
            ctx.lineTo(-this.radius, 0);
            ctx.lineTo(0, -this.radius);
            ctx.closePath();
            ctx.fillStyle = '#222';
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.type === 'dasher') {
            ctx.moveTo(this.radius * 1.5, 0);
            ctx.lineTo(-this.radius, this.radius);
            ctx.lineTo(-this.radius * 0.5, 0);
            ctx.lineTo(-this.radius, -this.radius);
            ctx.closePath();
            ctx.fillStyle = '#222';
            ctx.fill();
            if (this.state === 'prep') {
                ctx.strokeStyle = `rgba(255, 204, 0, ${Math.sin(this.timer * 10) * 0.5 + 0.5})`;
            } else {
                ctx.strokeStyle = this.color;
            }
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.type === 'bruiser') {
            ctx.rotate(this.shieldRot);
            ctx.rect(-15, -15, 30, 30);
            ctx.fillStyle = '#222';
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Shield segments
            for (let i=0; i<4; i++) {
                ctx.beginPath();
                ctx.arc(0, 0, 24, i * Math.PI/2 + 0.2, (i+1) * Math.PI/2 - 0.2);
                ctx.strokeStyle = `rgba(255, 68, 68, ${this.hp / this.maxHp})`;
                ctx.lineWidth = 4;
                ctx.stroke();
            }
        } else if (this.type === 'sniper') {
            // Star shape
            for(let i=0; i<4; i++) {
                ctx.moveTo(0, 0);
                const angle = (i/4) * Math.PI * 2;
                ctx.lineTo(Math.cos(angle) * this.radius * 1.5, Math.sin(angle) * this.radius * 1.5);
            }
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
            ctx.fillStyle = '#222';
            ctx.fill();
            ctx.stroke();

            if (this.state === 'aim') {
                ctx.restore();
                ctx.save();
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.targetX, this.targetY);
                ctx.strokeStyle = `rgba(0, 255, 255, ${this.timer / 1.0})`;
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.stroke();
            }
        } else if (this.type === 'spawner') {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + this.pulse * 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 255, 0.2)';
            ctx.fill();
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Inner cells
            for(let i=0; i<3; i++) {
                const angle = (i/3) * Math.PI * 2 + this.timer;
                const cx = Math.cos(angle) * (this.radius * 0.5);
                const cy = Math.sin(angle) * (this.radius * 0.5);
                ctx.beginPath();
                ctx.arc(cx, cy, 4, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.fill();
            }
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
        this.enemyProjectiles = [];
        this.particles = [];

        this.score = 0;
        this.wave = 1;
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;

        // Rhythm
        this.bpm = 120;
        this.beatInterval = 60 / this.bpm;
        this.beatTimer = 0;
            // Boss
        this.boss = null;
        this.bossActive = false;
        this.bossTimer = 0;
        this.displayBossHp = 1;
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
    spawnBossWave() {
        this.bossActive = true;
        this.bossTimer = 0;

        const types = ['boss_echo_bane', 'boss_rhythm_core'];
        const type = types[(Math.floor(this.wave / 5) - 1) % types.length] || types[0];

        const x = this.width / 2;
        const y = -100; // spawn above screen
        this.boss = new Boss(x, y, type);
        this.enemies.push(this.boss);

        // Clear normal enemies to focus on boss
        for (let e of this.enemies) {
            if (!e.isBoss) {
                e.active = false;
                this.spawnParticles(e.x, e.y, 10, e.color);
            }
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

        let type = 'swarmer';
        let roll = Math.random();

        if (this.wave > 1) {
            if (roll < 0.2) type = 'dasher';
        }
        if (this.wave > 2) {
            if (roll >= 0.2 && roll < 0.4) type = 'bruiser';
            if (roll >= 0.4 && roll < 0.5) type = 'sniper';
        }
        if (this.wave > 3) {
            if (roll >= 0.5 && roll < 0.6) type = 'spawner';
        }

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

                if (!this.bossActive) {
            this.enemySpawnTimer += dt;
            if (this.enemySpawnTimer >= this.enemySpawnRate) {
                this.enemySpawnTimer = 0;
                this.spawnEnemy();
                this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.02);
            }
        } else {
            this.bossTimer += dt;
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
        this.enemies.forEach(e => e.update(dt, this.player, this));
        this.enemyProjectiles.forEach(p => p.update(dt));

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

                        if (enemy.isBoss) {
                            this.bossActive = false;
                            this.boss = null;
                            this.score += 500;
                            this.spawnParticles(enemy.x, enemy.y, 100, '#ffffff');
                            this.sounds.playHit();
                        }

                        // Spawner death logic

                        if (enemy.type === 'spawner') {
                            for(let s=0; s<3; s++) {
                                this.enemies.push(new Enemy(enemy.x + (Math.random()-0.5)*20, enemy.y + (Math.random()-0.5)*20, 'swarmer'));
                            }
                        }

                        let points = 10;
                        if (enemy.type === 'bruiser') points = 50;
                        if (enemy.type === 'spawner') points = 40;
                        if (enemy.type === 'sniper') points = 30;
                        this.score += points;

                        this.spawnParticles(enemy.x, enemy.y, 20, enemy.color);
                        this.sounds.playHit();
                    }
                    break; // one hit per projectile
                }
            }
        }

        // Enemy Projectile Collision with Player
        for (let j = this.enemyProjectiles.length - 1; j >= 0; j--) {
            let ep = this.enemyProjectiles[j];
            const epdx = this.player.x - ep.x;
            const epdy = this.player.y - ep.y;
            if (Math.hypot(epdx, epdy) < this.player.radius + ep.radius) {
                if (!this.player.isDashing) {
                    this.sounds.playHit();
                    this.gameOver();
                    return;
                }
            }
        }

        // Cleanup inactive
        this.echoes = this.echoes.filter(e => e.active);
        this.projectiles = this.projectiles.filter(p => p.active);
        this.enemies = this.enemies.filter(e => e.active);
        this.enemyProjectiles = this.enemyProjectiles.filter(p => p.active);

        // Wave progression (simple)
        if (this.score > this.wave * 200 && !this.bossActive) {
            this.wave++;
            if (this.wave % 5 === 0) {
                this.spawnBossWave();
            } else {
                this.bpm = Math.min(180, this.bpm + 5);
                this.beatInterval = 60 / this.bpm;
            }
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

        if (this.bossActive && this.boss) {
            // Draw warning banner when boss spawns
            if (this.bossTimer < 3) {
                this.ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(this.bossTimer * 5))})`;
                this.ctx.fillRect(0, this.height / 2 - 40, this.width, 80);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 30px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText("WARNING: BOSS APPROACHING", this.width / 2, this.height / 2 + 10);
            }

            // Draw boss health bar
            const barW = Math.min(400, this.width * 0.8);
            const barH = 20;
            const barX = this.width / 2 - barW / 2;
            const barY = 30;

            this.ctx.fillStyle = '#444';
            this.ctx.fillRect(barX, barY, barW, barH);

            const hpRatio = Math.max(0, this.boss.hp / this.boss.maxHp);
            this.displayBossHp = this.displayBossHp || hpRatio;
            this.displayBossHp += (hpRatio - this.displayBossHp) * 0.1; // animate

            this.ctx.fillStyle = this.boss.phase === 1 ? '#ff0055' : '#ffffff';
            this.ctx.fillRect(barX, barY, barW * this.displayBossHp, barH);

            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(barX, barY, barW, barH);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`BOSS - Phase ${this.boss.phase}`, this.width / 2, barY + 14);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.drawBackground();

        this.echoes.forEach(e => e.draw(this.ctx));
        this.player.draw(this.ctx);
        this.enemies.forEach(e => e.draw(this.ctx));
        this.enemyProjectiles.forEach(p => p.draw(this.ctx));
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


class Boss extends Enemy {
    constructor(x, y, type) {
        super(x, y, type);
        this.isBoss = true;
        this.radius = 45;
        this.phase = 1;
        this.timer = 0;

        if (type === 'boss_echo_bane') {
            this.maxHp = 50; // High HP
            this.color = '#ff3366';
            this.speed = 80;
        } else if (type === 'boss_rhythm_core') {
            this.maxHp = 60;
            this.color = '#aa33ff';
            this.speed = 40;
        }
        this.hp = this.maxHp;
        this.baseColor = this.color;
    }

    update(dt, player, game) {
        // Phase transition check
        if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
            this.phase = 2;
            game.spawnParticles(this.x, this.y, 50, '#ffffff');
            game.sounds.playHit();
            this.speed *= 1.5;
            this.color = '#ffffff';
            this.timer = 0; // reset attack timer
        }

        this.timer += dt;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        // Enter screen gracefully
        if (this.y < game.height * 0.2) {
            this.vy = 100;
            this.vx = 0;
        } else {
            if (this.type === 'boss_echo_bane') {
                // Chases the player but shoots at echoes to punish self-cooperation
                if (dist > 0) {
                    this.vx = (dx / dist) * this.speed;
                    this.vy = (dy / dist) * this.speed;
                }

                const fireRate = this.phase === 1 ? 2.0 : 1.0;
                if (this.timer > fireRate) {
                    this.timer = 0;
                    // Shoot at all echoes
                    for (let echo of game.echoes) {
                        const edx = echo.x - this.x;
                        const edy = echo.y - this.y;
                        const edist = Math.hypot(edx, edy);
                        if (edist > 0) {
                            game.enemyProjectiles.push(new EnemyProjectile(
                                this.x, this.y,
                                (edx / edist) * 150,
                                (edy / edist) * 150,
                                this.color
                            ));
                        }
                    }
                    // If no echoes, shoot at player
                    if (game.echoes.length === 0 && dist > 0) {
                        game.enemyProjectiles.push(new EnemyProjectile(
                            this.x, this.y,
                            (dx / dist) * 200,
                            (dy / dist) * 200,
                            this.color
                        ));
                    }
                }
            } else if (this.type === 'boss_rhythm_core') {
                // Moves slowly, spawns projectiles in a spiral
                this.vx = 0;
                this.vy = 0;
                // slowly drift to center
                const cx = game.width / 2 - this.x;
                const cy = game.height / 2 - this.y;
                const cdist = Math.hypot(cx, cy);
                if (cdist > 10) {
                    this.vx = (cx / cdist) * this.speed;
                    this.vy = (cy / cdist) * this.speed;
                }

                const fireRate = this.phase === 1 ? 0.3 : 0.15;
                if (this.timer > fireRate) {
                    this.timer = 0;
                    const angle = performance.now() / 200; // spiral
                    game.enemyProjectiles.push(new EnemyProjectile(
                        this.x, this.y,
                        Math.cos(angle) * 150,
                        Math.sin(angle) * 150,
                        this.color
                    ));
                    // Fire opposite too in phase 2
                    if (this.phase === 2) {
                        game.enemyProjectiles.push(new EnemyProjectile(
                            this.x, this.y,
                            Math.cos(angle + Math.PI) * 150,
                            Math.sin(angle + Math.PI) * 150,
                            this.color
                        ));
                    }
                }
            }
        }

        // Entity update - avoid super.update(dt, player, game) because Enemy.update has swarmer logic
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Keep within bounds somewhat
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > game.width - this.radius) this.x = game.width - this.radius;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.stroke();

        // pulsing core based on phase
        const pulse = Math.sin(performance.now() / 150) * 8 * this.phase;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 2 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = this.baseColor;
        ctx.fill();

        ctx.restore();
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
};

// Helper function for visual effect particle generation
function generateExplosionEffect(x, y, count, color, particlesArray) {
    // Additional logic placeholder 0
    if (count > 0) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 1
    if (count > 1) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 2
    if (count > 2) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 3
    if (count > 3) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 4
    if (count > 4) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 5
    if (count > 5) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 6
    if (count > 6) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 7
    if (count > 7) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 8
    if (count > 8) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 9
    if (count > 9) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 10
    if (count > 10) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 11
    if (count > 11) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 12
    if (count > 12) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 13
    if (count > 13) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 14
    if (count > 14) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 15
    if (count > 15) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 16
    if (count > 16) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 17
    if (count > 17) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 18
    if (count > 18) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 19
    if (count > 19) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 20
    if (count > 20) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 21
    if (count > 21) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 22
    if (count > 22) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 23
    if (count > 23) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 24
    if (count > 24) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 1;
            const size = Math.random() * 3 + 1;
            const life = Math.random() * 0.5 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
}
// Helper function for score visual effect particle generation
function generateScoreEffect(x, y, count, color, particlesArray) {
    // Additional logic placeholder 0
    if (count > 0) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 1
    if (count > 1) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 2
    if (count > 2) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 3
    if (count > 3) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 4
    if (count > 4) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 5
    if (count > 5) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 6
    if (count > 6) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 7
    if (count > 7) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 8
    if (count > 8) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 9
    if (count > 9) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 10
    if (count > 10) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 11
    if (count > 11) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 12
    if (count > 12) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 13
    if (count > 13) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 14
    if (count > 14) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 15
    if (count > 15) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 16
    if (count > 16) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 17
    if (count > 17) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 18
    if (count > 18) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 19
    if (count > 19) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 20
    if (count > 20) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 21
    if (count > 21) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 22
    if (count > 22) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 23
    if (count > 23) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
    // Additional logic placeholder 24
    if (count > 24) {
        for(let i=0; i<count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 1 + 0.5;
            const size = Math.random() * 2 + 1;
            const life = Math.random() * 0.3 + 0.2;
            particlesArray.push(new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, life, size));
        }
    }
}
