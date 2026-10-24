'use strict';
// Executes production game classes. Browser APIs are bounded stand-ins; native
// browser/device acceptance is deliberately a separate check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function eventTarget(extra = {}) {
    const listeners = new Map();
    return {
        ...extra,
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, []);
            listeners.get(name).push(callback);
        },
        emit(name, values = {}) {
            const event = { type: name, preventDefault() {}, ...values };
            for (const callback of listeners.get(name) || []) callback(event);
        }
    };
}

function harness(slug, files = ['game.js'], initialStorage = {}) {
    const stored = new Map(Object.entries(initialStorage));
    const timers = new Map();
    let nextTimer = 1;
    const audioNodes = [];
    function parameter() {
        return {
            value: 0,
            setValueAtTime(value) { this.value = value; },
            linearRampToValueAtTime(value) { this.value = value; },
            exponentialRampToValueAtTime(value) { this.value = value; },
            setTargetAtTime(value) { this.value = value; }
        };
    }
    function node(kind) {
        const result = {
            kind, connections: [], gain: parameter(), frequency: parameter(),
            connect(target) { this.connections.push(target); },
            start() {}, stop() {}
        };
        audioNodes.push(result);
        return result;
    }
    class AudioContext {
        constructor() {
            this.currentTime = 0;
            this.sampleRate = 8000;
            this.state = 'running';
            this.destination = node('destination');
        }
        createGain() { return node('gain'); }
        createOscillator() { return node('oscillator'); }
        createBiquadFilter() { return node('filter'); }
        createBufferSource() { return node('buffer'); }
        createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
        resume() { this.state = 'running'; }
    }
    const drawing = new Proxy({}, { get: (target, key) => target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) elements.set(id, eventTarget({
            width: 800, height: 600, clientWidth: 800, clientHeight: 600,
            parentElement: { clientWidth: 800, clientHeight: 600 },
            style: {}, classList: { add() {}, remove() {} }, value: '', checked: false,
            getContext: () => drawing,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
        }));
        return elements.get(id);
    }
    let reloads = 0;
    const window = eventTarget({ innerWidth: 800, innerHeight: 600, AudioContext, location: { reload: () => reloads++ } });
    const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
    const context = vm.createContext({
        window, localStorage: storage, navigator: { maxTouchPoints: 1 },
        document: eventTarget({ getElementById: element, querySelectorAll: () => [], body: element('body') }),
        performance: { now: () => 0 }, requestAnimationFrame() {},
        ResizeObserver: class { observe() {} },
        setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); },
        console: { log() {}, warn() {}, error() {} }
    });
    for (const file of files) {
        const filename = path.join(__dirname, '..', 'games', slug, file);
        vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
    return {
        context, window, stored, storage, timers, audioNodes, element,
        get reloads() { return reloads; },
        evaluate: expression => vm.runInContext(expression, context),
        tickTimer() {
            const [id, callback] = timers.entries().next().value;
            timers.delete(id);
            callback();
        }
    };
}
const frozenFiles = ['world.js', 'progression.js', 'vfx.js', 'audio.js', 'ui.js', 'game.js'];
function frozen() {
    const h = harness('080-frozen-tether', frozenFiles);
    h.game = h.evaluate('new Game(document.getElementById("gameCanvas"))');
    return h;
}
function touch(canvas, type, points = []) {
    canvas.emit(type, { touches: points.map(([clientX, clientY], identifier) => ({ clientX, clientY, identifier })) });
}
const plain = value => JSON.parse(JSON.stringify(value));

for (const state of ['TITLE', 'GAME_OVER']) {
    test(`080 ${state}: held activation touch starts once and cannot become a player action`, () => {
        const h = frozen();
        const game = h.game;
        const canvas = h.element('gameCanvas');
        game.state = state;
        touch(canvas, 'touchstart', [[700, 500]]); // jump zone
        game.update(1 / 60);
        assert.equal(game.state, 'PLAYING');
        assert.equal(game.saveManager.data.totalGamesPlayed, 1);
        for (const point of [[50, 500], [180, 500], [700, 500], [580, 500], [400, 150]]) {
            touch(canvas, 'touchmove', [point]);
            game.update(1 / 60);
            for (const action of ['left', 'right', 'jump', 'grapple']) assert.equal(game.uiManager.isActionDown(action), false);
        }
        // Lifting one of two fingers must not re-enable a consumed gesture.
        touch(canvas, 'touchstart', [[700, 500], [50, 500]]);
        touch(canvas, 'touchend', [[50, 500]]);
        assert.equal(game.uiManager.isActionDown('left'), false);
        touch(canvas, 'touchend');
        assert.equal(game.input.pointerConsumed, false);
        touch(canvas, 'touchstart', [[50, 500]]);
        assert.equal(game.uiManager.isActionDown('left'), true);
        touch(canvas, 'touchcancel');
        assert.equal(game.uiManager.isActionDown('left'), false);
        assert.equal(game.saveManager.data.totalGamesPlayed, 1);
    });
}

