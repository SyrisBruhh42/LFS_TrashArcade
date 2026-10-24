'use strict';
// Production classes with bounded browser stand-ins. Native input/layout/audio
// and physical-device acceptance remain separate from these deterministic tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function harness() {
    let now = 0;
    const target = (extra = {}) => {
        const handlers = new Map();
        return {
            ...extra,
            addEventListener(type, fn) {
                if (!handlers.has(type)) handlers.set(type, []);
                handlers.get(type).push(fn);
            },
            emit(type, values = {}) {
                const event = { type, target: this, preventDefault() {}, ...values };
                for (const fn of handlers.get(type) || []) fn(event);
            }
        };
    };
    const drawing = new Proxy({}, { get: (o, key) => o[key] || (() => {}), set: (o, key, value) => (o[key] = value, true) });
    drawing.createRadialGradient = () => ({ addColorStop() {} });
    const document = target({ hidden: false });
    const canvas = target({
        width: 800, height: 600, style: {},
        box: { left: 0, top: 0, width: 800, height: 600 },
        getBoundingClientRect() { return this.box; },
        getContext: () => drawing,
        focus() { document.activeElement = this; }
    });
    const button = () => target({
        hidden: true, disabled: false, textContent: '',
        closest: () => true,
        focus() { document.activeElement = this; }
    });
    const pause = button(), dash = button();
    document.getElementById = id => ({ gameCanvas: canvas, 'pause-button': pause, 'dash-button': dash })[id];
    const window = target({ innerWidth: 800, innerHeight: 600, location: {} });
    const context = vm.createContext({
        window, document, performance: { now: () => now },
        localStorage: { getItem: () => null, setItem() {} },
        requestAnimationFrame() {}, setTimeout() {}, console: { warn() {} },
        ResizeObserver: class { observe() {} }
    });
    for (const file of ['world.js', 'game.js']) {
        const filename = path.join(__dirname, '..', 'games', '084-echo-forge-fusion', file);
        vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
    const evaluate = source => vm.runInContext(source, context);
    const game = evaluate('globalThis.game = new Game(document.getElementById("gameCanvas")); game');
    return { game, window, document, canvas, pause, dash, evaluate,
        frame(ms = 16) { now += ms; game.loop(now); },
        safeArena() { game.world.hazards = []; game.world.conveyors = []; game.enemySpawnTimer = -100; }
    };
}
const touch = (identifier, clientX = 650, clientY = 300) => ({ identifier, clientX, clientY });
function touchStart(h, points) { h.canvas.emit('touchstart', { touches: points, changedTouches: points }); }

test('084 touch hold and drag move the actual player, release/cancel remove control', () => {
    for (const ending of ['touchend', 'touchcancel']) {
        const h = harness();
        h.game.state = 'PLAYING';
        const p = h.game.player;
        touchStart(h, [touch(1)]);
        p.update(0.1, h.game.input, h.game);
        assert(p.x > 400, 'touch must move the player, not only populate a touch list');
        h.canvas.emit('touchmove', { touches: [touch(1, 100, 300)], changedTouches: [touch(1, 100, 300)] });
        p.vx = 0;
        p.update(0.1, h.game.input, h.game);
        assert(p.vx < 0, 'drag changes the movement target');
        h.window.emit(ending, { touches: [], changedTouches: [touch(1)] });
        assert.equal(h.game.input.mouse.down, false);
        p.vx = 0;
        p.vy = 0;
        p.update(0.1, h.game.input, h.game);
        assert.equal(p.vx, 0);
        assert.equal(p.vy, 0);
    }
});

test('084 held title gesture is consumed until release, then a fresh touch moves', () => {
    const h = harness();
    touchStart(h, [touch(1)]);
    h.frame();
    assert.equal(h.game.state, 'PLAYING');
    h.canvas.emit('touchmove', { touches: [touch(1)], changedTouches: [touch(1)] });
    h.game.player.update(0.1, h.game.input, h.game);
    assert.equal(h.game.player.x, 400);
    assert.equal(h.game.input.mouse.down, false);
    h.window.emit('touchend', { touches: [], changedTouches: [touch(1)] });
    touchStart(h, [touch(2)]);
    h.game.player.update(0.1, h.game.input, h.game);
    assert(h.game.player.x > 400);
});

test('084 visible Dash works while another finger steers and respects cooldown', () => {
    const h = harness();
    h.game.state = 'PLAYING';
    h.frame();
    touchStart(h, [touch(1)]);
    h.dash.emit('click');
    h.game.player.update(0.016, h.game.input, h.game);
    assert.equal(h.game.player.isDashing, true);
    assert(h.game.player.vx > 0);
    h.game.input.resetFrame();
    // Releasing the finger used for the DOM Dash control must leave steering.
    h.window.emit('touchend', { touches: [touch(1)], changedTouches: [touch(2, 750, 550)] });
    assert.equal(h.game.input.mouse.down, true);
    h.game.player.update(0.25, h.game.input, h.game);
    assert.equal(h.game.player.isDashing, false);
    h.dash.emit('click');
    h.game.player.update(0.016, h.game.input, h.game);
    assert.equal(h.game.player.isDashing, false, 'cooldown must prevent a second dash');
});

