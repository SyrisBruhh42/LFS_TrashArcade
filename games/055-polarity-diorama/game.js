// game.js foundation
class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = { x: 0, y: 0, down: false };
        this.justPressed = {};
        this.bindings = {
            up: ['ArrowUp', 'KeyW'],
            down: ['ArrowDown', 'KeyS'],
            left: ['ArrowLeft', 'KeyA'],
            right: ['ArrowRight', 'KeyD'],
            action: ['Space', 'Enter'],
            pause: ['Escape', 'KeyP']
        };

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            this.justPressed[e.code] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.justPressed[e.code] = false;
        });

        const updatePointer = (e, isTouch) => {
            const point = isTouch ? e.touches[0] || e.changedTouches[0] : e;
            if (point) {
                const state = isTouch ? this.touch : this.mouse;
                state.x = point.clientX;
                state.y = point.clientY;
            }
        };

        window.addEventListener('pointerdown', e => {
            if(e.pointerType === 'touch') {
                this.touch.down = true;
                updatePointer(e, e.pointerType === 'touch');
            } else {
                this.mouse.down = true;
                updatePointer(e, e.pointerType === 'touch');
            }
        });

        window.addEventListener('pointerup', e => {
            if(e.pointerType === 'touch') {
                this.touch.down = false;
            } else {
                this.mouse.down = false;
            }
        });

        window.addEventListener('pointermove', e => {
            updatePointer(e, e.pointerType === 'touch');
        });
    }

    isDown(action) {
        return this.bindings[action].some(code => this.keys[code]);
    }

    isJustPressed(action) {
        const pressed = this.bindings[action].some(code => this.justPressed[code]);
        if (pressed) {
            this.bindings[action].forEach(code => this.justPressed[code] = false);
        }
        return pressed;
    }

    clearJustPressed() {
        this.justPressed = {};
    }
}

// Canvas setup with ResizeObserver
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let cw = window.innerWidth;
let ch = window.innerHeight;
canvas.width = cw;
canvas.height = ch;

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        cw = entry.contentRect.width;
        ch = entry.contentRect.height;
        canvas.width = cw;
        canvas.height = ch;
    }
});
resizeObserver.observe(canvas);

// Paper craft drawing utilities
function drawPaperPoly(ctx, points, fillColor, strokeColor = '#333', shadowColor = 'rgba(0,0,0,0.3)') {
    ctx.save();
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_055_055-polarity-diorama_v1';
        this.data = this.load() || this.getDefaultData();
    }

    getDefaultData() {
        return {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { mute: false }
        };
    }

    load() {
        try {
            const saved = localStorage.getItem(this.saveKey);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.warn('LocalStorage error', e);
            return null;
        }
    }

    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn('LocalStorage error', e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5;
        this.enabled = true;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playOscillator(freq, type, duration) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration) {
        if (!this.enabled) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    playSwitch() {
        this.playOscillator(600, 'square', 0.1);
        setTimeout(() => this.playOscillator(800, 'square', 0.1), 50);
    }

    playAbsorb() {
        this.playOscillator(400, 'sine', 0.2);
        setTimeout(() => this.playOscillator(600, 'sine', 0.2), 100);
    }

    playRepel() {
        this.playOscillator(200, 'sawtooth', 0.2);
    }

    playHitSun() {
        this.playNoise(0.5);
        this.playOscillator(100, 'sawtooth', 0.5);
    }
}

// Constants
const POLARITY = { POSITIVE: 1, NEGATIVE: -1 };
const COLORS = {
    POSITIVE: '#dd867f', // Red-ish paper
    NEGATIVE: '#7fbbdd', // Blue-ish paper
    SUN: '#f4e8c1',     // Yellow-ish paper
    BG: '#2b2b2b'
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = (Math.random() - 0.5) * 200;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.restore();
    }
}

class Player {
    constructor() {
        this.angle = 0;
        this.orbitRadius = 150;
        this.polarity = POLARITY.POSITIVE;
        this.size = 15;
        this.angularVelocity = 2.0; // rad/s
    }

    update(dt, input) {
        if (input.isDown('left')) {
            this.angle -= this.angularVelocity * dt;
        }
        if (input.isDown('right')) {
            this.angle += this.angularVelocity * dt;
        }

        if (input.isJustPressed('action') || (input.mouse.down && input.isJustPressed('mouse_left')) || (input.touch.down && input.isJustPressed('touch_tap'))) {
             // We handle polarity switch in engine for sound, but can update state here if we want.
             // Relying on Engine to trigger switch for sound
        }
    }

    draw(ctx, cx, cy) {
        const x = cx + Math.cos(this.angle) * this.orbitRadius;
        const y = cy + Math.sin(this.angle) * this.orbitRadius;

        const pts = [
            {x: x, y: y - this.size},
            {x: x + this.size, y: y + this.size},
            {x: x - this.size, y: y + this.size}
        ];

        const color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        drawPaperPoly(ctx, pts, color);

        // Polarity indicator
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.polarity === POLARITY.POSITIVE ? '+' : '-', x, y + 5);
    }

    getPos(cx, cy) {
        return {
            x: cx + Math.cos(this.angle) * this.orbitRadius,
            y: cy + Math.sin(this.angle) * this.orbitRadius
        };
    }
}

