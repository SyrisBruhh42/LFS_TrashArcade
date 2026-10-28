'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createAudioParamMock(initialValue = 0) {
    return {
        value: initialValue,
        setValueAtTime(val) { this.value = val; },
        linearRampToValueAtTime(val) { this.value = val; },
        exponentialRampToValueAtTime(val) { this.value = val; },
        setTargetAtTime(val) { this.value = val; },
        cancelScheduledValues() {}
    };
}

function createAudioContextMock() {
    return class AudioContextMock {
        constructor() {
            this.sampleRate = 8000;
            this.currentTime = 0;
            this.state = 'running';
            this.destination = {};
        }
        resume() {
            this.state = 'running';
            return Promise.resolve();
        }
        suspend() {
            this.state = 'suspended';
            return Promise.resolve();
        }
        close() {
            this.state = 'closed';
            return Promise.resolve();
        }
        createGain() {
            return { gain: createAudioParamMock(1), connect() {}, disconnect() {} };
        }
        createOscillator() {
            return {
                type: 'sine',
                frequency: createAudioParamMock(440),
                detune: createAudioParamMock(0),
                connect() {},
                disconnect() {},
                start() {},
                stop() {}
            };
        }
        createBiquadFilter() {
            return {
                type: 'lowpass',
                frequency: createAudioParamMock(350),
                Q: createAudioParamMock(1),
                gain: createAudioParamMock(0),
                connect() {},
                disconnect() {}
            };
        }
        createConvolver() {
            return { buffer: null, normalize: true, connect() {}, disconnect() {} };
        }
        createDynamicsCompressor() {
            return {
                threshold: createAudioParamMock(-24),
                knee: createAudioParamMock(30),
                ratio: createAudioParamMock(12),
                attack: createAudioParamMock(0.003),
                release: createAudioParamMock(0.25),
                connect() {},
                disconnect() {}
            };
        }
        createStereoPanner() {
            return { pan: createAudioParamMock(0), connect() {}, disconnect() {} };
        }
        createDelay() {
            return { delayTime: createAudioParamMock(0), connect() {}, disconnect() {} };
        }
        createBuffer(channels = 1, length = 1, sampleRate = 8000) {
            const safeLength = Math.max(0, Number(length) || 0);
            return {
                numberOfChannels: channels,
                length: safeLength,
                sampleRate,
                getChannelData() { return new Float32Array(safeLength); }
            };
        }
        createBufferSource() {
            return {
                buffer: null,
                loop: false,
                playbackRate: createAudioParamMock(1),
                detune: createAudioParamMock(0),
                connect() {},
                disconnect() {},
                start() {},
                stop() {}
            };
        }
    };
}

function loadGameScripts(gameDir, context) {
    const resolvedDir = path.resolve(gameDir);
    const indexPath = path.join(resolvedDir, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    const AudioCtor = createAudioContextMock();
    if (context && typeof context === 'object') {
        if (!context.AudioContext) context.AudioContext = AudioCtor;
        if (!context.webkitAudioContext) context.webkitAudioContext = AudioCtor;
        if (context.window && typeof context.window === 'object') {
            if (!context.window.AudioContext) context.window.AudioContext = AudioCtor;
            if (!context.window.webkitAudioContext) context.window.webkitAudioContext = AudioCtor;
        }
    }
    const scriptRegex = /<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
    const loaded = [];
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        const rawSrc = match[1].replace(/^\.\//, '');
        if (!rawSrc.endsWith('.js') || rawSrc.includes('..') || rawSrc.includes('/')) {
            throw new Error(`Invalid local game script reference in ${indexPath}: ${match[1]}`);
        }
        const scriptPath = path.resolve(resolvedDir, rawSrc);
        if (path.dirname(scriptPath) !== resolvedDir || !fs.existsSync(scriptPath)) {
            throw new Error(`Missing local game script in ${resolvedDir}: ${rawSrc}`);
        }
        vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), context, { filename: scriptPath });
        loaded.push(scriptPath);
    }
    return loaded;
}

module.exports = {
    createAudioContextMock,
    loadGameScripts
};
