class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.ready = false;

        // Procedural music state
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        this.bpm = 120;
        this.isPlayingMusic = false;
        this.game = null;
    }

    init() {
        if (this.ready) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.musicGain = this.ctx.createGain();
            this.musicGain.gain.value = 0.3;
            this.musicGain.connect(this.masterGain);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.6;
            this.sfxGain.connect(this.masterGain);

            this.ready = true;
        } catch (e) {
            console.warn('AudioContext not supported');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setGameContext(game) {
        this.game = game;
    }

    startMusic() {
        if (!this.ready || this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.current16thNote = 0;
        this.scheduler();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
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
        // Adapt intensity based on game state
        let intensity = 0;
        if (this.game) {
            if (this.game.bossActive) {
                intensity = 2; // High intensity
            } else if (this.game.score > 500) {
                intensity = 1; // Medium intensity
            }
        }

        // Kick drum on 0, 4, 8, 12
        if (beatNumber % 4 === 0) {
            this.playDrum('kick', time);
        }

        // Hihat on odd 8ths (2, 6, 10, 14) and more frequently if intensity > 0
        if (beatNumber % 4 === 2 || (intensity > 0 && beatNumber % 2 === 0) || (intensity > 1)) {
            this.playDrum('hihat', time);
        }

        // Snare on 4 and 12
        if (beatNumber === 4 || beatNumber === 12) {
            this.playDrum('snare', time);
        }

        // Bassline
        if (beatNumber % 2 === 0) {
            let noteFreq = 55; // A1
            if (intensity > 0 && beatNumber % 8 === 4) noteFreq = 65.41; // C2
            if (intensity > 1 && beatNumber === 14) noteFreq = 73.42; // D2

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(noteFreq, time);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

            // Filter
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(400 + (intensity * 400), time);
            filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.musicGain);

            osc.start(time);
            osc.stop(time + 0.25);
        }
    }

    scheduler() {
        if (!this.isPlayingMusic) return;

        // Resync if suspended
        if (this.nextNoteTime < this.ctx.currentTime - 0.5) {
            this.nextNoteTime = this.ctx.currentTime;
        }

        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }

        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    playDrum(type, time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.connect(this.musicGain);

        if (type === 'kick') {
            osc.frequency.setValueAtTime(150, time);
            osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
            gain.gain.setValueAtTime(1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            osc.connect(gain);
            osc.start(time);
            osc.stop(time + 0.1);
        } else if (type === 'hihat') {
            const bufferSize = this.ctx.sampleRate * 0.1;
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

            gain.gain.setValueAtTime(0.3, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

            noise.connect(filter);
            filter.connect(gain);
            noise.start(time);
        } else if (type === 'snare') {
            const bufferSize = this.ctx.sampleRate * 0.2;
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

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, time);

            const oscGain = this.ctx.createGain();
            const noiseGain = this.ctx.createGain();

            oscGain.gain.setValueAtTime(0.5, time);
            oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

            noiseGain.gain.setValueAtTime(0.5, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

            osc.connect(oscGain);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);

            oscGain.connect(gain);
            noiseGain.connect(gain);

            osc.start(time);
            noise.start(time);
            osc.stop(time + 0.2);
        }
    }

    playSynth(freq, type, duration, vol = 1) {
        if (!this.ready || !this.ctx) return;
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

    playShoot() {
        this.playSynth(400, 'square', 0.1, 0.3);
        setTimeout(() => this.playSynth(200, 'square', 0.1, 0.2), 50);
    }

    playHit() {
        if (!this.ready || !this.ctx) return;
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(10, time + 0.3);

        gain.gain.setValueAtTime(0.6, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(time);
        osc.stop(time + 0.3);
    }

    playBeat() {
        this.playSynth(100, 'sine', 0.1, 0.5);
    }

    playEcho() {
        if (!this.ready || !this.ctx) return;
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, time);
        osc.frequency.linearRampToValueAtTime(800, time + 0.1);
        osc.frequency.linearRampToValueAtTime(400, time + 0.3);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        // Add echo delay effect
        const delay = this.ctx.createDelay();
        delay.delayTime.value = 0.15;
        const feedback = this.ctx.createGain();
        feedback.gain.value = 0.3;

        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(this.sfxGain);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        gain.connect(delay); // Send to delay

        osc.start(time);
        osc.stop(time + 0.3);
    }

    playDash() {
        if (!this.ready || !this.ctx) return;
        const time = this.ctx.currentTime;

        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.linearRampToValueAtTime(200, time + 0.3);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.4, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);

        noise.start(time);
    }

    playUI() {
        if (!this.ready || !this.ctx) return;
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, time);
        osc.frequency.exponentialRampToValueAtTime(440, time + 0.1);

        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(time);
        osc.stop(time + 0.1);
    }
}
