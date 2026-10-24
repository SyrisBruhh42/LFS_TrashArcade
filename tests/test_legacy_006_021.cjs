'use strict';
// Concrete regressions discovered by the native-input sweep. Browser reachability
// and deterministic production-class behavior remain separate evidence types.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {spawnSync} = require('node:child_process');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

test('006 visible Play receives an ordinary native click despite inactive modal buttons', () => {
    const probe = `
import json, sys
from pathlib import Path
sys.path.insert(0, 'tools')
from runtime_gate import run_game
contract={'title':"document.querySelector('#ui-title.active') !== null",'playing':"document.querySelector('#ui-playing.active') !== null",'start':{'kind':'click','selector':'#btn-play'}}
print(json.dumps(run_game(Path('games/006-arctic-perimeter'),contract)))
`;
    const result = spawnSync('python3', ['-c', probe], {cwd:root, encoding:'utf8', timeout:30000});
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, 'PASS', JSON.stringify(receipt));
    assert.equal(receipt.evidence.title_seen, true);
    assert.equal(receipt.evidence.playing_seen, true);
    assert.equal(receipt.evidence.interaction_sent, true);
    assert.deepEqual(receipt.evidence.errors, []);
});

function magnetism(enemies, player=[5,3,1]) {
    const filename = path.join(root, 'games/021-neon-grid-switch/index.html');
    const script = fs.readFileSync(filename, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
    const context = vm.createContext({window:{addEventListener(){}}});
    vm.runInContext(script, context, {filename});
    return JSON.parse(vm.runInContext(`(() => {
        const sounds=[];
        const world=Object.create(GameWorld.prototype);
        world.engine={audio:{sfxPush(){sounds.push('push');},sfxPull(){sounds.push('pull');},
            sfxDestroy(){sounds.push('destroy');},sfxHurt(){sounds.push('hurt');},playTone(){sounds.push('bonus');}}};
        world.player=new Entity(...${JSON.stringify(player)});
        world.enemies=${JSON.stringify(enemies)}.map(values=>new Entity(...values));
        world.score=0;world.wave=1;
        world.addParticles=()=>{};world.addShake=()=>{};
        let hudUpdates=0;world.updateHUD=()=>hudUpdates++;
        const moved=world.processMagnetism();
        return JSON.stringify({moved,sounds,hudUpdates,score:world.score,
            enemies:world.enemies.map(e=>({x:e.x,y:e.y,tx:e.tx,ty:e.ty,dead:e.dead}))});
    })()`, context));
}

test('021 same-polarity movement emits push after the enemy loop without a scope error', () => {
    const result = magnetism([[7,3,1]]);
    assert.equal(result.moved, true);
    assert.equal(result.enemies[0].tx, 8);
    assert.deepEqual(result.sounds, ['push']);
    assert.equal(result.hudUpdates, 1);
});

test('021 opposite-polarity movement emits pull', () => {
    const result = magnetism([[8,3,-1]]);
    assert.equal(result.moved, true);
    assert.equal(result.enemies[0].tx, 7);
    assert.deepEqual(result.sounds, ['pull']);
});

test('021 mixed movement reports both actual force directions once', () => {
    const result = magnetism([[7,3,1],[5,0,-1],[3,3,1]]);
    assert.equal(result.moved, true);
    assert.deepEqual(result.sounds, ['push','pull']);
    assert.deepEqual(result.enemies.map(e=>[e.tx,e.ty]), [[8,3],[5,1],[2,3]]);
});

test('021 distant and non-cardinal enemies do not invent movement sounds', () => {
    const result = magnetism([[10,3,1],[7,2,-1]]);
    assert.equal(result.moved, false);
    assert.deepEqual(result.sounds, []);
    assert.equal(result.hudUpdates, 1);
});

test('021 later inactive opposite polarity cannot change the movement sound', () => {
    const result = magnetism([[7,3,1],[11,3,-1]]);
    assert.equal(result.moved, true);
    assert.deepEqual(result.sounds, ['push']);
});

test('021 wall destruction preserves bonus priority over simultaneous movement sound', () => {
    const result = magnetism([[0,3,1],[3,3,1]], [1,3,1]);
    assert.equal(result.enemies[0].dead, true);
    assert.equal(result.enemies[1].tx, 4);
    assert.equal(result.moved, true);
    assert.equal(result.score, 100);
    assert.deepEqual(result.sounds, ['destroy','bonus']);
});
