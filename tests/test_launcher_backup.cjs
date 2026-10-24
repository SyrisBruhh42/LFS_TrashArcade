const test = require('node:test');
const assert = require('node:assert/strict');
require('../launcher_backup.js');
const backup = globalThis.ArcadeBackup;
function storage(initial = {}, fail = () => false) {
  const values = new Map(Object.entries(initial)); let writes=0;
  return {
    get length(){return values.size;}, key(i){return [...values.keys()][i] ?? null;},
    getItem(key){return values.has(key) ? values.get(key) : null;},
    setItem(key,value){if(fail(++writes,key,value)) throw Error('quota');values.set(key,value);},
    removeItem(key){values.delete(key);}, values,
  };
}
const a='arcade_game_001_save',b='arcade_game_002_save';
test('restore validates all keys before any save mutation',()=>{
  const s=storage({[a]:'old'});
  assert.throws(()=>backup.restore(s,{[a]:'new',unrelated:'x'}));
  assert.equal(s.getItem(a),'old');
  for(const value of [null,[],42,{[a]:{}},{[a]:'x'.repeat(1500001)}]) assert.throws(()=>backup.restore(s,value));
});
test('verified restore preserves unrelated data and exact save bytes',()=>{
  const s=storage({unrelated:'keep'});
  assert.equal(backup.restore(s,{[a]:'{"name":"雪"}'}).status,'restored');
  assert.equal(s.getItem(a),'{"name":"雪"}');assert.equal(s.getItem('unrelated'),'keep');
});
test('failure on a later key rolls back earlier changed and newly created saves',()=>{
  for(const initial of [{[a]:'old'},{[b]:'prior'}]) {
    const s=storage(initial,(n)=>n===2);
    assert.equal(backup.restore(s,{[a]:'new',[b]:'next'}).status,'rolled_back');
    assert.deepEqual(Object.fromEntries(s.values),initial);
  }
});
test('rollback failure remains explicit and retains prior save recovery',()=>{
  const s=storage({[a]:'old',[b]:'prior'},n=>n>=2);
  const result=backup.restore(s,{[a]:'new',[b]:'next'});
  assert.equal(result.status,'recovery_required');
  assert.equal(result.recovery[a],'old');assert.equal(result.recovery[b],'prior');
  assert.equal(s.getItem(a),'new');assert.ok(result.unresolved.includes(a));
});
test('readback failure cannot report successful restore',()=>{
  const s=storage({[a]:'old'}),get=s.getItem.bind(s);let reads=0;
  s.getItem=k=>++reads===2?'wrong':get(k);
  assert.equal(backup.restore(s,{[a]:'new'}).status,'rolled_back');
  assert.equal(get(a),'old');
});
test('export storage failure cannot return a partial bundle',()=>{
  const s=storage({[a]:'old',[b]:'prior'}),get=s.getItem.bind(s);
  s.getItem=k=>{if(k===b)throw Error('denied');return get(k);};
  assert.throws(()=>backup.snapshot(s));
});
test('repeated failed recovery preserves the first receipt until all prior bytes are verified',()=>{
  let reject=true;
  const s=storage({[a]:'original'},n=>reject && n>=2);
  const receipt=backup.restore(s,{[a]:'changed',[b]:'new'});
  assert.equal(receipt.status,'recovery_required');
  const retry=backup.recover(s,receipt);
  assert.equal(retry.status,'recovery_required');
  assert.equal(retry.recovery[a],'original');
  assert.deepEqual(retry.originallyAbsent,[b]);
  reject=false;
  assert.equal(backup.recover(s,retry).status,'recovered');
  assert.deepEqual(Object.fromEntries(s.values),{[a]:'original'});
});
test('silent recovery failure remains unresolved and keeps original bytes',()=>{
  const s=storage({[a]:'changed'});
  s.setItem=()=>{};
  const prior={recovery:{[a]:'original'},originallyAbsent:[],status:'recovery_required',unresolved:[a]};
  assert.equal(backup.recover(s,prior).status,'recovery_required');
  assert.equal(prior.recovery[a],'original');
});
