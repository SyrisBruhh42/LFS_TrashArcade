'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const root=path.resolve(__dirname,'..');
function target(extra={}) {
    const listeners=new Map();
    return {...extra,addEventListener(name,callback){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(callback);},
        emit(name,event={}){for(const callback of listeners.get(name)||[])callback({preventDefault(){},...event});}};
}
function load(slug,files,extra={}) {
    let clock=0;
    const window=target();
    const context=vm.createContext({window,performance:{now:()=>clock},localStorage:{getItem(){return null;},setItem(){},removeItem(){}},...extra});
    for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,'games',slug,file),'utf8'),context,{filename:file});
    return {window,context,evaluate:code=>vm.runInContext(code,context),advance:ms=>clock+=ms};
}
for(const size of [
    {width:320,height:568,cssWidth:320,cssHeight:568},
    {width:1200,height:500,cssWidth:1200,cssHeight:500},
    {width:1600,height:1200,cssWidth:800,cssHeight:600}
]) {
    test(`080 logical touch and click positions invert drawing at ${size.width}x${size.height}`,()=>{
        const rect={left:17,top:23,width:size.cssWidth,height:size.cssHeight};
        const canvas=target({width:size.width,height:size.height,getBoundingClientRect:()=>rect});
        const h=load('080-frozen-tether',['game.js','ui.js'],{canvas,sound:{init(){},resume(){}}});
        const input=h.evaluate('globalThis.input=new InputManager(canvas,sound); input');
        const ui=h.evaluate("globalThis.ui=new UIManager({input,saveManager:new SaveManager()}); ui.game.saveManager.data.options.touchControls='always'; ui");
        const client=(x,y)=>{
            const scale=Math.min(size.width/800,size.height/600);
            return {clientX:rect.left+(x*scale+(size.width-800*scale)/2)*rect.width/size.width,
                clientY:rect.top+(y*scale+(size.height-600*scale)/2)*rect.height/size.height};
        };
        canvas.emit('touchstart',{touches:[client(190,500)]});
        assert.ok(Math.abs(input.mouse.x-190)<1e-9);
        assert.ok(Math.abs(input.mouse.y-500)<1e-9);
        assert.equal(ui.isActionDown('right'),true);
        assert.equal(ui.isActionDown('left'),false);
        canvas.emit('touchend',{touches:[]});
        // A click without any preceding mousemove must use its own coordinates.
        ui.game.state='PAUSED';
        canvas.emit('mousedown',client(550,415));
        assert.ok(Math.abs(input.mouse.x-550)<1e-9);
        assert.ok(Math.abs(input.mouse.y-415)<1e-9);
        assert.equal(ui.isClickInUI(input.mouse.x,input.mouse.y),true);
    });
}
function retrieval() {
    const h=load('085-scrap-heist-retrieval',['game.js']);
    h.input=h.evaluate('globalThis.input=new InputManager();input');
    h.fire=()=>h.evaluate(`(() => {
        const game={width:800,height:600,obstacles:[],shootCooldown:0,projectiles:[],particles:[],sound:{playShoot(){}}};
        const player=new Player(200,200);
        player.update(0.016,input,game);
        return game.projectiles.length;
    })()`);
    return h;
}
const touch=(id,x=100,y=100)=>({identifier:id,clientX:x,clientY:y});
test('085 primary mouse click fires an actual projectile',()=>{
    const h=retrieval();h.window.emit('mousedown',{button:0,clientX:100,clientY:100});
    assert.equal(h.fire(),1);
    h.window.emit('mouseup');assert.equal(h.input.isActionPressed(),false);
    h.window.emit('mousedown',{button:2,clientX:100,clientY:100});assert.equal(h.input.isActionPressed(),false);
});
test('085 touch tap fires once, independently of an active movement touch',()=>{
    const h=retrieval();h.window.emit('touchstart',{changedTouches:[touch(1)]});
    h.window.emit('touchmove',{changedTouches:[touch(1,180,100)]});
    h.window.emit('touchstart',{changedTouches:[touch(2,600,100)]});h.advance(100);
    h.window.emit('touchend',{changedTouches:[touch(2,600,100)]});
    assert.equal(h.fire(),1);
    assert.equal(h.input.isActionPressed(),false);
    assert.equal(h.input.joystick.active,true);
});
test('085 drag, held touch, and cancelled touch never become tap shots',()=>{
    for(const scenario of ['drag','hold','cancel']) {
        const h=retrieval();h.window.emit('touchstart',{changedTouches:[touch(1)]});
        if(scenario==='drag')h.window.emit('touchmove',{changedTouches:[touch(1,180,100)]});
        h.advance(scenario==='hold'?301:100);
        h.window.emit(scenario==='cancel'?'touchcancel':'touchend',{changedTouches:[touch(1)]});
        assert.equal(h.fire(),0,scenario);
    }
});
test('085 start gesture is consumed, then a fresh tap can fire',()=>{
    const h=retrieval();h.window.emit('touchstart',{changedTouches:[touch(1)]});
    h.evaluate("Game.prototype.startGame.call({input,state:'TITLE',saveManager:{data:{totalGamesPlayed:0},save(){}},loadWave(){}})");
    h.advance(100);h.window.emit('touchend',{changedTouches:[touch(1)]});
    assert.equal(h.fire(),0);
    h.window.emit('touchstart',{changedTouches:[touch(2)]});h.advance(100);
    h.window.emit('touchend',{changedTouches:[touch(2)]});assert.equal(h.fire(),1);
});

