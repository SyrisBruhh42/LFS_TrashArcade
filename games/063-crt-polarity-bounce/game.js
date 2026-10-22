const SAVE_KEY = "arcade_game_063_063-crt-polarity-bounce_v1";

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { masterMute: false }
        };
        this.load();
    }
    load() {
        try {
            const saved = localStorage.getItem(SAVE_KEY);
            if (saved) {
                this.data = { ...this.data, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn("Save load failed", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Save failed", e);
        }
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
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.initialized = true;
    }
    playTone(freq, type, duration, vol=0.1) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playShoot() { this.playTone(400, 'square', 0.1, 0.05); }
    playHit() { this.playTone(150, 'sawtooth', 0.2, 0.1); }
    playSwitch() { this.playTone(800, 'sine', 0.1, 0.05); }
    playGameOver() { this.playTone(100, 'sawtooth', 1.0, 0.2); }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.pointer = { x: 0, y: 0, down: false, justDown: false };
        this.bind();
    }
    bind() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (window.game && window.game.sound) window.game.sound.init();
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.addEventListener('pointerdown', e => {
                this.pointer.down = true;
                this.pointer.justDown = true;
                this.updatePointer(e);
                if (window.game && window.game.sound) window.game.sound.init();
            });
            canvas.addEventListener('pointermove', e => this.updatePointer(e));
            canvas.addEventListener('pointerup', e => {
                this.pointer.down = false;
            });
        }
    }
    updatePointer(e) {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        this.pointer.x = (e.clientX - rect.left) * scaleX;
        this.pointer.y = (e.clientY - rect.top) * scaleY;
    }
    isDown(code) { return this.keys[code]; }
    consumeJustDown() {
        const down = this.pointer.justDown;
        this.pointer.justDown = false;
        return down;
    }
}

const COLORS = {
    bg: '#050510',
    pos: '#e382d8', // Positive polarity
    neg: '#00ffff', // Negative polarity
    grid: 'rgba(50, 50, 100, 0.2)',
    text: '#ffffff',
    particlePos: '#ffb3f0',
    particleNeg: '#aaffff'
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 200 + 50;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 3 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.life;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class GridSystem {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.cellSize = 40;
    }
    resize(w, h) {
        this.width = w;
        this.height = h;
    }
    draw(ctx, time) {
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = (time * 10) % this.cellSize; x < this.width; x += this.cellSize) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.height);
        }
        for (let y = (time * 10) % this.cellSize; y < this.height; y += this.cellSize) {
            ctx.moveTo(0, y);
            ctx.lineTo(this.width, y);
        }
        ctx.stroke();
    }
}

class MagneticNode {
    constructor(x, y, isPos) {
        this.x = x;
        this.y = y;
        this.isPos = isPos;
        this.radius = 20;
        this.power = 150000; // Attractive/repulsive force multiplier
        this.time = Math.random() * 10;
        this.rotation = 0;
    }
    update(dt) {
        this.time += dt;
        this.rotation += dt * 0.5;
    }
    draw(ctx) {
        const color = this.isPos ? COLORS.pos : COLORS.neg;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Outer ring
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + Math.sin(this.time * 5) * 5, 0, Math.PI * 2);
        ctx.stroke();

