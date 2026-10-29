class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.initialized = false;

        // Phase 8 variables
        this.currentBgmNode = null;
        this.bgmPlaying = false;
        this.loopInterval = null;
        this.tempo = 90; // Cafe jazz / Sunset Boulevard tempo
        this.beat = 0;
        this.highCombo = false;
        this.milestoneMode = false;
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
        this.initialized = true;
    }
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    setVolumes(master, sfx, music) {
        if (!this.initialized) return;
        this.masterGain.gain.value = master;
        this.sfxGain.gain.value = sfx;
        this.musicGain.gain.value = music;
    }

    // Play an oscillator tone
    playTone(freq, type, duration, vol = 0.5, slideFreq = null) {
        if (!this.initialized || !this.ctx) return;
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

    // 5+ SFX Synthesizer
    playBlip() { this.playTone(800, 'sine', 0.05, 0.2); }
    playConfirm() { this.playTone(1200, 'square', 0.1, 0.2); }
    playError() { this.playTone(300, 'sawtooth', 0.2, 0.3); }
    playStatUp() {
        this.playTone(600, 'triangle', 0.15, 0.3);
        setTimeout(() => this.playTone(800, 'triangle', 0.2, 0.3), 100);
    }
    playRomance() {
        // A romantic twinkling sound for dating events
        this.playTone(880, 'sine', 0.3, 0.2, 1760);
        setTimeout(() => this.playTone(1108, 'sine', 0.3, 0.2, 2217), 100);
        setTimeout(() => this.playTone(1318, 'sine', 0.4, 0.2, 2637), 200);
    }
    playWork() {
        // Rhythmic clicking/clacking for work/study
        this.playTone(400, 'square', 0.05, 0.1);
        setTimeout(() => this.playTone(500, 'square', 0.05, 0.1), 80);
        setTimeout(() => this.playTone(600, 'square', 0.05, 0.1), 160);
    }
    playItemUnlock() {
        // Fancy item unlock
        this.playTone(600, 'square', 0.1, 0.2);
        setTimeout(() => this.playTone(900, 'square', 0.1, 0.2), 100);
        setTimeout(() => this.playTone(1200, 'triangle', 0.3, 0.2), 200);
    }

    // Adaptive BGM loop
    startAdaptiveBgm() {
        if (!this.initialized || this.bgmPlaying) return;
        this.bgmPlaying = true;
        this.beat = 0;

        // Procedural loop scheduling
        const loopMs = (60 / this.tempo) * 1000;

        this.loopInterval = setInterval(() => {
            this.playBgmBeat();
            this.beat = (this.beat + 1) % 16; // 16-step sequencer
        }, loopMs / 4); // 16th notes
    }

    stopAdaptiveBgm() {
        if (this.loopInterval) clearInterval(this.loopInterval);
        this.bgmPlaying = false;
    }

    setHighCombo(val) { this.highCombo = val; }
    setMilestoneMode(val) { this.milestoneMode = val; }

    playBgmBeat() {
        if (!this.initialized || !this.ctx) return;
        const t = this.ctx.currentTime;

        // Basic beat - Cafe Jazz / Sunset Boulevard chill beat
        if (this.beat % 4 === 0) {
            // Kick drum
            const kick = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();
            kick.frequency.setValueAtTime(150, t);
            kick.frequency.exponentialRampToValueAtTime(0.01, t + 0.1);
            kickGain.gain.setValueAtTime(0.3, t);
            kickGain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            kick.connect(kickGain);
            kickGain.connect(this.musicGain);
            kick.start(t);
            kick.stop(t + 0.1);
        }

        if (this.beat % 8 === 4) {
            // Snare (noise burst simulation with high frequency synth)
            const snare = this.ctx.createOscillator();
            const snareGain = this.ctx.createGain();
            snare.type = 'square';
            snare.frequency.setValueAtTime(250, t);
            snareGain.gain.setValueAtTime(0.15, t);
            snareGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            snare.connect(snareGain);
            snareGain.connect(this.musicGain);
            snare.start(t);
            snare.stop(t + 0.15);
        }

        if (this.beat % 2 === 0) {
            // Hi-hat
            const hat = this.ctx.createOscillator();
            const hatGain = this.ctx.createGain();
            hat.type = 'sawtooth';
            hat.frequency.setValueAtTime(8000, t);
            hatGain.gain.setValueAtTime(0.05, t);
            hatGain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
            hat.connect(hatGain);
            hatGain.connect(this.musicGain);
            hat.start(t);
            hat.stop(t + 0.05);
        }

        // Bassline
        const bassNotes = [130, 0, 0, 130, 196, 0, 164, 0, 130, 0, 130, 0, 196, 0, 220, 0];
        const bassFreq = bassNotes[this.beat];
        if (bassFreq > 0) {
            const bass = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            bass.type = 'triangle';
            bass.frequency.setValueAtTime(bassFreq / 2, t);
            bassGain.gain.setValueAtTime(0.2, t);
            bassGain.gain.linearRampToValueAtTime(0.01, t + 0.2);
            bass.connect(bassGain);
            bassGain.connect(this.musicGain);
            bass.start(t);
            bass.stop(t + 0.2);
        }

        // Melody - Adapts based on state
        if (this.milestoneMode || this.highCombo) {
            // More active melody during milestones
            const melNotes = [261.63, 0, 329.63, 0, 392.00, 0, 329.63, 261.63, 440.00, 0, 392.00, 0, 329.63, 0, 293.66, 0];
            const melFreq = melNotes[this.beat];
            if (melFreq > 0) {
                const mel = this.ctx.createOscillator();
                const melGain = this.ctx.createGain();
                mel.type = 'sine';
                mel.frequency.setValueAtTime(melFreq, t);
                melGain.gain.setValueAtTime(0.15, t);
                melGain.gain.linearRampToValueAtTime(0.01, t + 0.3);
                mel.connect(melGain);
                melGain.connect(this.musicGain);
                mel.start(t);
                mel.stop(t + 0.3);
            }
        } else if (this.beat % 4 === 0) {
            // Sparse chords normally
            const chords = [
                [261.63, 329.63, 392.00], // C
                [220.00, 261.63, 329.63], // Am
                [174.61, 220.00, 261.63], // F
                [196.00, 246.94, 293.66]  // G
            ];
            const chordIndex = Math.floor((this.beat / 16) * 4) % 4; // actually just 0 here since beat < 16, but we'll use a slow progression
            const measure = Math.floor(Date.now() / 2000) % 4; // hacky measure progression
            const currentChord = chords[measure];

            for (const f of currentChord) {
                const c = this.ctx.createOscillator();
                const cg = this.ctx.createGain();
                c.type = 'sine';
                c.frequency.setValueAtTime(f, t);
                cg.gain.setValueAtTime(0.05, t);
                cg.gain.linearRampToValueAtTime(0.01, t + 0.8);
                c.connect(cg);
                cg.connect(this.musicGain);
                c.start(t);
                c.stop(t + 0.8);
            }
        }
    }
}
