// game.js foundation
class InputManager {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.touch = { x: 0, y: 0, down: false };
        this.justPressed = {};
        this.bindings = {
            up: ['ArrowUp', 'KeyW'],
            down: ['ArrowDown', 'KeyS'],
            left: ['ArrowLeft', 'KeyA'],
            right: ['ArrowRight', 'KeyD'],
            action: ['Space', 'Enter'],
            dash: ['ShiftLeft', 'ShiftRight', 'KeyQ'],
            pause: ['Escape', 'KeyP']
        };

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            this.justPressed[e.code] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.justPressed[e.code] = false;
        });

        const updatePointer = (e, isTouch) => {
            const point = isTouch ? e.touches[0] || e.changedTouches[0] : e;
            if (point) {
                const state = isTouch ? this.touch : this.mouse;
                state.x = point.clientX;
                state.y = point.clientY;
            }
        };

        window.addEventListener('pointerdown', e => {
            if(e.pointerType === 'touch') {
                this.touch.down = true;
                updatePointer(e, e.pointerType === 'touch');
            } else {
                this.mouse.down = true;
                updatePointer(e, e.pointerType === 'touch');
            }
        });

        window.addEventListener('pointerup', e => {
            if(e.pointerType === 'touch') {
                this.touch.down = false;
            } else {
                this.mouse.down = false;
            }
        });

        window.addEventListener('pointermove', e => {
            updatePointer(e, e.pointerType === 'touch');
        });
    }

    isDown(action) {
        return this.bindings[action].some(code => this.keys[code]);
    }

    isJustPressed(action) {
        const pressed = this.bindings[action].some(code => this.justPressed[code]);
        if (pressed) {
            this.bindings[action].forEach(code => this.justPressed[code] = false);
        }
        return pressed;
    }

    clearJustPressed() {
        this.justPressed = {};
    }
}

// Canvas setup with ResizeObserver
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let cw = window.innerWidth;
let ch = window.innerHeight;
canvas.width = cw;
canvas.height = ch;

const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        cw = entry.contentRect.width;
        ch = entry.contentRect.height;
        canvas.width = cw;
        canvas.height = ch;
    }
});
resizeObserver.observe(canvas);

// Paper craft drawing utilities
function drawPaperPoly(ctx, points, fillColor, strokeColor = '#333', shadowColor = 'rgba(0,0,0,0.3)') {
    ctx.save();
    if (window.gameEngine && window.gameEngine.saveManager && window.gameEngine.saveManager.data.options.highContrast) {
        if (fillColor === '#e74c3c') fillColor = '#ff0000';
        else if (fillColor === '#3498db') fillColor = '#0000ff';
        else fillColor = '#ffffff';
        strokeColor = '#000000';
        shadowColor = 'transparent';
    }
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_055_055-polarity-diorama_v1';
        this.data = this.load() || this.getDefaultData();
    }

    getDefaultData() {
        return {
            highScore: 0,
            bestWaveOrCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                mute: false,
                sfxVol: 100,
                musicVol: 100,
                screenShake: 100,
                particleDensity: 'high',
                highContrast: false,
                showFps: false,
                touchControls: 'auto',
                touchHandedness: 'right'
            }
        };
    }

    load() {
        try {
            const saved = localStorage.getItem(this.saveKey);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.warn('LocalStorage error', e);
            return null;
        }
    }

    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn('LocalStorage error', e);
        }
    }
}

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.5;
        this.enabled = true;

        // Background track components
        this.bgmGain = this.ctx.createGain();
        this.bgmGain.connect(this.masterGain);
        this.bgmGain.gain.value = 0.2;

        this.arpTime = 0;
        this.arpStep = 0;
        this.arpInterval = 0.15; // 150ms per step initially

        this.drumTime = 0;
        this.drumStep = 0;
        this.drumInterval = 0.3; // 300ms per step initially

        // Minor pentatonic scale freq
        this.scale = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25, 587.33, 659.25, 783.99];

        this.isBoss = false;
        this.isLowHp = false;
        this.isPlaying = false;
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    update(dt, state, isBoss, isLowHp) {
        if (!this.enabled || this.ctx.state !== 'running') return;
        if (window.gameEngine && window.gameEngine.saveManager) {
            const opts = window.gameEngine.saveManager.data.options;
            this.masterGain.gain.value = opts.mute ? 0 : 0.5;
            this.bgmGain.gain.value = (opts.musicVol / 100) * 0.2;
            // Note: actual SFX volume would be applied in play methods, assuming we have a generic play
            this.sfxVol = opts.sfxVol / 100;
        }

        this.isPlaying = (state === 'PLAYING' || state === 'UPGRADE_DRAFT');
        if (!this.isPlaying) return;

        this.isBoss = isBoss;
        this.isLowHp = isLowHp;

        const isIntense = this.isBoss || this.isLowHp;

        const targetArpInterval = isIntense ? 0.1 : 0.15;
        this.arpInterval += (targetArpInterval - this.arpInterval) * dt * 2;

        const targetDrumInterval = isIntense ? 0.2 : 0.3;
        this.drumInterval += (targetDrumInterval - this.drumInterval) * dt * 2;

        this.arpTime += dt;
        if (this.arpTime >= this.arpInterval) {
            this.arpTime -= this.arpInterval;
            this.playArpStep();
            this.arpStep = (this.arpStep + 1) % 16;
        }

        this.drumTime += dt;
        if (this.drumTime >= this.drumInterval) {
            this.drumTime -= this.drumInterval;
            this.playDrumStep();
            this.drumStep = (this.drumStep + 1) % 8;
        }
    }

    playArpStep() {
        let noteIndex = 0;
        const isIntense = this.isBoss || this.isLowHp;

        if (isIntense) {
            const pattern = [0, 4, 7, 4, 2, 5, 8, 5, 0, 4, 7, 9, 7, 5, 4, 2];
            noteIndex = pattern[this.arpStep];
        } else {
            const pattern = [0, 2, 4, 2, 0, 4, 6, 4, 0, 2, 4, 2, 0, 4, 2, 0];
            noteIndex = pattern[this.arpStep];
        }
        const freq = this.scale[noteIndex];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = isIntense ? 'sawtooth' : 'sine';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = isIntense ? 2000 : 800;

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playDrumStep() {
        const isIntense = this.isBoss || this.isLowHp;

        if (this.drumStep === 0 || this.drumStep === 4) {
            this.playKick();
        } else if (this.drumStep === 2 || this.drumStep === 6) {
            this.playSnare();
        }
        if (isIntense && this.drumStep % 2 !== 0) {
            this.playHihat();
        }
    }

    playKick() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    playSnare() {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, this.ctx.currentTime);

        filter.type = 'highpass';
        filter.frequency.value = 1000;

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);

        const bufferSize = this.ctx.sampleRate * 0.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;
        noiseGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.bgmGain);
        noise.start();
    }

    playHihat() {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 5000;
        noiseGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.bgmGain);
        noise.start();
    }

    // SFX Methods
    playSwitch() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playAbsorb() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playRepel() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playHitSun() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);

        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        noise.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
    }

    playDash() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.3);
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(filter);
        filter.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playPickup() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playBossWarning() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 0.5);
        osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 1.0);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    playMenuSelect() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playMenuHover() {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
        osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    playBossDefeat() {
        if (!this.enabled) return;
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(200 - i * 30, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 1.0);
                gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
                osc.connect(gain);

        if (this.sfxVol !== undefined) {
            const sfxGain = this.ctx.createGain();
            sfxGain.gain.value = this.sfxVol;
            gain.connect(sfxGain);
            sfxGain.connect(this.masterGain);
        } else {
            gain.connect(this.masterGain);
        }

                osc.start();
                osc.stop(this.ctx.currentTime + 1.0);

                const bufferSize = this.ctx.sampleRate * 1.0;
                const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let j = 0; j < bufferSize; j++) {
                    data[j] = Math.random() * 2 - 1;
                }
                const noise = this.ctx.createBufferSource();
                noise.buffer = buffer;
                const noiseGain = this.ctx.createGain();
                noiseGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
                noise.connect(noiseGain);
                noiseGain.connect(this.masterGain);
                noise.start();
            }, i * 200);
        }
    }
}

// Constants
const POLARITY = { POSITIVE: 1, NEGATIVE: -1 };
const COLORS = {
    POSITIVE: '#dd867f', // Red-ish paper
    NEGATIVE: '#7fbbdd', // Blue-ish paper
    SUN: '#f4e8c1',     // Yellow-ish paper
    BG: '#2b2b2b'
};

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = (Math.random() - 0.5) * 200;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 5 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt * 2;
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
        ctx.restore();
    }
}


