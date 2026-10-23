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
class ParallaxEnvironment {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [];
        this.initLayers();
    }
    initLayers() {
        this.layers = [
            { depth: 0.2, color: '#09152b', elements: this.gen(40, 1, 3, -15, 5) },
            { depth: 0.5, color: '#0f274a', elements: this.gen(20, 5, 12, -30, 10) },
            { depth: 1.0, color: '#1a3c6b', elements: this.gen(15, 2, 6, -60, 20) }
        ];
    }
    gen(count, minSize, maxSize, sy, sx) {
        let arr = [];
        for(let i=0; i<count; i++) {
            arr.push({ x: Math.random(), y: Math.random(), size: minSize + Math.random()*(maxSize-minSize), sy: sy, sx: sx });
        }
        return arr;
    }
    resize(w, h) { this.width = w; this.height = h; }
    update(dt) {
        for (let layer of this.layers) {
            for (let el of layer.elements) {
                el.x += (el.sx * dt * layer.depth) / 1000;
                el.y += (el.sy * dt * layer.depth) / 1000;
                if (el.x > 1) el.x -= 1; if (el.x < 0) el.x += 1;
                if (el.y > 1) el.y -= 1; if (el.y < 0) el.y += 1;
            }
        }
    }
    draw(ctx) {
        for (let layer of this.layers) {
            ctx.fillStyle = layer.color;
            for (let el of layer.elements) {
                ctx.beginPath();
                ctx.arc(el.x * this.width, el.y * this.height, el.size * (Math.min(this.width, this.height) / 800), 0, Math.PI*2);
                ctx.fill();
            }
        }
    }
}
class CoralCover extends GridEntity {
    constructor(x, y) { super(x, y, "#008855"); this.isHazard = true; this.hp = 2; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx - cellSize*0.4, cy + cellSize*0.4); ctx.lineTo(cx - cellSize*0.2, cy - cellSize*0.2);
        ctx.lineTo(cx + cellSize*0.1, cy - cellSize*0.4); ctx.lineTo(cx + cellSize*0.4, cy + cellSize*0.3);
        ctx.closePath(); ctx.fill();
        if (this.hp < 2) {
            ctx.strokeStyle = "#00ffaa"; ctx.lineWidth = 2; ctx.beginPath();
            ctx.moveTo(cx - cellSize*0.3, cy + cellSize*0.1); ctx.lineTo(cx + cellSize*0.3, cy + cellSize*0.1); ctx.stroke();
        }
    }
}
class HydroVent extends GridEntity {
    constructor(x, y) { super(x, y, "#222222"); this.isHazard = true; this.hp = 9999; this.activeTimer = 0; this.turnCounter = Math.floor(Math.random() * 3); }
    onTurnEnd() {
        this.turnCounter++;
        if (this.turnCounter >= 4) { this.turnCounter = 0; this.activeTimer = 1.0; } else { this.activeTimer = 0; }
    }
    draw(ctx, cellSize, offset) {
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.fillStyle = "#333"; ctx.beginPath(); ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#111"; ctx.beginPath(); ctx.arc(cx, cy, cellSize * 0.15, 0, Math.PI * 2); ctx.fill();
        if (this.activeTimer > 0) { ctx.fillStyle = "rgba(255, 100, 0, 0.7)"; ctx.beginPath(); ctx.arc(cx, cy, cellSize * 0.4 * (1 + Math.random()*0.2), 0, Math.PI * 2); ctx.fill(); }
        else if (this.turnCounter === 3) { ctx.fillStyle = "rgba(255, 200, 0, 0.3)"; ctx.beginPath(); ctx.arc(cx, cy, cellSize * 0.35, 0, Math.PI * 2); ctx.fill(); }
    }
}
class OceanCurrent extends GridEntity {
    constructor(x, y, dx, dy) { super(x, y, "rgba(0, 150, 255, 0.2)"); this.isHazard = true; this.hp = 9999; this.pushDir = new Vector2(dx, dy); }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let rx = offset.x + this.visualPos.x * cellSize;
        let ry = offset.y + this.visualPos.y * cellSize;
        ctx.fillRect(rx, ry, cellSize, cellSize);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; ctx.lineWidth = 2;
        let cx = rx + cellSize / 2; let cy = ry + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx - this.pushDir.x * cellSize*0.2, cy - this.pushDir.y * cellSize*0.2); ctx.lineTo(cx + this.pushDir.x * cellSize*0.2, cy + this.pushDir.y * cellSize*0.2);
        let px = -this.pushDir.y * cellSize*0.1; let py = this.pushDir.x * cellSize*0.1;
        ctx.lineTo(cx + this.pushDir.x * cellSize*0.1 + px, cy + this.pushDir.y * cellSize*0.1 + py);
        ctx.moveTo(cx + this.pushDir.x * cellSize*0.2, cy + this.pushDir.y * cellSize*0.2);
        ctx.lineTo(cx + this.pushDir.x * cellSize*0.1 - px, cy + this.pushDir.y * cellSize*0.1 - py); ctx.stroke();
    }
}

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

        this.env = new ParallaxEnvironment(this.width, this.height);
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

        this.progression = new ProgressionSystem();

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
                    this.env.resize(this.width, this.height);
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

        this.progression.reset();

        this.entities = [];

        let cx = Math.floor(this.gridW / 2);
        let cy = Math.floor(this.gridH / 2);
        this.player = new Player(cx, cy);
        this.entities.push(this.player);

        this.spawnEnemy();
        this.spawnEnemy();
        this.spawnOrb();
        this.spawnHazards();

        this.updateGridTransform();
        this.state = 'PLAYING';
        this.sound.playStart();

        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.save();
    }

    spawnHazards() {
        for(let i=0; i<3; i++) {
            let pos = this.getRandomEmptyPos();
            if(pos) this.entities.push(new CoralCover(pos.x, pos.y));
        }
        for(let i=0; i<2; i++) {
            let pos = this.getRandomEmptyPos();
            if(pos) this.entities.push(new HydroVent(pos.x, pos.y));
        }
        for(let i=0; i<2; i++) {
            let pos = this.getRandomEmptyPos();
            if(pos) {
                let dx = Math.random() < 0.5 ? 1 : -1;
                let dy = Math.random() < 0.5 ? 1 : -1;
                if (Math.random() < 0.5) dx = 0; else dy = 0;
                this.entities.push(new OceanCurrent(pos.x, pos.y, dx, dy));
            }
        }
    }

    spawnBoss() {
        let pos = this.getRandomEmptyPos();
        if (pos) {
            let bossObj = Math.random() < 0.5 ? new TrenchLeviathan(pos.x, pos.y) : new AbyssalConstructor(pos.x, pos.y);
            this.entities.push(bossObj);
            this.sound.playSelect();
        }
    }

    spawnEnemy() {
        let pos = this.getRandomEmptyPos();
        if (pos) {
            let r = Math.random();
            let enemyObj;
            if (r < 0.16) enemyObj = new SwarmerEnemy(pos.x, pos.y);
            else if (r < 0.32) enemyObj = new BruiserEnemy(pos.x, pos.y);
            else if (r < 0.48) enemyObj = new SniperEnemy(pos.x, pos.y);
            else if (r < 0.64) enemyObj = new SpawnerEnemy(pos.x, pos.y);
            else if (r < 0.80) enemyObj = new HazardEnemy(pos.x, pos.y);
            else enemyObj = new BlitzEnemy(pos.x, pos.y);
            this.entities.push(enemyObj);
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
        this.env.update(dt);
        for (let e of this.entities) {
            if (e.update) e.update(dt);
        }

        if (this.state === 'PLAYING') {
            this.progression.update(dt);
        }

        if (this.state === 'TITLE') {
            if (this.input.wasKeyPressed('Space') || this.input.wasKeyPressed('Enter') || this.input.pointers.length > 0) {
                this.initGame();
            }
        } else if (this.state === 'PLAYING') {
            if (this.progression.inDraft) {
                this.progression.handleDraftInput(this, this.input);
                return;
            }
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
                let hitEnemy = targetEntities.find(e => e instanceof Enemy || e instanceof CoralCover);

                if (hitEnemy) {
                    if (hitEnemy.isBoss) {
                        hitEnemy.takeDamage(1, this);
                        if (hitEnemy.hp <= 0) {
                            this.entities = this.entities.filter(e => e !== hitEnemy);
                            this.score += 500 * this.progression.getMultiplier();
                            this.progression.addCombo(5);
                            this.sound.playExplosion();
                        } else {
                            this.sound.playShoot();
                        }
                    } else {
                        hitEnemy.hp--;
                        if (hitEnemy.hp <= 0) {
                            this.entities = this.entities.filter(e => e !== hitEnemy);
                            if (hitEnemy instanceof Enemy) {
                                this.score += 10 * this.progression.getMultiplier();
                                this.progression.addCombo(1);
                                if (Math.random() < 0.2) {
                                    this.entities.push(new Pickup(hitEnemy.gridPos.x, hitEnemy.gridPos.y));
                                }
                            }
                            this.sound.playHit();
                        } else {
                            this.sound.playShoot();
                        }
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
            let multi = this.progression.getMultiplier();
            this.score += 50 * multi;
            this.progression.addCombo(1);
            this.sound.playScore();
            if (!item.isPickup) {
                this.spawnOrb(); // Spawn another
            }
        }

        // Enemy AI
        for (let e of this.entities) {
            if (e instanceof Enemy) {
                this.updateEnemyAI(e);
            }
        }

        for (let e of this.entities) {
            if (e instanceof HydroVent) e.onTurnEnd();
        }
        for (let e of this.entities) {
            if (e instanceof HydroVent && e.activeTimer > 0) {
                let hit = this.getEntitiesAt(e.gridPos.x, e.gridPos.y).find(t => t instanceof Enemy || t === this.player);
                if (hit) {
                    if(hit === this.player) { hit.hp--; this.sound.playExplosion(); this.player.invulnTimer = 0.3; if(this.player.hp<=0) { this.gameOver(); return; } }
                    else if(hit.isBoss) {
                        hit.takeDamage(1, this);
                        if (hit.hp <= 0) { this.entities = this.entities.filter(x => x !== hit); this.sound.playExplosion(); this.score+=500; }
                    }
                    else {
                        hit.hp--;
                        if(hit.hp <= 0) { this.entities = this.entities.filter(x => x !== hit); this.sound.playHit(); this.score+=10; }
                    }
                }
            }
            if (e instanceof OceanCurrent) {
                let t = this.getEntitiesAt(e.gridPos.x, e.gridPos.y).find(x => x instanceof Enemy || x === this.player);
                if (t) {
                    let nextX = t.gridPos.x + e.pushDir.x; let nextY = t.gridPos.y + e.pushDir.y;
                    if (nextX >= this.activeRect.minX && nextX <= this.activeRect.maxX && nextY >= this.activeRect.minY && nextY <= this.activeRect.maxY) {
                        let blocked = this.getEntityAt(nextX, nextY);
                        if (!blocked || blocked instanceof OceanCurrent || blocked instanceof HydroVent || blocked.isItem) {
                            t.gridPos.x = nextX; t.gridPos.y = nextY;
                        }
                    }
                }
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
            this.progression.triggerDraft();
            if (this.wave % 5 === 0) {
                this.spawnBoss();
            } else {
                this.spawnEnemy();
            }
        }
    }

    updateEnemyAI(enemy) {
        if (typeof enemy.aiMove === "function") {
            enemy.aiMove(this);
            return;
        }
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
        this.env.draw(this.ctx);

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
            // Draw items first, then hazards, then enemies, then player
            for (let e of this.entities.filter(e => e.isItem)) e.draw(this.ctx, this.cellSize, this.gridOffset);
            for (let e of this.entities.filter(e => e.isHazard)) e.draw(this.ctx, this.cellSize, this.gridOffset);
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

            let boss = this.entities.find(e => e.isBoss);
            if (boss && this.state !== 'GAME_OVER') {
                boss.drawBossUI(this.ctx, this.width, this.height);
            }

            this.progression.drawComboUI(this.ctx, this.width, this.height);
            this.progression.drawDraftUI(this.ctx, this.width, this.height);

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

class SwarmerEnemy extends Enemy {
    constructor(x, y) { super(x, y); this.color = "#ff6699"; this.telegraphActive = false; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2);
        ctx.fill();
        if (this.telegraphActive) {
            ctx.strokeStyle = "rgba(255, 100, 150, 0.8)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, cellSize * 0.45, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    aiMove(engine) {
        let dx = engine.player.gridPos.x - this.gridPos.x;
        let dy = engine.player.gridPos.y - this.gridPos.y;
        this.telegraphActive = (Math.abs(dx) <= 2 && Math.abs(dy) <= 2);

        let moveX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
        let moveY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);

        if (Math.abs(dx) > Math.abs(dy)) { moveY = 0; } else { moveX = 0; }
        this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
    }
    tryMove(engine, nextX, nextY) {
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
            }
        }
    }
}

class BruiserEnemy extends Enemy {
    constructor(x, y) { super(x, y); this.color = "#ff3333"; this.hp = 3; this.maxHp = 3; this.telegraphDir = null; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.fillRect(cx - cellSize * 0.35, cy - cellSize * 0.35, cellSize * 0.7, cellSize * 0.7);

        ctx.fillStyle = "black";
        for(let i=0; i<this.hp; i++) {
            ctx.fillRect(cx - cellSize * 0.2 + i * (cellSize*0.2), cy - cellSize * 0.1, cellSize * 0.1, cellSize * 0.2);
        }

        if (this.telegraphDir) {
            ctx.fillStyle = "rgba(255, 50, 50, 0.5)";
            ctx.fillRect(offset.x + (this.gridPos.x + this.telegraphDir.x) * cellSize, offset.y + (this.gridPos.y + this.telegraphDir.y) * cellSize, cellSize, cellSize);
        }
    }
    aiMove(engine) {
        if (this.telegraphDir) {
            let nextX = this.gridPos.x + this.telegraphDir.x;
            let nextY = this.gridPos.y + this.telegraphDir.y;
            this.tryMove(engine, nextX, nextY);
            this.telegraphDir = null;
        } else {
            let dx = engine.player.gridPos.x - this.gridPos.x;
            let dy = engine.player.gridPos.y - this.gridPos.y;
            let moveX = 0, moveY = 0;
            if (Math.abs(dx) > Math.abs(dy)) { moveX = dx > 0 ? 1 : -1; } else if (dy !== 0) { moveY = dy > 0 ? 1 : -1; }

            if (Math.abs(dx) + Math.abs(dy) === 1) {
                this.telegraphDir = new Vector2(moveX, moveY);
            } else {
                this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
            }
        }
    }
    tryMove(engine, nextX, nextY) {
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
            }
        }
    }
}

