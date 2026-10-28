class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Music loop scheduling
        this.nextNoteTime = 0;
        this.lookahead = 0.1;
        this.scheduleAheadTime = 0.2;
        this.currentTick = 0;
        this.tempo = 120; // BPM
        this.mode = 'stealth'; // 'stealth' or 'alert'
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();

        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);

        this.masterGain.gain.value = 1.0;
        this.sfxGain.gain.value = 1.0;
        this.musicGain.gain.value = 0.4;

        this.initialized = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'alert') {
            this.tempo = 140;
        } else {
            this.tempo = 110;
        }
    }

    update() {
        if (!this.initialized || !this.ctx) return;

        if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
            this.nextNoteTime = this.ctx.currentTime;
        }

        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentTick, this.nextNoteTime);
            this.nextNote();
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat * 0.25; // 16th notes
        this.currentTick++;
        if (this.currentTick >= 16) {
            this.currentTick = 0;
        }
    }

    scheduleNote(tickNumber, time) {
        // Simple bass pattern
        if (tickNumber % 4 === 0) {
            this.playSynth(55, 'triangle', 0.15, 0.4, time); // A1
        } else if (tickNumber % 4 === 2) {
            this.playSynth(65.41, 'triangle', 0.1, 0.3, time); // C2
        }

        if (this.mode === 'alert') {
            // Hi-hat
            if (tickNumber % 2 === 0) {
                this.playNoise(0.05, 0.2, time);
            }
            // Snare on 2 and 4 (ticks 4 and 12)
            if (tickNumber === 4 || tickNumber === 12) {
                this.playNoise(0.15, 0.5, time);
                this.playSynth(180, 'square', 0.1, 0.4, time);
            }
        } else {
            // Slower hi-hat for stealth
            if (tickNumber % 4 === 2) {
                this.playNoise(0.05, 0.15, time);
            }
        }

        // Synth arpeggio
        if (this.mode === 'alert') {
            const arp = [220, 261.63, 329.63, 392.00]; // Am7
            if (tickNumber % 2 !== 0) {
                this.playSynth(arp[(tickNumber % 8) / 2 | 0], 'sawtooth', 0.1, 0.1, time);
            }
        }
    }

    playSynth(freq, type, duration, vol, time = this.ctx.currentTime) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Optional lowpass filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + duration);
    }

    playNoise(duration, vol, time = this.ctx.currentTime) {
        if (!this.initialized || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);

        noise.start(time);
        noise.stop(time + duration);
    }

    playTone(freq, type, duration, vol) {
        if (!this.initialized || !this.ctx) return;
        this.resume();
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

    // Existing SFX with more synthesis where needed
    playShoot() {
        // High pitched click for limited ammo
        this.playTone(800, 'square', 0.05, 0.4);
        this.playTone(400, 'sawtooth', 0.1, 0.3);
    }

    playHit() {
        this.playTone(150, 'sawtooth', 0.2, 0.7);
        // Added noise for impact
        this.playNoise(0.1, 0.5, this.ctx.currentTime);
    }

    playScore() {
        this.playTone(600, 'sine', 0.1, 0.3);
        this.playTone(800, 'sine', 0.1, 0.3);
    }

    playAlert() {
        this.playTone(800, 'square', 0.1, 0.5);
        setTimeout(() => this.playTone(800, 'square', 0.1, 0.5), 150);
    }

    playRetrieval() {
        // New SFX for ammo retrieval
        this.playTone(900, 'sine', 0.1, 0.4);
        this.playTone(1200, 'sine', 0.15, 0.4);
    }
}
