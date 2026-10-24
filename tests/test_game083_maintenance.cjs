'use strict';
// Exercise production classes and the real frame order; browser/device checks
// remain separate from these deterministic event and persistence regressions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const SAVE_KEY = 'arcade_game_083_083-haunted-tether-drill_v1';
const source = fs.readFileSync(process.env.GAME083_SOURCE || path.join(__dirname, '..',
    'games', '083-haunted-tether-drill', 'game.js'), 'utf8');

function target(extra = {}) {
    const listeners = new Map();
    return { ...extra,
        addEventListener(type, callback) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(callback);
        },
        emit(type, event = {}) {
            for (const callback of listeners.get(type) || []) callback({ preventDefault() {}, ...event });
        }
    };
}

function harness(initialSave) {
    let time = 0;
    const stored = new Map(initialSave === undefined ? [] : [[SAVE_KEY, JSON.stringify(initialSave)]]);
    const prompts = [];
    const alerts = [];
    const drawing = new Proxy({}, {
        get(object, key) {
            if (key in object) return object[key];
            if (key === 'measureText') return text => ({ width: text.length * 10 });
            if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
            return () => {};
        }
    });
    const canvas = target({ width: 800, height: 600, style: {},
        getContext: () => drawing,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) });
    const document = target({ hidden: false, getElementById: id => id === 'gameCanvas' ? canvas : null });
    const window = target({ innerWidth: 800, innerHeight: 600, location: { reload() {} } });
    const storage = { getItem: key => stored.get(key) || null,
        setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
    const context = vm.createContext({ window, document, localStorage: storage,
        navigator: { maxTouchPoints: 1 }, performance: { now: () => time },
        requestAnimationFrame() {}, ResizeObserver: class { observe() {} }, setTimeout() {},
        console: { log() {}, error() {}, warn() {} },
        atob: value => atob(value), btoa: value => btoa(value),
        prompt: () => prompts.shift(), alert: message => alerts.push(message) });
    vm.runInContext(source, context, { filename: '083/game.js' });
    const game = vm.runInContext('window.game = new Game()', context);
    return { game, window, document, canvas, stored, prompts, alerts, storage,
        tick() { time += 16; game.loop(time); },
        evaluate: code => vm.runInContext(code, context),
        press(code) { window.emit('keydown', { code }); this.tick(); window.emit('keyup', { code }); this.tick(); }
    };
}
const point = (x, y, identifier = 1) => ({ clientX: x, clientY: y, identifier });
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8,
    `${message}: expected ${expected}, received ${actual}`);

function playing(hand = 'Right') {
    const h = harness();
    h.game.initGame();
    h.game.hazards = [];
    h.game.resources = [];
    h.game.enemies = [];
    h.game.saveManager.data.options.touchControls = 'Always';
    h.game.saveManager.data.options.touchHandedness = hand;
    return h;
}

for (const hand of ['Right', 'Left']) {
    test(`083 ${hand} layout D-pad moves in each chosen direction without steering toward the pad`, () => {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1], [1, 1], [-1, -1]]) {
            const h = playing(hand);
            const player = h.game.player;
            const start = { x: player.x, y: player.y };
            const padX = hand === 'Right' ? 100 : 700;
            h.canvas.emit('touchstart', { touches: [point(padX + dx * 50, 500 + dy * 50)] });
            h.tick();
            const distance = player.speed * 0.016 / Math.hypot(dx, dy);
            near(player.x - start.x, dx * distance, 'D-pad horizontal displacement');
            near(player.y - start.y, dy * distance, 'D-pad vertical displacement');
            assert.equal(player.dashCooldown, 0, 'D-pad does not consume the separate dash action');
        }
    });

    test(`083 ${hand} virtual Dash follows the last heading and stops when released`, () => {
        const h = playing(hand);
        const player = h.game.player;
        h.press('KeyW'); // Establish a real movement heading before changing input devices.
        const start = { x: player.x, y: player.y };
        const dashX = hand === 'Right' ? 700 : 100;
        h.canvas.emit('touchstart', { touches: [point(dashX, 500)] });
        h.tick();
        assert.ok(player.dashActiveTimer > 0, 'the virtual button activates dash');
        near(player.x, start.x, 'dash never steers sideways toward its button');
        near(player.y - start.y, -player.speed * 3 * 0.016, 'dash follows the previous upward heading');
        h.tick();
        near(player.x, start.x, 'held dash keeps its heading');
        near(player.y - start.y, -player.speed * 3 * 0.032, 'held dash continues along that heading');
        h.window.emit('touchend', { touches: [] });
        const released = { x: player.x, y: player.y };
        h.tick();
        near(player.x, released.x, 'released dash stops horizontally');
        near(player.y, released.y, 'released dash stops vertically');
    });
}

