/**
 * game.js
 * Contains the main game loop, state machine, entities, and rendering logic.
 */

// --- Game Constants ---
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;

// --- State Machine ---
const STATE = {
    TITLE: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = STATE.TITLE;
        this.lastTime = 0;

        // ResizeObserver
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(document.getElementById('game-container'));

        // Game Data
        this.score = 0;
        this.combo = 1;
        this.comboTimer = 0; // Time left before combo drops
        this.health = 3;

        this.entities = [];
        this.particles = [];

        // Screens
        this.screens = {
            title: document.getElementById('screen-title'),
            playing: document.getElementById('screen-playing'),
            htp: document.getElementById('screen-how-to-play'),
            paused: document.getElementById('screen-paused'),
            options: document.getElementById('screen-options'),
            gameOver: document.getElementById('screen-game-over')
        };

        this.bindUI();
        this.resize();
        this.updateTitleStats();

        // Setup visibility change for auto-pause
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === STATE.PLAYING) {
                this.setState(STATE.PAUSED);
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === STATE.PLAYING) {
                this.setState(STATE.PAUSED);
            }
        });

        // Start loop
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        // Calculate scale to maintain logical coordinate space
        const scaleX = this.canvas.width / LOGICAL_WIDTH;
        const scaleY = this.canvas.height / LOGICAL_HEIGHT;
        this.scale = Math.min(scaleX, scaleY);

        this.offsetX = (this.canvas.width - (LOGICAL_WIDTH * this.scale)) / 2;
        this.offsetY = (this.canvas.height - (LOGICAL_HEIGHT * this.scale)) / 2;
    }

    bindUI() {
        // Title
        document.getElementById('btn-play').addEventListener('click', () => { soundEngine.playUI(); this.startGame(); });
        document.getElementById('btn-how-to-play').addEventListener('click', () => { soundEngine.playUI(); this.showScreen(this.screens.htp); });
        document.getElementById('btn-options').addEventListener('click', () => { soundEngine.playUI(); this.showOptions(); });

        // HTP
        document.getElementById('btn-close-htp').addEventListener('click', () => {
            soundEngine.playUI();
            this.showScreen(this.state === STATE.PAUSED ? this.screens.paused : this.screens.title);
        });

        // Playing
        document.getElementById('btn-pause').addEventListener('click', () => { soundEngine.playUI(); this.setState(STATE.PAUSED); });

        // Paused
        document.getElementById('btn-resume').addEventListener('click', () => { soundEngine.playUI(); this.setState(STATE.PLAYING); });
        document.getElementById('btn-restart').addEventListener('click', () => { soundEngine.playUI(); this.startGame(); });
        document.getElementById('btn-options-pause').addEventListener('click', () => { soundEngine.playUI(); this.showOptions(); });
        document.getElementById('btn-htp-pause').addEventListener('click', () => { soundEngine.playUI(); this.showScreen(this.screens.htp); });
        document.getElementById('btn-quit').addEventListener('click', () => { soundEngine.playUI(); this.setState(STATE.TITLE); });

        // Game Over
        document.getElementById('btn-play-again').addEventListener('click', () => { soundEngine.playUI(); this.startGame(); });
        document.getElementById('btn-title-from-go').addEventListener('click', () => { soundEngine.playUI(); this.setState(STATE.TITLE); });

        // Options Bindings
        const masterVol = document.getElementById('opt-master-vol');
        const sfxVol = document.getElementById('opt-sfx-vol');
        const musicVol = document.getElementById('opt-music-vol');
        const shake = document.getElementById('opt-shake');
        const particles = document.getElementById('opt-particles');

        masterVol.value = saveManager.getOption('masterVolume');
        sfxVol.value = saveManager.getOption('sfxVolume');
        musicVol.value = saveManager.getOption('musicVolume');
        shake.value = saveManager.getOption('screenShake');
        particles.value = saveManager.getOption('particles');

        const updateOptions = () => {
            saveManager.setOption('masterVolume', parseInt(masterVol.value));
            saveManager.setOption('sfxVolume', parseInt(sfxVol.value));
            saveManager.setOption('musicVolume', parseInt(musicVol.value));
            saveManager.setOption('screenShake', parseFloat(shake.value));
            saveManager.setOption('particles', particles.value);
            soundEngine.updateVolumes();
        };

        masterVol.addEventListener('input', updateOptions);
        sfxVol.addEventListener('input', updateOptions);
        musicVol.addEventListener('input', updateOptions);
        shake.addEventListener('change', updateOptions);
        particles.addEventListener('change', updateOptions);

        document.getElementById('btn-close-options').addEventListener('click', () => {
            soundEngine.playUI();
            this.showScreen(this.state === STATE.PAUSED ? this.screens.paused : this.screens.title);
        });

        // Save Data Handling
        document.getElementById('btn-export-save').addEventListener('click', () => {
            const data = saveManager.exportSave();
            const box = document.getElementById('save-data-box');
            box.value = data;
            box.classList.remove('hidden');
            box.select();
            document.execCommand('copy');
            alert("Save data copied to clipboard!");
        });

        document.getElementById('btn-import-save').addEventListener('click', () => {
            const box = document.getElementById('save-data-box');
            box.classList.remove('hidden');
            if (box.value.length > 0) {
                if (saveManager.importSave(box.value)) {
                    alert("Save imported successfully!");
                    this.updateTitleStats();
                    box.value = "";
                    box.classList.add('hidden');
                } else {
                    alert("Invalid save data.");
                }
            } else {
                alert("Paste save data into the box and click Import again.");
            }
        });

        let resetClicks = 0;
        document.getElementById('btn-reset-save').addEventListener('click', (e) => {
            resetClicks++;
            if (resetClicks === 1) {
                e.target.innerText = "Click again to confirm reset";
                setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset Save"; }, 3000);
            } else if (resetClicks === 2) {
                saveManager.resetSave();
                this.updateTitleStats();
                alert("Save data reset.");
                e.target.innerText = "Reset Save";
                resetClicks = 0;
            }
        });
    }

    showScreen(screenToShow) {
        Object.values(this.screens).forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('active');
        });
        if (screenToShow) {
            screenToShow.classList.remove('hidden');
            // Slight delay to allow CSS transitions if needed
            setTimeout(() => screenToShow.classList.add('active'), 10);
        }
    }

    setState(newState) {
        this.state = newState;
        if (this.state === STATE.TITLE) {
            this.showScreen(this.screens.title);
            this.updateTitleStats();
            soundEngine.stopMusic();
        } else if (this.state === STATE.PLAYING) {
            this.showScreen(this.screens.playing);
            soundEngine.startMusic();
        } else if (this.state === STATE.PAUSED) {
            this.showScreen(this.screens.paused);
            soundEngine.stopMusic();
        } else if (this.state === STATE.GAME_OVER) {
            this.showScreen(this.screens.gameOver);
            soundEngine.stopMusic();
            this.handleGameOver();
        }
    }

    updateTitleStats() {
        document.getElementById('title-highscore').innerText = saveManager.getStat('highScore');
        document.getElementById('title-games-played').innerText = saveManager.getStat('totalGamesPlayed');
    }

    startGame() {
        this.score = 0;
        this.combo = 1;
        this.health = 3;
        this.entities = [];
        this.particles = [];

        saveManager.incrementGamesPlayed();
        this.setState(STATE.PLAYING);

        this.camera = { x: 0, y: 0 };
        this.screenShake = 0;

        // Initialize Player
        this.player = new Player(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
        this.entities.push(this.player);

        // Initial Island
        this.islands = [];
        this.islands.push(new Island(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 100, 300));
        this.highestIslandY = LOGICAL_HEIGHT / 2 + 100;

        this.generateWorld();
    }

    generateWorld() {
        // Generate islands upwards
        while (this.islands.length < 20) {
            this.highestIslandY -= Utils.randInt(200, 350);

            // Randomize X position near previous island
            const lastIsland = this.islands[this.islands.length - 1];
            let nx = lastIsland.x + Utils.rand(-300, 300);
            nx = Utils.clamp(nx, 200, LOGICAL_WIDTH - 200);

            let nw = Utils.randInt(100, 250);

            const island = new Island(nx, this.highestIslandY, nw);
            this.islands.push(island);

            // Spawn Enemy on island sometimes
            if (Math.random() > 0.3) {
                this.entities.push(new Enemy(nx, this.highestIslandY - 40));
            }
        }
    }

    addScreenShake(amount) {
        const factor = saveManager.getOption('screenShake');
        this.screenShake = amount * factor;
    }

    handleGameOver() {
        const isNewHigh = saveManager.updateHighscore(this.score);
        saveManager.updateCombo(this.combo);
        saveManager.addScore(this.score);

        document.getElementById('go-score').innerText = this.score;
        document.getElementById('go-combo').innerText = this.combo;

        const newHighElem = document.getElementById('go-new-high-score');
        if (isNewHigh) {
            newHighElem.classList.remove('hidden');
        } else {
            newHighElem.classList.add('hidden');
        }

        // Check milestones
        const milestones = [];
        if (saveManager.getStat('totalGamesPlayed') >= 10 && saveManager.unlockMilestone('veteran')) {
            milestones.push("Badge Unlocked: Veteran (10 Games Played)");
        }
        if (this.score >= 10000 && saveManager.unlockMilestone('high_scorer')) {
            milestones.push("Badge Unlocked: High Scorer (10,000 Points)");
        }
        if (this.combo >= 10 && saveManager.unlockMilestone('rhythm_master')) {
            milestones.push("Badge Unlocked: Rhythm Master (x10 Combo)");
        }

        const mContainer = document.getElementById('go-milestones');
        mContainer.innerHTML = '';
        milestones.forEach(m => {
            const p = document.createElement('p');
            p.innerText = m;
            p.style.color = '#e447c0';
            mContainer.appendChild(p);
        });

        soundEngine.playGameOver();
    }

    loop(timestamp) {
        let dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.state !== STATE.PLAYING) return;

        // Camera Follow
        if (this.player) {
            const targetX = this.player.x - LOGICAL_WIDTH / 2;
            const targetY = this.player.y - LOGICAL_HEIGHT / 2;
            this.camera.x += (targetX - this.camera.x) * 5 * dt;
            this.camera.y += (targetY - this.camera.y) * 5 * dt;
        }

        // Screen Shake
        if (this.screenShake > 0) {
            this.screenShake -= dt * 20;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        // Combo Logic
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 1;
            }
        }

        // Generate more world as player ascends
        if (this.player.y < this.highestIslandY + LOGICAL_HEIGHT) {
            this.generateWorld();
        }

        // Cleanup old islands below camera
        this.islands = this.islands.filter(i => i.y < this.camera.y + LOGICAL_HEIGHT + 300);

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt, this);
            if (p.dead) {
                this.particles.splice(i, 1);
            }
        }

        // Update Entities
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const e = this.entities[i];
            e.update(dt, this);
            if (e.dead) {
                this.entities.splice(i, 1);
            }
        }

        // Check Player Death (Fall off screen)
        if (this.player && this.player.y > this.camera.y + LOGICAL_HEIGHT + 200) {
            this.health--;
            soundEngine.playHit();
            if (this.health <= 0) {
                this.setState(STATE.GAME_OVER);
            } else {
                // Respawn above highest island
                this.player.vx = 0;
                this.player.vy = 0;
                let highest = this.islands[0];
                for(let isl of this.islands) {
                    if (isl.y < highest.y) highest = isl;
                }
                this.player.x = highest.x;
                this.player.y = highest.y - 200;
            }
        }

        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('hud-score-val').innerText = this.score;
        document.getElementById('hud-health-val').innerText = this.health;
        document.getElementById('hud-combo-val').innerText = this.combo;

        // Rhythm Bar update
        const bar = document.getElementById('rhythm-indicator');
        if (soundEngine.isPlayingMusic) {
            const now = soundEngine.ctx.currentTime;
            // Modulo with beatInterval to get position in current beat
            const beatPos = (now % soundEngine.beatInterval) / soundEngine.beatInterval;

            // Map 0 -> left edge, 0.5 -> center, 1 -> right edge
            const pct = beatPos * 100;
            bar.style.left = `${pct}%`;
        }
    }

    draw() {
        // Clear background
        this.ctx.fillStyle = '#111827';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();

        // Setup logical coordinate system
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Apply Camera & Shake
        let sx = 0, sy = 0;
        if (this.screenShake > 0) {
            sx = (Math.random() - 0.5) * this.screenShake;
            sy = (Math.random() - 0.5) * this.screenShake;
        }
        this.ctx.translate(-this.camera.x + sx, -this.camera.y + sy);

        // Draw Islands
        this.islands.forEach(i => i.draw(this.ctx));

        // Draw Entities
        this.entities.forEach(e => e.draw(this.ctx));

        // Draw Particles
        this.particles.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }
}