test('080 rapid tap, mouse, and keyboard can start without leaving a pointer action held', () => {
    for (const mode of ['rapid-touch', 'mouse', 'keyboard']) {
        const h = frozen();
        const canvas = h.element('gameCanvas');
        if (mode === 'rapid-touch') {
            touch(canvas, 'touchstart', [[400, 150]]);
            touch(canvas, 'touchend');
        } else if (mode === 'mouse') canvas.emit('mousedown');
        else h.window.emit('keydown', { code: 'Enter' });
        h.game.update(1 / 60);
        assert.equal(h.game.state, 'PLAYING', mode);
        assert.equal(h.game.uiManager.isActionDown('grapple'), false, mode);
    }
});

test('080 confirmed reset persists fresh defaults and reload never rewrites old data', () => {
    const h = frozen();
    const save = h.game.saveManager;
    const defaults = plain(h.evaluate('new SaveManager().data'));
    save.data.highScore = 1234;
    save.data.totalGamesPlayed = 8;
    save.data.options.masterVolume = 0;
    save.data.unlockedMilestones.push('first_jump');
    save.save();
    const button = h.game.uiManager.buttons.find(button => button.id === 'reset');
    h.game.uiManager.handleButtonClick(button);
    assert.equal(h.reloads, 0);
    assert.equal(JSON.parse(h.stored.get(save.saveKey)).highScore, 1234);
    h.game.uiManager.handleButtonClick(button);
    assert.equal(h.reloads, 1);
    assert.deepEqual(plain(save.data), defaults);
    assert.deepEqual(plain(h.evaluate('new SaveManager().data')), defaults);
    save.data.unlockedMilestones.push('new');
    save.reset();
    assert.deepEqual(plain(save.data), defaults, 'default arrays and options must be fresh');
});

test('080 reset retains in-memory defaults if storage is unavailable', () => {
    const h = frozen();
    h.game.saveManager.data.highScore = 1234;
    h.storage.setItem = () => { throw new Error('storage denied'); };
    const button = h.game.uiManager.buttons.find(button => button.id === 'reset');
    h.game.uiManager.handleButtonClick(button);
    h.game.uiManager.handleButtonClick(button);
    assert.equal(h.game.saveManager.data.highScore, 0);
    assert.equal(h.reloads, 1);
});

function dune(initialStorage = {}) {
    const h = harness('082-dune-ammo-scramble', ['vfx.js', 'ui.js', 'game.js'], initialStorage);
    h.game = h.evaluate('new Game()');
    h.window.game = h.game;
    return h;
}

test('082 persisted zero/partial volumes apply at first initialization and older saves retain defaults', () => {
    const key = 'arcade_game_082_082-dune-ammo-scramble_v1';
    const h = dune({ [key]: JSON.stringify({ highScore: 42, options: { sfxVolume: 0, musicVolume: 0.25, mute: true } }) });
    h.game.sound.init();
    assert.equal(h.game.sound.sfxGain.gain.value, 0);
    assert.equal(h.game.sound.musicGain.gain.value, 0.25);
    assert.equal(h.game.sound.masterGain.gain.value, 0);
    assert.equal(h.game.saveManager.data.highScore, 42);
    assert.equal(h.game.saveManager.data.options.touchMode, 'auto');
    const old = dune({ [key]: JSON.stringify({ options: { mute: false } }) });
    old.game.sound.init();
    assert.equal(old.game.sound.sfxGain.gain.value, 1);
    assert.equal(old.game.sound.musicGain.gain.value, 1);
});

test('082 real slider events independently change buses, persist zero, and mute preserves selections', () => {
    const h = dune();
    h.element('sld-sfx').value = '0';
    h.element('sld-sfx').emit('input'); // before first user audio initialization
    h.game.sound.init();
    assert.equal(h.game.sound.sfxGain.gain.value, 0);
    assert.equal(h.game.sound.musicGain.gain.value, 1);
    h.element('sld-music').value = '0.4';
    h.element('sld-music').emit('input');
    assert.equal(h.game.sound.musicGain.gain.value, 0.4);
    assert.equal(h.game.sound.sfxGain.gain.value, 0);
    h.element('chk-mute').checked = true;
    h.element('chk-mute').emit('change');
    assert.equal(h.game.sound.masterGain.gain.value, 0);
    h.element('chk-mute').checked = false;
    h.element('chk-mute').emit('change');
    assert.equal(h.game.sound.masterGain.gain.value, 0.3);
    assert.equal(h.game.sound.sfxGain.gain.value, 0);
    assert.equal(h.game.sound.musicGain.gain.value, 0.4);
    const reloaded = h.evaluate('new SaveManager()');
    assert.equal(reloaded.data.options.sfxVolume, 0);
    assert.equal(reloaded.data.options.musicVolume, 0.4);
});

