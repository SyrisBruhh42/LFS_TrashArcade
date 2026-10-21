// Core Managers and Engine
const SAVE_KEY = 'arcade_game_056_056-scrap-chain_v1';

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
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                this.data = { ...this.data, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.warn("localStorage not available, using in-memory save.");
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {}
    }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.touchActive = false;
        this.joystickDir = { x: 0, y: 0 };
        this.detonatePressed = false;
        this.dashPressed = false;

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if(e.code === 'Space') this.detonatePressed = true;
            if(e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dashPressed = true;
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        this.initTouch();
    }
    initTouch() {
        if (!('ontouchstart' in window)) return;
        this.touchActive = true;
        const touchControls = document.getElementById('touchControls');
        if(touchControls) touchControls.style.display = 'flex';

        const joyZone = document.getElementById('joystickZone');
        const joyKnob = document.getElementById('joystickKnob');
        if (joyZone && joyKnob) {
            let activeTouchId = null;
            const updateJoy = (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (activeTouchId === null || t.identifier === activeTouchId) {
                        activeTouchId = t.identifier;
                        const rect = joyZone.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
                        let dx = t.clientX - cx;
                        let dy = t.clientY - cy;
                        const maxDist = rect.width / 2;
                        const dist = Math.hypot(dx, dy);
                        if (dist > maxDist) {
                            dx = (dx / dist) * maxDist;
                            dy = (dy / dist) * maxDist;
                        }
                        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
                        this.joystickDir.x = dx / maxDist;
                        this.joystickDir.y = dy / maxDist;
                    }
                }
            };
            joyZone.addEventListener('touchstart', e => {
                const t = e.changedTouches[0];
                activeTouchId = t.identifier;
                updateJoy(e);
            });
            joyZone.addEventListener('touchmove', updateJoy);
            const resetJoy = (e) => {
                for(let i=0; i<e.changedTouches.length; i++){
                    if(e.changedTouches[i].identifier === activeTouchId){
                        activeTouchId = null;
                        this.joystickDir.x = 0;
                        this.joystickDir.y = 0;
                        joyKnob.style.transform = `translate(0px, 0px)`;
                    }
                }
            };
            joyZone.addEventListener('touchend', resetJoy);
            joyZone.addEventListener('touchcancel', resetJoy);
        }

        const btnDetonate = document.getElementById('btnDetonate');
        if(btnDetonate){
            btnDetonate.addEventListener('touchstart', e => {
                e.preventDefault();
                this.detonatePressed = true;
            });
        }

        const btnDash = document.getElementById('btnDash');
        if(btnDash){
            btnDash.addEventListener('touchstart', e => {
                e.preventDefault();
                this.dashPressed = true;
            });
        }
    }

    consumeDetonate() {
        if(this.detonatePressed){
            this.detonatePressed = false;
            return true;
        }
        return false;
    }

    consumeDash() {
        if(this.dashPressed){
            this.dashPressed = false;
            return true;
        }
        return false;
    }

    getMovementVector() {
        let x = 0; let y = 0;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) x -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) y -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) y += 1;

        if (this.touchActive && (this.joystickDir.x !== 0 || this.joystickDir.y !== 0)) {
            x = this.joystickDir.x;
            y = this.joystickDir.y;
        }

        const len = Math.hypot(x, y);
        if (len > 0 && len > 1) {
            x /= len; y /= len;
        }
        return { x, y };
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;

        const initAudio = () => {
            if(!this.ctx){
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.5;
                this.masterGain.connect(this.ctx.destination);
            }
            if(this.ctx.state === 'suspended') this.ctx.resume();

            window.removeEventListener('pointerdown', initAudio);
            window.removeEventListener('keydown', initAudio);
        };
        window.addEventListener('pointerdown', initAudio);
        window.addEventListener('keydown', initAudio);
    }

    playSynth(freq, type, duration) {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.inputManager = new InputManager();
        this.soundEngine = new SoundEngine();

        this.state = 'TITLE';
        this.lastTime = 0;
        this.score = 0;

        this.bindUI();
        this.setupResizeObserver();

        document.addEventListener('visibilitychange', () => {
            if(document.hidden && this.state === 'PLAYING'){
                this.setState('PAUSED');
            }
        });
        window.addEventListener('blur', () => {
            if(this.state === 'PLAYING') this.setState('PAUSED');
        });

        window.addEventListener('keydown', e => {
            if(e.code === 'Escape' || e.code === 'KeyP') {
                if(this.state === 'PLAYING') this.setState('PAUSED');
                else if(this.state === 'PAUSED') this.setState('PLAYING');
            }
        });

        requestAnimationFrame(t => this.loop(t));
    }

    bindUI() {
        document.getElementById('btnStart').addEventListener('click', () => this.startGame());
        document.getElementById('btnRestart').addEventListener('click', () => this.startGame());
        document.getElementById('btnResume').addEventListener('click', () => this.setState('PLAYING'));

        this.uiTitle = document.getElementById('screenTitle');
        this.uiPaused = document.getElementById('screenPaused');
        this.uiGameOver = document.getElementById('screenGameOver');
        this.uiHud = document.getElementById('hud');

        document.getElementById('highScoreDisplay').innerText = `Best: ${this.saveManager.data.highScore}`;
    }

    setupResizeObserver() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(document.getElementById('gameContainer'));
        resize();
    }

    setState(newState) {
        this.state = newState;
        this.uiTitle.classList.remove('active');
        this.uiPaused.classList.remove('active');
        this.uiGameOver.classList.remove('active');
        this.uiHud.classList.remove('active');

        if(newState === 'TITLE') this.uiTitle.classList.add('active');
        if(newState === 'PAUSED') this.uiPaused.classList.add('active');
        if(newState === 'GAME_OVER') {
            this.uiGameOver.classList.add('active');
            document.getElementById('finalScore').innerText = `Score: ${this.score}`;
            if(this.score > this.saveManager.data.highScore){
                this.saveManager.data.highScore = this.score;
                this.saveManager.save();
                document.getElementById('highScoreDisplay').innerText = `Best: ${this.score}`;
            }
            this.saveManager.data.totalGamesPlayed++;
            this.saveManager.save();
        }
        if(newState === 'PLAYING') this.uiHud.classList.add('active');
    }

    startGame() {
        this.score = 0;
        this.updateScore(0);
        this.initGame();
        this.setState('PLAYING');
        this.lastTime = performance.now();
    }

    updateScore(pts) {
        this.score += pts;
        document.getElementById('scoreDisplay').innerText = `Score: ${this.score}`;
    }

    initGame() {

    }

    loop(time) {
        requestAnimationFrame(t => this.loop(t));
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        if (this.state === 'PLAYING') {
            this.update(dt);
            this.draw();
        }
    }

    update(dt) {

    }

    draw() {
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    }
}


