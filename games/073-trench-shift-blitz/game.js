// --- Vector2 ---
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    mult(n) { return new Vector2(this.x * n, this.y * n); }
    div(n) { return new Vector2(this.x / n, this.y / n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    magSq() { return this.x * this.x + this.y * this.y; }
    normalize() { let m = this.mag(); return m === 0 ? new Vector2(0, 0) : this.div(m); }
    dist(v) { return this.sub(v).mag(); }
    equals(v) { return this.x === v.x && this.y === v.y; }
    copy() { return new Vector2(this.x, this.y); }
}

// --- InputManager ---
class InputManager {
    constructor() {
        this.keys = {};
        this.keysDown = {};
        this.pointers = [];
        this.touchStart = null;
        this.swipeDir = null;

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            this.keysDown[e.code] = true;
            if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });

        const canvas = document.getElementById('gameCanvas');
        canvas.addEventListener('pointerdown', e => {
            this.pointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });
            this.touchStart = { x: e.clientX, y: e.clientY };
        });
        canvas.addEventListener('pointermove', e => {
            let p = this.pointers.find(p => p.id === e.pointerId);
            if (p) {
                p.x = e.clientX;
                p.y = e.clientY;
            }
        });
        canvas.addEventListener('pointerup', e => this.handlePointerUp(e));
        canvas.addEventListener('pointercancel', e => this.handlePointerUp(e));
    }

    handlePointerUp(e) {
        this.pointers = this.pointers.filter(p => p.id !== e.pointerId);
        if (this.touchStart) {
            let dx = e.clientX - this.touchStart.x;
            let dy = e.clientY - this.touchStart.y;
            if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.swipeDir = dx > 0 ? "RIGHT" : "LEFT";
                } else {
                    this.swipeDir = dy > 0 ? "DOWN" : "UP";
                }
            }
            this.touchStart = null;
        }
    }

    isKeyDown(code) { return !!this.keys[code]; }
    wasKeyPressed(code) {
        if (this.keysDown[code]) {
            this.keysDown[code] = false;
            return true;
        }
        return false;
    }

    getSwipe() {
        if (this.swipeDir) {
            let dir = this.swipeDir;
            this.swipeDir = null;
            return dir;
        }
        return null;
    }

    clear() {
        this.keysDown = {};
        this.swipeDir = null;
    }
}

// --- SaveManager ---
class SaveManager {
    constructor(key) {
        this.key = key;
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                mute: false,
                musicVol: 1.0,
                sfxVol: 1.0
            }
        };
        this.load();
    }
    load() {
        try {
            let saved = localStorage.getItem(this.key);
            if (saved) {
                let parsed = JSON.parse(saved);
                this.data = { ...this.data, ...parsed };
                // ensure nested options exist
                if(parsed.options) {
                    this.data.options = { ...this.data.options, ...parsed.options };
                }
            }
        } catch (e) {
            console.warn("Could not load save data", e);
        }
    }
    save() {
        try {
            localStorage.setItem(this.key, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Could not save data", e);
        }
    }
}

