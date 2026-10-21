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

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.inputManager = new InputManager();
        this.soundEngine = new SoundEngine();
        this.uiManager = new UIManager(this);

        this.state = 'TITLE';
        this.lastTime = 0;
        this.score = 0;
        this.colors = {
            bg: '#222',
            player: '#6c9b81',
            tether: '#eee',
            tail: '#6c9b81',
            enemy: '#cc6666',
            boss: '#ffaa44',
            proj: '#ffaa44',
            text: '#6c9b81'
        };

        this.bindUI();
        this.setupResizeObserver();
        this.uiManager.renderMilestones();

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
        this.uiUpgrade = document.getElementById('screenUpgrade');

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
        if (newState === 'PLAYING') {
            if(this.soundEngine && this.soundEngine.startMusic) this.soundEngine.startMusic();
        } else {
            if(this.soundEngine && this.soundEngine.stopMusic) this.soundEngine.stopMusic();
        }

        this.state = newState;
        this.uiTitle.classList.remove('active');
        this.uiPaused.classList.remove('active');
        this.uiGameOver.classList.remove('active');
        this.uiHud.classList.remove('active');
        if(this.uiUpgrade) this.uiUpgrade.classList.remove('active');

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
        if(newState === 'PLAYING') {
            this.uiHud.classList.add('active');
            if(this.waveDirector) this.waveDirector.active = true;
        }
        if(newState === 'UPGRADE_DRAFT') {
            if(this.uiUpgrade) this.uiUpgrade.classList.add('active');

            let choicesContainer = document.getElementById('upgradeChoices');
            if (choicesContainer && this.upgradeManager) {
                choicesContainer.innerHTML = '';
                let choices = this.upgradeManager.getDraftChoices();
                choices.forEach(c => {
                    let btn = document.createElement('button');
                    btn.style.display = 'flex';
                    btn.style.flexDirection = 'column';
                    btn.style.alignItems = 'center';
                    btn.style.padding = '10px';
                    btn.style.width = '200px';
                    btn.innerHTML = `<strong>${c.name}</strong><span style="font-size:1rem; font-weight:normal; margin-top:5px;">${c.desc}</span>`;
                    btn.onclick = () => {
                        this.upgradeManager.applyUpgrade(c.id);
                        this.setState('PLAYING');
                    };
                    choicesContainer.appendChild(btn);
                });
            }
        }
    }

    startGame() {
        this.score = 0;
        this.colors = {
            bg: '#222',
            player: '#6c9b81',
            tether: '#eee',
            tail: '#6c9b81',
            enemy: '#cc6666',
            boss: '#ffaa44',
            proj: '#ffaa44',
            text: '#6c9b81'
        };
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
        if(this.uiManager) this.uiManager.update(dt);
        this.lastTime = time;

        if (this.state === 'PLAYING') {
            if(this.vfxManager && this.vfxManager.hitStopTimer > 0) {
                this.vfxManager.hitStopTimer -= dt;
                // Draw during hitstop but don't update core logic (dt=0)
                this.draw();
                return;
            }
            if(this.vfxManager) this.vfxManager.update(dt);
            this.update(dt);
            this.draw();
        }
    }


    draw() {
        this.ctx.fillStyle = this.colors.bg;
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
        if(window.game && window.game.saveManager) {
            window.game.saveManager.data.dashCount = (window.game.saveManager.data.dashCount || 0) + 1;
        }
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
        let pCount10 = 10; if(window.game && window.game.saveManager && window.game.saveManager.data.options && window.game.saveManager.data.options.particleDensity !== undefined) { pCount10 = Math.max(1, Math.floor(10 * window.game.saveManager.data.options.particleDensity)); } for (let i = 0; i < pCount10; i++) {
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

        if (window.game && window.game.vfxManager) {
            if (this.isDashing || Math.hypot(this.vx, this.vy) > 200) {
                if (Math.random() < 0.5) window.game.vfxManager.addAfterimage(this.x, this.y, this.radius, this.isDashing ? 'rgba(200, 100, 100, 0.4)' : 'rgba(108, 155, 129, 0.4)', this.isDashing);
            }
        }

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
            if(window.game && window.game.vfxManager && Math.random() < 0.3) {
                 let tAngle = angle + Math.PI;
                 window.game.vfxManager.addDirectionalParticles(this.x, this.y, Math.cos(tAngle), Math.sin(tAngle), 1, '#f5ca53', 200);
            }
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
        ctx.strokeStyle = window.game && window.game.colors ? window.game.colors.player : '#6c9b81';
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
    this.vfxManager = new VFXManager(this);
    this.projectiles = [];
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 1.0;
    this.comboMultiplier = 1;
    this.parallax = new ParallaxBackground(this.canvas.width, this.canvas.height);
    this.hazardManager = new HazardManager(this.canvas.width, this.canvas.height);
    this.bossManager = new BossManager(this);
    this.scoreThresholdForBoss = 2000;

    // Progression additions
    this.waveDirector = new WaveDirector(this);
    this.upgradeManager = new UpgradeManager(this);
    this.pickupManager = new PickupManager(this);
    this.maxComboDecayTimer = 5.0;
    this.comboDecayTimer = this.maxComboDecayTimer;
    this.scoreBonusMultiplier = 1.0;
    this.explosionRadiusMod = 1.0;
};

GameEngine.prototype.spawnEnemy = function() {
    let side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { x = Math.random() * this.canvas.width; y = -20; }
    else if (side === 1) { x = this.canvas.width + 20; y = Math.random() * this.canvas.height; }
    else if (side === 2) { x = Math.random() * this.canvas.width; y = this.canvas.height + 20; }
    else { x = -20; y = Math.random() * this.canvas.height; }

    let type = Math.floor(Math.random() * 5);
    if (type === 0) this.enemies.push(new SwarmerEnemy(x, y));
    else if (type === 1) this.enemies.push(new BruiserEnemy(x, y));
    else if (type === 2) this.enemies.push(new SniperEnemy(x, y));
    else if (type === 3) this.enemies.push(new SplitterEnemy(x, y));
    else this.enemies.push(new HazardEnemy(x, y));
};

GameEngine.prototype.createExplosion = function(x, y, radius, color) {
    let pCount15 = 15; if(window.game && window.game.saveManager && window.game.saveManager.data.options && window.game.saveManager.data.options.particleDensity !== undefined) { pCount15 = Math.max(1, Math.floor(15 * window.game.saveManager.data.options.particleDensity)); } for (let i = 0; i < pCount15; i++) {
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

    this.soundEngine.playPlayerHitSFX();

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
        if(this.vfxManager) {
            let pAngle = Math.random() * Math.PI * 2;
            this.vfxManager.addDirectionalParticles(node.x, node.y, Math.cos(pAngle), Math.sin(pAngle), 10, '#f5ca53', 300);
        }
        if(this.vfxManager) {
            this.vfxManager.addScreenShake(3 + this.comboMultiplier * 0.5, 0.2);
            this.vfxManager.addFloatingText(node.x, node.y, `${100 * this.comboMultiplier}`, '#f5ca53', 20 + this.comboMultiplier * 2);
        }

        let pts = 100 * this.comboMultiplier;
        this.updateScore(pts);
        this.comboMultiplier++;
        this.comboDecayTimer = this.maxComboDecayTimer;

        // check for chaining with other enemies
        for (let j = 0; j < this.enemies.length; j++) {
            let other = this.enemies[j];
            if (!other.isTethered && !other.markedForDeath) {
                let dist = Math.hypot(node.x - other.x, node.y - other.y);
                if (dist < explosionRadius + other.radius) {
                    if (other.isBoss) {
                        other.takeDamage(50 * this.comboMultiplier);
                        if(this.vfxManager) {
                            let dmgAngle = Math.atan2(other.y - node.y, other.x - node.x);
                            this.vfxManager.addDirectionalParticles(other.x, other.y, Math.cos(dmgAngle), Math.sin(dmgAngle), 5, '#ff4444', 200);
                            this.vfxManager.addFloatingText(other.x, other.y, `${50 * this.comboMultiplier}`, '#ff4444', 30);
                            this.vfxManager.addScreenShake(10, 0.4);
                            if (other.hp <= 0) {
                                this.vfxManager.triggerHitStop(0.5); // massive hitstop on boss kill
                            } else {
                                this.vfxManager.triggerHitStop(0.1);
                            }
                        }
                        if (other.hp <= 0) {
                            other.markedForDeath = true;
                            if(this.pickupManager) this.pickupManager.dropPickup(other.x, other.y);
                        }
                    } else {
                        other.markedForDeath = true;
                        this.updateScore(50 * this.comboMultiplier);
                        if(this.pickupManager) this.pickupManager.dropPickup(other.x, other.y);
                        if(this.waveDirector) this.waveDirector.onEnemyKilled();
                    }
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
    if (this.state !== 'PLAYING') return;

    const hpPercent = this.player ? (this.player.hp / this.player.maxHp) : 1.0;
    const isBossWave = this.waveDirector ? this.waveDirector.isBossWave : false;
    if(this.soundEngine && this.soundEngine.update) {
        this.soundEngine.update(dt, hpPercent, isBossWave);
    }


    if (this.waveDirector) this.waveDirector.update(dt);
    if (this.pickupManager) this.pickupManager.update(dt);

    // Combo Decay Logic
    if (this.comboMultiplier > 1) {
        this.comboDecayTimer -= dt;
        if (this.comboDecayTimer <= 0) {
            this.comboMultiplier = 1;
            this.comboDecayTimer = this.maxComboDecayTimer;
        }
    }

    let comboBar = document.getElementById('comboDecayBar');
    if (comboBar) {
        if (this.comboMultiplier > 1) {
            let pct = Math.max(0, (this.comboDecayTimer / this.maxComboDecayTimer) * 100);
            comboBar.innerText = `COMBO: ${this.comboMultiplier}x (${pct.toFixed(0)}%)`;
            comboBar.style.color = '#f5ca53';
        } else {
            comboBar.innerText = `COMBO: 1.0x (100%)`;
            comboBar.style.color = '#aaa';
        }
    }

    if (this.bossManager) {
        this.bossManager.update(dt);
        if (!this.bossManager.activeBoss && this.score >= this.scoreThresholdForBoss) {
            this.bossManager.spawnBoss();
            this.scoreThresholdForBoss += 3000;
        }
    }

    if (this.inputManager.consumeDetonate()) {
        this.detonateTether();
    }

    let inputVec = this.inputManager.getMovementVector();
    if (this.inputManager.consumeDash()) {
        if (this.player.startDash(inputVec)) {
            this.soundEngine.playShootSFX();
        }
    }

    this.player.update(dt, inputVec, this.canvas.width, this.canvas.height);
    this.tetherManager.update(dt, this.player);
            if(this.uiManager) this.uiManager.checkMilestones();
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

    if (this.bossManager && !this.bossManager.activeBoss) {
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
            this.spawnEnemy();
            this.enemySpawnTimer = this.enemySpawnInterval;
            this.enemySpawnInterval = Math.max(0.2, this.enemySpawnInterval - 0.02);
        }
    } else if (!this.bossManager) {
        this.enemySpawnTimer -= dt;
        if (this.enemySpawnTimer <= 0) {
            this.spawnEnemy();
            this.enemySpawnTimer = this.enemySpawnInterval;
            this.enemySpawnInterval = Math.max(0.2, this.enemySpawnInterval - 0.02);
        }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
        let p = this.projectiles[i];
        p.update(dt);
        if (p.life <= 0) {
            this.projectiles.splice(i, 1);
            continue;
        }

        let dist = Math.hypot(this.player.x - p.x, this.player.y - p.y);
        if (dist < this.player.radius + p.radius && this.player.invulnerableTimer <= 0) {
            this.soundEngine.playDetonateSFX();
            this.setState('GAME_OVER');
            return;
        }
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
        let e = this.enemies[i];
        e.update(dt, this.player.x, this.player.y, this.tetherManager, this);
        if (!e.isTethered) {
            // Check player collision -> Game Over
            let distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
            if (distToPlayer < this.player.radius + e.radius) {
                if (this.player.invulnerableTimer > 0) {
                    if (e.isBoss) {
                        e.takeDamage(10);
                        this.player.vx = -this.player.vx * 0.5;
                        this.player.vy = -this.player.vy * 0.5;
                        this.soundEngine.playDashSFX();
                    } else if (e.shield) {
                        e.shield = false;
                        this.player.vx = -this.player.vx * 0.5;
                        this.player.vy = -this.player.vy * 0.5;
                    } else {
                        // Destroy enemy if player dashes into them
                        e.markedForDeath = true;
                        if(this.vfxManager) {
                            this.vfxManager.addFloatingText(e.x, e.y, 'DASH!', '#fff', 15);
                            this.vfxManager.triggerHitStop(0.05);
                            this.vfxManager.addScreenShake(2, 0.1);
                        }
                        this.updateScore(10);
                        this.soundEngine.playDashSFX();
                        if(this.pickupManager) this.pickupManager.dropPickup(e.x, e.y);
                        if(this.waveDirector) this.waveDirector.onEnemyKilled();
                    }
                } else {
                    this.soundEngine.playDetonateSFX();
                    this.setState('GAME_OVER');
                    return; // Stop updating
                }
            }

            // Check tether collision
            if (!e.isBoss) {
                if (this.tetherManager.nodes.length > 0) {
                    let lastNode = this.tetherManager.nodes[this.tetherManager.nodes.length - 1];
                    let distToTail = Math.hypot(lastNode.x - e.x, lastNode.y - e.y);
                    if (distToTail < lastNode.radius + e.radius + 15) {
                        this.tetherManager.addNode(e);
                        this.soundEngine.playScrapPickupSFX();
                        this.comboMultiplier = 1; // reset combo when adding new
                    }
                } else {
                    let distToTail = Math.hypot(this.player.x - e.x, this.player.y - e.y);
                    if (distToTail < this.player.radius + e.radius + 20 && distToTail >= this.player.radius + e.radius) {
                         this.tetherManager.addNode(e);
                         this.soundEngine.playScrapPickupSFX();
                    }
                }
            }
        }

        if (e.markedForDeath) {
            this.createExplosion(e.x, e.y, 10, '#a34a4a');
            if (e.constructor.name === 'SplitterEnemy') {
                this.enemies.push(new SwarmerEnemy(e.x - 15, e.y));
                this.enemies.push(new SwarmerEnemy(e.x + 15, e.y));
            }
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
    this.ctx.save();
    if(this.vfxManager) this.vfxManager.applyScreenShake(this.ctx);

    this.hazardManager.draw(this.ctx);
    this.tetherManager.draw(this.ctx, this.player);
    if(this.pickupManager) this.pickupManager.draw(this.ctx);

    for (let e of this.enemies) {
        e.draw(this.ctx);
    }

    for (let p of this.projectiles) {
        p.draw(this.ctx);
    }

    this.player.draw(this.ctx);

    for (let p of this.particles) {
        this.ctx.globalAlpha = p.life / p.maxLife;
        if(p.isAfterimage) {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();

            // Draw a simplified afterimage chassis
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.beginPath();
            this.ctx.moveTo(15, 0);
            this.ctx.lineTo(-10, 10);
            this.ctx.lineTo(-5, 0);
            this.ctx.lineTo(-10, -10);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
    this.ctx.globalAlpha = 1.0;

    if (this.bossManager) {
        this.bossManager.draw(this.ctx);
    }

    this.ctx.restore();
    if(this.vfxManager) this.vfxManager.drawFloatingTexts(this.ctx);
};

window.onload = () => {
    window.game = new GameEngine();
};
