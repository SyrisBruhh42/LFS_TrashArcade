class SoundEngine {
  constructor() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.musicOsc = null;
    this.musicInterval = null;
    this.isPlayingMusic = false;

    this.options = { mute: false, sfx: 1.0, music: 1.0 };
  }

  resume() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  updateOptions(options) {
    this.options = options;
    this.masterGain.gain.value = options.mute ? 0 : 1;
    this.sfxGain.gain.value = options.sfx;
    this.musicGain.gain.value = options.music;
  }

  playTone(freq, type, duration, vol=1, slideFreq=null) {
    if (this.options.mute || this.options.sfx === 0) return;
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

  playNoise(duration, vol) {
    if (this.options.mute || this.options.sfx === 0) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    noise.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  sfxJump() { this.playTone(300, 'square', 0.2, 0.3, 600); }
  sfxGrappleShoot() { this.playTone(800, 'sine', 0.1, 0.2, 1200); }
  sfxGrappleHit() { this.playNoise(0.1, 0.5); this.playTone(1200, 'square', 0.1, 0.2); }
  sfxGhostRecord() { this.playTone(400, 'triangle', 0.3, 0.4, 800); }
  sfxGhostPlay() { this.playTone(800, 'triangle', 0.3, 0.4, 400); }
  sfxSwitch() { this.playTone(1000, 'square', 0.1, 0.3, 2000); }
  sfxCoin() { this.playTone(1500, 'sine', 0.1, 0.3, 2500); }
  sfxHit() { this.playNoise(0.3, 0.8); this.playTone(150, 'sawtooth', 0.3, 0.5, 50); }
  sfxGameOver() { this.playTone(200, 'sawtooth', 1.0, 0.6, 50); }

  startMusic() {
    if (this.isPlayingMusic) return;
    this.isPlayingMusic = true;
    let noteIdx = 0;
    const notes = [220, 220, 330, 220, 261.63, 220, 196, 220]; // A min arp

    const playNextNote = () => {
      if (!this.isPlayingMusic) return;
      if (!this.options.mute && this.options.music > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = notes[noteIdx] / 2; // Bass
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
      }
      noteIdx = (noteIdx + 1) % notes.length;
      this.musicInterval = setTimeout(playNextNote, 250);
    };
    playNextNote();
  }

  stopMusic() {
    this.isPlayingMusic = false;
    clearTimeout(this.musicInterval);
  }
}