test('083 physical movement keeps its direction during virtual Dash or a world touch', () => {
    for (const touch of [point(700, 500), point(700, 300)]) {
        const h = playing();
        const player = h.game.player;
        const start = { x: player.x, y: player.y };
        h.window.emit('keydown', { code: 'KeyW' });
        h.canvas.emit('touchstart', { touches: [touch] });
        h.tick();
        near(player.x, start.x, 'physical movement does not turn toward the finger');
        near(player.y - start.y, -player.speed * 3 * 0.016, 'physical direction governs dash');
    }
});

test('083 direct touch and mouse steering outside virtual controls still move toward the pointer', () => {
    for (const type of ['touchstart', 'mousedown']) {
        const h = playing();
        const player = h.game.player;
        const start = { x: player.x, y: player.y };
        const position = point(start.x + 100, start.y - 100);
        h.canvas.emit(type, type === 'touchstart' ? { touches: [position] } : position);
        h.tick();
        const distance = player.speed * 3 * 0.016 / Math.sqrt(2);
        near(player.x - start.x, distance, 'direct pointer horizontal movement');
        near(player.y - start.y, -distance, 'direct pointer vertical movement');
        assert.ok(player.dashActiveTimer > 0, 'direct click or tap still activates dash');
    }
});

for (const state of ['TITLE', 'PAUSED']) {
    test(`083 real frame opens options from ${state} and consumes navigation once`, () => {
        const h = harness();
        if (state === 'PAUSED') h.game.initGame();
        h.game.state = state;
        h.press('KeyO');
        assert.equal(h.game.state, 'OPTIONS');
        assert.equal(h.game.previousState, state);
        h.window.emit('keydown', { code: 'ArrowDown' });
        h.tick();
        assert.equal(h.game.uiManager.optionsMenu.selectedIdx, 1);
        h.tick();
        assert.equal(h.game.uiManager.optionsMenu.selectedIdx, 1, 'a held key must not repeat every frame');
        h.window.emit('keyup', { code: 'ArrowDown' });
        h.tick();
        h.press('ArrowDown');
        assert.equal(h.game.uiManager.optionsMenu.selectedIdx, 2);
        h.game.uiManager.optionsMenu.selectedIdx = 12; // existing Back action
        h.press('Enter');
        assert.equal(h.game.state, state);
    });
}

for (const end of ['touchend', 'touchcancel', 'blur', 'visibilitychange']) {
    test(`083 ${end} clears touch movement and dash without leaving player motion`, () => {
        for (const [x, y, code] of [[150, 500, 'ArrowRight'], [700, 500, 'Space']]) {
            const h = harness();
            h.game.initGame();
            h.game.hazards = [];
            h.game.saveManager.data.options.touchControls = 'Always';
            h.press('KeyW'); // Give virtual Dash a real heading before testing its release.
            h.canvas.emit('touchstart', { touches: [point(x, y)] });
            h.tick();
            assert.equal(h.game.inputManager.isDown(code), true, 'the touch control activates');
            if (end === 'visibilitychange') {
                h.document.hidden = true;
                h.document.emit(end);
            } else h.window.emit(end, { touches: [] });
            h.tick();
            assert.equal(h.game.inputManager.touch.active, false);
            assert.equal(h.game.inputManager.mouse.down, false);
            assert.equal(h.game.inputManager.isDown(code), false, 'released touch control cannot latch');
            // Run the actual player input consumer, including after a blur pause.
            h.game.player.update(0.016, h.game.inputManager, 800, 600);
            assert.equal(h.game.player.vx, 0);
            assert.equal(h.game.player.vy, 0);
            if (end === 'blur' || end === 'visibilitychange') assert.equal(h.game.state, 'PAUSED');
        }
    });
}

