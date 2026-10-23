
const SAVE_KEY = 'arcade_game_077_077-origami-heist-shift_v1';
const STATES = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAME_OVER: 3 };

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

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.speed = 150;
        this.color = '#fff';
    }
    update(dt, input) {
        const axis = input.getAxis();
        this.x += axis.x * this.speed * dt;
        this.y += axis.y * this.speed * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, this.radius);
        ctx.lineTo(-this.radius, this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Paper fold line
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(0, this.radius);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.stroke();
        ctx.restore();
    }
}

class Guard {
    constructor(x, y, path) {
        this.x = x;
        this.y = y;
        this.path = path;
        this.pathIndex = 0;
        this.speed = 60;
        this.angle = 0;
        this.radius = 14;
        this.sightRange = 150;
        this.sightAngle = Math.PI / 3;
        this.alerted = false;
        this.color = '#cc846d';
    }
    update(dt) {
        if (this.path.length === 0) return;
        const target = this.path[this.pathIndex];
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 5) {
            this.pathIndex = (this.pathIndex + 1) % this.path.length;
        } else {
            this.angle = Math.atan2(dy, dx);
            this.x += Math.cos(this.angle) * this.speed * dt;
            this.y += Math.sin(this.angle) * this.speed * dt;
        }
    }
    canSee(player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist > this.sightRange) return false;
        const angleToPlayer = Math.atan2(dy, dx);
        let angleDiff = angleToPlayer - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        return Math.abs(angleDiff) < this.sightAngle / 2;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Sight cone
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.sightRange, -this.sightAngle/2, this.sightAngle/2);
        ctx.closePath();
        ctx.fillStyle = this.alerted ? 'rgba(255, 0, 0, 0.3)' : 'rgba(255, 255, 0, 0.2)';
        ctx.fill();

        // Guard body
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius/2, this.radius/2);
        ctx.lineTo(-this.radius/2, -this.radius/2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Fold line
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius/2, 0);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
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
            new Guard(200, 200, [{x: 200, y: 200}, {x: 600, y: 200}, {x: 600, y: 400}, {x: 200, y: 400}]),
            new Guard(600, 100, [{x: 600, y: 100}, {x: 600, y: 500}, {x: 400, y: 500}, {x: 400, y: 100}])
        ];
        this.treasures = [];
        this.score = 0;
        this.arenaRadius = 380;
        this.arenaShrinkRate = 5;
        this.spawnTreasure();
        this.spawnTreasure();
        this.spawnTreasure();
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
            }

            // Shrink arena
            this.arenaRadius -= this.arenaShrinkRate * dt;
            if (this.arenaRadius < 50) this.arenaRadius = 50;

            this.guards.forEach(g => {
                g.update(dt);
                if (g.canSee(this.player)) {
                    g.alerted = true;
                    this.sound.playAlert();
                    this.gameOver();
                } else {
                    g.alerted = false;
                }
            });

            this.treasures.forEach(t => {
                if (!t.active) return;
                t.update(dt);
                const tdx = this.player.x - t.x;
                const tdy = this.player.y - t.y;
                if (Math.hypot(tdx, tdy) < this.player.radius + t.radius) {
                    t.active = false;
                    this.score += 10;
                    this.sound.playPickup();
                    this.arenaRadius = Math.min(380, this.arenaRadius + 20); // Reward: expand arena
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
        } else if (this.state === STATES.GAME_OVER) {
            if (this.input.mouse.justDown || this.input.isDown('Space') || this.input.isDown('Enter')) {
                this.sound.playClick();
                this.state = STATES.TITLE;
            }
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

            this.treasures.forEach(t => t.draw(this.ctx));
            this.guards.forEach(g => g.draw(this.ctx));
            this.player.draw(this.ctx);

            this.ctx.restore();

            // UI
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Score: ' + this.score, 20, 40);
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
        }
    }
}

window.onload = () => {
    window.game = new Game();
};
