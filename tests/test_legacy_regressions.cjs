'use strict';
// Actual sandboxed browser startup regressions. Uses only Node/Python stdlib and
// installed Chrome; these do not substitute for physical-device gameplay tests.
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

const cases = [
    ['005-sky-recoil-rhythm', 'title renders before run camera and islands initialization'],
    ['009-echo-trench', 'initial title transition makes the start button visible'],
    ['042-vector-stealth-retrieve', 'playing guard sweep uses an initialized frame clock'],
    ['045-cyber-ronin-tether', 'startup initializes input and audio before wiring play'],
    ['077-origami-heist-shift', 'initial spawn remains playable after start input']
];
for (const [slug, regression] of cases) {
    test(`${slug}: ${regression}`, () => {
        // Freeze the observed UI contract here so a catalog change cannot hide
        // a regression in these previously crashing/blank startup paths.
        const probe = `
import json, sys
from pathlib import Path
sys.path.insert(0, 'tools')
from runtime_gate import run_game
visible = lambda selector: "(() => { const e=document.querySelector("+json.dumps(selector)+"); return !!e && e.getClientRects().length>0 && getComputedStyle(e).visibility!=='hidden'; })()"
contract = {'title':visible('#btn-play'), 'playing':'!('+visible('#btn-play')+') && ('+visible('#btn-pause')+')', 'start':{'kind':'click','selector':'#btn-play'}}
if sys.argv[1].startswith('077-'):
 contract={'title':'window.game?.state===0','playing':'window.game?.state===1','start':{'kind':'key','key':'Enter','code':'Enter','target':'window'}}
result=run_game(Path('games')/sys.argv[1],contract)
print(json.dumps(result))
`;
        const result = spawnSync('python3', ['-c', probe, slug], {cwd:root, encoding:'utf8', timeout:30000});
        assert.equal(result.error, undefined, result.error?.message);
        assert.equal(result.status, 0, result.stderr);
        const evidence = JSON.parse(result.stdout);
        assert.equal(evidence.status, 'PASS', JSON.stringify(evidence));
        assert.equal(evidence.evidence.title_seen, true);
        assert.equal(evidence.evidence.playing_seen, true);
        assert.ok(evidence.evidence.playing_frames >= 2);
        assert.deepEqual(evidence.evidence.errors, []);
    });
}


test('077 initial spawn avoids actual enemy sight geometry', () => {
    const context = vm.createContext({window:{}});
    for (const file of ['enemies.js', 'game.js']) {
        const filename = path.join(root, 'games/077-origami-heist-shift', file);
        vm.runInContext(fs.readFileSync(filename, 'utf8'), context, {filename});
    }
    const result = vm.runInContext(`(() => {
        const game = Object.create(Game.prototype);
        game.comboManager = {reset(){}};
        game.world = {reset(){}};
        game.spawnTreasure = () => {};
        game.resetGame();
        return {
            visible: game.guards.filter(g => g.canSee(game.player)).map(g => g.constructor.name),
            previous: game.guards.filter(g => g.canSee({x:400,y:500})).map(g => g.constructor.name),
            insideArena: Math.hypot(game.player.x-400,game.player.y-300)+game.player.radius < game.arenaRadius
        };
    })()`, context);
    assert.equal(result.visible.length, 0);
    assert.equal(result.insideArena, true);
    assert.deepEqual(Array.from(result.previous), ['Sniper', 'Spawner']);
});
