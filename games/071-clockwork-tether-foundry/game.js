
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }
    sub(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }
    mult(n) {
        return new Vector2(this.x * n, this.y * n);
    }
    div(n) {
        return new Vector2(this.x / n, this.y / n);
    }
    mag() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    magSq() {
        return this.x * this.x + this.y * this.y;
    }
    normalize() {
        const m = this.mag();
        if (m !== 0) {
            return this.div(m);
        }
        return new Vector2(0, 0);
    }
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    cross(v) {
        return this.x * v.y - this.y * v.x;
    }
    dist(v) {
        const dx = this.x - v.x;
        const dy = this.y - v.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    copy() {
        return new Vector2(this.x, this.y);
    }
}

class WaveManager {
    constructor() {
        this.waveSettings = [
            { wave: 1, nextBossScore: 500, spawnRate: 3.0, bossHpMult: 1.0, weights: { swarmer: 0.8, sniper: 0.2, bruiser: 0.0, spawner: 0.0, denial: 0.0 } },
            { wave: 2, nextBossScore: 1200, spawnRate: 2.5, bossHpMult: 1.2, weights: { swarmer: 0.6, sniper: 0.3, bruiser: 0.1, spawner: 0.0, denial: 0.0 } },
            { wave: 3, nextBossScore: 2200, spawnRate: 2.2, bossHpMult: 1.5, weights: { swarmer: 0.5, sniper: 0.2, bruiser: 0.2, spawner: 0.1, denial: 0.0 } },
            { wave: 4, nextBossScore: 3500, spawnRate: 2.0, bossHpMult: 1.8, weights: { swarmer: 0.4, sniper: 0.2, bruiser: 0.2, spawner: 0.1, denial: 0.1 } },
            { wave: 5, nextBossScore: 5000, spawnRate: 1.8, bossHpMult: 2.2, weights: { swarmer: 0.3, sniper: 0.2, bruiser: 0.2, spawner: 0.15, denial: 0.15 } }
        ];
        this.tutorialState = {
            tetherShown: false,
            dashShown: false
        };
        this.tutorialTimer = 0;
    }

    getWaveSettings(waveCount) {
        let maxWave = this.waveSettings[this.waveSettings.length - 1];
        if (waveCount > maxWave.wave) {
            let mult = (waveCount - maxWave.wave);
            return {
                wave: waveCount,
                nextBossScore: maxWave.nextBossScore + mult * 2000,
                spawnRate: Math.max(0.5, maxWave.spawnRate - mult * 0.1),
                bossHpMult: maxWave.bossHpMult + mult * 0.5,
                weights: { swarmer: 0.2, sniper: 0.2, bruiser: 0.2, spawner: 0.2, denial: 0.2 }
            };
        }
        return this.waveSettings.find(w => w.wave === waveCount) || maxWave;
    }

    getSpawnClass(waveCount) {
        let settings = this.getWaveSettings(waveCount);
        let r = Math.random();
        let w = settings.weights;
        if (r < w.swarmer) return SwarmerEnemy;
        r -= w.swarmer;
        if (r < w.sniper) return SniperEnemy;
        r -= w.sniper;
        if (r < w.bruiser) return ShieldedBruiser;
        r -= w.bruiser;
        if (r < w.spawner) return SpawnerEnemy;
        return AreaDenialEnemy;
    }

    updateTutorial(dt, game) {
        if (game.waveCount === 1) {
            this.tutorialTimer += dt;
            if (this.tutorialTimer > 2.0 && !game.player.tethered && !this.tutorialState.tetherShown) {
                // Time to show tether tutorial
            }
            if (game.player.tethered) this.tutorialState.tetherShown = true;
            if (game.player.dashCooldown > 0) this.tutorialState.dashShown = true;
        }
    }

    drawTutorial(ctx, game) {
        if (game.waveCount === 1) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '20px monospace';
            ctx.textAlign = 'center';
            if (!this.tutorialState.tetherShown && this.tutorialTimer > 1.0) {
                ctx.fillText("Click or Space to fire Tether at Grapple Points!", game.width / 2, game.height / 2 + 100);
            } else if (this.tutorialState.tetherShown && !this.tutorialState.dashShown && this.tutorialTimer > 3.0) {
                ctx.fillText("Right-Click or Shift to Dash towards mouse!", game.width / 2, game.height / 2 + 100);
            }
            ctx.restore();
        }
    }
}

