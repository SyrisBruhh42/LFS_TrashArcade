class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Synthesizer state
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;

        // Music parameters
        this.tempo = 120;
        this.isBossWave = false;
        this.isLowHp = false;
        this.baseFilterFreq = 800;

        // Track nodes
        this.synthFilter = null;
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

            // Set up background synth filter
            this.synthFilter = this.ctx.createBiquadFilter();
            this.synthFilter.type = 'lowpass';
            this.synthFilter.frequency.value = this.baseFilterFreq;
            this.synthFilter.connect(this.musicGain);

            this.initialized = true;
            this.nextNoteTime = this.ctx.currentTime + 0.1;
            this.scheduler();
        } catch(e) { console.warn("AudioContext init failed", e); }
    }

    updateVolumes(soundVol, musicVol) {
        if (!this.initialized) return;
        this.sfxGain.gain.setValueAtTime(Math.max(0, Math.min(1, soundVol)), this.ctx.currentTime);
        this.musicGain.gain.setValueAtTime(Math.max(0, Math.min(1, musicVol)), this.ctx.currentTime);
    }

    setMusicState(bossWave, lowHp) {
        if (this.isBossWave !== bossWave || this.isLowHp !== lowHp) {
            this.isBossWave = bossWave;
            this.isLowHp = lowHp;

            this.tempo = bossWave ? 150 : 120;
            if (lowHp) this.tempo += 20;

            if (!this.initialized) return;

            const targetFreq = lowHp ? 400 : (bossWave ? 2000 : 800);
            this.synthFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
        }
    }

    nextNote() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += 0.25 * secondsPerBeat;
        this.current16thNote++;
        if (this.current16thNote === 16) {
            this.current16thNote = 0;
        }
    }

    scheduleNote(beatNumber, time) {
        // Kick on 0, 4, 8, 12
        if (beatNumber % 4 === 0) {
            this.playKick(time);
        }

        // Snare on 4, 12 (if boss wave add on 2, 6, 10, 14 sometimes)
        if (beatNumber % 8 === 4) {
            this.playSnare(time);
        }

        // Hi-hat every 16th note, slightly off-beat velocity
        this.playHiHat(time, beatNumber % 2 === 0 ? 0.3 : 0.5);

        // Arpeggiator (minor pentatonic)
        const scale = [220, 261.63, 293.66, 329.63, 392.00, 440];
        let noteIndex = 0;

        if (this.isBossWave) {
            const arpeggio = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 5, 4, 2, 1, 2];
            noteIndex = arpeggio[beatNumber];
        } else {
            const arpeggio = [0, 1, 2, 3, 2, 1, 0, 4, 0, 1, 2, 3, 4, 3, 2, 1];
            noteIndex = arpeggio[beatNumber];
        }

        const freq = scale[noteIndex % scale.length] * (this.isBossWave ? 0.5 : 1); // Drop octave for boss

        // Synth Note
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = this.isBossWave ? 'sawtooth' : 'square';
        osc.frequency.setValueAtTime(freq, time);

        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.2, time + 0.02);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

        osc.connect(env);
        env.connect(this.synthFilter); // Routes to musicGain

        osc.start(time);
        osc.stop(time + 0.15);

        // Bass Note on downbeats
        if (beatNumber % 4 === 0 || (this.isBossWave && beatNumber % 2 === 0)) {
            const bassOsc = this.ctx.createOscillator();
            const bassEnv = this.ctx.createGain();
            bassOsc.type = 'triangle';
            bassOsc.frequency.setValueAtTime(freq * 0.25, time); // 2 octaves down

            bassEnv.gain.setValueAtTime(0, time);
            bassEnv.gain.linearRampToValueAtTime(0.4, time + 0.05);
            bassEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

            bassOsc.connect(bassEnv);
            bassEnv.connect(this.synthFilter);

            bassOsc.start(time);
            bassOsc.stop(time + 0.3);
        }
    }

    scheduler() {
        if (!this.initialized) return;

        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    // --- Procedural Percussion ---
    playKick(time) {
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        env.gain.setValueAtTime(1.0, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(env);
        env.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time) {
        // Noise buffer for snare
        const bufferSize = this.ctx.sampleRate * 0.2; // 200ms
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

        const noiseEnv = this.ctx.createGain();
        noiseEnv.gain.setValueAtTime(0.8, time);
        noiseEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        noiseEnv.connect(this.musicGain);

        // Tone for snare body
        const osc = this.ctx.createOscillator();
        const oscEnv = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time);
        oscEnv.gain.setValueAtTime(0.5, time);
        oscEnv.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.connect(oscEnv);
        oscEnv.connect(this.musicGain);

        osc.start(time);
        osc.stop(time + 0.2);
        noise.start(time);
        noise.stop(time + 0.2);
    }

    playHiHat(time, vol) {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 10000;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(vol, time);
        env.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        noise.connect(bandpass);
        bandpass.connect(env);
        env.connect(this.musicGain);

        noise.start(time);
        noise.stop(time + 0.05);
    }

    // --- SFX (10+) ---

    playTone(freq, type, duration, vol = 0.1, ramp = 'exp') {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        if (ramp === 'exp') {
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        } else {
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        }
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // 1. Shoot
    playShoot() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    // 2. Hit
    playHit() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // 3. Explosion
    playExplosion() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        // Add noise
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, this.ctx.currentTime);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.4);
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
        noise.start();
        noise.stop(this.ctx.currentTime + 0.4);
    }

    // 4. Dash
    playDash() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    // 5. Upgrade
    playUpgrade() {
        if (!this.initialized) return;
        const time = this.ctx.currentTime;
        [440, 554.37, 659.25, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, time + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.1, time + i * 0.1 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, time + i * 0.1 + 0.4);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(time + i * 0.1);
            osc.stop(time + i * 0.1 + 0.4);
        });
    }

    // 6. Pickup
    playPickup() {
        if (!this.initialized) return;
        const time = this.ctx.currentTime;
        [880, 1108.73].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.05, time + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, time + i * 0.1 + 0.2);
            osc.connect(gain);
            gain.connect(this.sfxGain);
            osc.start(time + i * 0.1);
            osc.stop(time + i * 0.1 + 0.2);
        });
    }

    // 7. Enemy Spawn
    playEnemySpawn() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // 8. Boss Spawn
    playBossSpawn() {
        if (!this.initialized) return;
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, time);
        osc.frequency.linearRampToValueAtTime(50, time + 2);
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.3, time + 0.5);
        gain.gain.linearRampToValueAtTime(0, time + 2);

        // Tremolo effect
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 10;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.5;
        lfo.connect(lfoGain);
        lfoGain.connect(gain.gain);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start(time);
        lfo.start(time);
        osc.stop(time + 2);
        lfo.stop(time + 2);
    }

    // 9. UI Hover
    playUIHover() {
        this.playTone(800, 'sine', 0.05, 0.05, 'linear');
    }

    // 10. UI Click
    playUIClick() {
        this.playTone(1200, 'triangle', 0.1, 0.1);
    }

    // 11. Player Death
    playPlayerDeath() {
        if (!this.initialized) return;
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, time);
        osc.frequency.exponentialRampToValueAtTime(20, time + 1.5);
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 1.5);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(time + 1.5);
    }

    // 12. Boss Hit
    playBossHit() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    // 13. Boss Shoot
    playBossShoot() {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}