class Pickup {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 100;
        this.vy = (Math.random() - 0.5) * 100;
        this.type = type; // 1: score, 2: combo reset
        this.life = 10;
        this.markedForDeletion = false;
        this.size = 8;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.life -= dt;
        if (this.life <= 0) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.life * Math.PI); // Spin over time
        ctx.fillStyle = this.type === 1 ? '#ffff00' : '#00ffff';
        ctx.beginPath();
        ctx.moveTo(0, -this.size);
        ctx.lineTo(this.size, 0);
        ctx.lineTo(0, this.size);
        ctx.lineTo(-this.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

class Player {
    constructor() {
        this.angle = 0;
        this.orbitRadius = 150;
        this.polarity = POLARITY.POSITIVE;
        this.size = 15;
        this.angularVelocity = 2.0; // rad/s
        this.dashCooldown = 0;
        this.dashTimer = 0;
        this.isDashing = false;
        this.dashDuration = 0;
        this.invulnTimer = 0;
        this.thrustLevel = 0;
        this.recoilOffset = {x: 0, y: 0};
    }

    update(dt, input) {
        if (this.dashCooldown > 0) this.dashCooldown -= dt;
        if (this.dashDuration > 0) {
            this.dashDuration -= dt;
            if (this.dashDuration <= 0) this.isDashing = false;
        }
        if (this.invulnTimer > 0) this.invulnTimer -= dt;

        this.recoilOffset.x *= 0.9;
        this.recoilOffset.y *= 0.9;

        let moving = false;
        const currentAngVel = this.isDashing ? this.angularVelocity * 3 : this.angularVelocity;

        if (input.isDown('left')) {
            this.angle -= currentAngVel * dt;
            moving = true;
        }
        if (input.isDown('right')) {
            this.angle += currentAngVel * dt;
            moving = true;
        }

        if (moving) {
            this.thrustLevel = Math.min(1.0, this.thrustLevel + dt * 5);
        } else {
            this.thrustLevel = Math.max(0, this.thrustLevel - dt * 5);
        }

        if (input.isJustPressed('dash') && this.dashCooldown <= 0) {
            this.isDashing = true;
            this.dashDuration = 0.2;
            this.dashCooldown = 2.0;
            this.invulnTimer = 0.3;
            // The analytics dash call is handled in Engine
        }

        if (input.isJustPressed('action') || (input.mouse.down && input.isJustPressed('mouse_left')) || (input.touch.down && input.isJustPressed('touch_tap'))) {
             // We handle polarity switch in engine for sound, but can update state here if we want.
             // Relying on Engine to trigger switch for sound
        }
    }

    draw(ctx, cx, cy) {
        if (this.invulnTimer > 0 && Math.floor(this.invulnTimer * 20) % 2 === 0) return;

        const rx = cx + Math.cos(this.angle) * this.orbitRadius + this.recoilOffset.x;
        const ry = cy + Math.sin(this.angle) * this.orbitRadius + this.recoilOffset.y;

        // Draw aim telegraph
        ctx.beginPath();
        const moveDir = Math.PI/2; // It moves tangentially
        // Just draw a line from center to outside as telegraph? Actually it moves around circle.
        // Telegraph: point forward along the orbit tangent
        const tangentX = rx + Math.cos(this.angle + Math.PI/2) * 30;
        const tangentY = ry + Math.sin(this.angle + Math.PI/2) * 30;
        ctx.moveTo(rx, ry);
        ctx.lineTo(tangentX, tangentY);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw thrust flame
        if (this.thrustLevel > 0) {
            const flameLen = this.size * 1.5 * this.thrustLevel + (Math.random() * 5);
            // Flame points downwards relative to the player orientation which is usually pointing "up" (angle - PI/2)
            // But let's just draw it downwards on screen relative to (rx, ry)
            const flamePts = [
                {x: rx - this.size * 0.8, y: ry + this.size},
                {x: rx + this.size * 0.8, y: ry + this.size},
                {x: rx, y: ry + this.size + flameLen}
            ];
            drawPaperPoly(ctx, flamePts, '#ffaa00', '#cc5500');
        }

        const pts = [
            {x: rx, y: ry - this.size},
            {x: rx + this.size, y: ry + this.size},
            {x: rx - this.size, y: ry + this.size}
        ];

        const color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        drawPaperPoly(ctx, pts, color);

        // Polarity indicator
        ctx.fillStyle = '#fff';
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.polarity === POLARITY.POSITIVE ? '+' : '-', rx, ry + 5);
    }

    getPos(cx, cy) {
        return {
            x: cx + Math.cos(this.angle) * this.orbitRadius,
            y: cy + Math.sin(this.angle) * this.orbitRadius
        };
    }
}

class Enemy {
    constructor(cx, cy, cw, ch) {
        // Spawn outside screen
        const angle = Math.random() * Math.PI * 2;
        const spawnRx = cw / 2 + 50;
        const spawnRy = ch / 2 + 50;
        this.x = cx + Math.cos(angle) * spawnRx;
        this.y = cy + Math.sin(angle) * spawnRy;

        this.vx = 0;
        this.vy = 0;
        this.knockbackX = 0;
        this.knockbackY = 0;
        this.polarity = Math.random() < 0.5 ? POLARITY.POSITIVE : POLARITY.NEGATIVE;
        this.size = 12;
        this.markedForDeletion = false;

        // Random jagged shape for papercraft
        this.shape = [];
        const sides = Math.floor(Math.random() * 3) + 4; // 4 to 6 sides
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = this.size * (0.8 + Math.random() * 0.4);
            this.shape.push({ angle: a, r: r });
        }
    }

    update(dt, cx, cy, player, playerPos, enemies) {
        // Sun gravity
        const dxSun = cx - this.x;
        const dySun = cy - this.y;
        const distSunSq = dxSun*dxSun + dySun*dySun;
        const distSun = Math.sqrt(distSunSq);

        const gravity = 20000 / Math.max(distSunSq, 100);
        this.vx += (dxSun / distSun) * gravity * dt;
        this.vy += (dySun / distSun) * gravity * dt;

        // Player magnetism
        const dxP = playerPos.x - this.x;
        const dyP = playerPos.y - this.y;
        const distPSq = dxP*dxP + dyP*dyP;
        const distP = Math.sqrt(distPSq);

        if (distP < 300) {
            const magForce = 50000 / Math.max(distPSq, 100);
            const forceDir = this.polarity === player.polarity ? -1 : 1; // Opposite attracts (1), same repels (-1)
            this.vx += (dxP / distP) * magForce * forceDir * dt;
            this.vy += (dyP / distP) * magForce * forceDir * dt;
        }

        // Apply friction
        this.vx *= 0.99;
        this.vy *= 0.99;

        this.x += this.vx * dt + this.knockbackX * dt;
        this.y += this.vy * dt + this.knockbackY * dt;
        this.knockbackX *= 0.9;
        this.knockbackY *= 0.9;
    }

    draw(ctx) {
        const pts = this.shape.map(p => ({
            x: this.x + Math.cos(p.angle) * p.r,
            y: this.y + Math.sin(p.angle) * p.r
        }));

        const color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        drawPaperPoly(ctx, pts, color);
    }
}

class Swarmer extends Enemy {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch);
        this.size = 8;
        this.shape = [];
        const sides = 3;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = this.size * (0.8 + Math.random() * 0.4);
            this.shape.push({ angle: a, r: r });
        }
        this.aiState = 'chase';
    }
    update(dt, cx, cy, player, playerPos, enemies) {
        // Player magnetism
        const dxP = playerPos.x - this.x;
        const dyP = playerPos.y - this.y;
        const distPSq = dxP*dxP + dyP*dyP;
        const distP = Math.sqrt(distPSq);

        if (distP > 0) {
            const magForce = 150000 / Math.max(distPSq, 100);
            const forceDir = this.polarity === player.polarity ? -1 : 1;
            this.vx += (dxP / distP) * magForce * forceDir * dt;
            this.vy += (dyP / distP) * magForce * forceDir * dt;

            // Base chase speed
            this.vx += (dxP / distP) * 150 * dt;
            this.vy += (dyP / distP) * 150 * dt;
        }

        // Apply friction
        this.vx *= 0.99;
        this.vy *= 0.99;

        this.x += this.vx * dt + this.knockbackX * dt;
        this.y += this.vy * dt + this.knockbackY * dt;
        this.knockbackX *= 0.9;
        this.knockbackY *= 0.9;
    }
}