class Enemy {
    constructor(cx, cy, cw, ch) {
        // Spawn outside screen
        const angle = Math.random() * Math.PI * 2;
        const spawnRx = cw / 2 + 50;
        const spawnRy = ch / 2 + 50;
        this.x = cx + Math.cos(angle) * spawnRx;
        this.y = cy + Math.sin(angle) * spawnRy;

        this.vx = 0;
        this.vy = 0;
        this.polarity = Math.random() < 0.5 ? POLARITY.POSITIVE : POLARITY.NEGATIVE;
        this.size = 12;
        this.markedForDeletion = false;

        // Random jagged shape for papercraft
        this.shape = [];
        const sides = Math.floor(Math.random() * 3) + 4; // 4 to 6 sides
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = this.size * (0.8 + Math.random() * 0.4);
            this.shape.push({ angle: a, r: r });
        }
    }

    update(dt, cx, cy, player, playerPos) {
        // Sun gravity
        const dxSun = cx - this.x;
        const dySun = cy - this.y;
        const distSunSq = dxSun*dxSun + dySun*dySun;
        const distSun = Math.sqrt(distSunSq);

        const gravity = 20000 / Math.max(distSunSq, 100);
        this.vx += (dxSun / distSun) * gravity * dt;
        this.vy += (dySun / distSun) * gravity * dt;

        // Player magnetism
        const dxP = playerPos.x - this.x;
        const dyP = playerPos.y - this.y;
        const distPSq = dxP*dxP + dyP*dyP;
        const distP = Math.sqrt(distPSq);

        if (distP < 300) {
            const magForce = 50000 / Math.max(distPSq, 100);
            const forceDir = this.polarity === player.polarity ? -1 : 1; // Opposite attracts (1), same repels (-1)
            this.vx += (dxP / distP) * magForce * forceDir * dt;
            this.vy += (dyP / distP) * magForce * forceDir * dt;
        }

        // Apply friction
        this.vx *= 0.99;
        this.vy *= 0.99;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx) {
        const pts = this.shape.map(p => ({
            x: this.x + Math.cos(p.angle) * p.r,
            y: this.y + Math.sin(p.angle) * p.r
        }));

        const color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        drawPaperPoly(ctx, pts, color);
    }
}

class GameEngine {
    constructor() {
        this.input = new InputManager();
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE'; // TITLE, PLAYING, GAME_OVER
        this.lastTime = performance.now();

        this.score = 0;
        this.highScore = this.saveManager.data.highScore || 0;

        this.player = new Player();
        this.enemies = [];
        this.particles = [];

        this.spawnTimer = 0;
        this.spawnRate = 2.0; // seconds

        // Custom binding for mouse/touch tap to switch polarity
        this.input.bindings['switch'] = ['Space', 'Enter'];
    }


    updateUI() {
        const ui = document.getElementById('uiLayer');
        if (ui) {
            ui.style.display = (this.state === 'TITLE' || this.state === 'PAUSED' || this.state === 'GAME_OVER') ? 'block' : 'none';
        }
    }

    start() {
        requestAnimationFrame(t => this.loop(t));
    }

    reset() {
        this.player = new Player();
        this.enemies = [];
        this.particles = [];
        this.score = 0;
        this.spawnTimer = 0;
        this.spawnRate = 2.0;
        this.state = 'PLAYING';
    }

    createParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    handleInput() {
        // Touch/Mouse tap to switch polarity logic
        const tapped = this.input.isJustPressed('switch') ||
                      (this.input.mouse.down && !this.mouseWasDown) ||
                      (this.input.touch.down && !this.touchWasDown);

        this.mouseWasDown = this.input.mouse.down;
        this.touchWasDown = this.input.touch.down;

        return tapped;
    }

    update(dt) {

        if (this.input.isJustPressed('pause')) {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            } else if (this.state === 'PAUSED') {
                this.state = 'PLAYING';
            }
        }

        if (this.state === 'PAUSED') {
            this.input.clearJustPressed();
            return;
        }

        if (this.state === 'TITLE') {
            const tapped = this.handleInput() || (this.input.mouse.down && !this.mouseWasDown) || (this.input.touch.down && !this.touchWasDown);
            if (tapped || this.input.isDown('up') || this.input.isDown('down') || this.input.isDown('left') || this.input.isDown('right') || this.input.isJustPressed('action') || this.input.isJustPressed('switch')) {
                this.sound.resume();
                this.reset();
            }
            return;
        }


        if (this.state === 'PAUSED') {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PAUSED', cx, cy);
        }

        if (this.state === 'GAME_OVER') {
            if (this.handleInput()) {
                this.state = 'TITLE';
            }
            return;
        }

