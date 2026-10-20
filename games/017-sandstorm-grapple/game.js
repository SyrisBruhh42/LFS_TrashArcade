class GrapplePoint {
    constructor(x, y, isNorth) {
        this.x = x;
        this.y = y;
        this.isNorth = isNorth;
        this.radius = 15;
        this.pulse = 0;
    }

    update(dt) {
        this.pulse += dt * 5;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const color = this.isNorth ? '#00ffff' : '#ff0055';

        ctx.shadowBlur = 15 + Math.sin(this.pulse) * 5;
        ctx.shadowColor = color;

        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner detail
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, vx, vy, life, color, size) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.color = color;
        this.size = size;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        const alpha = Math.max(0, this.life / this.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 20;

        // North = true (Blue), South = false (Red)
        this.isNorth = true;

        this.grappleTarget = null;
        this.grappleLength = 0;
        this.grappleState = 'idle'; // idle, shooting, attached
        this.grappleX = 0;
        this.grappleY = 0;

        this.maxSpeed = 1500;
        this.gravity = 900;
        this.friction = 0.99; // Air friction

        this.particles = [];
        this.health = 100;
        this.score = 0;
        this.combo = 0;
        this.comboTimer = 0;

        this.alive = true;
    }

    togglePolarity(soundEngine) {
        if (!this.alive) return;
        this.isNorth = !this.isNorth;
        if (soundEngine) soundEngine.sfxPolaritySwitch(this.isNorth);
        this.spawnParticles(this.isNorth ? '#00ffff' : '#ff0055', 10);
    }

    startGrapple(tx, ty, points, soundEngine) {
        if (!this.alive) return;
        if (this.grappleState !== 'idle') {
            this.endGrapple(); // Retract and shoot again
        }

        // Find closest point within range
        let closest = null;
        let minDist = Infinity;
        const maxRange = 800; // Logical pixels

        for (let p of points) {
            const dx = p.x - tx;
            const dy = p.y - ty;
            const distToClick = Math.sqrt(dx*dx + dy*dy);

            // Only auto-aim to points near the click
            if (distToClick < 200) {
                const pdx = p.x - this.x;
                const pdy = p.y - this.y;
                const distToPlayer = Math.sqrt(pdx*pdx + pdy*pdy);
                if (distToPlayer < maxRange && distToPlayer < minDist) {
                    minDist = distToPlayer;
                    closest = p;
                }
            }
        }

        if (closest) {
            this.grappleState = 'shooting';
            this.grappleTarget = closest;
            this.grappleX = this.x;
            this.grappleY = this.y;
            if (soundEngine) soundEngine.sfxGrappleShoot();
        }
    }

    endGrapple() {
        this.grappleState = 'idle';
        this.grappleTarget = null;
    }

    spawnParticles(color, count) {
        for (let i = 0; i < count; i++) {
            const vx = (Math.random() - 0.5) * 200;
            const vy = (Math.random() - 0.5) * 200;
            this.particles.push(new Particle(this.x, this.y, vx, vy, 0.5 + Math.random()*0.5, color, 2 + Math.random()*3));
        }
    }

    update(dt, inputAxisX, points, soundEngine) {
        if (!this.alive) {
            // Death physics
            this.vy += this.gravity * dt;
            this.y += this.vy * dt;
            this.x += this.vx * dt;
            return;
        }

        // Apply gravity
        this.vy += this.gravity * dt;

        // Air control (weak)
        if (this.grappleState === 'idle') {
            this.vx += inputAxisX * 400 * dt;
        }

        // Grapple logic
        if (this.grappleState === 'shooting') {
            // Move grapple head towards target
            const dx = this.grappleTarget.x - this.grappleX;
            const dy = this.grappleTarget.y - this.grappleY;
            const dist = Math.sqrt(dx*dx + dy*dy);

            const speed = 3000 * dt;
            if (dist <= speed) {
                this.grappleState = 'attached';
                this.grappleX = this.grappleTarget.x;
                this.grappleY = this.grappleTarget.y;
                this.grappleLength = Math.sqrt(Math.pow(this.x - this.grappleX, 2) + Math.pow(this.y - this.grappleY, 2));
                if (soundEngine) soundEngine.sfxGrappleHit();
            } else {
                this.grappleX += (dx / dist) * speed;
                this.grappleY += (dy / dist) * speed;
            }
        }

        if (this.grappleState === 'attached') {
            this.grappleX = this.grappleTarget.x;
            this.grappleY = this.grappleTarget.y;

            const dx = this.grappleX - this.x;
            const dy = this.grappleY - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            // Magnetism mechanics
            const isTargetNorth = this.grappleTarget.isNorth;
            const isAttracting = this.isNorth !== isTargetNorth; // Opposites attract

            const forceMag = 1500;

            if (isAttracting) {
                // Pull towards point
                this.vx += (dx / dist) * forceMag * dt;
                this.vy += (dy / dist) * forceMag * dt;

                // Elastic rope constraint
                if (dist > this.grappleLength) {
                    const restoreForce = (dist - this.grappleLength) * 5;
                    this.vx += (dx / dist) * restoreForce * dt;
                    this.vy += (dy / dist) * restoreForce * dt;
                }
            } else {
                // Repel away from point
                this.vx -= (dx / dist) * forceMag * dt;
                this.vy -= (dy / dist) * forceMag * dt;
                // Rope breaks if pushed too far
                if (dist > 1000) {
                    this.endGrapple();
                }
            }

            // Swinging air control
            const perpX = -dy / dist;
            const perpY = dx / dist;
            this.vx += perpX * inputAxisX * 1000 * dt; // Stronger control while grappling
        }

        // Apply friction
        this.vx *= Math.pow(this.friction, dt * 60);
        this.vy *= Math.pow(this.friction, dt * 60);

        // Speed limit
        const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }

        // Move
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        // Draw grapple
        if (this.grappleState !== 'idle') {
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.grappleX, this.grappleY);

            if (this.grappleState === 'attached') {
                const isAttracting = this.isNorth !== this.grappleTarget.isNorth;
                ctx.strokeStyle = isAttracting ? '#fff' : '#ff0055';
                ctx.lineWidth = isAttracting ? 4 : 2;
                if (!isAttracting) {
                    ctx.setLineDash([10, 10]); // Dashed line for repelling
                }
            } else {
                ctx.strokeStyle = '#aaa';
                ctx.lineWidth = 2;
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Grapple head
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.grappleX, this.grappleY, 5, 0, Math.PI*2);
            ctx.fill();
        }

        // Draw Player
        ctx.save();
        ctx.translate(this.x, this.y);

        // Glow based on polarity
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.isNorth ? '#00ffff' : '#ff0055';

        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI*2);
        ctx.fill();

        ctx.strokeStyle = this.isNorth ? '#00ffff' : '#ff0055';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Polarity symbol
        ctx.fillStyle = ctx.strokeStyle;
        ctx.font = "20px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowBlur = 0;
        ctx.fillText(this.isNorth ? "N" : "S", 0, 2);

        ctx.restore();

        // Particles
        for (let p of this.particles) p.draw(ctx);
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.saveManager = new SaveManager();
        this.soundEngine = new SoundEngine(this.saveManager);
        this.inputManager = new InputManager(this.canvas, document.getElementById('game-container'));

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;
        this.animFrameId = null;

        this.camera = { x: 0, y: 0, shake: 0 };
        this.player = null;
        this.grapplePoints = [];
        this.scoreTokens = [];

        this.levelY = 0;
        this.difficulty = 1;
        this.scoreAccumulator = 0;

        this.sandParticles = [];
        this.initSandstorm();

        this.bindEvents();
    }

    init() {
        this.updateUI();
        this.inputManager.onAnyInput = () => {
            if (this.state === 'TITLE' || this.state === 'PLAYING') {
                this.soundEngine.init();
            }
        };
        requestAnimationFrame((t) => this.loop(t));
    }

    initSandstorm() {
        for (let i = 0; i < 100; i++) {
            this.sandParticles.push({
                x: Math.random() * this.inputManager.logicWidth,
                y: Math.random() * this.inputManager.logicHeight,
                vx: -200 - Math.random() * 300,
                vy: (Math.random() - 0.5) * 50,
                size: Math.random() * 3 + 1,
                alpha: Math.random() * 0.5 + 0.1
            });
        }
    }

    bindEvents() {
        // State transitions
        document.getElementById('btn-play').addEventListener('click', () => this.startGame());
        document.getElementById('btn-play-again').addEventListener('click', () => this.startGame());

        document.getElementById('btn-pause').addEventListener('click', () => this.pauseGame());
        document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
        document.getElementById('btn-restart').addEventListener('click', () => this.startGame());

        document.getElementById('btn-quit').addEventListener('click', () => {
            this.state = 'TITLE';
            this.updateUI();
        });
        document.getElementById('btn-go-title').addEventListener('click', () => {
            this.state = 'TITLE';
            this.updateUI();
        });

        // Menus
        document.getElementById('btn-howto').addEventListener('click', () => this.showScreen('screen-howto'));
        document.getElementById('btn-howto-back').addEventListener('click', () => this.showScreen('screen-title'));

        document.getElementById('btn-options-title').addEventListener('click', () => this.showScreen('screen-options'));
        document.getElementById('btn-options-pause').addEventListener('click', () => this.showScreen('screen-options'));
        document.getElementById('btn-options-back').addEventListener('click', () => {
            this.showScreen(this.state === 'TITLE' ? 'screen-title' : 'screen-paused');
        });

        // Options
        const updateOpt = (id, key) => {
            const val = document.getElementById(id).value;
            document.getElementById(id.replace('opt-', 'opt-val-')).innerText = val + '%';
            this.saveManager.data.options[key] = parseInt(val);
            this.saveManager.save();
            this.soundEngine.updateVolumes();
        };
        document.getElementById('opt-master').addEventListener('input', () => updateOpt('opt-master', 'masterVolume'));
        document.getElementById('opt-sfx').addEventListener('input', () => updateOpt('opt-sfx', 'sfxVolume'));
        document.getElementById('opt-music').addEventListener('input', () => updateOpt('opt-music', 'musicVolume'));

        document.getElementById('btn-export-save').addEventListener('click', () => {
            navigator.clipboard.writeText(this.saveManager.exportBase64()).then(() => alert("Save copied to clipboard!"));
        });
        document.getElementById('btn-import-save').addEventListener('click', () => {
            const str = prompt("Paste save string:");
            if (str && this.saveManager.importBase64(str)) {
                alert("Save imported successfully!");
                this.loadOptionsToUI();
            } else if (str) {
                alert("Invalid save string.");
            }
        });
        let resetConfirm = false;
        document.getElementById('btn-reset-save').addEventListener('click', (e) => {
            if (!resetConfirm) {
                resetConfirm = true;
                e.target.innerText = "Click again to confirm reset";
                setTimeout(() => { resetConfirm = false; e.target.innerText = "Reset Save"; }, 3000);
            } else {
                this.saveManager.reset();
                this.loadOptionsToUI();
                e.target.innerText = "Reset Save";
                resetConfirm = false;
                alert("Save reset.");
            }
        });

        this.loadOptionsToUI();

        // Input manager bindings
        this.inputManager.onGrappleStart = (tx, ty) => {
            if (this.state === 'PLAYING') {
                // translate screen click to world coordinates
                const worldX = tx + this.camera.x;
                const worldY = ty + this.camera.y;
                this.player.startGrapple(worldX, worldY, this.grapplePoints, this.soundEngine);
            }
        };
        this.inputManager.onGrappleEnd = () => {
            if (this.state === 'PLAYING') this.player.endGrapple();
        };
        this.inputManager.onPolarityToggle = () => {
            if (this.state === 'PLAYING') this.player.togglePolarity(this.soundEngine);
        };
        this.inputManager.onJump = () => {
            if (this.state === 'PLAYING') {
                // If attached, break grapple and jump
                if (this.player.grappleState === 'attached') {
                    this.player.endGrapple();
                    this.player.vy = -600; // Jump boost
                    this.soundEngine.sfxJump();
                } else if (this.state === 'GAME_OVER') {
                    this.startGame();
                }
            } else if (this.state === 'TITLE' || this.state === 'GAME_OVER') {
                this.startGame();
            }
        };
        this.inputManager.onPause = () => {
            if (this.state === 'PLAYING') this.pauseGame();
            else if (this.state === 'PAUSED') this.resumeGame();
        };

        // Window blur
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.pauseGame();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.pauseGame();
        });
    }

    loadOptionsToUI() {
        const opts = this.saveManager.data.options;
        document.getElementById('opt-master').value = opts.masterVolume;
        document.getElementById('opt-val-master').innerText = opts.masterVolume + '%';
        document.getElementById('opt-sfx').value = opts.sfxVolume;
        document.getElementById('opt-val-sfx').innerText = opts.sfxVolume + '%';
        document.getElementById('opt-music').value = opts.musicVolume;
        document.getElementById('opt-val-music').innerText = opts.musicVolume + '%';

        document.getElementById('title-high-score').innerText = `High Score: ${this.saveManager.data.highScore}`;
        document.getElementById('title-stats').innerText = `Games: ${this.saveManager.data.totalGamesPlayed} | Total Score: ${this.saveManager.data.totalScoreAccumulated}`;
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        this.soundEngine.sfxUI();
    }

    updateUI() {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        if (this.state === 'TITLE') {
            this.loadOptionsToUI();
            document.getElementById('screen-title').classList.add('active');
            this.soundEngine.stopMusic();
        } else if (this.state === 'PLAYING') {
            document.getElementById('ui-playing').classList.add('active');
            this.soundEngine.startMusic();
        } else if (this.state === 'PAUSED') {
            document.getElementById('ui-playing').classList.add('active');
            document.getElementById('screen-paused').classList.add('active');
            this.soundEngine.stopMusic();
        } else if (this.state === 'GAME_OVER') {
            document.getElementById('screen-gameover').classList.add('active');
            this.soundEngine.stopMusic();
        }
    }

    startGame() {
        this.soundEngine.init();
        this.soundEngine.sfxUI();
        this.state = 'PLAYING';

        this.player = new Player(this.inputManager.logicWidth / 2, this.inputManager.logicHeight - 200);
        this.camera = { x: 0, y: 0, shake: 0 };
        this.grapplePoints = [];
        this.scoreTokens = [];
        this.levelY = this.inputManager.logicHeight;
        this.difficulty = 1;
        this.scoreAccumulator = 0;

        // Initial ground points
        this.generateLevelChunk(this.inputManager.logicHeight - 600, this.inputManager.logicHeight);

        this.updateHUD();
        this.updateUI();
    }

    pauseGame() {
        this.state = 'PAUSED';
        this.updateUI();
    }

    resumeGame() {
        this.state = 'PLAYING';
        this.updateUI();
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.soundEngine.sfxGameOver();

        const isNewHigh = this.saveManager.updateScore(this.player.score, this.player.combo);

        document.getElementById('go-score').innerText = this.player.score;
        document.getElementById('go-combo').innerText = 'x' + this.player.combo;
        document.getElementById('go-new-high').style.display = isNewHigh ? 'block' : 'none';

        const msDiv = document.getElementById('go-milestones');
        msDiv.innerHTML = '';
        if (this.saveManager.data.unlockedMilestones.length > 0) {
            msDiv.innerHTML = 'Milestones:<br>' + this.saveManager.data.unlockedMilestones.join('<br>');
        }

        this.updateUI();
    }

    generateLevelChunk(startY, endY) {
        // Generate points moving upwards
        const w = this.inputManager.logicWidth;
        let y = endY;
        while (y > startY) {
            const x = w * 0.1 + Math.random() * (w * 0.8);
            const isNorth = Math.random() > 0.5;
            this.grapplePoints.push(new GrapplePoint(x, y, isNorth));

            // Add score tokens
            if (Math.random() > 0.5) {
                this.scoreTokens.push({
                    x: x + (Math.random() - 0.5) * 300,
                    y: y + (Math.random() - 0.5) * 200,
                    radius: 10,
                    collected: false,
                    pulse: 0
                });
            }

            y -= 300 + Math.random() * 200 * (1 / this.difficulty);
        }
        this.levelY = startY;
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        const ax = this.inputManager.getAxisX();
        this.player.update(dt, ax, this.grapplePoints, this.soundEngine);

        // Screen shake
        if (this.camera.shake > 0) {
            this.camera.shake -= dt * 50;
            if (this.camera.shake < 0) this.camera.shake = 0;
        }

        // Camera follow (mostly vertical)
        const targetCamY = this.player.y - this.inputManager.logicHeight * 0.6;
        this.camera.y += (targetCamY - this.camera.y) * 5 * dt;

        // Prevent camera from going below starting ground
        if (this.camera.y > 0) this.camera.y = 0;

        // Horizontal camera slightly follows player
        const targetCamX = this.player.x - this.inputManager.logicWidth / 2;
        this.camera.x += (targetCamX - this.camera.x) * 2 * dt;

        // Clamp horizontal camera
        if (this.camera.x < -200) this.camera.x = -200;
        if (this.camera.x > 200) this.camera.x = 200;

        // Generate new level chunks as we go up
        if (this.camera.y < this.levelY + this.inputManager.logicHeight * 2) {
            this.generateLevelChunk(this.levelY - this.inputManager.logicHeight, this.levelY);
            this.difficulty += 0.1;
        }

        // Remove old points
        this.grapplePoints = this.grapplePoints.filter(p => p.y < this.camera.y + this.inputManager.logicHeight + 500);
        this.scoreTokens = this.scoreTokens.filter(t => !t.collected && t.y < this.camera.y + this.inputManager.logicHeight + 500);

        // Update entities
        for (let p of this.grapplePoints) p.update(dt);
        for (let t of this.scoreTokens) t.pulse += dt * 5;

        // Collect tokens
        for (let t of this.scoreTokens) {
            const dx = t.x - this.player.x;
            const dy = t.y - this.player.y;
            if (dx*dx + dy*dy < Math.pow(this.player.radius + t.radius, 2)) {
                t.collected = true;
                this.player.score += 100 * (1 + this.player.combo);
                this.player.combo++;
                this.player.comboTimer = 3.0; // 3 seconds to keep combo
                this.soundEngine.sfxCoin();
                this.updateHUD();

                // Juice
                this.camera.shake = 5;
                this.player.spawnParticles('#ffff00', 5);
            }
        }

        // Height score
        if (-this.player.y > this.scoreAccumulator) {
            const diff = -this.player.y - this.scoreAccumulator;
            this.scoreAccumulator = -this.player.y;
            this.player.score += Math.floor(diff * 0.1) * (1 + this.player.combo);
            this.updateHUD();
        }

        // Death condition (falling off screen)
        if (this.player.y > this.camera.y + this.inputManager.logicHeight + 100 && this.player.alive) {
            this.player.alive = false;
            this.soundEngine.sfxHurt();
            this.camera.shake = 20;
            setTimeout(() => this.gameOver(), 1000);
        }

        // Update sandstorm
        for (let s of this.sandParticles) {
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.x < -100) {
                s.x = this.inputManager.logicWidth + 100;
                s.y = Math.random() * this.inputManager.logicHeight;
            }
        }
    }

    updateHUD() {
        document.getElementById('hud-score').innerText = this.player.score;
        document.getElementById('hud-mult').innerText = 'x' + (1 + this.player.combo);
        if (this.player.combo > 0) {
            document.getElementById('hud-mult').style.color = '#ffff00';
            document.getElementById('hud-mult').style.transform = 'scale(1.5)';
            setTimeout(() => document.getElementById('hud-mult').style.transform = 'scale(1)', 100);
        } else {
            document.getElementById('hud-mult').style.color = '#fff';
        }
    }

    draw() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // Scale to logical resolution
        this.ctx.scale(this.inputManager.scaleX, this.inputManager.scaleY);

        // Center letterboxed area
        const drawWidth = this.inputManager.logicWidth * this.inputManager.scaleX;
        const drawHeight = this.inputManager.logicHeight * this.inputManager.scaleY;
        const offsetX = (this.canvas.width - drawWidth) / 2 / this.inputManager.scaleX;
        const offsetY = (this.canvas.height - drawHeight) / 2 / this.inputManager.scaleY;
        this.ctx.translate(offsetX, offsetY);

        // Background gradient based on depth
        const depth = Math.max(0, -this.camera.y / 10000);
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.inputManager.logicHeight);
        gradient.addColorStop(0, `rgb(${30 - depth*30}, ${15 - depth*15}, ${5 - depth*5})`);
        gradient.addColorStop(1, `rgb(${60 - depth*60}, ${30 - depth*30}, ${10 - depth*10})`);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.inputManager.logicWidth, this.inputManager.logicHeight);

        // Draw Bazaar silhouettes in background (parallax)
        this.ctx.fillStyle = '#1a0b04';
        const bgOffset = (this.camera.y * 0.2) % 200;
        for(let i=0; i<15; i++) {
            const h = 100 + Math.sin(i*7)*50;
            const y = this.inputManager.logicHeight - bgOffset - (i*150);
            this.ctx.beginPath();
            this.ctx.moveTo(i*200, y);
            this.ctx.lineTo(i*200 + 100, y - h);
            this.ctx.lineTo(i*200 + 200, y);
            this.ctx.fill();
        }

        // Camera transform for game world
        this.ctx.save();
        let sx = 0;
        let sy = 0;
        if (this.camera.shake > 0) {
            sx = (Math.random() - 0.5) * this.camera.shake;
            sy = (Math.random() - 0.5) * this.camera.shake;
        }
        this.ctx.translate(-this.camera.x + sx, -this.camera.y + sy);

        // Draw Tokens
        for (let t of this.scoreTokens) {
            if (t.collected) continue;
            this.ctx.fillStyle = '#ffff00';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(t.x, t.y, t.radius + Math.sin(t.pulse)*2, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }

        // Draw Grapple Points
        for (let p of this.grapplePoints) {
            p.draw(this.ctx);
        }

        // Draw Player
        if (this.player) {
            this.player.draw(this.ctx);
        }

        // Ground line
        this.ctx.strokeStyle = '#5be95e';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.moveTo(-1000, this.inputManager.logicHeight);
        this.ctx.lineTo(this.inputManager.logicWidth + 1000, this.inputManager.logicHeight);
        this.ctx.stroke();

        this.ctx.restore(); // End camera transform

        // Sandstorm Foreground overlay
        this.ctx.fillStyle = '#e8c396';
        for (let s of this.sandParticles) {
            this.ctx.globalAlpha = s.alpha;
            this.ctx.beginPath();
            this.ctx.arc(s.x, s.y, s.size, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;

        // Draw touch controls if active
        if (this.state === 'PLAYING' && this.inputManager.isMobile) {
            this.drawTouchControls();
        }

        this.ctx.restore(); // End logical scale
    }

    drawTouchControls() {
        this.ctx.lineWidth = 2;

        // Joystick
        if (this.inputManager.joystick.active) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';

            // Base
            this.ctx.beginPath();
            this.ctx.arc(this.inputManager.joystick.origin.x, this.inputManager.joystick.origin.y, 100, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.stroke();

            // Stick
            this.ctx.beginPath();
            this.ctx.arc(this.inputManager.joystick.origin.x + this.inputManager.joystick.delta.x,
                         this.inputManager.joystick.origin.y + this.inputManager.joystick.delta.y, 40, 0, Math.PI*2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.fill();
        }

        // Action Area Hint (Right side)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.fillRect(this.inputManager.logicWidth/2, 0, this.inputManager.logicWidth/2, this.inputManager.logicHeight);

        // Polarity Toggle Hint
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(this.inputManager.logicWidth * 0.9, this.inputManager.logicHeight * 0.85, 80, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.fillStyle = '#fff';
        this.ctx.font = "30px 'Courier New', monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("POLARITY", this.inputManager.logicWidth * 0.9, this.inputManager.logicHeight * 0.85);

        if (this.player) {
            this.ctx.fillStyle = this.player.isNorth ? '#00ffff' : '#ff0055';
            this.ctx.fillText(this.player.isNorth ? "N" : "S", this.inputManager.logicWidth * 0.9, this.inputManager.logicHeight * 0.85 + 40);
        }
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap dt to prevent physics explosions on lag
        if (dt > 0.1) dt = 0.1;

        this.update(dt);
        this.draw();

        this.animFrameId = requestAnimationFrame((t) => this.loop(t));
    }
}