class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_071_071-clockwork-tether-foundry_v1';
        this.data = {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: { mute: false, sfxVolume: 1, musicVolume: 1, shakeIntensity: 100 }
        };
        this.load();
    }
    load() {
        try {
            const stored = localStorage.getItem(this.saveKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                this.data = { ...this.data, ...parsed };
            }
        } catch (e) {
            console.warn('Save load failed', e);
        }
    }
    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn('Save failed', e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Dynamic state
        this.bossActive = false;
        this.lowHp = false;
        this.musicFilter = null;

        // Sequencer state
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.tempo = 110;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        // Arp sequence
        this.arpSequence = [ 261.63, null, 311.13, 392.00, 523.25, null, 392.00, 311.13,
                             261.63, 261.63, 311.13, 392.00, 523.25, 622.25, 523.25, 392.00 ]; // C minor
        this.bassSequence = [ 65.41, 65.41, 65.41, 65.41, 77.78, 77.78, 77.78, 77.78,
                              58.27, 58.27, 58.27, 58.27, 73.42, 73.42, 73.42, 73.42 ];
        this.drumSequence = [ 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 1, 0, 2, 0, 0, 0 ]; // 1=Kick, 2=Snare
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();
            this.musicFilter = this.ctx.createBiquadFilter();

            this.musicFilter.type = 'lowpass';
            this.musicFilter.frequency.value = 1000;

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.musicFilter);
            this.musicFilter.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.masterGain.gain.value = 0.5;
            this.initialized = true;

            this.startMusicLoop();
        } catch (e) {
            console.warn('AudioContext init failed', e);
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Music Sequencer Loop
    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        if (!this.initialized || !this.ctx) return;

        // Update state based on game
        const targetFreq = this.bossActive ? 3000 : 1000;
        const currentFreq = this.musicFilter.frequency.value;
        if (Math.abs(targetFreq - currentFreq) > 1) {
            this.musicFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 1.0);
        }

        const targetTempo = this.lowHp ? 130 : 110;
        if (this.tempo !== targetTempo) {
            this.tempo += (targetTempo - this.tempo) * 0.1;
        }

        // Play Drum
        const drumType = this.drumSequence[beatNumber];
        if (drumType === 1) {
            this.playKick(time);
        } else if (drumType === 2) {
            this.playSnare(time);
        }

        // Play Bass
        const bassFreq = this.bassSequence[beatNumber];
        if (bassFreq) {
            this.playSynthNote(bassFreq, 'sawtooth', 0.15, 0.3, time, this.musicGain);
        }

        // Play Arp
        const arpFreq = this.arpSequence[beatNumber];
        if (arpFreq) {
            const vol = this.bossActive ? 0.2 : 0.1;
            this.playSynthNote(arpFreq, 'square', 0.1, vol, time, this.musicGain);
        }
    }

    scheduler() {
        if (!this.initialized || !this.ctx) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
    }

    startMusicLoop() {
        if (this.timerID) clearInterval(this.timerID);
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.timerID = setInterval(() => this.scheduler(), this.lookahead);
    }

    musicUpdate(dt, game) {
        if (game.bossActive !== undefined) this.bossActive = game.bossActive;
        if (game.player && game.player.hp !== undefined && game.player.maxHp !== undefined) {
            this.lowHp = (game.player.hp <= game.player.maxHp * 0.3);
        } else if (game.player && game.player.invulnerableTimer > 0) {
            // Using invulnerable timer or dash state as proxy if no HP
             this.lowHp = (game.player.invulnerableTimer > 0.5);
        } else {
             this.lowHp = false;
        }
    }

    playSynthNote(freq, type, duration, vol, time, destGain) {
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(vol, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            osc.connect(gain);
            gain.connect(destGain);
            osc.start(time);
            osc.stop(time + duration);
            osc.onended = () => {
                try { osc.disconnect(); gain.disconnect(); } catch (e) {}
            };
        } catch (e) {}
    }

    playKick(time) {
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
            gain.gain.setValueAtTime(0.7, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            osc.connect(gain);
            gain.connect(this.musicGain);
            osc.start(time);
            osc.stop(time + 0.1);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch(e){}
    }

    playSnare(time) {
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';

            // Noise burst simulation
            const bufferSize = this.ctx.sampleRate * 0.1;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;

            noise.connect(noiseFilter);
            noiseFilter.connect(gain);

            gain.gain.setValueAtTime(0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            gain.connect(this.musicGain);

            noise.start(time);
            noise.stop(time + 0.1);
            noise.onended = () => { try { noise.disconnect(); gain.disconnect(); filter.disconnect(); } catch(e){} };
        } catch(e){}
    }

    playTone(freq, type = 'sine', duration = 0.1, vol = 0.5) {
        if (!this.initialized || !this.ctx) return;
        this.playSynthNote(freq, type, duration, vol, this.ctx.currentTime, this.sfxGain);
    }

    // SFX
    playGrappleShoot() { this.playTone(600, 'square', 0.1, 0.3); }
    playGrappleAttach() { this.playTone(800, 'sawtooth', 0.05, 0.4); }
    playDashThrust() {
        if (!this.initialized || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(300, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch(e){}
    }
    playSynthHurt() { this.playTone(150, 'sawtooth', 0.3, 0.6); }
    playEnemyHit() { this.playTone(400, 'square', 0.1, 0.4); }
    playEnemyDeath() { this.playTone(100, 'triangle', 0.2, 0.5); }
    playBossSpawn() { this.playTone(200, 'sawtooth', 1.0, 0.7); }
    playPickup() { this.playTone(900, 'sine', 0.15, 0.4); }
    playMenuClick() { this.playTone(500, 'sine', 0.05, 0.3); }
    playWeaponFire() { this.playTone(700, 'square', 0.1, 0.3); }

    // Legacy overrides
    playJump() { this.playTone(400, 'square', 0.15, 0.3); }
    playGrapple() { this.playGrappleAttach(); }
    playScore() { this.playPickup(); }
    playHurt() { this.playSynthHurt(); }
    playTetherGrow() { this.playTone(1000, 'triangle', 0.05, 0.1); }
    playDash() { this.playDashThrust(); }
    playLevelUp() {
        this.playTone(400, 'square', 0.2, 0.2);
        setTimeout(() => this.playTone(600, 'square', 0.2, 0.3), 100);
        setTimeout(() => this.playTone(800, 'square', 0.2, 0.4), 200);
    }
}

class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.prevKeys = {};
        this.mouse = { x: 0, y: 0, down: false, justDown: false, rightDown: false, rightJustDown: false };
        this.touch = { active: false, x: 0, y: 0 };
        this.initListeners();
    }
    initListeners() {
        this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
        });
        this.canvas.addEventListener('mousedown', e => {
            this.updateMousePos(e);
            if (e.button === 2) {
                this.mouse.rightDown = true;
                this.mouse.rightJustDown = true;
            } else {
                this.mouse.down = true;
                this.mouse.justDown = true;
            }
        });
        this.canvas.addEventListener('mousemove', e => {
            this.updateMousePos(e);
        });
        this.canvas.addEventListener('mouseup', e => {
            if (e.button === 2) {
                this.mouse.rightDown = false;
            } else {
                this.mouse.down = false;
            }
        });
        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            this.touch.active = true;
            this.mouse.down = true;
            this.mouse.justDown = true;
            this.updateTouchPos(e);
        }, { passive: false });
        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            this.updateTouchPos(e);
        }, { passive: false });
        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            this.touch.active = false;
            this.mouse.down = false;
        }, { passive: false });
    }
    updateMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
        this.mouse.y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    }
    updateTouchPos(e) {
        if (e.touches.length > 0) {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = (e.touches[0].clientX - rect.left) * (this.canvas.width / rect.width);
            this.mouse.y = (e.touches[0].clientY - rect.top) * (this.canvas.height / rect.height);
        }
    }
    update() {
        this.prevKeys = { ...this.keys };
        this.mouse.justDown = false;
        this.mouse.rightJustDown = false;
    }
    isKeyDown(code) { return !!this.keys[code]; }
    isKeyJustPressed(code) { return !!this.keys[code] && !this.prevKeys[code]; }
}

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 12;
        this.tethered = false;
        this.tetherPoint = null;
        this.tetherLength = 0;
        this.angle = 0;
        this.angularVel = 0;
        this.gravity = 800;
        this.color = '#a04e7e';
        this.tail = [];
        this.tailMaxLength = 10;
        this.scoreMultiplier = 1;

        this.dashCooldown = 0;
        this.dashActive = 0;
        this.dashDuration = 0.2;
        this.dashCooldownMax = 1.5;
        this.dashVelocity = 1500;
        this.invulnerableTimer = 0;
    }
    update(dt, game) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashActive > 0) {
            this.dashActive -= dt;
            this.invulnerableTimer = Math.max(this.invulnerableTimer, 0.1);
        }
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        if (this.dashActive > 0 || this.tethered) {
            game.vfx.addAfterimage(this.x, this.y, this.radius, '#00ffff');
            if (this.dashActive > 0) {
                game.vfx.emitDirectional(this.x, this.y, 1, '#ffaa00', -this.vx, -this.vy, 0.2, 2);
            }
        }

        // Tail tracking
        this.tail.push({x: this.x, y: this.y});
        if (this.tail.length > this.tailMaxLength) {
            this.tail.shift();
        }

        if (this.tethered && this.tetherPoint) {
            // Pendulum physics
            const dx = this.x - this.tetherPoint.x;
            const dy = this.y - this.tetherPoint.y;
            this.angle = Math.atan2(dy, dx);

            // Allow risk/reward tether growth - the longer the tether, the more points, but harder to control
            if (game.input.isKeyDown('Space') || game.input.mouse.down) {
                this.tetherLength += 150 * dt; // Grow tether
                if (Math.random() < 0.1) game.sound.playTetherGrow();
                this.scoreMultiplier = 1 + Math.floor(this.tetherLength / 50);
            } else {
                this.scoreMultiplier = 1;
            }

            // Gravity affects angular velocity
            const gravityForce = (this.gravity / this.tetherLength) * Math.cos(this.angle);
            this.angularVel -= gravityForce * dt;

            // Dampening
            if (this.dashActive <= 0) {
                this.angularVel *= 0.999;
            }

            this.angle += this.angularVel * dt;

            // Convert polar to cartesian
            this.x = this.tetherPoint.x + this.tetherLength * Math.cos(this.angle);
            this.y = this.tetherPoint.y + this.tetherLength * Math.sin(this.angle);

            // Calculate actual velocity for when tether is released
            this.vx = -this.tetherLength * this.angularVel * Math.sin(this.angle);
            this.vy = this.tetherLength * this.angularVel * Math.cos(this.angle);

            // Score generation over time while tethered
            game.score += (10 * this.scoreMultiplier) * dt;

        } else {
            // Free fall physics
            this.vy += this.gravity * dt;

            // Air resistance
            if (this.dashActive <= 0) {
                this.vx *= 0.99;
                this.vy *= 0.99;
            }

            this.x += this.vx * dt;
            this.y += this.vy * dt;

            this.scoreMultiplier = 1;
        }

        // Screen boundaries (bounce)
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx *= -0.5;
        } else if (this.x > game.width - this.radius) {
            this.x = game.width - this.radius;
            this.vx *= -0.5;
        }

        // Floor / Ceiling bounce
        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy *= -0.5;
        } else if (this.y > game.height - this.radius) {
            this.y = game.height - this.radius;
            this.vy *= -0.5;
            // Un-tether if hit floor
            if (this.tethered) this.releaseTether();
        }
    }

    fireTether(point, game) {
        this.tetherPoint = point;
        this.tethered = true;
        const dx = this.x - point.x;
        const dy = this.y - point.y;
        this.tetherLength = Math.sqrt(dx * dx + dy * dy);
        this.angle = Math.atan2(dy, dx);

        // Calculate initial angular velocity from linear velocity
        // v = r * w => w = v/r
        // Project velocity onto the tangent of the pendulum arc
        const tangentX = -Math.sin(this.angle);
        const tangentY = Math.cos(this.angle);
        const tangentVel = this.vx * tangentX + this.vy * tangentY;

        this.angularVel = tangentVel / this.tetherLength;
        game.sound.playGrappleShoot();
    }

    releaseTether() {
        this.tethered = false;
        this.tetherPoint = null;
    }

    triggerDash(targetX, targetY, game) {
        if (this.dashCooldown <= 0) {
            this.dashCooldown = this.dashCooldownMax;
            this.dashActive = this.dashDuration;

            if (this.tethered && this.tetherPoint) {
                this.angularVel += (this.angularVel >= 0 ? 1 : -1) * (this.dashVelocity / this.tetherLength);
            } else {
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const angle = Math.atan2(dy, dx);
                this.vx = Math.cos(angle) * this.dashVelocity;
                this.vy = Math.sin(angle) * this.dashVelocity;
            }
            game.sound.playDashThrust();
        }
    }

    draw(ctx) {
        // Draw tether
        if (this.tethered && this.tetherPoint) {
            ctx.beginPath();
            ctx.moveTo(this.tetherPoint.x, this.tetherPoint.y);
            ctx.lineTo(this.x, this.y);
            ctx.strokeStyle = `rgba(160, 78, 126, ${0.5 + Math.random() * 0.5})`;
            ctx.lineWidth = 2 + (this.scoreMultiplier - 1);
            ctx.stroke();

            // Draw multiplier text
            ctx.fillStyle = '#fff';
            ctx.font = '12px monospace';
            ctx.fillText(`x${this.scoreMultiplier}`, this.x + 15, this.y - 15);
        }

        // Draw tail
        ctx.beginPath();
        if (this.tail.length > 0) {
            ctx.moveTo(this.tail[0].x, this.tail[0].y);
            for(let i=1; i<this.tail.length; i++) {
                ctx.lineTo(this.tail[i].x, this.tail[i].y);
            }
        }
        ctx.strokeStyle = '#a04e7e';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Draw player body (steampunk gear-like)
        ctx.save();
        ctx.translate(this.x, this.y);

        let visualAngle = 0;
        if (this.tethered) {
            visualAngle = this.angle;
        } else {
            visualAngle = Math.atan2(this.vy, this.vx);
        }
        ctx.rotate(visualAngle);

        if (this.invulnerableTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Thrust flame if dashing
        if (this.dashActive > 0) {
            ctx.beginPath();
            ctx.moveTo(-this.radius, 0);
            ctx.lineTo(-this.radius - 20 - Math.random() * 10, -5);
            ctx.lineTo(-this.radius - 10, 0);
            ctx.lineTo(-this.radius - 20 - Math.random() * 10, 5);
            ctx.closePath();
            ctx.fillStyle = '#ffaa00';
            ctx.fill();
        }

        // Recoil effect
        const recoilOffset = (this.dashActive > 0) ? -5 : 0;
        ctx.translate(recoilOffset, 0);

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = (this.dashCooldown > 0 && this.dashActive <= 0) ? '#aaa' : '#fff';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner gear detail
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.restore();
    }
}