test('083 hit-stop cannot swallow the options shortcut after pausing', () => {
    const h = harness();
    h.game.initGame();
    h.game.state = 'PAUSED';
    h.game.vfxManager.hitStopTimer = 0.5;
    h.press('KeyO');
    assert.equal(h.game.state, 'OPTIONS');
});

test('083 touch release and disabling touch controls preserve a held physical key', () => {
    const h = harness();
    h.game.initGame();
    h.game.hazards = [];
    h.game.saveManager.data.options.touchControls = 'Always';
    h.window.emit('keydown', { code: 'ArrowRight' });
    h.canvas.emit('touchstart', { touches: [point(50, 500)] });
    h.tick();
    assert.equal(h.game.inputManager.isDown('ArrowLeft'), true);
    h.game.saveManager.data.options.touchControls = 'Off';
    h.tick();
    assert.equal(h.game.inputManager.isDown('ArrowLeft'), false);
    h.window.emit('touchend', { touches: [] });
    h.tick();
    assert.equal(h.game.inputManager.isDown('ArrowRight'), true);
    assert.ok(h.game.player.vx > 0);
    h.window.emit('keyup', { code: 'ArrowRight' });
    h.tick();
    assert.equal(h.game.player.vx, 0);
});

test('083 blur releases physical keys even when their keyup occurs outside the page', () => {
    const h = harness();
    h.window.emit('keydown', { code: 'KeyW' });
    h.window.emit('blur');
    assert.equal(h.game.inputManager.isDown('KeyW'), false);
});

test('083 held-key repeat after blur cannot resume or reactivate movement; fresh keys still work', () => {
    const h = harness();
    h.game.initGame();
    h.game.hazards = [];
    for (const code of ['KeyD', 'Space']) h.window.emit('keydown', { code, repeat: false });
    h.tick();
    assert.ok(h.game.player.vx > 0, 'initial keydown starts normal held movement');
    h.window.emit('blur');
    for (const code of ['KeyD', 'Space']) h.window.emit('keydown', { code, repeat: true });
    h.tick();
    assert.equal(h.game.state, 'PAUSED');
    for (const code of ['KeyD', 'Space']) assert.equal(h.game.inputManager.isDown(code), false);
    for (const code of ['KeyD', 'Space']) h.window.emit('keyup', { code });
    h.press('Space');
    assert.equal(h.game.state, 'PLAYING');
    h.window.emit('keydown', { code: 'KeyD', repeat: false });
    h.tick();
    assert.ok(h.game.player.vx > 0, 'a fresh keydown remains usable after resume');
    h.window.emit('keyup', { code: 'KeyD' });
    h.tick();
    assert.equal(h.game.player.vx, 0);
});

test('083 malformed imports leave the prior in-memory and persisted save intact', () => {
    const invalid = [null, [], 42, {}, { highScore: -1 }, { highScore: '9000' },
        { options: null }, { options: [] }, { options: { mute: 'yes' } },
        { options: { musicVolume: 200 } }, { options: { touchControls: 'Broken' } },
        { unlockedMilestones: {} }, { unlockedMilestones: [7] }];
    const h = harness();
    const save = h.game.saveManager;
    save.data.highScore = 1234;
    save.data.options.mute = true;
    h.game.uiManager.update(0);
    save.save();
    const previous = plain(save.data);
    const persisted = h.stored.get(SAVE_KEY);
    const action = h.game.uiManager.optionsMenu.items.find(item => item.action === 'import');
    for (const encoded of [...invalid.map(value => btoa(JSON.stringify(value))), 'not valid base64!']) {
        h.prompts.push(encoded);
        h.game.uiManager.activateOption(action, save.data.options);
        assert.equal(h.alerts.at(-1), 'Invalid save data.');
        assert.deepEqual(plain(save.data), previous);
        assert.equal(h.stored.get(SAVE_KEY), persisted);
        h.game.uiManager.update(0);
        h.tick(); // The actual UI draw and game frame must remain usable.
    }
});

