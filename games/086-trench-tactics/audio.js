class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Procedural music state
        this.sequenceIndex = 0;
        this.nextNoteTime = 0;
        this.beatInterval = 0.25; // 120 BPM, 16th notes
        this.baseScale = [146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 293.66]; // D minor
        this.melody = [0, 2, 4, 2, 0, 4, 6, 4];
        this.bossMelody = [0, 1, 0, 1, 0, 3, 2, 1];
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

        // Ensure volume matches saved settings on init
        const volume = (window.game && window.game.saveManager && window.game.saveManager.data.options) ? window.game.saveManager.data.options.soundVolume : 1;
        this.masterGain.gain.value = volume;
        this.musicGain.gain.value = 0.5; // Music mix

        this.initialized = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
            this.nextNoteTime = this.ctx.currentTime + 0.1;
        }
    }

    update(dt, game) {
        if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;

        // Ensure volume is updated if changed in options
        if (game.saveManager && this.masterGain) {
            this.masterGain.gain.value = game.saveManager.data.options.soundVolume;
        }

        // Schedule notes ahead of time
        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(game);
            this.nextNoteTime += this.beatInterval;
            this.sequenceIndex = (this.sequenceIndex + 1) % 8;
        }
    }

    scheduleNote(game) {
        // Adapt music to game state
        let isBoss = game.bossActive != null;
        let isCombo = (game.upgradeManager && game.upgradeManager.synergyMultiplier > 1);

        let melodyArray = isBoss ? this.bossMelody : this.melody;
        let noteIndex = melodyArray[this.sequenceIndex];
        let freq = this.baseScale[noteIndex % this.baseScale.length];

        if (isCombo) freq *= 2; // Octave higher for high combo

        if (this.sequenceIndex % (isCombo ? 2 : 4) === 0) {
            // Bass/Kick
            this.playSynthNote(freq / 4, 'sine', 0.1, 0.4, this.musicGain, this.nextNoteTime);
        } else {
            // Melody/Arp
            this.playSynthNote(freq, 'triangle', 0.15, 0.2, this.musicGain, this.nextNoteTime);
        }
    }

    playSynthNote(freq, type, duration, vol, outputNode, time = this.ctx.currentTime) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(vol, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

        osc.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration);
    }

    playTone(freq, type, duration, vol) {
        if (!this.initialized || !this.ctx) return;
        this.playSynthNote(freq, type, duration, vol, this.sfxGain, this.ctx.currentTime);
    }

    // 5+ SFX
    playShoot() { this.playTone(300, 'square', 0.1, 0.5); }
    playHit() { this.playTone(150, 'sawtooth', 0.2, 0.8); }
    playMenuMove() { this.playTone(600, 'sine', 0.05, 0.3); }
    playMenuSelect() { this.playTone(800, 'square', 0.1, 0.4); }
    playPowerup() {
        if (!this.initialized || !this.ctx) return;
        const now = this.ctx.currentTime;
        this.playSynthNote(400, 'sine', 0.1, 0.4, this.sfxGain, now);
        this.playSynthNote(600, 'sine', 0.1, 0.4, this.sfxGain, now + 0.1);
        this.playSynthNote(800, 'sine', 0.2, 0.4, this.sfxGain, now + 0.2);
    }
}
