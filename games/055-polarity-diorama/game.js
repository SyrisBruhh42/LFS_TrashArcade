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
            dash: ['ShiftLeft', 'ShiftRight', 'KeyQ'],
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
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashDuration = 0;
        this.invulnTimer = 0;
        this.thrustLevel = 0;
        this.recoilOffset = {x: 0, y: 0};
    }

    update(dt, input) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashDuration > 0) {
            this.dashDuration -= dt;
            if (this.dashDuration <= 0) this.isDashing = false;
        }
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.recoilOffset.x *= 0.9;
        this.recoilOffset.y *= 0.9;

        let moving = false;
        const currentAngVel = this.isDashing ? this.angularVelocity * 3 : this.angularVelocity;

        if (input.isDown('left')) {
            this.angle -= currentAngVel * dt;
            moving = true;
        }
        if (input.isDown('right')) {
            this.angle += currentAngVel * dt;
            moving = true;
        }

        if (moving) {
            this.thrustLevel = Math.min(1.0, this.thrustLevel + dt * 5);
        } else {
            this.thrustLevel = Math.max(0, this.thrustLevel - dt * 5);
        }

        if (input.isJustPressed('dash') && this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashDuration = 0.2;
            this.dashCooldown = 2.0;
            this.invulnTimer = 0.3;
            // The analytics dash call is handled in Engine
        }

        if (input.isJustPressed('action') || (input.mouse.down && input.isJustPressed('mouse_left')) || (input.touch.down && input.isJustPressed('touch_tap'))) {
             // We handle polarity switch in engine for sound, but can update state here if we want.
             // Relying on Engine to trigger switch for sound
        }
    }

    draw(ctx, cx, cy) {
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) return;

        const rx = cx + Math.cos(this.angle) * this.orbitRadius + this.recoilOffset.x;
        const ry = cy + Math.sin(this.angle) * this.orbitRadius + this.recoilOffset.y;

        // Draw aim telegraph
        ctx.beginPath();
        const moveDir = Math.PI/2; // It moves tangentially
        // Just draw a line from center to outside as telegraph? Actually it moves around circle.
        // Telegraph: point forward along the orbit tangent
        const tangentX = rx + Math.cos(this.angle + Math.PI/2) * 30;
        const tangentY = ry + Math.sin(this.angle + Math.PI/2) * 30;
        ctx.moveTo(rx, ry);
        ctx.lineTo(tangentX, tangentY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw thrust flame
        if (this.thrustLevel > 0) {
            const flameLen = this.size * 1.5 * this.thrustLevel + (Math.random() * 5);
            // Flame points downwards relative to the player orientation which is usually pointing "up" (angle - PI/2)
            // But let's just draw it downwards on screen relative to (rx, ry)
            const flamePts = [
                {x: rx - this.size * 0.8, y: ry + this.size},
                {x: rx + this.size * 0.8, y: ry + this.size},
                {x: rx, y: ry + this.size + flameLen}
            ];
            drawPaperPoly(ctx, flamePts, '#ffaa00', '#cc5500');
        }

        const pts = [
            {x: rx, y: ry - this.size},
            {x: rx + this.size, y: ry + this.size},
            {x: rx - this.size, y: ry + this.size}
        ];

        const color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        drawPaperPoly(ctx, pts, color);

        // Polarity indicator
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.polarity === POLARITY.POSITIVE ? '+' : '-', rx, ry + 5);
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
        this.knockbackX = 0;
        this.knockbackY = 0;
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

        this.x += this.vx * dt + this.knockbackX * dt;
        this.y += this.vy * dt + this.knockbackY * dt;
        this.knockbackX *= 0.9;
        this.knockbackY *= 0.9;
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


// Helpful Analytics Tracking for Dash Usage
class AnalyticsTracker {
    constructor() {
        this.events = [];
        this.sessionStart = performance.now();
        this.totalDashes = 0;
        this.totalAbsorbs = 0;
        this.totalRepels = 0;
        this.distanceTraveled = 0;
        this.lastX = 0;
        this.lastY = 0;
    }

    logEvent(eventName, data = {}) {
        this.events.push({
            time: performance.now() - this.sessionStart,
            event: eventName,
            data: data
        });

        if (this.events.length > 100) {
            this.events.shift();
        }
    }

    recordDash(playerPos) {
        this.totalDashes++;
        this.logEvent('dash_used', { x: playerPos.x, y: playerPos.y });
    }

    recordAbsorb() {
        this.totalAbsorbs++;
        this.logEvent('enemy_absorbed', { total: this.totalAbsorbs });
    }

    recordRepel() {
        this.totalRepels++;
        this.logEvent('enemy_repelled', { total: this.totalRepels });
    }

    updateDistance(x, y) {
        if (this.lastX !== 0 && this.lastY !== 0) {
            const dx = x - this.lastX;
            const dy = y - this.lastY;
            this.distanceTraveled += Math.sqrt(dx*dx + dy*dy);
        }
        this.lastX = x;
        this.lastY = y;
    }