class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;

        // Momentum / Physics base
        this.vx = 0;
        this.vy = 0;
        this.friction = 0.92;
        this.accel = 2000;

        // Dash ability
        this.dashTimer = 0;
        this.dashCooldown = 1.5;
        this.isDashing = false;
        this.dashDuration = 0.2;
        this.dashTimeActive = 0;
        this.dashSpeed = 1200;

        // Visuals
        this.lastInputVec = {x: 0, y: -1};
        this.trailParticles = [];
        this.invulnerableTimer = 0;
    }

    startDash(inputVector) {
        if (this.dashTimer > 0) return false;

        this.dashTimer = this.dashCooldown;
        this.isDashing = true;
        this.dashTimeActive = this.dashDuration;
        this.invulnerableTimer = this.dashDuration + 0.1; // iframe padding

        let dx = inputVector.x;
        let dy = inputVector.y;
        if (dx === 0 && dy === 0) {
            dx = this.lastInputVec.x;
            dy = this.lastInputVec.y;
        }

        this.vx = dx * this.dashSpeed;
        this.vy = dy * this.dashSpeed;

        // Spawn dash start explosion
        for (let i = 0; i < 10; i++) {
            this.trailParticles.push({
                x: this.x, y: this.y,
                vx: (Math.random() - 0.5) * 400 - (dx * 200),
                vy: (Math.random() - 0.5) * 400 - (dy * 200),
                life: 0.5, maxLife: 0.5,
                color: '#fff', size: Math.random() * 4 + 2
            });
        }
        return true;
    }

    update(dt, inputVector, canvasWidth, canvasHeight) {
        if (inputVector.x !== 0 || inputVector.y !== 0) {
            this.lastInputVec.x = inputVector.x;
            this.lastInputVec.y = inputVector.y;
        }

        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        if (this.isDashing) {
            this.dashTimeActive -= dt;
            if (this.dashTimeActive <= 0) {
                this.isDashing = false;
            }
            // Add dash trail
            if (Math.random() < 0.5) {
                this.trailParticles.push({
                    x: this.x + (Math.random() - 0.5) * 10,
                    y: this.y + (Math.random() - 0.5) * 10,
                    vx: 0, vy: 0, life: 0.3, maxLife: 0.3,
                    color: '#c86464', size: 6
                });
            }
        } else {
            // Normal movement accel
            this.vx += inputVector.x * this.accel * dt;
            this.vy += inputVector.y * this.accel * dt;

            // Apply friction
            this.vx *= Math.pow(this.friction, dt * 60);
            this.vy *= Math.pow(this.friction, dt * 60);
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.x < this.radius) { this.x = this.radius; this.vx = Math.abs(this.vx)*0.5; }
        if (this.x > canvasWidth - this.radius) { this.x = canvasWidth - this.radius; this.vx = -Math.abs(this.vx)*0.5; }
        if (this.y < this.radius) { this.y = this.radius; this.vy = Math.abs(this.vy)*0.5; }
        if (this.y > canvasHeight - this.radius) { this.y = canvasHeight - this.radius; this.vy = -Math.abs(this.vy)*0.5; }

        // Update particles
        for (let i = this.trailParticles.length - 1; i >= 0; i--) {
            let p = this.trailParticles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) this.trailParticles.splice(i, 1);
        }
    }

    draw(ctx) {
        // Draw trail
        for (let p of this.trailParticles) {
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Blink if invulnerable
        if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 20) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Calculate angle based on velocity or input
        let angle = Math.atan2(this.lastInputVec.y, this.lastInputVec.x);
        if (Math.hypot(this.vx, this.vy) > 10 && !this.isDashing) {
            angle = Math.atan2(this.vy, this.vx);
        } else if (this.isDashing) {
            angle = Math.atan2(this.vy, this.vx);
        }
        ctx.rotate(angle);

        // Core chassis
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, -10);
        ctx.closePath();

        ctx.fillStyle = this.isDashing ? '#c86464' : '#6c9b81';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Thrust exhaust
        if (!this.isDashing && Math.hypot(this.vx, this.vy) > 50) {
            ctx.beginPath();
            ctx.moveTo(-6, 0);
            ctx.lineTo(-15 - Math.random() * 10, 0);
            ctx.strokeStyle = '#f5ca53';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Telegraph vector ring (cooldown indicator)
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 5, 0, Math.PI * 2 * Math.max(0, 1 - (this.dashTimer / this.dashCooldown)));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
        ctx.globalAlpha = 1.0;
    }
}

