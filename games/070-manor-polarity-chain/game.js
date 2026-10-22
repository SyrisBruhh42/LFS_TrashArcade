// Phase 1: Foundation
const GAME_ID = "070";
const SLUG = "070-manor-polarity-chain";
const SAVE_KEY = `arcade_game_070_070-manor-polarity-chain_v1`;

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touches = [];
        this.setup();
    }

    setup() {
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener('mousedown', () => { this.mouse.down = true; });
        this.canvas.addEventListener('mouseup', () => { this.mouse.down = false; });

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.updateTouches(e);
            this.mouse.down = true;
        }, { passive: false });

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouches(e);
        }, { passive: false });

        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.updateTouches(e);
            if(this.touches.length === 0) this.mouse.down = false;
        }, { passive: false });
    }

    updateTouches(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.touches = Array.from(e.touches).map(t => ({
            x: t.clientX - rect.left,
            y: t.clientY - rect.top
        }));
    }
}

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestCombo: 0,
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
            console.warn("SaveManager load failed", e);
        }
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("SaveManager save failed", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.masterGain.gain.value = 0.5;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playSynth(freq, type, duration) {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playShoot() {
        this.playSynth(440, 'square', 0.1);
    }

    playExplosion() {
        this.playSynth(100, 'sawtooth', 0.3);
    }

    playSwitch() {
        this.playSynth(600, 'sine', 0.1);
    }
}

class Orb {
    constructor(x, y, vx, vy, polarity) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 15;
        this.polarity = polarity; // 1 or -1
        this.active = true;
        this.hp = 1;
    }

    update(dt, game) {
        if (!this.active) return;

        // Physics update
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Apply friction
        this.vx *= 0.99;
        this.vy *= 0.99;

        // Bounce off walls
        if (this.x - this.radius < 0) { this.x = this.radius; this.vx *= -1; }
        if (this.x + this.radius > game.canvas.width) { this.x = game.canvas.width - this.radius; this.vx *= -1; }
        if (this.y - this.radius < 0) { this.y = this.radius; this.vy *= -1; }
        if (this.y + this.radius > game.canvas.height) { this.y = game.canvas.height - this.radius; this.vy *= -1; }

        // Calculate magnetic force from player
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const distSq = dx*dx + dy*dy;
        const dist = Math.sqrt(distSq);

        if (dist > 0 && dist < 300) {
            // Opposite polarity attracts, same polarity repels
            const forceDir = this.polarity !== game.player.polarity ? 1 : -1;
            const forceMag = (300 - dist) / 300 * 500 * forceDir; // Force magnitude

            this.vx += (dx / dist) * forceMag * dt;
            this.vy += (dy / dist) * forceMag * dt;
        }

        // Limit max speed
        const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (speed > 400) {
            this.vx = (this.vx / speed) * 400;
            this.vy = (this.vy / speed) * 400;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.polarity === 1 ? '#ff4444' : '#4444ff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw inner polarity symbol (+ or -)
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '20px monospace';
        ctx.fillText(this.polarity === 1 ? '+' : '-', 0, 0);

        ctx.restore();
    }
}

class Explosion {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.maxRadius = radius;
        this.radius = 0;
        this.color = color;
        this.active = true;
        this.life = 0;
        this.maxLife = 0.3;
    }

    update(dt) {
        if (!this.active) return;
        this.life += dt;
        if (this.life >= this.maxLife) {
            this.active = false;
        } else {
            this.radius = (this.life / this.maxLife) * this.maxRadius;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.globalAlpha = 1 - (this.life / this.maxLife);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 20;
        this.polarity = 1; // 1 (Red/+) or -1 (Blue/-)
        this.speed = 300;
        this.switchCooldown = 0;
    }

    update(dt, game) {
        // Movement input
        let moveX = 0;
        let moveY = 0;

        if (game.input.keys['ArrowLeft'] || game.input.keys['KeyA']) moveX -= 1;
        if (game.input.keys['ArrowRight'] || game.input.keys['KeyD']) moveX += 1;
        if (game.input.keys['ArrowUp'] || game.input.keys['KeyW']) moveY -= 1;
        if (game.input.keys['ArrowDown'] || game.input.keys['KeyS']) moveY += 1;

        // Normalize movement
        if (moveX !== 0 || moveY !== 0) {
            const len = Math.sqrt(moveX*moveX + moveY*moveY);
            moveX /= len;
            moveY /= len;
        }

        this.vx = moveX * this.speed;
        this.vy = moveY * this.speed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Wall collision
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > game.canvas.width - this.radius) this.x = game.canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > game.canvas.height - this.radius) this.y = game.canvas.height - this.radius;

        // Polarity Switch
        if (this.switchCooldown > 0) {
            this.switchCooldown -= dt;
        }

        if (game.input.keys['Space'] && this.switchCooldown <= 0) {
            this.polarity *= -1;
            this.switchCooldown = 0.5;
            game.sound.playSwitch();
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.polarity === 1 ? '#ff4444' : '#4444ff';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw inner polarity symbol (+ or -)
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '24px monospace';
        ctx.fillText(this.polarity === 1 ? '+' : '-', 0, 0);

        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.input = new InputManager(this.canvas);
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE';
        this.lastTime = 0;

        this.score = 0;
        this.wave = 1;
        this.player = null;
        this.orbs = [];
        this.explosions = [];
        this.particles = []; // For future use

        this.spawnTimer = 0;
        this.spawnInterval = 2;

        this.setupResize();
        this.setupEvents();

        requestAnimationFrame(t => this.loop(t));
    }

    setupResize() {
        this.resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.canvas.width = entry.contentRect.width;
                this.canvas.height = entry.contentRect.height;
            }
        });
        this.resizeObserver.observe(this.canvas.parentElement || document.body);

        // Initial setup
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    setupEvents() {
        window.addEventListener('keydown', (e) => {
            if (!this.sound.ctx) this.sound.init();
            this.sound.resume();

            if (e.code === 'Enter') {
                if (this.state === 'TITLE' || this.state === 'GAME_OVER') {
                    this.resetGame();
                    this.state = 'PLAYING';
                } else if (this.state === 'PLAYING') {
                    this.state = 'PAUSED';
                } else if (this.state === 'PAUSED') {
                    this.state = 'PLAYING';
                }
            }
        });

        this.canvas.addEventListener('pointerdown', () => {
            if (!this.sound.ctx) this.sound.init();
            this.sound.resume();

            if (this.state === 'TITLE' || this.state === 'GAME_OVER') {
                this.resetGame();
                this.state = 'PLAYING';
            }
        });

        // Handle auto-pause
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            }
        });
    }

    resetGame() {
        this.score = 0;
        this.wave = 1;
        this.player = new Player(this.canvas.width / 2, this.canvas.height / 2);
        this.orbs = [];
        this.explosions = [];
        this.spawnTimer = 0;

        // Initial Orbs
        for(let i=0; i<5; i++) {
            this.spawnOrb();
        }
    }

    spawnOrb() {
        // Spawn at edges
        let x, y;
        if (Math.random() > 0.5) {
            x = Math.random() > 0.5 ? 0 : this.canvas.width;
            y = Math.random() * this.canvas.height;
        } else {
            x = Math.random() * this.canvas.width;
            y = Math.random() > 0.5 ? 0 : this.canvas.height;
        }

        const vx = (Math.random() - 0.5) * 100;
        const vy = (Math.random() - 0.5) * 100;
        const polarity = Math.random() > 0.5 ? 1 : -1;

        this.orbs.push(new Orb(x, y, vx, vy, polarity));
    }

    createExplosion(x, y, radius, color) {
        this.explosions.push(new Explosion(x, y, radius, color));
        this.sound.playExplosion();

        // Check for chain reactions (damage nearby orbs)
        for (const orb of this.orbs) {
            if (!orb.active) continue;
            const dx = orb.x - x;
            const dy = orb.y - y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < radius + orb.radius) {
                orb.active = false; // Destroyed in explosion
                this.score += 50;
                // Potential chain reaction
                this.createExplosion(orb.x, orb.y, 80, orb.polarity === 1 ? '#ff4444' : '#4444ff');
            }
        }
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        this.player.update(dt, this);

        // Spawner
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnOrb();
            this.spawnInterval = Math.max(0.5, this.spawnInterval - 0.05); // Faster spawns
        }

        // Update Orbs
        for (const orb of this.orbs) {
            orb.update(dt, this);
        }

        // Update Explosions
        for (const exp of this.explosions) {
            exp.update(dt);
        }

        // Check Collisions (Orb vs Orb)
        for (let i = 0; i < this.orbs.length; i++) {
            const o1 = this.orbs[i];
            if (!o1.active) continue;
            for (let j = i + 1; j < this.orbs.length; j++) {
                const o2 = this.orbs[j];
                if (!o2.active) continue;

                const dx = o2.x - o1.x;
                const dy = o2.y - o1.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < o1.radius + o2.radius) {
                    // Collision!
                    // Simple resolution
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const push = (o1.radius + o2.radius - dist) / 2;
                    o1.x -= nx * push;
                    o1.y -= ny * push;
                    o2.x += nx * push;
                    o2.y += ny * push;

                    // If they are opposite polarity and moving fast enough, explode
                    const relVelX = o2.vx - o1.vx;
                    const relVelY = o2.vy - o1.vy;
                    const relSpeed = Math.sqrt(relVelX*relVelX + relVelY*relVelY);

                    if (o1.polarity !== o2.polarity && relSpeed > 100) {
                        o1.active = false;
                        o2.active = false;
                        this.score += 100;
                        this.createExplosion((o1.x + o2.x)/2, (o1.y + o2.y)/2, 100, '#ffcc00');
                    } else {
                        // Elastic collision
                        const tx = -ny;
                        const ty = nx;
                        const dpTan1 = o1.vx * tx + o1.vy * ty;
                        const dpTan2 = o2.vx * tx + o2.vy * ty;
                        const dpNorm1 = o1.vx * nx + o1.vy * ny;
                        const dpNorm2 = o2.vx * nx + o2.vy * ny;

                        // Swap normal velocities
                        o1.vx = tx * dpTan1 + nx * dpNorm2;
                        o1.vy = ty * dpTan1 + ny * dpNorm2;
                        o2.vx = tx * dpTan2 + nx * dpNorm1;
                        o2.vy = ty * dpTan2 + ny * dpNorm1;
                    }
                }
            }
        }

        // Player vs Orb collision
        for (const orb of this.orbs) {
            if (!orb.active) continue;
            const dx = orb.x - this.player.x;
            const dy = orb.y - this.player.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < orb.radius + this.player.radius) {
                this.state = 'GAME_OVER';
                this.saveManager.data.totalGamesPlayed++;
                if (this.score > this.saveManager.data.highScore) {
                    this.saveManager.data.highScore = this.score;
                }
                this.saveManager.save();
                this.sound.playExplosion();
            }
        }

        // Cleanup
        this.orbs = this.orbs.filter(o => o.active);
        this.explosions = this.explosions.filter(e => e.active);
    }

    draw() {
        // Background
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'TITLE') {
            this.drawTitle();
        } else if (this.state === 'PLAYING') {
            this.drawPlaying();
        } else if (this.state === 'PAUSED') {
            this.drawPlaying();
            this.drawPaused();
        } else if (this.state === 'GAME_OVER') {
            this.drawPlaying();
            this.drawGameOver();
        }
    }

    drawPlaying() {
        for (const exp of this.explosions) exp.draw(this.ctx);
        for (const orb of this.orbs) orb.draw(this.ctx);
        if (this.player) this.player.draw(this.ctx);

        // HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(`SCORE: ${this.score}`, 20, 20);
    }

    drawTitle() {
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';

        this.ctx.font = '48px monospace';
        this.ctx.fillText('Manor Polarity Chain', this.canvas.width/2, this.canvas.height/2 - 50);

        this.ctx.font = '24px monospace';
        this.ctx.fillText('Press ENTER or CLICK to start', this.canvas.width/2, this.canvas.height/2 + 20);
        this.ctx.fillText('Use Arrows/WASD to move, Space to switch polarity', this.canvas.width/2, this.canvas.height/2 + 60);

        // Back to Arcade link (Required)
        this.ctx.font = '16px monospace';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText('Back to Arcade (../../index.html)', this.canvas.width/2, this.canvas.height - 30);
    }

    drawPaused() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';

        this.ctx.font = '48px monospace';
        this.ctx.fillText('PAUSED', this.canvas.width/2, this.canvas.height/2);

        // Back to Arcade link (Required)
        this.ctx.font = '16px monospace';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText('Back to Arcade (../../index.html)', this.canvas.width/2, this.canvas.height - 30);
    }

    drawGameOver() {
        this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';

        this.ctx.font = '48px monospace';
        this.ctx.fillText('GAME OVER', this.canvas.width/2, this.canvas.height/2 - 30);

        this.ctx.font = '24px monospace';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width/2, this.canvas.height/2 + 20);
        this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.canvas.width/2, this.canvas.height/2 + 50);

        this.ctx.font = '20px monospace';
        this.ctx.fillText('Press ENTER or CLICK to restart', this.canvas.width/2, this.canvas.height/2 + 100);
    }

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }
}

window.onload = () => {
    window.game = new Game();
};