class GrapplePoint {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 2;
    }
    update(dt) {
        this.rotation += this.rotSpeed * dt;
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw gear
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r1 = this.radius;
            const r2 = this.radius * 1.3;
            ctx.lineTo(Math.cos(a - 0.1) * r1, Math.sin(a - 0.1) * r1);
            ctx.lineTo(Math.cos(a - 0.1) * r2, Math.sin(a - 0.1) * r2);
            ctx.lineTo(Math.cos(a + 0.1) * r2, Math.sin(a + 0.1) * r2);
            ctx.lineTo(Math.cos(a + 0.1) * r1, Math.sin(a + 0.1) * r1);
        }
        ctx.closePath();
        ctx.fillStyle = '#a87a51'; // Steampunk brass
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner hole
        ctx.beginPath();
        ctx.arc(0, 0, this.radius / 3, 0, Math.PI * 2);
        ctx.fillStyle = '#222';
        ctx.fill();

        ctx.restore();
    }
}

class Hazard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.time = Math.random() * 100;
        this.startX = x;
        this.startY = y;
        this.amp = 50 + Math.random() * 100;
        this.speed = 1 + Math.random() * 2;
        this.horizontal = Math.random() > 0.5;
    }
    update(dt) {
        this.time += dt * this.speed;
        if (this.horizontal) {
            this.x = this.startX + Math.sin(this.time) * this.amp;
        } else {
            this.y = this.startY + Math.cos(this.time) * this.amp;
        }
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.time * 5);
        ctx.beginPath();
        // Spiky gear
        for(let i=0; i<6; i++) {
            const a = (i / 6) * Math.PI * 2;
            ctx.lineTo(Math.cos(a)*this.radius*1.5, Math.sin(a)*this.radius*1.5);
            ctx.lineTo(Math.cos(a+0.5)*this.radius, Math.sin(a+0.5)*this.radius);
        }
        ctx.closePath();
        ctx.fillStyle = '#e53935';
        ctx.fill();
        ctx.restore();
    }
}

