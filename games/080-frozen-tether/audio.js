class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        this.musicSynths = [];
        this.tempo = 120;
        this.isPlayingMusic = false;
        this.musicTimer = 0;
        this.step = 0;

        this.bassSequence = [36, 0, 36, 0, 36, 36, 0, 0, 36, 0, 36, 0, 36, 36, 48, 0];
        this.arpSequence = [60, 63, 67, 60, 63, 67, 72, 67, 60, 63, 67, 60, 63, 67, 72, 75];
        this.hatSequence = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1];

        this.musicFilter = null;
        this.intensity = 0;
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

            this.masterGain.gain.value = 1.0;
            this.sfxGain.gain.value = 1.0;
            this.musicGain.gain.value = 0.5;

            this.initialized = true;
            this.isPlayingMusic = true;
        } catch (e) {
            console.error('Web Audio API not supported', e);
        }
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    update(dt, game) {
        if (!this.initialized || !this.ctx || !this.isPlayingMusic) return;

        // Dynamic music adjustment
        let targetTempo = 120;
        let targetFilterFreq = 1000;

        if (game.bossActive) {
            targetTempo = 160;
            targetFilterFreq = 4000;
        } else if (game.player && game.player.invulnTime > 0) {
            targetFilterFreq = 500;
        }

        // Time dilation affects tempo
        if (game.player && game.player.timeDilationFactor < 1.0) {
            targetTempo *= game.player.timeDilationFactor;
            targetFilterFreq *= game.player.timeDilationFactor;
        }

        this.tempo += (targetTempo - this.tempo) * dt * 2.0;
        this.musicFilter.frequency.value += (targetFilterFreq - this.musicFilter.frequency.value) * dt * 2.0;

        let stepDuration = 60.0 / this.tempo / 4.0; // 16th notes
        this.musicTimer += dt;

        while (this.musicTimer >= stepDuration) {
            this.musicTimer -= stepDuration;
            this.playStep();
            this.step = (this.step + 1) % 16;
        }
    }
    playStep() {
        let time = this.ctx.currentTime;

        // Bass
        if (this.bassSequence[this.step] > 0) {
            this.playMusicNote(this.midiToFreq(this.bassSequence[this.step]), 'sawtooth', 0.1, 0.4);
        }

        // Arp
        if (this.arpSequence[this.step] > 0) {
            this.playMusicNote(this.midiToFreq(this.arpSequence[this.step]), 'square', 0.05, 0.2);
        }

        // Hat
        if (this.hatSequence[this.step] > 0) {
            this.playNoise(0.05, 0.2, 'highpass', 5000);
        }
    }
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    playMusicNote(freq, type, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playNoise(duration, vol, filterType = 'lowpass', filterFreq = 1000) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = buffer;
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noiseSource.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noiseSource.start();
    }
    playTone(freq, type, duration, vol) {
        if (!this.initialized || !this.ctx) return;
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
    playToneGlide(freq1, freq2, type, duration, vol) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq1, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq2, this.ctx.currentTime + duration);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // 10+ SFX methods
    playJump() { this.playToneGlide(300, 600, 'sine', 0.2, 0.4); }
    playGrappleShoot() { this.playToneGlide(800, 1200, 'square', 0.1, 0.2); }
    playGrappleHit() { this.playTone(600, 'triangle', 0.1, 0.3); }
    playDash() { this.playNoise(0.2, 0.4, 'lowpass', 2000); }
    playEnemyHit() { this.playTone(150, 'sawtooth', 0.2, 0.4); }
    playBossHit() { this.playToneGlide(200, 100, 'sawtooth', 0.3, 0.5); }
    playScore() { this.playToneGlide(1000, 1500, 'sine', 0.15, 0.2); }
    playGameOver() { this.playToneGlide(200, 50, 'sawtooth', 1.0, 0.5); }
    playUpgrade() { this.playToneGlide(400, 800, 'sine', 0.4, 0.3); }
    playUI() { this.playTone(600, 'sine', 0.05, 0.2); }
    playSpawn() { this.playToneGlide(50, 200, 'triangle', 0.3, 0.3); }

    playSecretMusic() {
        if (!this.initialized || !this.ctx) return;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        osc1.type = 'triangle';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(440, this.ctx.currentTime);
        osc2.frequency.setValueAtTime(442, this.ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(this.musicGain);
        osc1.start();
        osc2.start();
        osc1.stop(this.ctx.currentTime + 1.0);
        osc2.stop(this.ctx.currentTime + 1.0);
    }

    playComboSound() {
        if (!this.initialized || !this.ctx) return;
        let p = 0;
        const baseFreq = 800;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';

        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(baseFreq * 2, this.ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }
}