// --- Entities ---
class Entity {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 10;
        this.dead = false;
    }
    update(dt, game) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {}
}

class Player extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 15;
        this.gravity = 800;
        this.friction = 0.99;
        this.shootCooldown = 0;
        this.shootRate = 0.3;
        this.recoilForce = 600;
    }

    update(dt, game) {
        // Physics
        this.vy += this.gravity * dt;

        this.vx *= Math.pow(this.friction, dt * 60);
        this.vy *= Math.pow(this.friction, dt * 60);

        super.update(dt, game);

        // Island Collision
        for (const island of game.islands) {
            // Simple top collision
            if (this.vy > 0 &&
                this.x > island.x - island.width/2 &&
                this.x < island.x + island.width/2 &&
                this.y + this.radius > island.y - island.height/2 &&
                this.y - this.vy*dt + this.radius <= island.y - island.height/2) {

                this.y = island.y - island.height/2 - this.radius;
                this.vy = 0;

                // Reset combo timer when landed safely
                game.comboTimer = 2.0;
            }
        }

        // Shooting / Recoil Movement
        if (this.shootCooldown > 0) {
            this.shootCooldown -= dt;
        }

        if (inputManager.isShooting() && this.shootCooldown <= 0) {
            const aim = inputManager.getAimVector();

            // If no aim input, default to shooting straight down (to jump up)
            let ax = aim.x;
            let ay = aim.y;

            if (ax === 0 && ay === 0) {
                ax = 0;
                ay = 1;
            }

            // Apply recoil (push opposite to aim)
            // If on beat, apply more force
            const now = soundEngine.ctx ? soundEngine.ctx.currentTime : 0;
            const timeSinceLastBeat = now % soundEngine.beatInterval;
            const timeToNextBeat = soundEngine.beatInterval - timeSinceLastBeat;
            const onBeat = timeSinceLastBeat < 0.1 || timeToNextBeat < 0.1;

            if (onBeat) {
                game.combo++;
                game.comboTimer = 2.0;
                game.score += 10 * game.combo;
                game.entities.push(new FloatingText("Perfect!", this.x, this.y - 30, '#e447c0'));
            } else {
                game.combo = 1;
            }

            const forceMult = onBeat ? 1.5 : 1.0;

            this.vx = -ax * this.recoilForce * forceMult;
            this.vy = -ay * this.recoilForce * forceMult;

            // Visuals/Sound
            soundEngine.playShoot(onBeat);
            game.addScreenShake(onBeat ? 15 : 5);

            this.shootCooldown = this.shootRate;

            // Spawn projectile
            game.entities.push(new Projectile(this.x, this.y, ax * 1000, ay * 1000, onBeat));

            // Spawn particles
            for(let i=0; i< (saveManager.getOption('particles') === 'high' ? 10 : 3); i++) {
                game.particles.push(new Particle(this.x, this.y, -ax, -ay, onBeat ? '#e447c0' : '#fff'));
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw aim indicator
        const aim = inputManager.getAimVector();
        if (aim.x !== 0 || aim.y !== 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + aim.x * 40, this.y + aim.y * 40);
            ctx.stroke();
        }
    }
}