class SniperEnemy extends Enemy {
    constructor(x, y) { super(x, y); this.color = "#33ffcc"; this.aimTimer = 0; this.aimTarget = null; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cellSize * 0.4);
        ctx.lineTo(cx + cellSize * 0.3, cy + cellSize * 0.2);
        ctx.lineTo(cx - cellSize * 0.3, cy + cellSize * 0.2);
        ctx.closePath();
        ctx.fill();

        if (this.aimTarget) {
            ctx.strokeStyle = "rgba(50, 255, 200, 0.8)";
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(offset.x + this.aimTarget.x * cellSize + cellSize / 2, offset.y + this.aimTarget.y * cellSize + cellSize / 2);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    aiMove(engine) {
        let dx = engine.player.gridPos.x - this.gridPos.x;
        let dy = engine.player.gridPos.y - this.gridPos.y;

        if (this.aimTarget) {
            if (engine.player.gridPos.x === this.aimTarget.x && engine.player.gridPos.y === this.aimTarget.y) {
                engine.player.hp--;
                if (engine.player.hp <= 0) engine.gameOver();
            }
            this.aimTarget = null;
            this.aimTimer = 0;
            // Move away
            let moveX = dx > 0 ? -1 : (dx < 0 ? 1 : 0);
            let moveY = dy > 0 ? -1 : (dy < 0 ? 1 : 0);
            if (Math.abs(dx) > Math.abs(dy)) { moveY = 0; } else { moveX = 0; }
            this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
        } else {
            if (dx === 0 || dy === 0) {
                this.aimTimer++;
                if (this.aimTimer >= 1) {
                    this.aimTarget = new Vector2(engine.player.gridPos.x, engine.player.gridPos.y);
                }
            } else {
                this.aimTimer = 0;
                let moveX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
                let moveY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
                if (Math.abs(dx) < Math.abs(dy)) { moveY = 0; } else { moveX = 0; }
                this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
            }
        }
    }
    tryMove(engine, nextX, nextY) {
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
            }
        }
    }
}

