window.addEventListener('DOMContentLoaded', () => {

    const SAVE_KEY = "arcade_game_033_033-candy-echo-recoil_v1";

    // ----------------------------------------------------------------------
    // SAVE MANAGER
    // ----------------------------------------------------------------------
    class SaveManager {
        constructor() {
            this.data = this.getDefault();
            this.load();
        }
        getDefault() {
            return {
                highScore: 0,
                totalGamesPlayed: 0,
                totalScoreAccumulated: 0,
                unlockedMilestones: [],
                options: { mute: false, sfxVolume: 80, musicVolume: 60, shake: 1, particles: 1 }
            };
        }
        load() {
            try {
                const saved = localStorage.getItem(SAVE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.data = { ...this.getDefault(), ...parsed };
                }
            } catch (e) {
                console.warn("localStorage load failed, using memory:", e);
            }
        }
        save() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
            } catch (e) {
                console.warn("localStorage save failed:", e);
            }
        }
        reset() {
            this.data = this.getDefault();
            this.save();
        }
    }

    const saveManager = new SaveManager();

    // ----------------------------------------------------------------------
    // SOUND ENGINE
    // ----------------------------------------------------------------------
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.sfxGain = null;
            this.musicGain = null;
            this.isPlayingMusic = false;
        }

        init() {
            if (this.ctx) return;
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);

            this.musicGain = this.ctx.createGain();
            this.musicGain.connect(this.masterGain);

            this.updateVolumes();
        }

        updateVolumes() {
            if (!this.ctx) return;
            const opts = saveManager.data.options;
            this.masterGain.gain.value = opts.mute ? 0 : 1;
            this.sfxGain.gain.value = opts.sfxVolume / 100;
            this.musicGain.gain.value = opts.musicVolume / 100;
        }

        playTone(freq, type, duration, vol=1) {
            if (!this.ctx || saveManager.data.options.mute) return;
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

        playNoise(duration, vol=1) {
            if (!this.ctx || saveManager.data.options.mute) return;
            const bufferSize = this.ctx.sampleRate * duration;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noiseSource = this.ctx.createBufferSource();
            noiseSource.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

            noiseSource.connect(filter);
            filter.connect(gain);
            gain.connect(this.sfxGain);

            noiseSource.start();
        }

        playMusic() {
            if (this.isPlayingMusic || !this.ctx) return;
            this.isPlayingMusic = true;
            this.scheduleNextNote(this.ctx.currentTime + 0.1);
        }

        stopMusic() {
            this.isPlayingMusic = false;
        }

        scheduleNextNote(time) {
            if (!this.isPlayingMusic) return;
            // Simple synthwave arp
            const notes = [220, 261.63, 329.63, 392.00, 440, 392.00, 329.63, 261.63];
            const note = notes[Math.floor(Math.random() * notes.length)] / 2; // Lower octave

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.value = note;

            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start(time);
            osc.stop(time + 0.2);

            this.scheduleNextNote(time + 0.25);
        }

        sfxFire() { this.playTone(400, 'square', 0.1, 0.5); this.playNoise(0.1, 0.2); }
        sfxEcho() { this.playTone(800, 'sine', 0.2, 0.3); this.playTone(1200, 'sine', 0.2, 0.2); }
        sfxHit() { this.playTone(150, 'sawtooth', 0.1, 0.4); }
        sfxDestroy() { this.playNoise(0.3, 0.8); this.playTone(100, 'square', 0.3, 0.6); }
        sfxBounce() { this.playTone(600, 'sine', 0.05, 0.3); }
        sfxUI() { this.playTone(1000, 'triangle', 0.05, 0.2); }
    }

    const soundEngine = new SoundEngine();

    // ----------------------------------------------------------------------
    // INPUT MANAGER
    // ----------------------------------------------------------------------
    class InputManager {
        constructor() {
            this.keys = {};
            this.mouse = { x: 0, y: 0, down: false, rightDown: false };
            this.joystick = { dx: 0, dy: 0, active: false };
            this.fireBtn = false;
            this.echoBtn = false;
            this.isMobile = false;
            this.scale = { x: 1, y: 1 };
            this.offset = { x: 0, y: 0 };

            this.setupKeyboard();
            this.setupMouse();
            this.setupTouch();
        }

        updateTransform(scaleX, scaleY, offsetX, offsetY) {
            this.scale = { x: scaleX, y: scaleY };
            this.offset = { x: offsetX, y: offsetY };
        }

        screenToLogical(x, y) {
            return {
                x: (x - this.offset.x) / this.scale.x,
                y: (y - this.offset.y) / this.scale.y
            };
        }

        setupKeyboard() {
            window.addEventListener('keydown', (e) => {
                this.keys[e.code] = true;
                soundEngine.init();
            });
            window.addEventListener('keyup', (e) => {
                this.keys[e.code] = false;
            });
        }

        setupMouse() {
            const canvas = document.getElementById('game-canvas');
            canvas.addEventListener('mousemove', (e) => {
                const rect = canvas.getBoundingClientRect();
                const log = this.screenToLogical(e.clientX - rect.left, e.clientY - rect.top);
                this.mouse.x = log.x;
                this.mouse.y = log.y;
            });
            canvas.addEventListener('mousedown', (e) => {
                soundEngine.init();
                if (e.button === 0) this.mouse.down = true;
                if (e.button === 2) {
                    this.mouse.rightDown = true;
                }
            });
            canvas.addEventListener('mouseup', (e) => {
                if (e.button === 0) this.mouse.down = false;
                if (e.button === 2) this.mouse.rightDown = false;
            });
            canvas.addEventListener('contextmenu', e => e.preventDefault());
        }

        setupTouch() {
            const checkMobile = () => {
                const mobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
                if (mobile && !this.isMobile) {
                    this.isMobile = true;
                    document.getElementById('mobile-controls').style.display = 'flex';
                }
            };
            window.addEventListener('touchstart', checkMobile);
            window.addEventListener('pointerdown', checkMobile);

            // Joystick
            const joyZone = document.getElementById('joystick-zone');
            let joyCenter = { x: 0, y: 0 };
            let joyId = null;
            const joyKnob = document.createElement('div');
            joyKnob.className = 'joystick-knob';
            joyZone.appendChild(joyKnob);

            const resetJoy = () => {
                this.joystick.dx = 0;
                this.joystick.dy = 0;
                this.joystick.active = false;
                joyKnob.style.transform = `translate(-50%, -50%)`;
                joyId = null;
            };

            joyZone.addEventListener('touchstart', (e) => {
                e.preventDefault();
                soundEngine.init();
                const touch = e.changedTouches[0];
                joyId = touch.identifier;
                const rect = joyZone.getBoundingClientRect();
                joyCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
                this.updateJoy(touch);
            }, {passive: false});

            joyZone.addEventListener('touchmove', (e) => {
                e.preventDefault();
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joyId) {
                        this.updateJoy(e.changedTouches[i]);
                    }
                }
            }, {passive: false});

            joyZone.addEventListener('touchend', (e) => {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === joyId) {
                        resetJoy();
                    }
                }
            });
            joyZone.addEventListener('touchcancel', resetJoy);

            // Buttons
            const btnFire = document.getElementById('btn-mobile-fire');
            const btnEcho = document.getElementById('btn-mobile-echo');

            btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); soundEngine.init(); this.fireBtn = true; }, {passive: false});
            btnFire.addEventListener('touchend', (e) => { e.preventDefault(); this.fireBtn = false; }, {passive: false});
            btnEcho.addEventListener('touchstart', (e) => { e.preventDefault(); soundEngine.init(); this.echoBtn = true; }, {passive: false});
            btnEcho.addEventListener('touchend', (e) => { e.preventDefault(); this.echoBtn = false; }, {passive: false});
        }

        updateJoy(touch) {
            this.joystick.active = true;
            let dx = touch.clientX - joyCenter.x;
            let dy = touch.clientY - joyCenter.y;
            const dist = Math.hypot(dx, dy);
            const max = 40; // knob radius freedom
            if (dist > max) {
                dx = (dx / dist) * max;
                dy = (dy / dist) * max;
            }
            this.joystick.dx = dx / max;
            this.joystick.dy = dy / max;
            const joyKnob = document.querySelector('.joystick-knob');
            if (joyKnob) {
                joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
            }
        }

        isDown(code) { return !!this.keys[code]; }
        isFiring() { return this.isDown('Space') || this.mouse.down || this.fireBtn; }
        isEchoing() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this.mouse.rightDown || this.echoBtn; }

        getAimDir(playerX, playerY) {
            if (this.joystick.active) {
                if (this.joystick.dx === 0 && this.joystick.dy === 0) return {x: 1, y: 0};
                const len = Math.hypot(this.joystick.dx, this.joystick.dy);
                return { x: this.joystick.dx/len, y: this.joystick.dy/len };
            } else {
                let dx = this.mouse.x - playerX;
                let dy = this.mouse.y - playerY;
                const len = Math.hypot(dx, dy);
                if (len === 0) return {x: 1, y: 0};
                return {x: dx/len, y: dy/len};
            }
        }
    }

    const input = new InputManager();

    // ----------------------------------------------------------------------
    // GAME ENGINE
    // ----------------------------------------------------------------------

    // ----------------------------------------------------------------------
    // GAME ENTITIES & PHYSICS
    // ----------------------------------------------------------------------
    class Particle {
        constructor(x, y, vx, vy, color, life) {
            this.x = x; this.y = y; this.vx = vx; this.vy = vy;
            this.color = color; this.life = life; this.maxLife = life;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt;
        }
        draw(ctx) {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
            ctx.fillRect(this.x - 2, this.y - 2, 4, 4);
            ctx.globalAlpha = 1.0;
        }
    }

    class Obstacle {
        constructor(x, y, w, h, type) {
            this.x = x; this.y = y; this.w = w; this.h = h;
            this.type = type; // 'wall', 'bumper', 'candy'
        }
        draw(ctx) {
            if (this.type === 'wall') {
                ctx.fillStyle = '#4a2135';
                ctx.fillRect(this.x, this.y, this.w, this.h);
                ctx.strokeStyle = '#b75279';
                ctx.strokeRect(this.x, this.y, this.w, this.h);
            } else if (this.type === 'bumper') {
                ctx.fillStyle = '#ff88aa';
                ctx.beginPath();
                ctx.arc(this.x + this.w/2, this.y + this.h/2, this.w/2, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }

    class Enemy {
        constructor(x, y) {
            this.x = x; this.y = y; this.r = 15;
            this.hp = 3; this.vx = 0; this.vy = 0;
            this.active = true;
        }
        update(dt, playerX, playerY) {
            // Move slowly towards player
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                this.vx = (dx/dist) * 50;
                this.vy = (dy/dist) * 50;
            }
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
        draw(ctx) {
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 5, this.y - 5, 4, 4);
            ctx.fillRect(this.x + 1, this.y - 5, 4, 4);
        }
    }

    class Bullet {
        constructor(x, y, vx, vy, isEcho) {
            this.x = x; this.y = y; this.vx = vx; this.vy = vy;
            this.r = 4; this.active = true; this.isEcho = isEcho;
            this.bounces = 0;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
        draw(ctx) {
            ctx.fillStyle = this.isEcho ? '#5be95e' : '#ffffaa';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fill();
        }
    }


    class Ghost {
        constructor(x, y, recordData) {
            this.x = x; this.y = y; this.r = 12;
            this.recordData = recordData;
            this.frame = 0;
            this.active = true;
            this.vx = 0; this.vy = 0;
        }
        update(dt, engine) {
            if (this.frame >= this.recordData.length) {
                this.active = false;
                engine.spawnParticles(this.x, this.y, '#5be95e', 15, 100);
                return;
            }

            const state = this.recordData[this.frame];
            this.x = state.x;
            this.y = state.y;
            this.vx = state.vx;
            this.vy = state.vy;

            if (state.fired) {
                const b = new Bullet(this.x, this.y, state.aimX * 800, state.aimY * 800, true);
                engine.bullets.push(b);
                soundEngine.sfxFire();
            }
            this.frame++;
        }
        draw(ctx) {
            ctx.fillStyle = '#5be95e';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }

    class Player {
        constructor(x, y) {
            this.x = x; this.y = y; this.r = 12;
            this.vx = 0; this.vy = 0;
            this.cooldown = 0;
            this.hp = 100;
        }
        update(dt) {
            // Friction
            this.vx *= Math.pow(0.5, dt);
            this.vy *= Math.pow(0.5, dt);

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            if (this.cooldown > 0) this.cooldown -= dt;

            // Constrain to bounds (handled loosely here, refined in engine)
        }
        draw(ctx) {
            ctx.fillStyle = '#b75279';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI*2);
            ctx.fill();

            // Eye
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(this.x + this.vx*0.01, this.y + this.vy*0.01, 4, 0, Math.PI*2);
            ctx.fill();
        }
    }

    class GameEngine {
        constructor() {
            this.canvas = document.getElementById('game-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.logicalWidth = 1280;
            this.logicalHeight = 720;

            this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER
            this.lastTime = 0;
            this.reqId = null;

            this.setupResize();
            this.setupUI();

            window.addEventListener('blur', () => {
                if (this.state === 'PLAYING') this.setState('PAUSED');
            });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden && this.state === 'PLAYING') this.setState('PAUSED');
            });
        }

        setupResize() {
            const observer = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const { width, height } = entry.contentRect;
                    this.resize(width, height);
                }
            });
            observer.observe(document.getElementById('game-container'));
        }

        resize(cw, ch) {
            const scale = Math.min(cw / this.logicalWidth, ch / this.logicalHeight);
            const w = this.logicalWidth * scale;
            const h = this.logicalHeight * scale;

            this.canvas.width = w;
            this.canvas.height = h;

            // Center the canvas
            const ox = (cw - w) / 2;
            const oy = (ch - h) / 2;

            input.updateTransform(scale, scale, ox, oy);

            // Set context scale so we can draw in logical coordinates
            this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
            this.ctx.scale(scale, scale);
        }

        setupUI() {
            const get = id => document.getElementById(id);

            // TITLE
            get('title-highscore').innerText = saveManager.data.highScore;
            get('title-milestones').innerText = `${saveManager.data.unlockedMilestones.length}/3`;

            get('btn-play').addEventListener('click', () => { soundEngine.sfxUI(); this.startGame(); });
            get('btn-howto').addEventListener('click', () => { soundEngine.sfxUI(); get('modal-howto').classList.remove('hidden'); });
            get('btn-options').addEventListener('click', () => { soundEngine.sfxUI(); this.openOptions(); });

            // PAUSE
            get('btn-pause').addEventListener('click', () => { soundEngine.sfxUI(); this.setState('PAUSED'); });
            get('btn-resume').addEventListener('click', () => { soundEngine.sfxUI(); this.setState('PLAYING'); });
            get('btn-restart').addEventListener('click', () => { soundEngine.sfxUI(); this.startGame(); });
            get('btn-options-pause').addEventListener('click', () => { soundEngine.sfxUI(); this.openOptions(); });
            get('btn-howto-pause').addEventListener('click', () => { soundEngine.sfxUI(); get('modal-howto').classList.remove('hidden'); });

            // GAMEOVER
            get('btn-play-again').addEventListener('click', () => { soundEngine.sfxUI(); this.startGame(); });
            get('btn-title-return').addEventListener('click', () => { soundEngine.sfxUI(); this.setState('TITLE'); });

            // MODALS
            get('btn-close-howto').addEventListener('click', () => { soundEngine.sfxUI(); get('modal-howto').classList.add('hidden'); });
            get('btn-close-options').addEventListener('click', () => { soundEngine.sfxUI(); get('modal-options').classList.add('hidden'); saveManager.save(); soundEngine.updateVolumes(); });

            // OPTIONS CONTROLS
            const opts = saveManager.data.options;
            get('opt-mute').checked = opts.mute;
            get('opt-sfx').value = opts.sfxVolume;
            get('val-sfx').innerText = opts.sfxVolume;
            get('opt-music').value = opts.musicVolume;
            get('val-music').innerText = opts.musicVolume;
            get('opt-shake').value = opts.shake;
            get('opt-particles').value = opts.particles;

            get('opt-mute').addEventListener('change', e => { opts.mute = e.target.checked; soundEngine.updateVolumes(); });
            get('opt-sfx').addEventListener('input', e => { opts.sfxVolume = e.target.value; get('val-sfx').innerText = e.target.value; soundEngine.updateVolumes(); });
            get('opt-music').addEventListener('input', e => { opts.musicVolume = e.target.value; get('val-music').innerText = e.target.value; soundEngine.updateVolumes(); });
            get('opt-shake').addEventListener('change', e => { opts.shake = parseFloat(e.target.value); });
            get('opt-particles').addEventListener('change', e => { opts.particles = parseFloat(e.target.value); });

            // SAVE MANAGEMENT
            get('btn-export-save').addEventListener('click', () => {
                const exp = get('export-data');
                exp.value = btoa(JSON.stringify(saveManager.data));
                exp.style.display = 'block';
                exp.select();
                document.execCommand('copy');
                alert("Save copied to clipboard!");
            });
            get('btn-import-save').addEventListener('click', () => {
                const data = prompt("Paste your Base64 save data:");
                if (data) {
                    try {
                        const parsed = JSON.parse(atob(data));
                        if (parsed && parsed.options) {
                            saveManager.data = parsed;
                            saveManager.save();
                            alert("Save imported successfully! Reloading...");
                            location.reload();
                        } else { alert("Invalid save data."); }
                    } catch (e) { alert("Failed to parse save data."); }
                }
            });
            let resetClicks = 0;
            get('btn-reset-save').addEventListener('click', (e) => {
                resetClicks++;
                if (resetClicks === 1) {
                    e.target.innerText = "Click again to confirm reset";
                    setTimeout(() => { resetClicks = 0; e.target.innerText = "Reset Save"; }, 3000);
                } else {
                    saveManager.reset();
                    alert("Save reset.");
                    location.reload();
                }
            });
        }

        openOptions() {
            document.getElementById('modal-options').classList.remove('hidden');
        }

        setState(newState) {
            document.querySelectorAll('.screen:not(.modal)').forEach(s => s.classList.remove('active'));
            this.state = newState;

            if (newState === 'TITLE') {
                document.getElementById('screen-title').classList.add('active');
                soundEngine.stopMusic();
                document.getElementById('title-highscore').innerText = saveManager.data.highScore;
            } else if (newState === 'PLAYING') {
                document.getElementById('screen-playing').classList.add('active');
                document.getElementById('screen-paused').classList.remove('active');
                soundEngine.playMusic();
            } else if (newState === 'PAUSED') {
                document.getElementById('screen-playing').classList.add('active');
                document.getElementById('screen-paused').classList.add('active');
                soundEngine.stopMusic();
            } else if (newState === 'GAME_OVER') {
                document.getElementById('screen-gameover').classList.add('active');
                soundEngine.stopMusic();
            }
        }


        checkCircleRect(cx, cy, r, rx, ry, rw, rh) {
            let testX = cx;
            let testY = cy;

            if (cx < rx) testX = rx;
            else if (cx > rx + rw) testX = rx + rw;

            if (cy < ry) testY = ry;
            else if (cy > ry + rh) testY = ry + rh;

            const distX = cx - testX;
            const distY = cy - testY;
            const distance = Math.hypot(distX, distY);

            if (distance <= r) {
                return { hit: true, dx: cx - testX, dy: cy - testY, dist: distance };
            }
            return { hit: false };
        }

        spawnParticles(x, y, color, count, speed) {
            if (saveManager.data.options.particles < 0.5) count = Math.floor(count / 2);
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const v = Math.random() * speed;
                this.particles.push(new Particle(x, y, Math.cos(a)*v, Math.sin(a)*v, color, 0.2 + Math.random()*0.3));
            }
        }

        resolveCollision(entity, obs) {
            if (obs.type === 'wall') {
                const coll = this.checkCircleRect(entity.x, entity.y, entity.r, obs.x, obs.y, obs.w, obs.h);
                if (coll.hit) {
                    // Push out
                    const push = entity.r - coll.dist;
                    let nx = coll.dx === 0 ? 0 : coll.dx / coll.dist;
                    let ny = coll.dy === 0 ? 0 : coll.dy / coll.dist;

                    if (coll.dist === 0) { nx = 1; ny = 0; } // Fallback

                    entity.x += nx * push;
                    entity.y += ny * push;

                    // Bounce
                    const dot = entity.vx * nx + entity.vy * ny;
                    entity.vx -= 2 * dot * nx;
                    entity.vy -= 2 * dot * ny;

                    return true;
                }
            } else if (obs.type === 'bumper') {
                const dx = entity.x - (obs.x + obs.w/2);
                const dy = entity.y - (obs.y + obs.h/2);
                const dist = Math.hypot(dx, dy);
                const minDist = entity.r + obs.w/2;
                if (dist < minDist) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const push = minDist - dist;
                    entity.x += nx * push;
                    entity.y += ny * push;

                    const dot = entity.vx * nx + entity.vy * ny;
                    entity.vx -= 2 * dot * nx;
                    entity.vy -= 2 * dot * ny;

                    // Bumper adds energy
                    entity.vx += nx * 300;
                    entity.vy += ny * 300;

                    return true;
                }
            }
            return false;
        }

        buildLevel() {
            this.obstacles = [];
            // Conveyor belts / walls
            this.obstacles.push(new Obstacle(0, 0, this.logicalWidth, 20, 'wall'));
            this.obstacles.push(new Obstacle(0, this.logicalHeight - 20, this.logicalWidth, 20, 'wall'));
            this.obstacles.push(new Obstacle(0, 0, 20, this.logicalHeight, 'wall'));
            this.obstacles.push(new Obstacle(this.logicalWidth - 20, 0, 20, this.logicalHeight, 'wall'));

            // Middle blockers
            this.obstacles.push(new Obstacle(300, 200, 40, 320, 'wall'));
            this.obstacles.push(new Obstacle(940, 200, 40, 320, 'wall'));

            // Bumpers
            this.obstacles.push(new Obstacle(200, 100, 60, 60, 'bumper'));
            this.obstacles.push(new Obstacle(1020, 100, 60, 60, 'bumper'));
            this.obstacles.push(new Obstacle(200, 560, 60, 60, 'bumper'));
            this.obstacles.push(new Obstacle(1020, 560, 60, 60, 'bumper'));
            this.obstacles.push(new Obstacle(610, 330, 60, 60, 'bumper'));
        }

        startGame() {
            this.player = new Player(this.logicalWidth / 2, this.logicalHeight / 2 + 100);
            this.bullets = [];
            this.enemies = [];
            this.particles = [];
            this.ghosts = [];

            this.recording = [];
            this.isRecording = false;
            this.recordTimer = 0;
            this.echoCooldown = 0;

            this.score = 0;
            this.wave = 1;
            this.combo = 1;
            this.comboTimer = 0;

            this.buildLevel();
            this.spawnWave();

            this.updateHUD();
            this.setState('PLAYING');

            saveManager.data.totalGamesPlayed++;
            saveManager.save();
        }

        spawnWave() {
            const count = 3 + this.wave * 2;
            for (let i = 0; i < count; i++) {
                let x = Math.random() * (this.logicalWidth - 100) + 50;
                let y = Math.random() * 200 + 50;
                this.enemies.push(new Enemy(x, y));
            }
        }

        endGame() {
            this.setState('GAME_OVER');

            if (this.score > saveManager.data.highScore) {
                saveManager.data.highScore = this.score;
                document.getElementById('go-highscore-banner').style.display = 'block';
            } else {
                document.getElementById('go-highscore-banner').style.display = 'none';
            }
            saveManager.data.totalScoreAccumulated += this.score;

            // Check milestones
            if (this.score >= 10000 && !saveManager.data.unlockedMilestones.includes('Score10k')) {
                saveManager.data.unlockedMilestones.push('Score10k');
            }
            if (this.wave >= 5 && !saveManager.data.unlockedMilestones.includes('Wave5')) {
                saveManager.data.unlockedMilestones.push('Wave5');
            }
            if (this.combo >= 10 && !saveManager.data.unlockedMilestones.includes('Combo10')) {
                saveManager.data.unlockedMilestones.push('Combo10');
            }

            saveManager.save();

            document.getElementById('go-score').innerText = this.score;
            document.getElementById('go-wave').innerText = this.wave;
        }

        loop(time) {
            this.reqId = requestAnimationFrame((t) => this.loop(t));
            const dt = Math.min((time - this.lastTime) / 1000, 0.1);
            this.lastTime = time;

            this.update(dt);
            this.draw();
        }

        addScore(amount) {
            this.score += amount * this.combo;
            this.combo++;
            this.comboTimer = 3.0; // 3 seconds to keep combo
            this.updateHUD();
        }

        updateHUD() {
            document.getElementById('hud-score').innerText = `Score: ${this.score}`;
            document.getElementById('hud-wave').innerText = `Wave: ${this.wave}`;
            document.getElementById('hud-health').innerText = `HP: ${Math.floor(this.player.hp)}`;
            document.getElementById('hud-combo').innerText = this.combo;
        }

        update(dt) {
            if (this.state !== 'PLAYING') return;

            // Combo timer
            if (this.comboTimer > 0) {
                this.comboTimer -= dt;
                document.getElementById('combo-bar').style.width = `${(this.comboTimer / 3.0) * 100}%`;
                if (this.comboTimer <= 0) {
                    this.combo = 1;
                    this.updateHUD();
                }
            }

            // Echo logic
            if (this.echoCooldown > 0) this.echoCooldown -= dt;

            if (input.isEchoing() && this.echoCooldown <= 0) {
                if (!this.isRecording) {
                    // Start recording
                    this.isRecording = true;
                    this.recording = [];
                    this.recordTimer = 5.0; // max 5 seconds
                    soundEngine.sfxEcho();
                }
            }

            let firedThisFrame = false;
            let aimDir = {x:0,y:0};

            // Player Input
            if (input.isFiring() && this.player.cooldown <= 0) {
                aimDir = input.getAimDir(this.player.x, this.player.y);
                const b = new Bullet(this.player.x, this.player.y, aimDir.x * 800, aimDir.y * 800, false);
                this.bullets.push(b);

                // Recoil!
                this.player.vx -= aimDir.x * 600;
                this.player.vy -= aimDir.y * 600;

                this.player.cooldown = 0.15;
                soundEngine.sfxFire();
                this.spawnParticles(this.player.x, this.player.y, '#ffffaa', 5, 200);
                firedThisFrame = true;
            }

            // Recording
            if (this.isRecording) {
                this.recordTimer -= dt;
                this.recording.push({
                    x: this.player.x, y: this.player.y,
                    vx: this.player.vx, vy: this.player.vy,
                    fired: firedThisFrame, aimX: aimDir.x, aimY: aimDir.y
                });
                if (!input.isEchoing() || this.recordTimer <= 0) {
                    // Stop and spawn ghost
                    this.isRecording = false;
                    this.ghosts.push(new Ghost(this.recording[0].x, this.recording[0].y, [...this.recording]));
                    this.echoCooldown = 2.0;
                    soundEngine.sfxEcho();
                }
            }

            // Update entities
            this.player.update(dt);
            for (let obs of this.obstacles) {
                if (this.resolveCollision(this.player, obs)) {
                    if (obs.type === 'bumper') {
                        soundEngine.sfxBounce();
                        this.spawnParticles(obs.x+obs.w/2, obs.y+obs.h/2, '#ff88aa', 10, 300);
                    }
                }
            }

            // Screen bounds clamp fallback
            if (this.player.x < 12) { this.player.x = 12; this.player.vx *= -0.5; }
            if (this.player.x > this.logicalWidth - 12) { this.player.x = this.logicalWidth - 12; this.player.vx *= -0.5; }
            if (this.player.y < 12) { this.player.y = 12; this.player.vy *= -0.5; }
            if (this.player.y > this.logicalHeight - 12) { this.player.y = this.logicalHeight - 12; this.player.vy *= -0.5; }

            for (let g of this.ghosts) {
                g.update(dt, this);
            }
            this.ghosts = this.ghosts.filter(g => g.active);

            for (let b of this.bullets) {
                b.update(dt);
                // Obstacle collisions
                for (let obs of this.obstacles) {
                    if (obs.type === 'wall' && b.x > obs.x && b.x < obs.x+obs.w && b.y > obs.y && b.y < obs.y+obs.h) {
                        b.active = false;
                        this.spawnParticles(b.x, b.y, b.isEcho?'#5be95e':'#ffffaa', 3, 100);
                    }
                    if (obs.type === 'bumper') {
                        const dx = b.x - (obs.x + obs.w/2);
                        const dy = b.y - (obs.y + obs.h/2);
                        if (Math.hypot(dx, dy) < obs.w/2 + b.r) {
                            // Bounce bullet
                            const nx = dx / Math.hypot(dx, dy);
                            const ny = dy / Math.hypot(dx, dy);
                            const dot = b.vx * nx + b.vy * ny;
                            b.vx -= 2 * dot * nx;
                            b.vy -= 2 * dot * ny;
                            b.bounces++;
                            soundEngine.sfxBounce();
                            if (b.bounces > 3) b.active = false; // Limit bounces
                        }
                    }
                }
            }

            // Enemies
            for (let e of this.enemies) {
                e.update(dt, this.player.x, this.player.y);

                // Avoid walls simply
                for (let obs of this.obstacles) {
                    if (obs.type === 'wall' && e.x > obs.x-e.r && e.x < obs.x+obs.w+e.r && e.y > obs.y-e.r && e.y < obs.y+obs.h+e.r) {
                        e.vx *= -1; e.vy *= -1;
                        e.x += e.vx * dt * 2; e.y += e.vy * dt * 2;
                    }
                }

                // Player collision
                if (Math.hypot(this.player.x - e.x, this.player.y - e.y) < this.player.r + e.r) {
                    this.player.hp -= 20;
                    this.player.vx += (this.player.x - e.x) * 10;
                    this.player.vy += (this.player.y - e.y) * 10;
                    e.x -= (this.player.x - e.x);
                    e.y -= (this.player.y - e.y);
                    soundEngine.sfxHit();
                    this.updateHUD();
                    if (this.player.hp <= 0) {
                        this.endGame();
                        return;
                    }
                }

                // Bullet collision
                for (let b of this.bullets) {
                    if (b.active && Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
                        b.active = false;
                        e.hp -= b.isEcho ? 2 : 1; // Echoes do more damage!
                        this.spawnParticles(b.x, b.y, b.isEcho?'#5be95e':'#ff3333', 5, 150);
                        soundEngine.sfxHit();
                        if (e.hp <= 0) {
                            e.active = false;
                            this.addScore(100);
                            soundEngine.sfxDestroy();
                            this.spawnParticles(e.x, e.y, '#ff3333', 20, 200);
                        }
                    }
                }
            }

            this.bullets = this.bullets.filter(b => b.active && b.x > 0 && b.x < this.logicalWidth && b.y > 0 && b.y < this.logicalHeight);
            this.enemies = this.enemies.filter(e => e.active);

            if (this.enemies.length === 0) {
                this.wave++;
                this.player.hp = Math.min(100, this.player.hp + 20); // Heal
                this.updateHUD();
                this.spawnWave();
            }

            for (let p of this.particles) p.update(dt);
            this.particles = this.particles.filter(p => p.life > 0);
        }

        draw() {
            // Clear logical area
            this.ctx.fillStyle = '#1a1520';
            this.ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);

            if (this.state === 'TITLE') {
                 // Title bg effects
                 this.ctx.fillStyle = '#b75279';
                 this.ctx.globalAlpha = 0.3;
                 for(let i=0; i<5; i++) {
                     this.ctx.beginPath();
                     this.ctx.arc(this.logicalWidth/2 + Math.sin(Date.now()/1000 + i)*200,
                                  this.logicalHeight/2 + Math.cos(Date.now()/800 + i)*150,
                                  Math.sin(Date.now()/500 + i)*50 + 100, 0, Math.PI*2);
                     this.ctx.fill();
                 }
                 this.ctx.globalAlpha = 1.0;
                 return;
            }

            // Conveyor belt background effect
            this.ctx.strokeStyle = '#331a25';
            this.ctx.lineWidth = 2;
            const offset = (performance.now() / 20) % 40;
            this.ctx.beginPath();
            for (let y = offset; y < this.logicalHeight; y += 40) {
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.logicalWidth, y);
            }
            this.ctx.stroke();

            // Draw entities
            for (let obs of this.obstacles) obs.draw(this.ctx);
            for (let g of this.ghosts) g.draw(this.ctx);
            for (let p of this.particles) p.draw(this.ctx);
            for (let b of this.bullets) b.draw(this.ctx);
            for (let e of this.enemies) e.draw(this.ctx);

            if (this.state === 'PLAYING' || this.state === 'PAUSED' || this.state === 'GAME_OVER') {
                this.player.draw(this.ctx);
            }

            // Draw recording indicator
            if (this.isRecording) {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.beginPath();
                this.ctx.arc(this.player.x, this.player.y - 25, 5, 0, Math.PI*2);
                this.ctx.fill();

                // Arc timer
                this.ctx.strokeStyle = '#ff0000';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(this.player.x, this.player.y - 25, 10, -Math.PI/2, -Math.PI/2 + (this.recordTimer/5.0) * Math.PI*2);
                this.ctx.stroke();
            }
        }

        start() {
            this.setState('TITLE');
            this.lastTime = performance.now();
            this.reqId = requestAnimationFrame((t) => this.loop(t));
        }
    }

    const engine = new GameEngine();
    engine.start();

});