test('083 legacy partial and full exports retain statistics and merge option defaults safely', () => {
    const h = harness({ highScore: 12, options: { mute: true } });
    assert.equal(h.game.saveManager.data.options.sfxVolume, 100);
    assert.equal(h.game.saveManager.data.options.mute, true);
    const action = h.game.uiManager.optionsMenu.items.find(item => item.action === 'import');
    h.prompts.push(btoa(JSON.stringify({ highScore: 50, options: { musicVolume: 30 } })));
    h.game.uiManager.activateOption(action, h.game.saveManager.data.options);
    assert.equal(h.alerts.at(-1), 'Save imported successfully!');
    assert.equal(h.game.saveManager.data.highScore, 50);
    assert.equal(h.game.saveManager.data.options.musicVolume, 30);
    assert.equal(h.game.saveManager.data.options.sfxVolume, 100);
    const full = plain(h.game.saveManager.data);
    h.prompts.push(btoa(JSON.stringify(full)));
    h.game.uiManager.activateOption(action, h.game.saveManager.data.options);
    assert.deepEqual(plain(h.evaluate('new SaveManager().data')), full);
});

test('083 storage failure rejects import without replacing the working save or announcing success', () => {
    const h = harness();
    const save = h.game.saveManager;
    save.data.highScore = 1234;
    save.data.options.mute = true;
    save.save();
    const previous = plain(save.data);
    const persisted = h.stored.get(SAVE_KEY);
    h.storage.setItem = () => { throw new Error('storage quota exhausted'); };
    h.prompts.push(btoa(JSON.stringify({ highScore: 99 })));
    const action = h.game.uiManager.optionsMenu.items.find(item => item.action === 'import');
    h.game.uiManager.activateOption(action, save.data.options);
    assert.equal(h.alerts.at(-1), 'Save storage is unavailable. Your previous save was kept.');
    assert.deepEqual(plain(save.data), previous);
    assert.equal(h.stored.get(SAVE_KEY), persisted);
});

test('083 every production milestone ID survives a save export/import round trip', () => {
    const h = harness();
    const save = h.game.saveManager;
    Object.assign(save.data, { totalGamesPlayed: 1, bestRunScore: 5000, bestCombo: 10,
        highestWave: 5, maxTailReached: 50, bossesDefeated: 1 });
    h.game.uiManager.checkMilestones();
    const earned = plain(save.data.unlockedMilestones);
    assert.deepEqual(earned, ['first_dig', 'score_master', 'combo_king', 'deep_diver', 'tail_growth', 'boss_slayer']);
    h.prompts.push(btoa(JSON.stringify(save.data)));
    const action = h.game.uiManager.optionsMenu.items.find(item => item.action === 'import');
    h.game.uiManager.activateOption(action, save.data.options);
    assert.equal(h.alerts.at(-1), 'Save imported successfully!');
    assert.deepEqual(plain(h.evaluate('new SaveManager().data.unlockedMilestones')), earned);
});

test('083 corrupt stored shapes fall back to usable defaults without rewriting recovery data', () => {
    for (const corrupted of [null, [], { options: null }, { unlockedMilestones: 'bad' }]) {
        const h = harness(corrupted);
        assert.equal(h.game.saveManager.data.highScore, 0);
        assert.equal(h.game.saveManager.data.options.musicVolume, 100);
        assert.equal(h.stored.get(SAVE_KEY), JSON.stringify(corrupted));
        h.tick();
    }
});
