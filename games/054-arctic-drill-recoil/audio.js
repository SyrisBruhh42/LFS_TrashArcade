class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.initialized = false;
    this.isPlayingMusic = false;

    // Music state
    this.tempo = 120;
    this.nextNoteTime = 0;
    this.current16thNote = 0;
    this.lookahead = 25.0; // ms
    this.scheduleAheadTime = 0.1; // s
    this.timerID = null;

    // Procedural sequences
    this.arpSequence = [0, 3, 7, 10, 12, 10, 7, 3];
    this.bassSequence = [0, 0, 0, 0, -5, -5, -5, -5];
    this.baseFreq = 55; // A1

    // Filters for dynamic sound
    this.arpFilter = null;
    this.bassFilter = null;

    // Dynamic state
    this.intensity = 0; // 0.0 to 1.0, affects tempo and filter cutoff
  }

  updateVolumes(options) {
    if (!this.initialized) return;
    this.sfxGain.gain.value = options.sfxVolume;
    this.musicGain.gain.value = options.musicVolume;
  }

  init() {
    if (this.initialized) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();

    this.masterGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);

    this.sfxGain.gain.value = 0.6;
    this.musicGain.gain.value = 0.4;

    this.arpFilter = this.ctx.createBiquadFilter();
    this.arpFilter.type = 'lowpass';
    this.arpFilter.frequency.value = 800;
    this.arpFilter.connect(this.musicGain);

    this.bassFilter = this.ctx.createBiquadFilter();
    this.bassFilter.type = 'lowpass';
    this.bassFilter.frequency.value = 400;
    this.bassFilter.connect(this.musicGain);

    this.initialized = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.isPlayingMusic) {
      this.startMusic();
    }
  }

  setIntensity(level) {
    this.intensity = Math.max(0, Math.min(1, level));
    this.tempo = 120 + (this.intensity * 40);

    if (this.arpFilter && this.ctx) {
        const targetFreq = 800 + (this.intensity * 2000);
        if (Math.abs(this.arpFilter.frequency.value - targetFreq) > 10) {
            this.arpFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
        }
    }
  }

  startMusic() {
    if (!this.initialized) return;
    this.isPlayingMusic = true;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.scheduler();
  }

  stopMusic() {
      this.isPlayingMusic = false;
      if (this.timerID) {
          clearTimeout(this.timerID);
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
    if (beatNumber % 4 === 0) {
      this.playKick(time);
    }
    if (beatNumber % 8 === 4) {
      this.playSnare(time);
    }
    if (beatNumber % 2 !== 0 || this.intensity > 0.5) {
      this.playHiHat(time);
    }

    const arpNote = this.arpSequence[beatNumber % this.arpSequence.length];
    this.playSynth(arpNote + 24, time, 0.1, 'sawtooth', this.arpFilter);

    if (beatNumber % 2 === 0) {
        const bassNote = this.bassSequence[(beatNumber / 2) % this.bassSequence.length];
        this.playSynth(bassNote, time, 0.2, 'square', this.bassFilter);
    }
  }

  scheduler() {
    if (!this.isPlayingMusic) return;
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.current16thNote, this.nextNoteTime);
      this.nextNote();
    }
    this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
  }

  noteToFreq(note) {
      return this.baseFreq * Math.pow(2, note / 12);
  }

  playSynth(note, time, duration, type, destination) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = this.noteToFreq(note);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.2, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + duration);
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.5);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.5);
  }

  playSnare(time) {
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
    noiseGain.connect(this.musicGain);

    noise.start(time);
  }

  playHiHat(time) {
      const ratios = [1, 1.3420, 1.2312, 1.6532, 1.9523, 2.1523];
      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = "bandpass";
      bandpass.frequency.value = 10000;

      const highpass = this.ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 7000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

      bandpass.connect(highpass);
      highpass.connect(gain);
      gain.connect(this.musicGain);

      ratios.forEach(ratio => {
          const osc = this.ctx.createOscillator();
          osc.type = "square";
          osc.frequency.value = 400 * ratio;
          osc.connect(bandpass);
          osc.start(time);
          osc.stop(time + 0.05);
      });
  }

  playSFX(type, freqStart, freqEnd, duration, vol=0.5, wave='sine') {
      if (!this.initialized) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
  }

  playDrill() { this.playSFX('drill', 150, 50, 0.1, 0.3, 'sawtooth'); }
  playHit() { this.playSFX('hit', 300, 100, 0.1, 0.5, 'square'); }
  playShoot() { this.playSFX('shoot', 600, 200, 0.15, 0.4, 'square'); }

  playExplosion() {
      if (!this.initialized) return;
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
      noise.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      noise.start();
  }

  playPickup() {
      if (!this.initialized) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  playUpgrade() {
      if (!this.initialized) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc1.type = 'triangle'; osc2.type = 'sine';
      osc1.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc1.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.3);
      osc2.frequency.setValueAtTime(405, this.ctx.currentTime);
      osc2.frequency.linearRampToValueAtTime(805, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
      osc1.connect(gain); osc2.connect(gain); gain.connect(this.sfxGain);
      osc1.start(); osc2.start();
      osc1.stop(this.ctx.currentTime + 0.4); osc2.stop(this.ctx.currentTime + 0.4);
  }

  playOverdriveStart() { this.playSFX('overdrive', 800, 1200, 0.4, 0.6, 'sawtooth'); }
  playBossSpawn() { this.playSFX('bossSpawn', 200, 50, 1.0, 0.8, 'square'); }
  playUIButton() { this.playSFX('btn', 800, 800, 0.05, 0.3, 'sine'); }

  playDamage() {
      if (!this.initialized) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(); osc.stop(this.ctx.currentTime + 0.2);
  }

  playDash() {
      if (!this.initialized) return;
      const bufferSize = this.ctx.sampleRate * 0.2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.05));
      }
      const noise = this.ctx.createBufferSource(); noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter(); filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.2);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
      noise.connect(filter); filter.connect(gain); gain.connect(this.sfxGain);
      noise.start();
  }
}