class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.speed = 100;
        this.isTethered = false;
        this.tetherIndex = -1; // -1 if not tethered
        this.markedForDeath = false;
    }
    update(dt, playerX, playerY, tetherManager) {
        if (this.isTethered) {
            // position is updated by tether manager
        } else {
            let dx = playerX - this.x;
            let dy = playerY - this.y;
            let dist = Math.hypot(dx, dy);
            if (dist > 0) {
                this.x += (dx / dist) * this.speed * dt;
                this.y += (dy / dist) * this.speed * dt;
            }
        }
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.isTethered ? '#f5ca53' : '#a34a4a';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class TetherManager {
    constructor() {
        this.nodes = []; // List of tethered enemies
        this.nodeSpacing = 30; // Distance between nodes
    }
    addNode(enemy) {
        enemy.isTethered = true;
        enemy.tetherIndex = this.nodes.length;
        this.nodes.push(enemy);
    }
    update(dt, player) {
        if (this.nodes.length === 0) return;

        let targetX = player.x;
        let targetY = player.y;

        for (let i = 0; i < this.nodes.length; i++) {
            let node = this.nodes[i];
            let dx = targetX - node.x;
            let dy = targetY - node.y;
            let dist = Math.hypot(dx, dy);

            if (dist > this.nodeSpacing) {
                // Move towards target
                node.x += (dx / dist) * (dist - this.nodeSpacing) * 10 * dt;
                node.y += (dy / dist) * (dist - this.nodeSpacing) * 10 * dt;
            }

            targetX = node.x;
            targetY = node.y;
        }
    }
    draw(ctx, player) {
        if (this.nodes.length === 0) return;

        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        for (let i = 0; i < this.nodes.length; i++) {
            ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
        }
        ctx.strokeStyle = '#6c9b81';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}


// Override GameEngine init, update, draw
GameEngine.prototype.initGame = function() {
    this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
    this.tetherManager = new TetherManager();
    this.enemies = [];
    this.particles = [];
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 1.0;
    this.comboMultiplier = 1;
    this.parallax = new ParallaxBackground(this.canvas.width, this.canvas.height);
    this.hazardManager = new HazardManager(this.canvas.width, this.canvas.height);
};

GameEngine.prototype.spawnEnemy = function() {
    let side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * this.canvas.width; y = -20; }
    else if (side === 1) { x = this.canvas.width + 20; y = Math.random() * this.canvas.height; }
    else if (side === 2) { x = Math.random() * this.canvas.width; y = this.canvas.height + 20; }
    else { x = -20; y = Math.random() * this.canvas.height; }
    this.enemies.push(new Enemy(x, y));
};

GameEngine.prototype.createExplosion = function(x, y, radius, color) {
    for (let i = 0; i < 15; i++) {
        this.particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 1.0,
            maxLife: 1.0,
            color: color
        });
    }
    // Also draw an immediate circle for explosion blast
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
    this.ctx.fill();
};

