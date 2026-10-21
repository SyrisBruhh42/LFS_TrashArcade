class SoundEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.isPlayingMusic = false;

        // Music state
        this.tempo = 120;
        this.nextNoteTime = 0;
        this.currentStep = 0;
        this.isBossWave = false;
        this.isLowHp = false;

        const initAudio = () => {
            if(!this.ctx){
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.5;

                this.musicGain = this.ctx.createGain();
                this.musicGain.gain.value = 0.4;

                this.sfxGain = this.ctx.createGain();
                this.sfxGain.gain.value = 0.8;

                this.musicGain.connect(this.masterGain);
                this.sfxGain.connect(this.masterGain);
                this.masterGain.connect(this.ctx.destination);
                this.updateVolumes();
            }
            if(this.ctx.state === 'suspended') this.ctx.resume();

            window.removeEventListener('pointerdown', initAudio);
            window.removeEventListener('keydown', initAudio);
        };
        window.addEventListener('pointerdown', initAudio);
        window.addEventListener('keydown', initAudio);
    }


    updateVolumes() {
        if(!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
        let d = window.game && window.game.saveManager ? window.game.saveManager.data : {};
        let opts = d.options || {};
        let mute = opts.mute || false;
        let mVol = opts.musicVol !== undefined ? opts.musicVol : 1.0;
        let sVol = opts.sfxVol !== undefined ? opts.sfxVol : 1.0;

        if(mute) {
            this.masterGain.gain.value = 0;
        } else {
            this.masterGain.gain.value = 0.5;
            this.musicGain.gain.value = 0.4 * mVol;
            this.sfxGain.gain.value = 0.8 * sVol;
        }
    }

    update(dt, playerHpPercent, isBossWave) {
        if(!this.ctx || !this.isPlayingMusic) return;

        this.isBossWave = isBossWave;
        this.isLowHp = playerHpPercent < 0.3;

        let targetTempo = 110;
        if(this.isBossWave) targetTempo = 140;
        if(this.isLowHp) targetTempo += 20;

        this.tempo += (targetTempo - this.tempo) * dt * 2;

        const lookahead = 0.1;
        while(this.nextNoteTime < this.ctx.currentTime + lookahead) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextNoteTime += (60.0 / this.tempo) / 4; // 16th notes
            this.currentStep = (this.currentStep + 1) % 16;
        }
    }

    startMusic() {
        if(!this.ctx) return;
        this.isPlayingMusic = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
        this.currentStep = 0;
    }

    stopMusic() {
        this.isPlayingMusic = false;
    }

    scheduleNote(step, time) {
        // Kick on 0, 4, 8, 12
        if(step % 4 === 0) {
            this.playKick(time);
        }

        // Snare on 4, 12
        if(step === 4 || step === 12) {
            this.playSnare(time);
        }

        // Hihat on odd steps
        if(step % 2 !== 0) {
            this.playHihat(time);
        }

        // Bassline
        const bassNotes = [36, 36, 39, 36, 43, 41, 39, 36];
        const bossNotes = [36, 37, 38, 39, 36, 37, 38, 39];
        const noteToFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);

        if(step % 2 === 0) {
            let note = this.isBossWave ? bossNotes[(step/2)%8] : bassNotes[(step/2)%8];
            if(this.isLowHp) note += 12; // Octave up
            this.playBass(noteToFreq(note), time);
        }

        // Arp
        if(step % 1 === 0) {
            const arpNotes = [60, 63, 67, 72, 67, 63, 60, 55];
            const bossArp = [60, 61, 62, 63, 66, 65, 64, 63];
            let note = this.isBossWave ? bossArp[step%8] : arpNotes[step%8];
            if(this.isLowHp) note += 2;
            this.playArp(noteToFreq(note), time);
        }
    }

    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    playSnare(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, time);

        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    playHihat(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;

        osc.type = 'square';
        osc.frequency.setValueAtTime(2000, time);

        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.05);
    }

    playBass(freq, time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.isLowHp ? 1000 : 400, time);
        filter.frequency.exponentialRampToValueAtTime(100, time + 0.2);

        gain.gain.setValueAtTime(0.6, time);
        gain.gain.linearRampToValueAtTime(0, time + 0.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.2);
    }

    playArp(freq, time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = this.isBossWave ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.2, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(time);
        osc.stop(time + 0.1);
    }

    // SFX methods
    playSynth(freq, type, duration) { // Fallback/Basic
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playShootSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playHitSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playDetonateSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playDashSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.2);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playTetherAttachSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playScrapPickupSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.setValueAtTime(1600, this.ctx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playUpgradeSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playEnemySpawnSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    playBossSpawnSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, this.ctx.currentTime + 1.0);
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 1.0);
    }

    playPlayerHitSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 0.3);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playWarningSFX() {
        if(!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
}