    getStats() {
        return {
            dashes: this.totalDashes,
            absorbs: this.totalAbsorbs,
            repels: this.totalRepels,
            distance: Math.round(this.distanceTraveled)
        };
    }

    printReport() {
        console.log("--- Analytics Report ---");
        console.log(`Session Time: ${Math.round((performance.now() - this.sessionStart)/1000)}s`);
        console.log(`Dashes Used: ${this.totalDashes}`);
        console.log(`Enemies Absorbed: ${this.totalAbsorbs}`);
        console.log(`Enemies Repelled: ${this.totalRepels}`);
        console.log(`Distance Traveled: ${Math.round(this.distanceTraveled)}`);
        console.log("------------------------");
    }
}


class BackgroundLayer {
    constructor(speed, shapes, color) {
        this.speed = speed;
        this.shapes = shapes;
        this.color = color;
        this.yOffset = 0;
    }
    update(dt, ch, cw) {
        this.yOffset += this.speed * dt;
        this.shapes.forEach(s => {
            s.angle += s.rotSpeed * dt;
            if (s.y + this.yOffset > ch + 100) {
                s.y = -this.yOffset - 100;
                s.x = Math.random() * cw;
            }
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(0, this.yOffset);
        this.shapes.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.fillStyle = this.color;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            if (s.type === 'square') {
                ctx.rect(-s.size/2, -s.size/2, s.size, s.size);
            } else if (s.type === 'triangle') {
                ctx.moveTo(0, -s.size/2);
                ctx.lineTo(s.size/2, s.size/2);
                ctx.lineTo(-s.size/2, s.size/2);
                ctx.closePath();
            } else if (s.type === 'cloud') {
                ctx.arc(-s.size*0.3, 0, s.size*0.4, 0, Math.PI*2);
                ctx.arc(s.size*0.3, 0, s.size*0.4, 0, Math.PI*2);
                ctx.arc(0, -s.size*0.2, s.size*0.5, 0, Math.PI*2);
            } else {
                ctx.arc(0, 0, s.size/2, 0, Math.PI*2);
            }

            ctx.fill();
            if (s.type !== 'cloud') ctx.stroke();

            if (s.type === 'square' || s.type === 'triangle') {
                 ctx.beginPath();
                 ctx.moveTo(0,0);
                 ctx.lineTo(s.size/2, s.size/2);
                 ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                 ctx.stroke();
            }
            ctx.restore();
        });
        ctx.restore();
    }
}

class DioramaWorld {
    constructor() {
        this.layers = [];
        this.initLayers();
        this.hazards = [];
        this.hazardSpawnTimer = 0;
    }

    initLayers() {
        const l1 = [];
        for(let i=0; i<20; i++) l1.push(this.createShape(20));
        this.layers.push(new BackgroundLayer(20, l1, '#3a3a3a'));

        const l2 = [];
        for(let i=0; i<10; i++) {
             const s = this.createShape(40);
             s.type = 'cloud';
             l2.push(s);
        }
        this.layers.push(new BackgroundLayer(50, l2, '#444'));

        const l3 = [];
        for(let i=0; i<15; i++) l3.push(this.createShape(30));
        this.layers.push(new BackgroundLayer(100, l3, '#555'));
    }

    createShape(maxSize) {
        const types = ['square', 'triangle', 'circle'];
        return {
            x: Math.random() * (window.innerWidth || 800),
            y: Math.random() * (window.innerHeight || 600),
            size: 10 + Math.random() * maxSize,
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 2,
            type: types[Math.floor(Math.random() * types.length)]
        };
    }

    update(dt, player, enemies, particles, ch, cw) {
        this.layers.forEach(l => l.update(dt, ch, cw));

        this.hazards.forEach(h => h.update(dt));

        this.hazardSpawnTimer -= dt;
        if (this.hazardSpawnTimer <= 0) {
            this.hazardSpawnTimer = 5 + Math.random() * 5;
            this.spawnHazard();
        }

        this.hazards.forEach(h => {
             if (h.isActive()) {
                 const dx = player.x - h.x;
                 const dy = player.y - h.y;
                 const dist = Math.sqrt(dx*dx + dy*dy);
                 if (dist < h.radius + player.radius) {
                     h.applyEffect(player);
                     for(let i=0; i<5; i++) {
                         particles.push(new Particle(player.x, player.y, h.color));
                     }
                 }

                 enemies.forEach(e => {
                     const edx = e.x - h.x;
                     const edy = e.y - h.y;
                     const edist = Math.sqrt(edx*edx + edy*edy);
                     if (edist < h.radius + e.radius) {
                         h.applyEffect(e);
                     }
                 });
             }
        });

        this.hazards = this.hazards.filter(h => !h.isDead());
    }

    spawnHazard() {
        const cx = (window.innerWidth || 800) / 2;
        const cy = (window.innerHeight || 600) / 2;
        const a = Math.random() * Math.PI * 2;
        const r = 100 + Math.random() * 150;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;

        const type = Math.random() > 0.5 ? 'gravity_well' : 'repulsor';
        this.hazards.push(new Hazard(x, y, type));
    }

