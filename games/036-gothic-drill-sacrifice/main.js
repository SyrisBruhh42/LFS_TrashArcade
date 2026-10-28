
// --- SAVE MANAGER ---
class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_036_036-gothic-drill-sacrifice_v1';
        this.data = {
            highScore: 0,
            bestDepth: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterVol: 100,
                sfxVol: 100,
                musicVol: 100,
                shake: 1,
                particles: 1,
                touchControls: 'auto'
            }
        };
        this.load();
    }

    load() {
        try {
            const stored = localStorage.getItem(this.saveKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
                // ensure options exist if old save
                this.data.options = { ...this.data.options, ...(parsed.options || {}) };
            }
        } catch (e) {
            console.warn("localStorage load failed, using defaults", e);
        }
    }

    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn("localStorage save failed", e);
        }
    }

    export() {
        return btoa(JSON.stringify(this.data));
    }

    importSave(b64Str) {
        try {
            const parsed = JSON.parse(atob(b64Str));
            if (parsed && typeof parsed === 'object') {
                this.data = { ...this.data, ...parsed };
                this.save();
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }

    reset() {
        this.data = {
            highScore: 0,
            bestDepth: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { ...this.data.options } // keep options
        };
        this.save();
    }
}

// --- SOUND ENGINE ---
class SoundEngine {
    constructor(saveManager) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.saveManager = saveManager;

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.connect(this.masterGain);

        this.updateVolumes();

        this.musicOsc = null;
        this.musicInterval = null;
        this.musicStep = 0;
        this.arpNotes = [110, 130.81, 164.81, 196, 220, 261.63]; // A minor pentatonic ish
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    updateVolumes() {
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.masterVol / 100;
        this.sfxGain.gain.value = opts.sfxVol / 100;
        this.musicGain.gain.value = (opts.musicVol / 100) * 0.3; // music is inherently quieter
    }

    playTone(freq, type, duration, vol=1, slideFreq=null) {
        if (this.sfxGain.gain.value === 0 || this.masterGain.gain.value === 0) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol=1, highpassFreq=500) {
         if (this.sfxGain.gain.value === 0 || this.masterGain.gain.value === 0) return;

         const bufferSize = this.ctx.sampleRate * duration;
         const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
         const data = buffer.getChannelData(0);
         for (let i = 0; i < bufferSize; i++) {
             data[i] = Math.random() * 2 - 1;
         }

         const noise = this.ctx.createBufferSource();
         noise.buffer = buffer;

         const filter = this.ctx.createBiquadFilter();
         filter.type = 'highpass';
         filter.frequency.value = highpassFreq;

         const gain = this.ctx.createGain();
         gain.gain.setValueAtTime(vol, this.ctx.currentTime);
         gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

         noise.connect(filter);
         filter.connect(gain);
         gain.connect(this.sfxGain);

         noise.start();
    }

    // Specific SFX
    playDrill() {
        if (Math.random() < 0.2) this.playNoise(0.1, 0.3, 1000);
    }
    playOverdrive() {
        this.playTone(400, 'square', 0.5, 0.8, 800);
        this.playTone(200, 'sawtooth', 0.5, 0.8, 400);
    }
    playHit() {
        this.playNoise(0.2, 0.8, 200);
        this.playTone(150, 'sawtooth', 0.2, 0.8, 50);
    }
    playGem() {
        this.playTone(600, 'sine', 0.2, 0.5, 1200);
        setTimeout(() => this.playTone(800, 'sine', 0.3, 0.5, 1600), 100);
    }
    playGhostDeath() {
        this.playNoise(0.4, 0.6, 800);
        this.playTone(300, 'square', 0.3, 0.5, 100);
    }
    playUI() {
        this.playTone(800, 'sine', 0.1, 0.5);
    }

    startMusic() {
        this.stopMusic();
        this.musicStep = 0;
        this.musicInterval = setInterval(() => {
            if (this.ctx.state !== 'running') return;
            const note = this.arpNotes[this.musicStep % this.arpNotes.length];
            const bass = this.musicStep % 8 === 0 ? note / 2 : null;

            this.playTone(note, 'sine', 0.2, 0.5); // Arp
            if (bass) this.playTone(bass, 'square', 0.4, 0.6); // Bass line

            this.musicStep++;
        }, 200); // 150 BPM
    }

    stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

// --- INPUT MANAGER ---
class InputManager {
    constructor(canvas, uiLayer) {
        this.canvas = canvas;
        this.uiLayer = uiLayer;

        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touchActive = false;

        this.actionJustPressed = false;
        this.pauseJustPressed = false;

        // Logical input state
        this.up = false;
        this.down = false;
        this.left = false;
        this.right = false;
        this.action = false;

        this.initKeyboard();
        this.initMouse();
        this.initTouch();
    }

    update() {
        this.up = this.keys['ArrowUp'] || this.keys['w'] || this.keys['W'] || this.touchUp;
        this.down = this.keys['ArrowDown'] || this.keys['s'] || this.keys['S'] || this.touchDown;
        this.left = this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A'] || this.touchLeft;
        this.right = this.keys['ArrowRight'] || this.keys['d'] || this.keys['D'] || this.touchRight;
        this.action = this.keys[' '] || this.touchAction || this.mouse.down;
    }

    consumeAction() {
        if (this.actionJustPressed) {
            this.actionJustPressed = false;
            return true;
        }
        return false;
    }

    consumePause() {
         if (this.pauseJustPressed) {
            this.pauseJustPressed = false;
            return true;
        }
        return false;
    }

    initKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === ' ' && !e.repeat) this.actionJustPressed = true;
            if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !e.repeat) this.pauseJustPressed = true;

            // Prevent scrolling
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });
    }

    initMouse() {
        const updateMouse = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Scale mouse to logical resolution 1280x720
            const scaleX = 1280 / rect.width;
            const scaleY = 720 / rect.height;
            this.mouse.x = (e.clientX - rect.left) * scaleX;
            this.mouse.y = (e.clientY - rect.top) * scaleY;
        };

        window.addEventListener('mousemove', updateMouse);
        window.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
                this.mouse.down = true;
                this.actionJustPressed = true;
                updateMouse(e);
            }
        });
        window.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });
    }

    initTouch() {
        this.touchUp = false; this.touchDown = false; this.touchLeft = false; this.touchRight = false;
        this.touchAction = false;

        const handleTouch = () => { this.touchActive = true; };
        window.addEventListener('touchstart', handleTouch, {passive: true});

        // D-Pad and Action Button bindings handled in main UI setup to map elements
    }
}


