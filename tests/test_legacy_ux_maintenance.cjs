'use strict';
// Reviewed local production classes; mocked DOM/storage are unit evidence only.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const root=process.env.LEGACY_UX_ROOT||path.join(__dirname,'..');
const folders={80:'080-frozen-tether',82:'082-dune-ammo-scramble',83:'083-haunted-tether-drill'};
function harness(id) {
  const nodes=new Map(),stored=new Map(),prompts=[];let writes=0,fail=false;
  let document;
  class Element {
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.listeners={};this.children=[];this.style={};this.open=false;this.hidden=false;this.value='';this.textContent='';this.classList={add(){},remove(){}};}
    set id(value){this._id=value;nodes.set(value,this);} get id(){return this._id;}
    addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
    emit(type,e={}){let value;for(const fn of this.listeners[type]||[])value=fn({target:this,preventDefault(){},...e});return value;}
    append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}} appendChild(child){this.append(child);}
    focus(){document.activeElement=this;this.emit('focus');} select(){this.selected=true;}
    closest(selectors){return selectors.split(',').map(s=>s.trim().toUpperCase()).includes(this.tagName)?this:this.parentElement?.closest(selectors)||null;}
    showModal(){this.open=true;} close(){this.open=false;}
    getBoundingClientRect(){return {left:0,top:0,width:800,height:600};}
    getContext(){return new Proxy({}, {get:()=>()=>{}});}
  }
  document=new Element();document.createElement=tag=>new Element(tag);document.getElementById=id=>nodes.get(id)||null;document.hidden=false;
  const window=new Element();window.innerWidth=800;window.innerHeight=600;window.location={reload(){}};
  const names=['gameCanvas','game-canvas','settings-dialog','settings-button','settings-fields','settings-status','settings-close','options-dialog','options-button','options-fields',
  'btn-settings','btn-milestones','settings-screen','milestones-screen','title-screen','chk-mute','sld-sfx','sld-music','sel-shake','sel-particles','chk-colorblind','chk-fps','sel-touch','chk-touch-swap','btn-export-save','inp-import-save','btn-import-save','btn-reset-save','btn-close-settings','btn-close-milestones','milestones-list','save-status','save-export-text','fps-display','touch-controls','game-container'];
  for(const name of names){const el=new Element(name.includes('dialog')?'dialog':name.includes('button')||name.startsWith('btn-')?'button':'div');el.id=name;}
  nodes.get('settings-dialog').append(nodes.get('settings-fields'));nodes.get('options-dialog').append(nodes.get('options-fields'));
  const canvas=nodes.get('gameCanvas');canvas.width=800;canvas.height=600;canvas.tagName='CANVAS';
  const storage={getItem:key=>stored.get(key)||null,setItem(key,value){writes++;if(fail)throw new Error('quota');stored.set(key,value);},removeItem:key=>stored.delete(key)};
  const sound=new Proxy({}, {get:()=>()=>{}}),navigator={maxTouchPoints:2};
  const context=vm.createContext({window,document,navigator,localStorage:storage,location:window.location,console:{error(){},warn(){},log(){}},
  atob,btoa,TextEncoder,TextDecoder,performance:{now:()=>0},requestAnimationFrame(){},ResizeObserver:class{observe(){}},setTimeout(){},prompt:()=>prompts.shift()??null,alert(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'games',folders[id],'game.js'),'utf8'),context);
  if(id!==83)vm.runInContext(fs.readFileSync(path.join(root,'games',folders[id],'ui.js'),'utf8'),context);
  const classes=vm.runInContext('({SaveManager,InputManager,UIManager,Player,Game})',context);
  const save=new classes.SaveManager();
  const input=id===83?new classes.InputManager():new classes.InputManager(canvas,sound);
  const game={state:'TITLE',saveManager:save,input,inputManager:input,sound,soundEngine:sound,logicalWidth:800,logicalHeight:600,canvas,
    vfxManager:new Proxy({}, {get:()=>()=>{}}),width:800,height:600,wave:1,player:null};
  window.game=game;game.uiManager=new classes.UIManager(game);
  return {classes,game,input,save,canvas,window,document,nodes,stored,prompts,navigator,context,storage,
    get writes(){return writes;},set failWrites(value){fail=value;}};
}
const encode=data=>Buffer.from(JSON.stringify(data),'utf8').toString('base64');
for(const id of [80,82]){
  test(`${id} rejects malformed imports without changing memory or persistent data`,()=>{
    for(const data of [null,[],{},true,{unknown:1},{highScore:-1},{highScore:'9'},{unlockedMilestones:null},{unlockedMilestones:[9]},{options:[]},{options:{sfxVolume:2}},{options:{highContrast:'yes'}}]){
      const h=harness(id);h.save.data.highScore=321;const before=JSON.stringify(h.save.data);h.save.save();const disk=[...h.stored.values()][0],writes=h.writes;
      assert.equal(h.save.importData(encode(data)).ok,false,JSON.stringify(data));assert.equal(JSON.stringify(h.save.data),before);assert.equal([...h.stored.values()][0],disk);assert.equal(h.writes,writes);
    }
  });
  test(`${id} valid legacy partial imports fill defaults, retain zero volume and commit once`,()=>{
    const h=harness(id),writes=h.writes;
    assert.equal(h.save.importData(encode({highScore:99,options:{sfxVolume:0},unlockedMilestones:['first','first']})).ok,true);
    assert.equal(h.save.data.highScore,99);assert.equal(h.save.data.options.sfxVolume,0);assert.equal(h.save.data.totalGamesPlayed,0);
    assert.equal(h.save.data.unlockedMilestones.length,1);assert.equal(h.writes,writes+1);
  });
  test(`${id} storage rejection preserves the previous working save and reports failure`,()=>{
    const h=harness(id);h.save.data.highScore=123;h.save.save();const before=JSON.stringify(h.save.data),disk=[...h.stored.values()][0];h.failWrites=true;
    const result=h.save.importData(encode({highScore:999,options:{sfxVolume:0}}));
    assert.equal(result.ok,false);assert.match(result.message,/previous save was kept/i);assert.equal(JSON.stringify(h.save.data),before);assert.equal([...h.stored.values()][0],disk);
  });
  test(`${id} UTF-8 imports and exports preserve Unicode milestones and legacy ASCII`,()=>{
    const h=harness(id),other=harness(id),milestones=['frozen_☃','雪原','café'];
    assert.equal(h.save.importData(encode({highScore:12,unlockedMilestones:milestones})).ok,true);
    const exported=h.save.exportData();assert.equal(other.save.importData(exported).ok,true);
    assert.deepEqual(JSON.parse(JSON.stringify(other.save.data.unlockedMilestones)),milestones);
    assert.equal(other.save.importData(btoa('{"highScore":42}')).ok,true);assert.equal(other.save.data.highScore,42);
  });
  test(`${id} normalized imports cannot exceed their own export/reimport budget`,()=>{
    const h=harness(id);let candidate;
    for(let count=190;count<230&&!candidate;count++)for(let length=105;length<=123;length++){
      const data={unlockedMilestones:Array.from({length:count},(_,i)=>i+'-'+ '雪'.repeat(length))};
      if(encode(data).length<=100000&&encode({...h.save.data,...data}).length>100000){candidate=data;break;}
    }
    assert.ok(candidate,'fixture straddles raw and normalized size limit');
    const before=JSON.stringify(h.save.data);assert.equal(h.save.importData(encode(candidate)).ok,false);assert.equal(JSON.stringify(h.save.data),before);
  });
}
test('080 failed UI import does not fall through to save or rebuild valid state',()=>{
  const h=harness(80);h.prompts.push(encode({options:null}));const before=JSON.stringify(h.save.data),writes=h.writes;
  h.game.uiManager.handleButtonClick(h.game.uiManager.buttons.find(b=>b.id==='import'));
  assert.equal(h.writes,writes);assert.equal(JSON.stringify(h.save.data),before);assert.match(h.nodes.get('settings-status').textContent,/Invalid/);
});
test('082 successful UI import writes exactly once and reflects zero volume',()=>{
  const h=harness(82),writes=h.writes;h.nodes.get('inp-import-save').value=encode({highScore:19,options:{sfxVolume:0}});
  h.nodes.get('btn-import-save').emit('click');assert.equal(h.writes,writes+1);assert.equal(h.nodes.get('sld-sfx').value,0);assert.match(h.nodes.get('save-status').textContent,/successfully/);
});
for(const availability of ['missing','rejected','accepted'])test(`082 ${availability} clipboard has truthful feedback and recoverable export`,async()=>{
  const h=harness(82);if(availability!=='missing')h.navigator.clipboard={writeText:()=>availability==='rejected'?Promise.reject(new Error('permission')):Promise.resolve()};
  await h.game.uiManager.exportSave();const text=h.nodes.get('save-export-text');assert.equal(JSON.parse(atob(text.value)).highScore,0);assert.equal(text.hidden,false);
  assert.match(h.nodes.get('save-status').textContent,availability==='accepted'?/copied to clipboard/:/Clipboard unavailable/);
  if(availability!=='accepted')assert.equal(text.selected,true);
});
for(const outcome of ['resolve','reject'])test(`082 late clipboard ${outcome} cannot overwrite a newer import failure`,async()=>{
  const h=harness(82);let settle;
  h.navigator.clipboard={writeText:()=>new Promise((resolve,reject)=>{settle=outcome==='resolve'?resolve:()=>reject(new Error('denied'));})};
  const pending=h.game.uiManager.exportSave();h.nodes.get('inp-import-save').value='invalid';h.nodes.get('btn-import-save').emit('click');
  const status=h.nodes.get('save-status').textContent;assert.match(status,/Invalid/);settle();await pending;
  assert.equal(h.nodes.get('save-status').textContent,status);assert.equal(h.nodes.get('save-export-text').hidden,true);assert.notEqual(h.nodes.get('save-export-text').selected,true);
});
const point=(x,y,id)=>({clientX:x,clientY:y,identifier:id});
function touch(h,type,points){h.canvas.emit(type,{touches:points});}
test('080 two fingers move and jump together; releasing jump retains movement',()=>{
  const h=harness(80);h.game.state='PLAYING';h.save.data.options.touchControls='always';h.game.player=new h.classes.Player(400,568);
  touch(h,'touchstart',[point(190,500,1),point(730,500,2)]);
  h.game.player.update(.016,h.input,[{x:0,y:580,w:800,h:20}],h.game.sound);
  assert.ok(h.game.player.vx>0);assert.equal(h.game.player.vy,h.game.player.jumpForce);
  h.window.emit('touchend',{target:h.canvas,touches:[point(190,500,1)]});
  assert.equal(h.game.uiManager.isActionDown('right'),true);assert.equal(h.game.uiManager.isActionDown('jump'),false);
});
test('080 second-finger grapple aims upward instead of toward the movement pad',()=>{
  const h=harness(80);h.game.state='PLAYING';h.save.data.options.touchControls='always';h.game.player=new h.classes.Player(400,300);
  touch(h,'touchstart',[point(190,500,1),point(610,500,2)]);
  h.game.player.update(.016,h.input,[{x:350,y:200,w:100,h:20}],h.game.sound);
  assert.ok(h.game.player.vx>0);assert.equal(h.game.player.grapple.active,true);assert.equal(h.game.player.grapple.x,400);assert.ok(h.game.player.grapple.y<300);
});
test('080 cancel/reuse and blur cannot leave or reactivate held touch actions',()=>{
  const h=harness(80);touch(h,'touchstart',[point(190,500,1),point(730,500,2)]);
  h.window.emit('touchcancel',{target:h.canvas,touches:[]});assert.equal(h.game.uiManager.isActionDown('right'),false);
  touch(h,'touchstart',[point(190,500,1)]);assert.equal(h.game.uiManager.isActionDown('right'),true);
  h.window.emit('blur');touch(h,'touchmove',[point(190,500,1)]);assert.equal(h.input.touch.active,false);
  h.window.emit('touchend',{target:h.canvas,touches:[]});touch(h,'touchstart',[point(190,500,1)]);assert.equal(h.game.uiManager.isActionDown('right'),true);
});
test('080 native settings return to title and zero-volume controls survive import',()=>{
  const h=harness(80);h.nodes.get('settings-button').emit('click');assert.equal(h.game.state,'PAUSED');assert.equal(h.nodes.get('settings-dialog').open,true);
  const input=h.nodes.get('option-sfxVolume');input.value='0';input.emit('input');assert.equal(h.save.data.options.sfxVolume,0);
  h.nodes.get('settings-dialog').emit('cancel');assert.equal(h.game.state,'TITLE');assert.equal(h.nodes.get('settings-dialog').open,false);
  h.window.emit('keydown',{code:'Enter',target:input});assert.equal(h.input.isKeyDown('Enter'),false);
});
test('083 semantic options support pointer toggles and existing arrow navigation without gameplay key leakage',()=>{
  const h=harness(83);h.nodes.get('options-button').emit('click');assert.equal(h.game.state,'OPTIONS');assert.equal(h.nodes.get('options-dialog').open,true);
  const mute=h.nodes.get('option-mute');mute.checked=true;mute.emit('change');assert.equal(h.save.data.options.mute,true);
  h.nodes.get('options-dialog').emit('keydown',{code:'ArrowDown',target:mute});assert.equal(h.document.activeElement.id,'option-sfxVolume');
  h.window.emit('keydown',{code:'ArrowRight',target:h.document.activeElement});assert.equal(h.input.isDown('ArrowRight'),false);
  h.nodes.get('options-dialog').emit('cancel');assert.equal(h.game.state,'TITLE');assert.equal(h.nodes.get('options-dialog').open,false);
});
test('083 bounded hazard generation protects camp even when random repeatedly selects its center',()=>{
  const h=harness(83);vm.runInContext('Math.random=()=>0.5',h.context);
  h.game.player=new h.classes.Player(400,300);h.game.baseCamp={x:400,y:300,radius:40};
  h.classes.Game.prototype.spawnHazards.call(h.game);assert.equal(h.game.hazards.length,13);
  for(const hazard of h.game.hazards){const reach=hazard.constructor.name==='GhostlyVortex'?hazard.radius*2:hazard.constructor.name==='CrumblingPillar'?hazard.radius*Math.SQRT2:hazard.radius;assert.ok(Math.hypot(hazard.x-400,hazard.y-300)>55+reach);}
  h.input.keys.KeyD=true;const start=h.game.player.x;
  for(let i=0;i<10;i++){h.game.player.update(.016,h.input,800,600);for(const hazard of h.game.hazards)hazard.affect(h.game.player,.016);}
  assert.ok(h.game.player.x>start+20,'a fresh player can move right without being pinned by a starting pillar');
});