        // Inner glow
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.3;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Plus / Minus Symbol
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        if (this.isPos) {
            ctx.moveTo(0, -10);
            ctx.lineTo(0, 10);
        }
        ctx.stroke();

        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, isPos) {
        this.x = x;
        this.y = y;
        this.isPos = isPos;
        this.radius = 15;
        this.vx = (Math.random() - 0.5) * 150;
        this.vy = (Math.random() - 0.5) * 150;
        this.time = Math.random() * 10;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(dt, w, h) {
        this.time += dt;
        this.wobble += dt * 2;

        this.x += (this.vx + Math.sin(this.wobble) * 20) * dt;
        this.y += (this.vy + Math.cos(this.wobble) * 20) * dt;

        // Screen bounds collision
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
        if (this.x > w - this.radius) { this.x = w - this.radius; this.vx *= -1; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
        if (this.y > h - this.radius) { this.y = h - this.radius; this.vy *= -1; }
    }
    draw(ctx) {
        const color = this.isPos ? COLORS.pos : COLORS.neg;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.time * 2);
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.stroke();

        // Inner detail
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.isPos = true;
        this.speed = 300;
        this.friction = 0.99;
        this.trail = [];
        this.time = 0;
    }
    switchPolarity() {
        this.isPos = !this.isPos;
        if (window.game && window.game.sound) window.game.sound.playSwitch();
    }
    update(dt, input, w, h, nodes) {
        this.time += dt;

        // Initial launch mechanics
        if (this.vx === 0 && this.vy === 0) {
            let dx = 0, dy = 0;
            if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy = -1;
            if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy = 1;
            if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx = -1;
            if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx = 1;
            if (dx !== 0 || dy !== 0) {
                const len = Math.hypot(dx, dy);
                this.vx = (dx / len) * this.speed;
                this.vy = (dy / len) * this.speed;
            }
        }

        // Magnetic forces from nodes
        for (let node of nodes) {
            const dx = node.x - this.x;
            const dy = node.y - this.y;
            const distSq = dx*dx + dy*dy;

            // Interaction range bounds
            if (distSq > 100 && distSq < 150000) {
                const dist = Math.sqrt(distSq);
                const force = node.power / distSq;
                const isAttract = (this.isPos !== node.isPos);
                const dir = isAttract ? 1 : -1;

                this.vx += (dx / dist) * force * dir * dt;
                this.vy += (dy / dist) * force * dir * dt;
            }
        }

        // Clamp maximum speed to avoid physics glitches
        const maxSpeed = 1000;
        const curSpeed = Math.hypot(this.vx, this.vy);
        if (curSpeed > maxSpeed) {
            this.vx = (this.vx / curSpeed) * maxSpeed;
            this.vy = (this.vy / curSpeed) * maxSpeed;
        }

        // Update position based on velocity
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Wall bouncing logic
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
        if (this.x > w - this.radius) { this.x = w - this.radius; this.vx *= -1; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
        if (this.y > h - this.radius) { this.y = h - this.radius; this.vy *= -1; }

        // Maintain trail positions
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 15) this.trail.shift();
    }
    draw(ctx) {
        const color = this.isPos ? COLORS.pos : COLORS.neg;

        // Render motion trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for(let i=1; i<this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Render player core
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Render player stroke outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Internal polarity indicator
        ctx.fillStyle = '#000';
        ctx.beginPath();
        if (this.isPos) {
            ctx.fillRect(this.x - 6, this.y - 1, 12, 2);
            ctx.fillRect(this.x - 1, this.y - 6, 2, 12);
        } else {
            ctx.fillRect(this.x - 6, this.y - 1, 12, 2);
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        if (!this.canvas) return; // For safety

        this.ctx = this.canvas.getContext('2d');
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager();

        this.state = 'TITLE';

        this.width = 800;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.grid = new GridSystem(this.width, this.height);
        this.player = null;
        this.nodes = [];
        this.enemies = [];
        this.particles = [];

        this.score = 0;
        this.health = 3;
        this.wave = 1;
        this.enemySpawnTimer = 0;

        this.lastTime = performance.now();
        this.totalTime = 0;
        this.spaceWasDown = false;

        this.setupResizeObserver();
        this.setupVisibilityHandler();

        requestAnimationFrame((t) => this.loop(t));
    }

    setupResizeObserver() {
        const container = document.getElementById('game-container');
        if (!container) return;
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.width = entry.contentRect.width;
                this.height = entry.contentRect.height;
                this.canvas.width = this.width;
                this.canvas.height = this.height;
                this.grid.resize(this.width, this.height);
            }
        });
        ro.observe(container);
    }

    setupVisibilityHandler() {
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });
        window.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
    }

    reset() {
        this.player = new Player(this.width / 2, this.height / 2);
        this.nodes = [];

        // Spawn 4 nodes in a quad formation
        const paddingX = this.width * 0.25;
        const paddingY = this.height * 0.25;
        this.nodes.push(new MagneticNode(paddingX, paddingY, true));
        this.nodes.push(new MagneticNode(this.width - paddingX, paddingY, false));
        this.nodes.push(new MagneticNode(paddingX, this.height - paddingY, false));
        this.nodes.push(new MagneticNode(this.width - paddingX, this.height - paddingY, true));

        this.enemies = [];
        this.particles = [];
        this.score = 0;
        this.health = 3;
        this.wave = 1;
        this.enemySpawnTimer = 0;
    }

    spawnParticles(x, y, color, count) {
        for(let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    handleInput() {
        const spaceDown = this.input.isDown('Space');
        const pointerJustDown = this.input.consumeJustDown();
        const clickedBack = pointerJustDown && this.pointerInBackToArcade();

        if (this.state === 'TITLE') {
            if ((spaceDown && !this.spaceWasDown) || (pointerJustDown && !clickedBack)) {
                this.reset();
                this.state = 'PLAYING';
            }
            if (clickedBack) {
                window.location.href = '../../index.html';
            }
        } else if (this.state === 'PAUSED') {
            if ((spaceDown && !this.spaceWasDown) || (pointerJustDown && !clickedBack)) {
                this.state = 'PLAYING';
            }
            if (clickedBack) {
                window.location.href = '../../index.html';
            }
        } else if (this.state === 'GAME_OVER') {
            if ((spaceDown && !this.spaceWasDown) || pointerJustDown) {
                this.state = 'TITLE';
            }
        } else if (this.state === 'PLAYING') {
            if (this.input.isDown('Escape')) {
                this.state = 'PAUSED';
            }

            if ((spaceDown && !this.spaceWasDown) || pointerJustDown) {
                this.player.switchPolarity();
            }
        }

        this.spaceWasDown = spaceDown;
    }

    update(dt) {
        this.handleInput();

        if (this.state !== 'PLAYING') return;

        this.player.update(dt, this.input, this.width, this.height, this.nodes);
        for(let n of this.nodes) n.update(dt);

        // Enemy spawner logic
        this.enemySpawnTimer += dt;
        const spawnInterval = Math.max(0.5, 3.0 - (this.wave * 0.15));

        if (this.enemySpawnTimer > spawnInterval) {
            this.enemySpawnTimer = 0;
            const isPos = Math.random() > 0.5;

            // Keep enemies away from edges when spawning
            const ex = Math.random() * (this.width - 100) + 50;
            const ey = Math.random() * (this.height - 100) + 50;
            this.enemies.push(new Enemy(ex, ey, isPos));
        }

        this.updateEnemies(dt);

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    updateEnemies(dt) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.width, this.height);

            // Player collision resolution
            const dx = e.x - this.player.x;
            const dy = e.y - this.player.y;
            const distSq = dx*dx + dy*dy;
            const rSum = e.radius + this.player.radius;

            if (distSq < rSum*rSum) {
                this.handlePlayerEnemyCollision(i, e, dx, dy, distSq);
            }
        }
    }

    handlePlayerEnemyCollision(index, e, dx, dy, distSq) {
        const dist = Math.sqrt(distSq) || 1;
        const nx = dx / dist;
        const ny = dy / dist;

        if (this.player.isPos === e.isPos) {
            // Success: Matching Polarity - Destroy Enemy
            this.score += 10;
            this.sound.playShoot();
            this.spawnParticles(e.x, e.y, e.isPos ? COLORS.particlePos : COLORS.particleNeg, 15);
            this.enemies.splice(index, 1);

            // Ricochet player slightly
            this.player.vx = -nx * this.player.speed * 0.8;
            this.player.vy = -ny * this.player.speed * 0.8;

            // Advance waves
            if (this.score % 100 === 0) {
                this.wave++;
                this.spawnParticles(this.width/2, this.height/2, '#ffffff', 50);
            }
        } else {
            // Failure: Opposite Polarity - Take Damage
            this.health--;
            this.sound.playHit();
            this.spawnParticles(this.player.x, this.player.y, '#ff0000', 30);

            // Forceful knockback
            this.player.vx = -nx * this.player.speed * 1.5;
            this.player.vy = -ny * this.player.speed * 1.5;

            // Delete enemy on impact to prevent rapid multi-hits
            this.enemies.splice(index, 1);

            if (this.health <= 0) {
                this.triggerGameOver();
            }
        }
    }

    triggerGameOver() {
        this.state = 'GAME_OVER';
        this.sound.playGameOver();
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.data.totalScoreAccumulated += this.score;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
        }
        this.saveManager.save();
    }

    pointerInBackToArcade() {
        if (!this.input.pointer.justDown) return false;
        const px = this.input.pointer.x;
        const py = this.input.pointer.y;
        return (px > 10 && px < 250 && py > 10 && py < 50);
    }

    drawBackToArcade() {
        this.ctx.fillStyle = COLORS.text;
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('< Back to Arcade', 20, 30);
    }

    drawHUD() {
        this.ctx.fillStyle = COLORS.text;
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        this.ctx.fillText(`Health: ${this.health}`, 10, 60);
        this.ctx.fillText(`Wave: ${this.wave}`, 10, 90);

        // Top-center polarity status
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = this.player.isPos ? COLORS.pos : COLORS.neg;
        this.ctx.fillText(`[ POLARITY: ${this.player.isPos ? 'POSITIVE' : 'NEGATIVE'} ]`, this.width / 2, 30);
    }

    drawScanlines() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        for(let y = 0; y < this.height; y += 4) {
            this.ctx.fillRect(0, y, this.width, 1);
        }
    }

    draw() {
        this.ctx.fillStyle = COLORS.bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.grid.draw(this.ctx, this.totalTime);
        for (let n of this.nodes) n.draw(this.ctx);

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            for (let e of this.enemies) e.draw(this.ctx);
            if (this.health > 0) this.player.draw(this.ctx);
            for (let p of this.particles) p.draw(this.ctx);
            this.drawHUD();
        }

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = COLORS.text;
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('CRT Polarity Bounce', this.width / 2, this.height / 2 - 60);

            this.ctx.font = '20px monospace';
            this.ctx.fillText('Press SPACE or TAP to start & switch polarity', this.width / 2, this.height / 2);
            this.ctx.fillText('Use WASD/Arrows for initial launch', this.width / 2, this.height / 2 + 40);
            this.ctx.fillText('Smash matching colors! Avoid opposites!', this.width / 2, this.height / 2 + 80);

            this.drawBackToArcade();
        } else if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = COLORS.text;
            this.ctx.font = '50px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);

            this.drawBackToArcade();
        } else if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = COLORS.text;
            this.ctx.font = '50px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 30);

            this.ctx.font = '25px monospace';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 30);
            this.ctx.fillText(`Press SPACE or TAP to restart`, this.width / 2, this.height / 2 + 80);
        }

        this.drawScanlines();
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        this.totalTime += dt;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
}

window.onload = () => {
    window.game = new Game();
};