function routesTo(node, target, visited = new Set()) {
    if (node === target) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    return (node.connections || []).some(next => routesTo(next, target, visited));
}

test('082 every SFX and all three music voices route only through their own volume bus', () => {
    const h = dune();
    const sound = h.game.sound;
    sound.init();
    const effects = ['playShoot', 'playShotgun', 'playSniper', 'playHit', 'playExplosion', 'playPickup', 'playEmpty', 'playDash', 'playUpgrade', 'playUIHover', 'playUIClick', 'playPlayerHit'];
    for (const method of effects) {
        const before = h.audioNodes.length;
        sound[method]();
        const sources = h.audioNodes.slice(before).filter(node => ['oscillator', 'buffer'].includes(node.kind) && routesTo(node, sound.ctx.destination));
        assert(sources.length > 0, method);
        for (const source of sources) {
            assert(routesTo(source, sound.sfxGain), method);
            assert(!routesTo(source, sound.musicGain), method);
        }
    }
    const before = h.audioNodes.length;
    sound.isBossWave = true;
    sound.scheduleNote(0, 0); // arp and kick
    sound.scheduleNote(1, 0.125); // arp and hi-hat
    const sources = h.audioNodes.slice(before).filter(node => ['oscillator', 'buffer'].includes(node.kind));
    assert(sources.length >= 4);
    for (const source of sources) {
        assert(routesTo(source, sound.musicGain));
        assert(!routesTo(source, sound.sfxGain));
    }
});

test('082 background scheduler survives muted startup and later mute/unmute without duplicate loops', () => {
    const h = dune();
    const sound = h.game.sound;
    h.element('chk-mute').checked = true;
    h.element('chk-mute').emit('change');
    sound.init();
    sound.startBgm();
    assert.equal(h.timers.size, 1);
    sound.ctx.currentTime = 1;
    h.tickTimer();
    assert.equal(h.timers.size, 1);
    const before = h.audioNodes.length;
    h.element('chk-mute').checked = false;
    h.element('chk-mute').emit('change');
    sound.ctx.currentTime = 1.2;
    h.tickTimer();
    assert(h.audioNodes.length > before, 'music produces notes after unmuting');
    sound.startBgm();
    assert.equal(h.timers.size, 1);
    sound.stopBgm();
    assert.equal(h.timers.size, 0);
});

for (const intervals of [[1 / 60], [1 / 30], [0.1], [0.007, 0.031, 0.1, 0.016]]) {
    test(`085 repeated shoot/retrieve remains possible at dt=${intervals.join(',')}`, () => {
        const h = harness('085-scrap-heist-retrieval');
        const game = h.evaluate('new Game()');
        game.startGame();
        game.enemies = [];
        game.obstacles = [];
        game.collectibles = [{ x: 50, y: 50, radius: 5 }];
        let frame = 0;
        const tick = () => { game.update(intervals[frame++ % intervals.length]); assert(game.shootCooldown >= 0); };
        for (let shot = 0; shot < 4; shot++) {
            game.input.keys.Space = true;
            tick();
            assert.equal(game.player.hasAmmo, false, `shot ${shot}`);
            assert.equal(game.projectiles.length, 1);
            game.input.keys.Space = false;
            while (game.shootCooldown > 0) tick();
            const projectile = game.projectiles[0];
            projectile.state = 'GROUNDED';
            projectile.x = game.player.x;
            projectile.y = game.player.y;
            tick();
            assert.equal(game.player.hasAmmo, true);
            assert.equal(game.projectiles.length, 0);
        }
    });
}

test('085 next wave and restart reset cooldown with fresh ammunition', () => {
    const h = harness('085-scrap-heist-retrieval');
    const game = h.evaluate('new Game()');
    for (const cooldown of [0.35, -0.016]) {
        for (const action of ['loadWave', 'startGame']) {
            game.shootCooldown = cooldown;
            game[action]();
            assert.equal(game.shootCooldown, 0, action);
            assert.equal(game.player.hasAmmo, true, action);
            game.enemies = [];
            game.obstacles = [];
            game.collectibles = [{ x: 50, y: 50, radius: 5 }];
            game.state = 'PLAYING';
            game.input.keys.Space = true;
            game.update(1 / 60);
            assert.equal(game.projectiles.length, 1, action);
        }
    }
});
