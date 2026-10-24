class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.master.gain.value = 0.4;
        this.initialized = false;

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.5;
        this.musicGain.connect(this.master);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.8;
        this.sfxGain.connect(this.master);

        // Music state
        this.nextNoteTime = 0;
        this.tempo = 120;
        this.beatCount = 0;

        // Music parameters
        this.isBoss = false;
        this.isLowHp = false;

        // Synth Filter
        this.synthFilter = this.ctx.createBiquadFilter();
        this.synthFilter.type = 'lowpass';
        this.synthFilter.connect(this.musicGain);
        this.synthFilter.frequency.value = 1000;

        this.lastEnemyShootTime = 0;
        this.lastErrorTime = 0;
    }

    init() {
        if (this.initialized) return;
        this.ctx.resume();
        this.initialized = true;
        this.nextNoteTime = this.ctx.currentTime + 0.1;
    }

    update(dt, game) {
        if (!this.initialized) return;

        let settings = window.game?.saveManager?.data?.settings;
        if (settings) {
            this.master.gain.value = settings.masterMute ? 0 : 0.4;
            this.musicGain.gain.value = settings.musicVolume;
            this.sfxGain.gain.value = settings.sfxVolume;
        }

        this.isBoss = game.enemies.some(e => e.type === 'boss');
        this.isLowHp = this.isBoss && game.enemies.some(e => e.type === 'boss' && e.hp <= e.maxHp / 2);

        const targetTempo = this.isLowHp ? 180 : (this.isBoss ? 150 : 120);
        this.tempo += (targetTempo - this.tempo) * dt * 2;

        const targetFreq = this.isLowHp ? 4000 : (this.isBoss ? 2000 : 800);
        this.synthFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);

        while (this.nextNoteTime < this.ctx.currentTime + 0.1) {
            this.scheduleNote(this.beatCount, this.nextNoteTime);
            this.nextNoteTime += 60.0 / this.tempo / 2;
            this.beatCount++;
        }
    }

    scheduleNote(beat, time) {
        const arpPattern = [0, 12, 7, 12, 3, 15, 7, 12];
        const baseFreq = this.isBoss ? 110 : 130.81;

        if (beat % 2 === 0 || this.isBoss) {
            const noteIndex = arpPattern[beat % arpPattern.length];
            const freq = baseFreq * Math.pow(2, noteIndex / 12);

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = this.isLowHp ? 'sawtooth' : (this.isBoss ? 'square' : 'triangle');
            osc.frequency.value = freq;

            osc.connect(gain);
            gain.connect(this.synthFilter);

            gain.gain.setValueAtTime(0.1, time);
            gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

            osc.start(time);
            osc.stop(time + 0.2);
        }

        if (beat % 4 === 0) {
            const kickOsc = this.ctx.createOscillator();
            const kickGain = this.ctx.createGain();
            kickOsc.connect(kickGain);
            kickGain.connect(this.musicGain);

            kickOsc.frequency.setValueAtTime(150, time);
            kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
            kickGain.gain.setValueAtTime(0.4, time);
            kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

            kickOsc.start(time);
            kickOsc.stop(time + 0.1);
        }
        if (beat % 4 === 2 || (this.isLowHp && beat % 2 === 1)) {
            const hhOsc = this.ctx.createOscillator();
            const hhGain = this.ctx.createGain();
            hhOsc.type = 'square';
            hhOsc.connect(hhGain);
            const hhFilter = this.ctx.createBiquadFilter();
            hhFilter.type = 'highpass';
            hhFilter.frequency.value = 5000;
            hhGain.connect(hhFilter);
            hhFilter.connect(this.musicGain);

            hhOsc.frequency.setValueAtTime(500, time);
            hhGain.gain.setValueAtTime(0.1, time);
            hhGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

            hhOsc.start(time);
            hhOsc.stop(time + 0.05);
        }
    }

    _playTone(type, freqStart, freqEnd, duration, vol, rampType = 'exp') {
        if (!this.initialized) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
        if (rampType === 'exp') {
            osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
        } else {
            osc.frequency.linearRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + duration);
    }

    playShoot() { this._playTone('square', 400, 100, 0.1, 0.3); }
    playDash() { this._playTone('sawtooth', 200, 400, 0.1, 0.1); }
    playError() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        if (now - this.lastErrorTime < 0.1) return;
        this.lastErrorTime = now;
        this._playTone('triangle', 150, 100, 0.1, 0.2);
    }
    playPickup() { this._playTone('sine', 600, 1200, 0.1, 0.2, 'lin'); }
    playHit() { this._playTone('sawtooth', 100, 50, 0.2, 0.3); }

    playEnemyShoot() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        if (now - this.lastEnemyShootTime < 0.05) return;
        this.lastEnemyShootTime = now;
        this._playTone('square', 300, 150, 0.1, 0.2);
    }

    playBossSpawn() { this._playTone('sawtooth', 50, 20, 1.0, 0.5); }
    playLevelUp() { this._playTone('sine', 400, 800, 0.5, 0.3, 'lin'); }
    playUIButton() { this._playTone('triangle', 800, 1000, 0.05, 0.2); }
    playReload() { this._playTone('square', 200, 300, 0.1, 0.2); }
    playEmptyClip() { this._playTone('triangle', 80, 50, 0.1, 0.3); }
}