class ParallaxEnvironment {
    constructor(game) {
        this.game = game;
        this.gears = [];
        for(let i=0; i<8; i++) {
            this.gears.push({
                x: Math.random() * game.width,
                y: Math.random() * game.height,
                radius: 50 + Math.random() * 150,
                speed: (Math.random() - 0.5) * 0.5,
                angle: Math.random() * Math.PI * 2,
                depth: 0.2 + Math.random() * 0.3
            });
        }
        this.steam = [];
        for(let i=0; i<10; i++) {
            this.steam.push({
                x: Math.random() * game.width,
                y: Math.random() * game.height,
                radius: 40 + Math.random() * 80,
                speedX: 10 + Math.random() * 20,
                depth: 0.5 + Math.random() * 0.5
            });
        }
        this.pipes = [];
        for(let i=0; i<5; i++) {
            this.pipes.push({
                x: Math.random() * game.width,
                width: 30 + Math.random() * 40,
                depth: 1.2
            });
        }
    }
    update(dt) {
        for (let g of this.gears) {
            g.angle += g.speed * dt;
        }
        for (let s of this.steam) {
            s.x += s.speedX * dt;
            if (s.x - s.radius > this.game.width) {
                s.x = -s.radius;
                s.y = Math.random() * this.game.height;
            }
        }
    }
    draw(ctx, cameraX, cameraY) {
        // Distant Gears
        ctx.strokeStyle = '#2a2a35';
        ctx.lineWidth = 2;
        for (let g of this.gears) {
            let px = g.x - cameraX * g.depth;
            let py = g.y - cameraY * g.depth;
            // Wrap around
            px = ((px % this.game.width) + this.game.width) % this.game.width;
            py = ((py % this.game.height) + this.game.height) % this.game.height;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(g.angle);
            ctx.beginPath();
            ctx.arc(0, 0, g.radius, 0, Math.PI*2);
            for(let i=0; i<6; i++){
                ctx.moveTo(0,0);
                ctx.lineTo(Math.cos(i*Math.PI/3)*g.radius, Math.sin(i*Math.PI/3)*g.radius);
            }
            ctx.stroke();
            ctx.restore();
        }

        // Mid-ground Steam
        ctx.fillStyle = 'rgba(200, 200, 220, 0.05)';
        for (let s of this.steam) {
            let px = s.x - cameraX * s.depth;
            let py = s.y - cameraY * s.depth;
            px = ((px % this.game.width) + this.game.width) % this.game.width;

            ctx.beginPath();
            ctx.arc(px, py, s.radius, 0, Math.PI*2);
            ctx.fill();
        }

        // Foreground Pipes
        ctx.fillStyle = '#1e1e24';
        ctx.strokeStyle = '#3a3a45';
        ctx.lineWidth = 2;
        for (let p of this.pipes) {
            let px = p.x - cameraX * p.depth;
            px = ((px % this.game.width) + this.game.width) % this.game.width;
            ctx.fillRect(px, 0, p.width, this.game.height);
            ctx.strokeRect(px, 0, p.width, this.game.height);
        }
    }
}

class SteamVent {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = false;
        this.timer = Math.random() * 3;
        this.activeDuration = 2;
        this.inactiveDuration = 3;
        this.force = -1500;
        this.particles = [];
    }
    update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) {
            this.active = !this.active;
            this.timer = this.active ? this.activeDuration : this.inactiveDuration;
        }

        if (this.active) {
            this.particles.push({
                x: this.x + Math.random() * this.width,
                y: this.y + this.height,
                vy: -200 - Math.random() * 200,
                life: 1.0
            });
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }
    apply(player, dt) {
        if (this.active && player.x > this.x && player.x < this.x + this.width && player.y > this.y && player.y < this.y + this.height) {
            player.vy += this.force * dt;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x, this.y + this.height - 10, this.width, 10);

        if (this.active) {
            ctx.fillStyle = 'rgba(200, 200, 220, 0.4)';
            for (let p of this.particles) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 + (1 - p.life) * 10, 0, Math.PI*2);
                ctx.fill();
            }
        }
    }
}