class Island {
    constructor(x, y, w) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = 40;
    }

    draw(ctx) {
        ctx.fillStyle = '#4B5563';
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);

        // Top grass
        ctx.fillStyle = '#10B981';
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, 10);
    }
}

class Projectile extends Entity {
    constructor(x, y, vx, vy, powerful) {
        super(x, y);
        this.vx = vx;
        this.vy = vy;
        this.radius = powerful ? 8 : 5;
        this.powerful = powerful;
        this.life = 1.0;
    }

    update(dt, game) {
        super.update(dt, game);
        this.life -= dt;
        if (this.life <= 0) this.dead = true;

        // Spawn trail
        if (saveManager.getOption('particles') === 'high' && Math.random() > 0.5) {
            game.particles.push(new Particle(this.x, this.y, 0, 0, this.powerful ? '#e447c0' : '#fff'));
        }

        // Enemy collision
        for (const e of game.entities) {
            if (e instanceof Enemy && !e.dead) {
                if (Utils.dist(this.x, this.y, e.x, e.y) < this.radius + e.radius) {
                    e.takeDamage(game);
                    this.dead = true;
                    soundEngine.playHit();
                    game.addScreenShake(this.powerful ? 10 : 3);
                    break;
                }
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.powerful ? '#e447c0' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Enemy extends Entity {
    constructor(x, y) {
        super(x, y);
        this.radius = 20;
    }

    takeDamage(game) {
        this.dead = true;
        game.score += 50 * game.combo;
        soundEngine.playExplosion();
        game.entities.push(new FloatingText(`+${50 * game.combo}`, this.x, this.y, '#fbbf24'));
        for(let i=0; i< (saveManager.getOption('particles') === 'high' ? 20 : 5); i++) {
            game.particles.push(new Particle(this.x, this.y, 0, 0, '#ef4444'));
        }
    }

    update(dt, game) {
        // Player collision
        if (game.player && !this.dead) {
            if (Utils.dist(this.x, this.y, game.player.x, game.player.y) < this.radius + game.player.radius) {
                this.takeDamage(game);
                game.health--;
                soundEngine.playHit();
                game.addScreenShake(20);
                if (game.health <= 0) {
                    game.setState(STATE.GAME_OVER);
                } else {
                    // knockback
                    game.player.vy = -500;
                }
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.radius);
        ctx.lineTo(this.x + this.radius, this.y + this.radius);
        ctx.lineTo(this.x - this.radius, this.y + this.radius);
        ctx.fill();
    }
}

class Particle extends Entity {
    constructor(x, y, dx, dy, color) {
        super(x, y);
        this.vx = dx * 100 + Utils.rand(-100, 100);
        this.vy = dy * 100 + Utils.rand(-100, 100);
        this.color = color;
        this.life = Utils.rand(0.2, 0.6);
        this.maxLife = this.life;
        this.radius = Utils.rand(2, 5);
    }
    update(dt, game) {
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class FloatingText extends Entity {
    constructor(text, x, y, color) {
        super(x, y);
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -50;
    }
    update(dt, game) {
        super.update(dt, game);
        this.life -= dt;
        if (this.life <= 0) this.dead = true;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

// Start game when loaded
window.onload = () => {
    window.game = new Game();
};
