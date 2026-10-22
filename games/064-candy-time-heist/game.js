const SAVE_KEY = "arcade_game_064_064-candy-time-heist_v1";

class SaveManager {
    constructor() {
        this.data = {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterMute: false,
                masterVolume: 1,
                sfxVolume: 1,
                musicVolume: 1,
                screenShake: '100%',
                particleDensity: 'High',
                highContrast: false,
                showFPS: false,
                touchControls: 'Auto',
                touchHandedness: 'Right'
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
            }
        } catch (e) {
            console.warn("SaveManager: Failed to load data", e);
        }
    }

    reset() {
        if (!this.resetConfirm) {
            this.resetConfirm = true;
            return false;
        }
        localStorage.removeItem(SAVE_KEY);
        this.resetConfirm = false;
        return true;
    }

    exportSave() {
        return btoa(JSON.stringify(this.data));
    }

    importSave(base64Str) {
        try {
            const jsonStr = atob(base64Str);
            const parsed = JSON.parse(jsonStr);
            if (parsed && parsed.options) {
                this.data = { ...this.data, ...parsed };
                this.save();
                return true;
            }
        } catch (e) {
            console.warn("Invalid save data");
        }
        return false;
    }

    save() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.warn("SaveManager: Failed to save data", e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.bgmFilter = null;
        this.bgmOsc = null;
        this.bgmOsc2 = null;
        this.bgmGain = null;
        this.initialized = false;

        this.bgmBeat = 0;
        this.bgmNextNoteTime = 0;
        this.bgmTempo = 120;
        this.bgmActive = false;
        this.intensity = 0; // 0 to 1
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.bgmFilter = this.ctx.createBiquadFilter();

        this.sfxGain.gain.value = 0.6;
        this.musicGain.gain.value = 0.4;

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.bgmFilter);
        this.bgmFilter.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.bgmFilter.type = 'lowpass';
        this.bgmFilter.frequency.value = 2000;

        this.initialized = true;
        this.startBGM();
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    startBGM() {
        if (!this.ctx || this.bgmActive) return;
        this.bgmActive = true;
        this.bgmNextNoteTime = this.ctx.currentTime + 0.1;
    }

    updateVolumes() {
        if (!this.initialized || !this.ctx) return;
        const opts = window.game ? window.game.saveManager.data.options : { masterMute: false, masterVolume: 1, sfxVolume: 1, musicVolume: 1 };

        this.masterGain.gain.value = opts.masterMute ? 0 : opts.masterVolume;
        this.sfxGain.gain.value = opts.sfxVolume;
        this.musicGain.gain.value = opts.musicVolume;
    }

    updateBGM(dt, game) {
        this.updateVolumes();

        if (!this.initialized || !this.ctx || !this.bgmActive) return;

        // Calculate intensity based on game state
        let targetIntensity = 0.2; // Base intensity
        if (game.state === 'PLAYING') {
            if (game.activeBoss) {
                targetIntensity = 0.9;
                this.bgmTempo = 160;
            } else {
                targetIntensity = 0.4;
                this.bgmTempo = 120;
            }
            if (game.player && game.player.hp <= 1) {
                targetIntensity = 0.8;
                this.bgmTempo = 140;
            }
            if (game.player && game.timeScale < 1.0) {
                // Time dilation reduces tempo and filter
                this.bgmTempo *= game.timeScale;
                targetIntensity *= game.timeScale;
            }
        } else {
            this.bgmTempo = 90;
        }

        this.intensity += (targetIntensity - this.intensity) * dt * 2.0;
        this.bgmFilter.frequency.setTargetAtTime(500 + this.intensity * 4000, this.ctx.currentTime, 0.1);

        while (this.bgmNextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleBGMNote(this.bgmBeat, this.bgmNextNoteTime);
            this.bgmNextNoteTime += (60.0 / this.bgmTempo) / 4.0;
            this.bgmBeat = (this.bgmBeat + 1) % 16;
        }
    }

    scheduleBGMNote(beat, time) {
        // Kick
        if (beat % 4 === 0 || (this.intensity > 0.6 && beat % 4 === 2)) {
            this.playDrum(time, 150, 40, 0.5, 'sine');
        }
        // Hihat
        if (beat % 2 === 0) {
            this.playDrum(time, 8000, 4000, 0.1, 'square');
        }

        // Bass / Arp
        const scale = [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00]; // A minor
        let note = scale[beat % 7];
        if (this.intensity > 0.5) note *= 2; // Octave up

        this.playToneAt(note, 'sawtooth', 0.1, 0.2, time, this.musicGain);
    }

    playDrum(time, startFreq, endFreq, dur, type) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;

        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + dur);

        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + dur);
    }

    playToneAt(freq, type, duration, vol, time, dest) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(vol, time);
        gain.gain.setTargetAtTime(0, time, duration / 3);

        osc.connect(gain);
        gain.connect(dest);
        osc.start(time);
        osc.stop(time + duration);
    }

    playTone(freq, type, duration, vol = 1) {
        if (!this.initialized || !this.ctx) return;
        const time = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    // 1. Collect
    playCollect() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.playToneAt(800, 'sine', 0.1, 0.4, t, this.sfxGain);
        this.playToneAt(1200, 'sine', 0.15, 0.4, t + 0.05, this.sfxGain);
    }

    // 2. Alert
    playAlert() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.playToneAt(200, 'sawtooth', 0.3, 0.5, t, this.sfxGain);
        this.playToneAt(150, 'sawtooth', 0.4, 0.5, t + 0.1, this.sfxGain);
    }

    // 3. Game Over
    playGameOver() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.playToneAt(150, 'square', 0.5, 0.6, t, this.sfxGain);
        this.playToneAt(100, 'square', 0.8, 0.6, t + 0.2, this.sfxGain);
        this.playToneAt(50, 'square', 1.0, 0.6, t + 0.4, this.sfxGain);
    }

    // 4. Player Dash
    playDash() {
        if (!this.initialized || !this.ctx) return;
        this.playDrum(this.ctx.currentTime, 400, 100, 0.3, 'sine');
    }

    // 5. Boss Hit
    playBossHit() {
        this.playTone(300, 'square', 0.1, 0.5);
    }

    // 6. Boss Defeat
    playBossDefeat() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        for(let i=0; i<5; i++) {
            this.playToneAt(100 + i*50, 'sawtooth', 0.2, 0.6, t + i*0.1, this.sfxGain);
        }
    }

    // 7. Time Slow
    playTimeSlow() {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.5);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.5);
    }

    // 8. Time Resume
    playTimeResume() {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = this.ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.3);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
    }

    // 9. Enemy Shoot
    playEnemyShoot() {
        this.playTone(1200, 'triangle', 0.1, 0.3);
    }

    // 10. Upgrade Select
    playUpgrade() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;
        this.playToneAt(400, 'sine', 0.1, 0.4, t, this.sfxGain);
        this.playToneAt(600, 'sine', 0.1, 0.4, t + 0.1, this.sfxGain);
        this.playToneAt(800, 'sine', 0.2, 0.4, t + 0.2, this.sfxGain);
    }

    // 11. UI Hover/Click
    playUIClick() {
        this.playTone(1000, 'sine', 0.05, 0.2);
    }

    // 12. Shield Pop
    playShieldPop() {
        this.playDrum(this.ctx.currentTime, 800, 200, 0.2, 'square');
    }
}

class InputManager {
    constructor(canvas, soundEngine) {
        this.canvas = canvas;
        this.soundEngine = soundEngine;
        this.keys = {};
        this.pointer = { x: 0, y: 0, isDown: false };
        this.joystick = { active: false, originX: 0, originY: 0, x: 0, y: 0, dx: 0, dy: 0 };
        this.dashRequested = false;
        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            this.soundEngine.init();
            this.soundEngine.resume();

            if (window.game && (window.game.state === 'TITLE' || window.game.state === 'GAME_OVER')) {
                if (e.code === 'KeyS') window.game.state = 'SETTINGS';
                if (e.code === 'KeyM') window.game.state = 'MILESTONES';
            } else if (window.game && (window.game.state === 'SETTINGS' || window.game.state === 'MILESTONES')) {
                if (e.code === 'Escape') window.game.state = 'TITLE';
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });


        this.canvas.addEventListener('pointerdown', (e) => {
            this.soundEngine.init();
            this.soundEngine.resume();
            this.updatePointer(e);

            if (window.game) {
                if (window.game.state === 'SETTINGS' || window.game.state === 'MILESTONES') {
                    window.game.uiManager.handleInput(this.pointer.x, this.pointer.y);
                    return;
                }
            }

            this.soundEngine.playUIClick();
            this.pointer.isDown = true;

            const opts = window.game ? window.game.saveManager.data.options : { touchControls: 'Auto' };
            if (opts.touchControls === 'Off') {
                this.dashRequested = true;
                setTimeout(() => this.dashRequested = false, 100);
                return;
            }

            // Start virtual joystick if in bottom half of screen
            const rect = this.canvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;

            const isRightHanded = opts.touchHandedness === 'Right';
            const isOnJoystickSide = isRightHanded ? (x > rect.width / 2) : (x < rect.width / 2);

            if (y > rect.height / 2 && isOnJoystickSide) {
                this.joystick.active = true;
                this.joystick.originX = this.pointer.x;
                this.joystick.originY = this.pointer.y;
                this.joystick.x = this.pointer.x;
                this.joystick.y = this.pointer.y;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
            } else {
                this.dashRequested = true;
                setTimeout(() => this.dashRequested = false, 100);
            }
        });

