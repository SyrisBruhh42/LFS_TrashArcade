class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.ready = false;

        // Synth state
        this.bpm = 120;
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.schedulerTimer = null;
        this.isPlaying = false;
    }

    init() {
        if (this.ready) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);

            // Reverb
            this.reverb = this.ctx.createConvolver();
            this.reverbGain = this.ctx.createGain();
            this.reverbGain.gain.value = 0.2;
            this.reverb.connect(this.reverbGain);
            this.reverbGain.connect(this.masterGain);

            this.generateReverb();

            this.ready = true;
        } catch (e) {
            console.warn('AudioContext not supported');
        }
    }

    generateReverb() {
        const length = this.ctx.sampleRate * 2;
        const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 3);
            }
        }
        this.reverb.buffer = impulse;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        if (this.ready && !this.isPlaying) {
            this.startBGM();
        }
    }

    setBPM(newBpm) {
        this.bpm = newBpm;
    }

    startBGM() {
        this.isPlaying = true;
        this.current16thNote = 0;
        this.nextNoteTime = this.ctx.currentTime + 0.05;
        this.scheduler();
    }

    scheduler() {
        if (!this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        // catch up
        if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
            this.nextNoteTime = this.ctx.currentTime;
        }
        this.schedulerTimer = setTimeout(() => this.scheduler(), this.lookahead);
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.bpm;
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // Kick on 0, 4, 8, 12
        if (beatNumber % 4 === 0) {
            this.playSynth(50, 'sine', 0.1, 0.6, time, true);
        }
        // Hihat on offbeats
        if (beatNumber % 2 !== 0) {
            this.playNoise(time, 0.05, 0.1);
        }
        // Bassline
        const bassFreq = [110, 110, 220, 110, 82.4, 82.4, 164.8, 82.4][beatNumber % 8];
        if (beatNumber % 2 === 0) {
            this.playSynth(bassFreq, 'sawtooth', 0.15, 0.2, time, false);
        }
    }

    playNoise(time, dur, vol) {
        const bufferSize = this.ctx.sampleRate * dur;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        noise.start(time);
    }

    playSynth(freq, type, duration, vol = 1, time = null, drop = false) {
        if (!this.ready || !this.ctx) return;
        const t = time !== null ? time : this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;

        osc.frequency.setValueAtTime(freq, t);
        if (drop) {
            osc.frequency.exponentialRampToValueAtTime(10, t + duration);
        }

        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        gain.connect(this.reverb);
        osc.start(t);
        osc.stop(t + duration);
    }

    playShoot() {
        this.playSynth(800, 'square', 0.1, 0.2, null, true);
    }

    playHit() {
        this.playNoise(this.ctx.currentTime, 0.2, 0.4);
        this.playSynth(150, 'sawtooth', 0.2, 0.4, null, true);
    }

    playBeat() {
        // Handled by BGM but can add flair
    }

    playEcho() {
        this.playSynth(1200, 'sine', 0.2, 0.2);
    }
}