class ConveyorBelt {
    constructor(x, y, width) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = 20;
        this.speed = (Math.random() > 0.5 ? 1 : -1) * 200;
        this.offset = 0;
    }
    update(dt) {
        this.offset = (this.offset + this.speed * dt) % 20;
    }
    apply(player, dt) {
        if (player.y + player.radius > this.y && player.y - player.radius < this.y + this.height &&
            player.x > this.x && player.x < this.x + this.width) {
            player.x += this.speed * dt;
        }
    }
    draw(ctx) {
        ctx.fillStyle = '#444';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#666';
        for (let i = 0; i < this.width; i += 20) {
            let lineX = this.x + ((i + this.offset + 20) % 20) + i;
            if (lineX < this.x + this.width) {
                 ctx.fillRect(lineX, this.y, 5, this.height);
            }
        }
    }
}

class DestructibleCover {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.destroyed = false;
        this.fragments = [];
    }
    update(dt) {
        if (this.destroyed) {
            for (let f of this.fragments) {
                f.x += f.vx * dt;
                f.y += f.vy * dt;
                f.vy += 800 * dt; // gravity
                f.life -= dt;
            }
            this.fragments = this.fragments.filter(f => f.life > 0);
        }
    }
    checkCollision(player) {
        if (this.destroyed) return;

        if (player.x + player.radius > this.x && player.x - player.radius < this.x + this.width &&
            player.y + player.radius > this.y && player.y - player.radius < this.y + this.height) {

            if (player.dashActive > 0) {
                this.destroyed = true;
                for(let i=0; i<10; i++) {
                    this.fragments.push({
                        x: this.x + Math.random() * this.width,
                        y: this.y + Math.random() * this.height,
                        vx: (Math.random() - 0.5) * 400 + player.vx * 0.5,
                        vy: (Math.random() - 0.5) * 400 + player.vy * 0.5,
                        life: 1 + Math.random()
                    });
                }
            } else {
                let overlapLeft = (player.x + player.radius) - this.x;
                let overlapRight = (this.x + this.width) - (player.x - player.radius);
                let overlapTop = (player.y + player.radius) - this.y;
                let overlapBottom = (this.y + this.height) - (player.y - player.radius);

                let min = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (min === overlapLeft) { player.x = this.x - player.radius; player.vx *= -0.5; }
                else if (min === overlapRight) { player.x = this.x + this.width + player.radius; player.vx *= -0.5; }
                else if (min === overlapTop) { player.y = this.y - player.radius; player.vy *= -0.5; }
                else if (min === overlapBottom) { player.y = this.y + this.height + player.radius; player.vy *= -0.5; }
            }
        }
    }
    draw(ctx) {
        if (!this.destroyed) {
            ctx.fillStyle = '#8a5a44';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height);
            ctx.moveTo(this.x + this.width, this.y);
            ctx.lineTo(this.x, this.y + this.height);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#8a5a44';
            for (let f of this.fragments) {
                ctx.globalAlpha = f.life;
                ctx.fillRect(f.x, f.y, 8, 8);
            }
            ctx.globalAlpha = 1.0;
        }
    }
}