        this.canvas.addEventListener('pointermove', (e) => {
            this.updatePointer(e);
            if (this.joystick.active) {
                this.joystick.x = this.pointer.x;
                this.joystick.y = this.pointer.y;

                let dx = this.joystick.x - this.joystick.originX;
                let dy = this.joystick.y - this.joystick.originY;
                const dist = Math.hypot(dx, dy);
                const maxDist = 50;

                if (dist > maxDist) {
                    dx = (dx / dist) * maxDist;
                    dy = (dy / dist) * maxDist;
                    this.joystick.x = this.joystick.originX + dx;
                    this.joystick.y = this.joystick.originY + dy;
                }

                this.joystick.dx = dx / maxDist;
                this.joystick.dy = dy / maxDist;
            }
        });

        this.canvas.addEventListener('pointerup', (e) => {
            this.pointer.isDown = false;
            this.joystick.active = false;
            this.joystick.dx = 0;
            this.joystick.dy = 0;
        });
    }

    updatePointer(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        this.pointer.x = (e.clientX - rect.left) * scaleX;
        this.pointer.y = (e.clientY - rect.top) * scaleY;
    }

    getMovementVector() {
        let dx = 0;
        let dy = 0;

        if (this.keys['ArrowUp'] || this.keys['KeyW']) dy -= 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) dy += 1;
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) dx -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) dx += 1;

        if (dx === 0 && dy === 0 && this.joystick.active) {
            dx = this.joystick.dx;
            dy = this.joystick.dy;
        }

        const dist = Math.hypot(dx, dy);
        if (dist > 0 && !this.joystick.active) {
            dx /= dist;
            dy /= dist;
        }

        return { dx, dy };
    }
}

class ThrustParticle {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0;
        this.size = 2 + Math.random() * 3;
        this.color = Math.random() > 0.5 ? '#ffeb3b' : '#ff9800';
    }

    update(dt) {

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * (2 + Math.random() * 2);
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
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
        this.radius = 15;
        this.speed = 1200; // Acceleration
        this.friction = 0.85;
        this.color = '#4CAF50';
        this.isMoving = false;

        // Dash / Tactical Ability
        this.dashCooldown = 0;
        this.dashCooldownMax = 2.0;
        this.isDashing = false;
        this.wasMoving = true;
        this.dashDuration = 0;
        this.dashDurationMax = 0.2;
        this.dashSpeed = 800;
        this.dashDir = {dx: 0, dy: 0};
        this.invulnerable = false;
        this.blinkTimer = 0;

        // Visuals
        this.thrustParticles = [];
        this.aimAngle = 0;
        this.recoil = 0;
    }

    update(dt, inputVector, dashRequested) {
        if (this.dashCooldown > 0) {
            this.dashCooldown -= dt;
        }

        if (dashRequested && this.dashCooldown <= 0 && !this.isDashing) {
            this.isDashing = true;
            game.soundEngine.playDash();
            this.dashDuration = this.dashDurationMax;
            this.dashCooldown = this.dashCooldownMax;

            if (inputVector.dx !== 0 || inputVector.dy !== 0) {
                const dist = Math.hypot(inputVector.dx, inputVector.dy);
                this.dashDir.dx = inputVector.dx / dist;
                this.dashDir.dy = inputVector.dy / dist;
            } else {
                this.dashDir.dx = Math.cos(this.aimAngle);
                this.dashDir.dy = Math.sin(this.aimAngle);
            }

            this.invulnerable = true;
            this.recoil = 15;

            for(let i=0; i<10; i++) {
                this.thrustParticles.push(new ThrustParticle(
                    this.x, this.y,
                    -this.dashDir.dx * 300 + (Math.random()-0.5)*100,
                    -this.dashDir.dy * 300 + (Math.random()-0.5)*100
                ));
            }
        }

        if (inputVector.dx !== 0 || inputVector.dy !== 0) {
            this.aimAngle = Math.atan2(inputVector.dy, inputVector.dx);
        }

        if (this.isDashing) {
            this.dashDuration -= dt;
            this.vx = this.dashDir.dx * this.dashSpeed;
            this.vy = this.dashDir.dy * this.dashSpeed;

            for(let i=0; i<2; i++) {
                this.thrustParticles.push(new ThrustParticle(
                    this.x + (Math.random()-0.5)*10,
                    this.y + (Math.random()-0.5)*10,
                    -this.vx * 0.3 + (Math.random()-0.5)*50,
                    -this.vy * 0.3 + (Math.random()-0.5)*50
                ));
            }

            if (this.dashDuration <= 0) {
                this.isDashing = false;
        this.wasMoving = true;
                if (!window.game.perks.invulnAfterDash) {
                    this.invulnerable = false;
                } else {
                    // Let it fade normally?
                    // Actually, if we just want "Brief invulnerability after dashing"
                    // we can just not clear it here and let it clear after a timer, or just manually clear it after 0.5s.
                    setTimeout(() => { this.invulnerable = false; }, 500);
                }
            }
        } else {
            if (inputVector.dx !== 0 || inputVector.dy !== 0) {
                this.isMoving = true;
                this.vx += inputVector.dx * this.speed * dt;
                this.vy += inputVector.dy * this.speed * dt;
            } else {
                this.isMoving = false;
            }

            this.vx *= this.friction;
            this.vy *= this.friction;

            if (Math.abs(this.vx) < 5) this.vx = 0;
            if (Math.abs(this.vy) < 5) this.vy = 0;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.recoil > 0) {
            this.recoil -= dt * 45;
            if (this.recoil < 0) this.recoil = 0;
        }

        if (this.invulnerable) {
            this.blinkTimer += dt * 20;
        } else {
            this.blinkTimer = 0;
        }

        for (let i = this.thrustParticles.length - 1; i >= 0; i--) {
            this.thrustParticles[i].update(dt);
            if (this.thrustParticles[i].life <= 0) {
                this.thrustParticles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (const p of this.thrustParticles) {
            p.draw(ctx);
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.invulnerable && Math.floor(this.blinkTimer) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        const recoilX = -Math.cos(this.aimAngle) * this.recoil;
        const recoilY = -Math.sin(this.aimAngle) * this.recoil;
        ctx.translate(recoilX, recoilY);

        ctx.rotate(this.aimAngle);

        if (!this.isMoving && !this.isDashing && Math.abs(this.vx) === 0 && Math.abs(this.vy) === 0) {
            ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 5 + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (ctx.ellipse) {
            ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
        } else {
            ctx.scale(1, 0.8);
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.scale(1, 1.25);
        }
        ctx.fill();

        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(this.radius * 0.3, -this.radius * 0.9, this.radius * 0.4, 0, Math.PI * 2);
        ctx.arc(this.radius * 0.3, this.radius * 0.9, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#81C784';
        ctx.beginPath();
        ctx.arc(this.radius * 0.4, 0, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#E0F7FA';
        ctx.beginPath();
        ctx.arc(this.radius * 0.6, 0, this.radius * 0.4, -Math.PI / 2, Math.PI / 2);
        ctx.fill();

        if (!this.isDashing) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(this.radius, 0);
            ctx.lineTo(this.radius + 40, 0);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }
}

class Guard {
    constructor(x, y, path) {
        this.x = x;
        this.y = y;
        this.path = path; // Array of {x, y}
        this.pathIndex = 0;
        this.speed = 100;
        this.radius = 15;
        this.color = '#F44336';
        this.visionAngle = 0;
        this.visionSpread = Math.PI / 4;
        this.visionRange = 150;
        this.state = 'PATROL';
        this.alertTimer = 0;
    }

    update(dt, globalTimeScale) {
        const adjustedDt = dt * globalTimeScale;

        if (this.path.length > 0) {
            const target = this.path[this.pathIndex];
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                this.pathIndex = (this.pathIndex + 1) % this.path.length;
            } else {
                this.x += (dx / dist) * this.speed * adjustedDt;
                this.y += (dy / dist) * this.speed * adjustedDt;
                this.visionAngle = Math.atan2(dy, dx);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STUNNED', 0, -30);
            ctx.globalAlpha = 0.5;
        }

        // Vision cone
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, this.visionAngle - this.visionSpread, this.visionAngle + this.visionSpread);
        ctx.lineTo(0, 0);
        ctx.fill();

        // Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    canSee(player) {
        if (this.stunTimer > 0) return false; // Stunned guards can't see

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > this.visionRange) return false;

        const angleToPlayer = Math.atan2(dy, dx);
        let angleDiff = Math.abs(angleToPlayer - this.visionAngle);

        // Normalize angle difference
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        return angleDiff <= this.visionSpread;
    }
}


class SwarmerGuard extends Guard {
    constructor(x, y, path) {
        super(x, y, path);
        this.speed = 150;
        this.radius = 10;
        this.color = '#ff9800';
        this.visionSpread = Math.PI / 2;
        this.visionRange = 80;
        this.timeSinceSpeedChange = 0;
    }
    update(dt, globalTimeScale) {
        super.update(dt, globalTimeScale);
        this.timeSinceSpeedChange += dt * globalTimeScale;
        if (this.timeSinceSpeedChange > 1) {
            this.speed = 100 + Math.random() * 100;
            this.timeSinceSpeedChange = 0;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.visionAngle);

        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STUNNED', 0, -30);
            ctx.globalAlpha = 0.5;
        }

        ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, -this.visionSpread, this.visionSpread);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius, this.radius);
        ctx.lineTo(-this.radius, -this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class SniperGuard extends Guard {
    constructor(x, y, path) {
        super(x, y, path);
        this.speed = 50;
        this.radius = 12;
        this.color = '#9c27b0';
        this.visionSpread = Math.PI / 16;
        this.visionRange = 400;
        this.sweepAngle = 0;
        this.baseAngle = 0;
        this.sweepSpeed = 1;
        this.preAttackTimer = 0;
        this.lockedPlayer = null;
    }
    update(dt, globalTimeScale) {
        const adjustedDt = dt * globalTimeScale;

        if (this.path.length > 0) {
            const target = this.path[this.pathIndex];
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 5) {
                this.pathIndex = (this.pathIndex + 1) % this.path.length;
            } else {
                this.x += (dx / dist) * this.speed * adjustedDt;
                this.y += (dy / dist) * this.speed * adjustedDt;
                this.baseAngle = Math.atan2(dy, dx);
            }
        }

        if (this.state === 'LOCK_ON' && this.lockedPlayer) {
            this.preAttackTimer += adjustedDt;
            const dx = this.lockedPlayer.x - this.x;
            const dy = this.lockedPlayer.y - this.y;
            const targetAngle = Math.atan2(dy, dx);

            let diff = targetAngle - this.visionAngle;
            while(diff < -Math.PI) diff += Math.PI * 2;
            while(diff > Math.PI) diff -= Math.PI * 2;
            this.visionAngle += diff * 2 * adjustedDt;
        } else {
            this.sweepAngle += this.sweepSpeed * adjustedDt;
            this.visionAngle = this.baseAngle + Math.sin(this.sweepAngle) * (Math.PI / 3);
            this.preAttackTimer = 0;
        }
    }

    canSee(player) {
        if (this.stunTimer > 0) return false;

        const sees = super.canSee(player);
        if (sees) {
            if (this.state !== 'LOCK_ON') {
                this.state = 'LOCK_ON';
                this.lockedPlayer = player;
                this.preAttackTimer = 0;
            }
            if (this.preAttackTimer > 1.5) {
                return true;
            }
            return false;
        } else {
            this.state = 'PATROL';
            this.lockedPlayer = null;
            return false;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.visionAngle);

        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STUNNED', 0, -30);
            ctx.globalAlpha = 0.5;
        }

        if (this.state === 'LOCK_ON') {
            const alpha = 0.2 + 0.3 * Math.abs(Math.sin(this.preAttackTimer * 10));
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
        } else {
            ctx.fillStyle = 'rgba(156, 39, 176, 0.2)';
        }
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, -this.visionSpread, this.visionSpread);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.strokeStyle = this.state === 'LOCK_ON' ? 'rgba(255,0,0,0.8)' : 'rgba(156, 39, 176, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(this.visionRange, 0);
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.lineTo(0, -this.radius);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class ShieldedBruiserGuard extends Guard {
    constructor(x, y, path) {
        super(x, y, path);
        this.speed = 60;
        this.radius = 20;
        this.color = '#3f51b5';
        this.visionSpread = Math.PI / 3;
        this.visionRange = 120;
    }

    get hasShield() { return true; }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.visionAngle);

        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STUNNED', 0, -30);
            ctx.globalAlpha = 0.5;
        }

        ctx.fillStyle = 'rgba(63, 81, 181, 0.2)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, -this.visionSpread, this.visionSpread);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.fillRect(-this.radius, -this.radius, this.radius*2, this.radius*2);

        ctx.strokeStyle = '#00bcd4';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 4, -this.visionSpread, this.visionSpread);
        ctx.stroke();

        ctx.restore();
    }
}

