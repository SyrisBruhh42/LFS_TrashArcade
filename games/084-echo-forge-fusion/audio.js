class ProceduralSynthEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.ready = false;
        this.lastBeat = 0;
        this.bpm = 120;
    }
    init() {
        if (this.ready) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3;
            this.masterGain.connect(this.ctx.destination);
            this.ready = true;
        } catch (e) { console.warn('AudioContext not supported'); }
    }
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    playSynth(freq, type, duration, vol = 1) {
        if (!this.ready || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
    playShoot() { this.playSynth(400, 'square', 0.1, 0.3); }
    playHit() { this.playSynth(150, 'sawtooth', 0.2, 0.4); }
    playBeat() { this.playSynth(100, 'sine', 0.1, 0.5); }
    playEcho() { this.playSynth(600, 'sine', 0.2, 0.2); }
    playBossSpawn() { this.playSynth(100, 'sawtooth', 1.0, 0.6); }
    updateLoop(bpm, bossActive) {
        if (!this.ready || !this.ctx) return;
        this.bpm = bpm;
        let now = this.ctx.currentTime;
        let interval = 60 / this.bpm;
        if (now - this.lastBeat > interval) {
            this.lastBeat = now;
            if (bossActive) {
                this.playSynth(50, 'square', 0.2, 0.5);
            } else {
                this.playSynth(200, 'sine', 0.1, 0.2);
            }
        }
    }
}