// --- SoundEngine ---
class SoundEngine {
    constructor(saveManager) {
        this.saveManager = saveManager;
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

            this.musicGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.updateVolumes();
            this.initialized = true;
        } catch (e) {
            console.warn("AudioContext not supported", e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    updateVolumes() {
        if (!this.initialized) return;
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.mute ? 0 : 1.0;
        this.sfxGain.gain.value = opts.sfxVol;
        this.musicGain.gain.value = opts.musicVol;
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (!this.initialized) return;
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

    playShoot() { this.playTone(400, 'square', 0.1, 0.5); }
    playHit() { this.playTone(150, 'sawtooth', 0.2, 0.7); }
    playExplosion() { this.playTone(100, 'square', 0.4, 0.8); }
    playSelect() { this.playTone(600, 'sine', 0.1, 0.5); }
    playStart() { this.playTone(800, 'sine', 0.3, 0.6); }
    playMove() { this.playTone(300, 'sine', 0.05, 0.3); }
    playScore() { this.playTone(1200, 'sine', 0.1, 0.4); }
}

// --- Entities ---
class GridEntity {
    constructor(x, y, color) {
        this.gridPos = new Vector2(x, y);
        this.visualPos = new Vector2(x, y);
        this.color = color;
        this.hp = 1;
        this.maxHp = 1;
        this.isPlayer = false;
        this.isItem = false;
        this.isHazard = false;
    }

    update(dt) {
        this.visualPos.x += (this.gridPos.x - this.visualPos.x) * 15 * dt;
        this.visualPos.y += (this.gridPos.y - this.visualPos.y) * 15 * dt;
    }

    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        ctx.fillRect(offset.x + this.visualPos.x * cellSize + 2, offset.y + this.visualPos.y * cellSize + 2, cellSize - 4, cellSize - 4);
    }
}

class Player extends GridEntity {
    constructor(x, y) {
        super(x, y, "#00ffff");
        this.isPlayer = true;
        this.hp = 3;
        this.maxHp = 3;

        this.facing = new Vector2(0, -1);
        this.recoilTimer = 0;
        this.thrustTimer = 0;
        this.invulnTimer = 0;

        this.dashCooldown = 0;
        this.dashMaxCooldown = 5;
        this.dashActive = false;
    }

    update(dt) {
        super.update(dt);
        if (this.recoilTimer > 0) this.recoilTimer -= dt;
        if (this.thrustTimer > 0) this.thrustTimer -= dt;
        if (this.invulnTimer > 0) this.invulnTimer -= dt;
    }

    draw(ctx, cellSize, offset) {
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 15) % 2 === 0) return; // blink

        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;

        let rx = 0;
        let ry = 0;
        if (this.recoilTimer > 0) {
            let recoilMag = this.recoilTimer * 20;
            rx = -this.facing.x * recoilMag;
            ry = -this.facing.y * recoilMag;
        }

        ctx.save();
        ctx.translate(cx + rx, cy + ry);
        let angle = Math.atan2(this.facing.y, this.facing.x);
        ctx.rotate(angle);

        if (this.thrustTimer > 0) {
            ctx.fillStyle = "#ffaa00";
            ctx.beginPath();
            ctx.moveTo(-cellSize * 0.35, 0);
            ctx.lineTo(-cellSize * 0.5 - Math.random() * cellSize * 0.3, -cellSize * 0.2);
            ctx.lineTo(-cellSize * 0.5 - Math.random() * cellSize * 0.3, cellSize * 0.2);
            ctx.fill();
        }

        if (this.dashActive) {
            ctx.strokeStyle = "rgba(0, 255, 255, 0.6)";
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(cellSize * 0.4, 0);
            ctx.lineTo(cellSize * 2.5, 0);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Multi-part procedural body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, cellSize * 0.4, cellSize * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cellSize * 0.1, 0, cellSize * 0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#008888";
        ctx.beginPath();
        ctx.moveTo(-cellSize * 0.1, cellSize * 0.2);
        ctx.lineTo(-cellSize * 0.4, cellSize * 0.45);
        ctx.lineTo(-cellSize * 0.25, cellSize * 0.15);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-cellSize * 0.1, -cellSize * 0.2);
        ctx.lineTo(-cellSize * 0.4, -cellSize * 0.45);
        ctx.lineTo(-cellSize * 0.25, -cellSize * 0.15);
        ctx.fill();

        ctx.restore();
    }
}

class Enemy extends GridEntity {
    constructor(x, y) {
        super(x, y, "#ff3366");
    }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cellSize * 0.4);
        ctx.lineTo(cx + cellSize * 0.4, cy + cellSize * 0.4);
        ctx.lineTo(cx - cellSize * 0.4, cy + cellSize * 0.4);
        ctx.closePath();
        ctx.fill();
    }
}

class Orb extends GridEntity {
    constructor(x, y) {
        super(x, y, "#ffff00");
        this.isItem = true;
    }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }
}