class SpawnerEnemy extends Enemy {
    constructor(x, y) { super(x, y); this.color = "#cc33ff"; this.spawnTimer = 0; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx - cellSize * 0.3, cy);
        ctx.lineTo(cx, cy - cellSize * 0.4);
        ctx.lineTo(cx + cellSize * 0.3, cy);
        ctx.lineTo(cx, cy + cellSize * 0.4);
        ctx.closePath();
        ctx.fill();

        if (this.spawnTimer >= 2) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - cellSize * 0.4, cy - cellSize * 0.4, cellSize * 0.8, cellSize * 0.8);
        }
    }
    aiMove(engine) {
        this.spawnTimer++;
        if (this.spawnTimer >= 3) {
            let emptyAdj = [];
            let dirs = [[0,1],[1,0],[0,-1],[-1,0]];
            for (let d of dirs) {
                let nx = this.gridPos.x + d[0];
                let ny = this.gridPos.y + d[1];
                if (nx >= engine.activeRect.minX && nx <= engine.activeRect.maxX &&
                    ny >= engine.activeRect.minY && ny <= engine.activeRect.maxY) {
                    if (!engine.getEntityAt(nx, ny)) emptyAdj.push(new Vector2(nx, ny));
                }
            }
            if (emptyAdj.length > 0) {
                let p = emptyAdj[Math.floor(Math.random() * emptyAdj.length)];
                engine.entities.push(new SwarmerEnemy(p.x, p.y));
            }
            this.spawnTimer = 0;
            // Move away from player
            let dx = engine.player.gridPos.x - this.gridPos.x;
            let dy = engine.player.gridPos.y - this.gridPos.y;
            let moveX = dx > 0 ? -1 : (dx < 0 ? 1 : 0);
            let moveY = dy > 0 ? -1 : (dy < 0 ? 1 : 0);
            if (Math.abs(dx) > Math.abs(dy)) { moveY = 0; } else { moveX = 0; }
            this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
        } else {
            // Flee
            let dx = engine.player.gridPos.x - this.gridPos.x;
            let dy = engine.player.gridPos.y - this.gridPos.y;
            let moveX = dx > 0 ? -1 : (dx < 0 ? 1 : 0);
            let moveY = dy > 0 ? -1 : (dy < 0 ? 1 : 0);
            if (Math.abs(dx) > Math.abs(dy)) { moveY = 0; } else { moveX = 0; }
            this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
        }
    }
    tryMove(engine, nextX, nextY) {
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
            }
        }
    }
}

