class SaveManager {
    constructor() {
        this.saveKey = 'arcade_game_017_017-sandstorm-grapple_v1';
        this.memoryFallback = {
            highScore: 0,
            bestCombo: 0,
            totalGamesPlayed: 0,
            totalScoreAccumulated: 0,
            unlockedMilestones: [],
            options: {
                masterVolume: 100,
                sfxVolume: 100,
                musicVolume: 100
            }
        };
        this.data = this.load();
    }

    load() {
        try {
            const stored = localStorage.getItem(this.saveKey);
            if (stored) {
                return { ...this.memoryFallback, ...JSON.parse(stored) };
            }
        } catch (e) {
            console.warn("localStorage unavailable, using memory fallback", e);
        }
        return { ...this.memoryFallback };
    }

    save() {
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(this.data));
        } catch (e) {
            console.warn("localStorage save failed", e);
        }
    }

    updateScore(score, combo) {
        let isNewHigh = false;
        if (score > this.data.highScore) {
            this.data.highScore = score;
            isNewHigh = true;
        }
        if (combo > this.data.bestCombo) {
            this.data.bestCombo = combo;
        }
        this.data.totalScoreAccumulated += score;
        this.data.totalGamesPlayed += 1;

        // Milestones
        if (this.data.highScore >= 10000 && !this.data.unlockedMilestones.includes("Dune Jumper")) {
            this.data.unlockedMilestones.push("Dune Jumper");
        }
        if (this.data.highScore >= 50000 && !this.data.unlockedMilestones.includes("Desert Ghost")) {
            this.data.unlockedMilestones.push("Desert Ghost");
        }
        if (this.data.bestCombo >= 20 && !this.data.unlockedMilestones.includes("Magnetic Master")) {
            this.data.unlockedMilestones.push("Magnetic Master");
        }

        this.save();
        return isNewHigh;
    }

    exportBase64() {
        return btoa(JSON.stringify(this.data));
    }

    importBase64(str) {
        try {
            const parsed = JSON.parse(atob(str));
            if (parsed && typeof parsed === 'object') {
                this.data = { ...this.memoryFallback, ...parsed };
                this.save();
                return true;
            }
        } catch (e) {
            console.error("Invalid save string");
        }
        return false;
    }

    reset() {
        this.data = { ...this.memoryFallback };
        this.save();
    }
}

class SoundEngine {
    constructor(saveManager) {
        this.saveManager = saveManager;
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;
        this.musicOscillators = [];
        this.isPlayingMusic = false;
        this.musicInterval = null;
        this.bpm = 120;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain = this.ctx.createGain();

            this.sfxGain.connect(this.masterGain);
            this.musicGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.updateVolumes();
            this.initialized = true;
        } catch (e) {
            console.warn("Web Audio API not supported", e);
        }
    }

    updateVolumes() {
        if (!this.initialized) return;
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.masterVolume / 100;
        this.sfxGain.gain.value = opts.sfxVolume / 100;
        this.musicGain.gain.value = (opts.musicVolume / 100) * 0.3; // Music slightly quieter
    }

    playTone(freq, type, duration, vol = 1, slideFreq = null) {
        if (!this.initialized || this.ctx.state !== 'running') return;

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

    playNoise(duration, vol=1) {
        if (!this.initialized || this.ctx.state !== 'running') return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start();
    }

    sfxGrappleShoot() { this.playTone(600, 'sine', 0.2, 0.5, 900); }
    sfxGrappleHit() { this.playTone(300, 'square', 0.1, 0.6); }
    sfxPolaritySwitch(isNorth) {
        if (isNorth) this.playTone(800, 'triangle', 0.15, 0.4, 1200);
        else this.playTone(1200, 'triangle', 0.15, 0.4, 800);
    }
    sfxJump() { this.playTone(200, 'sine', 0.3, 0.5, 400); }
    sfxCoin() { this.playTone(1200, 'sine', 0.1, 0.5, 2000); setTimeout(()=>this.playTone(2000, 'sine', 0.2, 0.5, 3000), 50); }
    sfxHurt() { this.playNoise(0.3, 0.8); this.playTone(150, 'sawtooth', 0.3, 0.8, 50); }
    sfxGameOver() { this.playTone(300, 'sawtooth', 1.0, 0.8, 50); this.playNoise(1.0, 1.0); }
    sfxUI() { this.playTone(800, 'sine', 0.05, 0.3); }

    startMusic() {
        if (!this.initialized || this.isPlayingMusic) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isPlayingMusic = true;

        const notes = [220, 261.63, 293.66, 329.63, 392.00, 440]; // A Minor Pentatonic
        let step = 0;

        const playNote = () => {
            if (!this.isPlayingMusic) return;
            const freq = notes[step % notes.length];

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            // Adding a little bit of portamento for a desert feel
            if (Math.random() > 0.8) {
               osc.frequency.linearRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.1);
            }

            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

            osc.connect(gain);
            gain.connect(this.musicGain);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.3);

            this.musicOscillators.push(osc);

            // cleanup
            setTimeout(() => {
                const idx = this.musicOscillators.indexOf(osc);
                if (idx > -1) this.musicOscillators.splice(idx, 1);
            }, 300);

            step++;

            // Occasional bass drone
            if (step % 8 === 0) {
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                bassOsc.type = 'sawtooth';
                bassOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // A1
                bassGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
                bassGain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);

                // add a lowpass filter to the bass for that muffled sandstorm sound
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 400;

                bassOsc.connect(filter);
                filter.connect(bassGain);
                bassGain.connect(this.musicGain);

                bassOsc.start();
                bassOsc.stop(this.ctx.currentTime + 1.0);
            }

            const beatDuration = (60 / this.bpm) * 1000;
            this.musicInterval = setTimeout(playNote, beatDuration / 2);
        };

        playNote();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        if (this.musicInterval) {
            clearTimeout(this.musicInterval);
            this.musicInterval = null;
        }
        this.musicOscillators.forEach(osc => {
            try { osc.stop(); } catch(e) {}
        });
        this.musicOscillators = [];
    }
}