test('084 blur/hidden pause and visible Resume preserve the run and clear held input', () => {
    for (const cause of ['blur', 'hidden']) {
        const h = harness();
        h.game.state = 'PLAYING';
        h.game.score = 123;
        h.window.emit('keydown', { code: 'KeyD' });
        touchStart(h, [touch(1)]);
        if (cause === 'blur') h.window.emit('blur');
        else { h.document.hidden = true; h.document.emit('visibilitychange'); }
        assert.equal(h.game.state, 'PAUSED');
        assert.equal(h.pause.hidden, false);
        assert.equal(h.pause.textContent, 'Resume');
        assert.equal(h.game.input.mouse.down, false);
        assert(!h.game.input.keys.KeyD);
        const player = h.game.player;
        if (cause === 'hidden') {
            h.pause.emit('click');
            assert.equal(h.game.state, 'PAUSED', 'a hidden document cannot resume');
        }
        h.document.hidden = false;
        h.pause.emit('click');
        assert.equal(h.game.state, 'PLAYING');
        assert.equal(h.game.player, player);
        assert.equal(h.game.score, 123);
        assert.equal(h.document.activeElement, h.canvas);
        h.window.emit('keydown', { code: 'KeyD', repeat: true });
        h.canvas.emit('touchmove', { touches: [touch(1)], changedTouches: [touch(1)] });
        player.update(0.1, h.game.input, h.game);
        assert.equal(player.x, 400, 'old held key/touch must not reactivate after resume');
    }
});

test('084 Pause and Resume work by button and Escape without key-repeat toggles', () => {
    const h = harness();
    h.window.emit('keydown', { code: 'Space' }); h.frame();
    h.window.emit('keyup', { code: 'Space' });
    h.safeArena();
    h.pause.emit('click');
    assert.equal(h.game.state, 'PAUSED');
    h.window.emit('keydown', { code: 'Escape', target: h.pause }); h.frame();
    assert.equal(h.game.state, 'PLAYING');
    h.window.emit('keydown', { code: 'Escape', repeat: true }); h.frame();
    assert.equal(h.game.state, 'PLAYING');
    h.window.emit('keyup', { code: 'Escape' });
    h.window.emit('keydown', { code: 'Escape' }); h.frame();
    assert.equal(h.game.state, 'PAUSED');
    h.window.emit('keydown', { code: 'Space', target: h.pause });
    assert(!h.game.input.keys.Space, 'button keyboard activation must not become gameplay input');
    h.pause.emit('click');
    assert.equal(h.game.state, 'PLAYING');
});

test('084 keyboard movement/dash and primary mouse movement retain gameplay effects', () => {
    const h = harness();
    h.game.state = 'PLAYING';
    h.window.emit('keydown', { code: 'KeyD' });
    h.game.player.update(0.1, h.game.input, h.game);
    assert(h.game.player.x > 400);
    h.window.emit('keyup', { code: 'KeyD' });
    h.window.emit('keydown', { code: 'ShiftLeft' });
    h.game.player.update(0.016, h.game.input, h.game);
    assert.equal(h.game.player.isDashing, true);
    h.window.emit('keyup', { code: 'ShiftLeft' });
    h.game.player.isDashing = false;
    h.game.player.vx = 0;
    h.game.player.vy = 0;
    const beforeMouse = h.game.player.x;
    h.canvas.emit('mousedown', { button: 0, clientX: 50, clientY: 300 });
    assert.equal(h.game.input.mouse.down, true);
    h.game.player.update(0.1, h.game.input, h.game);
    assert(h.game.player.x < beforeMouse, 'primary mouse hold still moves the player');
    h.window.emit('mouseup', { button: 0 });
    assert.equal(h.game.input.mouse.down, false);
    h.canvas.emit('mousedown', { button: 2, clientX: 50, clientY: 300 });
    assert.equal(h.game.input.mouse.down, false);
});

test('084 touch coordinates follow changed canvas bounds and device scaling', () => {
    const h = harness();
    h.canvas.box = { left: 10, top: 20, width: 400, height: 300 };
    touchStart(h, [touch(1, 310, 170)]);
    assert.equal(h.game.input.mouse.x, 600);
    assert.equal(h.game.input.mouse.y, 300);
    h.canvas.box = { left: 20, top: 10, width: 200, height: 150 };
    h.canvas.emit('touchmove', { touches: [touch(1, 170, 85)], changedTouches: [touch(1, 170, 85)] });
    assert.equal(h.game.input.mouse.x, 600);
    assert.equal(h.game.input.mouse.y, 300);
});

test('084 retains phase-five bosses through pause/resume and clears them on restart', () => {
    const h = harness();
    h.game.state = 'PLAYING';
    h.game.wave = 5;
    h.game.spawnBossWave();
    const boss = h.game.boss;
    assert.equal(boss.isBoss, true);
    h.pause.emit('click'); h.pause.emit('click');
    assert.equal(h.game.boss, boss);
    assert.equal(h.game.bossActive, true);
    h.game.gameOver();
    h.window.emit('keydown', { code: 'Space' }); h.frame();
    assert.equal(h.game.state, 'PLAYING');
    assert.equal(h.game.bossActive, false);
    assert.equal(h.game.boss, null);
});