class Sniper extends Enemy {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch);
        this.size = 14;
        this.shape = [];
        const sides = 4;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = (i % 2 === 0 ? 1.5 : 0.5) * this.size;
            this.shape.push({ angle: a, r: r });
        }
        this.aiState = 'orbit';
        this.stateTimer = Math.random() * 2 + 2;
        this.targetDist = 200 + Math.random() * 100;
        this.lungeVx = 0;
        this.lungeVy = 0;
    }
    update(dt, cx, cy, player, playerPos, enemies) {
        this.stateTimer -= dt;

        const dxP = playerPos.x - this.x;
        const dyP = playerPos.y - this.y;
        const distPSq = dxP*dxP + dyP*dyP;
        const distP = Math.sqrt(distPSq);

        if (this.aiState === 'orbit') {
            if (this.stateTimer <= 0) {
                this.aiState = 'telegraph';
                this.stateTimer = 1.0;
            } else {
                if (distP > 0) {
                    const error = distP - this.targetDist;
                    this.vx += (dxP / distP) * error * 2 * dt;
                    this.vy += (dyP / distP) * error * 2 * dt;

                    // Orbit tangent
                    this.vx += (-dyP / distP) * 150 * dt;
                    this.vy += (dxP / distP) * 150 * dt;
                }

                const dxSun = cx - this.x;
                const dySun = cy - this.y;
                const distSunSq = dxSun*dxSun + dySun*dySun;
                const distSun = Math.sqrt(distSunSq);
                const gravity = 10000 / Math.max(distSunSq, 100);
                this.vx += (dxSun / distSun) * gravity * dt;
                this.vy += (dySun / distSun) * gravity * dt;
            }
        } else if (this.aiState === 'telegraph') {
            this.vx *= 0.8;
            this.vy *= 0.8;
            if (this.stateTimer <= 0) {
                this.aiState = 'shoot';
                this.stateTimer = 1.5;
                if (distP > 0) {
                    this.lungeVx = (dxP / distP) * 600;
                    this.lungeVy = (dyP / distP) * 600;
                }
            }
        } else if (this.aiState === 'shoot') {
            this.vx = this.lungeVx;
            this.vy = this.lungeVy;
            if (this.stateTimer <= 0) {
                this.aiState = 'orbit';
                this.stateTimer = Math.random() * 2 + 2;
            }
        }

        // Apply friction
        if (this.aiState !== 'shoot') {
            this.vx *= 0.99;
            this.vy *= 0.99;
        }

        this.x += this.vx * dt + this.knockbackX * dt;
        this.y += this.vy * dt + this.knockbackY * dt;
        this.knockbackX *= 0.9;
        this.knockbackY *= 0.9;
    }

    draw(ctx) {
        const pts = this.shape.map(p => ({
            x: this.x + Math.cos(p.angle) * p.r,
            y: this.y + Math.sin(p.angle) * p.r
        }));

        let color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        if (this.aiState === 'telegraph') {
             // flash white
             if (Math.floor(this.stateTimer * 10) % 2 === 0) {
                 color = '#ffffff';
             }
        }
        drawPaperPoly(ctx, pts, color);
    }
}

class Bruiser extends Enemy {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch);
        this.size = 20;
        this.shape = [];
        const sides = 6;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = this.size;
            this.shape.push({ angle: a, r: r });
        }
        this.aiState = 'chase';
        this.shieldTimer = Math.random() * 2;
    }
    update(dt, cx, cy, player, playerPos, enemies) {
        this.shieldTimer -= dt;
        if (this.shieldTimer <= 0) {
            this.aiState = this.aiState === 'chase' ? 'shielded' : 'chase';
            this.shieldTimer = this.aiState === 'chase' ? 4 : 2;
        }

        if (this.aiState === 'shielded') {
            this.knockbackX = 0;
            this.knockbackY = 0;
        }

        super.update(dt, cx, cy, player, playerPos, enemies);
    }

    draw(ctx) {
        const pts = this.shape.map(p => ({
            x: this.x + Math.cos(p.angle) * p.r,
            y: this.y + Math.sin(p.angle) * p.r
        }));

        const color = this.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
        drawPaperPoly(ctx, pts, color, this.aiState === 'shielded' ? '#ffffff' : '#333');
    }
}

class Splitter extends Enemy {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch);
        this.size = 18;
        this.shape = [];
        const sides = 10;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = (i % 2 === 0 ? 1.0 : 0.5) * this.size;
            this.shape.push({ angle: a, r: r });
        }
        this.hasSplit = false;
        this.cw = cw;
        this.ch = ch;
    }
    update(dt, cx, cy, player, playerPos, enemies) {
        if (!this.hasSplit && (Math.abs(this.knockbackX) > 500 || Math.abs(this.knockbackY) > 500)) {
            this.hasSplit = true;
            this.markedForDeletion = true;
            if (enemies) {
                for (let i = 0; i < 2; i++) {
                    const s = new Swarmer(cx, cy, this.cw, this.ch);
                    s.x = this.x + (Math.random() - 0.5) * 20;
                    s.y = this.y + (Math.random() - 0.5) * 20;
                    s.polarity = this.polarity;
                    enemies.push(s);
                }
            }
        }
        super.update(dt, cx, cy, player, playerPos, enemies);
    }
}

class HazardEnemy extends Enemy {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch);
        this.size = 15;
        this.baseSize = 15;
        this.shape = [];
        const sides = 16;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = (i % 2 === 0 ? 1.2 : 0.8) * this.size;
            this.shape.push({ angle: a, r: r });
        }
        this.aiState = 'idle';
        this.stateTimer = 3.0;
        this.rotAngle = 0;
    }
    update(dt, cx, cy, player, playerPos, enemies) {
        this.stateTimer -= dt;
        this.rotAngle += dt * 0.5;

        if (this.aiState === 'idle') {
            if (this.stateTimer <= 0) {
                this.aiState = 'expand';
                this.stateTimer = 0.5;
            }
            this.size = this.baseSize;
        } else if (this.aiState === 'expand') {
            if (this.stateTimer <= 0) {
                this.aiState = 'idle';
                this.stateTimer = 3.0;
                this.size = this.baseSize;
            } else {
                // Triple size over 0.5s, peak in middle
                const p = 1.0 - Math.abs(0.25 - this.stateTimer) / 0.25;
                this.size = this.baseSize + this.baseSize * 2 * p;
            }
        }

        // update shape
        this.shape = [];
        const sides = 16;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = (i % 2 === 0 ? 1.2 : 0.8) * this.size;
            this.shape.push({ angle: a + this.rotAngle, r: r });
        }

        // slow movement
        this.vx *= 0.95;
        this.vy *= 0.95;
        this.x += this.vx * dt + this.knockbackX * dt;
        this.y += this.vy * dt + this.knockbackY * dt;
        this.knockbackX *= 0.9;
        this.knockbackY *= 0.9;
    }
}



// Helpful Analytics Tracking for Dash Usage
class AnalyticsTracker {
    constructor() {
        this.events = [];
        this.sessionStart = performance.now();
        this.totalDashes = 0;
        this.totalAbsorbs = 0;
        this.totalRepels = 0;
        this.distanceTraveled = 0;
        this.lastX = 0;
        this.lastY = 0;
    }

    logEvent(eventName, data = {}) {
        this.events.push({
            time: performance.now() - this.sessionStart,
            event: eventName,
            data: data
        });

        if (this.events.length > 100) {
            this.events.shift();
        }
    }

    recordDash(playerPos) {
        this.totalDashes++;
        this.logEvent('dash_used', { x: playerPos.x, y: playerPos.y });
    }

    recordAbsorb() {
        this.totalAbsorbs++;
        this.logEvent('enemy_absorbed', { total: this.totalAbsorbs });
    }

    recordRepel() {
        this.totalRepels++;
        this.logEvent('enemy_repelled', { total: this.totalRepels });
    }

    updateDistance(x, y) {
        if (this.lastX !== 0 && this.lastY !== 0) {
            const dx = x - this.lastX;
            const dy = y - this.lastY;
            this.distanceTraveled += Math.sqrt(dx*dx + dy*dy);
        }
        this.lastX = x;
        this.lastY = y;
    }

    getStats() {
        return {
            dashes: this.totalDashes,
            absorbs: this.totalAbsorbs,
            repels: this.totalRepels,
            distance: Math.round(this.distanceTraveled)
        };
    }

    printReport() {
        console.log("--- Analytics Report ---");
        console.log(`Session Time: ${Math.round((performance.now() - this.sessionStart)/1000)}s`);
        console.log(`Dashes Used: ${this.totalDashes}`);
        console.log(`Enemies Absorbed: ${this.totalAbsorbs}`);
        console.log(`Enemies Repelled: ${this.totalRepels}`);
        console.log(`Distance Traveled: ${Math.round(this.distanceTraveled)}`);
        console.log("------------------------");
    }
}


