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
    PAUSED: 3,
    UPGRADE: 4
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
    playUpgrade() { this.playTone(500, 'square', 0.2, 0.5); this.playTone(700, 'sine', 0.4, 0.5); }
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

class EnemyProjectile {
    constructor(x, y, vx, vy, damage) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.radius = 5;
        this.active = true;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
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

class BossEnemy extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.isBoss = true;
        this.maxHealth = 1000;
        this.health = 1000;
        this.radius = 30;
        this.speed = 30;
        this.damage = 20;
        this.phase = 1; // 1 = >50%, 2 = <50%
        this.bossName = "Boss";
        this.active = true;
    }

    update(dt) {
        super.update(dt);
        if (this.phase === 1 && this.health <= this.maxHealth * 0.5) {
            this.phase = 2;
            this.onPhaseChange();
        }
    }

    onPhaseChange() {
        // Override in subclasses
    }
}

class GummyWormBoss extends BossEnemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.bossName = "Colossal Gummy Worm";
        this.maxHealth = 2500;
        this.health = 2500;
        this.speed = 40;
        this.radius = 40;
        this.trapTimer = 0;
    }

    update(dt) {
        super.update(dt);
        if (this.phase === 2) {
            this.trapTimer += dt;
            if (this.trapTimer > 2.0) {
                this.trapTimer = 0;
                this.dropTrap = true;
            }
        }
    }

    onPhaseChange() {
        this.speed = 80;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.phase === 1 ? '#ff00aa' : '#ff0000';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();
    }
}

class LollipopCrusherBoss extends BossEnemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.bossName = "Lollipop Crusher";
        this.maxHealth = 4000;
        this.health = 4000;
        this.speed = 20;
        this.radius = 50;
        this.shootTimer = 0;
    }

    update(dt) {
        super.update(dt);
        if (this.phase === 2) {
            this.shootTimer += dt;
            if (this.shootTimer > 1.5) {
                this.shootTimer = 0;
                this.shoot = true;
            }
        }
    }

    onPhaseChange() {
        this.speed = 10;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.phase === 1 ? '#00ffff' : '#0000ff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(this.x - this.radius, this.y);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.strokeStyle = '#fff';
        ctx.stroke();
    }
}

// --- MAIN ENGINE ---



class SwarmerEnemy extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 8;
        this.speed = 100 + Math.random() * 40;
        this.maxHealth = 5;
        this.health = 5;
        this.damage = 5;
        this.color = '#ff8800';
        this.offset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            const wave = Math.sin(performance.now() * 0.005 + this.offset) * 30;
            const perpX = -dy / dist;
            const perpY = dx / dist;
            this.x += ((dx / dist) * this.speed + perpX * wave) * dt;
            this.y += ((dy / dist) * this.speed + perpY * wave) * dt;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

class ShieldedBruiserEnemy extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 18;
        this.speed = 30 + Math.random() * 10;
        this.maxHealth = 30;
        this.health = 30;
        this.damage = 20;
        this.color = '#5555ff';
        this.shieldHealth = 20;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (this.shieldHealth > 0) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }
}

