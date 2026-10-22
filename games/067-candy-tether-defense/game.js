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
    playDash() { this.playTone(400, 'triangle', 0.2, 0.4); }
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
            if (e.button === 0) {
                this.mouse.isDown = true;
                this.mouse.justPressed = true;
            } else if (e.button === 2) {
                this.mouse.rightDown = true;
                this.mouse.rightJustPressed = true;
            }
        });
        canvas.addEventListener('mousemove', (e) => this.updateMouse(e));
        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) this.mouse.isDown = false;
            else if (e.button === 2) this.mouse.rightDown = false;
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());

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
        this.mouse.rightJustPressed = false;
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
        this.vx = 0;
        this.vy = 0;
        this.radius = 40;
        this.maxHealth = 100;
        this.health = 100;

        this.tetherAngle = 0;
        this.tetherBaseLength = 60;
        this.tetherMaxLength = 300;
        this.tetherCurrentLength = this.tetherBaseLength;
        this.isExtending = false;
        this.baseAngularVelocity = Math.PI * 1.5;

        // Dash & Movement
        this.dashCooldown = 3.0;
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashDuration = 0.2;
        this.dashActiveTimer = 0;

        this.invulnTimer = 0;
        this.recoilX = 0;
        this.recoilY = 0;

        this.thrustParticles = [];
    }

    applyRecoil(dx, dy, amount) {
        let dist = Math.hypot(dx, dy);
        if(dist > 0) {
            this.recoilX += -(dx/dist) * amount;
            this.recoilY += -(dy/dist) * amount;
            this.vx += -(dx/dist) * (amount * 5);
            this.vy += -(dy/dist) * (amount * 5);
        }
    }

    update(dt, input, game) {
        const pointerX = input.getPointerX();
        const pointerY = input.getPointerY();

        // Recoil recovery
        this.recoilX += (0 - this.recoilX) * 10 * dt;
        this.recoilY += (0 - this.recoilY) * 10 * dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        // Dash cooldown
        if (this.dashTimer > 0) this.dashTimer -= dt;

        // Movement
        let ax = 0, ay = 0;
        const speed = 1500;
        if (input.keys['KeyW'] || input.keys['ArrowUp']) ay -= speed;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) ay += speed;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) ax -= speed;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) ax += speed;

        if (this.dashActiveTimer > 0) {
            this.dashActiveTimer -= dt;
            ax = 0; ay = 0; // maintain momentum during dash
        } else {
            this.isDashing = false;
        }

        // Trigger Dash
        if ((input.keys['ShiftLeft'] || input.keys['ShiftRight'] || input.mouse.rightJustPressed) && this.dashTimer <= 0) {
            this.dashTimer = this.dashCooldown;
            this.dashActiveTimer = this.dashDuration;
            this.isDashing = true;
            this.invulnTimer = 0.5; // IFrames
            game.sound.playDash();

            // Dash impulse
            let len = Math.hypot(ax, ay);
            if (len > 0) {
                this.vx += (ax/len) * 1000;
                this.vy += (ay/len) * 1000;
            } else {
                // dash towards mouse
                let dx = pointerX - this.x;
                let dy = pointerY - this.y;
                let mlen = Math.hypot(dx, dy);
                if (mlen > 0) {
                    this.vx += (dx/mlen) * 1000;
                    this.vy += (dy/mlen) * 1000;
                }
            }
        }

        this.vx += ax * dt;
        this.vy += ay * dt;

        // Friction
        const friction = this.isDashing ? 0.96 : 0.82;
        this.vx *= Math.pow(friction, dt * 60);
        this.vy *= Math.pow(friction, dt * 60);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Bounds check
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -0.5; }
        if (this.x > game.width - this.radius) { this.x = game.width - this.radius; this.vx *= -0.5; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -0.5; }
        if (this.y > game.height - this.radius) { this.y = game.height - this.radius; this.vy *= -0.5; }

        // Spawn thrust particles
        if (Math.hypot(this.vx, this.vy) > 20) {
            this.thrustParticles.push({
                x: this.x - (this.vx * 0.05) + (Math.random()-0.5)*15,
                y: this.y - (this.vy * 0.05) + (Math.random()-0.5)*15,
                vx: -this.vx * 0.2 + (Math.random()-0.5)*30,
                vy: -this.vy * 0.2 + (Math.random()-0.5)*30,
                life: 0.5,
                maxLife: 0.5
            });
        }

        // Update particles
        for (let i = this.thrustParticles.length - 1; i >= 0; i--) {
            let p = this.thrustParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.thrustParticles.splice(i, 1);
        }

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

        const lengthFactor = (this.tetherCurrentLength - this.tetherBaseLength) / (this.tetherMaxLength - this.tetherBaseLength);
        let currentSpeed = this.baseAngularVelocity * (1 - lengthFactor * 0.7);
        if (this.isDashing) currentSpeed *= 3.0; // spin faster during dash
        this.tetherAngle += currentSpeed * dt;

        this.damageMultiplier = 1 + lengthFactor * 2;
    }

    draw(ctx, input) {
        // Draw thrust particles
        for (let p of this.thrustParticles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 * alpha, 0, Math.PI * 2);
            ctx.fill();
        }

        // Invuln blink
        if (this.invulnTimer > 0 && Math.floor(performance.now() / 50) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        let drawX = this.x + this.recoilX;
        let drawY = this.y + this.recoilY;

        // Draw Aim Telegraph
        if (input) {
            const pointerX = input.getPointerX();
            const pointerY = input.getPointerY();
            const aimAngle = Math.atan2(pointerY - drawY, pointerX - drawX);
            ctx.beginPath();
            ctx.moveTo(drawX, drawY);
            ctx.lineTo(drawX + Math.cos(aimAngle) * this.tetherMaxLength, drawY + Math.sin(aimAngle) * this.tetherMaxLength);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.setLineDash([5, 10]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw tether
        const endX = drawX + Math.cos(this.tetherAngle) * this.tetherCurrentLength;
        const endY = drawY + Math.sin(this.tetherAngle) * this.tetherCurrentLength;

        ctx.beginPath();
        ctx.moveTo(drawX, drawY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = this.isDashing ? '#0ff' : '#fff';
        ctx.lineWidth = this.isDashing ? 6 : 4;
        ctx.stroke();

        // Tether Head
        ctx.beginPath();
        ctx.arc(endX, endY, 15, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT_COLOR;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // procedural multi-part tower sprite
        // Base plate
        ctx.beginPath();
        ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner gear (rotates opposite to tether)
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.rotate(-this.tetherAngle * 2);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const r1 = 15;
            const r2 = 25;
            ctx.lineTo(Math.cos(angle - 0.2) * r1, Math.sin(angle - 0.2) * r1);
            ctx.lineTo(Math.cos(angle) * r2, Math.sin(angle) * r2);
            ctx.lineTo(Math.cos(angle + 0.2) * r1, Math.sin(angle + 0.2) * r1);
        }
        ctx.closePath();
        ctx.fillStyle = '#444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Core eye
        ctx.beginPath();
        ctx.arc(drawX, drawY, 8, 0, Math.PI * 2);
        ctx.fillStyle = this.isDashing ? '#0ff' : (this.invulnTimer > 0 ? '#fff' : '#222');
        ctx.fill();

        ctx.globalAlpha = 1.0;

        // Health Bar
        const barWidth = 60;
        const barHeight = 8;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(drawX - barWidth/2, drawY - this.radius - 20, barWidth, barHeight);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(drawX - barWidth/2, drawY - this.radius - 20, barWidth * (this.health/this.maxHealth), barHeight);
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
                        if (this.tower.invulnTimer <= 0) {
                            this.tower.health -= e.damage;
                            this.tower.applyRecoil(e.x - this.tower.x, e.y - this.tower.y, 20);
                            this.sound.playHit();
                            e.active = false;
                        } else if (this.tower.isDashing) {
                            e.health = 0;
                            e.active = false;
                            this.score += 15;
                            this.sound.playExplosion();
                            this.tower.applyRecoil(this.tower.x - e.x, this.tower.y - e.y, 5); // tiny bounce back
                        }
                    }

                    // Check collision with tether head
                    const distToTether = Math.hypot(e.x - tetherHead.x, e.y - tetherHead.y);
                    if (distToTether < e.radius + tetherHead.radius) {
                        e.health -= 10 * this.tower.damageMultiplier;
                        // apply some recoil to the tower from the tether hit
                        this.tower.applyRecoil(e.x - tetherHead.x, e.y - tetherHead.y, 2);
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

        this.tower.draw(this.ctx, this.input);
        for (let e of this.enemies) {
            e.draw(this.ctx);
        }

        // HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);
        this.ctx.fillText(`High: ${this.saveManager.data.highScore}`, 20, 70);

        // Dash cooldown HUD
        if (this.tower) {
            const cdRatio = 1 - Math.max(0, this.tower.dashTimer) / this.tower.dashCooldown;
            this.ctx.font = '16px monospace';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText(`Dash (Shift/R-Click):`, 20, 110);
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(20, 120, 150, 15);
            this.ctx.fillStyle = cdRatio >= 1 ? '#0ff' : '#888';
            this.ctx.fillRect(20, 120, 150 * cdRatio, 15);
        }
    }

    drawTitle() {
        this.ctx.fillStyle = ACCENT_COLOR;
        this.ctx.font = '48px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Candy Tether Defense", this.width/2, this.height/3);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.fillText("WASD: Move | Click: Extend Tether | Shift/R-Click: Dash", this.width/2, this.height/2);
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