class Engine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = 800;
        this.height = 600;
        this.state = 'TITLE'; // TITLE, PLAYING, PAUSED, GAME_OVER

        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();
        this.input = new InputManager(this.canvas);

        this.ui = new UI(this);

        this.lastTime = 0;
        this.score = 0;

        this.player = null;
        this.grapplePoints = [];
        this.hazards = [];
        this.enemies = [];

        this.nextBossScore = 500;
        this.bossActive = false;
        this.bossWarningTimer = 0;
        this.bossesKilled = 0;
        this.bossSpawnType = 0;
        this.bosses = [];
        this.enemySpawnTimer = 3.0;

        this.upgradeSystem = new UpgradeSystem();
        this.waveManager = new WaveManager();
        this.upgradeDraft = null;
        this.waveCount = 1;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.baseScoreMultiplier = 1;
        this.comboDecayRate = 1;
        this.pickups = [];

        this.env = new ParallaxEnvironment(this);
        this.steamVents = [];
        this.conveyors = [];
        this.covers = [];

        this.vfx = new VFXManager();

        this.setupResizeObserver();
        this.bindEvents();

        requestAnimationFrame(t => this.loop(t));
    }

    setupResizeObserver() {
        const resize = () => {
            const parent = this.canvas.parentElement;
            this.width = parent.clientWidth;
            this.height = parent.clientHeight;
            this.canvas.width = this.width;
            this.canvas.height = this.height;
        };
        const ro = new ResizeObserver(resize);
        ro.observe(this.canvas.parentElement);
        resize();
    }

    bindEvents() {
        window.addEventListener('keydown', e => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
                e.preventDefault();
            }
            if (e.code === 'Escape' || e.code === 'KeyP') {
                if (this.state === 'PLAYING') this.state = 'PAUSED';
                else if (this.state === 'PAUSED') {
                    if (this.ui && this.ui.showSettings) {
                        this.ui.showSettings = false;
                    } else {
                        this.state = 'PLAYING';
                    }
                }
            }
        });

        // Interaction starts audio
        const startInteraction = () => {
            this.sound.init();
            this.sound.resume();
        };
        window.addEventListener('mousedown', startInteraction, {once: true});
        window.addEventListener('keydown', startInteraction, {once: true});
        window.addEventListener('touchstart', startInteraction, {once: true});

        // Auto-pause
        window.addEventListener('blur', () => {
            if (this.state === 'PLAYING') this.state = 'PAUSED';
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.state === 'PLAYING') this.state = 'PAUSED';
        });
    }

    resetGame() {
        this.score = 0;
        this.player = new Player(this.width / 2, 50);
        // Moving gears can enter the spawn area immediately. Give each new run
        // one second to react, using the existing blinking protection effect.
        this.player.invulnerableTimer = 1.0;

        this.grapplePoints = [];
        this.hazards = [];
        this.enemies = [];
        this.pickups = [];
        this.waveCount = 1;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.upgradeDraft = null;
        this.nextBossScore = 500;
        this.bossesKilled = 0;
        this.bossActive = false;
        this.bosses = [];

        // Generate procedural steampunk factory layout
        for (let i = 0; i < 15; i++) {
            this.grapplePoints.push(new GrapplePoint(
                100 + Math.random() * (this.width - 200),
                100 + Math.random() * (this.height - 200)
            ));
        }

        for (let i = 0; i < 10; i++) {
            this.hazards.push(new Hazard(
                50 + Math.random() * (this.width - 100),
                150 + Math.random() * (this.height - 200)
            ));
        }

        this.steamVents = [];
        for (let i = 0; i < 3; i++) {
            this.steamVents.push(new SteamVent(
                100 + Math.random() * (this.width - 200),
                200 + Math.random() * (this.height - 300),
                80 + Math.random() * 100,
                300
            ));
        }

        this.conveyors = [];
        for (let i = 0; i < 2; i++) {
            this.conveyors.push(new ConveyorBelt(
                50 + Math.random() * (this.width - 300),
                this.height - 20,
                200 + Math.random() * 200
            ));
        }

        this.covers = [];
        for (let i = 0; i < 5; i++) {
            this.covers.push(new DestructibleCover(
                100 + Math.random() * (this.width - 200),
                100 + Math.random() * (this.height - 200),
                40 + Math.random() * 40,
                100 + Math.random() * 100
            ));
        }

        this.enemies.push(new SwarmerEnemy(this.width * 0.2, this.height * 0.2));
        this.enemies.push(new SniperEnemy(this.width * 0.8, this.height * 0.2));
        this.enemies.push(new ShieldedBruiser(this.width * 0.5, this.height * 0.5));
        this.enemies.push(new SpawnerEnemy(this.width * 0.2, this.height * 0.8));
        this.enemies.push(new AreaDenialEnemy(this.width * 0.8, this.height * 0.8));

        this.saveManager.data.totalGamesPlayed++;
        this.saveManager.save();
    }

    start() {
        this.resetGame();
        this.state = 'PLAYING';
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (dt > 0.1) dt = 0.1;

        this.lastDt = dt;
        this.update(dt);
        this.draw();
        this.input.update();

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        if (this.sound && this.sound.musicUpdate) {
            this.sound.musicUpdate(dt, this);
        }
        if (this.ui) this.ui.update(dt);

        this.vfx.update(dt, this);
        if (this.vfx.hitStop > 0) return;

        if (this.state === 'TITLE') {
            if (this.input.isKeyJustPressed('Space') || this.input.mouse.justDown) {
                this.start();
            }
        } else if (this.state === 'GAME_OVER') {
            if (this.input.isKeyJustPressed('Space') || this.input.mouse.justDown) {
                this.state = 'TITLE';
            }
        } else if (this.state === 'PLAYING') {
            // Gameplay Logic

            // Tether mechanics
            if (this.input.mouse.justDown || this.input.isKeyJustPressed('Space')) {
                // Find nearest grapple point
                let nearest = null;
                let minDist = Infinity;
                let tx = this.input.mouse.x || this.width/2;
                let ty = this.input.mouse.y || this.height/2;

                if (this.input.isKeyJustPressed('Space')) {
                    // Auto-aim if space pressed
                    tx = this.player.x;
                    ty = this.player.y;
                }

                for (const gp of this.grapplePoints) {
                    let d = Math.hypot(gp.x - tx, gp.y - ty);
                    if (this.input.isKeyJustPressed('Space')) {
                        d = Math.hypot(gp.x - this.player.x, gp.y - this.player.y);
                    }
                    if (d < minDist && d < 300) {
                        minDist = d;
                        nearest = gp;
                    }
                }

                if (nearest && !this.player.tethered) {
                    this.player.fireTether(nearest, this);
                } else if (this.player.tethered) {
                    this.player.releaseTether();
                }
            }

            // Tactical Dash input
            if (this.input.mouse.rightJustDown || this.input.isKeyJustPressed('ShiftLeft') || this.input.isKeyJustPressed('ShiftRight')) {
                let tx = this.input.mouse.x || this.width/2;
                let ty = this.input.mouse.y || this.height/2;
                this.player.triggerDash(tx, ty, this);
            }

            // if input released, drop tether
            if (!this.input.isKeyDown('Space') && !this.input.mouse.down && this.player.tethered) {
                 this.player.releaseTether();
            }

            this.player.update(dt, this);

            for (const gp of this.grapplePoints) gp.update(dt);

            this.env.update(dt);

            for (const v of this.steamVents) {
                v.update(dt);
                v.apply(this.player, dt);
            }
            for (const c of this.conveyors) {
                c.update(dt);
                c.apply(this.player, dt);
            }
            for (const c of this.covers) {
                c.update(dt);
                c.checkCollision(this.player);
            }

            for (const hz of this.hazards) {
                hz.update(dt, this);
                if (hz.radius && !hz.dead) { // Only do this for base hazards that lack their own update collision
                    // Check collision
                    const dist = Math.hypot(this.player.x - hz.x, this.player.y - hz.y);
                    if (dist < this.player.radius + hz.radius) {
                        if (this.player.invulnerableTimer <= 0) {
                            this.vfx.shake(10, 0.2);
                            this.vfx.emit(this.player.x, this.player.y, 20, '#ff0000', 5);
                            this.die();
                        }
                    }
                }
            }
            this.hazards = this.hazards.filter(hz => !hz.dead);

            if (!this.bossActive && this.bossWarningTimer <= 0) {
                this.enemySpawnTimer -= dt;
                if (this.enemySpawnTimer <= 0) {
                    let settings = this.waveManager.getWaveSettings(this.waveCount);
                    this.enemySpawnTimer = settings.spawnRate;
                    let EnemyClass = this.waveManager.getSpawnClass(this.waveCount);
                    this.enemies.push(new EnemyClass(Math.random() > 0.5 ? 50 : this.width - 50, 100 + Math.random() * (this.height - 200)));
                }
            }


            if (this.waveManager) this.waveManager.updateTutorial(dt, this);
            if (this.score >= this.nextBossScore && !this.bossActive && this.bossWarningTimer <= 0) {
                this.bossWarningTimer = 3.0;
                this.enemies = [];
                this.sound.playBossSpawn();
            }

            if (this.bossWarningTimer > 0) {
                this.bossWarningTimer -= dt;
                if (this.bossWarningTimer <= 0) {
                    let BossClass = (this.bossSpawnType === 0) ? CogwheelTitan : SteamOverlord;
                    let b = new BossClass(this.width / 2, 100);
                    let settings = this.waveManager.getWaveSettings(this.waveCount);
                    b.maxHp *= settings.bossHpMult;
                    b.hp = b.maxHp;
                    this.bosses.push(b);
                    this.bossActive = true;
                    this.bossSpawnType = 1 - this.bossSpawnType;
                }
            }

            for (const b of this.bosses) {
                b.update(dt, this);
                let dist = Math.hypot(this.player.x - b.x, this.player.y - b.y);
                if (dist < b.radius + this.player.radius) {
                    if (this.player.dashActive > 0) {
                        b.hp -= 20;
                        this.player.vx = -this.player.vx;
                        this.player.vy = -this.player.vy;
                        this.player.invulnerableTimer = 0.5;
                        this.sound.playEnemyHit();
                        this.vfx.freeze(0.1);
                        this.vfx.shake(5, 0.2);
                        this.vfx.emitDirectional(b.x, b.y, 15, '#ffaa00', this.player.vx, this.player.vy, 0.5, 8);
                        this.vfx.addText(b.x, b.y, '-20', '#ff0000');
                    } else if (this.player.invulnerableTimer <= 0) {
                        this.vfx.shake(10, 0.2);
                        this.vfx.emit(this.player.x, this.player.y, 20, '#ff0000', 5);
                        this.die();
                    }
                }
            }
            this.bosses = this.bosses.filter(b => b.hp > 0);

            if (this.bossActive && this.bosses.length === 0) {
                this.vfx.freeze(0.5);
                this.vfx.shake(20, 1.0);
                this.vfx.emit(this.width/2, this.height/2, 50, '#ffaa00', 10);
                this.vfx.addText(this.width/2, this.height/2, 'BOSS DEFEATED', '#ffaa00');
                this.bossActive = false;
                this.bossesKilled++;
                let settings = this.waveManager.getWaveSettings(this.waveCount + 1);
                this.nextBossScore = Math.max(this.score + 500, settings.nextBossScore);
                this.score += 500 * (this.comboMultiplier || 1);

                this.state = 'UPGRADE';
                this.upgradeDraft = this.upgradeSystem.getDraft(3);
                this.waveCount++;
                this.sound.playEnemyDeath();
            }

            for (let i = 0; i < this.pickups.length; i++) {
                this.pickups[i].update(dt, this);
            }
            this.pickups = this.pickups.filter(p => !p.dead);

            if (this.comboTimer > 0) {
                this.comboTimer -= dt * (this.comboDecayRate || 1);
                if (this.comboTimer <= 0) {
                    this.comboTimer = 0;
                    this.comboMultiplier = 1;
                }
            }

            for (const en of this.enemies) {
                en.update(dt, this);
            }
            const beforeLen = this.enemies.length;
            this.enemies = this.enemies.filter(en => !en.dead);

            // Spawn pickup on some enemy deaths
            if (this.enemies.length < beforeLen) {
                let killed = beforeLen - this.enemies.length;
                this.saveManager.data.enemiesKilled = (this.saveManager.data.enemiesKilled || 0) + killed;
                this.vfx.freeze(0.05);
                this.vfx.shake(3, 0.1);
                this.vfx.addText(this.player.x, this.player.y - 20, '+Combo!', '#00ffaa');

                for (let i = 0; i < killed; i++) {
                    if (Math.random() < 0.3) {
                        this.pickups.push(new Pickup(this.width/2 + (Math.random()-0.5)*200, this.height/2 + (Math.random()-0.5)*200));
                    }
                }
            }

            // Floor death
            if (this.player.y >= this.height - this.player.radius - 5) {
                this.die();
            }

            // Gain passive score for staying alive
            this.score += 5 * dt * (this.baseScoreMultiplier || 1);
        } else if (this.state === 'UPGRADE') {
            if (this.upgradeDraft) {
                // Draft selection logic (handled in bindEvents typically, but can be done via input check here)
                for (let i = 0; i < this.upgradeDraft.length; i++) {
                    const btnX = this.width / 2 - 150;
                    const btnY = this.height / 2 - 100 + i * 80;
                    const btnW = 300;
                    const btnH = 60;

                    if (this.input.mouse.justDown) {
                        let mx = this.input.mouse.x || this.width/2;
                        let my = this.input.mouse.y || this.height/2;
                        if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
                            this.upgradeSystem.applyUpgrade(this, this.upgradeDraft[i].id);
                            this.sound.playMenuClick(); // reuse sound
                            this.state = 'PLAYING';
                            this.upgradeDraft = null;
                            this.input.mouse.justDown = false; // consume

                            // Heal slightly
                            this.player.invulnerableTimer = 2.0;
                        }
                    }
                }

                // Or number keys
                if (this.input.isKeyJustPressed('Digit1') && this.upgradeDraft.length > 0) {
                    this.upgradeSystem.applyUpgrade(this, this.upgradeDraft[0].id);
                    this.sound.playMenuClick();
                    this.state = 'PLAYING';
                    this.upgradeDraft = null;
                    this.player.invulnerableTimer = 2.0;
                } else if (this.input.isKeyJustPressed('Digit2') && this.upgradeDraft.length > 1) {
                    this.upgradeSystem.applyUpgrade(this, this.upgradeDraft[1].id);
                    this.sound.playMenuClick();
                    this.state = 'PLAYING';
                    this.upgradeDraft = null;
                    this.player.invulnerableTimer = 2.0;
                } else if (this.input.isKeyJustPressed('Digit3') && this.upgradeDraft.length > 2) {
                    this.upgradeSystem.applyUpgrade(this, this.upgradeDraft[2].id);
                    this.sound.playMenuClick();
                    this.state = 'PLAYING';
                    this.upgradeDraft = null;
                    this.player.invulnerableTimer = 2.0;
                }
            } else {
                this.state = 'PLAYING'; // Fallback
            }
        }
    }

    die() {
        this.sound.playSynthHurt();
        this.state = 'GAME_OVER';
        this.saveManager.data.totalScoreAccumulated += Math.floor(this.score);
        if (Math.floor(this.score) > this.saveManager.data.highScore) {
            this.saveManager.data.highScore = Math.floor(this.score);
        }
        this.saveManager.save();
    }

    draw() {
        this.ctx.fillStyle = '#1a1a24';
        this.ctx.fillRect(0, 0, this.width, this.height);

        if (this.ui) this.ui.drawPreVFX(this.ctx);

        let cameraX = 0;
        let cameraY = 0;
        if (this.player) {
            cameraX = (this.player.x - this.width/2) * 0.1;
            cameraY = (this.player.y - this.height/2) * 0.1;
        }

        this.vfx.applyShake(this.ctx, this.saveManager.data.options);

        this.env.draw(this.ctx, cameraX, cameraY);

        if (this.state === 'TITLE') this.drawTitle();
        else if (this.state === 'PLAYING') this.drawPlaying();
        else if (this.state === 'PAUSED') this.drawPaused();
        else if (this.state === 'UPGRADE') this.drawUpgrade();
        else if (this.state === 'GAME_OVER') this.drawGameOver();

        this.vfx.restoreShake(this.ctx);

        if (this.ui) this.ui.drawPostVFX(this.ctx);
    }

    drawPlaying() {
        // Aim telegraph line
        if (this.player && !this.player.tethered && this.player.dashCooldown <= 0) {
            let tx = this.input.mouse.x || this.width/2;
            let ty = this.input.mouse.y || this.height/2;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y);
            this.ctx.lineTo(tx, ty);
            this.ctx.strokeStyle = 'rgba(255, 170, 0, 0.3)';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        for (const v of this.steamVents) v.draw(this.ctx);
        for (const c of this.conveyors) c.draw(this.ctx);
        for (const c of this.covers) c.draw(this.ctx);

        for (const gp of this.grapplePoints) gp.draw(this.ctx);
        for (const hz of this.hazards) hz.draw(this.ctx);
        for (let i = 0; i < this.pickups.length; i++) this.pickups[i].draw(this.ctx);
        for (const en of this.enemies) en.draw(this.ctx);
        for (const b of this.bosses) {
            b.draw(this.ctx);
        }
        if (this.player) this.player.draw(this.ctx);

        this.vfx.draw(this.ctx, this);

        if (this.bossWarningTimer > 0) {
            this.ctx.fillStyle = `rgba(255, 0, 0, ${Math.abs(Math.sin(this.bossWarningTimer * 10))})`;
            this.ctx.fillRect(0, this.height / 2 - 50, this.width, 100);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '40px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('WARNING: BOSS APPROACHING', this.width / 2, this.height / 2 + 10);
        }

        if (this.bossActive && this.bosses.length > 0) {
            this.bosses[0].drawHealthBar(this.ctx, this);
        }

        if (this.waveManager) this.waveManager.drawTutorial(this.ctx, this);

        // Dash Cooldown HUD
        if (this.player) {
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(this.width/2 - 50, this.height - 30, 100, 10);
            this.ctx.fillStyle = (this.player.dashCooldown > 0) ? '#ff5555' : '#55ff55';
            const dashRatio = Math.max(0, 1 - (this.player.dashCooldown / this.player.dashCooldownMax));
            this.ctx.fillRect(this.width/2 - 50, this.height - 30, 100 * dashRatio, 10);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('OVERDRIVE (Right-Click/Shift)', this.width/2, this.height - 10);
        }

        // HUD
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '20px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${Math.floor(this.score)}`, 20, 30);

        if (this.comboMultiplier > 1) {
            this.ctx.fillStyle = '#00ffff';
            this.ctx.fillText(`Combo x${this.comboMultiplier.toFixed(1)}`, 20, 60);

            // Combo bar
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(20, 70, 100, 5);
            this.ctx.fillStyle = '#00ffff';
            this.ctx.fillRect(20, 70, 100 * (this.comboTimer / 5.0), 5);
        }

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`High: ${this.saveManager.data.highScore}`, this.width - 20, 30);
        this.ctx.fillText(`Wave: ${this.waveCount}`, this.width - 20, 60);
    }

    drawTitle() {
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';

        this.ctx.font = '40px monospace';
        this.ctx.fillStyle = '#a04e7e';
        this.ctx.fillText('CLOCKWORK TETHER FOUNDRY', this.width/2, this.height/2 - 50);

        this.ctx.font = '20px monospace';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText('Click or Press Space to Swing', this.width/2, this.height/2 + 20);

        this.ctx.font = '16px monospace';
        this.ctx.fillStyle = '#777';
        this.ctx.fillText(`High Score: ${this.saveManager.data.highScore}`, this.width/2, this.height/2 + 80);
    }

    drawUpgrade() {
        this.drawPlaying();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 40px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`WAVE ${this.waveCount} CLEARED`, this.width / 2, 100);
        this.ctx.font = '20px monospace';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText('Select an Upgrade:', this.width / 2, 150);

        if (this.upgradeDraft) {
            for (let i = 0; i < this.upgradeDraft.length; i++) {
                const upg = this.upgradeDraft[i];
                const btnX = this.width / 2 - 150;
                const btnY = this.height / 2 - 100 + i * 80;
                const btnW = 300;
                const btnH = 60;

                let isHovered = false;
                if (this.input.mouse.x >= btnX && this.input.mouse.x <= btnX + btnW &&
                    this.input.mouse.y >= btnY && this.input.mouse.y <= btnY + btnH) {
                    isHovered = true;
                }

                this.ctx.fillStyle = isHovered ? '#a04e7e' : '#333';
                this.ctx.fillRect(btnX, btnY, btnW, btnH);
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(btnX, btnY, btnW, btnH);

                this.ctx.fillStyle = '#fff';
                this.ctx.font = '16px monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(`[${i+1}] ${upg.name}`, this.width / 2, btnY + 25);

                this.ctx.font = '12px monospace';
                this.ctx.fillStyle = '#ddd';
                this.ctx.fillText(upg.desc, this.width / 2, btnY + 45);
            }
        }
    }

    drawPaused() {
        this.drawPlaying();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.font = '40px monospace';
        this.ctx.fillText('PAUSED', this.width/2, this.height/2 - 20);

        this.ctx.font = '20px monospace';
        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText('Press P or Esc to Resume', this.width/2, this.height/2 + 20);

        // Settings Button
        let sY = this.height/2 + 60;
        let hovered = Math.abs((this.input.mouse.y || 0) - sY) < 15;
        this.ctx.fillStyle = hovered ? '#a04e7e' : '#fff';
        this.ctx.fillText('[ Settings ]', this.width/2, sY);
        if (hovered && this.input.mouse.justDown) {
             this.input.mouse.justDown = false;
             if (this.ui) this.ui.toggleSettings();
        }

        this.ctx.fillStyle = '#aaa';
        this.ctx.fillText('Back to Arcade (../../index.html)', this.width/2, this.height - 40);
    }

    drawGameOver() {
        this.drawPlaying();
        this.ctx.fillStyle = 'rgba(160, 78, 126, 0.5)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.font = '50px monospace';
        this.ctx.fillText('GEARS CRUSHED', this.width/2, this.height/2 - 40);

        this.ctx.font = '30px monospace';
        this.ctx.fillText(`Final Score: ${Math.floor(this.score)}`, this.width/2, this.height/2 + 20);

        this.ctx.font = '20px monospace';
        this.ctx.fillStyle = '#ddd';
        this.ctx.fillText('Click or Space to Restart', this.width/2, this.height/2 + 80);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Engine('game-canvas');
});
