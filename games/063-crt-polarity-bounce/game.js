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
    playDash() { this.playTone(600, 'triangle', 0.15, 0.1); }
    playThrust() { this.playTone(150, 'sine', 0.05, 0.02); }
    playGameOver() { this.playTone(100, 'sawtooth', 1.0, 0.2); }
}

class InputManager {
    constructor() {
        this.keys = {};
        this.pointer = { x: 0, y: 0, down: false, justDown: false, rightJustDown: false };
        this.bind();
    }
    bind() {
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            if (window.game && window.game.sound) window.game.sound.init();
        });
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('contextmenu', e => {
            e.preventDefault();
        });
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            canvas.addEventListener('pointerdown', e => {
                if (e.button === 2 || (e.touches && e.touches.length > 1)) {
                    this.pointer.rightJustDown = true;
                } else {
                    this.pointer.down = true;
                    this.pointer.justDown = true;
                }
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
    consumeRightJustDown() {
        const down = this.pointer.rightJustDown;
        this.pointer.rightJustDown = false;
        return down;
    }
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


class BaseEnemy {
    constructor(x, y, isPos) {
        this.x = x;
        this.y = y;
        this.isPos = isPos;
        this.radius = 15;
        this.time = Math.random() * 10;
        this.type = 'base';
        this.vx = 0;
        this.vy = 0;
        this.maxHealth = 1;
        this.health = 1;
        this.flashTimer = 0;
    }
    takeDamage(amount) {
        this.health -= amount;
        this.flashTimer = 0.1;
    }
    update(dt, w, h, game) {
        const player = game ? game.player : null;
        this.time += dt;
        if (this.flashTimer > 0) this.flashTimer -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.enforceBounds(w, h);
    }
    enforceBounds(w, h) {
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
        if (this.x > w - this.radius) { this.x = w - this.radius; this.vx *= -1; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
        if (this.y > h - this.radius) { this.y = h - this.radius; this.vy *= -1; }
    }
    draw(ctx) {
        const color = (this.flashTimer > 0) ? '#ffffff' : (this.isPos ? COLORS.pos : COLORS.neg);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.save();
        ctx.translate(this.x, this.y);
        this.drawGeometry(ctx);
        ctx.restore();
    }
    drawGeometry(ctx) {
        // Override
    }
}

class BaseBoss extends BaseEnemy {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.maxHealth = 20;
        this.health = 20;
        this.radius = 40;
        this.phase2 = false;
        this.phaseTransitionAlpha = 0;
        this.bossName = "BOSS";
        this.type = 'boss';
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= this.maxHealth / 2 && !this.phase2) {
            this.phase2 = true;
            this.phaseTransitionAlpha = 1.0;
            this.onPhase2();
        }
    }

    onPhase2() {
        // Override in subclasses
    }

    drawHealthBar(ctx, width) {
        const barWidth = width * 0.8;
        const barHeight = 20;
        const x = (width - barWidth) / 2;
        const y = 80;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y, barWidth, barHeight);

        const fillWidth = barWidth * (Math.max(0, this.health) / this.maxHealth);
        ctx.fillStyle = this.isPos ? COLORS.pos : COLORS.neg;
        ctx.fillRect(x + 2, y + 2, fillWidth - 4, barHeight - 4);

        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.bossName, width / 2, y + 15);

        if (this.phaseTransitionAlpha > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.phaseTransitionAlpha})`;
            ctx.font = '30px monospace';
            ctx.fillText('WARNING: PHASE 2!', width / 2, y + 60);
            this.phaseTransitionAlpha = Math.max(0, this.phaseTransitionAlpha - 0.02);
        }
    }
}

class OrbitalBoss extends BaseBoss {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.bossName = "ORBITAL PRIME";
        this.radius = 50;
        this.orbitals = [];
        for (let i=0; i<4; i++) {
            this.orbitals.push({ angle: (Math.PI / 2) * i, dist: 80, isPos: Math.random() > 0.5 });
        }
        this.orbitalSpeed = 1.5;
        this.attackTimer = 2.0;
    }

    onPhase2() {
        this.orbitalSpeed = 3.0;
        this.isPos = !this.isPos; // Switch polarity on phase 2
        for (let o of this.orbitals) {
            o.dist = 120;
        }
    }

    update(dt, w, h, game) {
        const player = game ? game.player : null;
        super.update(dt, w, h, game);
        if (player) {
            const targetX = w/2 + (player.x - w/2) * 0.3;
            const targetY = h/2 + (player.y - h/2) * 0.3;
            this.vx += (targetX - this.x) * dt * 2;
            this.vy += (targetY - this.y) * dt * 2;
        }
        this.vx *= 0.95;
        this.vy *= 0.95;

        for (let o of this.orbitals) {
            o.angle += this.orbitalSpeed * dt;
        }

        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase2 ? 1.5 : 3.0;
            this.fireBulletHell(game);
        }
    }

    fireBulletHell(game) {
        if (!game) return;
        game.sound.playShoot();
        const numBullets = this.phase2 ? 12 : 8;
        for (let i = 0; i < numBullets; i++) {
            const angle = (Math.PI * 2 / numBullets) * i + this.time;
            const speed = 150;
            game.enemyProjectiles.push(new EnemyProjectile(
                this.x + Math.cos(angle) * this.radius,
                this.y + Math.sin(angle) * this.radius,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                this.isPos
            ));
        }
    }

    drawGeometry(ctx) {
        ctx.rotate(this.time);
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        for (let i=1; i<6; i++) {
            const angle = (Math.PI * 2 / 6) * i;
            ctx.lineTo(Math.cos(angle) * this.radius, Math.sin(angle) * this.radius);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();

        for (let o of this.orbitals) {
            ctx.save();
            ctx.rotate(o.angle);
            ctx.translate(o.dist, 0);
            ctx.fillStyle = o.isPos ? COLORS.pos : COLORS.neg;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
        }
    }
}

class LaserBoss extends BaseBoss {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.bossName = "BEAM CONSTRUCT";
        this.radius = 45;
        this.laserTimer = 3.0;
        this.lasers = [];
        this.rotSpeed = 0.5;
    }

    onPhase2() {
        this.rotSpeed = 1.0;
    }

    update(dt, w, h, game) {
        const player = game ? game.player : null;
        super.update(dt, w, h, game);
        if (player) {
            const dx = w/2 - this.x;
            const dy = h/2 - this.y;
            this.vx += dx * dt * 2;
            this.vy += dy * dt * 2;
        }
        this.vx *= 0.95;
        this.vy *= 0.95;

        this.laserTimer -= dt;
        if (this.laserTimer <= 0) {
            this.laserTimer = this.phase2 ? 3.0 : 5.0;
            this.lasers = [
                { angle: 0, duration: 2.0, active: true },
                { angle: Math.PI / 2, duration: 2.0, active: true },
                { angle: Math.PI, duration: 2.0, active: true },
                { angle: Math.PI * 1.5, duration: 2.0, active: true }
            ];
            if (game) game.sound.playShoot();
        }

        for (let i = this.lasers.length - 1; i >= 0; i--) {
            let l = this.lasers[i];
            l.duration -= dt;
            if (l.duration <= 0) {
                this.lasers.splice(i, 1);
            } else if (player && game) {
                const rotAngle = this.time * this.rotSpeed + l.angle;
                const px = player.x - this.x;
                const py = player.y - this.y;
                const dist = Math.hypot(px, py);
                const angleToPlayer = Math.atan2(py, px);

                let diff = angleToPlayer - rotAngle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;

                if (Math.abs(diff) < 0.15 && dist < 2000) {
                    if (game.health > 0 && !player.isInvulnerable) {
                        game.health--;
                        game.sound.playHit();
                        game.spawnParticles(player.x, player.y, '#ff0000', 30);
                        player.triggerRecoil(Math.cos(rotAngle), Math.sin(rotAngle), 600, true);
                        if (game.health <= 0) {
                            game.triggerGameOver();
                        }
                    }
                }
            }
        }
    }

    drawGeometry(ctx) {
        const rotAngle = this.time * this.rotSpeed;
        ctx.rotate(rotAngle);

        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
        ctx.stroke();

        for (let l of this.lasers) {
            ctx.save();
            ctx.rotate(l.angle);
            ctx.beginPath();
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(2000, 0);
            ctx.lineWidth = l.duration > 1.0 ? 6 : (l.duration * 6);
            ctx.strokeStyle = this.isPos ? COLORS.pos : COLORS.neg;
            ctx.stroke();
            ctx.restore();
        }
    }
}


class SwarmerEnemy extends BaseEnemy {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.type = 'swarmer';
        this.radius = 12;
        this.speed = 120;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(dt, w, h, game) {
        const player = game ? game.player : null;
        this.time += dt;
        this.wobble += dt * 5;
        if (this.flashTimer > 0) this.flashTimer -= dt;

        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            const targetVx = (dx / dist) * this.speed;
            const targetVy = (dy / dist) * this.speed;

            this.vx += (targetVx - this.vx) * dt * 2;
            this.vy += (targetVy - this.vy) * dt * 2;
        }

        this.x += (this.vx + Math.sin(this.wobble) * 10) * dt;
        this.y += (this.vy + Math.cos(this.wobble) * 10) * dt;
        this.enforceBounds(w, h);
    }
    drawGeometry(ctx) {
        ctx.rotate(Math.atan2(this.vy, this.vx));
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius * 0.8);
        ctx.closePath();
        ctx.stroke();
    }
}

class SniperEnemy extends BaseEnemy {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.type = 'sniper';
        this.radius = 16;
        this.state = 'idle'; // idle, aiming, firing
        this.stateTimer = 2.0 + Math.random();
        this.targetAngle = 0;
        this.telegraphIntensity = 0;
    }
    update(dt, w, h, game) {
        const player = game ? game.player : null;
        super.update(dt, w, h, player);
        this.stateTimer -= dt;

        if (this.state === 'idle') {
            this.vx *= 0.95;
            this.vy *= 0.95;
            if (this.stateTimer <= 0) {
                this.state = 'aiming';
                this.stateTimer = 1.5;
                if (player) this.targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
            }
        } else if (this.state === 'aiming') {
            this.telegraphIntensity = 1.0 - (this.stateTimer / 1.5);
            if (player) {
                // track slowly
                const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                let diff = angleToPlayer - this.targetAngle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;
                this.targetAngle += diff * dt * 2;
            }
            if (this.stateTimer <= 0) {
                this.state = 'firing';
                this.stateTimer = 0.5;
                if (game && game.sound) game.sound.playShoot();

                // Fire projectile
                const speed = 400;
                const px = this.x + Math.cos(this.targetAngle) * this.radius;
                const py = this.y + Math.sin(this.targetAngle) * this.radius;
                if(game) game.enemyProjectiles.push(new EnemyProjectile(px, py, Math.cos(this.targetAngle)*speed, Math.sin(this.targetAngle)*speed, this.isPos));

                // Recoil
                this.vx = -Math.cos(this.targetAngle) * 200;
                this.vy = -Math.sin(this.targetAngle) * 200;
            }
        } else if (this.state === 'firing') {
            this.telegraphIntensity = 0;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 2.0;
            }
        }
    }
    drawGeometry(ctx) {
        ctx.rotate(this.targetAngle || this.time);

        if (this.state === 'aiming') {
            ctx.save();
            ctx.globalAlpha = this.telegraphIntensity;
            ctx.beginPath();
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(800, 0);
            ctx.strokeStyle = this.isPos ? COLORS.pos : COLORS.neg;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.lineTo(-this.radius * 0.5, 0);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();
    }
}

class ShieldedBruiserEnemy extends BaseEnemy {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.type = 'bruiser';
        this.radius = 24;
        this.maxHealth = 3;
        this.health = 3;
        this.vx = (Math.random() - 0.5) * 80;
        this.vy = (Math.random() - 0.5) * 80;
    }
    update(dt, w, h, game) {
        const player = game ? game.player : null;
        super.update(dt, w, h, player);
        if (player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy) || 1;
            if (dist < 200) {
                this.vx += (dx / dist) * dt * 50;
                this.vy += (dy / dist) * dt * 50;
            }
        }
    }
    drawGeometry(ctx) {
        ctx.rotate(this.time * 0.5);
        ctx.beginPath();
        ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
        ctx.stroke();

        // Draw shield layers based on health
        for (let i = 1; i < this.health; i++) {
            const offset = i * 4;
            ctx.beginPath();
            ctx.rect(-this.radius - offset, -this.radius - offset, (this.radius + offset) * 2, (this.radius + offset) * 2);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(-this.radius, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.moveTo(this.radius, -this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.stroke();
    }
}

class SplitterEnemy extends BaseEnemy {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.type = 'splitter';
        this.radius = 20;
        this.vx = (Math.random() - 0.5) * 100;
        this.vy = (Math.random() - 0.5) * 100;
        this.rotSpeed = (Math.random() > 0.5 ? 1 : -1) * 2;
    }
    update(dt, w, h, game) {
        const player = game ? game.player : null;
        super.update(dt, w, h, player);
    }
    drawGeometry(ctx) {
        ctx.rotate(this.time * this.rotSpeed);

        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            ctx.lineTo(Math.cos(i * Math.PI / 2) * this.radius, Math.sin(i * Math.PI / 2) * this.radius);
            ctx.lineTo(Math.cos(i * Math.PI / 2 + Math.PI / 4) * this.radius * 0.4, Math.sin(i * Math.PI / 2 + Math.PI / 4) * this.radius * 0.4);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.stroke();
    }
}

class HazardEnemy extends BaseEnemy {
    constructor(x, y, isPos) {
        super(x, y, isPos);
        this.type = 'hazard';
        this.radius = 18;
        this.pulseTime = 0;
        this.vx = (Math.random() - 0.5) * 50;
        this.vy = (Math.random() - 0.5) * 50;
        this.state = 'idle';
        this.stateTimer = 2.0;
    }
    update(dt, w, h, game) {
        const player = game ? game.player : null;
        super.update(dt, w, h, player);
        this.stateTimer -= dt;

        if (this.state === 'idle') {
            if (this.stateTimer <= 0) {
                this.state = 'charging';
                this.stateTimer = 1.0;
            }
        } else if (this.state === 'charging') {
            this.pulseTime += dt * 5;
            if (this.stateTimer <= 0) {
                this.state = 'active';
                this.stateTimer = 2.0;
            }
        } else if (this.state === 'active') {
            this.pulseTime += dt * 10;
            if (this.stateTimer <= 0) {
                this.state = 'idle';
                this.stateTimer = 2.0;
            }

            // Apply repulsive force to player
            if (player) {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const dist = Math.hypot(dx, dy) || 1;
                if (dist < 150) {
                    const force = (150 - dist) * 10;
                    player.vx += (dx / dist) * force * dt;
                    player.vy += (dy / dist) * force * dt;
                }
            }
        }
    }
    drawGeometry(ctx) {
        ctx.rotate(this.time);

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            ctx.lineTo(Math.cos(i * Math.PI / 3) * this.radius, Math.sin(i * Math.PI / 3) * this.radius);
        }
        ctx.closePath();
        ctx.stroke();

        if (this.state === 'charging' || this.state === 'active') {
            const maxRadius = this.state === 'charging' ? 80 : 150;
            const currentRadius = this.radius + (Math.sin(this.pulseTime) * 0.5 + 0.5) * (maxRadius - this.radius);

            ctx.beginPath();
            ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
            ctx.setLineDash([5, 10]);
            ctx.globalAlpha = this.state === 'active' ? 0.5 : 0.2;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;
        }

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

class EnemyProjectile {
    constructor(x, y, vx, vy, isPos) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.isPos = isPos;
        this.radius = 4;
        this.life = 3.0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.isPos ? COLORS.pos : COLORS.neg;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

function getRandomEnemy(x, y, isPos) {
    const r = Math.random();
    if (r < 0.2) return new SwarmerEnemy(x, y, isPos);
    if (r < 0.4) return new SniperEnemy(x, y, isPos);
    if (r < 0.6) return new ShieldedBruiserEnemy(x, y, isPos);
    if (r < 0.8) return new SplitterEnemy(x, y, isPos);
    return new HazardEnemy(x, y, isPos);
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

        // Phase 2 features
        this.dashCooldown = 0;
        this.dashCooldownMax = 2.0;
        this.isDashing = false;
        this.dashDuration = 0;
        this.dashDurationMax = 0.2;

        this.invulnerabilityTimer = 0;
        this.recoilTimer = 0;
        this.recoilForceX = 0;
        this.recoilForceY = 0;
        this.targetAngle = 0;
        this.thrustAlpha = 0;
    }

    get isInvulnerable() {
        return this.invulnerabilityTimer > 0;
    }

    triggerRecoil(nx, ny, force, isDamage) {
        this.recoilForceX = nx * force;
        this.recoilForceY = ny * force;
        this.recoilTimer = 0.3;
        if (isDamage) {
            this.invulnerabilityTimer = 1.5;
        }
    }

    switchPolarity() {
        this.isPos = !this.isPos;
        if (window.game && window.game.sound) window.game.sound.playSwitch();
    }

    dash(input) {
        if (this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashDuration = this.dashDurationMax;
            this.dashCooldown = this.dashCooldownMax;

            // Boost velocity in current direction or target angle
            let curSpeed = Math.hypot(this.vx, this.vy);
            if (curSpeed < 50) {
                // If basically still, dash forward based on input or arbitrary
                let dx = 0, dy = 0;
                if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy = -1;
                if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy = 1;
                if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx = -1;
                if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx = 1;

                if (dx === 0 && dy === 0) {
                    dx = 1; // default right
                }
                const len = Math.hypot(dx, dy);
                this.vx = (dx / len) * this.speed * 3;
                this.vy = (dy / len) * this.speed * 3;
            } else {
                this.vx += (this.vx / curSpeed) * this.speed * 2;
                this.vy += (this.vy / curSpeed) * this.speed * 2;
            }
            if (window.game && window.game.sound) window.game.sound.playDash();
        }
    }

    update(dt, input, w, h, nodes) {
        this.time += dt;

        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer -= dt;
        if (this.recoilTimer > 0) this.recoilTimer -= dt;

        if (this.isDashing) {
            this.dashDuration -= dt;
            if (this.dashDuration <= 0) {
                this.isDashing = false;
            }
        }

        // Initial launch mechanics and basic movement adjustment
        let dx = 0, dy = 0;
        if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy = -1;
        if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy = 1;
        if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx = -1;
        if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx = 1;

        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            const moveVx = (dx / len) * this.speed;
            const moveVy = (dy / len) * this.speed;

            // If near standstill, launch
            if (Math.hypot(this.vx, this.vy) < 10) {
                this.vx = moveVx;
                this.vy = moveVy;
            } else if (!this.isDashing) {
                // Subtle air control / momentum tuning
                this.vx += moveVx * dt * 2.0;
                this.vy += moveVy * dt * 2.0;
            }
            this.targetAngle = Math.atan2(this.vy, this.vx);
            this.thrustAlpha = Math.min(1.0, this.thrustAlpha + dt * 10);
            if (Math.random() < 0.1 && window.game && window.game.sound) window.game.sound.playThrust();
        } else {
            this.thrustAlpha = Math.max(0.0, this.thrustAlpha - dt * 5);
        }

        if (Math.hypot(this.vx, this.vy) > 10) {
             this.targetAngle = Math.atan2(this.vy, this.vx);
        }

        // Magnetic forces from nodes
        if (!this.isDashing) {
            for (let node of nodes) {
                const ndx = node.x - this.x;
                const ndy = node.y - this.y;
                const distSq = ndx*ndx + ndy*ndy;

                // Interaction range bounds
                if (distSq > 100 && distSq < 150000) {
                    const dist = Math.sqrt(distSq);
                    const force = node.power / distSq;
                    const isAttract = (this.isPos !== node.isPos);
                    const dir = isAttract ? 1 : -1;

                    this.vx += (ndx / dist) * force * dir * dt;
                    this.vy += (ndy / dist) * force * dir * dt;
                }
            }
        }

        // Clamp maximum speed to avoid physics glitches
        let maxSpeed = this.isDashing ? 1500 : 800;
        const curSpeed = Math.hypot(this.vx, this.vy);
        if (curSpeed > maxSpeed) {
            this.vx = (this.vx / curSpeed) * maxSpeed;
            this.vy = (this.vy / curSpeed) * maxSpeed;
        }

        // Apply friction
        if (!this.isDashing) {
            this.vx *= this.friction;
            this.vy *= this.friction;
        }

        // Apply recoil
        let effectiveVx = this.vx;
        let effectiveVy = this.vy;
        if (this.recoilTimer > 0) {
            const recoilFactor = (this.recoilTimer / 0.3);
            effectiveVx += this.recoilForceX * recoilFactor;
            effectiveVy += this.recoilForceY * recoilFactor;
        }

        // Update position based on velocity
        this.x += effectiveVx * dt;
        this.y += effectiveVy * dt;

        // Wall bouncing logic
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
        if (this.x > w - this.radius) { this.x = w - this.radius; this.vx *= -1; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
        if (this.y > h - this.radius) { this.y = h - this.radius; this.vy *= -1; }

        // Maintain trail positions
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > (this.isDashing ? 25 : 15)) this.trail.shift();
    }

    draw(ctx) {
        const color = this.isPos ? COLORS.pos : COLORS.neg;

        // Invulnerability Blink
        if (this.isInvulnerable) {
            if (Math.floor(this.time * 20) % 2 === 0) return;
        }

        // Render motion trail
        if (this.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for(let i=1; i<this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = this.isDashing ? 8 : 4;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Recoil wobble
        if (this.recoilTimer > 0) {
            ctx.rotate((Math.random() - 0.5) * 0.5);
            ctx.scale(1.2, 0.8);
        }

        ctx.rotate(this.targetAngle);

        // Render Aim Telegraph
        ctx.beginPath();
        ctx.moveTo(this.radius + 5, 0);
        ctx.lineTo(this.radius + 20, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Render Engine Thrust
        if (this.thrustAlpha > 0) {
            ctx.beginPath();
            ctx.moveTo(-this.radius, -5);
            ctx.lineTo(-this.radius - 15 - Math.random() * 10, 0);
            ctx.lineTo(-this.radius, 5);
            ctx.fillStyle = `rgba(255, 100, 0, ${this.thrustAlpha})`;
            ctx.fill();
        }

        // Outer procedural ring
        ctx.beginPath();
        let points = 8;
        for (let i = 0; i < points; i++) {
            let a = (i / points) * Math.PI * 2 + this.time * 2;
            let r = this.radius + 4 + Math.sin(this.time * 10 + i) * 2;
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Render player core
        ctx.rotate(-this.targetAngle); // Unrotate for core symbols
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Render player stroke outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Internal polarity indicator
        ctx.fillStyle = '#000';
        ctx.beginPath();
        if (this.isPos) {
            ctx.fillRect(-6, -1, 12, 2);
            ctx.fillRect(-1, -6, 2, 12);
        } else {
            ctx.fillRect(-6, -1, 12, 2);
        }

        ctx.restore();
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
        this.world = new WorldEnvironment(this.width, this.height);
        this.player = null;
        this.nodes = [];
        this.enemies = [];
        this.enemyProjectiles = [];
        this.enemyProjectiles = [];
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
                if (this.world) this.world.resize(this.width, this.height);
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
        this.world.reset();

        // Spawn 4 nodes in a quad formation
        const paddingX = this.width * 0.25;
        const paddingY = this.height * 0.25;
        this.nodes.push(new MagneticNode(paddingX, paddingY, true));
        this.nodes.push(new MagneticNode(this.width - paddingX, paddingY, false));
        this.nodes.push(new MagneticNode(paddingX, this.height - paddingY, false));
        this.nodes.push(new MagneticNode(this.width - paddingX, this.height - paddingY, true));

        this.enemies = [];
        this.enemyProjectiles = [];
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
        const rightJustDown = this.input.consumeRightJustDown();
        const shiftDown = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
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

            if ((shiftDown && !this.shiftWasDown) || rightJustDown) {
                this.player.dash(this.input);
            }
        }

        this.spaceWasDown = spaceDown;
        this.shiftWasDown = shiftDown;
    }

    update(dt) {
        this.handleInput();

        if (this.state !== 'PLAYING') return;

        this.player.update(dt, this.input, this.width, this.height, this.nodes);
        for(let n of this.nodes) n.update(dt);
        this.world.update(dt, this);

        // Enemy spawner logic
        let hasBoss = false;
        for (let e of this.enemies) {
            if (e.type === 'boss') hasBoss = true;
        }

        // Trigger boss every 5 waves
        if (this.wave > 0 && this.wave % 5 === 0 && !hasBoss && this.bossSpawnedWave !== this.wave) {
            this.bossSpawnedWave = this.wave;
            const isPos = Math.random() > 0.5;
            const ex = this.width / 2;
            const ey = this.height / 2;

            // Clear existing enemies for boss fight
            this.enemies = [];
            this.enemyProjectiles = [];

            if (Math.random() > 0.5) {
                this.enemies.push(new OrbitalBoss(ex, ey, isPos));
            } else {
                this.enemies.push(new LaserBoss(ex, ey, isPos));
            }
        }

        if (!hasBoss) {
            this.enemySpawnTimer += dt;
            const spawnInterval = Math.max(0.5, 3.0 - (this.wave * 0.15));

            if (this.enemySpawnTimer > spawnInterval) {
                this.enemySpawnTimer = 0;
                const isPos = Math.random() > 0.5;

                // Keep enemies away from edges when spawning
                const ex = Math.random() * (this.width - 100) + 50;
                const ey = Math.random() * (this.height - 100) + 50;
                this.enemies.push(getRandomEnemy(ex, ey, isPos));
            }
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
        // Update projectiles
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const p = this.enemyProjectiles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }

            // Check collision with player
            const dx = p.x - this.player.x;
            const dy = p.y - this.player.y;
            if (dx*dx + dy*dy < (p.radius + this.player.radius)**2) {
                if (this.player.isPos === p.isPos) {
                    // Match polarity - absorb projectile for small score
                    this.score += 5;
                    this.sound.playShoot();
                    this.spawnParticles(p.x, p.y, p.isPos ? COLORS.particlePos : COLORS.particleNeg, 5);
                } else {
                    // Opposite polarity - damage
                    if (!this.player.isInvulnerable) {
                        this.sound.playHit();
                        this.health--;
                        this.player.triggerRecoil(dx/Math.hypot(dx,dy), dy/Math.hypot(dx,dy), 500, true);
                        if (this.health <= 0) {
                            this.state = 'GAME_OVER';
                            if (this.score > this.highScore) this.highScore = this.score;
                        }
                    }
                }
                this.enemyProjectiles.splice(i, 1);
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.width, this.height, this);

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
            // Success: Matching Polarity - Damage Enemy
            e.takeDamage(1);
            if (e.health <= 0) {
                this.score += (e.maxHealth * 10);
                this.sound.playShoot();
                this.spawnParticles(e.x, e.y, e.isPos ? COLORS.particlePos : COLORS.particleNeg, 15 + e.maxHealth * 5);

                if (e.type === 'splitter') {
                    for (let j = 0; j < 3; j++) {
                        const child = new SwarmerEnemy(e.x, e.y, e.isPos);
                        child.vx = (Math.random() - 0.5) * 200;
                        child.vy = (Math.random() - 0.5) * 200;
                        this.enemies.push(child);
                    }
                }

                this.enemies.splice(index, 1);
            } else {
                this.sound.playShoot();
                this.spawnParticles(e.x, e.y, e.isPos ? COLORS.particlePos : COLORS.particleNeg, 5);
                e.vx = nx * 200;
                e.vy = ny * 200;
            }

            // Ricochet player slightly
            this.player.vx = -nx * this.player.speed * 0.8;
            this.player.vy = -ny * this.player.speed * 0.8;
            this.player.triggerRecoil(-nx, -ny, 300, false);

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
            this.player.triggerRecoil(-nx, -ny, 600, true);

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
        let boss = null;
        for (let e of this.enemies) {
            if (e.type === 'boss') {
                boss = e;
                break;
            }
        }
        if (boss) {
            boss.drawHealthBar(this.ctx, this.width);
        }

        this.ctx.fillStyle = COLORS.text;
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 10, 30);
        this.ctx.fillText(`Health: ${this.health}`, 10, 60);
        this.ctx.fillText(`Wave: ${this.wave}`, 10, 90);

        // Dash Cooldown indicator
        const dashReady = this.player.dashCooldown <= 0;
        this.ctx.fillStyle = dashReady ? '#00ff00' : '#ff0000';
        this.ctx.fillText(`DASH: ${dashReady ? 'READY' : (this.player.dashCooldown).toFixed(1)}`, 10, 120);


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

        this.world.drawBackground(this.ctx, this.totalTime, this.grid);
        for (let n of this.nodes) n.draw(this.ctx);
        this.world.drawHazards(this.ctx);

        if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
            for (let e of this.enemies) e.draw(this.ctx);
        for (let p of this.enemyProjectiles) p.draw(this.ctx);
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