// --- Game Engine ---
class Engine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.input = new InputManager();
        this.saveManager = new SaveManager('arcade_game_073_073-trench-shift-blitz_v1');
        this.sound = new SoundEngine(this.saveManager);

        this.state = 'TITLE'; // TITLE, PLAYING, GAME_OVER, PAUSED
        this.lastTime = performance.now();

        // Grid setup
        this.gridW = 11;
        this.gridH = 11;
        this.cellSize = 40;
        this.gridOffset = new Vector2(0, 0);
        this.activeRect = { minX: 0, maxX: this.gridW - 1, minY: 0, maxY: this.gridH - 1 };

        this.entities = [];
        this.player = null;

        this.score = 0;
        this.turns = 0;
        this.wave = 1;
        this.shrinksPending = 0;
        this.turnsUntilShrink = 5;

        this.setupResize();
        this.bindEvents();

        requestAnimationFrame(t => this.loop(t));
    }

    setupResize() {
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === document.body || entry.target === this.canvas.parentElement) {
                    this.width = window.innerWidth;
                    this.height = window.innerHeight;
                    this.canvas.width = this.width;
                    this.canvas.height = this.height;
                    this.updateGridTransform();
                }
            }
        });
        resizeObserver.observe(document.body);
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

        const initAudio = () => {
            if (!this.sound.initialized) {
                this.sound.init();
            }
            this.sound.resume();
        };
        window.addEventListener('keydown', initAudio, { once: false });
        window.addEventListener('pointerdown', initAudio, { once: false });
    }

    updateGridTransform() {
        let actW = (this.activeRect.maxX - this.activeRect.minX + 1);
        let actH = (this.activeRect.maxY - this.activeRect.minY + 1);

        let maxCellW = this.width / (this.gridW + 2);
        let maxCellH = this.height / (this.gridH + 4); // Extra room for UI
        this.cellSize = Math.min(maxCellW, maxCellH, 60);

        let pw = this.gridW * this.cellSize;
        let ph = this.gridH * this.cellSize;

        this.gridOffset.x = (this.width - pw) / 2;
        this.gridOffset.y = (this.height - ph) / 2 + 20;
    }

    initGame() {
        this.gridW = 15;
        this.gridH = 15;
        this.activeRect = { minX: 0, maxX: this.gridW - 1, minY: 0, maxY: this.gridH - 1 };

        this.score = 0;
        this.turns = 0;
        this.wave = 1;
        this.turnsUntilShrink = 8;

        this.entities = [];

        let cx = Math.floor(this.gridW / 2);
        let cy = Math.floor(this.gridH / 2);
        this.player = new Player(cx, cy);
        this.entities.push(this.player);

        this.spawnEnemy();
        this.spawnEnemy();
        this.spawnOrb();

        this.updateGridTransform();
        this.state = 'PLAYING';
        this.sound.playStart();

        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.save();
    }

    spawnEnemy() {
        let pos = this.getRandomEmptyPos();
        if (pos) {
            this.entities.push(new Enemy(pos.x, pos.y));
        }
    }

    spawnOrb() {
        let pos = this.getRandomEmptyPos();
        if (pos) {
            this.entities.push(new Orb(pos.x, pos.y));
        }
    }

    getRandomEmptyPos() {
        let attempts = 0;
        while (attempts < 50) {
            let x = Math.floor(Math.random() * (this.activeRect.maxX - this.activeRect.minX + 1)) + this.activeRect.minX;
            let y = Math.floor(Math.random() * (this.activeRect.maxY - this.activeRect.minY + 1)) + this.activeRect.minY;
            if (!this.getEntityAt(x, y)) {
                return new Vector2(x, y);
            }
            attempts++;
        }
        return null;
    }

    getEntityAt(x, y) {
        return this.entities.find(e => e.gridPos.x === x && e.gridPos.y === y);
    }

    getEntitiesAt(x, y) {
        return this.entities.filter(e => e.gridPos.x === x && e.gridPos.y === y);
    }

    loop(time) {
        let dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.draw();

        this.input.clear();
        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        for (let e of this.entities) {
            if (e.update) e.update(dt);
        }

        if (this.state === 'TITLE') {
            if (this.input.wasKeyPressed('Space') || this.input.wasKeyPressed('Enter') || this.input.pointers.length > 0) {
                this.initGame();
            }
        } else if (this.state === 'PLAYING') {
            if (this.input.wasKeyPressed('Escape') || this.input.wasKeyPressed('KeyP')) {
                this.state = 'PAUSED';
                this.sound.playSelect();
                return;
            }
            this.handlePlayerInput();
        } else if (this.state === 'PAUSED') {
            if (this.input.wasKeyPressed('Escape') || this.input.wasKeyPressed('KeyP') || this.input.wasKeyPressed('Space')) {
                this.state = 'PLAYING';
                this.sound.playSelect();
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.input.wasKeyPressed('Space') || this.input.wasKeyPressed('Enter') || this.input.pointers.length > 0) {
                this.state = 'TITLE';
                this.sound.playSelect();
            }
        }
    }

    handlePlayerInput() {
        // Toggle dash
        if ((this.input.wasKeyPressed('ShiftLeft') || this.input.wasKeyPressed('KeyE')) && this.player.dashCooldown <= 0) {
            this.player.dashActive = !this.player.dashActive;
            if (this.player.dashActive) this.sound.playSelect();
        }

        // On-screen Dash Button Check
        for (let p of this.input.pointers) {
            let bx = this.width / 2;
            let by = this.height - 40;
            if (Math.abs(p.x - bx) < 60 && Math.abs(p.y - by) < 40) {
                if (this.player.dashCooldown <= 0) {
                    this.player.dashActive = !this.player.dashActive;
                    this.sound.playSelect();
                }
                p.x = -1000;
            }
        }

        let dx = 0;
        let dy = 0;

        if (this.input.wasKeyPressed('ArrowUp') || this.input.wasKeyPressed('KeyW')) dy = -1;
        else if (this.input.wasKeyPressed('ArrowDown') || this.input.wasKeyPressed('KeyS')) dy = 1;
        else if (this.input.wasKeyPressed('ArrowLeft') || this.input.wasKeyPressed('KeyA')) dx = -1;
        else if (this.input.wasKeyPressed('ArrowRight') || this.input.wasKeyPressed('KeyD')) dx = 1;
        else {
            let swipe = this.input.getSwipe();
            if (swipe === "UP") dy = -1;
            if (swipe === "DOWN") dy = 1;
            if (swipe === "LEFT") dx = -1;
            if (swipe === "RIGHT") dx = 1;
        }

        if (dx !== 0 || dy !== 0) {
            this.player.facing = new Vector2(dx, dy);

            let steps = this.player.dashActive ? 3 : 1;
            let finalX = this.player.gridPos.x;
            let finalY = this.player.gridPos.y;
            let hitAnyEnemy = false;

            for (let i = 0; i < steps; i++) {
                let nextX = finalX + dx;
                let nextY = finalY + dy;

                if (nextX < this.activeRect.minX || nextX > this.activeRect.maxX ||
                    nextY < this.activeRect.minY || nextY > this.activeRect.maxY) {
                    break;
                }

                let targetEntities = this.getEntitiesAt(nextX, nextY);
                let hitEnemy = targetEntities.find(e => e instanceof Enemy);

                if (hitEnemy) {
                    hitEnemy.hp--;
                    if (hitEnemy.hp <= 0) {
                        this.entities = this.entities.filter(e => e !== hitEnemy);
                        this.score += 10;
                        this.sound.playHit();
                    } else {
                        this.sound.playShoot();
                    }
                    hitAnyEnemy = true;
                    if (!this.player.dashActive && hitEnemy.hp > 0) {
                        break;
                    }
                    if (!this.player.dashActive) {
                        finalX = nextX;
                        finalY = nextY;
                        break;
                    }
                }

                finalX = nextX;
                finalY = nextY;
            }

            if (finalX !== this.player.gridPos.x || finalY !== this.player.gridPos.y || hitAnyEnemy) {
                this.player.gridPos.x = finalX;
                this.player.gridPos.y = finalY;

                if (hitAnyEnemy) {
                    this.player.recoilTimer = 0.2;
                } else {
                    this.player.thrustTimer = 0.2;
                    this.sound.playMove();
                }

                if (this.player.dashActive) {
                    this.player.dashActive = false;
                    this.player.dashCooldown = this.player.dashMaxCooldown;
                    this.player.invulnTimer = 0.5; // Dash grants brief invuln
                }

                this.advanceTurn();
            }
        }
    }

    advanceTurn() {
        this.turns++;
        this.turnsUntilShrink--;

        if (this.player.dashCooldown > 0) {
            this.player.dashCooldown--;
        }

        // Pickups
        let items = this.getEntitiesAt(this.player.gridPos.x, this.player.gridPos.y).filter(e => e.isItem);
        for (let item of items) {
            this.entities = this.entities.filter(e => e !== item);
            this.score += 50;
            this.sound.playScore();
            this.spawnOrb(); // Spawn another
        }

        // Enemy AI
        for (let e of this.entities) {
            if (e instanceof Enemy) {
                this.updateEnemyAI(e);
            }
        }

        // Collisions post-enemy-move
        let playerHit = this.getEntitiesAt(this.player.gridPos.x, this.player.gridPos.y).find(e => e instanceof Enemy);
        if (playerHit && this.player.invulnTimer <= 0) {
            this.player.hp--;
            this.sound.playExplosion();
            this.player.invulnTimer = 0.3; // brief invuln after hit
            if (this.player.hp <= 0) {
                this.gameOver();
                return;
            }
        }

        if (this.turnsUntilShrink <= 0) {
            this.shrinkArena();
            this.turnsUntilShrink = 8 + Math.floor(this.wave / 2);
            this.wave++;
            this.spawnEnemy();
        }
    }

    updateEnemyAI(enemy) {
        let dx = this.player.gridPos.x - enemy.gridPos.x;
        let dy = this.player.gridPos.y - enemy.gridPos.y;

        let moveX = 0;
        let moveY = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else if (dy !== 0) {
            moveY = dy > 0 ? 1 : -1;
        }

        let nextX = enemy.gridPos.x + moveX;
        let nextY = enemy.gridPos.y + moveY;

        if (nextX >= this.activeRect.minX && nextX <= this.activeRect.maxX &&
            nextY >= this.activeRect.minY && nextY <= this.activeRect.maxY) {

            // Only move if not blocked by another enemy
            let block = this.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                enemy.gridPos.x = nextX;
                enemy.gridPos.y = nextY;
            }
        }
    }

    shrinkArena() {
        let options = [];
        if (this.activeRect.maxX > this.activeRect.minX + 3) {
            options.push('left', 'right');
        }
        if (this.activeRect.maxY > this.activeRect.minY + 3) {
            options.push('top', 'bottom');
        }

        if (options.length === 0) {
            // Expand again (Shifting geometry)
            this.activeRect = { minX: 0, maxX: this.gridW - 1, minY: 0, maxY: this.gridH - 1 };
            this.sound.playSelect();
            return;
        }

        let choice = options[Math.floor(Math.random() * options.length)];
        if (choice === 'left') this.activeRect.minX++;
        if (choice === 'right') this.activeRect.maxX--;
        if (choice === 'top') this.activeRect.minY++;
        if (choice === 'bottom') this.activeRect.maxY--;

        this.sound.playShoot();

        // Kill entities outside
        this.entities = this.entities.filter(e => {
            if (e.gridPos.x < this.activeRect.minX || e.gridPos.x > this.activeRect.maxX ||
                e.gridPos.y < this.activeRect.minY || e.gridPos.y > this.activeRect.maxY) {
                if (e === this.player) {
                    if (this.player.invulnTimer <= 0) {
                        this.player.hp--;
                        this.player.invulnTimer = 0.3;
                    }
                    if (this.player.hp <= 0) this.gameOver();
                    else {
                        // teleport player back in
                        this.player.gridPos.x = Math.max(this.activeRect.minX, Math.min(this.player.gridPos.x, this.activeRect.maxX));
                        this.player.gridPos.y = Math.max(this.activeRect.minY, Math.min(this.player.gridPos.y, this.activeRect.maxY));
                        return true; // Keep player
                    }
                }
                return false;
            }
            return true;
        });

        this.updateGridTransform();
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.sound.playExplosion();
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        if (this.wave > this.saveManager.data.bestWaveOrCombo) {
            this.saveManager.data.bestWaveOrCombo = this.wave;
        }
        this.saveManager.data.totalScoreAccumulated += this.score;
        this.saveManager.save();
    }

    draw() {
        this.ctx.fillStyle = "#050a15";
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = "#b67083";
            this.ctx.font = "40px monospace";
            this.ctx.textAlign = "center";
            this.ctx.fillText("Trench Shift Blitz", this.width / 2, this.height / 3);
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "20px monospace";
            this.ctx.fillText("Press SPACE / Click to Start", this.width / 2, this.height / 2);
            this.ctx.font = "16px monospace";
            this.ctx.fillText("Back to Arcade (../../index.html)", this.width / 2, this.height * 0.9);
        } else if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            // Draw full grid background
            this.ctx.strokeStyle = "#112244";
            this.ctx.lineWidth = 1;
            for (let x = 0; x < this.gridW; x++) {
                for (let y = 0; y < this.gridH; y++) {
                    this.ctx.strokeRect(this.gridOffset.x + x * this.cellSize, this.gridOffset.y + y * this.cellSize, this.cellSize, this.cellSize);
                }
            }

            // Draw active arena area
            this.ctx.fillStyle = "rgba(17, 34, 68, 0.4)";
            let ax = this.gridOffset.x + this.activeRect.minX * this.cellSize;
            let ay = this.gridOffset.y + this.activeRect.minY * this.cellSize;
            let aw = (this.activeRect.maxX - this.activeRect.minX + 1) * this.cellSize;
            let ah = (this.activeRect.maxY - this.activeRect.minY + 1) * this.cellSize;
            this.ctx.fillRect(ax, ay, aw, ah);

            this.ctx.strokeStyle = "#b67083";
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(ax, ay, aw, ah);

            // Draw entities
            // Draw items first, then enemies, then player
            for (let e of this.entities.filter(e => e.isItem)) e.draw(this.ctx, this.cellSize, this.gridOffset);
            for (let e of this.entities.filter(e => e instanceof Enemy)) e.draw(this.ctx, this.cellSize, this.gridOffset);
            if (this.player && this.state !== 'GAME_OVER') this.player.draw(this.ctx, this.cellSize, this.gridOffset);

            // UI
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "20px monospace";
            this.ctx.textAlign = "left";
            this.ctx.fillText(`Score: ${this.score}`, 20, 30);
            this.ctx.fillText(`HP: ${this.player.hp}`, 20, 60);

            // Dash HUD
            let dashText = this.player.dashCooldown > 0 ? `Dash: ${this.player.dashCooldown}T` : `Dash: READY (Shift/E)`;
            if (this.player.dashActive) dashText = "Dash: ACTIVE!";
            this.ctx.fillStyle = this.player.dashActive ? "#00ffff" : (this.player.dashCooldown > 0 ? "#888" : "#fff");
            this.ctx.fillText(dashText, 20, 90);

            this.ctx.textAlign = "right";
            this.ctx.fillStyle = "#fff";
            this.ctx.fillText(`Wave: ${this.wave}`, this.width - 20, 30);
            this.ctx.fillText(`Shrink in: ${this.turnsUntilShrink}`, this.width - 20, 60);

            // On-screen Dash Button for Mobile
            let bx = this.width / 2;
            let by = this.height - 40;
            this.ctx.fillStyle = this.player.dashActive ? "rgba(0, 255, 255, 0.4)" : (this.player.dashCooldown > 0 ? "rgba(100, 100, 100, 0.4)" : "rgba(255, 255, 255, 0.2)");
            this.ctx.fillRect(bx - 60, by - 25, 120, 50);
            this.ctx.strokeStyle = this.player.dashCooldown <= 0 ? "#00ffff" : "#555";
            this.ctx.strokeRect(bx - 60, by - 25, 120, 50);
            this.ctx.fillStyle = "#fff";
            this.ctx.textAlign = "center";
            this.ctx.font = "16px monospace";
            this.ctx.fillText("DASH", bx, by + 5);

            if (this.state === 'PAUSED') {
                this.ctx.fillStyle = "rgba(0,0,0,0.7)";
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = "#fff";
                this.ctx.textAlign = "center";
                this.ctx.font = "40px monospace";
                this.ctx.fillText("PAUSED", this.width / 2, this.height / 2);
                this.ctx.font = "20px monospace";
                this.ctx.fillText("Back to Arcade (../../index.html)", this.width / 2, this.height / 2 + 50);
            } else if (this.state === 'GAME_OVER') {
                this.ctx.fillStyle = "rgba(0,0,0,0.7)";
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = "#ff3366";
                this.ctx.textAlign = "center";
                this.ctx.font = "40px monospace";
                this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 40);
                this.ctx.fillStyle = "#fff";
                this.ctx.font = "20px monospace";
                this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 10);
                this.ctx.fillText("Press SPACE to Restart", this.width / 2, this.height / 2 + 50);
                this.ctx.fillText("Back to Arcade (../../index.html)", this.width / 2, this.height / 2 + 90);
            }
        }
    }
}

window.onload = () => {
    window.game = new Engine();
};