class HazardEnemy extends Enemy {
    constructor(x, y) { super(x, y); this.color = "#ffaa00"; this.trail = []; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cellSize * 0.3);
        ctx.lineTo(cx + cellSize * 0.4, cy + cellSize * 0.2);
        ctx.lineTo(cx - cellSize * 0.4, cy + cellSize * 0.2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "rgba(255, 170, 0, 0.4)";
        for (let p of this.trail) {
             ctx.fillRect(offset.x + p.x * cellSize, offset.y + p.y * cellSize, cellSize, cellSize);
        }
    }
    aiMove(engine) {
        let dx = engine.player.gridPos.x - this.gridPos.x;
        let dy = engine.player.gridPos.y - this.gridPos.y;
        let moveX = 0, moveY = 0;
        if (Math.abs(dx) > Math.abs(dy)) { moveX = dx > 0 ? 1 : -1; } else if (dy !== 0) { moveY = dy > 0 ? 1 : -1; }

        let nextX = this.gridPos.x + moveX;
        let nextY = this.gridPos.y + moveY;

        let oldX = this.gridPos.x;
        let oldY = this.gridPos.y;

        if (this.tryMove(engine, nextX, nextY)) {
            this.trail.push(new Vector2(oldX, oldY));
            if (this.trail.length > 2) this.trail.shift();
        }

        // Damage player if on trail
        for (let p of this.trail) {
            if (engine.player.gridPos.x === p.x && engine.player.gridPos.y === p.y) {
                engine.player.hp--;
                if (engine.player.hp <= 0) engine.gameOver();
            }
        }
    }
    tryMove(engine, nextX, nextY) {
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
                return true;
            }
        }
        return false;
    }
}

