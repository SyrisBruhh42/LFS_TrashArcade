
class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_080_080-frozen-tether_v1';
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterVolume: 1.0,
                sfxVolume: 1.0,
                musicVolume: 1.0
            }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(this.saveKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                if (parsed.options) {
                    this.data.options = { ...this.data.options, ...parsed.options };
                }
            }
        } catch (e) {
            console.error('SaveLoad error:', e);
        }
    }
    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.error('SaveWrite error:', e);
        }
    }
    updateScore(score) {
        if (score > this.data.highScore) {
            this.data.highScore = score;
        }
        this.data.totalScoreAccumulated += score;
        this.save();
    }
    incrementGamesPlayed() {
        this.data.totalGamesPlayed++;
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

            this.masterGain.gain.value = 1.0;
            this.sfxGain.gain.value = 1.0;
            this.musicGain.gain.value = 1.0;

            this.initialized = true;
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
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
    playJump() {
        this.playTone(400, 'sine', 0.2, 0.5);
    }
    playGrappleShoot() {
        this.playTone(800, 'square', 0.1, 0.3);
    }
    playGrappleHit() {
        this.playTone(600, 'triangle', 0.1, 0.4);
    }
    playDash() {
        this.playTone(400, 'triangle', 0.15, 0.4);
    }
    playEnemyHit() {
        this.playTone(150, 'sawtooth', 0.3, 0.6);
    }
    playScore() {
        this.playTone(1200, 'sine', 0.1, 0.3);
    }
    playGameOver() {
        this.playTone(100, 'sawtooth', 1.0, 0.8);
    }
}