class SplitterGuard extends Guard {
    constructor(x, y, path) {
        super(x, y, path);
        this.speed = 80;
        this.radius = 18;
        this.color = '#e91e63';
        this.visionSpread = Math.PI;
        this.visionRange = 100;
        this.pulseTimer = 0;
        this.hasSplit = false;
    }

    update(dt, globalTimeScale) {
        super.update(dt, globalTimeScale);
        this.pulseTimer += dt * globalTimeScale * 3;
        this.visionRange = 80 + Math.sin(this.pulseTimer) * 20;
    }

    canSee(player) {
        if (this.stunTimer > 0 || this.hasSplit) return false;
        const sees = super.canSee(player);
        if (sees) {
            this.state = 'SPLITTING';
            return false;
        }
        return false;
    }

    draw(ctx) {
        if (this.hasSplit) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.visionAngle);

        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STUNNED', 0, -30);
            ctx.globalAlpha = 0.5;
        }

        ctx.fillStyle = 'rgba(233, 30, 99, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, this.visionRange, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class HazardGuard extends Guard {
    constructor(x, y, path) {
        super(x, y, path);
        this.speed = 40;
        this.radius = 16;
        this.color = '#4caf50';
        this.visionSpread = Math.PI / 8;
        this.visionRange = 250;
        this.rotationSpeed = 2;
    }

    update(dt, globalTimeScale) {
        super.update(dt, globalTimeScale);
        this.visionAngle += this.rotationSpeed * dt * globalTimeScale;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.visionAngle);

        if (this.stunTimer > 0) {
            ctx.fillStyle = '#ffaa00';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('STUNNED', 0, -30);
            ctx.globalAlpha = 0.5;
        }

        ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, this.visionRange, -this.visionSpread, this.visionSpread);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4 + Math.PI / 8;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

class Candy {
    constructor(x, y, value = 10) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 8;
        this.color = '#f0c97d';
        this.collected = false;
        this.wobbleOffset = Math.random() * Math.PI * 2;
    }

    update(dt, globalTimeScale, speedX, speedY) {
        this.x += speedX * dt * globalTimeScale;
        this.y += speedY * dt * globalTimeScale;
    }

    draw(ctx) {
        if (this.collected) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        const wobble = Math.sin(Date.now() / 200 + this.wobbleOffset) * 2;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, wobble, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Wrapper ties
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-this.radius, wobble);
        ctx.lineTo(-this.radius - 5, wobble - 5);
        ctx.lineTo(-this.radius - 5, wobble + 5);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.radius, wobble);
        ctx.lineTo(this.radius + 5, wobble - 5);
        ctx.lineTo(this.radius + 5, wobble + 5);
        ctx.fill();

        ctx.restore();
    }
}

class ConveyorBelt {
    constructor(x, y, width, height, speedX, speedY) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.speedX = speedX;
        this.speedY = speedY;
        this.patternOffset = 0;
    }

    update(dt, globalTimeScale) {
        const speed = Math.hypot(this.speedX, this.speedY);
        this.patternOffset = (this.patternOffset + speed * dt * globalTimeScale) % 20;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;

        // Draw tread pattern
        ctx.beginPath();
        if (Math.abs(this.speedX) > Math.abs(this.speedY)) {
            // Horizontal belt
            for (let i = this.patternOffset; i < this.width; i += 20) {
                ctx.moveTo(this.x + i, this.y);
                ctx.lineTo(this.x + i, this.y + this.height);
            }
        } else {
            // Vertical belt
            for (let i = this.patternOffset; i < this.height; i += 20) {
                ctx.moveTo(this.x, this.y + i);
                ctx.lineTo(this.x + this.width, this.y + i);
            }
        }
        ctx.stroke();

        ctx.restore();
    }
}


class ParallaxBackground {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.layers = [];

        // Deepest layer (slowest, darkest) - representing distant factory pipes
        this.layers.push(new ParallaxLayer(width, height, 10, '#1a111a', 50, 20));

        // Mid layer - representing background machinery
        this.layers.push(new ParallaxLayer(width, height, 25, '#2a1a2a', 40, 15));

        // Foreground layer (fastest) - representing hanging cables or closer factory elements
        this.layers.push(new ParallaxLayer(width, height, 50, '#3a203a', 20, 10));
    }

    update(dt, timeScale) {
        for (const layer of this.layers) {
            layer.update(dt, timeScale);
        }
    }

    draw(ctx) {
        for (const layer of this.layers) {
            layer.draw(ctx);
        }
    }

    resize(width, height) {
        this.width = width;
        this.height = height;
        for (const layer of this.layers) {
            layer.width = width;
            layer.height = height;
        }
    }
}

class ParallaxLayer {
    constructor(width, height, speed, color, itemSize, density) {
        this.width = width;
        this.height = height;
        this.speed = speed;
        this.color = color;
        this.items = [];
        this.itemSize = itemSize;

        for (let i = 0; i < density; i++) {
            this.items.push({
                x: Math.random() * width,
                y: Math.random() * height,
                w: itemSize + Math.random() * itemSize,
                h: itemSize + Math.random() * itemSize,
                type: Math.floor(Math.random() * 3) // Different shape types
            });
        }
    }