class SplitterEnemy extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 16;
        this.speed = 40 + Math.random() * 15;
        this.maxHealth = 15;
        this.health = 15;
        this.damage = 15;
        this.color = '#ff5555';
        this.pulse = 0;
    }

    update(dt) {
        // Stop-and-go movement
        this.pulse += dt;
        const moveMult = Math.sin(this.pulse * 3) > 0 ? 1.5 : 0.2;

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            this.x += (dx / dist) * this.speed * moveMult * dt;
            this.y += (dy / dist) * this.speed * moveMult * dt;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class AreaDenialEnemy extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 14;
        this.speed = 45 + Math.random() * 10;
        this.maxHealth = 12;
        this.health = 12;
        this.damage = 10;
        this.color = '#aa5500';
        this.trapTimer = 0;
        this.angleOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        // Moves in a zig-zag pattern
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0) {
            const zig = Math.sin(performance.now() * 0.002 + this.angleOffset) * 40;
            const perpX = -dy / dist;
            const perpY = dx / dist;
            this.x += ((dx / dist) * this.speed + perpX * zig) * dt;
            this.y += ((dy / dist) * this.speed + perpY * zig) * dt;
        }

        this.trapTimer += dt;
        if (this.trapTimer > 3) {
            this.trapTimer = 0;
            this.dropTrap = true;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y);
        ctx.lineTo(this.x, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (this.trapTimer > 2.5) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff0';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

class RangedSniperEnemy extends Enemy {
    constructor(x, y, target) {
        super(x, y, target);
        this.radius = 12;
        this.speed = 60 + Math.random() * 20;
        this.maxHealth = 8;
        this.health = 8;
        this.damage = 10;
        this.color = '#55ff55';
        this.shootTimer = 0;
        this.preferredDistance = 250;
    }

    update(dt) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.preferredDistance + 10) {
            this.x += (dx / dist) * this.speed * dt;
            this.y += (dy / dist) * this.speed * dt;
        } else if (dist < this.preferredDistance - 10) {
            this.x -= (dx / dist) * this.speed * dt;
            this.y -= (dy / dist) * this.speed * dt;
        }

        this.shootTimer += dt;
        if (this.shootTimer > 4 && dist < this.preferredDistance + 50) {
            this.shootTimer = 0;
            this.shoot = true;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x - this.radius, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.moveTo(this.x + this.radius, this.y - this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.stroke();

        if (this.shootTimer > 3.5) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
            ctx.strokeStyle = '#f00';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            const dx = this.target.x - this.x;
            const dy = this.target.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                ctx.lineTo(this.x + (dx/dist)*30, this.y + (dy/dist)*30);
            }
            ctx.strokeStyle = '#f00';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}
class CandyCover {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 25 + Math.random() * 15;
        this.maxHealth = 100;
        this.health = 100;
        this.active = true;
        this.color = ['#ff99cc', '#99ccff', '#ccff99'][Math.floor(Math.random() * 3)];
    }

    takeDamage(amount, dt, game) {
        this.health -= amount * dt;
        if (this.health <= 0) {
            this.active = false;
            game.sound.playExplosion(); // Crunch sound
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw cracks based on health
        const damageRatio = 1 - (this.health / this.maxHealth);
        if (damageRatio > 0.3) {
            ctx.beginPath();
            ctx.moveTo(this.x - this.radius * 0.5, this.y);
            ctx.lineTo(this.x + this.radius * 0.5, this.y + this.radius * 0.5);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

class CaramelTrap {
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.active = true;
        this.time = Math.random() * 10;
    }

    apply(entity, dt) {
        if (!this.active) return;
        // Simple AABB collision for the trap area
        if (entity.x > this.x && entity.x < this.x + this.w &&
            entity.y > this.y && entity.y < this.y + this.h) {
            // Apply slow down
            entity.vx *= 0.5;
            entity.vy *= 0.5;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = 'rgba(210, 105, 30, 0.4)'; // Caramel color
        ctx.fillRect(this.x, this.y, this.w, this.h);

        // Bubbles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        const numBubbles = Math.floor((this.w * this.h) / 1000);
        for (let i = 0; i < numBubbles; i++) {
            const bx = this.x + ((i * 37 + this.time * 20) % this.w);
            const by = this.y + ((i * 13 + this.time * 15) % this.h);
            ctx.beginPath();
            ctx.arc(bx, by, 3 + (i % 3), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    update(dt) {
        this.time += dt;
    }
}

class EnvironmentManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.time = 0;

        // Conveyor belt speed (global hazard affecting everything)
        this.conveyorSpeed = 30; // pixels per second moving down

        // Stage hazards
        this.covers = [];
        this.traps = [];

        this.generateHazards();
    }

    generateHazards() {
        // Create some destructible candy covers
        for (let i = 0; i < 5; i++) {
            this.covers.push(new CandyCover(
                100 + Math.random() * (this.width - 200),
                100 + Math.random() * (this.height - 200)
            ));
        }

        // Create some sticky caramel traps
        for (let i = 0; i < 3; i++) {
            this.traps.push(new CaramelTrap(
                Math.random() * (this.width - 150),
                Math.random() * (this.height - 150),
                100 + Math.random() * 100,
                100 + Math.random() * 100
            ));
        }
    }

    update(dt) {
        this.time += dt;
        for (let t of this.traps) {
            t.update(dt);
        }
    }

    applyHazards(tower, enemies, dt) {
        // Apply conveyor belt
        tower.y += this.conveyorSpeed * dt;
        for (let e of enemies) {
            e.y += this.conveyorSpeed * dt;

            // Enemies try to avoid covers? Or just collide.
            // Simplified: Caramel traps affect enemies too
            for (let t of this.traps) {
                t.apply(e, dt);
            }
        }

        // Caramel traps affect tower
        for (let t of this.traps) {
            t.apply(tower, dt);
        }
    }

    drawBackground(ctx) {
        // Layer 1: Deep background (Factory walls)
        ctx.fillStyle = '#2a1a3a';
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.fillStyle = '#1f132b';
        const p1Offset = (this.time * 10) % 100;
        for (let i = -100; i < this.height; i += 100) {
            ctx.fillRect(0, i + p1Offset, this.width, 20);
        }

        // Layer 2: Middle background (Gears/Machinery)
        ctx.strokeStyle = '#3d2554';
        ctx.lineWidth = 5;
        const p2Offset = (this.time * 20) % 150;
        for (let i = -150; i < this.width + 150; i += 150) {
            ctx.beginPath();
            ctx.arc(i, this.height/2 + Math.sin(i + this.time)*50, 40, this.time, this.time + Math.PI*2);
            ctx.stroke();
            // Gear teeth
            for(let j=0; j<8; j++) {
                let a = this.time + (j/8)*Math.PI*2;
                ctx.beginPath();
                ctx.moveTo(i + Math.cos(a)*40, this.height/2 + Math.sin(i + this.time)*50 + Math.sin(a)*40);
                ctx.lineTo(i + Math.cos(a)*50, this.height/2 + Math.sin(i + this.time)*50 + Math.sin(a)*50);
                ctx.stroke();
            }
        }

        // Layer 3: The Conveyor Belt (Play area surface)
        ctx.fillStyle = '#333';
        ctx.fillRect(50, 0, this.width - 100, this.height);

        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        const beltOffset = (this.time * this.conveyorSpeed) % 40;
        for (let i = -40; i < this.height; i += 40) {
            ctx.beginPath();
            ctx.moveTo(50, i + beltOffset);
            ctx.lineTo(this.width - 50, i + beltOffset);
            ctx.stroke();
        }

        // Belt edges
        ctx.fillStyle = '#555';
        ctx.fillRect(30, 0, 20, this.height);
        ctx.fillRect(this.width - 50, 0, 20, this.height);

        // Edge rollers
        ctx.fillStyle = '#777';
        const rollerOffset = (this.time * this.conveyorSpeed) % 60;
        for (let i = -60; i < this.height; i += 60) {
            ctx.fillRect(35, i + rollerOffset, 10, 30);
            ctx.fillRect(this.width - 45, i + rollerOffset, 10, 30);
        }

        // Draw traps
        for (let t of this.traps) {
            t.draw(ctx);
        }
    }

    drawForeground(ctx) {
        // Draw covers on top of the belt
        for (let c of this.covers) {
            c.draw(ctx);
        }
    }
}


class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'health', 'combo', 'score'
        this.radius = 12;
        this.active = true;
        this.lifeTime = 10.0; // despawn after 10s
    }
    update(dt) {
        this.lifeTime -= dt;
        if (this.lifeTime <= 0) this.active = false;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        if (this.type === 'health') {
            ctx.fillStyle = '#ff6b6b';
        } else if (this.type === 'combo') {
            ctx.fillStyle = '#feca57';
        } else {
            ctx.fillStyle = '#1dd1a1';
        }
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Inner icon
        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let text = this.type === 'health' ? '+' : (this.type === 'combo' ? 'C' : '$');
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }
}

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
        this.projectiles = [];
        this.score = 0;
        this.wave = 1;
        this.nextBossScore = 500;
        this.bossActive = false;
        this.bossWarningTimer = 0;
        this.activeBoss = null;
        this.waveKills = 0;
        this.killsToNextWave = 15;
        this.combo = 0;
        this.comboTimer = 0;
        this.comboMaxTime = 3.0;
        this.dropChance = 0.15;
        this.pickups = [];
        this.draftChoices = [];

        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;

        this.env = new EnvironmentManager(this.width, this.height);

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
        this.projectiles = [];
        this.score = 0;
        this.wave = 1;
        this.nextBossScore = 500;
        this.bossActive = false;
        this.bossWarningTimer = 0;
        this.activeBoss = null;
        this.waveKills = 0;
        this.killsToNextWave = 15;
        this.combo = 0;
        this.comboTimer = 0;
        this.comboMaxTime = 3.0;
        this.dropChance = 0.15;
        this.pickups = [];
        this.draftChoices = [];
        this.enemySpawnTimer = 0;
        this.enemySpawnRate = 2.0;
        this.env = new EnvironmentManager(this.width, this.height);
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

        this.env.update(dt);

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
            case STATES.UPGRADE:
                if (this.input.isPointerJustPressed()) {
                    const px = this.input.pointer.x;
                    const py = this.input.pointer.y;
                    const bw = 250;
                    const bh = 150;
                    const startX = this.width/2 - (bw*1.5) - 20;
                    const startY = this.height/2 - bh/2;
                    for (let i = 0; i < this.draftChoices.length; i++) {
                        const bx = startX + i * (bw + 20);
                        if (px > bx && px < bx + bw && py > startY && py < startY + bh) {
                            // Select Perk
                            this.draftChoices[i].action();
                            this.sound.playStart();
                            // Next wave
                            this.wave += 1;
                            this.waveKills = 0;
                            this.killsToNextWave = 15 + this.wave * 5;
                            this.enemySpawnRate = Math.max(0.5, 2.0 - (this.wave * 0.05));
                            this.state = STATES.PLAYING;
                            break;
                        }
                    }
                }
                break;
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

                this.env.applyHazards(this.tower, this.enemies, dt);
                // Combo decay
                if (this.comboTimer > 0) {
                    this.comboTimer -= dt;
                    if (this.comboTimer <= 0) {
                        this.combo = 0; // reset
                    }
                }

                // Update Pickups
                for (let i = this.pickups.length - 1; i >= 0; i--) {
                    let p = this.pickups[i];
                    p.update(dt);
                    if (!p.active) {
                        this.pickups.splice(i, 1);
                        continue;
                    }

                    // Check collision with tower head or base
                    const head = this.tower.getTetherHeadPos();
                    const distToHead = Math.hypot(p.x - head.x, p.y - head.y);
                    const distToBase = Math.hypot(p.x - this.tower.x, p.y - this.tower.y);

                    if (distToHead < p.radius + head.radius || distToBase < p.radius + this.tower.radius) {
                        // Collect pickup
                        p.active = false;
                        if (p.type === 'health') {
                            this.tower.health = Math.min(this.tower.maxHealth, this.tower.health + 20);
                            this.sound.playStart();
                        } else if (p.type === 'combo') {
                            this.combo += 1;
                            this.comboTimer = this.comboMaxTime;
                            this.sound.playDash();
                        } else if (p.type === 'score') {
                            this.score += 50 * (1 + this.combo * 0.1);
                            this.sound.playShoot();
                        }
                    }
                }


                for (let i = this.projectiles.length - 1; i >= 0; i--) {
                    let p = this.projectiles[i];
                    p.update(dt);
                    if (p.x < -100 || p.x > this.width + 100 || p.y < -100 || p.y > this.height + 100) {
                        p.active = false;
                    } else {
                        const distToTower = Math.hypot(p.x - this.tower.x, p.y - this.tower.y);
                        if (distToTower < p.radius + this.tower.radius) {
                            if (this.tower.invulnTimer <= 0) {
                                this.tower.health -= p.damage;
                                this.tower.applyRecoil(p.x - this.tower.x, p.y - this.tower.y, 20);
                                this.sound.playHit();
                            }
                            p.active = false;
                        }
                    }
                    if (!p.active) {
                        this.projectiles.splice(i, 1);
                    }
                }


                this.tower.update(dt, this.input, this);

                if (this.waveKills >= this.killsToNextWave && !this.bossActive && !this.activeBoss) {
                    if (this.wave % 5 === 0) {
                        this.bossActive = true;
                        this.bossWarningTimer = 3.0;
                    } else {
                        // Regular wave complete
                        this.generateDraft();
                        this.state = STATES.UPGRADE;
                        this.sound.playUpgrade();
                    }
                }

                if (this.bossActive && this.bossWarningTimer > 0) {
                    this.bossWarningTimer -= dt;
                    if (this.bossWarningTimer <= 0) {
                        this.spawnBoss();
                    }
                }

                if (this.activeBoss && !this.activeBoss.active) {
                    // Boss defeated
                    this.activeBoss = null;
                    this.bossActive = false;
                    this.score += 500 * (1 + this.combo * 0.1); // Bonus for killing boss
                    this.tower.health = Math.min(this.tower.maxHealth, this.tower.health + 50);
                    // Upgrade draft
                    this.generateDraft();
                    this.state = STATES.UPGRADE;
                    this.sound.playUpgrade();
                }

                // Only spawn normal enemies if no boss is active or warning
                if (!this.bossActive) {
                    this.enemySpawnTimer += dt;
                    if (this.enemySpawnTimer >= this.enemySpawnRate) {
                        this.enemySpawnTimer = 0;
                        this.spawnEnemy();
                        this.enemySpawnRate = Math.max(0.5, this.enemySpawnRate - 0.05);
                    }
                }

                // Update enemies & collisions
                const tetherHead = this.tower.getTetherHeadPos();

                for (let i = this.env.covers.length - 1; i >= 0; i--) {
                    let c = this.env.covers[i];
                    if (!c.active) {
                        this.env.covers.splice(i, 1);
                        continue;
                    }
                    const distToTether = Math.hypot(c.x - tetherHead.x, c.y - tetherHead.y);
                    if (distToTether < c.radius + tetherHead.radius) {
                        c.takeDamage(10 * this.tower.damageMultiplier, dt, this);
                        // Recoil on hitting cover
                        this.tower.applyRecoil(c.x - tetherHead.x, c.y - tetherHead.y, 0.5);
                    }
                }

                for (let i = this.enemies.length - 1; i >= 0; i--) {
                    let e = this.enemies[i];
                    e.update(dt);

                    // Bespoke Boss Attack Patterns
                    if (e.isBoss) {
                        if (e.bossName === "Colossal Gummy Worm" && e.dropTrap) {
                            e.dropTrap = false;
                            // Drop 3 traps in a triangle around it
                            this.env.traps.push(new CaramelTrap(e.x - 30, e.y - 30, 40, 40));
                            this.env.traps.push(new CaramelTrap(e.x + 30, e.y - 30, 40, 40));
                            this.env.traps.push(new CaramelTrap(e.x, e.y + 30, 40, 40));
                        }
                        if (e.bossName === "Lollipop Crusher" && e.shoot) {
                            e.shoot = false;
                            // Shoot barrage of 8 projectiles in all directions
                            for (let i = 0; i < 8; i++) {
                                const a = (Math.PI * 2 / 8) * i;
                                const vx = Math.cos(a) * 120;
                                const vy = Math.sin(a) * 120;
                                this.projectiles.push(new EnemyProjectile(e.x, e.y, vx, vy, e.damage));
                            }
                            // Also spawn a small swarmer
                            this.enemies.push(new SwarmerEnemy(e.x, e.y, this.tower));
                        }
                    }

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
                            this.waveKills += 1;
                            this.combo += 1;
                            this.comboTimer = this.comboMaxTime;
                            this.score += 15 * (1 + this.combo * 0.1);
                            if (Math.random() < this.dropChance) { // 15% chance to drop pickup
                                const types = ['health', 'combo', 'score'];
                                this.pickups.push(new Pickup(e.x, e.y, types[Math.floor(Math.random() * types.length)]));
                            }
                            this.sound.playExplosion();
                            this.tower.applyRecoil(this.tower.x - e.x, this.tower.y - e.y, 5); // tiny bounce back
                        }
                    }

                    // Check collision with tether head
                    const distToTether = Math.hypot(e.x - tetherHead.x, e.y - tetherHead.y);
                    if (distToTether < e.radius + tetherHead.radius) {
                        if (e.shieldHealth > 0) {
                            e.shieldHealth -= 10 * this.tower.damageMultiplier;
                            if (e.shieldHealth < 0) {
                                e.health += e.shieldHealth;
                                e.shieldHealth = 0;
                            }
                        } else {
                            e.health -= 10 * this.tower.damageMultiplier;
                        }
                        // apply some recoil to the tower from the tether hit
                        this.tower.applyRecoil(e.x - tetherHead.x, e.y - tetherHead.y, 2);
                        if (e.health <= 0) {
                            e.active = false;
                            this.waveKills += 1;
                            this.combo += 1;
                            this.comboTimer = this.comboMaxTime;
                            this.score += Math.floor(10 * this.tower.damageMultiplier) * (1 + this.combo * 0.1);
                            if (Math.random() < this.dropChance) {
                                const types = ['health', 'combo', 'score'];
                                this.pickups.push(new Pickup(e.x, e.y, types[Math.floor(Math.random() * types.length)]));
                            }
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
                         if (e.shieldHealth > 0) {
                             e.shieldHealth -= 20 * dt;
                             if (e.shieldHealth < 0) {
                                 e.health += e.shieldHealth;
                                 e.shieldHealth = 0;
                             }
                         } else {
                             e.health -= 20 * dt;
                         }
                         if (e.health <= 0) {
                            e.active = false;
                            this.waveKills += 1;
                            this.combo += 1;
                            this.comboTimer = this.comboMaxTime;
                            this.score += 5 * (1 + this.combo * 0.1);
                            if (Math.random() < this.dropChance) {
                                const types = ['health', 'combo', 'score'];
                                this.pickups.push(new Pickup(e.x, e.y, types[Math.floor(Math.random() * types.length)]));
                            }
                            this.sound.playExplosion();
                         }
                    }

                    if (e.dropTrap) {
                        e.dropTrap = false;
                        this.env.traps.push(new CaramelTrap(e.x - 20, e.y - 20, 40, 40));
                    }
                    if (e.shoot) {
                        e.shoot = false;
                        const dx = this.tower.x - e.x;
                        const dy = this.tower.y - e.y;
                        const dist = Math.hypot(dx, dy);
                        if (dist > 0) {
                            this.projectiles.push(new EnemyProjectile(e.x, e.y, (dx/dist)*150, (dy/dist)*150, e.damage));
                        }
                    }

                    if (!e.active) {
                        if (e instanceof SplitterEnemy) {
                            let sw1 = new SwarmerEnemy(e.x - 10, e.y, this.tower);
                            let sw2 = new SwarmerEnemy(e.x + 10, e.y, this.tower);
                            this.enemies.push(sw1, sw2);
                        }
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


    spawnBoss() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(this.width, this.height) * 0.7;
        const x = this.tower.x + Math.cos(angle) * dist;
        const y = this.tower.y + Math.sin(angle) * dist;

        if (Math.random() > 0.5) {
            this.activeBoss = new GummyWormBoss(x, y, this.tower);
        } else {
            this.activeBoss = new LollipopCrusherBoss(x, y, this.tower);
        }
        this.enemies.push(this.activeBoss);
    }

    generateDraft() {
        const pool = [
            { title: "Damage Up", desc: "+20% Base Damage", action: () => this.tower.damageMultiplier += 0.2 },
            { title: "Tether Speed", desc: "+15% Extend/Retract Speed", action: () => this.tower.speed *= 1.15 },
            { title: "Max Length", desc: "+20% Tether Reach", action: () => this.tower.maxLength *= 1.2 },
            { title: "Fortify", desc: "Heal +100 & Max HP +50", action: () => { this.tower.maxHealth += 50; this.tower.health = Math.min(this.tower.maxHealth, this.tower.health + 100); } },
            { title: "Combo Max Time", desc: "Combo holds 1.5s longer", action: () => this.comboMaxTime += 1.5 },
            { title: "Overdrive Cooldown", desc: "-1s Overdrive Cooldown", action: () => this.tower.overdriveMaxCooldown = Math.max(2.0, this.tower.overdriveMaxCooldown - 1.0) },
            { title: "Tether Sweep", desc: "+25% Turn Speed", action: () => this.tower.turnSpeed *= 1.25 },
            { title: "Risk Reward", desc: "Enemy drops +20% more Pickups", action: () => this.dropChance += 0.2 }
        ];

        // Shuffle pool
        pool.sort(() => Math.random() - 0.5);
        this.draftChoices = pool.slice(0, 3);
    }

    spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(this.width, this.height) * 0.7; // spawn outside screen
        const x = this.tower.x + Math.cos(angle) * dist;
        const y = this.tower.y + Math.sin(angle) * dist;

        const r = Math.random();
        if (r < 0.3) {
            this.enemies.push(new Enemy(x, y, this.tower));
        } else if (r < 0.5) {
            // Swarmers spawn in groups
            this.enemies.push(new SwarmerEnemy(x, y, this.tower));
            this.enemies.push(new SwarmerEnemy(x + Math.random()*20, y + Math.random()*20, this.tower));
            this.enemies.push(new SwarmerEnemy(x + Math.random()*20, y + Math.random()*20, this.tower));
        } else if (r < 0.65) {
            this.enemies.push(new ShieldedBruiserEnemy(x, y, this.tower));
        } else if (r < 0.8) {
            this.enemies.push(new SplitterEnemy(x, y, this.tower));
        } else if (r < 0.9) {
            this.enemies.push(new AreaDenialEnemy(x, y, this.tower));
        } else {
            this.enemies.push(new RangedSniperEnemy(x, y, this.tower));
        }
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
            case STATES.UPGRADE:
                this.drawPlaying();
                this.drawUpgrade();
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
        this.env.drawBackground(this.ctx);

        this.tower.draw(this.ctx, this.input);
        for (let p of this.projectiles) {
            p.draw(this.ctx);
        }
        for (let e of this.enemies) {
            e.draw(this.ctx);
        }
        for (let p of this.pickups) {
            p.draw(this.ctx);
        }

        this.env.drawForeground(this.ctx);

        // HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${Math.floor(this.score)}`, 20, 40);
        this.ctx.fillText(`Wave: ${this.wave}`, 20, 70);
        this.ctx.fillText(`Kills: ${this.waveKills}/${this.killsToNextWave}`, 20, 100);

        // Combo UI
        if (this.combo > 0) {
            this.ctx.fillStyle = '#feca57';
            this.ctx.fillText(`Combo: x${(1 + this.combo * 0.1).toFixed(1)} (+${this.combo})`, 20, 130);
            // Combo Bar
            this.ctx.fillStyle = '#444';
            this.ctx.fillRect(20, 140, 150, 10);
            this.ctx.fillStyle = '#feca57';
            this.ctx.fillRect(20, 140, 150 * (this.comboTimer / this.comboMaxTime), 10);
        }

        if (this.bossActive && this.bossWarningTimer > 0) {
            this.ctx.fillStyle = (Math.floor(this.bossWarningTimer * 5) % 2 === 0) ? '#ff0000' : '#ffff00';
            this.ctx.font = 'bold 48px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("WARNING: BOSS APPROACHING", this.width / 2, this.height / 2 - 100);
            this.ctx.textAlign = 'left';
        }

        if (this.activeBoss) {
            const barWidth = 400;
            const barHeight = 20;
            const x = (this.width - barWidth) / 2;
            const y = 20;

            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);

            const hpRatio = Math.max(0, this.activeBoss.health / this.activeBoss.maxHealth);
            this.ctx.fillStyle = '#f00';
            this.ctx.fillRect(x, y, barWidth * hpRatio, barHeight);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '16px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.activeBoss.bossName, this.width / 2, y + 15);
            this.ctx.textAlign = 'left';
        }
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

    drawUpgrade() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = ACCENT_COLOR;
        this.ctx.font = '36px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("WAVE COMPLETE! CHOOSE AN UPGRADE", this.width/2, this.height/2 - 120);

        const bw = 250;
        const bh = 150;
        const startX = this.width/2 - (bw*1.5) - 20;
        const startY = this.height/2 - bh/2;

        for (let i = 0; i < this.draftChoices.length; i++) {
            const bx = startX + i * (bw + 20);

            // Box
            this.ctx.fillStyle = '#222';
            this.ctx.strokeStyle = ACCENT_COLOR;
            this.ctx.lineWidth = 3;

            // Hover check
            if (this.state === STATES.UPGRADE &&
                this.input.pointer.x > bx && this.input.pointer.x < bx + bw &&
                this.input.pointer.y > startY && this.input.pointer.y < startY + bh) {
                this.ctx.fillStyle = '#333';
            }

            this.ctx.fillRect(bx, startY, bw, bh);
            this.ctx.strokeRect(bx, startY, bw, bh);

            // Text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 20px monospace';
            this.ctx.fillText(this.draftChoices[i].title, bx + bw/2, startY + 50);

            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '14px monospace';
            this.ctx.fillText(this.draftChoices[i].desc, bx + bw/2, startY + 90);
        }
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
