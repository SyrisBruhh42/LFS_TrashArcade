'use strict';
// Production game/update/input paths with deterministic collision fixtures.
// Native browser startup and the captured gear trajectory are separate evidence.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function target(extra = {}) {
    const listeners = new Map();
    return { ...extra,
        addEventListener(type, callback) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(callback);
        },
        emit(type, values = {}) {
            for (const callback of listeners.get(type) || []) callback({ preventDefault() {}, ...values });
        }
    };
}

function harness() {
    let time = 0;
    const gradient = { addColorStop() {} };
    const drawing = new Proxy({}, { get(object, key) {
        if (key in object) return object[key];
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
        return () => {};
    } });
    const canvas = target({ parentElement: { clientWidth: 780, clientHeight: 493 },
        getContext: () => drawing, getBoundingClientRect: () => ({ left: 0, top: 0, width: 780, height: 493 }) });
    const window = target();
    const document = target({ getElementById: () => canvas, hidden: false });
    const context = vm.createContext({ window, document, navigator: { maxTouchPoints: 0 },
        localStorage: { getItem() { return null; }, setItem() {} },
        requestAnimationFrame() {}, ResizeObserver: class { observe() {} },
        console, performance: { now: () => time } });
    const folder = process.env.GAME071_SOURCE_DIR || path.join(__dirname, '..', 'games', '071-clockwork-tether-foundry');
    for (const filename of ['enemies.js', 'progression.js', 'bosses.js', 'vfx.js', 'ui.js', 'game.js']) {
        vm.runInContext(fs.readFileSync(path.join(folder, filename), 'utf8'), context, { filename });
    }
    const game = vm.runInContext('window.game = new Engine("game-canvas")', context);
    // Audio is unrelated to collision immunity; retain actual UI, input, physics,
    // hazards and frame order while keeping the fixture free of an audio device.
    game.sound = new Proxy({}, { get: () => () => {} });
    return { game, window, context,
        frame(dt = 1 / 60) { time += dt * 1000; game.loop(time); },
        press(code) { window.emit('keydown', { code }); this.frame(); window.emit('keyup', { code }); this.frame(); },
        start() {
            window.emit('keydown', { code: 'Space' }); this.frame();
            window.emit('keyup', { code: 'Space' });
            assert.equal(game.state, 'PLAYING');
            // Isolate the real hazard collision from other independent damage
            // sources; procedural hazards themselves remain production objects.
            game.hazards = []; game.enemies = []; game.steamVents = [];
            game.conveyors = []; game.covers = [];
        },
        hazard(properties) {
            const hazard = vm.runInContext('new Hazard(0, 0)', context);
            Object.assign(hazard, properties); game.hazards.push(hazard); return hazard;
        }
    };
}

test('071 native-captured moving gear cannot kill a fresh run before a player can react', () => {
    for (const fps of [30, 60, 120]) {
        const h = harness(); h.start();
        // Exact initial parameters captured from a native Space-start failure:
        // the old game died after 260 ms at (390, 85.80), not at the floor.
        const gear = h.hazard({ x: 407.76915124180385, y: 174.86355868575603,
            startX: 407.76915124180385, startY: 174.86355868575603,
            time: 15.000864548830295, amp: 77.04603234965337,
            speed: 2.684319805338652, horizontal: false });
        let overlapped = false;
        for (let frame = 0; frame < fps * 0.6; frame++) {
            h.frame(1 / fps);
            overlapped ||= Math.hypot(gear.x - h.game.player.x, gear.y - h.game.player.y) < gear.radius + h.game.player.radius;
            assert.equal(h.game.state, 'PLAYING', `${fps} fps, frame ${frame}: opening gear collision must be survivable`);
        }
        assert.equal(overlapped, true, `${fps} fps fixture must actually collide`);
        assert.ok(h.game.player.y > 100, 'normal gravity continues during protection');
    }
});

test('071 an unfavorable initial gear phase is survivable on the first gameplay frame', () => {
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.1]) {
        const h = harness(); h.start();
        h.hazard({ x: 390, y: 150, startX: 390, startY: 150,
            time: Math.PI - dt, amp: 100, speed: 1, horizontal: false });
        h.frame(dt);
        assert.equal(h.game.state, 'PLAYING', `dt=${dt}: first-frame collision must not end the run`);
    }
});

test('071 early dash preserves remaining opening protection and still propels the player', () => {
    const h = harness(); h.start();
    for (let i = 0; i < 12; i++) h.frame();
    const before = h.game.player.invulnerableTimer;
    const y = h.game.player.y;
    h.window.emit('keydown', { code: 'ShiftLeft' }); h.frame();
    assert.ok(h.game.player.invulnerableTimer > 0.7, 'dash must not reduce the remaining opening shield to 0.1 s');
    assert.ok(Math.abs(h.game.player.invulnerableTimer - (before - 1 / 60)) < 1e-9);
    assert.ok(h.game.player.y > y + 10, 'the tactical dash still moves the player');
    assert.ok(h.game.player.dashCooldown > 0);
});

test('071 protection expires and the same production hazard collision becomes lethal', () => {
    const h = harness(); h.start();
    for (let i = 0; i < 62; i++) h.frame();
    assert.equal(h.game.state, 'PLAYING');
    assert.ok(h.game.player.invulnerableTimer <= 0, 'opening shield must expire after one second');
    const p = h.game.player;
    h.hazard({ x: p.x, y: p.y, startX: p.x, startY: p.y, amp: 0, speed: 1, time: 0, horizontal: true });
    h.frame();
    assert.equal(h.game.state, 'GAME_OVER', 'ordinary gear danger must resume after opening protection');
});

test('071 normal restart input grants a fresh shield for each new run', () => {
    const h = harness(); h.start();
    for (let i = 0; i < 62; i++) h.frame();
    h.game.die();
    h.press('Space'); assert.equal(h.game.state, 'TITLE');
    h.start();
    h.hazard({ x: 390, y: 150, startX: 390, startY: 150,
        time: Math.PI - 1 / 60, amp: 100, speed: 1, horizontal: false });
    h.frame();
    assert.equal(h.game.state, 'PLAYING');
    assert.ok(h.game.player.invulnerableTimer > 0.9);
    assert.equal(h.game.saveManager.data.totalGamesPlayed, 2);
});
