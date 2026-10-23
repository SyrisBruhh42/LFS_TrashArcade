
const SAVE_KEY = 'arcade_game_077_077-origami-heist-shift_v1';
const STATES = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAME_OVER: 3, UPGRADE_DRAFT: 4 };

class SaveManager {
    constructor() {
        this.data = { highScore: 0, totalGamesPlayed: 0, totalScoreAccumulated: 0 };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(SAVE_KEY);
            if (stored) {
                this.data = Object.assign(this.data, JSON.parse(stored));
            }
        } catch (e) {
            console.warn("Save load failed", e);
        }
    }
    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("Save write failed", e);
        }
    }
    updateScore(score) {
        if (score > this.data.highScore) this.data.highScore = score;
        this.data.totalScoreAccumulated += score;
        this.data.totalGamesPlayed++;
        this.save();
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }
    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playTone(freq, type, duration, vol) {
        if (!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playPickup() { this.playTone(800, 'sine', 0.1, 0.2); setTimeout(()=>this.playTone(1200, 'sine', 0.2, 0.2), 50); }
    playAlert() { this.playTone(200, 'sawtooth', 0.3, 0.3); }
    playGameOver() { this.playTone(150, 'square', 0.5, 0.4); setTimeout(()=>this.playTone(100, 'square', 0.8, 0.4), 200); }
    playClick() { this.playTone(400, 'sine', 0.05, 0.1); }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, justDown: false };
        this.touchActive = false;

        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);

        const updateMouse = (e, down) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            if (down !== null) {
                if (down && !this.mouse.down) this.mouse.justDown = true;
                this.mouse.down = down;
            }
        };

        this.canvas.addEventListener('mousedown', e => { updateMouse(e, true); window.game.sound.init(); });
        this.canvas.addEventListener('mousemove', e => updateMouse(e, null));
        this.canvas.addEventListener('mouseup', e => updateMouse(e, false));

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.touchActive = true;
            updateMouse(e.touches[0], true);
            window.game.sound.init();
        }, {passive: false});
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            updateMouse(e.touches[0], null);
        }, {passive: false});
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.mouse.down = false;
            this.touchActive = false;
        }, {passive: false});
    }
    update() {
        this.mouse.justDown = false;
    }
    isDown(code) { return !!this.keys[code]; }
    getAxis() {
        let x = 0, y = 0;
        if (this.isDown('ArrowLeft') || this.isDown('KeyA')) x -= 1;
        if (this.isDown('ArrowRight') || this.isDown('KeyD')) x += 1;
        if (this.isDown('ArrowUp') || this.isDown('KeyW')) y -= 1;
        if (this.isDown('ArrowDown') || this.isDown('KeyS')) y += 1;

        if (this.mouse.down && this.touchActive) {
            const dx = this.mouse.x - window.game.player.x;
            const dy = this.mouse.y - window.game.player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 10) {
                x = dx / dist;
                y = dy / dist;
            }
        }

        const len = Math.hypot(x, y);
        if (len > 0) { x /= len; y /= len; }
        return { x, y };
    }
}