        if (this.state === 'PLAYING') {
            const cx = cw / 2;
            const cy = ch / 2;
            const sunRadius = 30;

            // Update Player
            const switched = this.handleInput();
            if (switched) {
                this.player.polarity *= -1;
                this.sound.playSwitch();
            }

            // Mouse/Touch orbit controls (override left/right if clicking/dragging left/right sides)
            if (this.input.mouse.down || this.input.touch.down) {
                const px = this.input.touch.down ? this.input.touch.x : this.input.mouse.x;
                if (px < cx) this.input.keys['ArrowLeft'] = true;
                if (px >= cx) this.input.keys['ArrowRight'] = true;
            } else {
                this.input.keys['ArrowLeft'] = false;
                this.input.keys['ArrowRight'] = false;
            }

            this.player.update(dt, this.input);
            const playerPos = this.player.getPos(cx, cy);

            // Spawner
            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {
                this.enemies.push(new Enemy(cx, cy, cw, ch));
                this.spawnTimer = this.spawnRate;
                this.spawnRate = Math.max(0.5, this.spawnRate - 0.05); // Increase difficulty
            }

            // Update Enemies
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.update(dt, cx, cy, this.player, playerPos);

                // Collision with Sun
                const dxSun = cx - e.x;
                const dySun = cy - e.y;
                if (Math.sqrt(dxSun*dxSun + dySun*dySun) < sunRadius + e.size) {
                    this.sound.playHitSun();
                    this.createParticles(e.x, e.y, e.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE, 20);
                    this.state = 'GAME_OVER';
                    if (this.score > this.highScore) {
                        this.highScore = this.score;
                        this.saveManager.data.highScore = this.highScore;
                        this.saveManager.save();
                    }
                    break;
                }

                // Collision with Player
                const dxP = playerPos.x - e.x;
                const dyP = playerPos.y - e.y;
                if (Math.sqrt(dxP*dxP + dyP*dyP) < this.player.size + e.size) {
                    if (e.polarity !== this.player.polarity) {
                        // Absorb
                        this.score += 10;
                        this.sound.playAbsorb();
                        this.createParticles(e.x, e.y, COLORS.SUN, 10);
                        e.markedForDeletion = true;
                    } else {
                        // If same polarity, shouldn't really touch due to repulsion, but if it does (high speed), repel harder
                        e.vx *= -2;
                        e.vy *= -2;
                        this.sound.playRepel();
                    }
                }

                // Off-screen cleanup (repelled successfully)
                if (e.x < -100 || e.x > cw + 100 || e.y < -100 || e.y > ch + 100) {
                    if (e.polarity === this.player.polarity) {
                        // Reward for repelling same polarity off screen
                        this.score += 5;
                    }
                    e.markedForDeletion = true;
                }
            }

            this.enemies = this.enemies.filter(e => !e.markedForDeletion);

            // Update Particles
            this.particles.forEach(p => p.update(dt));
            this.particles = this.particles.filter(p => p.life > 0);
        }

        this.input.clearJustPressed();
    }

    draw() {
        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, cw, ch);

        const cx = cw / 2;
        const cy = ch / 2;

        if (this.state === 'TITLE') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Polarity Diorama', cx, cy - 50);
            ctx.font = '20px monospace';
            ctx.fillText('Click / Tap to Start', cx, cy + 20);
            ctx.font = '16px monospace';
            ctx.fillText('A/D or Drag Left/Right to Orbit', cx, cy + 60);
            ctx.fillText('Space or Tap to Switch Polarity', cx, cy + 85);
            ctx.fillText('Opposite Attracts (Absorb for Points)', cx, cy + 120);
            ctx.fillText('Same Repels (Push Off-screen for Points)', cx, cy + 145);
            ctx.fillText('Protect the Sun!', cx, cy + 170);
            return;
        }

        // Draw Sun (Papercraft)
        const sunPts = [];
        const sunRadius = 30;
        for (let i=0; i<8; i++) {
            const a = (i/8)*Math.PI*2;
            sunPts.push({
                x: cx + Math.cos(a) * sunRadius * (i%2===0?1:0.9),
                y: cy + Math.sin(a) * sunRadius * (i%2===0?1:0.9)
            });
        }
        drawPaperPoly(ctx, sunPts, COLORS.SUN);

        // Draw Orbit Path
        ctx.beginPath();
        ctx.arc(cx, cy, this.player.orbitRadius, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        this.enemies.forEach(e => e.draw(ctx));
        this.player.draw(ctx, cx, cy);
        this.particles.forEach(p => p.draw(ctx));

        // HUD
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Score: ${this.score}`, 20, 20);
        ctx.textAlign = 'right';
        ctx.fillText(`High: ${this.highScore}`, cw - 20, 20);


        if (this.state === 'PAUSED') {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PAUSED', cx, cy);
        }

        if (this.state === 'GAME_OVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('GAME OVER', cx, cy - 30);
            ctx.font = '20px monospace';
            ctx.fillText(`Final Score: ${this.score}`, cx, cy + 20);
            ctx.fillText('Click / Tap to Restart', cx, cy + 60);
        }
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.updateUI();
        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.start();
});