class BackgroundLayer {
    constructor(speed, shapes, color) {
        this.speed = speed;
        this.shapes = shapes;
        this.color = color;
        this.yOffset = 0;
    }
    update(dt, ch, cw) {
        this.yOffset += this.speed * dt;
        this.shapes.forEach(s => {
            s.angle += s.rotSpeed * dt;
            if (s.y + this.yOffset > ch + 100) {
                s.y = -this.yOffset - 100;
                s.x = Math.random() * cw;
            }
        });
    }
    draw(ctx) {
        ctx.save();
        ctx.translate(0, this.yOffset);
        this.shapes.forEach(s => {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.fillStyle = this.color;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;

            ctx.beginPath();
            if (s.type === 'square') {
                ctx.rect(-s.size/2, -s.size/2, s.size, s.size);
            } else if (s.type === 'triangle') {
                ctx.moveTo(0, -s.size/2);
                ctx.lineTo(s.size/2, s.size/2);
                ctx.lineTo(-s.size/2, s.size/2);
                ctx.closePath();
            } else if (s.type === 'cloud') {
                ctx.arc(-s.size*0.3, 0, s.size*0.4, 0, Math.PI*2);
                ctx.arc(s.size*0.3, 0, s.size*0.4, 0, Math.PI*2);
                ctx.arc(0, -s.size*0.2, s.size*0.5, 0, Math.PI*2);
            } else {
                ctx.arc(0, 0, s.size/2, 0, Math.PI*2);
            }

            ctx.fill();
            if (s.type !== 'cloud') ctx.stroke();

            if (s.type === 'square' || s.type === 'triangle') {
                 ctx.beginPath();
                 ctx.moveTo(0,0);
                 ctx.lineTo(s.size/2, s.size/2);
                 ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                 ctx.stroke();
            }
            ctx.restore();
        });
        ctx.restore();
    }
}

class DioramaWorld {
    constructor() {
        this.layers = [];
        this.initLayers();
        this.hazards = [];
        this.hazardSpawnTimer = 0;
    }

    initLayers() {
        const l1 = [];
        for(let i=0; i<20; i++) l1.push(this.createShape(20));
        this.layers.push(new BackgroundLayer(20, l1, '#3a3a3a'));

        const l2 = [];
        for(let i=0; i<10; i++) {
             const s = this.createShape(40);
             s.type = 'cloud';
             l2.push(s);
        }
        this.layers.push(new BackgroundLayer(50, l2, '#444'));

        const l3 = [];
        for(let i=0; i<15; i++) l3.push(this.createShape(30));
        this.layers.push(new BackgroundLayer(100, l3, '#555'));
    }

    createShape(maxSize) {
        const types = ['square', 'triangle', 'circle'];
        return {
            x: Math.random() * (window.innerWidth || 800),
            y: Math.random() * (window.innerHeight || 600),
            size: 10 + Math.random() * maxSize,
            angle: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 2,
            type: types[Math.floor(Math.random() * types.length)]
        };
    }

    update(dt, player, enemies, particles, ch, cw) {
        this.layers.forEach(l => l.update(dt, ch, cw));

        this.hazards.forEach(h => h.update(dt));

        this.hazardSpawnTimer -= dt;
        if (this.hazardSpawnTimer <= 0) {
            this.hazardSpawnTimer = 5 + Math.random() * 5;
            this.spawnHazard();
        }

        this.hazards.forEach(h => {
             if (h.isActive()) {
                 const dx = player.x - h.x;
                 const dy = player.y - h.y;
                 const dist = Math.sqrt(dx*dx + dy*dy);
                 if (dist < h.radius + player.radius) {
                     h.applyEffect(player);
                     for(let i=0; i<5; i++) {
                         particles.push(new Particle(player.x, player.y, h.color));
                     }
                 }

                 enemies.forEach(e => {
                     const edx = e.x - h.x;
                     const edy = e.y - h.y;
                     const edist = Math.sqrt(edx*edx + edy*edy);
                     if (edist < h.radius + e.radius) {
                         h.applyEffect(e);
                     }
                 });
             }
        });

        this.hazards = this.hazards.filter(h => !h.isDead());
    }

    spawnHazard() {
        const cx = (window.innerWidth || 800) / 2;
        const cy = (window.innerHeight || 600) / 2;
        const a = Math.random() * Math.PI * 2;
        const r = 100 + Math.random() * 150;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;

        const type = Math.random() > 0.5 ? 'gravity_well' : 'repulsor';
        this.hazards.push(new Hazard(x, y, type));
    }

    draw(ctx) {
        this.layers.forEach(l => l.draw(ctx));
        this.hazards.forEach(h => h.draw(ctx));
    }
}

class Hazard {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'gravity_well' or 'repulsor'
        this.radius = 50 + Math.random() * 30;
        this.life = 10 + Math.random() * 5; // seconds
        this.color = type === 'gravity_well' ? 'rgba(100, 0, 200, 0.3)' : 'rgba(200, 100, 0, 0.3)';
        this.angle = 0;
        this.scale = 0; // for spawn animation
    }

    update(dt) {
        this.life -= dt;
        this.angle += (this.type === 'gravity_well' ? 1 : -1) * dt;
        if (this.scale < 1 && this.life > 1) {
            this.scale += dt * 2;
        }
        if (this.life < 1) {
            this.scale = Math.max(0, this.life);
        }
    }

    isActive() {
        return this.life > 0 && this.scale > 0.5;
    }

    isDead() {
        return this.life <= 0;
    }

    applyEffect(entity) {
        const dx = entity.x - this.x;
        const dy = entity.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
        const force = (1 - dist / this.radius) * 100;

        const dir = this.type === 'gravity_well' ? -1 : 1;

        if (entity.vx !== undefined && entity.vy !== undefined) {
             entity.vx += (dx / dist) * force * dir * 0.01;
             entity.vy += (dy / dist) * force * dir * 0.01;
        } else if (entity.orbitRadius !== undefined && entity.orbitAngle !== undefined) {
             const pull = force * dir * 0.5;
             entity.orbitRadius += pull;
             entity.orbitRadius = Math.max(50, Math.min(300, entity.orbitRadius));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scale, this.scale);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color;
        ctx.beginPath();

        const points = 8;
        for(let i=0; i<points*2; i++) {
            const a = (i/(points*2)) * Math.PI * 2;
            const r = i % 2 === 0 ? this.radius : this.radius * 0.6;
            if (i===0) ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r);
            else ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.setLineDash([5, 5]);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI*2);
        ctx.stroke();

        ctx.restore();
    }
}


class BossBase extends Enemy {
    constructor(cx, cy, cw, ch, maxHp) {
        super(cx, cy, cw, ch);
        this.maxHp = maxHp;
        this.hp = maxHp;
        this.phase2 = false;
        this.isBoss = true;
        this.size = 40;
        this.shape = [];
        const sides = 8;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const r = this.size * (0.8 + Math.random() * 0.4);
            this.shape.push({ angle: a, r: r });
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= this.maxHp / 2 && !this.phase2) {
            this.phase2 = true;
            this.onPhase2();
        }
        if (this.hp <= 0) {
            this.markedForDeletion = true;
        }
    }

    onPhase2() {
        // Override in subclass
    }
}

class TwinBoss extends BossBase {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch, 10);
        this.fireTimer = 2.0;
        this.orbitAngle = 0;
        this.orbitRadius = 250;
        this.orbitSpeed = 1.0;
        this.polarity = POLARITY.POSITIVE;
    }

    update(dt, cx, cy, player, playerPos, enemies) {
        this.orbitAngle += this.orbitSpeed * dt;
        const targetX = cx + Math.cos(this.orbitAngle) * this.orbitRadius;
        const targetY = cy + Math.sin(this.orbitAngle) * this.orbitRadius;

        this.x += (targetX - this.x) * 5 * dt;
        this.y += (targetY - this.y) * 5 * dt;

        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
            this.fire(cx, cy, playerPos, enemies);
            this.fireTimer = this.phase2 ? 1.0 : 2.0;
        }
    }

    fire(cx, cy, playerPos, enemies) {
        const proj = new Enemy(cx, cy, window.innerWidth, window.innerHeight);
        proj.x = this.x;
        proj.y = this.y;
        proj.polarity = this.polarity === POLARITY.POSITIVE ? POLARITY.NEGATIVE : POLARITY.POSITIVE;
        proj.size = 8;

        const dx = playerPos.x - this.x;
        const dy = playerPos.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        proj.vx = (dx/dist) * (this.phase2 ? 300 : 150);
        proj.vy = (dy/dist) * (this.phase2 ? 300 : 150);

        enemies.push(proj);
    }

    onPhase2() {
        this.orbitSpeed = 2.0;
        this.orbitRadius = 150;
    }
}