test('085 keyboard start preserves ammunition until a fresh gameplay action',()=>{
    for (const code of ['Enter','Space']) {
        const h=retrieval();
        h.window.emit('keydown',{code,repeat:false});
        h.evaluate("Game.prototype.startGame.call({input,state:'TITLE',saveManager:{data:{totalGamesPlayed:0},save(){}},loadWave(){}})");
        assert.equal(h.evaluate('input.isActionPressed()'),false);
        h.window.emit('keydown',{code,repeat:true});
        assert.equal(h.evaluate('input.isActionPressed()'),false);
        h.window.emit('keyup',{code});
        h.window.emit('keydown',{code,repeat:false});
        assert.equal(h.evaluate('input.isActionPressed()'),true);
    }
});


test('085 phase2 right-click dash stays separate from shooting and retains cooldown repairs',()=>{
    const h=retrieval();
    h.evaluate(`globalThis.game={width:800,height:600,obstacles:[],shootCooldown:0,projectiles:[],particles:[],sound:{playShoot(){}}}; globalThis.player=new Player(200,200);`);
    h.window.emit('mousedown',{button:2,clientX:100,clientY:100});
    assert.equal(h.input.isSecondaryPressed(),true);
    assert.equal(h.input.isActionPressed(),false);
    h.window.emit('mousedown',{button:0,clientX:100,clientY:100});
    h.evaluate('player.update(0.016,input,game)');
    assert.equal(h.evaluate('player.isDashing'),true);
    assert.equal(h.evaluate('player.hasAmmo'),true);
    assert.equal(h.evaluate('game.projectiles.length'),0);
    h.evaluate('player.update(0.05,input,game)');
    assert.ok(h.evaluate('game.particles.length')>=1);
    h.window.emit('mouseup',{button:2});
    assert.equal(h.input.isSecondaryPressed(),false);
    assert.equal(h.input.mouse.down,true);
    h.evaluate('player.update(0.2,input,game)');
    assert.equal(h.evaluate('player.isDashing'),false);
    assert.equal(h.evaluate('game.projectiles.length'),1);
    assert.equal(h.evaluate('game.shootCooldown'),0.5);
    assert.equal(h.evaluate('player.recoilTimer'),0.1);
    h.window.emit('mouseup',{button:0});
    h.window.emit('keydown',{code:'ShiftLeft'});
    h.evaluate('player.update(0.016,input,game)');
    assert.equal(h.evaluate('player.isDashing'),false,'dash cannot restart before its own cooldown');
});

test('085 phase2 particles update, expire, draw, and reset with a new wave',()=>{
    const h=retrieval();
    const result=h.evaluate(`(() => {
        const particle=new Particle(200,200,'#fff',3,0.2);
        particle.update(0.1);
        let drawn=false;
        particle.draw({save(){},restore(){},fillRect(){drawn=true;}});
        const halfway=particle.life;
        particle.update(0.2);
        const game={width:800,height:600,wave:1,particles:[particle]};
        Game.prototype.loadWave.call(game);
        return {drawn,halfway,active:particle.active,reset:game.particles.length};
    })()`);
    assert.equal(result.drawn,true);
    assert.equal(result.halfway,0.1);
    assert.equal(result.active,false);
    assert.equal(result.reset,0);
});