class BlitzEnemy extends Enemy {
    constructor(x, y) { super(x, y); this.color = "#ff0000"; this.dashCharged = false; }
    draw(ctx, cellSize, offset) {
        ctx.fillStyle = this.color;
        let cx = offset.x + this.visualPos.x * cellSize + cellSize / 2;
        let cy = offset.y + this.visualPos.y * cellSize + cellSize / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - cellSize * 0.4);
        ctx.lineTo(cx + cellSize * 0.2, cy + cellSize * 0.4);
        ctx.lineTo(cx - cellSize * 0.2, cy + cellSize * 0.4);
        ctx.closePath();
        ctx.fill();

        if (this.dashCharged) {
            ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - cellSize * 0.3, cy);
            ctx.lineTo(cx + cellSize * 0.3, cy);
            ctx.stroke();
        }
    }
    aiMove(engine) {
        let dx = engine.player.gridPos.x - this.gridPos.x;
        let dy = engine.player.gridPos.y - this.gridPos.y;

        if (this.dashCharged) {
            let moveX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
            let moveY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
            if (Math.abs(dx) > Math.abs(dy)) { moveY = 0; } else { moveX = 0; }

            let nx = this.gridPos.x + moveX * 2;
            let ny = this.gridPos.y + moveY * 2;
            this.tryMove(engine, nx, ny);
            this.dashCharged = false;
        } else {
            if (Math.abs(dx) + Math.abs(dy) === 2 || Math.abs(dx) + Math.abs(dy) === 3) {
                this.dashCharged = true;
            } else {
                let moveX = dx > 0 ? 1 : (dx < 0 ? -1 : 0);
                let moveY = dy > 0 ? 1 : (dy < 0 ? -1 : 0);
                if (Math.abs(dx) > Math.abs(dy)) { moveY = 0; } else { moveX = 0; }
                this.tryMove(engine, this.gridPos.x + moveX, this.gridPos.y + moveY);
            }
        }
    }
    tryMove(engine, nextX, nextY) {
        if (nextX >= engine.activeRect.minX && nextX <= engine.activeRect.maxX &&
            nextY >= engine.activeRect.minY && nextY <= engine.activeRect.maxY) {
            let block = engine.getEntityAt(nextX, nextY);
            if (!block || !(block instanceof Enemy)) {
                this.gridPos.x = nextX;
                this.gridPos.y = nextY;
            }
        }
    }
}