class InputManager {
    constructor(canvas, soundEngine) {
        this.canvas = canvas;
        this.soundEngine = soundEngine;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, justPressed: false };
        this.touch = { active: false, x: 0, y: 0 };

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.justPressed = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        });
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouse.down = false;
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touch.active = true;
            this.updateTouch(e.touches[0]);
            this.mouse.down = true;
            this.mouse.justPressed = true;
            this.soundEngine.init();
            this.soundEngine.resume();
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.updateTouch(e.touches[0]);
        }, { passive: false });
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.active = false;
            this.mouse.down = false;
        }, { passive: false });
    }
    updateTouch(touchObj) {
        if (!touchObj) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.mouse.x = (touchObj.clientX - rect.left) * scaleX;
        this.mouse.y = (touchObj.clientY - rect.top) * scaleY;
    }
    update() {
        this.mouse.justPressed = false;
    }
    isKeyDown(code) {
        return !!this.keys[code];
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.color = '#769a87';
        this.speed = 300;
        this.jumpForce = -500;
        this.gravity = 1200;
        this.grounded = false;

        this.grapple = {
            active: false,
            x: 0,
            y: 0,
            length: 0,
            maxLength: 400,
            pullForce: 800
        };
        this.movementThreshold = 10;
        this.stillTime = 0;
        this.timeDilationFactor = 1.0;

        // Dash & Reactive Vector Rig
        this.dashCooldown = 3.0;
        this.dashTimer = 0;
        this.dashActive = false;
        this.dashDuration = 0.2;
        this.invulnTime = 0;
        this.aimX = 0;
        this.aimY = 0;
        this.recoilX = 0;
        this.recoilY = 0;
        this.thrustIntensity = 0;
    }

    update(dt, input, platforms, sound) {
        const speedSq = this.vx * this.vx + this.vy * this.vy;
        if (speedSq < this.movementThreshold * this.movementThreshold && !input.isKeyDown('KeyA') && !input.isKeyDown('KeyD') && !this.grapple.active) {
            this.stillTime += dt;
            this.timeDilationFactor = Math.max(0.1, 1.0 - this.stillTime * 2);
        } else {
            this.stillTime = 0;
            this.timeDilationFactor = 1.0;
        }

        let ax = 0;
        if (input.isKeyDown('KeyA') || input.isKeyDown('ArrowLeft')) ax -= 1;
        if (input.isKeyDown('KeyD') || input.isKeyDown('ArrowRight')) ax += 1;

        this.vx += ax * this.speed * dt * (this.grounded ? 2 : 1);

        // Tighter momentum/collision logic via enhanced friction
        if (this.grounded) {
            this.vx *= 0.80; // slightly tighter ground friction
        } else {
            this.vx *= 0.95; // slightly tighter air friction
        }

        // Recoil decay
        this.recoilX *= 0.9;
        this.recoilY *= 0.9;
        this.vx += this.recoilX * dt * 10;
        this.vy += this.recoilY * dt * 10;

        // Thrust logic for visuals
        if (Math.abs(ax) > 0) {
            this.thrustIntensity = Math.min(1, this.thrustIntensity + dt * 5);
        } else {
            this.thrustIntensity = Math.max(0, this.thrustIntensity - dt * 5);
        }

        // Update aim
        this.aimX = input.mouse.x;
        this.aimY = input.mouse.y;

        this.vy += this.gravity * dt;

        // Dash logic
        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.invulnTime > 0) this.invulnTime -= dt;

        if (this.dashActive) {
            if (this.dashTimer > this.dashCooldown - this.dashDuration) {
                this.vy = 0; // lock y during dash
            } else {
                this.dashActive = false;
            }
        } else if ((input.isKeyDown('ShiftLeft') || input.isKeyDown('ShiftRight')) && this.dashTimer <= 0) {
            this.dashActive = true;
            this.dashTimer = this.dashCooldown;
            this.invulnTime = this.dashDuration + 0.1;

            // Dash towards mouse
            let angle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
            let dashSpeed = 1200;
            this.vx = Math.cos(angle) * dashSpeed;
            this.vy = Math.sin(angle) * dashSpeed;
            sound.playDash();
        }

        if (input.mouse.justPressed && !this.dashActive) {
            this.shootGrapple(input.mouse.x, input.mouse.y, platforms, sound);
        } else if (!input.mouse.down && this.grapple.active) {
            this.grapple.active = false;
        }

        if (this.grapple.active) {
            const dx = this.grapple.x - this.x;
            const dy = this.grapple.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist > this.grapple.length) {
                const pullX = (dx / dist) * this.grapple.pullForce * dt;
                const pullY = (dy / dist) * this.grapple.pullForce * dt;
                this.vx += pullX;
                this.vy += pullY;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.grounded = false;
        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {

                const overlapX = Math.min(this.x + this.radius - p.x, p.x + p.w - (this.x - this.radius));
                const overlapY = Math.min(this.y + this.radius - p.y, p.y + p.h - (this.y - this.radius));

                if (overlapX < overlapY) {
                    if (this.x < p.x + p.w / 2) {
                        this.x = p.x - this.radius;
                        this.vx = Math.min(this.vx, 0);
                    } else {
                        this.x = p.x + p.w + this.radius;
                        this.vx = Math.max(this.vx, 0);
                    }
                } else {
                    if (this.y < p.y + p.h / 2) {
                        this.y = p.y - this.radius;
                        this.vy = 0;
                        this.grounded = true;
                    } else {
                        this.y = p.y + p.h + this.radius;
                        this.vy = Math.max(this.vy, 0);
                    }
                }
            }
        }

        if (this.grounded && (input.isKeyDown('Space') || input.isKeyDown('ArrowUp') || input.isKeyDown('KeyW'))) {
            this.vy = this.jumpForce;
            this.grounded = false;
            sound.playJump();
        }

        // Limits
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
        if (this.x > 800 - this.radius) { this.x = 800 - this.radius; this.vx *= -0.5; }
        if (this.y > 600 - this.radius) { this.y = 600 - this.radius; this.vy = 0; this.grounded = true; }
    }

    shootGrapple(tx, ty, platforms, sound) {
        sound.playGrappleShoot();
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.grapple.maxLength) return;

        // Simple raycast against platforms
        const steps = Math.floor(dist / 5);
        const stepX = dx / steps;
        const stepY = dy / steps;

        let cx = this.x;
        let cy = this.y;

        for (let i = 0; i < steps; i++) {
            cx += stepX;
            cy += stepY;
            for (let p of platforms) {
                if (cx > p.x && cx < p.x + p.w && cy > p.y && cy < p.y + p.h) {
                    this.grapple.active = true;
                    this.grapple.x = cx;
                    this.grapple.y = cy;
                    this.grapple.length = Math.hypot(cx - this.x, cy - this.y) * 0.8; // pull slightly

                    // Apply recoil
                    const rAngle = Math.atan2(this.y - cy, this.x - cx);
                    this.recoilX = Math.cos(rAngle) * 300;
                    this.recoilY = Math.sin(rAngle) * 300;

                    sound.playGrappleHit();
                    return;
                }
            }
        }
    }

    draw(ctx) {
        // Blink if invulnerable
        if (this.invulnTime > 0 && Math.floor(this.invulnTime * 20) % 2 === 0) return;

        // Draw Grapple Line & Hook
        if (this.grapple.active) {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.grapple.x, this.grapple.y);
            // Dynamic tension color
            const curDist = Math.hypot(this.grapple.x - this.x, this.grapple.y - this.y);
            ctx.strokeStyle = curDist > this.grapple.length ? '#ffaa00' : '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(this.grapple.x, this.grapple.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#ff5555';
            ctx.fill();
        }

        // Aim Telegraph
        let aimAngle = Math.atan2(this.aimY - this.y, this.aimX - this.x);
        if (!this.grapple.active && this.dashTimer <= 0) {
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(aimAngle)*this.radius, this.y + Math.sin(aimAngle)*this.radius);
            ctx.lineTo(this.x + Math.cos(aimAngle)*(this.radius + 15), this.y + Math.sin(aimAngle)*(this.radius + 15));
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Recoil offset visual
        ctx.translate(-this.recoilX * 0.02, -this.recoilY * 0.02);

        // Thrust flame
        if (this.thrustIntensity > 0 || this.dashActive) {
            let thrustAngle = this.dashActive ? aimAngle + Math.PI : Math.atan2(-this.vy, -this.vx);
            let thrustLen = this.dashActive ? 25 : 10 + this.thrustIntensity * 10;
            ctx.save();
            ctx.rotate(thrustAngle);
            ctx.beginPath();
            ctx.moveTo(-this.radius, 0);
            ctx.lineTo(-this.radius - thrustLen, 5);
            ctx.lineTo(-this.radius - thrustLen * 1.2, 0);
            ctx.lineTo(-this.radius - thrustLen, -5);
            ctx.closePath();
            ctx.fillStyle = this.dashActive ? '#00ffff' : '#ffaa00';
            ctx.fill();
            ctx.restore();
        }

        // Multi-part procedural body (Hexagon)
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let a = (i * Math.PI) / 3;
            let hx = Math.cos(a) * this.radius;
            let hy = Math.sin(a) * this.radius;
            if (i === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.fillStyle = this.dashActive ? '#aaaaaa' : this.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Visor
        ctx.rotate(aimAngle);
        ctx.fillStyle = '#000000';
        ctx.fillRect(this.radius * 0.2, -this.radius * 0.4, this.radius * 0.6, this.radius * 0.8);
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(this.radius * 0.4, -this.radius * 0.2, this.radius * 0.3, this.radius * 0.4);

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 400;
        this.vy = (Math.random() - 0.5) * 400;
        this.life = 1.0;
        this.color = color;
        this.radius = Math.random() * 4 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2.0;
        if (this.life < 0) {
            this.life = 0;
        }
    }
    draw(ctx) {
        if (this.life <= 0) {
            return;
        }
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.vx = (Math.random() - 0.5) * 100;
        this.vy = 0;
        this.active = true;
        this.color = '#ff4444';
    }
    update(dt, platforms) {
        this.vy += 600 * dt; // Gravity

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        let grounded = false;
        for (let p of platforms) {
            if (this.x + this.radius > p.x && this.x - this.radius < p.x + p.w &&
                this.y + this.radius > p.y && this.y - this.radius < p.y + p.h) {

                const overlapX = Math.min(this.x + this.radius - p.x, p.x + p.w - (this.x - this.radius));
                const overlapY = Math.min(this.y + this.radius - p.y, p.y + p.h - (this.y - this.radius));

                if (overlapX < overlapY) {
                    this.vx *= -1;
                    if (this.x < p.x + p.w / 2) this.x = p.x - this.radius;
                    else this.x = p.x + p.w + this.radius;
                } else {
                    this.vy = 0;
                    if (this.y < p.y + p.h / 2) {
                        this.y = p.y - this.radius;
                        grounded = true;
                    } else {
                        this.y = p.y + p.h + this.radius;
                    }
                }
            }
        }

        if (this.x < this.radius || this.x > 800 - this.radius) this.vx *= -1;
        if (this.y > 600 - this.radius) { this.y = 600 - this.radius; this.vy = 0; }

        // Simple pacing
        if (grounded && Math.random() < 0.02) {
            this.vy = -300;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(canvas, this.sound);

        this.state = 'TITLE';
        this.lastTime = performance.now();

        this.player = null;
        this.enemies = [];
        this.platforms = [];
        this.particles = [];
        this.score = 0;

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.resize();

        this.logicalWidth = 800;
        this.logicalHeight = 600;

        this.worldEnv = new WorldEnvironment(this.logicalWidth, this.logicalHeight);

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

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
    }

    start() {
        this.player = new Player(400, 300);
        this.score = 0;
        this.enemies = [];
        this.particles = [];
        this.platforms = [
            { x: 0, y: 580, w: 800, h: 20 },
            { x: 100, y: 450, w: 200, h: 20 },
            { x: 500, y: 400, w: 200, h: 20 },
            { x: 300, y: 250, w: 200, h: 20 },
            { x: 50, y: 150, w: 150, h: 20 },
            { x: 600, y: 150, w: 150, h: 20 }
        ];

        // Add hazards to platforms for collision
        for (let v of this.worldEnv.vents) {
            this.platforms.push({x: v.x, y: v.y, w: v.w, h: v.h, isHazard: true});
        }
        for (let c of this.worldEnv.conveyors) {
            this.platforms.push({x: c.x, y: c.y, w: c.w, h: c.h, isHazard: true});
        }

        for(let i = 0; i < 5; i++) {
            this.enemies.push(new Enemy(100 + Math.random() * 600, 50 + Math.random() * 300));
        }

        this.state = 'PLAYING';
        this.saveManager.incrementGamesPlayed();
    }

    update(dt) {
        if (this.state === 'TITLE') {
            if (this.input.isKeyDown('Enter') || this.input.mouse.justPressed) {
                this.start();
            }
        } else if (this.state === 'PLAYING') {
            if (this.input.isKeyDown('Escape')) {
                this.state = 'PAUSED';
                return;
            }

            // Time dilation twist
            let timeScale = this.player ? this.player.timeDilationFactor : 1.0;
            let effectiveDt = dt * timeScale;

            this.worldEnv.update(effectiveDt, [this.player, ...this.enemies]);

            this.player.update(effectiveDt, this.input, this.platforms, this.sound);

            for (let i = this.enemies.length - 1; i >= 0; i--) {
                let e = this.enemies[i];
                e.update(effectiveDt, this.platforms);

                // Collision with player
                const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
                if (dist < e.radius + this.player.radius) {
                    if (this.player.dashActive || (this.player.vy > 0 && this.player.y < e.y)) {
                        // Kill enemy if dashing or falling on top
                        e.active = false;
                        if (!this.player.dashActive) {
                             this.player.vy = this.player.jumpForce * 0.8; // Bounce
                        }
                        this.score += 100;
                        this.sound.playEnemyHit();
                        this.sound.playScore();
                        this.enemies.splice(i, 1);


                        for (let k = 0; k < 10; k++) {
                            this.particles.push(new Particle(e.x, e.y, e.color));
                        }

                        // Spawn new enemy to keep game going
                        this.enemies.push(new Enemy(100 + Math.random() * 600, 50));
                    } else if (this.player.invulnTime <= 0) {
                        for (let k = 0; k < 20; k++) {
                            this.particles.push(new Particle(this.player.x, this.player.y, this.player.color));
                        }
                        // Game Over
                        this.state = 'GAME_OVER';
                        this.sound.playGameOver();
                        this.saveManager.updateScore(this.score);
                    }
                }
            }

            if (this.player.dashActive) {
                this.particles.push(new Particle(this.player.x, this.player.y, '#00ffff'));
            }

            for (let i = this.particles.length - 1; i >= 0; i--) {
                this.particles[i].update(effectiveDt);
                if (this.particles[i].life <= 0) {
                    this.particles.splice(i, 1);
                }
            }

        } else if (this.state === 'PAUSED') {
            if (this.input.isKeyDown('Enter') || this.input.mouse.justPressed) {
                this.state = 'PLAYING';
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.input.isKeyDown('Enter') || this.input.mouse.justPressed) {
                this.start();
            }
        }

        this.input.update();
    }

    draw() {
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        const scaleX = this.canvas.width / this.logicalWidth;
        const scaleY = this.canvas.height / this.logicalHeight;
        const scale = Math.min(scaleX, scaleY);
        const offsetX = (this.canvas.width - this.logicalWidth * scale) / 2;
        const offsetY = (this.canvas.height - this.logicalHeight * scale) / 2;

        this.ctx.translate(offsetX, offsetY);
        this.ctx.scale(scale, scale);

        // Draw frame for logical area
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.logicalWidth, this.logicalHeight);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = '#769a87';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('FROZEN TETHER', this.logicalWidth / 2, this.logicalHeight / 3);
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Click or Press Enter to Start', this.logicalWidth / 2, this.logicalHeight / 2);
            this.ctx.fillText('A/D or Arrows to move. Click to Grapple.', this.logicalWidth / 2, this.logicalHeight / 2 + 40);
            this.ctx.fillText('Stand still to dilate time.', this.logicalWidth / 2, this.logicalHeight / 2 + 80);

            // Back to Arcade link (simulated UI)
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade: ../../index.html', this.logicalWidth / 2, this.logicalHeight - 30);

        } else if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {

            let camX = this.player ? this.player.x - this.logicalWidth / 2 : 0;
            this.worldEnv.drawBackground(this.ctx, camX);
            this.worldEnv.drawHazards(this.ctx);

            // Draw time dilation effect
            if (this.player && this.player.timeDilationFactor < 1.0) {
                this.ctx.fillStyle = `rgba(118, 154, 135, ${0.1 * (1.0 - this.player.timeDilationFactor)})`;
                this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
            }

            this.ctx.fillStyle = '#445566';
            for (let p of this.platforms) {
                if (!p.isHazard) { // hazards are drawn by worldEnv
                    this.ctx.fillRect(p.x, p.y, p.w, p.h);
                }
            }

            for (let e of this.enemies) {
                e.draw(this.ctx);
            }

            if (this.player && this.state !== 'GAME_OVER') {
                this.player.draw(this.ctx);
            }

            for (let p of this.particles) {
                p.draw(this.ctx);
            }

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(`Score: ${this.score}`, 20, 30);
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, 20, 60);
            if (this.player) {
                this.ctx.fillText(`Time Dilation: ${this.player.timeDilationFactor.toFixed(2)}x`, 20, 90);

                // Dash Cooldown HUD
                this.ctx.fillText(`Dash: `, 20, 120);
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(80, 105, 100, 15);
                if (this.player.dashTimer <= 0) {
                    this.ctx.fillStyle = '#00ffff';
                    this.ctx.fillRect(80, 105, 100, 15);
                } else {
                    this.ctx.fillStyle = '#ff5555';
                    let pct = 1.0 - (this.player.dashTimer / this.player.dashCooldown);
                    this.ctx.fillRect(80, 105, 100 * pct, 15);
                }
            }

            if (this.state === 'PAUSED') {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '48px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('PAUSED', this.logicalWidth / 2, this.logicalHeight / 2);
                this.ctx.font = '24px sans-serif';
                this.ctx.fillText('Click to Resume', this.logicalWidth / 2, this.logicalHeight / 2 + 50);
                this.ctx.font = '16px sans-serif';
                this.ctx.fillText('Back to Arcade: ../../index.html', this.logicalWidth / 2, this.logicalHeight - 30);
            } else if (this.state === 'GAME_OVER') {
                this.ctx.fillStyle = 'rgba(100, 0, 0, 0.7)';
                this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '48px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('GAME OVER', this.logicalWidth / 2, this.logicalHeight / 2);
                this.ctx.font = '24px sans-serif';
                this.ctx.fillText(`Final Score: ${this.score}`, this.logicalWidth / 2, this.logicalHeight / 2 + 50);
                this.ctx.fillText('Click to Restart', this.logicalWidth / 2, this.logicalHeight / 2 + 90);
            }
        }

        this.ctx.restore();
    }

    loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }
}

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Game(canvas);
    window.game = game; // For debugging and playtesting script
};