    draw(ctx) {
        this.layers.forEach(l => l.draw(ctx));
        this.hazards.forEach(h => h.draw(ctx));
    }
}

class Hazard {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'gravity_well' or 'repulsor'
        this.radius = 50 + Math.random() * 30;
        this.life = 10 + Math.random() * 5; // seconds
        this.color = type === 'gravity_well' ? 'rgba(100, 0, 200, 0.3)' : 'rgba(200, 100, 0, 0.3)';
        this.angle = 0;
        this.scale = 0; // for spawn animation
    }

    update(dt) {
        this.life -= dt;
        this.angle += (this.type === 'gravity_well' ? 1 : -1) * dt;
        if (this.scale < 1 && this.life > 1) {
            this.scale += dt * 2;
        }
        if (this.life < 1) {
            this.scale = Math.max(0, this.life);
        }
    }

    isActive() {
        return this.life > 0 && this.scale > 0.5;
    }

    isDead() {
        return this.life <= 0;
    }

    applyEffect(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const force = (1 - dist / this.radius) * 100;

        const dir = this.type === 'gravity_well' ? -1 : 1;

        if (entity.vx !== undefined && entity.vy !== undefined) {
             entity.vx += (dx / dist) * force * dir * 0.01;
             entity.vy += (dy / dist) * force * dir * 0.01;
        } else if (entity.orbitRadius !== undefined && entity.orbitAngle !== undefined) {
             const pull = force * dir * 0.5;
             entity.orbitRadius += pull;
             entity.orbitRadius = Math.max(50, Math.min(300, entity.orbitRadius));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;
        ctx.beginPath();

        const points = 8;
        for(let i=0; i<points*2; i++) {
            const a = (i/(points*2)) * Math.PI * 2;
            const r = i % 2 === 0 ? this.radius : this.radius * 0.6;
            if (i===0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
            else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([5, 5]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI*2);
        ctx.stroke();

        ctx.restore();
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
        this.analytics = new AnalyticsTracker();
        this.world = new DioramaWorld();

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
        this.analytics = new AnalyticsTracker();
        this.world = new DioramaWorld();
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

            if (this.input.isJustPressed('dash') && this.player.dashCooldown <= 0) {
                this.analytics.recordDash(this.player.getPos(cx, cy));
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
            const cw = (window.innerWidth || 800);
            const ch = window.innerHeight;
            if(this.world) this.world.update(dt, this.player, this.enemies, this.particles, ch, cw);
            const playerPos = this.player.getPos(cx, cy);
            this.analytics.updateDistance(playerPos.x, playerPos.y);

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
                    if (this.player.invulnTimer > 0) {
                        // Skip game over if invulnerable
                    } else {
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
                }

                // Collision with Player
                const dxP = playerPos.x - e.x;
                const dyP = playerPos.y - e.y;
                if (Math.sqrt(dxP*dxP + dyP*dyP) < this.player.size + e.size) {
                    if (this.player.isDashing) {
                        e.markedForDeletion = true;
                        this.score += 20;
                        this.createParticles(e.x, e.y, '#ffffff', 15);
                        this.sound.playAbsorb(); // Or a custom hit sound
                        // Apply recoil to player
                        const angleP = Math.atan2(dyP, dxP);
                        this.player.recoilOffset.x += Math.cos(angleP) * 10;
                        this.player.recoilOffset.y += Math.sin(angleP) * 10;
                    } else if (e.polarity !== this.player.polarity) {
                        // Absorb
                        this.score += 10;
                        this.sound.playAbsorb();
                        this.createParticles(e.x, e.y, COLORS.SUN, 10);
                        e.markedForDeletion = true;
                        this.analytics.recordAbsorb();
                    } else {
                        // If same polarity, shouldn't really touch due to repulsion, but if it does (high speed), repel harder
                        e.vx *= -2;
                        e.vy *= -2;
                        e.knockbackX = e.vx * -3;
                        e.knockbackY = e.vy * -3;
                        this.sound.playRepel();
                        // Add small recoil
                        const angleP = Math.atan2(dyP, dxP);
                        this.player.recoilOffset.x += Math.cos(angleP) * 5;
                        this.player.recoilOffset.y += Math.sin(angleP) * 5;
                    }
                }

                // Off-screen cleanup (repelled successfully)
                if (e.x < -100 || e.x > cw + 100 || e.y < -100 || e.y > ch + 100) {
                    if (e.polarity === this.player.polarity) {
                        // Reward for repelling same polarity off screen
                        this.score += 5;
                        this.analytics.recordRepel();
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
        if(this.world) this.world.draw(ctx);

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

        // Dash HUD
        ctx.textAlign = 'center';
        if (this.player.dashCooldown <= 0) {
            ctx.fillStyle = '#00ff00';
            ctx.fillText('DASH: READY', cx, ch - 40);
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.fillText(`DASH CD: ${this.player.dashCooldown.toFixed(1)}`, cx, ch - 40);
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