// --- CONSTANTS ---
const LOGICAL_WIDTH = 1280;
const LOGICAL_HEIGHT = 720;
const BLOCK_SIZE = 64;
const COLS = Math.ceil(LOGICAL_WIDTH / BLOCK_SIZE);

// --- GAME ENGINE ---
class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });

        this.canvas.width = LOGICAL_WIDTH;
        this.canvas.height = LOGICAL_HEIGHT;

        this.saveManager = new SaveManager();
        this.soundEngine = new SoundEngine(this.saveManager);
        this.inputManager = new InputManager(this.canvas, document.querySelector('.ui-layer'));

        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
        this.lastTime = 0;
        this.shakeTime = 0;
        this.shakeMagnitude = 0;

        this.setupResize();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        // Setup visibility change for auto-pause
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') {
                this.pauseGame();
            }
        });
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') {
                this.pauseGame();
            }
        });
    }

    setupResize() {
        const resize = () => {
            // CSS handles visual scaling, internal resolution is fixed
            // Just need to show/hide touch controls based on options and screen size
            const opts = this.saveManager.data.options;
            const touchUI = document.getElementById('touch-controls');

            let showTouch = false;
            if (opts.touchControls === 'always') showTouch = true;
            else if (opts.touchControls === 'auto' && (this.inputManager.touchActive || window.innerWidth < 800)) showTouch = true;

            if (showTouch && this.state === 'PLAYING') {
                touchUI.classList.add('active');
            } else {
                touchUI.classList.remove('active');
            }
        };

        const ro = new ResizeObserver(resize);
        ro.observe(document.getElementById('game-container'));
        window.addEventListener('resize', resize);
        // initial call
        setTimeout(resize, 100);
    }

    start() {
        // init UI
    }

    startGame() {
        this.state = 'PLAYING';
        this.soundEngine.resume();
        this.soundEngine.startMusic();

        // Reset Game State
        this.depth = 0;
        this.score = 0;
        this.multiplier = 1;
        this.multTimer = 0;

        this.player = {
            x: LOGICAL_WIDTH / 2,
            y: 100,
            vx: 0,
            vy: 0,
            radius: 20,
            hp: 100,
            overdrive: 0, // time remaining
            facing: 1 // 1 right, -1 left
        };

        this.cameraY = 0;
        this.blocks = [];
        this.entities = [];
        this.particles = [];
        this.floatingTexts = [];

        this.generateBlocks(0, LOGICAL_HEIGHT * 2);

        document.getElementById('hud').classList.add('active');
        document.getElementById('screen-title').classList.remove('active');
        document.getElementById('screen-gameover').classList.remove('active');

        // trigger resize to show touch controls if needed
        window.dispatchEvent(new Event('resize'));
    }

    pauseGame() {
        this.state = 'PAUSED';
        this.soundEngine.stopMusic();
        document.getElementById('screen-paused').classList.add('active');
        document.getElementById('touch-controls').classList.remove('active');
    }

    resumeGame() {
        this.state = 'PLAYING';
        this.soundEngine.resume();
        this.soundEngine.startMusic();
        document.getElementById('screen-paused').classList.remove('active');
        window.dispatchEvent(new Event('resize'));
    }

    gameOver() {
        this.state = 'GAME_OVER';
        this.soundEngine.stopMusic();
        this.soundEngine.playNoise(1, 1, 100);

        this.shake(0.5, 20);

        document.getElementById('hud').classList.remove('active');
        document.getElementById('touch-controls').classList.remove('active');

        // Update Save Data
        let newHigh = false;
        if (this.score > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = this.score;
            newHigh = true;
        }
        if (this.depth > this.saveManager.data.bestDepth) {
            this.saveManager.data.bestDepth = Math.floor(this.depth);
        }
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.data.totalScoreAccumulated += this.score;

        // Check Milestones
        const unlockedNow = [];
        const m1 = 'First Blood (Reach 100m)';
        if (this.depth >= 100 && !this.saveManager.data.unlockedMilestones.includes(m1)) {
            this.saveManager.data.unlockedMilestones.push(m1);
            unlockedNow.push(m1);
        }
        const m2 = 'Overdriver (Use OD 10 times in a run)'; // tracked in logic
        const m3 = 'Deep Diver (Reach 500m)';
        if (this.depth >= 500 && !this.saveManager.data.unlockedMilestones.includes(m3)) {
            this.saveManager.data.unlockedMilestones.push(m3);
            unlockedNow.push(m3);
        }

        this.saveManager.save();

        // Update UI
        document.getElementById('go-depth').innerText = Math.floor(this.depth);
        document.getElementById('go-score').innerText = Math.floor(this.score);
        document.getElementById('go-new-high').style.display = newHigh ? 'block' : 'none';

        const mDiv = document.getElementById('go-milestones-unlocked');
        mDiv.innerHTML = '';
        if (unlockedNow.length > 0) {
            mDiv.innerHTML = '<h4>New Milestones!</h4>';
            unlockedNow.forEach(m => {
                mDiv.innerHTML += `<span class="milestone-badge">${m}</span>`;
            });
        }

        setTimeout(() => {
            document.getElementById('screen-gameover').classList.add('active');
        }, 1000);
    }

    shake(duration, magnitude) {
        if (this.saveManager.data.options.shake > 0) {
            this.shakeTime = duration;
            this.shakeMagnitude = magnitude * this.saveManager.data.options.shake;
        }
    }


    // --- MECHANICS ---
    generateBlocks(startY, endY) {
        const startRow = Math.floor(startY / BLOCK_SIZE);
        const endRow = Math.ceil(endY / BLOCK_SIZE);

        for (let r = startRow; r <= endRow; r++) {
            // Check if row exists
            if (this.blocks.some(b => b.r === r)) continue;

            for (let c = 0; c < COLS; c++) {
                // Bounds
                if (c === 0 || c === COLS - 1) {
                    this.blocks.push({r, c, type: 'wall', hp: 999});
                    continue;
                }

                // Difficulty scaling based on depth
                const depthFactor = Math.min(r / 100, 1);

                let type = 'dirt';
                let hp = 1;

                const rand = Math.random();
                if (rand < 0.05 + depthFactor * 0.1) {
                    type = 'rock';
                    hp = 3;
                } else if (rand < 0.1 + depthFactor * 0.15) {
                    type = 'empty';
                }

                if (type !== 'empty') {
                    this.blocks.push({r, c, type, hp, maxHp: hp});
                }

                // Spawn entities
                if (type === 'empty' && Math.random() < 0.05 + (depthFactor * 0.1)) {
                    this.entities.push({
                        type: 'ghost',
                        x: c * BLOCK_SIZE + BLOCK_SIZE/2,
                        y: r * BLOCK_SIZE + BLOCK_SIZE/2,
                        vx: (Math.random() - 0.5) * 100,
                        vy: (Math.random() - 0.5) * 50,
                        radius: 15,
                        hp: 1,
                        active: true
                    });
                }

                if (type === 'dirt' && Math.random() < 0.05) {
                    this.entities.push({
                         type: 'gem',
                         x: c * BLOCK_SIZE + BLOCK_SIZE/2,
                         y: r * BLOCK_SIZE + BLOCK_SIZE/2,
                         radius: 10,
                         active: true,
                         buried: true,
                         r, c
                    });
                }
            }
        }

        // Cleanup old blocks
        this.blocks = this.blocks.filter(b => b.r * BLOCK_SIZE > this.cameraY - LOGICAL_HEIGHT);
        this.entities = this.entities.filter(e => e.y > this.cameraY - LOGICAL_HEIGHT && e.active);
    }

    spawnParticles(x, y, color, count, speed, size) {
        if (this.saveManager.data.options.particles === 0) return;
        const actualCount = Math.floor(count * this.saveManager.data.options.particles);
        for(let i=0; i<actualCount; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * speed,
                vy: (Math.random() - 0.5) * speed,
                life: 1,
                decay: Math.random() * 2 + 1,
                color,
                size: Math.random() * size + 2
            });
        }
    }

    spawnText(x, y, text, color) {
        this.floatingTexts.push({
            x, y, text, color, life: 1, vy: -50
        });
    }

    updateGame(dt) {
        if (this.state !== 'PLAYING') return;

        // --- Overdrive Logic ---
        if (this.inputManager.consumeAction() && this.player.overdrive <= 0) {
            if (this.player.hp > 10) {
                this.player.hp -= 10;
                this.player.overdrive = 5.0; // 5 seconds
                this.soundEngine.playOverdrive();
                this.shake(0.2, 10);
                this.spawnParticles(this.player.x, this.player.y, '#5be29e', 30, 200, 5);
                this.spawnText(this.player.x, this.player.y, "OVERDRIVE!", "#5be29e");

                if (!this.odCount) this.odCount = 0;
                this.odCount++;
                if (this.odCount >= 10 && !this.saveManager.data.unlockedMilestones.includes('Overdriver (Use OD 10 times in a run)')) {
                    this.saveManager.data.unlockedMilestones.push('Overdriver (Use OD 10 times in a run)');
                    this.spawnText(this.player.x, this.player.y - 30, "Milestone: Overdriver!", "#ffaa00");
                }
            } else {
                this.spawnText(this.player.x, this.player.y, "Need HP!", "#e25b6a");
            }
        }

        if (this.player.overdrive > 0) {
            this.player.overdrive -= dt;
        }

        // --- Player Movement ---
        const speed = this.player.overdrive > 0 ? 400 : 250;
        let dx = 0; let dy = 0;

        if (this.inputManager.left) { dx = -1; this.player.facing = -1; }
        if (this.inputManager.right) { dx = 1; this.player.facing = 1; }
        if (this.inputManager.up) dy = -1;
        if (this.inputManager.down) dy = 1;

        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx*dx + dy*dy);
            dx /= len; dy /= len;
        }

        this.player.vx = dx * speed;
        this.player.vy = dy * speed;

        let nextX = this.player.x + this.player.vx * dt;
        let nextY = this.player.y + this.player.vy * dt;

        // --- Collision & Drilling ---
        let drilled = false;

        // AABB approximation for player
        const pRect = {
            left: nextX - this.player.radius,
            right: nextX + this.player.radius,
            top: nextY - this.player.radius,
            bottom: nextY + this.player.radius
        };

        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const b = this.blocks[i];
            const bx = b.c * BLOCK_SIZE;
            const by = b.r * BLOCK_SIZE;

            if (pRect.right > bx && pRect.left < bx + BLOCK_SIZE &&
                pRect.bottom > by && pRect.top < by + BLOCK_SIZE) {

                if (b.type === 'wall') {
                    // Resolve collision
                    if (this.player.vx > 0) nextX = bx - this.player.radius;
                    if (this.player.vx < 0) nextX = bx + BLOCK_SIZE + this.player.radius;
                } else {
                    // Drill
                    b.hp -= (this.player.overdrive > 0 ? 30 : 10) * dt;
                    drilled = true;
                    if (b.hp <= 0) {
                        this.blocks.splice(i, 1);
                        this.score += (b.type === 'rock' ? 50 : 10) * this.multiplier;
                        this.spawnParticles(bx + BLOCK_SIZE/2, by + BLOCK_SIZE/2, b.type==='rock' ? '#666' : '#5c4033', 10, 100, 4);

                        // Unbury gems
                        this.entities.forEach(e => {
                            if (e.type === 'gem' && e.r === b.r && e.c === b.c) e.buried = false;
                        });
                    }
                }
            }
        }

        if (drilled) {
            this.soundEngine.playDrill();
            this.shake(0.05, 2);
        }

        this.player.x = nextX;
        this.player.y = Math.max(this.player.radius, nextY); // prevent going above surface

        // Camera logic
        const targetCamY = this.player.y - LOGICAL_HEIGHT * 0.3;
        this.cameraY += (targetCamY - this.cameraY) * 5 * dt;
        this.cameraY = Math.max(0, this.cameraY);

        this.depth = Math.max(this.depth, this.player.y / 10);

        // Generate new chunks
        this.generateBlocks(this.cameraY + LOGICAL_HEIGHT, this.cameraY + LOGICAL_HEIGHT + BLOCK_SIZE * 5);

        // --- Multiplier ---
        if (drilled) {
            this.multTimer = 2.0;
        } else {
            this.multTimer -= dt;
            if (this.multTimer <= 0) {
                this.multiplier = 1;
                this.multTimer = 0;
            } else if (this.multTimer > 2.0) {
                this.multiplier++;
                this.multTimer = 2.0;
                this.spawnText(this.player.x, this.player.y - 20, "x" + this.multiplier, "#ffaa00");
            }
        }

        // --- Entities ---
        for (let e of this.entities) {
            if (!e.active) continue;

            if (e.type === 'ghost') {
                // Seek player
                const dx = this.player.x - e.x;
                const dy = this.player.y - e.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist < 300) {
                    e.vx += (dx / dist) * 200 * dt;
                    e.vy += (dy / dist) * 200 * dt;
                }

                // friction
                e.vx *= 0.95; e.vy *= 0.95;

                e.x += e.vx * dt;
                e.y += e.vy * dt;

                // Collision with player
                if (dist < this.player.radius + e.radius) {
                    if (this.player.overdrive > 0) {
                        e.active = false;
                        this.soundEngine.playGhostDeath();
                        this.score += 100 * this.multiplier;
                        this.spawnParticles(e.x, e.y, '#aaa', 20, 150, 3);
                        this.spawnText(e.x, e.y, "+100", "#fff");
                        this.shake(0.1, 5);
                    } else {
                        // Damage
                        this.player.hp -= 20 * dt;
                        this.soundEngine.playHit();
                        this.shake(0.1, 3);
                    }
                }
            } else if (e.type === 'gem' && !e.buried) {
                const dx = this.player.x - e.x;
                const dy = this.player.y - e.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < this.player.radius + e.radius) {
                    e.active = false;
                    this.player.hp = Math.min(100, this.player.hp + 15);
                    this.soundEngine.playGem();
                    this.score += 50 * this.multiplier;
                    this.spawnParticles(e.x, e.y, '#5be29e', 10, 100, 3);
                    this.spawnText(e.x, e.y, "+HP", "#5be29e");
                }
            }
        }

        // --- Particles & Text ---
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            let t = this.floatingTexts[i];
            t.y += t.vy * dt;
            t.life -= dt;
            if (t.life <= 0) this.floatingTexts.splice(i, 1);
        }

        // --- Death ---
        if (this.player.hp <= 0) {
            this.gameOver();
        }

        // Update HUD
        document.getElementById('hud-depth').innerText = Math.floor(this.depth);
        document.getElementById('hud-mult').innerText = this.multiplier;
        document.getElementById('hud-hp').innerText = Math.floor(this.player.hp);
        document.getElementById('hud-score').innerText = Math.floor(this.score);
    }

    drawGame(dt) {
        if (this.state === 'TITLE') return;

        this.ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        this.ctx.save();
        this.ctx.translate(0, -this.cameraY);

        // Draw Blocks
        for (let b of this.blocks) {
            const bx = b.c * BLOCK_SIZE;
            const by = b.r * BLOCK_SIZE;

            // frustum culling
            if (by + BLOCK_SIZE < this.cameraY || by > this.cameraY + LOGICAL_HEIGHT) continue;

            if (b.type === 'wall') {
                this.ctx.fillStyle = '#111';
                this.ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);
                this.ctx.strokeStyle = '#333';
                this.ctx.strokeRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);
            } else if (b.type === 'dirt') {
                this.ctx.fillStyle = '#3a2318';
                this.ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);
                // Cracks
                if (b.hp < b.maxHp) {
                    this.ctx.strokeStyle = '#1a0f0a';
                    this.ctx.beginPath();
                    this.ctx.moveTo(bx + 10, by + 10);
                    this.ctx.lineTo(bx + 30, by + 30);
                    this.ctx.stroke();
                }
            } else if (b.type === 'rock') {
                this.ctx.fillStyle = '#444';
                this.ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE);
                if (b.hp < b.maxHp) {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    this.ctx.fillRect(bx, by, BLOCK_SIZE, BLOCK_SIZE * (1 - b.hp/b.maxHp));
                }
            }
        }

        // Draw Entities
        for (let e of this.entities) {
            if (!e.active) continue;
            if (e.type === 'ghost') {
                this.ctx.fillStyle = 'rgba(200, 200, 255, 0.7)';
                this.ctx.beginPath();
                this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
                this.ctx.fill();
                // eyes
                this.ctx.fillStyle = '#000';
                this.ctx.beginPath(); this.ctx.arc(e.x - 5, e.y - 2, 2, 0, Math.PI*2); this.ctx.fill();
                this.ctx.beginPath(); this.ctx.arc(e.x + 5, e.y - 2, 2, 0, Math.PI*2); this.ctx.fill();
            } else if (e.type === 'gem') {
                this.ctx.fillStyle = e.buried ? 'rgba(91, 226, 158, 0.2)' : '#5be29e';
                this.ctx.beginPath();
                this.ctx.moveTo(e.x, e.y - e.radius);
                this.ctx.lineTo(e.x + e.radius, e.y);
                this.ctx.lineTo(e.x, e.y + e.radius);
                this.ctx.lineTo(e.x - e.radius, e.y);
                this.ctx.fill();
            }
        }

        // Draw Player
        if (this.state === 'PLAYING') {
            this.ctx.save();
            this.ctx.translate(this.player.x, this.player.y);

            // Overdrive Aura
            if (this.player.overdrive > 0) {
                this.ctx.beginPath();
                this.ctx.arc(0, 0, this.player.radius + 10 + Math.sin(performance.now()/50)*5, 0, Math.PI*2);
                this.ctx.fillStyle = 'rgba(91, 226, 158, 0.3)';
                this.ctx.fill();
            }

            // Body
            this.ctx.fillStyle = '#ccc';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, this.player.radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Drill bit
            this.ctx.fillStyle = '#ffaa00';
            this.ctx.beginPath();
            if (this.inputManager.down || (!this.inputManager.up && !this.inputManager.left && !this.inputManager.right)) {
                // down
                this.ctx.moveTo(-10, 10); this.ctx.lineTo(10, 10); this.ctx.lineTo(0, 30);
            } else if (this.inputManager.up) {
                this.ctx.moveTo(-10, -10); this.ctx.lineTo(10, -10); this.ctx.lineTo(0, -30);
            } else {
                // side
                this.ctx.moveTo(10 * this.player.facing, -10);
                this.ctx.lineTo(10 * this.player.facing, 10);
                this.ctx.lineTo(30 * this.player.facing, 0);
            }
            this.ctx.fill();

            this.ctx.restore();
        }

        // Particles
        for (let p of this.particles) {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life;
            this.ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
            this.ctx.globalAlpha = 1;
        }

        // Text
        this.ctx.font = '20px Courier New';
        this.ctx.textAlign = 'center';
        for (let t of this.floatingTexts) {
            this.ctx.fillStyle = t.color;
            this.ctx.globalAlpha = Math.max(0, t.life);
            this.ctx.fillText(t.text, t.x, t.y);
            this.ctx.globalAlpha = 1;
        }

        this.ctx.restore();

        // HUD Overlay Effects
        if (this.state === 'PLAYING') {
            // Vignette
            const grad = this.ctx.createRadialGradient(LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2, LOGICAL_HEIGHT/4, LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2, LOGICAL_WIDTH);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.8)');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

            // Damage Warning
            if (this.player.hp < 30) {
                this.ctx.fillStyle = `rgba(226, 91, 106, ${0.2 + Math.sin(performance.now()/100)*0.1})`;
                this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
            }
        }
    }


    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.inputManager.update();

        if (this.state === 'PLAYING') {
            if (this.inputManager.consumePause()) {
                this.pauseGame();
            } else {
                this.updateGame(dt);
            }
        }

        if (this.shakeTime > 0) {
            this.shakeTime -= dt;
        }

        this.ctx.save();

        if (this.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * this.shakeMagnitude;
            const dy = (Math.random() - 0.5) * this.shakeMagnitude;
            this.ctx.translate(dx, dy);
        }

        this.drawGame(dt);

        this.ctx.restore();

        requestAnimationFrame(this.loop);
    }
}