// Additional advanced audio features for Phase 8
class AudioEffectManager {
    constructor(soundEngine) {
        this.engine = soundEngine;
        this.activeEffects = [];
        this.masterVolumeModifier = 1.0;
        this.lowPassActive = false;
        this.highPassActive = false;

        // Initialize dynamic EQ and compressor
        if (this.engine.ctx) {
            this.compressor = this.engine.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-24, this.engine.ctx.currentTime);
            this.compressor.knee.setValueAtTime(30, this.engine.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.engine.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.engine.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.engine.ctx.currentTime);

            // Re-route master through compressor
            this.engine.master.disconnect(this.engine.ctx.destination);
            this.engine.master.connect(this.compressor);
            this.compressor.connect(this.engine.ctx.destination);
        }
    }

    update(dt) {
        if (!this.engine.initialized) return;

        // Update temporary effects
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            effect.life -= dt;
            if (effect.life <= 0) {
                this.activeEffects.splice(i, 1);
            }
        }

        // Dynamic mixing based on game state
        if (this.engine.isBoss) {
            this.masterVolumeModifier = Math.min(1.2, this.masterVolumeModifier + dt);
        } else {
            this.masterVolumeModifier = Math.max(1.0, this.masterVolumeModifier - dt);
        }

        // Apply modifier
        if (this.engine.master) {
            const targetVolume = 0.4 * this.masterVolumeModifier;
            // Smooth master volume transitions
            this.engine.master.gain.setTargetAtTime(targetVolume, this.engine.ctx.currentTime, 0.1);
        }
    }

    triggerLowHealthMix(active) {
        this.lowPassActive = active;
        if (active) {
            this.compressor.threshold.setValueAtTime(-30, this.engine.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(20, this.engine.ctx.currentTime);
        } else {
            this.compressor.threshold.setValueAtTime(-24, this.engine.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.engine.ctx.currentTime);
        }
    }

    addReverb(source, amount = 0.5) {
        // Procedural convolution logic stub
        if (!this.engine.ctx) return;
        // In a full implementation this would load an impulse response
        const dummyGain = this.engine.ctx.createGain();
        dummyGain.gain.value = amount;
        source.connect(dummyGain);
        dummyGain.connect(this.engine.master);
    }
}

// Add the manager to SoundEngine prototype/constructor dynamically
const originalInit = SoundEngine.prototype.init;
SoundEngine.prototype.init = function() {
    originalInit.call(this);
    if (!this.fxManager) {
        this.fxManager = new AudioEffectManager(this);
    }
};

const originalUpdate = SoundEngine.prototype.update;
SoundEngine.prototype.update = function(dt, game) {
    originalUpdate.call(this, dt, game);
    if (this.fxManager) {
        this.fxManager.update(dt);
        this.fxManager.triggerLowHealthMix(this.isLowHp);
    }
};