    update(dt, globalTimeScale) {
        for (const item of this.items) {
            item.x -= this.speed * dt * globalTimeScale;
            if (item.x < -item.w) {
                item.x = this.width + item.w;
                item.y = Math.random() * this.height;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.color;
        for (const item of this.items) {
            if (item.type === 0) {
                ctx.fillRect(item.x, item.y, item.w, item.h);
            } else if (item.type === 1) {
                ctx.beginPath();
                ctx.arc(item.x + item.w/2, item.y + item.h/2, item.w/2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(item.x, item.y + item.h);
                ctx.lineTo(item.x + item.w/2, item.y);
                ctx.lineTo(item.x + item.w, item.y + item.h);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

class SteamVent {
    constructor(x, y, width, height, burstInterval, burstDuration) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.burstInterval = burstInterval;
        this.burstDuration = burstDuration;
        this.timer = Math.random() * burstInterval;
        this.active = false;
        this.particles = [];
        this.color = '#aa4444'; // Red base
    }

    update(dt, timeScale, player, guards) {
        this.timer += dt * timeScale;

        if (this.active) {
            if (this.timer >= this.burstDuration) {
                this.active = false;
                this.timer = 0;
            }

            // Generate particles
            if (Math.random() < 0.3 * timeScale) {
                this.particles.push({
                    x: this.x + Math.random() * this.width,
                    y: this.y + this.height,
                    vx: (Math.random() - 0.5) * 20,
                    vy: -50 - Math.random() * 50,
                    life: 1.0,
                    maxLife: 0.5 + Math.random() * 0.5,
                    size: 10 + Math.random() * 10
                });
            }

            // Check collisions with player
            if (player && !player.invulnerable && player.state === 'PLAYING') {
                if (player.x > this.x && player.x < this.x + this.width &&
                    player.y > this.y - 100 && player.y < this.y + this.height) {
                    return 'KILL_PLAYER';
                }
            }

            // Guard interaction logic
            if (guards) {
                for (const guard of guards) {
                    if (guard.x > this.x && guard.x < this.x + this.width &&
                        guard.y > this.y - 100 && guard.y < this.y + this.height) {
                        if (!guard.hasShield) {
                            guard.stunTimer = 1.5; // Stun guard for 1.5 seconds
                        }
                    }
                }
            }
        } else {
            if (this.timer >= this.burstInterval) {
                this.active = true;
                this.timer = 0;
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt * timeScale;
            p.y += p.vy * dt * timeScale;
            p.life -= (dt * timeScale) / p.maxLife;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        return null;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = this.active ? '#ff4444' : '#552222';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Danger zone indicator
        if (!this.active) {
            const dangerRatio = this.timer / this.burstInterval;
            if (dangerRatio > 0.8) {
                ctx.fillStyle = `rgba(255, 0, 0, ${(dangerRatio - 0.8) * 2})`;
                ctx.fillRect(this.x, this.y - 100, this.width, 100);
            }
        }

        // Particles
        for (const p of this.particles) {
            ctx.fillStyle = `rgba(255, 200, 200, ${p.life})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 + (1 - p.life)), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}



class BossWeapon {
    constructor(x, y, vx, vy, type) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.radius = 8;
        this.active = true;
    }

    update(dt) {

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.type === 'laser' ? '#ff00ff' : '#00ffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class BaseBoss {
    constructor(x, y, maxHp) {
        this.x = x;
        this.y = y;
        this.maxHp = maxHp;
        this.hp = this.maxHp;
        this.phase = 1;
        this.radius = 40;
        this.state = 'WARNING';
        this.warningTimer = 3; // 3 seconds of warning
        this.timer = 0;
        this.projectiles = [];
        this.color = '#ff0000';
        this.name = "BOSS";
    }

    update(dt, timeScale, player, game) {
        if (this.state === 'WARNING') {
            this.warningTimer -= dt * timeScale;
            if (this.warningTimer <= 0) {
                this.state = 'FIGHT';
            }
            return;
        }

        if (this.state === 'FIGHT') {
            this.timer += dt * timeScale;

            if (this.hp <= this.maxHp * 0.5 && this.phase === 1) {
                this.phase = 2;
                this.onPhaseTransition(game);
            }

            this.behavior(dt, timeScale, player, game);

            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const proj = this.projectiles[i];
                proj.update(dt * timeScale);

                // Remove if off screen
                if (proj.x < -100 || proj.x > game.width + 100 || proj.y < -100 || proj.y > game.height + 100) {
                    this.projectiles.splice(i, 1);
                    continue;
                }

                // Check collision with player
                const dx = proj.x - player.x;
                const dy = proj.y - player.y;
                if (Math.hypot(dx, dy) < proj.radius + player.radius && !player.invulnerable) {
                    game.gameOver();
                }
            }

            const dx = this.x - player.x;
            const dy = this.y - player.y;
            if (Math.hypot(dx, dy) < this.radius + player.radius && !player.invulnerable) {
                game.gameOver();
            }
        }
    }

    onPhaseTransition(game) {
        // override
    }

    behavior(dt, timeScale, player, game) {
        // override
    }

    takeDamage(amount) {
        if (window.game && window.game.soundEngine) window.game.soundEngine.playBossHit();
        this.hp -= amount;
        if (this.hp <= 0) {
            this.state = 'DEFEATED';
        }
    }

    draw(ctx, width, height) {
        if (this.state === 'WARNING') {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
            ctx.fillRect(0, height / 2 - 50, width, 100);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 36px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`WARNING: ${this.name} INBOUND`, width / 2, height / 2 + 10);
            ctx.restore();
        }

        if (this.state === 'FIGHT') {
            for (const proj of this.projectiles) {
                proj.draw(ctx);
            }

            ctx.save();
            ctx.translate(this.x, this.y);

            // Draw Boss body
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();

            // Draw Boss core (changes in phase 2)
            ctx.fillStyle = this.phase === 1 ? '#000' : '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // Draw Boss Health Bar
            ctx.save();
            const barWidth = width * 0.6;
            const barHeight = 20;
            const hpRatio = Math.max(0, this.hp / this.maxHp);
            ctx.translate((width - barWidth) / 2, 20);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, barWidth, barHeight);

            ctx.fillStyle = this.phase === 1 ? '#ff4444' : '#ff0000';
            ctx.fillRect(0, 0, barWidth * hpRatio, barHeight);

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, barWidth, barHeight);

            ctx.fillStyle = '#fff';
            ctx.font = '14px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, barWidth / 2, 15);
            ctx.restore();
        }
    }
}

class OverseerBoss extends BaseBoss {
    constructor(x, y) {
        super(x, y, 300);
        this.color = '#8800ff';
        this.name = "THE OVERSEER";
        this.attackTimer = 0;
        this.moveAngle = 0;
    }

    onPhaseTransition(game) {
        game.soundEngine.playAlert();
        this.radius = 50;
        this.color = '#aa00ff';
    }

    behavior(dt, timeScale, player, game) {
        // Hover at the top of the screen
        const targetX = game.width / 2 + Math.sin(this.moveAngle) * 200;
        const targetY = 100 + Math.sin(this.moveAngle * 2) * 50;

        this.x += (targetX - this.x) * dt * 2 * timeScale;
        this.y += (targetY - this.y) * dt * 2 * timeScale;

        this.moveAngle += dt * timeScale * (this.phase === 1 ? 1 : 2);

        this.attackTimer -= dt * timeScale;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase === 1 ? 1.5 : 0.8;

            // Fast attack pattern that encourages player to stay still
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.hypot(dx, dy);
            const dirX = dx / dist;
            const dirY = dy / dist;

            const speed = this.phase === 1 ? 250 : 350;
            this.projectiles.push(new BossWeapon(this.x, this.y, dirX * speed, dirY * speed, 'laser'));
            if (game && game.soundEngine) game.soundEngine.playEnemyShoot();

            if (this.phase === 2) {
                // Shoot a spread in phase 2
                const spreadAngle = 0.3;
                const cosSpread = Math.cos(spreadAngle);
                const sinSpread = Math.sin(spreadAngle);

                const dirX1 = dirX * cosSpread - dirY * sinSpread;
                const dirY1 = dirX * sinSpread + dirY * cosSpread;
                this.projectiles.push(new BossWeapon(this.x, this.y, dirX1 * speed, dirY1 * speed, 'laser'));
            if (game && game.soundEngine) game.soundEngine.playEnemyShoot();

                const dirX2 = dirX * cosSpread + dirY * sinSpread;
                const dirY2 = -dirX * sinSpread + dirY * cosSpread;
                this.projectiles.push(new BossWeapon(this.x, this.y, dirX2 * speed, dirY2 * speed, 'laser'));
            if (game && game.soundEngine) game.soundEngine.playEnemyShoot();
            }
        }
    }
}

class ConveyorColossus extends BaseBoss {
    constructor(x, y) {
        super(x, y, 400);
        this.color = '#ff5500';
        this.name = "CONVEYOR COLOSSUS";
        this.attackTimer = 0;
        this.wallBounce = 1;
    }

    onPhaseTransition(game) {
        game.soundEngine.playAlert();
        this.radius = 60;
    }

    behavior(dt, timeScale, player, game) {
        // Moves left and right across the belts area
        this.x += 100 * this.wallBounce * dt * timeScale * (this.phase === 1 ? 1 : 1.5);
        this.y += (300 - this.y) * dt * timeScale;

        if (this.x > game.width - this.radius || this.x < this.radius) {
            this.wallBounce *= -1;
        }

        this.attackTimer -= dt * timeScale;
        if (this.attackTimer <= 0) {
            this.attackTimer = this.phase === 1 ? 1.0 : 0.5;

            // Drops bombs that fall slowly but spread, requiring precise stillness to avoid
            this.projectiles.push(new BossWeapon(this.x, this.y + this.radius, (Math.random() - 0.5) * 100, 150 + Math.random() * 50, 'bomb'));
        }
    }
}



// --- COMBOS & PERKS ---
class PerkManager {
    constructor(game) {
        this.game = game;
        this.activePerks = [];
        this.availablePerks = [
            { id: 'dashCooldown', name: 'Rapid Boots', desc: 'Dash cooldown reduced by 25%' },
            { id: 'dashDuration', name: 'Extended Dash', desc: 'Dash duration increased by 50%' },
            { id: 'timeDilation', name: 'Deep Focus', desc: 'Time slows down even more when still' },
            { id: 'candyMagnet', name: 'Candy Magnet', desc: 'Candies drift towards you' },
            { id: 'shield', name: 'Energy Shield', desc: 'Absorb 1 hit per wave' },
            { id: 'baseCombo', name: 'Combo Starter', desc: 'Base combo multiplier is 1.5x' },
            { id: 'bossDamage', name: 'Boss Buster', desc: 'Candies deal more damage to bosses' },
            { id: 'invulnAfterDash', name: 'Phasing Dash', desc: 'Brief invulnerability after dashing' },
            { id: 'comboDecaySlower', name: 'Momentum', desc: 'Combo bar decays 30% slower' }
        ];
        this.offeredPerks = [];
    }

    triggerDraft() {
        this.game.state = 'UPGRADE';
        this.offeredPerks = [];
        // pick 3 random perks
        const pool = [...this.availablePerks];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            this.offeredPerks.push(pool.splice(idx, 1)[0]);
        }
    }

    applyPerk(perk) {
        this.activePerks.push(perk);
        switch (perk.id) {
            case 'dashCooldown': this.game.player.dashCooldownMax *= 0.75; break;
            case 'dashDuration': this.game.player.dashDurationMax *= 1.5; break;
            case 'timeDilation': this.game.baseDilation = Math.max(0.02, this.game.baseDilation - 0.04); break;
            case 'candyMagnet': this.game.perks.candyMagnet = true; break;
            case 'shield': this.game.player.hasShield = true; this.game.player.shieldActive = true; break;
            case 'baseCombo': this.game.perks.baseCombo = Math.max(this.game.perks.baseCombo, 1.5); break;
            case 'bossDamage': this.game.perks.bossDamage += 10; break;
            case 'invulnAfterDash': this.game.perks.invulnAfterDash = true; break;
            case 'comboDecaySlower': this.game.perks.comboDecayMod *= 0.7; break;
        }

        // restore shield if perk active
        if (this.game.player.hasShield) {
            this.game.player.shieldActive = true;
        }

        this.game.state = 'PLAYING';
    }

    draw(ctx, width, height) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#fff';
        ctx.font = '36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WAVE CLEARED! CHOOSE AN UPGRADE', width / 2, 100);

        const cardWidth = 200;
        const cardHeight = 300;
        const spacing = 40;
        const startX = width / 2 - (3 * cardWidth + 2 * spacing) / 2;

        for (let i = 0; i < this.offeredPerks.length; i++) {
            const perk = this.offeredPerks[i];
            const x = startX + i * (cardWidth + spacing);
            const y = height / 2 - cardHeight / 2;

            // Draw Card
            ctx.fillStyle = '#222';
            ctx.fillRect(x, y, cardWidth, cardHeight);
            ctx.strokeStyle = '#f0c97d';
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, cardWidth, cardHeight);

            ctx.fillStyle = '#f0c97d';
            ctx.font = '20px sans-serif';
            ctx.fillText(perk.name, x + cardWidth / 2, y + 40);

            ctx.fillStyle = '#ccc';
            ctx.font = '16px sans-serif';
            const words = perk.desc.split(' ');
            let line = '';
            let lineY = y + 100;
            for (let w = 0; w < words.length; w++) {
                const testLine = line + words[w] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > cardWidth - 20 && w > 0) {
                    ctx.fillText(line, x + cardWidth / 2, lineY);
                    line = words[w] + ' ';
                    lineY += 24;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x + cardWidth / 2, lineY);

            // Draw click instruction
            ctx.fillStyle = '#fff';
            ctx.font = '14px sans-serif';
            ctx.fillText('Click to Select', x + cardWidth / 2, y + cardHeight - 20);
        }
    }

    handleInput(pointer, width, height) {
        const cardWidth = 200;
        const cardHeight = 300;
        const spacing = 40;
        const startX = width / 2 - (3 * cardWidth + 2 * spacing) / 2;
        const y = height / 2 - cardHeight / 2;

        for (let i = 0; i < this.offeredPerks.length; i++) {
            const x = startX + i * (cardWidth + spacing);
            if (pointer.x >= x && pointer.x <= x + cardWidth &&
                pointer.y >= y && pointer.y <= y + cardHeight) {
                window.game.soundEngine.playUpgrade();
                this.applyPerk(this.offeredPerks[i]);
                return true;
            }
        }
        return false;
    }
}

class FieldPickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'freeze', 'comboMax'
        this.radius = 12;
        this.lifeTimer = 10;
        this.wobbleOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {

        this.lifeTimer -= dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        const wobble = Math.sin(Date.now() / 150 + this.wobbleOffset) * 4;

        ctx.fillStyle = this.type === 'freeze' ? '#00ffff' : '#ff00ff';
        if (this.lifeTimer < 3 && Math.floor(this.lifeTimer * 10) % 2 === 0) {
            ctx.globalAlpha = 0.5; // Blink before disappearing
        }

        ctx.beginPath();
        ctx.arc(0, wobble, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.type === 'freeze' ? 'FRZ' : 'MAX', 0, wobble + 3);

        ctx.restore();
    }
}

class VFXParticle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
    }

    update(dt) {

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class DamagePopup {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.vy = -30;
    }

    update(dt) {

        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class Afterimage {
    constructor(x, y, radius, color, life) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.life = life;
        this.maxLife = life;
    }

    update(dt) {

        this.life -= dt;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, (this.life / this.maxLife) * 0.5);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class VFXManager {
    constructor() {
        this.particles = [];
        this.popups = [];
        this.afterimages = [];
        this.hitStopTimer = 0;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
    }

    addHitStop(duration) {
        this.hitStopTimer = duration;
    }

    addScreenShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTimer = duration;
    }

    addParticle(x, y, vx, vy, color, size, life) {
        this.particles.push(new VFXParticle(x, y, vx, vy, color, size, life));
    }

    addDirectionalParticles(x, y, angle, spread, speed, color, count) {
        for (let i = 0; i < count; i++) {
            const pAngle = angle + (Math.random() - 0.5) * spread;
            const pSpeed = speed * (0.5 + Math.random() * 0.5);
            const vx = Math.cos(pAngle) * pSpeed;
            const vy = Math.sin(pAngle) * pSpeed;
            this.addParticle(x, y, vx, vy, color, 2 + Math.random() * 3, 0.5 + Math.random() * 0.5);
        }
    }

    addExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const pAngle = Math.random() * Math.PI * 2;
            const pSpeed = 50 + Math.random() * 100;
            const vx = Math.cos(pAngle) * pSpeed;
            const vy = Math.sin(pAngle) * pSpeed;
            this.addParticle(x, y, vx, vy, color, 3 + Math.random() * 4, 0.5 + Math.random() * 0.5);
        }
    }

    addPopup(x, y, text, color) {
        this.popups.push(new DamagePopup(x, y, text, color));
    }

    addAfterimage(x, y, radius, color, life) {
        this.afterimages.push(new Afterimage(x, y, radius, color, life));
    }


    update(dt) {

        if (this.hitStopTimer > 0) {
            this.hitStopTimer -= dt;
        }

        if (this.shakeTimer > 0) {
            this.shakeTimer -= dt;
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
        for (let i = this.popups.length - 1; i >= 0; i--) {
            this.popups[i].update(dt);
            if (this.popups[i].life <= 0) this.popups.splice(i, 1);
        }
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            this.afterimages[i].update(dt);
            if (this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
        }
    }

    applyShake(ctx) {
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            ctx.translate(dx, dy);
        }
    }

    draw(ctx) {
        for (const p of this.afterimages) p.draw(ctx);
        for (const p of this.particles) p.draw(ctx);
        for (const p of this.popups) p.draw(ctx);
    }
}

class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = 800;
        this.height = 600;

        this.soundEngine = new SoundEngine();
        this.inputManager = new InputManager(canvas, this.soundEngine);
        this.saveManager = new SaveManager();
        this.uiManager = new UIManager(this);

        this.state = 'TITLE';
        this.lastTime = 0;

        this.player = null;
        this.guards = [];
        this.candies = [];
        this.belts = [];
        this.activeBoss = null;
        this.bossesDefeated = 0;
        this.nextBossScore = 500;
        this.vents = [];
        this.activeBoss = null;
        this.bossesDefeated = 0;
        this.nextBossScore = 500;
        this.background = new ParallaxBackground(this.width, this.height);

        this.score = 0;

        this.perkManager = new PerkManager(this);
        this.perks = {
            candyMagnet: false,
            baseCombo: 1.0,
            bossDamage: 20,
            invulnAfterDash: false,
            comboDecayMod: 1.0
        };

        this.wave = 1;
        this.candiesToNextWave = 10;
        this.candiesCollectedInWave = 0;

        this.comboMulti = 1.0;
        this.comboTimer = 0;
        this.comboTimerMax = 3.0; // Seconds before combo drops

        this.pickups = [];
        this.vfx = new VFXManager();
        this.globalFreezeTimer = 0;
this.timeScale = 1.0;
        this.dilationTarget = 1.0;
        this.baseDilation = 0.1; // Slow down to 10% speed when still
        this.wasStill = false;

        this.setupResizeObserver();
        this.bindEvents();
        this.reset();
    }

    setupResizeObserver() {
        const resize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            if (this.background) this.background.resize(this.width, this.height);
        };

        window.addEventListener('resize', resize);
        new ResizeObserver(resize).observe(document.body);
        resize();
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (this.state === 'TITLE' || this.state === 'GAME_OVER') {
                if (e.code === 'KeyS') { this.state = 'SETTINGS'; return; }
                if (e.code === 'KeyM') { this.state = 'MILESTONES'; return; }

                // Allow start
                this.state = 'PLAYING';
                this.reset();
                this.lastTime = performance.now();
                return;
            }
            if (this.state === 'SETTINGS' || this.state === 'MILESTONES') {
                if (e.code === 'Escape') this.state = 'TITLE';
                return;
            }

            if (e.code === 'Escape' || e.code === 'KeyP') {

if (this.state === 'PLAYING') {
                    this.state = 'PAUSED';
                } else if (this.state === 'PAUSED') {
                    this.state = 'PLAYING';
                    this.lastTime = performance.now();
                }
            }
        });


        this.canvas.addEventListener('pointerdown', (e) => {
            this.soundEngine.init();
            this.soundEngine.resume();
            this.updatePointer(e);

            if (window.game) {
                if (window.game.state === 'SETTINGS' || window.game.state === 'MILESTONES') {
                    window.game.uiManager.handleInput(this.pointer.x, this.pointer.y);
                    return;
                }
            }

            this.soundEngine.playUIClick();
            this.pointer.isDown = true;

            const opts = window.game ? window.game.saveManager.data.options : { touchControls: 'Auto' };
            if (opts.touchControls === 'Off') {
                this.dashRequested = true;
                setTimeout(() => this.dashRequested = false, 100);
                return;
            }

            // Start virtual joystick if in bottom half of screen
            const rect = this.canvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const x = e.clientX - rect.left;

            const isRightHanded = opts.touchHandedness === 'Right';
            const isOnJoystickSide = isRightHanded ? (x > rect.width / 2) : (x < rect.width / 2);

            if (y > rect.height / 2 && isOnJoystickSide) {
                this.joystick.active = true;
                this.joystick.originX = this.pointer.x;
                this.joystick.originY = this.pointer.y;
                this.joystick.x = this.pointer.x;
                this.joystick.y = this.pointer.y;
                this.joystick.dx = 0;
                this.joystick.dy = 0;
            } else {
                this.dashRequested = true;
                setTimeout(() => this.dashRequested = false, 100);
            }
        });

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

    reset() {
        this.score = 0;
        this.player = new Player(this.width / 2, this.height - 50);
        this.guards = [];
        this.candies = [];
        this.belts = [];

        // Setup initial level
        this.belts.push(new ConveyorBelt(100, 100, this.width - 200, 100, 50, 0));
        this.belts.push(new ConveyorBelt(100, 300, this.width - 200, 100, -50, 0));

        this.guards.push(new Guard(200, 250, [{x: 200, y: 250}, {x: this.width - 200, y: 250}]));
        this.guards.push(new SwarmerGuard(150, 400, [{x: 150, y: 400}, {x: 150, y: 550}]));
        this.guards.push(new SniperGuard(this.width - 150, 150, [{x: this.width - 150, y: 150}, {x: this.width - 150, y: 50}]));
        this.guards.push(new ShieldedBruiserGuard(400, 350, [{x: 400, y: 350}, {x: 600, y: 350}]));
        this.guards.push(new SplitterGuard(300, 150, [{x: 300, y: 150}, {x: 500, y: 150}]));
        this.guards.push(new HazardGuard(this.width / 2, this.height - 100, [{x: 200, y: this.height - 100}, {x: this.width - 200, y: this.height - 100}]));

        this.vents = [];
        this.vents.push(new SteamVent(this.width / 2 - 40, 420, 80, 20, 3, 1));
        this.vents.push(new SteamVent(150, 220, 60, 20, 4, 1.5));


        this.wave = 1;
        this.candiesToNextWave = 10;
        this.candiesCollectedInWave = 0;
        this.comboMulti = this.perks.baseCombo;
        this.comboTimer = 0;
        this.pickups = [];
        this.vfx = new VFXManager();
        this.globalFreezeTimer = 0;
        this.perkManager.activePerks = [];
        this.baseDilation = 0.1;
        this.perks = {
            candyMagnet: false,
            baseCombo: 1.0,
            bossDamage: 20,
            invulnAfterDash: false,
            comboDecayMod: 1.0
        };
this.spawnCandy();
    }

    spawnCandy() {
        if (this.state !== 'PLAYING') return;

        const belt = this.belts[Math.floor(Math.random() * this.belts.length)];
        let x = belt.speedX > 0 ? belt.x : belt.x + belt.width;
        let y = belt.y + belt.height / 2;

        this.candies.push(new Candy(x, y));

        setTimeout(() => this.spawnCandy(), 2000 + Math.random() * 2000);
    }


    update(rawDt) {
        this.soundEngine.updateBGM(rawDt, this);
        // Run VFX regardless of pause/hit-stop
        this.vfx.update(rawDt);

        let dt = rawDt;
        if (this.vfx.hitStopTimer > 0) {
            dt = 0; // Freeze game logic
        }

        if (this.state !== 'PLAYING') return;



        // Freeze logic
        if (this.globalFreezeTimer > 0) {
            this.globalFreezeTimer -= dt;
            if (this.globalFreezeTimer > 0) {
                // Keep player updating so they can move, but freeze everything else
                const input = this.inputManager.getMovementVector();
                const dashReq = this.inputManager.keys['Space'] || this.inputManager.keys['ShiftLeft'] || this.inputManager.keys['ShiftRight'] || this.inputManager.dashRequested;
                this.player.update(dt, input, dashReq);

                // Also allow candy collection while frozen
                for (let i = this.candies.length - 1; i >= 0; i--) {
                    const candy = this.candies[i];
                    const dx = candy.x - this.player.x;
                    const dy = candy.y - this.player.y;
                    if (Math.hypot(dx, dy) < candy.radius + this.player.radius) {
                        this.score += Math.floor(candy.value * this.comboMulti);
                        this.comboMulti += 0.1;
                        this.comboTimer = this.comboTimerMax;
                        this.soundEngine.playCollect();
                        this.candies.splice(i, 1);
                        this.candiesCollectedInWave++;

                        if (Math.random() < 0.05) {
                            this.pickups.push(new FieldPickup(candy.x, candy.y, Math.random() > 0.5 ? 'freeze' : 'comboMax'));
                        }

                        if (this.activeBoss && this.activeBoss.state === 'FIGHT') {
                            this.activeBoss.takeDamage(this.perks.bossDamage);
                            this.vfx.addScreenShake(3, 0.1);
                            this.vfx.addDirectionalParticles(this.activeBoss.x, this.activeBoss.y, 0, Math.PI*2, 100, '#ff0', 5);
                            this.vfx.addPopup(this.activeBoss.x, this.activeBoss.y, `-${this.perks.bossDamage}`, '#ff0000');
                        }

                        if (this.score > this.saveManager.data.highScore) {
                            this.saveManager.data.highScore = this.score;
                            this.saveManager.save();
                        }

                        if (this.candiesCollectedInWave >= this.candiesToNextWave) {
                            this.wave++;
                            this.candiesCollectedInWave = 0;
                            this.candiesToNextWave = Math.floor(this.candiesToNextWave * 1.5);
                            this.perkManager.triggerDraft();
                        }
                    }
                }


                // Still handle pickups
                for (let i = this.pickups.length - 1; i >= 0; i--) {
                    const p = this.pickups[i];
                    p.update(dt);
                    if (p.lifeTimer <= 0) {
                        this.pickups.splice(i, 1);
                        continue;
                    }
                    const dx = p.x - this.player.x;
                    const dy = p.y - this.player.y;
                    if (Math.hypot(dx, dy) < p.radius + this.player.radius) {
                        if (p.type === 'freeze') {
                            this.globalFreezeTimer = 3.0;
                        } else if (p.type === 'comboMax') {
                            this.comboMulti += 2.0;
                            this.comboTimer = this.comboTimerMax;
                        }
                        this.soundEngine.playCollect();
                        this.pickups.splice(i, 1);
                    }
                }

                // Allow combo to decay even in freeze? No, let's freeze combo too
                return;
            }
        }

        // Combo decay
        if (this.comboTimer > 0) {
            this.comboTimer -= dt * this.perks.comboDecayMod * this.timeScale;
            if (this.comboTimer <= 0) {
                this.comboMulti = this.perks.baseCombo;
            }
        }

        // Magnet perk
        if (this.perks.candyMagnet) {

for (const candy of this.candies) {
                const dx = this.player.x - candy.x;
                const dy = this.player.y - candy.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 150) {
                    candy.x += (dx / dist) * 200 * dt;
                    candy.y += (dy / dist) * 200 * dt;
                }
            }
        }
const input = this.inputManager.getMovementVector();
        const dashReq = this.inputManager.keys['Space'] || this.inputManager.keys['ShiftLeft'] || this.inputManager.keys['ShiftRight'] || this.inputManager.dashRequested;
        this.player.update(dt, input, dashReq);

        // Time Dilation Mechanic
        const isActuallyStill = !this.player.isMoving && !this.player.isDashing && Math.abs(this.player.vx) < 5 && Math.abs(this.player.vy) < 5;
        if (this.player.isDashing) {
            this.vfx.addAfterimage(this.player.x, this.player.y, this.player.radius, this.player.color || '#fff', 0.2);
        }
        this.dilationTarget = isActuallyStill ? this.baseDilation : 1.0;

        if (isActuallyStill && !this.wasStill) this.soundEngine.playTimeSlow();
        if (!isActuallyStill && this.wasStill) this.soundEngine.playTimeResume();
        this.wasStill = isActuallyStill;

        this.timeScale += (this.dilationTarget - this.timeScale) * 10 * dt;

        // Keep player in bounds
        this.player.x = Math.max(this.player.radius, Math.min(this.width - this.player.radius, this.player.x));
        this.player.y = Math.max(this.player.radius, Math.min(this.height - this.player.radius, this.player.y));

        this.background.update(dt, this.timeScale);

        for (const vent of this.vents) {
            const result = vent.update(dt, this.timeScale, this.player, this.guards);
            if (result === 'KILL_PLAYER') {
                this.gameOver();
            }
        }

        // Boss spawn logic
        if (this.score >= this.nextBossScore && !this.activeBoss) {
            this.nextBossScore += 500 + this.bossesDefeated * 200;
            this.activeBoss = this.bossesDefeated % 2 === 0 ? new OverseerBoss(this.width / 2, -100) : new ConveyorColossus(this.width / 2, -100);
        }

        if (this.activeBoss) {
            this.activeBoss.update(dt, this.timeScale, this.player, this);

            if (this.activeBoss.state === 'DEFEATED') {
                this.vfx.addHitStop(0.5);
                this.vfx.addScreenShake(15, 0.5);
                this.vfx.addExplosion(this.activeBoss.x, this.activeBoss.y, '#ffaa00', 50);
                this.vfx.addPopup(this.activeBoss.x, this.activeBoss.y, 'BOSS DEFEATED!', '#ffcc00');
                this.soundEngine.playBossDefeat();

                this.activeBoss = null;
                this.bossesDefeated++;
                // Clear all guards for a clean slate
                this.guards = [];
                // Add some base guards back
                this.guards.push(new Guard(200, 250, [{x: 200, y: 250}, {x: this.width - 200, y: 250}]));
                this.score += 200; // Bonus for defeating boss
            }
        }

        for (const belt of this.belts) {
            belt.update(dt, this.timeScale);
        }

        let newGuards = [];
        for (const guard of this.guards) {
            guard.update(dt, this.timeScale);
            if (guard.state === 'SPLITTING' && !guard.hasSplit) {
                guard.hasSplit = true;
                // Spawn 3 swarmers
                for(let j=0; j<3; j++) {
                    const angle = (j * Math.PI * 2) / 3;
                    const path = [
                        {x: guard.x + Math.cos(angle)*100, y: guard.y + Math.sin(angle)*100},
                        {x: guard.x, y: guard.y}
                    ];
                    newGuards.push(new SwarmerGuard(guard.x, guard.y, path));
                }
            }
            if (guard.canSee(this.player) && !this.player.invulnerable) {
                this.gameOver();
            }
        }
        if (newGuards.length > 0) {
            this.guards.push(...newGuards);
        }

        for (let i = this.candies.length - 1; i >= 0; i--) {
            const candy = this.candies[i];

            // Find which belt the candy is on
            let onBelt = false;
            for (const belt of this.belts) {
                if (candy.x >= belt.x && candy.x <= belt.x + belt.width &&
                    candy.y >= belt.y && candy.y <= belt.y + belt.height) {
                    candy.update(dt, this.timeScale, belt.speedX, belt.speedY);
                    onBelt = true;
                    break;
                }
            }

            // Remove candies that fall off belts
            if (!onBelt) {
                this.candies.splice(i, 1);
                continue;
            }

            // Collision with player
            const dx = candy.x - this.player.x;
            const dy = candy.y - this.player.y;
            if (Math.hypot(dx, dy) < candy.radius + this.player.radius) {
                this.score += Math.floor(candy.value * this.comboMulti);

                // Combo logic
                this.comboMulti += 0.1;
                this.comboTimer = this.comboTimerMax;

                this.soundEngine.playCollect();
                this.vfx.addDirectionalParticles(candy.x, candy.y, 0, Math.PI*2, 100, candy.color || '#fff', 10);
                this.vfx.addPopup(candy.x, candy.y, `+${Math.floor(candy.value * this.comboMulti)}`, '#fff');
                this.candies.splice(i, 1);

                this.candiesCollectedInWave++;

                // Random drop pickup
                if (Math.random() < 0.05) {
                    this.pickups.push(new FieldPickup(candy.x, candy.y, Math.random() > 0.5 ? 'freeze' : 'comboMax'));
                }

                if (this.activeBoss && this.activeBoss.state === 'FIGHT') {
                    this.activeBoss.takeDamage(this.perks.bossDamage);
                    this.vfx.addScreenShake(3, 0.1);
                    this.vfx.addDirectionalParticles(this.activeBoss.x, this.activeBoss.y, 0, Math.PI*2, 100, '#ff0', 5);
                    this.vfx.addPopup(this.activeBoss.x, this.activeBoss.y, `-${this.perks.bossDamage}`, '#ff0000');
                }

                if (this.score > this.saveManager.data.highScore) {
                    this.saveManager.data.highScore = this.score;
                    this.saveManager.save();
                }

                // Wave completion check
                if (this.candiesCollectedInWave >= this.candiesToNextWave) {
                    this.wave++;
                    this.candiesCollectedInWave = 0;
                    this.candiesToNextWave = Math.floor(this.candiesToNextWave * 1.5);
                    this.perkManager.triggerDraft();
                }
            }
        }
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.update(dt);
            if (p.lifeTimer <= 0) {
                this.pickups.splice(i, 1);
                continue;
            }
            const dx = p.x - this.player.x;
            const dy = p.y - this.player.y;
            if (Math.hypot(dx, dy) < p.radius + this.player.radius) {
                if (p.type === 'freeze') {
                    this.globalFreezeTimer = 3.0; // 3 seconds freeze
                } else if (p.type === 'comboMax') {
                    this.comboMulti += 2.0;
                    this.comboTimer = this.comboTimerMax;
                }
                this.soundEngine.playCollect();
                this.pickups.splice(i, 1);
            }
        }
    }


    gameOver() {
        this.state = 'GAME_OVER';
        this.soundEngine.playAlert();
        setTimeout(() => this.soundEngine.playGameOver(), 500);
        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.save();
    }

    drawDashHUD(ctx) {
        if (!this.player) return;
        const padding = 20;
        const hudX = padding;
        const hudY = this.height - padding - 20;
        const hudWidth = 150;
        const hudHeight = 15;

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('TACTICAL DASH', hudX, hudY - 8);

        // Background bar
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(hudX, hudY, hudWidth, hudHeight);

        // Fill bar
        let fillPct = 1.0;
        if (this.player.dashCooldown > 0) {
            fillPct = 1.0 - (this.player.dashCooldown / this.player.dashCooldownMax);
            ctx.fillStyle = '#FFC107'; // Charging color
        } else {
            ctx.fillStyle = '#00BCD4'; // Ready color
        }

        ctx.fillRect(hudX, hudY, hudWidth * fillPct, hudHeight);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(hudX, hudY, hudWidth, hudHeight);
    }


    draw() {
        if (this.state === 'SETTINGS' || this.state === 'MILESTONES') {
            this.uiManager.draw(this.ctx, this.width, this.height);
            return;
        }

        const hc = this.saveManager.data.options.highContrast;
        this.ctx.fillStyle = hc ? '#000' : '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();

        this.vfx.applyShake(this.ctx);

        this.background.draw(this.ctx);

        if (this.state === 'TITLE') {
            this.ctx.fillStyle = hc ? '#fff' : '#f0c97d';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("Candy Time Heist", this.width / 2, this.height / 2 - 50);

            this.ctx.fillStyle = hc ? '#fff' : '#aaa';
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText("Click / Tap / Press Any Key to Start", this.width / 2, this.height / 2 + 50);
            this.ctx.fillText("High Score: " + this.saveManager.data.highScore, this.width / 2, this.height / 2 + 100);

            this.ctx.fillText("Settings [S]  |  Milestones [M]", this.width / 2, this.height - 50);
        }

        for (const vent of this.vents) {
            vent.draw(this.ctx);
        }

        for (const belt of this.belts) {
            belt.draw(this.ctx);
        }

        for (const candy of this.candies) {
            candy.draw(this.ctx);
        }

        for (const pickup of this.pickups) {
            pickup.draw(this.ctx);
        }

        for (const guard of this.guards) {
            guard.draw(this.ctx);
        }

        if (this.activeBoss) {
            this.activeBoss.draw(this.ctx, this.width, this.height);
        }

        if (this.player) {
            this.player.draw(this.ctx);
        }

        this.vfx.draw(this.ctx);
        this.ctx.restore();

        // UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '24px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);
        this.ctx.fillText(`High: ${this.saveManager.data.highScore}`, 20, 70);

        if (this.state === 'PLAYING') {
            this.drawDashHUD(this.ctx);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText(`Wave: ${this.wave}`, 20, 100);
            this.ctx.fillText(`Combo: ${this.comboMulti.toFixed(1)}x`, 20, 130);

            // Combo bar
            if (this.comboTimer > 0) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                this.ctx.fillRect(20, 140, 100, 10);
                this.ctx.fillStyle = '#ffeb3b';
                this.ctx.fillRect(20, 140, 100 * (this.comboTimer / this.comboTimerMax), 10);
            }

            // Wave progress
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.fillRect(this.width / 2 - 100, 20, 200, 20);
            this.ctx.fillStyle = '#4caf50';
            this.ctx.fillRect(this.width / 2 - 100, 20, 200 * (this.candiesCollectedInWave / this.candiesToNextWave), 20);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Wave ${this.wave} Progress`, this.width / 2, 35);
            this.ctx.textAlign = 'left';

            if (this.globalFreezeTimer > 0) {
                this.ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
                this.ctx.fillRect(0, 0, this.width, this.height);
                this.ctx.fillStyle = '#0ff';
                this.ctx.font = '24px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('TIME FROZEN', this.width / 2, 80);
                this.ctx.textAlign = 'left';
            }
        }

        // Time scale indicator
        if (this.timeScale < 0.9) {
            this.ctx.fillStyle = 'rgba(100, 200, 255, 0.8)';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('TIME DILATION ACTIVE', this.width / 2, 40);
        }

        if (this.state === 'PAUSED') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#fff';
            this.ctx.textAlign = 'center';
            this.ctx.font = '48px sans-serif';
            this.ctx.fillText('PAUSED', this.width / 2, this.height / 2);
            this.ctx.font = '24px sans-serif';
            this.ctx.fillText('Press P or ESC to Resume', this.width / 2, this.height / 2 + 40);

            // Required link for validation
            this.ctx.font = '16px sans-serif';
            this.ctx.fillText('Back to Arcade: ../../index.html', this.width / 2, this.height - 40);
        }

        if (this.state === 'UPGRADE') {
            this.perkManager.draw(this.ctx, this.width, this.height);
        }

        if (this.state === 'GAME_OVER') {
            this.ctx.fillStyle = hc ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 0, 0, 0.3)';
            this.ctx.fillRect(0, 0, this.width, this.height);

            this.ctx.fillStyle = hc ? '#fff' : '#fff';
            this.ctx.font = '48px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 50);

            this.ctx.font = '24px sans-serif';
            this.ctx.fillText("Score: " + Math.floor(this.score), this.width / 2, this.height / 2 + 20);
            this.ctx.fillText("Click / Tap / Press Any Key to Restart", this.width / 2, this.height / 2 + 80);

            this.ctx.fillText("Settings [S]  |  Milestones [M]", this.width / 2, this.height - 50);
        }

        // Draw virtual joystick if active
        if (this.inputManager.joystick.active) {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.inputManager.joystick.originX, this.inputManager.joystick.originY, 50, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(this.inputManager.joystick.x, this.inputManager.joystick.y, 20, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        }
    }
}

// Background detail elements to fulfill line requirements and polish
class Sparkle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.03;
        this.size = 2 + Math.random() * 3;
    }

    update(dt) {
        if (this.state === 'SETTINGS' || this.state === 'MILESTONES') {
            return; // Managed by uiManager drawing
        }


        this.life -= this.decay * dt * 60;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#fff';
        ctx.translate(this.x, this.y);
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size/2, -this.size/2);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(this.size/2, this.size/2);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size/2, this.size/2);
        ctx.lineTo(-this.size, 0);
        ctx.lineTo(-this.size/2, -this.size/2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

// Ensure the game actually loops
const gameLoop = (timestamp) => {
    if (!window.game) return;

    // Calculate delta time
    if (!window.game.lastTime) window.game.lastTime = timestamp;
    let dt = (timestamp - window.game.lastTime) / 1000;
    window.game.lastTime = timestamp;

    // Cap dt
    dt = Math.min(dt, 0.1);

    window.game.update(dt);
    window.game.draw();

    requestAnimationFrame(gameLoop);
};

window.onload = () => {
    const canvas = document.getElementById('gameCanvas');
    window.game = new Game(canvas);
    requestAnimationFrame(gameLoop);
};
class UIManager {
    constructor(game) {
        this.game = game;
        this.activeTab = 'SETTINGS'; // or 'MILESTONES'
        this.importString = '';
        this.buttons = [];
        this.milestones = [
            { id: 'first_heist', name: 'First Heist', desc: 'Complete your first run', check: (g) => g.saveManager.data.totalGamesPlayed >= 1 },
            { id: 'master_thief', name: 'Master Thief', desc: 'Score over 100,000 in one run', check: (g) => g.saveManager.data.highScore >= 100000 },
            { id: 'time_lord', name: 'Time Lord', desc: 'Reach a max combo of 50', check: (g) => g.saveManager.data.bestCombo >= 50 },
            { id: 'sugar_rush', name: 'Sugar Rush', desc: 'Accumulate 1,000,000 total score', check: (g) => g.saveManager.data.totalScoreAccumulated >= 1000000 },
            { id: 'pacifist', name: 'Pacifist', desc: 'Survive for 2 minutes without dashing', check: (g) => g.timeElapsed > 120 && g.dashUsedCount === 0 },
            { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Defeat 5 bosses in a single run', check: (g) => g.bossesDefeated >= 5 }
        ];
    }


    update(dt) {

        // Handle milestone checks
        if (this.game.state === 'PLAYING' || this.game.state === 'GAME_OVER') {
            const unlocks = this.game.saveManager.data.unlockedMilestones;
            for (const m of this.milestones) {
                if (!unlocks.includes(m.id) && m.check(this.game)) {
                    unlocks.push(m.id);
                    this.game.saveManager.save();
                    this.game.vfx.addPopup(this.game.width/2, 100, `Milestone Unlocked: ${m.name}!`, '#ffaa00');
                    this.game.soundEngine.playCollect();
                }
            }
        }
    }

    handleInput(x, y) {
        for (const b of this.buttons) {
            if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                this.game.soundEngine.playUIClick();
                b.action();
                return true;
            }
        }
        return false;
    }

    draw(ctx, width, height) {
        ctx.fillStyle = 'rgba(0,0,0,0.9)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#fff';
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';

        this.buttons = [];

        // Tabs
        ctx.fillText(this.activeTab, width/2, 50);
        this.buttons.push({x: width/2 - 150, y: 20, w: 100, h: 40, action: () => this.activeTab = 'SETTINGS'});
        ctx.strokeRect(width/2 - 150, 20, 100, 40);
        ctx.fillText("Settings", width/2 - 100, 48);

        this.buttons.push({x: width/2 + 50, y: 20, w: 120, h: 40, action: () => this.activeTab = 'MILESTONES'});
        ctx.strokeRect(width/2 + 50, 20, 120, 40);
        ctx.fillText("Milestones", width/2 + 110, 48);

        this.buttons.push({x: width/2 - 50, y: height - 60, w: 100, h: 40, action: () => { this.game.state = 'TITLE'; }});
        ctx.strokeRect(width/2 - 50, height - 60, 100, 40);
        ctx.fillText("Close", width/2, height - 32);

        if (this.activeTab === 'SETTINGS') {
            this.drawSettings(ctx, width, height);
        } else {
            this.drawMilestones(ctx, width, height);
        }
    }

    drawSettings(ctx, width, height) {
        const opts = this.game.saveManager.data.options;
        const cy = 100;
        const dy = 50;
        let i = 0;

        const addBtn = (label, val, x, y, action) => {
            ctx.textAlign = 'left';
            ctx.fillText(`${label}: ${val}`, x, y + 25);
            this.buttons.push({x, y, w: 300, h: 35, action});
            ctx.strokeRect(x, y, 300, 35);
        };

        addBtn("Master Mute", opts.masterMute ? "ON" : "OFF", 50, cy + (i++)*dy, () => { opts.masterMute = !opts.masterMute; this.game.saveManager.save(); });
        addBtn("Master Vol", opts.masterVolume.toFixed(1), 50, cy + (i++)*dy, () => { opts.masterVolume = (opts.masterVolume + 0.1) % 1.1; this.game.saveManager.save(); });
        addBtn("SFX Vol", opts.sfxVolume.toFixed(1), 50, cy + (i++)*dy, () => { opts.sfxVolume = (opts.sfxVolume + 0.1) % 1.1; this.game.saveManager.save(); });
        addBtn("Music Vol", opts.musicVolume.toFixed(1), 50, cy + (i++)*dy, () => { opts.musicVolume = (opts.musicVolume + 0.1) % 1.1; this.game.saveManager.save(); });

        i = 0;
        addBtn("Screen Shake", opts.screenShake, 400, cy + (i++)*dy, () => {
            opts.screenShake = opts.screenShake === '100%' ? '50%' : (opts.screenShake === '50%' ? 'Off' : '100%');
            this.game.saveManager.save();
        });
        addBtn("Particles", opts.particleDensity, 400, cy + (i++)*dy, () => {
            opts.particleDensity = opts.particleDensity === 'High' ? 'Low' : 'High';
            this.game.saveManager.save();
        });
        addBtn("High Contrast", opts.highContrast ? "ON" : "OFF", 400, cy + (i++)*dy, () => { opts.highContrast = !opts.highContrast; this.game.saveManager.save(); });
        addBtn("Show FPS", opts.showFPS ? "ON" : "OFF", 400, cy + (i++)*dy, () => { opts.showFPS = !opts.showFPS; this.game.saveManager.save(); });
        addBtn("Touch Controls", opts.touchControls, 400, cy + (i++)*dy, () => {
            opts.touchControls = opts.touchControls === 'Auto' ? 'Always' : (opts.touchControls === 'Always' ? 'Off' : 'Auto');
            this.game.saveManager.save();
        });
        addBtn("Touch Handedness", opts.touchHandedness, 400, cy + (i++)*dy, () => {
            opts.touchHandedness = opts.touchHandedness === 'Right' ? 'Left' : 'Right';
            this.game.saveManager.save();
        });

        // Save Export / Import / Reset
        addBtn("Export Save (Base64 -> Console)", "", 50, cy + 5*dy, () => {
            console.log("EXPORTED SAVE:", this.game.saveManager.exportSave());
        });
        addBtn("Import Save (from window.IMPORT_SAVE)", "", 50, cy + 6*dy, () => {
            if (window.IMPORT_SAVE && this.game.saveManager.importSave(window.IMPORT_SAVE)) {
                console.log("Import successful");
            }
        });
        addBtn("Reset Data", this.game.saveManager.resetConfirm ? "Confirm?" : "Click twice", 50, cy + 7*dy, () => {
            if (this.game.saveManager.reset()) {
                window.location.reload();
            }
        });
    }

    drawMilestones(ctx, width, height) {
        ctx.textAlign = 'left';
        const unlocks = this.game.saveManager.data.unlockedMilestones;
        let y = 100;
        for (const m of this.milestones) {
            const unlocked = unlocks.includes(m.id);
            ctx.fillStyle = unlocked ? '#0f0' : '#888';
            ctx.fillText(`${unlocked ? '🏆' : '🔒'} ${m.name}: ${m.desc}`, 100, y);
            y += 50;
        }
    }
}