function pausedRetrieval() {
    const document=target({hidden:false});
    const h=load('085-scrap-heist-retrieval',['game.js'],{document});
    h.evaluate(`globalThis.input=new InputManager(); globalThis.game=Object.assign(Object.create(Game.prototype),{
        input,state:'PLAYING',score:170,player:{x:200,y:200},sound:{init(){},resume(){}}
    }); game.bindEvents();`);
    return {...h,document};
}

test('085 blur clears held controls and fresh touch resumes without firing',()=>{
    const h=pausedRetrieval();
    h.window.emit('keydown',{code:'KeyD'});
    h.window.emit('touchstart',{changedTouches:[touch(1)]});
    h.window.emit('touchmove',{changedTouches:[touch(1,180,100)]});
    h.window.emit('blur');
    assert.equal(h.evaluate('game.state'),'PAUSED');
    assert.equal(h.evaluate('input.getAxis().x'),0);
    assert.equal(h.evaluate('input.isActionPressed()'),false);
    h.window.emit('touchstart',{changedTouches:[touch(2)]});
    h.window.emit('touchend',{changedTouches:[touch(2)]});
    assert.equal(h.evaluate('game.state'),'PLAYING');
    assert.equal(h.evaluate('input.isActionPressed()'),false,'resume tap is consumed');
    assert.equal(h.evaluate('input.getAxis().x'),0);
    assert.equal(h.evaluate('game.score'),170,'run state survives resume');
    for (const code of ['KeyD','Space','ShiftLeft']) h.window.emit('keydown',{code,repeat:true});
    assert.equal(h.evaluate('input.getAxis().x'),0,'held movement needs a fresh press after resume');
    assert.equal(h.evaluate('input.isActionPressed()'),false,'held fire cannot restart through autorepeat');
    assert.equal(!!h.evaluate('input.isSecondaryPressed()'),false,'held dash cannot restart through autorepeat');
    h.window.emit('touchstart',{changedTouches:[touch(3)]});
    h.window.emit('touchend',{changedTouches:[touch(3)]});
    assert.equal(h.evaluate('input.isActionPressed()'),true,'fresh gameplay tap still works');
});

test('085 document visibility and Escape repeat cannot resume implicitly',()=>{
    const h=pausedRetrieval();
    h.document.hidden=true; h.document.emit('visibilitychange');
    assert.equal(h.evaluate('game.state'),'PAUSED');
    h.document.hidden=false; h.document.emit('visibilitychange');
    assert.equal(h.evaluate('game.state'),'PAUSED');
    h.window.emit('keydown',{code:'Escape',repeat:true});
    assert.equal(h.evaluate('game.state'),'PAUSED');
    h.window.emit('keydown',{code:'Escape',repeat:false});
    assert.equal(h.evaluate('game.state'),'PLAYING');
    h.window.emit('keydown',{code:'Escape',repeat:true});
    assert.equal(h.evaluate('game.state'),'PLAYING');
    h.window.emit('blur');
    h.window.emit('mousedown',{button:0,clientX:20,clientY:20,target:{closest:()=>({tagName:'A'})}});
    assert.equal(h.evaluate('game.state'),'PAUSED','Back navigation must not resume gameplay');
});

test('085 phase3 integration updates particles once and keeps hazards and parallax',()=>{
    const h=retrieval();
    h.evaluate(`globalThis.game=Object.assign(Object.create(Game.prototype),{
        width:800,height:600,wave:1,shootCooldown:0,state:'PLAYING',input,
        parallax:new ParallaxBackground(800,600),sound:{playScore(){}}
    });game.loadWave();game.enemies=[];
    game.particles=[new Particle(200,200,'#fff',3,0.2)];
    game.update(0.05);`);
    assert.equal(h.evaluate('game.hazards.length'),2);
    assert.ok(Math.abs(h.evaluate('game.particles[0].life')-0.15)<1e-9,'particle lifecycle runs once per frame');
    assert.equal(h.evaluate('game.shootCooldown'),0);
    assert.equal(h.evaluate('game.parallax.layers.length'),3);
});