class MagnetBoss extends BossBase {
    constructor(cx, cy, cw, ch) {
        super(cx, cy, cw, ch, 15);
        this.chargeTimer = 3.0;
        this.polarityTimer = 1.0;
        this.polarity = POLARITY.NEGATIVE;
    }

    update(dt, cx, cy, player, playerPos, enemies) {
        // Move towards center slowly
        const dxSun = cx - this.x;
        const dySun = cy - this.y;
        this.x += dxSun * 0.5 * dt;
        this.y += dySun * 0.5 * dt;

        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
            this.polarity = this.polarity === POLARITY.POSITIVE ? POLARITY.NEGATIVE : POLARITY.POSITIVE;
            this.chargeTimer = this.phase2 ? 1.5 : 3.0;
        }

        if (this.phase2) {
            this.polarityTimer -= dt;
            if (this.polarityTimer <= 0) {
                this.polarity = this.polarity === POLARITY.POSITIVE ? POLARITY.NEGATIVE : POLARITY.POSITIVE;
                this.polarityTimer = 0.5;
            }
        }

        // Massive magnetic pull/push
        const dxP = playerPos.x - this.x;
        const dyP = playerPos.y - this.y;
        const distPSq = dxP*dxP + dyP*dyP;
        const distP = Math.sqrt(distPSq);

        if (distP < 500) {
            const magForce = (this.phase2 ? 200000 : 100000) / Math.max(distPSq, 100);
            const forceDir = this.polarity === player.polarity ? 1 : -1; // Opposite pulls player in (-1), same repels player out (1)
            // Apply force to player recoil (this is an approximation of pulling the player off orbit)
            player.recoilOffset.x += (dxP / distP) * magForce * forceDir * dt;
            player.recoilOffset.y += (dyP / distP) * magForce * forceDir * dt;
        }
    }
}


class ProgressionManager {
    constructor() {
        this.perks = [
            { title: 'Orbit Speed +20%', apply: (engine) => { engine.player.angularVelocity *= 1.2; } },
            { title: 'Dash Cooldown -20%', apply: (engine) => { engine.player.dashCooldown *= 0.8; } },
            { title: 'Repel Power +30%', apply: (engine) => { engine.repelPower *= 1.3; } },
            { title: 'Dash Duration +50%', apply: (engine) => { engine.player.dashDuration *= 1.5; } },
            { title: 'Combo Decay Slower', apply: (engine) => { engine.comboDecayRate *= 0.7; } },
            { title: 'Base Score Mult +1', apply: (engine) => { engine.scoreMult += 1; } },
            { title: 'Sun Repel Distance +20%', apply: (engine) => { engine.sunRepelRadius *= 1.2; } },
            { title: 'Max Combo +5', apply: (engine) => { engine.maxCombo += 5; } }
        ];
    }

    generateChoices() {
        let choices = [];
        let pool = [...this.perks];
        for (let i = 0; i < 3; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            choices.push(pool.splice(idx, 1)[0]);
        }
        return choices;
    }

    applyPerk(perk, engine) {
        perk.apply(engine);
    }
}

class OptionsMenu {
    constructor(engine) {
        this.engine = engine;
        this.isOpen = false;
        this.selectedIdx = 0;
        this.opts = [
            { id: 'mute', name: 'Master Mute', type: 'bool' },
            { id: 'sfxVol', name: 'SFX Vol', type: 'slider', min: 0, max: 100, step: 10 },
            { id: 'musicVol', name: 'Music Vol', type: 'slider', min: 0, max: 100, step: 10 },
            { id: 'screenShake', name: 'Screen Shake', type: 'select', options: [100, 50, 0] },
            { id: 'particleDensity', name: 'Particles', type: 'select', options: ['high', 'low'] },
            { id: 'highContrast', name: 'High Contrast', type: 'bool' },
            { id: 'showFps', name: 'Show FPS', type: 'bool' },
            { id: 'touchControls', name: 'Touch Controls', type: 'select', options: ['auto', 'always', 'off'] },
            { id: 'touchHandedness', name: 'Handedness', type: 'select', options: ['right', 'left'] },
            { id: 'export', name: 'Export Save', type: 'action' },
            { id: 'import', name: 'Import Save', type: 'action' },
            { id: 'reset', name: 'Reset Data', type: 'action' }
        ];
        this.resetStep = 0;
        this.exportText = "";
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.resetStep = 0;
        this.exportText = "";
    }

    update(dt) {
        if (!this.isOpen) return;
        const input = this.engine.input;
        if (input.isJustPressed('up')) {
            this.selectedIdx = (this.selectedIdx - 1 + this.opts.length) % this.opts.length;
            this.resetStep = 0;
        }
        if (input.isJustPressed('down')) {
            this.selectedIdx = (this.selectedIdx + 1) % this.opts.length;
            this.resetStep = 0;
        }

        const opt = this.opts[this.selectedIdx];
        const data = this.engine.saveManager.data.options;

        if (input.isJustPressed('left')) {
            if (opt.type === 'slider') {
                data[opt.id] = Math.max(opt.min, data[opt.id] - opt.step);
                this.engine.saveManager.save();
            } else if (opt.type === 'select') {
                let idx = opt.options.indexOf(data[opt.id]);
                idx = (idx - 1 + opt.options.length) % opt.options.length;
                data[opt.id] = opt.options[idx];
                this.engine.saveManager.save();
            }
        }
        if (input.isJustPressed('right')) {
            if (opt.type === 'slider') {
                data[opt.id] = Math.min(opt.max, data[opt.id] + opt.step);
                this.engine.saveManager.save();
            } else if (opt.type === 'select') {
                let idx = opt.options.indexOf(data[opt.id]);
                idx = (idx + 1) % opt.options.length;
                data[opt.id] = opt.options[idx];
                this.engine.saveManager.save();
            }
        }

        if (input.isJustPressed('action') || input.isJustPressed('switch')) {
            if (opt.type === 'bool') {
                data[opt.id] = !data[opt.id];
                this.engine.saveManager.save();
            } else if (opt.id === 'reset') {
                if (this.resetStep === 0) {
                    this.resetStep = 1;
                } else {
                    this.engine.saveManager.data = this.engine.saveManager.getDefaultData();
                    this.engine.saveManager.save();
                    this.resetStep = 0;
                    this.engine.highScore = 0;
                }
            } else if (opt.id === 'export') {
                this.exportText = btoa(JSON.stringify(this.engine.saveManager.data));
                navigator.clipboard.writeText(this.exportText).catch(()=>{});
            } else if (opt.id === 'import') {
                const val = prompt("Paste Base64 save data:");
                if (val) {
                    try {
                        const parsed = JSON.parse(atob(val));
                        if (parsed && parsed.options) {
                            this.engine.saveManager.data = parsed;
                            this.engine.saveManager.save();
                            this.engine.highScore = parsed.highScore || 0;
                        }
                    } catch(e) {}
                }
            }
        }
    }

