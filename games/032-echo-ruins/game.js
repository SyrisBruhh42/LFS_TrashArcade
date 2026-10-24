window.addEventListener('DOMContentLoaded', () => {
    const LOGICAL_WIDTH = 1280;
    const LOGICAL_HEIGHT = 720;

    const engine = {
        canvas: document.getElementById('gameCanvas'),
        ctx: document.getElementById('gameCanvas').getContext('2d'),
        container: document.getElementById('game-container'),
        uiLayer: document.getElementById('ui-layer'),
        scale: 1.0,
        offsetX: 0,
        offsetY: 0
    };
    engine.canvas.width = LOGICAL_WIDTH;
    engine.canvas.height = LOGICAL_HEIGHT;

    // --- SaveManager ---
    class SaveManager {
        constructor() {
            this.key = 'arcade_game_032_032-echo-ruins_v1';
            this.data = {
                highScore: 0,
                bestWaveOrCombo: 0,
                totalGamesPlayed: 0,
                totalScoreAccumulated: 0,
                unlockedMilestones: [],
                options: {
                    masterMute: false,
                    sfxVolume: 100,
                    musicVolume: 100,
                    screenShake: '100%',
                    particles: 'High',
                    palette: 'Default',
                    showFPS: false,
                    touchControls: 'Auto'
                }
            };
            this.load();
        }
        load() {
            try {
                const stored = localStorage.getItem(this.key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
                }
            } catch (e) {
                console.warn('localStorage load failed', e);
            }
        }
        save() {
            try {
                localStorage.setItem(this.key, JSON.stringify(this.data));
            } catch (e) {
                console.warn('localStorage save failed', e);
            }
        }
        reset() {
            try {
                localStorage.removeItem(this.key);
            } catch (e) {
                console.warn('localStorage remove failed', e);
            }
            this.data = {
                highScore: 0,
                bestWaveOrCombo: 0,
                totalGamesPlayed: 0,
                totalScoreAccumulated: 0,
                unlockedMilestones: [],
                options: this.data.options
            };
            this.save();
        }
        exportSave() { return btoa(JSON.stringify(this.data)); }
        importSave(base64str) {
            try {
                const parsed = JSON.parse(atob(base64str));
                if (parsed && typeof parsed === 'object') {
                    this.data = { ...this.data, ...parsed, options: { ...this.data.options, ...(parsed.options || {}) } };
                    this.save();
                    return true;
                }
            } catch(e) { console.warn('Import failed', e); }
            return false;
        }
    }
    const saveManager = new SaveManager();

    // --- Subsystems ---
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            const rect = entry.contentRect;
            const ratio = LOGICAL_WIDTH / LOGICAL_HEIGHT;
            const containerRatio = rect.width / rect.height;
            let finalWidth, finalHeight;
            if (containerRatio > ratio) {
                finalHeight = rect.height;
                finalWidth = finalHeight * ratio;
            } else {
                finalWidth = rect.width;
                finalHeight = finalWidth / ratio;
            }
            engine.scale = finalWidth / LOGICAL_WIDTH;
            engine.canvas.style.width = finalWidth + 'px';
            engine.canvas.style.height = finalHeight + 'px';
            engine.canvas.style.position = 'absolute';
            engine.canvas.style.left = (rect.width - finalWidth) / 2 + 'px';
            engine.canvas.style.top = (rect.height - finalHeight) / 2 + 'px';
            const bcr = engine.canvas.getBoundingClientRect();
            engine.offsetX = bcr.left;
            engine.offsetY = bcr.top;
        }
    });
    resizeObserver.observe(engine.container);

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    class SoundEngine {
        constructor() {
            this.ctx = audioCtx;
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);
            this.updateVolumes();
        }
        updateVolumes() {
            if (saveManager.data.options.masterMute) {
                this.masterGain.gain.value = 0;
            } else {
                this.masterGain.gain.value = 1.0;
            }
            this.sfxGain.gain.value = saveManager.data.options.sfxVolume / 100;
            this.musicGain.gain.value = saveManager.data.options.musicVolume / 100;
        }
        resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
        playTone(freq, type, duration, vol=1.0) {
            if (saveManager.data.options.masterMute) return;
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
        playGrappleShoot() { this.playTone(600, 'square', 0.1, 0.5); }
        playGrappleHit() { this.playTone(300, 'triangle', 0.15, 0.8); }
        playDamage() { this.playTone(150, 'sawtooth', 0.3, 0.8); }
    }
    const soundEngine = new SoundEngine();

    const input = {
        keys: {},
        mouse: { x: 0, y: 0, down: false, justPressed: false, justReleased: false },
        touches: [],
        touchControlsActive: false
    };

    window.addEventListener('keydown', e => { input.keys[e.code] = true; soundEngine.resume(); });
    window.addEventListener('keyup', e => { input.keys[e.code] = false; });

    function getLogicalPos(clientX, clientY) {
        return {
            x: (clientX - engine.offsetX) / engine.scale,
            y: (clientY - engine.offsetY) / engine.scale
        };
    }

    window.addEventListener('mousemove', e => {
        const pos = getLogicalPos(e.clientX, e.clientY);
        input.mouse.x = pos.x;
        input.mouse.y = pos.y;
    });
    window.addEventListener('mousedown', e => {
        input.mouse.down = true;
        input.mouse.justPressed = true;
        soundEngine.resume();
    });
    window.addEventListener('mouseup', e => {
        input.mouse.down = false;
        input.mouse.justReleased = true;
    });
    window.addEventListener('touchstart', e => {
        if (e.target !== engine.canvas && e.target !== engine.uiLayer) return;
        e.preventDefault();
        input.touchControlsActive = true;
        input.mouse.down = true;
        input.mouse.justPressed = true;
        soundEngine.resume();
        const t = e.changedTouches[0];
        const pos = getLogicalPos(t.clientX, t.clientY);
        input.mouse.x = pos.x;
        input.mouse.y = pos.y;
    }, {passive: false});
    window.addEventListener('touchmove', e => {
        if (e.target !== engine.canvas && e.target !== engine.uiLayer) return;
        e.preventDefault();
        const t = e.changedTouches[0];
        const pos = getLogicalPos(t.clientX, t.clientY);
        input.mouse.x = pos.x;
        input.mouse.y = pos.y;
    }, {passive: false});
    window.addEventListener('touchend', e => {
        if (e.target !== engine.canvas && e.target !== engine.uiLayer) return;
        e.preventDefault();
        input.mouse.down = false;
        input.mouse.justReleased = true;
    }, {passive: false});
    window.addEventListener('pointerdown', e => {});

    // --- UI State Machine ---
    const GameState = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAME_OVER: 3 };
    let currentState = GameState.TITLE;
    // Read-only state observation for the trusted browser acceptance harness.
    Object.defineProperty(window, 'arcadeState', {get: () => Object.keys(GameState).find(key => GameState[key] === currentState)});
    let wave = 1;
    let score = 0;

    function resetGame() {
        score = 0;
        wave = 1;
        player.reset();
        arena.reset();
        grapple.reset();
        particles = [];
    }

    function drawButton(ctx, text, x, y, w, h, hover) {
        ctx.fillStyle = hover ? '#ffffff' : (saveManager.data.options.palette === 'HighContrast' ? '#fff' : '#ddcc73');
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#000000';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w/2, y + h/2);
    }

    function inRect(mx, my, x, y, w, h) {
        return mx >= x && mx <= x + w && my >= y && my <= y + h;
    }

    let btnPlayRect = {x: LOGICAL_WIDTH/2 - 100, y: LOGICAL_HEIGHT/2 - 30, w: 200, h: 60};
    let btnOptionsRect = {x: LOGICAL_WIDTH/2 - 100, y: LOGICAL_HEIGHT/2 + 50, w: 200, h: 60};
    let btnResumeRect = {x: LOGICAL_WIDTH/2 - 100, y: LOGICAL_HEIGHT/2 - 60, w: 200, h: 60};
    let btnQuitRect = {x: LOGICAL_WIDTH/2 - 100, y: LOGICAL_HEIGHT/2 + 20, w: 200, h: 60};

    let btnPlayHover = false;
    let btnOptionsHover = false;
    let btnResumeHover = false;
    let btnQuitHover = false;

    function updateUI(dt) {
        btnPlayHover = false;
        btnOptionsHover = false;
        btnResumeHover = false;
        btnQuitHover = false;

        if (currentState === GameState.TITLE || currentState === GameState.GAME_OVER) {
            if (inRect(input.mouse.x, input.mouse.y, btnPlayRect.x, btnPlayRect.y, btnPlayRect.w, btnPlayRect.h)) {
                btnPlayHover = true;
                if (input.mouse.justReleased) { resetGame(); currentState = GameState.PLAYING; }
            }
            if (inRect(input.mouse.x, input.mouse.y, btnOptionsRect.x, btnOptionsRect.y, btnOptionsRect.w, btnOptionsRect.h)) {
                btnOptionsHover = true;
                if (input.mouse.justReleased) toggleOptionsModal();
            }
        }

        if (currentState === GameState.PAUSED) {
            if (inRect(input.mouse.x, input.mouse.y, btnResumeRect.x, btnResumeRect.y, btnResumeRect.w, btnResumeRect.h)) {
                btnResumeHover = true;
                if (input.mouse.justReleased) currentState = GameState.PLAYING;
            }
            if (inRect(input.mouse.x, input.mouse.y, btnQuitRect.x, btnQuitRect.y, btnQuitRect.w, btnQuitRect.h)) {
                btnQuitHover = true;
                if (input.mouse.justReleased) currentState = GameState.TITLE;
            }
        }

        if (currentState === GameState.PLAYING && input.keys['Escape']) {
            input.keys['Escape'] = false;
            currentState = GameState.PAUSED;
        }
    }

    function drawUI(ctx) {
        if (currentState === GameState.TITLE) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
            ctx.fillStyle = saveManager.data.options.palette === 'HighContrast' ? '#fff' : '#ddcc73';
            ctx.font = '64px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('ECHO RUINS', LOGICAL_WIDTH/2, LOGICAL_HEIGHT/4);
            ctx.font = '24px sans-serif';
            ctx.fillStyle = '#aaa';
            ctx.fillText('High Score: ' + saveManager.data.highScore, LOGICAL_WIDTH/2, LOGICAL_HEIGHT/4 + 40);
            drawButton(ctx, 'Play', btnPlayRect.x, btnPlayRect.y, btnPlayRect.w, btnPlayRect.h, btnPlayHover);
            drawButton(ctx, 'Options', btnOptionsRect.x, btnOptionsRect.y, btnOptionsRect.w, btnOptionsRect.h, btnOptionsHover);
        }

        if (currentState === GameState.PAUSED) {
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
            ctx.fillStyle = saveManager.data.options.palette === 'HighContrast' ? '#fff' : '#ddcc73';
            ctx.font = '48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', LOGICAL_WIDTH/2, LOGICAL_HEIGHT/4);
            drawButton(ctx, 'Resume', btnResumeRect.x, btnResumeRect.y, btnResumeRect.w, btnResumeRect.h, btnResumeHover);
            drawButton(ctx, 'Quit to Title', btnQuitRect.x, btnQuitRect.y, btnQuitRect.w, btnQuitRect.h, btnQuitHover);
        }

        if (currentState === GameState.GAME_OVER) {
            ctx.fillStyle = 'rgba(100,0,0,0.6)';
            ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
            ctx.fillStyle = '#fff';
            ctx.font = '48px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', LOGICAL_WIDTH/2, LOGICAL_HEIGHT/4);
            ctx.font = '24px sans-serif';
            ctx.fillText('Score: ' + Math.floor(score), LOGICAL_WIDTH/2, LOGICAL_HEIGHT/4 + 40);
            drawButton(ctx, 'Play Again', btnPlayRect.x, btnPlayRect.y, btnPlayRect.w, btnPlayRect.h, btnPlayHover);
            drawButton(ctx, 'Title Screen', btnOptionsRect.x, btnOptionsRect.y, btnOptionsRect.w, btnOptionsRect.h, btnOptionsHover);
        }

        if (currentState === GameState.PLAYING) {
            ctx.fillStyle = '#fff';
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Score: ' + Math.floor(score), 20, 30);
            ctx.textAlign = 'right';
            ctx.fillText('Wave: ' + wave, LOGICAL_WIDTH - 20, 30);

            ctx.fillStyle = '#aaa';
            ctx.fillRect(LOGICAL_WIDTH - 50, LOGICAL_HEIGHT - 50, 40, 40);
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('II', LOGICAL_WIDTH - 30, LOGICAL_HEIGHT - 30);

            if (inRect(input.mouse.x, input.mouse.y, LOGICAL_WIDTH - 50, LOGICAL_HEIGHT - 50, 40, 40) && input.mouse.justReleased) {
                currentState = GameState.PAUSED;
            }
        }
    }

    window.addEventListener('blur', () => { if (currentState === GameState.PLAYING) currentState = GameState.PAUSED; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && currentState === GameState.PLAYING) currentState = GameState.PAUSED; });

    // --- Options Modal ---
    const optionsModal = document.createElement('div');
    optionsModal.style.position = 'absolute';
    optionsModal.style.top = '10%';
    optionsModal.style.left = '20%';
    optionsModal.style.width = '60%';
    optionsModal.style.height = '80%';
    optionsModal.style.backgroundColor = 'rgba(20,20,20,0.95)';
    optionsModal.style.border = '2px solid #ddcc73';
    optionsModal.style.color = '#fff';
    optionsModal.style.display = 'none';
    optionsModal.style.flexDirection = 'column';
    optionsModal.style.padding = '20px';
    optionsModal.style.boxSizing = 'border-box';
    optionsModal.style.overflowY = 'auto';
    optionsModal.style.zIndex = '100';
    engine.uiLayer.appendChild(optionsModal);

    optionsModal.innerHTML = `
        <h2 style="text-align:center; margin-top:0;">Options</h2>
        <label><input type="checkbox" id="optMute"> Master Mute</label><br>
        <label>SFX Vol: <input type="range" id="optSfx" min="0" max="100"></label><br>
        <label>Music Vol: <input type="range" id="optMusic" min="0" max="100"></label><br>
        <label>Screen Shake: <select id="optShake"><option value="100%">100%</option><option value="50%">50%</option><option value="Off">Off</option></select></label><br>
        <label>Particles: <select id="optPart"><option value="High">High</option><option value="Low">Low</option></select></label><br>
        <label>Palette: <select id="optPal"><option value="Default">Default</option><option value="HighContrast">HighContrast</option></select></label><br>
        <hr>
        <button id="btnExport">Export Save</button>
        <textarea id="txtExport" rows="2" style="width:100%; display:none;"></textarea>
        <button id="btnImport">Import Save</button>
        <button id="btnReset">Reset Save</button>
        <div style="flex-grow:1;"></div>
        <button id="btnCloseOptions" style="padding:10px; font-size:18px;">Close</button>
    `;

    function toggleOptionsModal() {
        if (optionsModal.style.display === 'none') {
            optionsModal.style.display = 'flex';
            document.getElementById('optMute').checked = saveManager.data.options.masterMute;
            document.getElementById('optSfx').value = saveManager.data.options.sfxVolume;
            document.getElementById('optMusic').value = saveManager.data.options.musicVolume;
            document.getElementById('optShake').value = saveManager.data.options.screenShake;
            document.getElementById('optPart').value = saveManager.data.options.particles;
            document.getElementById('optPal').value = saveManager.data.options.palette;
        } else {
            optionsModal.style.display = 'none';
        }
    }

    document.getElementById('btnCloseOptions').addEventListener('click', toggleOptionsModal);
    document.getElementById('optMute').addEventListener('change', e => { saveManager.data.options.masterMute = e.target.checked; saveManager.save(); soundEngine.updateVolumes(); });
    document.getElementById('optSfx').addEventListener('input', e => { saveManager.data.options.sfxVolume = e.target.value; saveManager.save(); soundEngine.updateVolumes(); });
    document.getElementById('optMusic').addEventListener('input', e => { saveManager.data.options.musicVolume = e.target.value; saveManager.save(); soundEngine.updateVolumes(); });
    document.getElementById('optShake').addEventListener('change', e => { saveManager.data.options.screenShake = e.target.value; saveManager.save(); });
    document.getElementById('optPart').addEventListener('change', e => { saveManager.data.options.particles = e.target.value; saveManager.save(); });
    document.getElementById('optPal').addEventListener('change', e => { saveManager.data.options.palette = e.target.value; saveManager.save(); });

    document.getElementById('btnExport').addEventListener('click', () => {
        const txt = document.getElementById('txtExport');
        txt.value = saveManager.exportSave();
        txt.style.display = 'block';
        txt.select();
        document.execCommand('copy');
        document.getElementById('btnExport').innerText = 'Copied!';
        setTimeout(() => document.getElementById('btnExport').innerText = 'Export Save', 2000);
    });
    document.getElementById('btnImport').addEventListener('click', () => {
        const str = prompt('Paste base64 save string:');
        if (str && saveManager.importSave(str)) {
            alert('Save imported.');
            toggleOptionsModal(); toggleOptionsModal();
        } else if (str) { alert('Invalid save string.'); }
    });

    let resetConfirm = false;
    document.getElementById('btnReset').addEventListener('click', () => {
        if (!resetConfirm) {
            resetConfirm = true;
            document.getElementById('btnReset').innerText = 'Click again to confirm reset';
            setTimeout(() => { resetConfirm = false; document.getElementById('btnReset').innerText = 'Reset Save'; }, 3000);
        } else {
            saveManager.reset();
            alert('Save reset.');
            resetConfirm = false;
            document.getElementById('btnReset').innerText = 'Reset Save';
            toggleOptionsModal(); toggleOptionsModal();
        }
    });

    // --- Game Logic ---
    class Player {
        constructor() {
            this.x = LOGICAL_WIDTH / 2;
            this.y = LOGICAL_HEIGHT / 2;
            this.vx = 0;
            this.vy = 0;
            this.radius = 15;
            this.gravity = 800;
            this.friction = 0.99;
            this.maxSpeed = 1500;
        }
        reset() {
            this.x = LOGICAL_WIDTH / 2;
            this.y = LOGICAL_HEIGHT / 2;
            this.vx = 0;
            this.vy = 0;
        }
        update(dt) {
            // Check WASD/Arrows to swing/move in air a bit
            let ax = 0;
            if (input.keys['KeyA'] || input.keys['ArrowLeft']) ax -= 400;
            if (input.keys['KeyD'] || input.keys['ArrowRight']) ax += 400;
            if (input.keys['KeyW'] || input.keys['ArrowUp']) this.vy -= 200 * dt; // small vertical boost

            this.vx += ax * dt;
            this.vy += this.gravity * dt;

            this.vx *= this.friction;
            this.vy *= this.friction;

            const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
            if (speed > this.maxSpeed) {
                this.vx = (this.vx/speed) * this.maxSpeed;
                this.vy = (this.vy/speed) * this.maxSpeed;
            }

            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
        draw(ctx) {
            ctx.fillStyle = saveManager.data.options.palette === 'HighContrast' ? '#fff' : '#b363d7';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const player = new Player();

    class Arena {
        constructor() { this.reset(); }
        reset() {
            this.time = 0;
            this.baseWidth = 1000;
            this.baseHeight = 600;
            this.bounds = {
                left: (LOGICAL_WIDTH - this.baseWidth) / 2,
                right: LOGICAL_WIDTH - (LOGICAL_WIDTH - this.baseWidth) / 2,
                top: (LOGICAL_HEIGHT - this.baseHeight) / 2,
                bottom: LOGICAL_HEIGHT - (LOGICAL_HEIGHT - this.baseHeight) / 2
            };
        }
        update(dt) {
            this.time += dt;
            const shrinkFactor = Math.min(this.time * 3, 450);

            this.bounds.left = (LOGICAL_WIDTH - this.baseWidth) / 2 + shrinkFactor;
            this.bounds.right = LOGICAL_WIDTH - (LOGICAL_WIDTH - this.baseWidth) / 2 - shrinkFactor;
            this.bounds.top = (LOGICAL_HEIGHT - this.baseHeight) / 2 + shrinkFactor * 0.6;
            this.bounds.bottom = LOGICAL_HEIGHT - (LOGICAL_HEIGHT - this.baseHeight) / 2 - shrinkFactor * 0.6;

            if (player.x - player.radius < this.bounds.left) { player.x = this.bounds.left + player.radius; player.vx *= -0.5; }
            if (player.x + player.radius > this.bounds.right) { player.x = this.bounds.right - player.radius; player.vx *= -0.5; }
            if (player.y - player.radius < this.bounds.top) { player.y = this.bounds.top + player.radius; player.vy *= -0.5; }
            if (player.y + player.radius > this.bounds.bottom) {
                soundEngine.playDamage();
                if (score > saveManager.data.highScore) saveManager.data.highScore = Math.floor(score);
                saveManager.data.totalGamesPlayed++;
                saveManager.data.totalScoreAccumulated += Math.floor(score);
                saveManager.save();
                currentState = GameState.GAME_OVER;
            }
            wave = Math.floor(this.time / 10) + 1;
        }
        draw(ctx) {
            ctx.strokeStyle = saveManager.data.options.palette === 'HighContrast' ? '#fff' : '#4a5e28';
            ctx.lineWidth = 10;
            ctx.strokeRect(this.bounds.left, this.bounds.top, this.bounds.right - this.bounds.left, this.bounds.bottom - this.bounds.top);

            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, LOGICAL_WIDTH, this.bounds.top);
            ctx.fillRect(0, this.bounds.bottom, LOGICAL_WIDTH, LOGICAL_HEIGHT - this.bounds.bottom);
            ctx.fillRect(0, this.bounds.top, this.bounds.left, this.bounds.bottom - this.bounds.top);
            ctx.fillRect(this.bounds.right, this.bounds.top, LOGICAL_WIDTH - this.bounds.right, this.bounds.bottom - this.bounds.top);
        }
    }
    const arena = new Arena();

    class Grapple {
        constructor() {
            this.active = false;
            this.x = 0;
            this.y = 0;
            this.springConstant = 5;
        }
        reset() { this.active = false; }
        update(dt) {
            if (input.mouse.justPressed) {
                this.x = input.mouse.x;
                this.y = input.mouse.y;
                if (this.x < arena.bounds.left || this.x > arena.bounds.right || this.y < arena.bounds.top || this.y > arena.bounds.bottom) {
                    this.active = true;
                    soundEngine.playGrappleHit();
                    if (saveManager.data.options.particles !== 'Off') {
                        let count = saveManager.data.options.particles === 'High' ? 10 : 5;
                        for(let i=0; i<count; i++) particles.push(new Particle(this.x, this.y, '#ddcc73'));
                    }
                } else {
                    soundEngine.playGrappleShoot();
                }
            }
            if (input.mouse.justReleased) this.active = false;

            if (this.active) {
                const dx = this.x - player.x;
                const dy = this.y - player.y;
                const distance = Math.sqrt(dx*dx + dy*dy);

                if (distance > 50) {
                    const force = this.springConstant * distance;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    player.vx += fx * dt;
                    player.vy += fy * dt;
                }
                score += 10 * dt;
            }
        }
        draw(ctx) {
            if (this.active) {
                ctx.strokeStyle = saveManager.data.options.palette === 'HighContrast' ? '#fff' : '#ddcc73';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(player.x, player.y);
                ctx.lineTo(this.x, this.y);
                ctx.stroke();
                ctx.fillStyle = ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(this.x, this.y, 5, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }
    const grapple = new Grapple();

    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 200;
            this.vy = (Math.random() - 0.5) * 200;
            this.life = 1.0;
            this.color = color;
        }
        update(dt) {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.life -= dt * 2;
        }
        draw(ctx) {
            ctx.globalAlpha = Math.max(0, this.life);
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, 4, 4);
            ctx.globalAlpha = 1.0;
        }
    }
    let particles = [];

    function updateGame(dt) {
        player.update(dt);
        arena.update(dt);
        grapple.update(dt);
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update(dt);
            if (particles[i].life <= 0) particles.splice(i, 1);
        }
    }

    function drawGame(ctx) {
        let grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_HEIGHT);
        if (saveManager.data.options.palette === 'HighContrast') {
            grad.addColorStop(0, '#000');
            grad.addColorStop(1, '#333');
        } else {
            grad.addColorStop(0, '#1a2421');
            grad.addColorStop(1, '#0c120e');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        arena.draw(ctx);
        grapple.draw(ctx);
        player.draw(ctx);

        if (saveManager.data.options.particles !== 'Off') {
            for (let p of particles) p.draw(ctx);
        }
    }

    // --- Main Loop ---
    let lastTime = 0;
    function gameLoop(now) {
        requestAnimationFrame(gameLoop);
        let dt = (now - lastTime) / 1000;
        if (dt > 0.1) dt = 0.1;
        lastTime = now;

        updateUI(dt);
        if (currentState === GameState.PLAYING) updateGame(dt);

        engine.ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        if (currentState === GameState.PLAYING || currentState === GameState.PAUSED || currentState === GameState.GAME_OVER) {
            drawGame(engine.ctx);
        }

        drawUI(engine.ctx);

        input.mouse.justPressed = false;
        input.mouse.justReleased = false;
    }

    requestAnimationFrame(now => {
        lastTime = now;
        gameLoop(now);
    });
});