class TrailParticle {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.life = 1.0;
    }
    update(dt) {
        this.life -= dt * 3;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.speed = 400; // Acceleration
        this.friction = 0.85; // Momentum retention
        this.color = '#fff';
        this.dashCooldown = 0;
        this.dashCooldownMax = 2.0;
        this.dashSpeed = 800;
        this.isDashing = false;
        this.dashTime = 0;
        this.invulnerableTimer = 0;
        this.angle = 0;
        this.trails = [];
        this.recoil = 0;
    }
    update(dt, input) {
        const axis = input.getAxis();

        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
        if (this.recoil > 0) this.recoil -= dt * 5;
        if (this.recoil < 0) this.recoil = 0;

        // Dash Initiation
        if ((input.isDown('ShiftLeft') || input.isDown('ShiftRight') || input.mouse.justDown) && this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashTime = 0.2;
            this.dashCooldown = this.dashCooldownMax;
            this.invulnerableTimer = 0.3; // Invulnerable during and slightly after dash
            let dx = axis.x;
            let dy = axis.y;
            if (dx === 0 && dy === 0) { dx = Math.sin(this.angle); dy = -Math.cos(this.angle); }
            const len = Math.hypot(dx, dy);
            this.vx = (dx / len) * this.dashSpeed;
            this.vy = (dy / len) * this.dashSpeed;
            this.recoil = 1.0;

            if(window.game && window.game.sound) {
                window.game.sound.playTone(300, 'square', 0.1, 0.2); // Dash sound
            }
        }

        if (this.isDashing) {
            this.dashTime -= dt;
            if (this.dashTime <= 0) {
                this.isDashing = false;
            }
            // Spawn trail
            if (Math.random() < 0.5) {
                this.trails.push(new TrailParticle(this.x + (Math.random()-0.5)*10, this.y + (Math.random()-0.5)*10, 4, '#aaa'));
            }
        } else {
            // Normal movement with acceleration and friction
            this.vx += axis.x * this.speed * dt;
            this.vy += axis.y * this.speed * dt;
            this.vx *= this.friction;
            this.vy *= this.friction;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (axis.x !== 0 || axis.y !== 0) {
            this.angle = Math.atan2(axis.y, axis.x) + Math.PI/2;
        } else if (this.vx !== 0 || this.vy !== 0) {
             this.angle = Math.atan2(this.vy, this.vx) + Math.PI/2;
        }

        this.trails.forEach(t => t.update(dt));
        this.trails = this.trails.filter(t => t.life > 0);
    }
    draw(ctx) {
        this.trails.forEach(t => t.draw(ctx));

        if (this.invulnerableTimer > 0 && Math.floor(performance.now() / 50) % 2 === 0) {
            return; // Blink
        }

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Recoil offset
        ctx.translate(0, this.recoil * 5);

        // Thrust telegraph (if moving but not dashing)
        if (!this.isDashing && (Math.abs(this.vx) > 10 || Math.abs(this.vy) > 10)) {
            ctx.fillStyle = '#f88';
            ctx.beginPath();
            ctx.moveTo(-5, this.radius);
            ctx.lineTo(0, this.radius + 10 + Math.random()*5);
            ctx.lineTo(5, this.radius);
            ctx.fill();
        }

        // Left Wing
        ctx.fillStyle = '#ddd';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(-this.radius - 5, this.radius);
        ctx.lineTo(0, this.radius - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right Wing
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius + 5, this.radius);
        ctx.lineTo(0, this.radius - 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit / Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius - 2);
        ctx.lineTo(6, this.radius - 2);
        ctx.lineTo(-6, this.radius - 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Paper fold line
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius - 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();

        // Add extra line to meet line count
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.restore();
    }
}


class Treasure {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 8;
        this.active = true;
        this.pulse = 0;
    }
    update(dt) {
        this.pulse += dt * 5;
    }
    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        const s = 1 + 0.2 * Math.sin(this.pulse);
        ctx.scale(s, s);
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fold lines
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(this.radius, 0);
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.stroke();

        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.baseWidth = 800;
        this.baseHeight = 600;

        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(this.canvas);

        this.world = new WorldManager(this.baseWidth, this.baseHeight);
        this.upgradeManager = new UpgradeManager();
        this.comboManager = new ComboManager();

        this.state = STATES.TITLE;
        this.lastTime = performance.now();

        this.initResizeObserver();
        this.resetGame();

        requestAnimationFrame(t => this.loop(t));

        window.addEventListener('visibilitychange', () => {
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

    initResizeObserver() {
        const container = document.getElementById('game-container');
        const resize = () => {
            const aspect = this.baseWidth / this.baseHeight;
            let w = container.clientWidth;
            let h = container.clientHeight;
            if (w / h > aspect) {
                w = h * aspect;
            } else {
                h = w / aspect;
            }
            this.canvas.width = this.baseWidth;
            this.canvas.height = this.baseHeight;
            this.canvas.style.width = Math.floor(w) + 'px';
            this.canvas.style.height = Math.floor(h) + 'px';
        };
        const ro = new ResizeObserver(resize);
        ro.observe(container);
        resize();
    }

    resetGame() {
        this.player = new Player(400, 500);
        this.guards = [
            new StandardGuard(200, 200, [{x: 200, y: 200}, {x: 600, y: 200}, {x: 600, y: 400}, {x: 200, y: 400}]),
            new Sniper(400, 200, Math.PI/2),
            new Bruiser(600, 100, [{x: 600, y: 100}, {x: 600, y: 500}, {x: 400, y: 500}, {x: 400, y: 100}]),
            new Spawner(400, 400),
            new Swarmer(500, 300)
        ];
        this.treasures = [];
        this.score = 0;
        this.arenaRadius = 380;
        this.arenaShrinkRate = 5;
        this.bossMode = false;
        this.currentBoss = null;
        this.bossMilestone = 50;
        this.bossCount = 0;
        this.treasureBasePoints = 10;
        this.comboManager.reset();
        this.world.reset();
        this.spawnTreasure();
        this.spawnTreasure();
        this.spawnTreasure();
    }

    spawnBoss() {
        this.bossMode = true;
        this.sound.playAlert();
        this.guards = [];
        if (this.bossCount % 2 === 0) {
            this.currentBoss = new OrigamiDragon(this.baseWidth/2, 100);
        } else {
            this.currentBoss = new ShiftingShogun(this.baseWidth/2, 100);
        }
        this.bossCount++;
    }

    spawnTreasure() {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (this.arenaRadius - 40);
        const x = this.baseWidth/2 + Math.cos(a) * r;
        const y = this.baseHeight/2 + Math.sin(a) * r;
        this.treasures.push(new Treasure(x, y));
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.draw();

        this.input.update();
        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (this.state === STATES.TITLE) {
            if (this.input.mouse.justDown || this.input.isDown('Space') || this.input.isDown('Enter')) {
                this.sound.playClick();
                this.resetGame();
                this.state = STATES.PLAYING;
            }
        } else if (this.state === STATES.PLAYING) {
            this.world.update(dt, this);

            if (this.input.isDown('Escape') || this.input.isDown('KeyP')) {
                this.sound.playClick();
                this.state = STATES.PAUSED;
                this.input.keys['Escape'] = false;
                this.input.keys['KeyP'] = false;
            }

            this.player.update(dt, this.input);

            // Constrain player to arena
            const dx = this.player.x - this.baseWidth/2;
            const dy = this.player.y - this.baseHeight/2;
            const dist = Math.hypot(dx, dy);
            if (dist + this.player.radius > this.arenaRadius) {
                const angle = Math.atan2(dy, dx);
                this.player.x = this.baseWidth/2 + Math.cos(angle) * (this.arenaRadius - this.player.radius);
                this.player.y = this.baseHeight/2 + Math.sin(angle) * (this.arenaRadius - this.player.radius);
                // Kill outward velocity when hitting wall
                const nx = Math.cos(angle);
                const ny = Math.sin(angle);
                const dot = this.player.vx * nx + this.player.vy * ny;
                if (dot > 0) {
                    this.player.vx -= dot * nx;
                    this.player.vy -= dot * ny;
                }
            }

            if (!this.bossMode && this.score >= this.bossMilestone) {
                this.bossMilestone += 50;
                this.spawnBoss();
            }

            // Shrink arena
            this.arenaRadius -= this.arenaShrinkRate * dt;
            if (this.arenaRadius < 50) this.arenaRadius = 50;

            if (this.bossMode && this.currentBoss) {
                this.currentBoss.update(dt, this.player, this);
                if (this.currentBoss.hp <= 0) {
                    this.bossMode = false;
                    this.currentBoss = null;
                    this.score += Math.floor(20 * this.comboManager.combo);
                    this.arenaRadius = 380;
                    this.sound.playPickup();

                    this.upgradeManager.generateChoices();
                    this.state = STATES.UPGRADE_DRAFT;

                    this.guards = [
                        new StandardGuard(200, 200, [{x: 200, y: 200}, {x: 600, y: 200}, {x: 600, y: 400}, {x: 200, y: 400}]),
                        new Spawner(400, 400)
                    ];
                }
            } else {
                this.guards.forEach(g => {
                    g.update(dt, this.player, this);
                    if ((g.canSee(this.player) || (g instanceof Sniper && g.alerted)) && this.player.invulnerableTimer <= 0) {
                        g.alerted = true;
                        this.sound.playAlert();
                        this.gameOver();
                    } else if (!(g instanceof Sniper)) {
                        g.alerted = false;
                    }
                });
            }

            this.treasures.forEach(t => {
                if (!t.active) return;
                t.update(dt);
                const tdx = this.player.x - t.x;
                const tdy = this.player.y - t.y;
                if (Math.hypot(tdx, tdy) < this.player.radius + t.radius) {
                    t.active = false;
                    this.sound.playPickup();
                    if (this.bossMode && this.currentBoss) {
                        if (this.currentBoss.active) this.currentBoss.takeDamage(1);
                    } else {
                        this.comboManager.addCombo(1.0);
                        this.score += Math.floor(this.treasureBasePoints * this.comboManager.combo);
                        this.arenaRadius = Math.min(380, this.arenaRadius + 20); // Reward: expand arena
                    }
                    if (Math.random() < 0.3) {
                        this.comboManager.spawnToken(this.baseWidth/2 + (Math.random()-0.5)*200, this.baseHeight/2 + (Math.random()-0.5)*200);
                    }
                    this.spawnTreasure();
                }
            });
            this.treasures = this.treasures.filter(t => t.active);

        } else if (this.state === STATES.PAUSED) {
            if (this.input.isDown('Escape') || this.input.isDown('KeyP') || this.input.mouse.justDown) {
                this.sound.playClick();
                this.state = STATES.PLAYING;
                this.input.keys['Escape'] = false;
                this.input.keys['KeyP'] = false;
            }
        } else if (this.state === STATES.UPGRADE_DRAFT) {
            if (this.input.isDown('Digit1')) {
                this.upgradeManager.applyUpgrade(0, this);
                this.state = STATES.PLAYING;
                this.sound.playClick();
                this.input.keys['Digit1'] = false;
            } else if (this.input.isDown('Digit2')) {
                this.upgradeManager.applyUpgrade(1, this);
                this.state = STATES.PLAYING;
                this.sound.playClick();
                this.input.keys['Digit2'] = false;
            } else if (this.input.isDown('Digit3')) {
                this.upgradeManager.applyUpgrade(2, this);
                this.state = STATES.PLAYING;
                this.sound.playClick();
                this.input.keys['Digit3'] = false;
            }
        } else if (this.state === STATES.GAME_OVER) {
            if (this.input.mouse.justDown || this.input.isDown('Space') || this.input.isDown('Enter')) {
                this.sound.playClick();
                this.state = STATES.TITLE;
            }
        }

        if (this.state === STATES.PLAYING) {
            this.comboManager.update(dt, this);
        }
    }

    gameOver() {
        this.state = STATES.GAME_OVER;
        this.saveManager.updateScore(this.score);
        this.sound.playGameOver();
    }

    draw() {
        this.ctx.fillStyle = '#2b2b2b';
        this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

        this.world.drawBackground(this.ctx);

        if (this.state === STATES.PLAYING || this.state === STATES.PAUSED || this.state === STATES.GAME_OVER) {
            // Draw Arena (Paper cutout hole)
            this.ctx.save();
            this.ctx.fillStyle = '#d3cbb8'; // Paper color
            this.ctx.beginPath();
            this.ctx.arc(this.baseWidth/2, this.baseHeight/2, this.arenaRadius, 0, Math.PI*2);
            this.ctx.fill();

            // Arena border
            this.ctx.strokeStyle = '#8a7d65';
            this.ctx.lineWidth = 4;
            this.ctx.stroke();

            // Grid lines to look like cutting mat or folded paper
            this.ctx.globalAlpha = 0.1;
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            for(let i=0; i<this.baseWidth; i+=40) {
                this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.baseHeight); this.ctx.stroke();
            }
            for(let i=0; i<this.baseHeight; i+=40) {
                this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(this.baseWidth, i); this.ctx.stroke();
            }
            this.ctx.globalAlpha = 1.0;

            // Clip to arena
            this.ctx.beginPath();
            this.ctx.arc(this.baseWidth/2, this.baseHeight/2, this.arenaRadius, 0, Math.PI*2);
            this.ctx.clip();

            this.world.drawHazards(this.ctx);

            this.treasures.forEach(t => t.draw(this.ctx));
            if (this.bossMode && this.currentBoss) {
                this.currentBoss.draw(this.ctx);
            } else {
                this.guards.forEach(g => g.draw(this.ctx));
            }
            this.player.draw(this.ctx);

            this.ctx.restore();

            // UI
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Score: ' + this.score, 20, 40);

            this.comboManager.draw(this.ctx, this.baseWidth, this.baseHeight);

            if (this.bossMode && this.currentBoss) {
                if (this.currentBoss.warningTimer > 0) {
                    this.ctx.fillStyle = 'rgba(255, 0, 0, ' + (Math.sin(Date.now()/100)*0.5+0.5) + ')';
                    this.ctx.fillRect(0, this.baseHeight/2 - 40, this.baseWidth, 80);
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '36px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(`WARNING: ${this.currentBoss.name} APPROACHING!`, this.baseWidth/2, this.baseHeight/2 + 10);
                } else {
                    this.ctx.fillStyle = '#333';
                    this.ctx.fillRect(this.baseWidth/2 - 200, 20, 400, 20);
                    this.ctx.fillStyle = '#f00';
                    this.ctx.fillRect(this.baseWidth/2 - 200, 20, 400 * (this.currentBoss.displayHp / this.currentBoss.maxHp), 20);
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.strokeRect(this.baseWidth/2 - 200, 20, 400, 20);
                    this.ctx.fillStyle = '#fff';
                    this.ctx.font = '16px sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText(`${this.currentBoss.name} - Phase ${this.currentBoss.phase}`, this.baseWidth/2, 35);
                }
            }

            // Dash Cooldown UI
            const cdRatio = Math.max(0, this.player.dashCooldown / this.player.dashCooldownMax);
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(20, 60, 100, 10);
            this.ctx.fillStyle = cdRatio === 0 ? '#4caf50' : '#f44336';
            this.ctx.fillRect(20, 60, 100 * (1 - cdRatio), 10);
            this.ctx.strokeStyle = '#fff';
            this.ctx.strokeRect(20, 60, 100, 10);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px sans-serif';
            this.ctx.fillText('DASH (SHIFT/CLICK)', 20, 85);
        }

        if (this.state === STATES.TITLE) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);

            this.ctx.fillStyle = '#cc846d';
            this.ctx.font = '64px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Origami Heist Shift', this.baseWidth/2, 200);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Steal treasures. Avoid sight cones.', this.baseWidth/2, 280);
            this.ctx.fillText('The arena shrinks over time!', this.baseWidth/2, 320);
            this.ctx.fillText('Click or Press SPACE to Start', this.baseWidth/2, 400);

            this.ctx.font = '20px sans-serif';
            this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.baseWidth/2, 450);

            this.ctx.fillStyle = '#aaa';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.baseWidth/2, 550);
        } else if (this.state === STATES.PAUSED) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.baseWidth/2, 300);
            this.ctx.font = '20px sans-serif';
            this.ctx.fillStyle = '#aaa';
            this.ctx.fillText('Back to Arcade (../../index.html)', this.baseWidth/2, 550);
        } else if (this.state === STATES.GAME_OVER) {
            this.ctx.fillStyle = 'rgba(0,0,0,0.7)';
            this.ctx.fillRect(0, 0, this.baseWidth, this.baseHeight);
            this.ctx.fillStyle = '#ff4444';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('CAUGHT!', this.baseWidth/2, 250);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '32px sans-serif';
            this.ctx.fillText(`Score: ${this.score}`, this.baseWidth/2, 320);
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Click or Press SPACE to Restart', this.baseWidth/2, 400);
        } else if (this.state === STATES.UPGRADE_DRAFT) {
            this.upgradeManager.draw(this.ctx, this.baseWidth, this.baseHeight);
        }
    }
}

window.onload = () => {
    window.game = new Game();
};