    draw(ctx, cx, cy) {
        if (!this.isOpen) return;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        const w = 500;
        const h = 450;
        ctx.fillRect(cx - w/2, cy - h/2, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('OPTIONS', cx, cy - h/2 + 30);

        ctx.font = '16px monospace';
        const startY = cy - h/2 + 70;
        const lh = 28;

        const data = this.engine.saveManager.data.options;

        for (let i = 0; i < this.opts.length; i++) {
            const opt = this.opts[i];
            let valStr = "";
            if (opt.type === 'bool') valStr = data[opt.id] ? 'ON' : 'OFF';
            else if (opt.type === 'slider') valStr = data[opt.id].toString();
            else if (opt.type === 'select') valStr = data[opt.id].toString();
            else if (opt.id === 'reset') {
                valStr = this.resetStep === 0 ? 'Press Action to Reset' : 'Press Again to Confirm!';
            } else if (opt.id === 'export') {
                valStr = this.exportText ? 'Copied!' : 'Press Action';
            } else if (opt.id === 'import') {
                valStr = 'Press Action';
            }

            ctx.textAlign = 'left';
            ctx.fillStyle = i === this.selectedIdx ? '#0f0' : '#fff';
            ctx.fillText((i === this.selectedIdx ? '> ' : '  ') + opt.name, cx - 200, startY + i * lh);
            ctx.textAlign = 'right';
            ctx.fillText(valStr, cx + 200, startY + i * lh);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Press ESC/P to close', cx, cy + h/2 - 20);
    }
}


class GameEngine {
    constructor() {
        this.input = new InputManager();
        this.saveManager = new SaveManager();
        this.sound = new SoundEngine();

        this.state = 'TITLE'; // TITLE, PLAYING, GAME_OVER
        this.lastTime = performance.now();

        this.score = 0;
        this.highScore = this.saveManager.data.highScore || 0;

        this.player = new Player();
        this.enemies = [];
        this.particles = [];
        this.analytics = new AnalyticsTracker();
        this.vfx = new JuiceManager(this);
        this.world = new DioramaWorld();

        this.spawnTimer = 0;
        this.spawnRate = 2.0;
        this.boss = null;
        this.nextBossScore = 150;
        this.bossWarningTimer = 0;
        this.bossIndex = 0; // seconds
        this.boss = null;
        this.nextBossScore = 150;
        this.bossWarningTimer = 0;
        this.bossIndex = 0;

        // Custom binding for mouse/touch tap to switch polarity

        this.pickups = [];
        this.progression = new ProgressionManager();
        this.comboMultiplier = 1;
        this.comboTimer = 1;
        this.comboDecayRate = 0.5;
        this.maxCombo = 5;
        this.scoreMult = 1;
        this.repelPower = 1;
        this.sunRepelRadius = 30;
        this.draftChoices = [];
        this.wave = 1;
this.input.bindings['switch'] = ['Space', 'Enter'];
        this.optionsMenu = new OptionsMenu(this);
    }


    updateUI() {
        const ui = document.getElementById('uiLayer');
        if (ui) {
            ui.style.display = (this.state === 'TITLE' || this.state === 'PAUSED' || this.state === 'GAME_OVER' || this.state === 'UPGRADE_DRAFT') ? 'block' : 'none';
        }
    }

    start() {
        window.gameEngine = this;
        requestAnimationFrame(t => this.loop(t));
    }

    reset() {
        this.player = new Player();
        this.enemies = [];
        this.particles = [];
        this.analytics = new AnalyticsTracker();
        this.vfx = new JuiceManager(this);
        this.world = new DioramaWorld();
        this.score = 0;
        this.spawnTimer = 0;
        this.spawnRate = 2.0;
        this.boss = null;
        this.nextBossScore = 150;
        this.bossWarningTimer = 0;
        this.bossIndex = 0;

        this.pickups = [];
        this.comboMultiplier = 1;
        this.comboTimer = 1;
        this.wave = 1;
this.state = 'PLAYING';
        if (typeof JuiceManager !== 'undefined') this.vfx = new JuiceManager(this);
    }

    createParticles(x, y, color, count) {
        for(let i=0; i<count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    handleInput() {
        // Touch/Mouse tap to switch polarity logic
        let tapped = this.input.isJustPressed('switch');
        const tc = this.saveManager.data.options.touchControls;
        const isTouchDev = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (tc !== 'off') {
            const usingTouchUi = tc === 'always' || (tc === 'auto' && isTouchDev);
            if (usingTouchUi && this.state === 'PLAYING') {
                if ((this.input.mouse.down && !this.mouseWasDown) || (this.input.touch.down && !this.touchWasDown)) {
                    const px = this.input.touch.down ? this.input.touch.x : this.input.mouse.x;
                    const hand = this.saveManager.data.options.touchHandedness;
                    const cw = window.innerWidth;
                    const actX = hand === 'right' ? cw - 80 : 80;
                    if (Math.abs(px - actX) < 100) {
                        tapped = true;
                    }
                }
            } else {
                tapped = tapped || (this.input.mouse.down && !this.mouseWasDown) || (this.input.touch.down && !this.touchWasDown);
            }
        }

        this.mouseWasDown = this.input.mouse.down;
        this.touchWasDown = this.input.touch.down;

        return tapped;
    }

    update(dt) {
        if (this.sound) {
            // Check for low HP equivalent: since it's 1-hit kill, we might want to check boss Warning state.
            // Actually, we'll check if player is dead or near a fast approaching boss.
            // A good substitute for 'low HP' in a 1-hit game is when there are lots of enemies on screen.
            const isLowHp = this.enemies && this.enemies.length >= 10;
            this.sound.update(dt, this.state, this.boss !== null, isLowHp);
        }

        if (this.input.isJustPressed('pause')) {
            if (this.state === 'PLAYING') {
                this.state = 'PAUSED';
            } else if (this.state === 'PAUSED') {
                this.state = 'PLAYING';
            }
        }

        if (this.input.isJustPressed('pause')) {
            if (this.state === 'TITLE' || this.state === 'PAUSED') {
                this.optionsMenu.toggle();
            }
        }

        if (this.optionsMenu.isOpen) {
            this.optionsMenu.update(dt);
            this.input.clearJustPressed();
            return;
        }

        if (this.state === 'PAUSED') {
            this.input.clearJustPressed();
            return;
        }

        if (this.state === 'TITLE') {
            const tapped = this.handleInput() || (this.input.mouse.down && !this.mouseWasDown) || (this.input.touch.down && !this.touchWasDown);
            if (tapped || this.input.isDown('up') || this.input.isDown('down') || this.input.isDown('left') || this.input.isDown('right') || this.input.isJustPressed('action') || this.input.isJustPressed('switch')) {
                this.sound.resume();
                this.sound.playMenuSelect();
                this.reset();
            }
            return;
        }


        if (this.state === 'PAUSED') {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PAUSED', cx, cy);
        }
        if (this.state === 'UPGRADE_DRAFT') {
            const cw = (window.innerWidth || 800);
            const ch = window.innerHeight;
            const cx = cw / 2;
            const cy = ch / 2;
            const boxW = 200;
            const boxH = 100;
            const startY = cy - (this.draftChoices.length * boxH + (this.draftChoices.length - 1) * 20) / 2;

            const tapped = this.handleInput() || (this.input.mouse.down && !this.mouseWasDown) || (this.input.touch.down && !this.touchWasDown);
            if (tapped) {
                const px = this.input.touch.down ? this.input.touch.x : this.input.mouse.x;
                const py = this.input.touch.down ? this.input.touch.y : this.input.mouse.y;
                for (let i = 0; i < this.draftChoices.length; i++) {
                    const bx = cx - boxW / 2;
                    const by = startY + i * (boxH + 20);
                    if (px >= bx && px <= bx + boxW && py >= by && py <= by + boxH) {
                        this.progression.applyPerk(this.draftChoices[i], this);
                        this.state = 'PLAYING';
                        this.sound.playAbsorb();
                        break;
                    }
                }
            }
            return;
        }


        if (this.state === 'GAME_OVER') {
            if (this.handleInput()) {
                this.state = 'TITLE';
            }
            return;
        }

        if (this.state === 'PLAYING') {
            const cw = (window.innerWidth || 800);
            const ch = window.innerHeight;
            const cx = cw / 2;
            const cy = ch / 2;
            const sunRadius = this.sunRepelRadius;
            if (this.vfx && this.vfx.hitStopTimer > 0) { this.vfx.update(dt); return; }

            // Update Player
            const switched = this.handleInput();
            if (switched) {
                this.player.polarity *= -1;
                this.sound.playSwitch();
            }

            if (this.input.isJustPressed('dash') && this.player.dashCooldown <= 0) {
                this.analytics.recordDash(this.player.getPos(cx, cy));
                this.sound.playDash();
            }

            // Mouse/Touch orbit controls (override left/right if clicking/dragging left/right sides)
            if (this.input.mouse.down || this.input.touch.down) {
                const px = this.input.touch.down ? this.input.touch.x : this.input.mouse.x;
                if (px < cx) this.input.keys['ArrowLeft'] = true;
                if (px >= cx) this.input.keys['ArrowRight'] = true;
            } else {
                this.input.keys['ArrowLeft'] = false;
                this.input.keys['ArrowRight'] = false;
            }

            this.player.update(dt, this.input);
            if(this.world) this.world.update(dt, this.player, this.enemies, this.particles, ch, cw);
            const playerPos = this.player.getPos(cx, cy);
            if (this.vfx && this.player.isDashing) { this.vfx.emitTrail(playerPos.x, playerPos.y, '#ffffff', 8); }
            this.analytics.updateDistance(playerPos.x, playerPos.y);


            // Combo Logic
            this.comboTimer -= dt * this.comboDecayRate;
            if (this.comboTimer <= 0) {
                this.comboMultiplier = Math.max(1, this.comboMultiplier - 0.5);
                this.comboTimer = 1;
            }
            // Boss Spawner Logic
            if (this.score >= this.nextBossScore && !this.boss && this.bossWarningTimer <= 0) {
                this.bossWarningTimer = 3.0; // 3 seconds warning
                this.sound.playRepel(); // Re-use sound as warning siren
            }

            if (this.bossWarningTimer > 0) {
                this.bossWarningTimer -= dt;
                if (this.bossWarningTimer <= 0) {
                    // Spawn boss
                    const bossClass = this.bossIndex % 2 === 0 ? TwinBoss : MagnetBoss;
                    this.boss = new bossClass(cx, cy, cw, ch);
                    this.enemies.push(this.boss);
                    this.bossIndex++;
                    this.nextBossScore += 300;
                }
            }

            // Normal Spawner (pause if boss warning or boss active)
            if (!this.boss && this.bossWarningTimer <= 0) {

            this.spawnTimer -= dt;
            if (this.spawnTimer <= 0) {

                const r = Math.random();
                let newEnemy;
                if (r < 0.2) newEnemy = new Swarmer(cx, cy, cw, ch);
                else if (r < 0.4) newEnemy = new Sniper(cx, cy, cw, ch);
                else if (r < 0.6) newEnemy = new Bruiser(cx, cy, cw, ch);
                else if (r < 0.8) newEnemy = new Splitter(cx, cy, cw, ch);
                else newEnemy = new HazardEnemy(cx, cy, cw, ch);
                this.enemies.push(newEnemy);

                this.spawnTimer = this.spawnRate;
                this.spawnRate = Math.max(0.5, this.spawnRate - 0.05); // Increase difficulty
            }
            }

            // Update Enemies
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                e.update(dt, cx, cy, this.player, playerPos, this.enemies);

                // Collision with Sun
                const dxSun = cx - e.x;
                const dySun = cy - e.y;
                if (Math.sqrt(dxSun*dxSun + dySun*dySun) < sunRadius + e.size) {
                    if (this.player.invulnTimer > 0) {
                        // Skip game over if invulnerable
                    } else {
                        this.sound.playHitSun();
                        if (this.vfx) { this.vfx.addHitStop(0.8); this.vfx.addShake(30, 0, 0); }
                        this.createParticles(e.x, e.y, e.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE, 20);
                        this.state = 'GAME_OVER';
                        if (this.score > this.highScore) {
                            this.highScore = this.score;
                            this.saveManager.data.highScore = this.highScore;
                        }
                        this.saveManager.data.totalGamesPlayed++;
                        this.saveManager.data.totalScoreAccumulated += this.score;

                        // Milestones check
                        const m = this.saveManager.data.unlockedMilestones;
                        if (this.score >= 500 && !m.includes('Score 500')) m.push('Score 500');
                        if (this.score >= 1000 && !m.includes('Score 1000')) m.push('Score 1000');
                        if (this.comboMultiplier >= 5 && !m.includes('Max Combo 5')) m.push('Max Combo 5');
                        if (this.bossIndex >= 1 && !m.includes('Defeat First Boss')) m.push('Defeat First Boss');
                        if (this.wave >= 5 && !m.includes('Reach Wave 5')) m.push('Reach Wave 5');
                        if (this.saveManager.data.totalScoreAccumulated >= 5000 && !m.includes('Total 5000 Score')) m.push('Total 5000 Score');

                        this.saveManager.save();
                        break;
                    }
                }

                // Collision with Player
                const dxP = playerPos.x - e.x;
                const dyP = playerPos.y - e.y;
                if (Math.sqrt(dxP*dxP + dyP*dyP) < this.player.size + e.size) {
                    if (e.isBoss) {
                        if (this.player.isDashing) {
                            if (this.player.polarity !== e.polarity) {
                                e.takeDamage(1);
                                this.comboMultiplier = Math.min(this.maxCombo, this.comboMultiplier + 0.5);
                                this.comboTimer = 1;
                                this.score += 50 * this.scoreMult * Math.floor(this.comboMultiplier);
                                if (this.vfx) { this.vfx.addHitStop(0.1); this.vfx.addShake(5, dxP, dyP); this.vfx.addPopup('+' + (50 * this.scoreMult * Math.floor(this.comboMultiplier)), e.x, e.y, '#00ff00'); this.vfx.emitDirectionalParticles(e.x, e.y, dxP, dyP, '#ffffff', 20); }
                                this.createParticles(e.x, e.y, '#ffffff', 25);
                                this.sound.playAbsorb();
                                // Bounce off
                                const angleP = Math.atan2(dyP, dxP);
                                this.player.recoilOffset.x += Math.cos(angleP) * 30;
                                this.player.recoilOffset.y += Math.sin(angleP) * 30;
                                this.player.isDashing = false; // Stop dash
                            } else {
                                // Same polarity, repel
                                this.sound.playRepel();
                                const angleP = Math.atan2(dyP, dxP);
                                this.player.recoilOffset.x += Math.cos(angleP) * 20;
                                this.player.recoilOffset.y += Math.sin(angleP) * 20;
                            }
                        } else {
                            // Non-dashing touch: player takes huge knockback or dies if no invuln
                            this.sound.playRepel();
                            const angleP = Math.atan2(dyP, dxP);
                            this.player.recoilOffset.x += Math.cos(angleP) * 40;
                            this.player.recoilOffset.y += Math.sin(angleP) * 40;
                        }
                        continue; // Skip normal enemy collision logic for boss
                    }

                    if (this.player.isDashing) {
                        e.markedForDeletion = true;
                        this.comboMultiplier = Math.min(this.maxCombo, this.comboMultiplier + 0.5);
                        this.comboTimer = 1;
                        this.score += 20 * this.scoreMult * Math.floor(this.comboMultiplier);
                        if (this.vfx) { this.vfx.addHitStop(0.05); this.vfx.addShake(3, dxP, dyP); this.vfx.addPopup('+' + (20 * this.scoreMult * Math.floor(this.comboMultiplier)), e.x, e.y, '#ffffff'); this.vfx.emitDirectionalParticles(e.x, e.y, dxP, dyP, '#ffffff', 10); }
                        this.createParticles(e.x, e.y, '#ffffff', 15);
                        this.sound.playAbsorb(); // Or a custom hit sound
                        // Apply recoil to player
                        const angleP = Math.atan2(dyP, dxP);
                        this.player.recoilOffset.x += Math.cos(angleP) * 10;
                        this.player.recoilOffset.y += Math.sin(angleP) * 10;
                    } else if (e.polarity !== this.player.polarity) {
                        // Absorb
                        this.comboMultiplier = Math.min(this.maxCombo, this.comboMultiplier + 0.5);
                        this.comboTimer = 1;
                        this.score += 10 * this.scoreMult * Math.floor(this.comboMultiplier);
                        if (this.vfx) { this.vfx.addShake(2, 0, 0); this.vfx.addPopup('+' + (10 * this.scoreMult * Math.floor(this.comboMultiplier)), e.x, e.y, '#ffffff'); }
                        this.sound.playAbsorb();
                        this.createParticles(e.x, e.y, COLORS.SUN, 10);
                        e.markedForDeletion = true;
                        this.analytics.recordAbsorb();
                    } else {
                        // If same polarity, shouldn't really touch due to repulsion, but if it does (high speed), repel harder
                        e.vx *= -2 * this.repelPower;
                        e.vy *= -2 * this.repelPower;
                        e.knockbackX = e.vx * -3 * this.repelPower;
                        e.knockbackY = e.vy * -3 * this.repelPower;
                        this.sound.playRepel();
                        // Add small recoil
                        const angleP = Math.atan2(dyP, dxP);
                        this.player.recoilOffset.x += Math.cos(angleP) * 5;
                        this.player.recoilOffset.y += Math.sin(angleP) * 5;
                    }
                }

                // Off-screen cleanup (repelled successfully)
                if (e.x < -100 || e.x > cw + 100 || e.y < -100 || e.y > ch + 100) {
                    if (e.polarity === this.player.polarity) {
                        this.comboMultiplier = Math.min(this.maxCombo, this.comboMultiplier + 0.5);
                        this.comboTimer = 1;
                        this.score += 5 * this.scoreMult * Math.floor(this.comboMultiplier);
                        this.analytics.recordRepel();
                    }
                    e.markedForDeletion = true;
                }
            }

            this.enemies = this.enemies.filter(e => !e.markedForDeletion);
            if (this.boss && this.boss.markedForDeletion) {
                this.score += 500 * this.scoreMult * Math.floor(this.comboMultiplier);
                if (this.vfx) { this.vfx.addHitStop(0.5); this.vfx.addShake(20, 0, 0); this.vfx.addPopup('+500', this.boss.x, this.boss.y, '#ffff00'); }
                this.pickups.push(new Pickup(this.boss.x, this.boss.y, 2));
                this.sound.playBossDefeat();
                this.boss = null;
                this.enemies.forEach(e => e.markedForDeletion = true);
                this.state = 'UPGRADE_DRAFT';
                this.draftChoices = this.progression.generateChoices();
                this.wave++;
            }


            // Pickups
            for (let i = this.pickups.length - 1; i >= 0; i--) {
                let p = this.pickups[i];
                p.update(dt);
                const dxP = playerPos.x - p.x;
                const dyP = playerPos.y - p.y;
                if (Math.sqrt(dxP*dxP + dyP*dyP) < this.player.size + 10) {
                    p.markedForDeletion = true;
                    this.sound.playPickup();
                    if (p.type === 1) {
                        this.score += 50 * this.scoreMult * Math.floor(this.comboMultiplier);
                    } else if (p.type === 2) {
                        this.comboMultiplier = this.maxCombo;
                        this.comboTimer = 1;
                    }
                }
            }
            this.pickups = this.pickups.filter(p => !p.markedForDeletion);
            // Update Particles
            this.particles.forEach(p => p.update(dt));
            this.particles = this.particles.filter(p => p.life > 0);

            if (this.vfx) this.vfx.update(dt);
        }

        this.input.clearJustPressed();
    }

    draw() {
        ctx.fillStyle = COLORS.BG;
        ctx.fillRect(0, 0, cw, ch);
        if(this.world) this.world.draw(ctx);

        const cx = cw / 2;
        const cy = ch / 2;

        if (this.state === 'TITLE') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Polarity Diorama', cx, cy - 50);
            ctx.font = '20px monospace';
            ctx.fillText('Click / Tap to Start', cx, cy + 20);
            ctx.font = '16px monospace';
            ctx.fillText('A/D or Drag Left/Right to Orbit', cx, cy + 60);
            ctx.fillText('Space or Tap to Switch Polarity', cx, cy + 85);
            ctx.fillText('Opposite Attracts (Absorb for Points)', cx, cy + 120);
            ctx.fillText('Same Repels (Push Off-screen for Points)', cx, cy + 145);
            ctx.fillText('Protect the Sun!', cx, cy + 170);
            return;
        }

        // Draw Sun (Papercraft)
        const sunPts = [];
        const sunRadius = this.sunRepelRadius;
            if (this.vfx && this.vfx.hitStopTimer > 0) { this.vfx.update(dt); return; }
        for (let i=0; i<8; i++) {
            const a = (i/8)*Math.PI*2;
            sunPts.push({
                x: cx + Math.cos(a) * sunRadius * (i%2===0?1:0.9),
                y: cy + Math.sin(a) * sunRadius * (i%2===0?1:0.9)
            });
        }
        drawPaperPoly(ctx, sunPts, COLORS.SUN);

        // Draw Boss UI
        if (this.bossWarningTimer > 0) {
            ctx.fillStyle = (Math.floor(this.bossWarningTimer * 10) % 2 === 0) ? '#ff0000' : '#ffffff';
            ctx.font = 'bold 30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('WARNING: ANOMALY DETECTED', cx, cy - 100);
        }

        if (this.boss) {
            // Boss Health Bar
            const barWidth = 400;
            const barHeight = 20;
            const bx = cx - barWidth / 2;
            const by = 50;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(bx, by, barWidth, barHeight);

            const hpRatio = Math.max(0, this.boss.hp / this.boss.maxHp);
            ctx.fillStyle = this.boss.polarity === POLARITY.POSITIVE ? COLORS.POSITIVE : COLORS.NEGATIVE;
            ctx.fillRect(bx, by, barWidth * hpRatio, barHeight);

            ctx.strokeStyle = '#fff';
            ctx.strokeRect(bx, by, barWidth, barHeight);

            ctx.fillStyle = '#fff';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS HP', cx, by + 15);
        }

        ctx.save();
        if (this.vfx) this.vfx.applyShake(ctx);

        // Draw Orbit Path
        ctx.beginPath();
        ctx.arc(cx, cy, this.player.orbitRadius, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        this.enemies.forEach(e => e.draw(ctx));
        this.player.draw(ctx, cx, cy);
        this.particles.forEach(p => p.draw(ctx));


        this.pickups.forEach(p => p.draw(ctx));

        if (this.vfx) this.vfx.draw(ctx);
        ctx.restore();

        // Combo HUD
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Combo: x${Math.floor(this.comboMultiplier)}`, 20, 50);
        ctx.fillText(`Wave: ${this.wave}`, 20, 80);

        // Combo Bar
        ctx.fillStyle = '#555';
        ctx.fillRect(20, 110, 100, 10);
        ctx.fillStyle = '#0ff';
        ctx.fillRect(20, 110, 100 * Math.max(0, this.comboTimer), 10);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(20, 110, 100, 10);
        // HUD
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`Score: ${this.score}`, 20, 20);
        ctx.textAlign = 'right';
        ctx.fillText(`High: ${this.highScore}`, cw - 20, 20);

        // Dash HUD
        ctx.textAlign = 'center';
        if (this.player.dashCooldown <= 0) {
            ctx.fillStyle = '#00ff00';
            ctx.fillText('DASH: READY', cx, ch - 40);
        } else {
            ctx.fillStyle = '#ff0000';
            ctx.fillText(`DASH CD: ${this.player.dashCooldown.toFixed(1)}`, cx, ch - 40);
        }


        if (this.state === 'PAUSED') {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PAUSED', cx, cy);
        }
        if (this.state === 'UPGRADE_DRAFT') {
            const cw = (window.innerWidth || 800);
            const ch = window.innerHeight;
            const cx = cw / 2;
            const cy = ch / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.8)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 30px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`WAVE ${this.wave - 1} CLEARED!`, cx, cy - 250);
            ctx.font = '20px monospace';
            ctx.fillText('SELECT UPGRADE:', cx, cy - 200);

            const boxW = 200;
            const boxH = 100;
            const startY = cy - (this.draftChoices.length * boxH + (this.draftChoices.length - 1) * 20) / 2;
            for (let i = 0; i < this.draftChoices.length; i++) {
                const bx = cx - boxW / 2;
                const by = startY + i * (boxH + 20);

                ctx.fillStyle = '#444';
                ctx.fillRect(bx, by, boxW, boxH);
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(bx, by, boxW, boxH);

                ctx.fillStyle = '#fff';
                ctx.font = '16px monospace';
                ctx.fillText(this.draftChoices[i].title, cx, by + boxH / 2);
            }
        }


        if (this.state === 'GAME_OVER') {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, 0, cw, ch);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('GAME OVER', cx, cy - 30);
            ctx.font = '20px monospace';
            ctx.fillText(`Final Score: ${this.score}`, cx, cy + 20);
            ctx.fillText('Click / Tap to Restart', cx, cy + 60);

            // Draw milestones
            ctx.font = '16px monospace';
            ctx.fillStyle = '#ff0';
            const m = this.saveManager.data.unlockedMilestones;
            if (m && m.length > 0) {
                ctx.fillText(`Milestones: ${m.length}/6`, cx, cy + 100);
            }
        }

        if (this.state === 'TITLE') {
            ctx.font = '16px monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ff0';
            const m = this.saveManager.data.unlockedMilestones || [];
            ctx.fillText(`Milestones: ${m.length}/6`, 10, 50);
        }

        if (this.optionsMenu && this.optionsMenu.isOpen) {
            this.optionsMenu.draw(ctx, cx, cy);
            return;
        } else if (this.state === 'TITLE' || this.state === 'PAUSED') {
            ctx.fillStyle = '#aaa';
            ctx.font = '16px monospace';
            ctx.textAlign = 'right';
            ctx.fillText('Press ESC/P for Options', cw - 20, 30);
        }

        if (this.saveManager.data.options.showFps) {
            ctx.fillStyle = '#0f0';
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('FPS: ' + Math.round(1 / dt), 10, 70);
        }

        // Touch Controls Rendering
        const tc = this.saveManager.data.options.touchControls;
        const isTouchDev = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (tc === 'always' || (tc === 'auto' && isTouchDev)) {
            if (this.state === 'PLAYING') {
                const hand = this.saveManager.data.options.touchHandedness;
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 2;

                // Draw joystick base
                const joyX = hand === 'right' ? 80 : cw - 80;
                const joyY = ch - 80;
                ctx.beginPath();
                ctx.arc(joyX, joyY, 50, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();

                // Draw action button
                const actX = hand === 'right' ? cw - 80 : 80;
                const actY = ch - 80;
                ctx.beginPath();
                ctx.arc(actX, actY, 40, 0, Math.PI*2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = '16px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('SWAP', actX, actY);
            }
        }
    }

    loop(time) {
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;

        this.update(dt);
        this.updateUI();
        this.draw();

        requestAnimationFrame(t => this.loop(t));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const engine = new GameEngine();
    engine.start();
});