GameEngine.prototype.detonateTether = function() {
    if (this.tetherManager.nodes.length === 0) return;

    this.soundEngine.playSynth(150, 'sawtooth', 0.5);

    let explosionRadius = 60;

    // Apply Recoil to Player
    let firstNode = this.tetherManager.nodes[0];
    let dx = firstNode.x - this.player.x;
    let dy = firstNode.y - this.player.y;
    let dist = Math.hypot(dx, dy);
    if (dist > 0) {
        let recoilForce = 800 + (this.tetherManager.nodes.length * 100);
        this.player.vx -= (dx / dist) * recoilForce;
        this.player.vy -= (dy / dist) * recoilForce;
    }

    for (let i = 0; i < this.tetherManager.nodes.length; i++) {
        let node = this.tetherManager.nodes[i];
        this.createExplosion(node.x, node.y, explosionRadius, '#f5ca53');

        let pts = 100 * this.comboMultiplier;
        this.updateScore(pts);
        this.comboMultiplier++;

        // check for chaining with other enemies
        for (let j = 0; j < this.enemies.length; j++) {
            let other = this.enemies[j];
            if (!other.isTethered && !other.markedForDeath) {
                let dist = Math.hypot(node.x - other.x, node.y - other.y);
                if (dist < explosionRadius + other.radius) {
                    other.markedForDeath = true;
                    this.updateScore(50 * this.comboMultiplier);
                }
            }
        }

        node.markedForDeath = true;
        for (let k = 0; k < this.hazardManager.covers.length; k++) {
            let cover = this.hazardManager.covers[k];
            let dist = Math.hypot(node.x - cover.x, node.y - cover.y);
            if (dist < explosionRadius + cover.radius) {
                cover.hp -= 1;
                this.createExplosion(cover.x, cover.y, 20, '#555');
            }
        }
    }

    // Clear tether
    this.tetherManager.nodes = [];
};

