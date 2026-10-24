class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;

        // Synths and Arp
        this.bgmOsc = null;
        this.bgmGain = null;
        this.bassOsc = null;
        this.bassGain = null;
        this.arpOsc = null;
        this.arpGain = null;
        this.filter = null;

        // Timing & Sequencing
        this.isPlaying = false;
        this.tempo = 120;
        this.nextNoteTime = 0;
        this.current16thNote = 0;
        this.scheduleAheadTime = 0.1; // seconds
        this.lookahead = 25.0; // ms
        this.timerID = null;

        // Musical scales (Pentatonic minor)
        this.scale = [220, 261.63, 293.66, 329.63, 392.00, 440, 523.25]; // A minor pentatonic
        this.arpPattern = [0, 2, 4, 6, 4, 2, 4, 2];
        this.bassPattern = [0, 0, 0, 0, 2, 2, 0, 0];

        // Game state parameters
        this.bossMode = false;
        this.lowHp = false;
        this.intensity = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            this.sfxGain = this.ctx.createGain();
            this.sfxGain.connect(this.masterGain);
            this.sfxGain.gain.value = 0.6;

            this.musicGain = this.ctx.createGain();
            this.musicGain.connect(this.masterGain);
            this.musicGain.gain.value = 0.4;

            this.filter = this.ctx.createBiquadFilter();
            this.filter.type = 'lowpass';
            this.filter.frequency.value = 1000;
            this.filter.connect(this.musicGain);

            this.applySettings();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    applySettings() {
        if (!this.ctx) return;
        const set = window.game && window.game.saveManager ? window.game.saveManager.data.settings : {masterMute:false, sfxVolume:1.0, musicVolume:1.0};
        this.masterGain.gain.value = set.masterMute ? 0 : 1;
        this.sfxGain.gain.value = set.sfxVolume * 0.6;
        this.musicGain.gain.value = set.musicVolume * 0.4;
    }

    startMusic() {
        if (this.isPlaying || !this.ctx || !this.enabled) return;
        this.isPlaying = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.current16thNote = 0;
        this.scheduler();
    }

    stopMusic() {
        this.isPlaying = false;
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
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
        // Adjust intensity based on state
        this.intensity = this.bossMode ? 1.0 : (this.lowHp ? 0.8 : 0.3);
        const currentTempo = this.bossMode ? 140 : 120;
        this.tempo = this.tempo + (currentTempo - this.tempo) * 0.1; // Smooth transition

        const filterTarget = 800 + (this.intensity * 2000);
        this.filter.frequency.setTargetAtTime(filterTarget, time, 0.5);

        // Hi-hat (16th notes)
        if (beatNumber % 2 === 0) {
            this.playDrum(time, 0.05, 5000, 'highpass', 0.1);
        }

        // Kick drum (on the beat)
        if (beatNumber % 4 === 0) {
            this.playKick(time);
        }

        // Snare (on off-beats)
        if (beatNumber % 8 === 4) {
            this.playSnare(time);
        }

        // Bass (eighth notes)
        if (beatNumber % 2 === 0) {
            const bassNoteIndex = this.bassPattern[Math.floor(beatNumber / 2)];
            const bassFreq = this.scale[bassNoteIndex] / 4; // 2 octaves down
            this.playSynthNote(time, bassFreq, 'square', 0.2, 0.15, 0.01, 0.1);
        }

        // Arp (sixteenth notes, intensifies)
        if (this.intensity > 0.5) {
            const arpFreq = this.scale[this.arpPattern[beatNumber % 8]];
            this.playSynthNote(time, arpFreq, 'sawtooth', 0.1, 0.05, 0.01, 0.05);
        }

        // Pad (whole notes)
        if (beatNumber === 0) {
            this.playSynthNote(time, this.scale[0]/2, 'sine', 2.0, 0.1, 0.5, 1.0);
            this.playSynthNote(time, this.scale[2]/2, 'sine', 2.0, 0.1, 0.5, 1.0);
            this.playSynthNote(time, this.scale[4]/2, 'sine', 2.0, 0.1, 0.5, 1.0);
        }
    }

    scheduler() {
        if (!this.isPlaying) return;
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.current16thNote, this.nextNoteTime);
            this.nextNote();
        }
        this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
    }

    playSynthNote(time, freq, type, duration, vol, attack=0.01, decay=0.1) {
        if(!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(vol, time + attack);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(this.filter);

        osc.start(time);
        osc.stop(time + duration);
    }

    playKick(time) {
        if(!this.ctx || !this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
        osc.connect(gain);
        gain.connect(this.filter);
        osc.start(time);
        osc.stop(time + 0.5);
    }

    playSnare(time) {
        if(!this.ctx || !this.enabled) return;

        // Noise burst
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

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.filter);

        // Tonal part
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(250, time);
        oscGain.gain.setValueAtTime(0.3, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.connect(oscGain);
        oscGain.connect(this.filter);

        noise.start(time);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    playDrum(time, duration, freq, filterType, vol) {
        if(!this.ctx || !this.enabled) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = freq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.filter);

        noise.start(time);
    }

    playToneSFX(freq, type, duration, vol, modFreq = 0, modDepth = 0) {
        if (!this.ctx || !this.enabled || !this.sfxGain) {
            // fallback if not initialized fully
            if (this.ctx && this.enabled) {
                const t = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(vol, t);
                gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(t);
                osc.stop(t + duration);
            }
            return;
        }

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);

        if (modFreq > 0) {
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.value = modFreq;
            lfoGain.gain.value = modDepth;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(t);
            lfo.stop(t + duration);
        }

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + duration);
    }

    // SFX Repertoire (10+ distinct sounds)
    playTone(freq, type, duration, vol) { this.playToneSFX(freq, type, duration, vol); }
    playPickup() { this.playToneSFX(800, 'sine', 0.2, 0.2); setTimeout(()=>this.playToneSFX(1200, 'sine', 0.3, 0.2), 50); }
    playAlert() { this.playToneSFX(200, 'sawtooth', 0.4, 0.3, 10, 50); }
    playGameOver() { this.playToneSFX(150, 'square', 0.8, 0.4, 5, 20); setTimeout(()=>this.playToneSFX(100, 'square', 1.0, 0.4, 2, 10), 300); }
    playClick() { this.playToneSFX(600, 'sine', 0.05, 0.1); }
    playDash() { this.playToneSFX(300, 'square', 0.15, 0.2, 20, 100); }
    playShoot() { this.playToneSFX(800, 'square', 0.1, 0.15, 0, 0); setTimeout(()=>this.playToneSFX(400, 'sawtooth', 0.1, 0.1), 20); }
    playEnemyHit() { this.playToneSFX(150, 'sawtooth', 0.1, 0.2, 50, 50); }
    playBossSpawn() { this.playToneSFX(100, 'square', 1.5, 0.4, 2, 30); setTimeout(()=>this.playToneSFX(50, 'sawtooth', 1.5, 0.4, 5, 20), 200); }
    playUpgrade() { this.playToneSFX(440, 'sine', 0.3, 0.2); setTimeout(()=>this.playToneSFX(554.37, 'sine', 0.3, 0.2), 100); setTimeout(()=>this.playToneSFX(659.25, 'sine', 0.5, 0.2), 200); }
    playDamage() { this.playToneSFX(200, 'sawtooth', 0.2, 0.3, 30, 100); }
    playHeal() { this.playToneSFX(523.25, 'sine', 0.4, 0.15); setTimeout(()=>this.playToneSFX(659.25, 'sine', 0.4, 0.15), 150); }
}