// --- DOM INIT & UI ---
window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    const sm = engine.saveManager;
    const se = engine.soundEngine;
    const im = engine.inputManager;

    // --- Modals ---
    const screens = {
        title: document.getElementById('screen-title'),
        howto: document.getElementById('screen-howto'),
        options: document.getElementById('screen-options'),
        paused: document.getElementById('screen-paused'),
        gameover: document.getElementById('screen-gameover')
    };

    const showScreen = (s) => {
        Object.values(screens).forEach(el => el.classList.remove('active'));
        if (s) s.classList.add('active');
    };

    // --- Title ---
    document.getElementById('title-highscore').innerText = sm.data.highScore;
    const mDiv = document.getElementById('title-milestones');
    const allMilestones = [
        'First Blood (Reach 100m)',
        'Overdriver (Use OD 10 times in a run)',
        'Deep Diver (Reach 500m)'
    ];
    allMilestones.forEach(m => {
        const isLocked = !sm.data.unlockedMilestones.includes(m);
        mDiv.innerHTML += `<span class="milestone-badge ${isLocked ? 'milestone-locked' : ''}">${isLocked ? '???' : m}</span>`;
    });

    document.getElementById('btn-play').addEventListener('click', () => {
        se.playUI();
        se.resume();
        engine.startGame();
    });

    document.getElementById('btn-howto').addEventListener('click', () => { se.playUI(); showScreen(screens.howto); });
    document.getElementById('btn-howto-back').addEventListener('click', () => { se.playUI(); showScreen(screens.title); });

    document.getElementById('btn-options-title').addEventListener('click', () => {
        se.playUI();
        updateOptionsUI();
        showScreen(screens.options);
    });

    // --- Options ---
    const updateOptionsUI = () => {
        document.getElementById('opt-master-vol').value = sm.data.options.masterVol;
        document.getElementById('opt-sfx-vol').value = sm.data.options.sfxVol;
        document.getElementById('opt-music-vol').value = sm.data.options.musicVol;
        document.getElementById('opt-shake').value = sm.data.options.shake;
        document.getElementById('opt-particles').value = sm.data.options.particles;
        document.getElementById('opt-touch').value = sm.data.options.touchControls;
        document.getElementById('save-data-text').value = sm.export();
    };

    document.getElementById('opt-master-vol').addEventListener('input', (e) => { sm.data.options.masterVol = e.target.value; se.updateVolumes(); sm.save(); });
    document.getElementById('opt-sfx-vol').addEventListener('input', (e) => { sm.data.options.sfxVol = e.target.value; se.updateVolumes(); sm.save(); se.playUI(); });
    document.getElementById('opt-music-vol').addEventListener('input', (e) => { sm.data.options.musicVol = e.target.value; se.updateVolumes(); sm.save(); });
    document.getElementById('opt-shake').addEventListener('change', (e) => { sm.data.options.shake = parseFloat(e.target.value); sm.save(); });
    document.getElementById('opt-particles').addEventListener('change', (e) => { sm.data.options.particles = parseFloat(e.target.value); sm.save(); });
    document.getElementById('opt-touch').addEventListener('change', (e) => {
        sm.data.options.touchControls = e.target.value;
        sm.save();
        window.dispatchEvent(new Event('resize'));
    });

    document.getElementById('btn-options-back').addEventListener('click', () => {
        se.playUI();
        if (engine.state === 'PAUSED') showScreen(screens.paused);
        else showScreen(screens.title);
    });

    document.getElementById('btn-export-save').addEventListener('click', () => {
        se.playUI();
        const ta = document.getElementById('save-data-text');
        ta.select();
        document.execCommand('copy');
        alert('Save data copied to clipboard!');
    });

    document.getElementById('btn-import-save').addEventListener('click', () => {
        se.playUI();
        const ta = document.getElementById('save-data-text');
        if (sm.importSave(ta.value)) {
            alert('Save imported successfully!');
            location.reload();
        } else {
            alert('Invalid save data.');
        }
    });

    let resetClicks = 0;
    document.getElementById('btn-reset-save').addEventListener('click', (e) => {
        se.playUI();
        if (resetClicks === 0) {
            e.target.innerText = "Click again to confirm reset";
            resetClicks++;
            setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset"; }, 3000);
        } else {
            sm.reset();
            location.reload();
        }
    });

    // --- HUD ---
    document.getElementById('btn-pause-hud').addEventListener('click', () => {
        se.playUI();
        engine.pauseGame();
    });

    // --- Pause ---
    document.getElementById('btn-resume').addEventListener('click', () => {
        se.playUI();
        engine.resumeGame();
    });
    document.getElementById('btn-restart-pause').addEventListener('click', () => {
        se.playUI();
        engine.startGame();
    });
    document.getElementById('btn-options-pause').addEventListener('click', () => {
        se.playUI();
        updateOptionsUI();
        showScreen(screens.options);
    });
    document.getElementById('btn-quit').addEventListener('click', () => {
        se.playUI();
        location.reload();
    });

    // --- Game Over ---
    document.getElementById('btn-restart-go').addEventListener('click', () => {
        se.playUI();
        engine.startGame();
    });
    document.getElementById('btn-title-go').addEventListener('click', () => {
        se.playUI();
        location.reload();
    });

    // --- Touch Controls Map ---
    const mapTouch = (id, prop) => {
        const el = document.getElementById(id);
        el.addEventListener('touchstart', (e) => { e.preventDefault(); im[prop] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); im[prop] = false; });
        el.addEventListener('touchcancel', (e) => { e.preventDefault(); im[prop] = false; });
    };

    mapTouch('dpad-up', 'touchUp');
    mapTouch('dpad-down', 'touchDown');
    mapTouch('dpad-left', 'touchLeft');
    mapTouch('dpad-right', 'touchRight');

    const actBtn = document.getElementById('action-btn');
    actBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        im.touchAction = true;
        im.actionJustPressed = true;
    });
    actBtn.addEventListener('touchend', (e) => { e.preventDefault(); im.touchAction = false; });
    actBtn.addEventListener('touchcancel', (e) => { e.preventDefault(); im.touchAction = false; });

    // Initial Background render for title screen
    engine.ctx.fillStyle = '#1a0f2e';
    engine.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    for(let i=0; i<100; i++){
        engine.ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.3})`;
        engine.ctx.fillRect(Math.random()*LOGICAL_WIDTH, Math.random()*LOGICAL_HEIGHT, 2, 2);
    }
});