GameEngine.prototype.update = function(dt) {
    if (this.inputManager.consumeDetonate()) {
        this.detonateTether();
    }

    let inputVec = this.inputManager.getMovementVector();
    if (this.inputManager.consumeDash()) {
        if (this.player.startDash(inputVec)) {
            this.soundEngine.playSynth(800, 'sine', 0.2);
        }
    }

    this.player.update(dt, inputVec, this.canvas.width, this.canvas.height);
    this.tetherManager.update(dt, this.player);
    this.parallax.update(dt, this.player);
    this.hazardManager.update(dt, this);

    let dashDisplay = document.getElementById('dashCooldownDisplay');
    if (dashDisplay) {
        if (this.player.dashTimer <= 0) {
            dashDisplay.innerText = "DASH: READY";
            dashDisplay.style.color = "#fff";
        } else {
            dashDisplay.innerText = "DASH: " + this.player.dashTimer.toFixed(1) + "s";
            dashDisplay.style.color = "#aaa";
        }
    }

    this.enemySpawnTimer -= dt;
    if (this.enemySpawnTimer <= 0) {
        this.spawnEnemy();
        this.enemySpawnTimer = this.enemySpawnInterval;
        this.enemySpawnInterval = Math.max(0.2, this.enemySpawnInterval - 0.02);
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
        let e = this.enemies[i];
        e.update(dt, this.player.x, this.player.y, this.tetherManager);        if (!e.isTethered) {
            // Check player collision -> Game Over
            let distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
            if (distToPlayer < this.player.radius + e.radius) {
                if (this.player.invulnerableTimer > 0) {
                    // Destroy enemy if player dashes into them
                    e.markedForDeath = true;
                    this.updateScore(10);
                    this.soundEngine.playSynth(200, 'square', 0.1);
                } else {
                    this.soundEngine.playSynth(100, 'square', 0.5);
                    this.setState('GAME_OVER');
                    return; // Stop updating
                }
            }

            // Check tether collision
            if (this.tetherManager.nodes.length > 0) {
                let lastNode = this.tetherManager.nodes[this.tetherManager.nodes.length - 1];
                let distToTail = Math.hypot(lastNode.x - e.x, lastNode.y - e.y);
                if (distToTail < lastNode.radius + e.radius + 15) {
                    this.tetherManager.addNode(e);
                    this.soundEngine.playSynth(400, 'sine', 0.1);
                    this.comboMultiplier = 1; // reset combo when adding new
                }
            } else {
                // if no tail, can attach directly to player if they touch the back...
                // for simplicity in this game, any enemy touching player is game over.
                // they must be collected by tail.
                // Wait, if no tail, how to get first tail?
                // Add logic: if no tail and they hit the player, we already game over'd above.
                // Actually, let's let them tether if they hit close to the player without tail?
                // No, let's say they have a "Tether Range" behind the player.
                // Let's just use the player as the lastNode if tail is empty!
                let distToTail = Math.hypot(this.player.x - e.x, this.player.y - e.y);
                // But wait, if they touch player, game over triggers first.
                // Let's make tether range slightly larger than hit range.
                if (distToTail < this.player.radius + e.radius + 20 && distToTail >= this.player.radius + e.radius) {
                     this.tetherManager.addNode(e);
                     this.soundEngine.playSynth(400, 'sine', 0.1);
                }
            }
        }

        if (e.markedForDeath) {
            this.createExplosion(e.x, e.y, 10, '#a34a4a');
            this.enemies.splice(i, 1);
        }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) {
            this.particles.splice(i, 1);
        }
    }
};

GameEngine.prototype.draw = function() {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.parallax.draw(this.ctx, this.canvas.width, this.canvas.height);

    this.hazardManager.draw(this.ctx);
    this.tetherManager.draw(this.ctx, this.player);

    for (let e of this.enemies) {
        e.draw(this.ctx);
    }

    this.player.draw(this.ctx);

    for (let p of this.particles) {
        this.ctx.globalAlpha = p.life / p.maxLife;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;
};

window.onload = () => {
    window.game = new GameEngine();
};
