class AudioEngine {
    constructor(saveManager) {
        this.ctx = null;
        this.saveManager = saveManager;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Music state
        this.nextNoteTime = 0;
        this.currentNote = 0;
        this.tempo = 120;
        this.sequence = [440, 0, 329.63, 0, 261.63, 293.66, 329.63, 0]; // A4, E4, C4, D4, E4
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

        this.updateVolumes();
        this.initialized = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
    }

    updateVolumes() {
        if (!this.initialized) return;
        const opts = this.saveManager.data.options;
        this.masterGain.gain.value = opts.masterMute ? 0 : 1;
        this.sfxGain.gain.value = opts.sfxVolume / 100;
        this.musicGain.gain.value = (opts.musicVolume / 100) * 0.2; // Background music is naturally quieter
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        } else if (!this.initialized) {
            this.init();
        }
    }

    playSynth(freq, type, duration, vol, isMusic = false) {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(isMusic ? this.musicGain : this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playNoise(duration, vol) {
        if (!this.initialized) return;
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

    // SFX Methods
    playOverdrive() { this.playSynth(800, 'square', 0.4, 0.3); }
    playHit() { this.playNoise(0.2, 0.5); }
    playCollect() {
        this.playSynth(880, 'sine', 0.1, 0.3);
        setTimeout(() => this.playSynth(1108.73, 'sine', 0.15, 0.3), 100);
    }
    playAlert() { this.playSynth(200, 'sawtooth', 0.3, 0.4); }
    playGameOver() {
        this.playSynth(200, 'sawtooth', 0.5, 0.5);
        setTimeout(() => this.playSynth(150, 'sawtooth', 0.6, 0.5), 300);
        setTimeout(() => this.playSynth(100, 'sawtooth', 1.0, 0.5), 600);
    }

    updateMusic() {
        if (!this.initialized) return;

        // Simple arp sequencer
        const secondsPerBeat = 60.0 / this.tempo;
        const noteLength = 0.25; // 16th notes

        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            const freq = this.sequence[this.currentNote];
            if (freq > 0) {
                // Play synth note
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();

                osc.type = 'square';
                osc.frequency.value = freq / 2; // octave lower

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1000, this.nextNoteTime);
                filter.frequency.exponentialRampToValueAtTime(100, this.nextNoteTime + 0.1);

                gain.gain.setValueAtTime(0.2, this.nextNoteTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.nextNoteTime + noteLength * secondsPerBeat);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicGain);

                osc.start(this.nextNoteTime);
                osc.stop(this.nextNoteTime + noteLength * secondsPerBeat);
            }

            this.nextNoteTime += noteLength * secondsPerBeat;
            this.currentNote = (this.currentNote + 1) % this.sequence.length;
        }
    }
}
