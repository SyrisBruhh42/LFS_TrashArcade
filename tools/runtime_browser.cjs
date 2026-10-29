/* Node >=22 standard-library CDP driver. Game code never executes in Node.
 * Verdict, errors and real time are owned here; frame counters and native DOM
 * operations live in a CDP isolated world inaccessible to page JavaScript.
 * Main-world adapter expressions observe application state as untrusted data.
 */
'use strict';
const {spawn} = require('node:child_process');
const {readFile} = require('node:fs/promises');
const {setTimeout: delay} = require('node:timers/promises');
const {performance} = require('node:perf_hooks');

async function main() {
  const [nonce, profile, contractJSON, ...command] = process.argv.slice(2);
  const contract=JSON.parse(contractJSON);
  if (!/^[a-f0-9]{32}$/.test(nonce) || !profile || !command.length || typeof WebSocket !== 'function' ||
      typeof contract.title !== 'string' || typeof contract.playing !== 'string' || !contract.start) {
    throw new Error('CDP driver requires Node22+, nonce, private profile and trusted adapter');
  }
  const launchArguments=command.slice(1), url=launchArguments.pop();
  launchArguments.push('about:blank');
  const child=spawn(command[0],launchArguments,{stdio:['ignore','ignore','pipe']});
  let browserExited=false,launchError,socket,serial=0,stderr='',activeSession,mainFrame;
  const outstanding=new Map(),contexts=new Map(),pageErrors=[];
  const worldName='arcade-observer-'+nonce;
  child.on('error',error=>{launchError=error;});
  child.on('exit',()=>{browserExited=true;});
  child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-8000);});
  // Browser startup must not consume the game's observation window. Both stages
  // remain inside the original 80s driver ceiling and Python's 90s process cap.
  const startedAt=performance.now(),deadline=startedAt+80000;
  let stage='startup',stageDeadline=startedAt+30000;
  const bounded=()=>{
    if(performance.now()>deadline||performance.now()>stageDeadline)throw new Error('CDP '+stage+' real-time deadline exceeded');
    if(launchError)throw launchError;
    if(browserExited)throw new Error('Chrome exited before positive completion: '+stderr.slice(-1000));
  };
  const fail=message=>{if(pageErrors.length<50)pageErrors.push(String(message).slice(0,240));};
  function send(method,params={},sessionId) {
    bounded();
    const id=++serial;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{outstanding.delete(id);reject(new Error('CDP command timeout: '+method));},5000);
      outstanding.set(id,{resolve,reject,timer});
      socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
    });
  }
  async function evaluate(expression,contextId) {
    const value=await send('Runtime.evaluate',{expression,contextId,returnByValue:true},activeSession);
    if(value.exceptionDetails)throw new Error('Adapter/observer expression failed: '+String(value.exceptionDetails.exception?.description||value.exceptionDetails.text||'Unknown exception').slice(0,1000));
    return value.result?.value;
  }
  async function pause(ms) {
    const until=performance.now()+ms;
    while(performance.now()<until){bounded();await delay(Math.min(50,Math.ceil(until-performance.now())));}
    bounded();
  }
  try {
    let endpoint;
    while(!endpoint) {
      bounded();
      try {
        const [port,path]=(await readFile(profile+'/DevToolsActivePort','utf8')).trim().split('\n');
        if(/^\d+$/.test(port)&&path.startsWith('/devtools/browser/'))endpoint=`ws://127.0.0.1:${port}${path}`;
      } catch(error){if(error.code!=='ENOENT')throw error;}
      if(!endpoint)await delay(50);
    }
    socket=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});setTimeout(()=>reject(new Error('CDP connect timeout')),5000).unref();});
    socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data),entry=outstanding.get(message.id);
      if(message.sessionId===activeSession) {
        const params=message.params;
        if(message.method==='Runtime.executionContextCreated')contexts.set(params.context.id,params.context);
        if(message.method==='Runtime.executionContextDestroyed')contexts.delete(params.executionContextId);
        if(message.method==='Runtime.executionContextsCleared')contexts.clear();
        if(message.method==='Page.frameNavigated'&&mainFrame&&params.frame.id===mainFrame&&params.frame.url!==url)fail('Main frame navigated away from tested game');
        if(message.method==='Runtime.exceptionThrown') {
          const detail=params.exceptionDetails;
          fail(detail.exception?.description||detail.text||'Uncaught exception');
        }
        if(message.method==='Runtime.consoleAPICalled'&&params.type==='error')fail('console.error: '+params.args.map(arg=>String(arg.value??arg.description??arg.type)).join(' '));
      }
      if(!entry)return;
      clearTimeout(entry.timer);outstanding.delete(message.id);
      if(message.error)entry.reject(new Error('CDP error: '+message.error.message));else entry.resolve(message.result);
    });
    const {targetId}=await send('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
    activeSession=sessionId;
    await send('Page.enable',{},sessionId);
    await send('Runtime.enable',{},sessionId);
    // No script element, completion marker or page-readable authentication token.
    await send('Page.addScriptToEvaluateOnNewDocument',{worldName,source:`(() => {
      let frames=0;
      const next=window.requestAnimationFrame.bind(window);
      function frame(){frames++;next(frame);} next(frame);
      Object.defineProperty(globalThis,'__arcadeObserverFrames',{get:()=>frames});
      const query=Document.prototype.querySelector,rect=Element.prototype.getBoundingClientRect;
      const style=window.getComputedStyle.bind(window),hit=Document.prototype.elementFromPoint,contains=Node.prototype.contains;
      function point(selector,x=.5,y=.5){
        const node=query.call(document,selector);
        if(!node||node.disabled||!node.getClientRects().length||style(node).visibility==='hidden')throw new Error('Control missing/hidden/disabled');
        const box=rect.call(node),px=box.left+box.width*x,py=box.top+box.height*y,top=hit.call(document,px,py);
        if(!top||!contains.call(node,top))throw new Error('Control is covered or outside viewport');
        return {x:px,y:py};
      }
      Object.defineProperty(globalThis,'__arcadePoint',{value:point});
    })();`},sessionId);
    bounded(); // A late startup cannot reset an already expired stage deadline.
    stage='observation';
    stageDeadline=Math.min(deadline,performance.now()+(contract.behavior_profile?80000:20000));
    const navigation=await send('Page.navigate',{url},sessionId);
    if(navigation.errorText)throw new Error('Navigation failed: '+navigation.errorText);
    mainFrame=navigation.frameId;
    let observerContext,mainContext;
    while(!observerContext||!mainContext) {
      bounded();
      observerContext=[...contexts.values()].find(c=>c.name===worldName&&c.auxData?.frameId===mainFrame)?.id;
      mainContext=[...contexts.values()].find(c=>c.auxData?.isDefault&&c.auxData?.frameId===mainFrame)?.id;
      if(!observerContext||!mainContext)await delay(50);
    }
    while(await evaluate('document.readyState',observerContext)!=='complete'){bounded();await delay(50);}
    if(await evaluate('location.href',observerContext)!==url)throw new Error('Unexpected game document');
    await send('Page.bringToFront',{},sessionId);
    const observedAt=performance.now();
    await pause(200);
    const directStart=contract.initial_state==='PLAYING';
    let titleSeen=false,playingSeen=false,interactionSent=false,playingStartedAt,playingBaseline=0;
    const observe=async expression=>{
      try{return await evaluate(`!!(${expression})`,mainContext)===true;}
      catch(error){fail(error.message);return false;}
    };
    let lastPoint,activeTouch=false;
    const point=async(start)=>evaluate(`__arcadePoint(${JSON.stringify(start.selector)},${start.x??.5},${start.y??.5})`,observerContext);
    const key=async(code,down,keyValue)=>{
      const special={Enter:13,Space:32,Escape:27,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,ShiftLeft:16};
      const value=keyValue??({Space:' ',Escape:'Escape',Enter:'Enter'}[code]??code.replace(/^Key/,'').toLowerCase());
      await send('Input.dispatchKeyEvent',{type:down?'keyDown':'keyUp',key:value,code,windowsVirtualKeyCode:special[code]??value.toUpperCase().charCodeAt(0)},sessionId);
    };
    const touch=async(type,p)=>{
      if((type==='touchCancel'||type==='touchEnd')&&!activeTouch)return;
      await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5},sessionId);
      await send('Input.dispatchTouchEvent',{type,touchPoints:p?[{...p,id:1,radiusX:3,radiusY:3,force:1}]:[]},sessionId);
      activeTouch=type==='touchStart'||type==='touchMove';
    };
    const input=async(start,type)=>{
      if(start.kind==='key')return key(start.code,type==='keydown',start.key);
      const releasing=type==='pointerup'||type==='mouseup';
      const p=releasing?lastPoint:await point(start);
      if(!p)throw new Error('No pointer press to release');
      if(start.kind==='pointer'){
        if(!releasing)lastPoint=p;
        return touch(releasing?'touchEnd':'touchStart',releasing?null:p);
      }
      if(start.kind==='click'){
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',...p},sessionId);
        await send('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1},sessionId);
        return send('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1},sessionId);
      }
      if(start.kind==='mouse'){
        if(!releasing)lastPoint=p;
        return send('Input.dispatchMouseEvent',{type:type==='mousemove'?'mouseMoved':releasing?'mouseReleased':'mousePressed',...p,button:type==='mousemove'?'none':'left',clickCount:1},sessionId);
      }
      throw new Error('Unknown input kind');
    };
    try {
      titleSeen=!directStart&&await observe(contract.title);
      if(directStart){if(!await observe(contract.playing))fail('Initial PLAYING state not observed');}
      else {
        if(!titleSeen)fail('TITLE state not observed');
        const start=contract.start;
        if(start.kind==='click')await input(start,'click');
        else if(start.kind==='key'){await input(start,'keydown');await pause(100);await input(start,'keyup');}
        else if(start.kind==='mouse'){await input(start,'mousemove');await input(start,'mousedown');await pause(100);await input(start,'mouseup');}
        else if(start.kind==='pointer'){await input(start,'pointerdown');await pause(100);await input(start,'pointerup');}
        else throw new Error('Unknown start interaction');
        if(start.followup_click){await pause(150);await input({kind:'click',selector:start.followup_click},'click');}
      }
    } catch(error){fail(error.message);}
    await pause(400);
    playingSeen=await observe(contract.playing);
    if(!playingSeen)fail('PLAYING state not observed after start');
    playingBaseline=await evaluate('__arcadeObserverFrames',observerContext);
    playingStartedAt=performance.now();
    const trajectorySamples=[];
    const canvasHashes=[];
    const sampleStateAndCanvas=async()=>{
      try{
        const snap=await evaluate(`(() => {
          const g=window.game||window.gameInstance||window.app||{};
          const p=g.player||g.hero||g.ship||g.avatar||{};
          const c=document.querySelector('canvas');
          let ch='';
          if(c&&c.width>0&&c.height>0){
            try{
              const ctx=c.getContext('2d');
              if(ctx){
                const d=ctx.getImageData(0,0,Math.min(16,c.width),Math.min(16,c.height)).data;
                let h=2166136261>>>0;
                for(let i=0;i<d.length;i+=4){
                  h^=((d[i]>>4)<<8)|((d[i+1]>>4)<<4)|(d[i+2]>>4);
                  h=Math.imul(h,16777619)>>>0;
                }
                ch=h.toString(16);
              }
            }catch(_e){}
          }
          return {
            x:Number(p.x??g.x??0)||0,
            y:Number(p.y??g.y??0)||0,
            vx:Number(p.vx??p.dx??0)||0,
            vy:Number(p.vy??p.dy??0)||0,
            score:Number(g.score??g.points??0)||0,
            entities:Number((g.enemies?.length??0)+(g.projectiles?.length??0)+(g.particles?.length??0)+(g.items?.length??0))||0,
            canvas_hash:ch
          };
        })()`);
        if(snap&&typeof snap==='object'){
          trajectorySamples.push([snap.x,snap.y,snap.vx,snap.vy,snap.score,snap.entities]);
          if(snap.canvas_hash)canvasHashes.push(snap.canvas_hash);
        }
      }catch(_e){}
    };
    if(playingSeen) {
      try {
        await sampleStateAndCanvas();
        await input({kind:'key',key:'d',code:'KeyD'},'keydown');
        await input({kind:'key',key:' ',code:'Space'},'keydown');
        interactionSent=true;
        for(let step=0;step<5;step++){await pause(30);await sampleStateAndCanvas();}
        await input({kind:'key',key:'d',code:'KeyD'},'keyup');
        await input({kind:'key',key:' ',code:'Space'},'keyup');
        await input({kind:'key',key:'a',code:'KeyA'},'keydown');
        for(let step=0;step<4;step++){await pause(30);await sampleStateAndCanvas();}
        await input({kind:'key',key:'a',code:'KeyA'},'keyup');
      }catch(error){fail(error.message);}
    }
    while(performance.now()-playingStartedAt<900 && trajectorySamples.length<30){
      await pause(30);
      if(playingSeen)await sampleStateAndCanvas();
    }
    await pause(Math.max(0,900-(performance.now()-playingStartedAt)));
    const frames=await evaluate('__arcadeObserverFrames',observerContext);
    const playingFrames=playingSeen?frames-playingBaseline:0;
    const evidence={title_seen:titleSeen,playing_seen:playingSeen,interaction_sent:interactionSent,
      frames,playing_frames:playingFrames,errors:[...new Set(pageErrors)],title_applicable:!directStart,
      observation_ms:performance.now()-observedAt,playing_observation_ms:performance.now()-playingStartedAt,
      trajectory_samples:trajectorySamples,canvas_hashes:canvasHashes};
    const version=await send('Browser.getVersion');
    evidence.environment={browser:version.product,protocol:version.protocolVersion,headless:true,physical_device:false,
      input:'CDP native keyboard/mouse and emulated touch',
      viewport:await evaluate('({width:innerWidth,height:innerHeight,device_pixel_ratio:devicePixelRatio})',observerContext)};
    evidence.not_covered=['physical devices','audible audio','screen reader usability','visual design','resize/orientation',
      'persistent progress/recovery','natural game-over path','multi-touch combinations'];
    evidence.scenarios=[];
    evidence.coverage=contract.behavior_profile?'browser_behavior':'startup_smoke_only';
    if(contract.behavior_profile) await runBehavior();
    evidence.errors=[...new Set(pageErrors)];
    // Only the trusted process owns the verdict. Application observations remain
    // untrusted data, and all application code executes inside sandboxed Chrome.
    process.stdout.write(JSON.stringify({schema_version:3,driver:'cdp-native-v2',nonce,source_sha:contract.source_sha??null,
      expected_behavior_hash:contract.expected_behavior_hash??null,tested_at:new Date().toISOString(),evidence})+'\n');
    async function runBehavior() {
      const profiles=new Set(['game083-v1','game084-v1','game085-v1','game086-v1','standard-v1']);
      const names=['keyboard_movement_release','pointer_action','touch_movement_cancel','blur_pause_resume','restart_from_game_over'];
      if(!profiles.has(contract.behavior_profile))throw new Error('Unknown trusted behavior profile');
      const profile=contract.behavior_profile;
      for(const name of contract.required_scenarios||[]) {
        if(names.includes(name))continue;
        if(name!=='touch_secondary_action'||profile!=='game085-v1')throw new Error('Unsupported required behavior scenario');
        names.push(name);
      }
      const requireThat=(condition,message)=>{if(!condition)throw new Error(message);};
      const read=async()=>evaluate(`(() => {
        const g=window.game,p=g?.player,i=g?.input||g?.inputManager;
        if(!g||!p||!i)throw new Error('Required player/input observation missing');
        return {state:g.state,x:p.x,y:p.y,score:g.score,wave:g.wave??null,
          key_d:!!i.keys?.KeyD,mouse_down:!!i.mouse?.down,touch_active:!!i.touch?.active,
          touch_count:i.touches?.length??0,joystick_active:!!i.joystick?.active,
          virtual_down:Object.values(i.virtualKeys||{}).some(Boolean),
          dash:p.dashTimer??p.dashCooldown??0,is_dashing:!!p.isDashing,dash_cooldown:p.dashCooldown??0,
          projectiles:g.projectiles?.length??0,
          width:g.width,height:g.height};
      })()`,mainContext);
      const released=s=>!s.key_d&&!s.mouse_down&&!s.touch_active&&!s.touch_count&&!s.joystick_active&&!s.virtual_down;
      const moved=(a,b)=>Number.isFinite(a.x)&&Number.isFinite(b.x)&&Number.isFinite(a.y)&&Number.isFinite(b.y)&&Math.hypot(b.x-a.x,b.y-a.y)>.5;
      const resume=async()=>{
        if(profile==='game084-v1'||profile==='game086-v1')await input({kind:'click',selector:'#pause-button'},'click');
        else {await touch('touchStart',await point({selector:'#gameCanvas',x:.5,y:.5}));await pause(60);await touch('touchEnd');}
        await pause(80);
      };
      const start=async()=>{
        contexts.clear();
        await send('Page.navigate',{url},sessionId);
        observerContext=mainContext=null;
        while(!observerContext||!mainContext){
          bounded();
          observerContext=[...contexts.values()].find(c=>c.name===worldName&&c.auxData?.frameId===mainFrame)?.id;
          mainContext=[...contexts.values()].find(c=>c.auxData?.isDefault&&c.auxData?.frameId===mainFrame)?.id;
          if(!observerContext||!mainContext)await pause(20);
        }
        while(await evaluate('document.readyState',observerContext)!=='complete')await pause(20);
        await send('Page.bringToFront',{},sessionId);
        await pause(80);
        requireThat(await observe(contract.title),'Fresh TITLE missing');
        if(contract.start.kind==='key'){await input(contract.start,'keydown');await pause(60);await input(contract.start,'keyup');}
        else await input(contract.start,'click');
        await pause(80);
        requireThat(await observe(contract.playing),'Fresh PLAYING missing');
        const fresh=await read();
        requireThat(released(fresh),'Start gesture left held controls');
        if(profile==='game085-v1'||profile==='game086-v1')requireThat(fresh.projectiles===0,'Start gesture leaked a gameplay projectile');
        return fresh;
      };
      for(const name of names){
        const began=performance.now(),errorCount=pageErrors.length;
        const record={id:name,status:'FAIL',classification:name==='restart_from_game_over'?'browser_input_with_trusted_fixture':'browser_input',
          source_sha:contract.source_sha??null,expected_behavior_hash:contract.expected_behavior_hash??null};
        try {
          const before=await start();record.before=before;
          if(name==='keyboard_movement_release'){
            await key('KeyD',true,'d');await pause(140);const moving=await read();record.during=moving;
            await key('KeyD',false,'d');await pause(50);record.after=await read();
            requireThat(moving.state==='PLAYING'&&moved(before,moving),'Keyboard input did not move the player');
            requireThat(!record.after.key_d,'Keyboard release left movement held');
          } else if(name==='pointer_action'){
            const control=profile==='game084-v1'?{kind:'click',selector:'#dash-button'}:{kind:'mouse',selector:'#gameCanvas',x:.55,y:.5};
            if(control.kind==='click')await input(control,'click');else {await input(control,'mousedown');await pause(70);await input(control,'mouseup');}
            await pause(50);record.after=await read();
            const changed=['game083-v1','game084-v1'].includes(profile)?record.after.dash>0:record.after.projectiles>before.projectiles;
            requireThat(changed,'Pointer action produced no ability/projectile effect');
            requireThat(released(record.after),'Pointer release left held controls');
          } else if(name==='touch_movement_cancel'){
            let p=await point({selector:'#gameCanvas',x:.6,y:.5});
            await touch('touchStart',p);await touch('touchMove',{x:p.x+45,y:p.y});await pause(150);
            record.during=await read();await touch('touchCancel');await pause(50);record.after=await read();
            requireThat(record.during.state==='PLAYING'&&moved(before,record.during),'Touch input did not move the player');
            requireThat(released(record.after),'Touch cancellation left held controls');
            await pause(500);const retryBefore=await read();record.retry_before=retryBefore;
            // Reverse direction: steering games may already have reached the
            // first target, making a repeated target a false no-movement result.
            p=await point({selector:'#gameCanvas',x:.3,y:.5});
            await touch('touchStart',p);await touch('touchMove',{x:p.x-45,y:p.y});await pause(150);
            record.retry_during=await read();
            requireThat(moved(retryBefore,record.retry_during),'Fresh touch after cancellation did not move the player');
            await touch('touchEnd');await pause(50);
            record.after_release=await read();
            requireThat(released(record.after_release),'Touch release left held controls');
          } else if(name==='blur_pause_resume'){
            await key('Escape',true);await pause(60);await key('Escape',false);await pause(50);
            requireThat((await read()).state==='PAUSED','Keyboard pause did not stop play');
            await resume();
            requireThat((await read()).state==='PLAYING','Visible/pointer resume did not restore play after keyboard pause');
            await key('KeyD',true,'d');
            await touch('touchStart',await point({selector:'#gameCanvas',x:.6,y:.5}));
            const {targetId:other}=await send('Target.createTarget',{url:'about:blank'});
            try{
              await send('Target.activateTarget',{targetId:other});await pause(150);
              record.paused=await read();
              requireThat(record.paused.state==='PAUSED','Focus/visibility loss did not pause');
              requireThat(released(record.paused),'Focus loss left held controls');
              await pause(100);const still=await read();
              requireThat(still.x===record.paused.x&&still.y===record.paused.y,'Player advanced while paused');
            }finally{await send('Target.closeTarget',{targetId:other});await send('Page.bringToFront',{},sessionId);}
            await key('KeyD',false,'d');await touch('touchCancel');await pause(50);
            await resume();record.after=await read();
            requireThat(record.after.state==='PLAYING','Visible/pointer resume did not restore play');
            requireThat(released(record.after),'Resume gesture leaked into gameplay');
          } else if(name==='touch_secondary_action'){
            const accessible=await evaluate(`(() => {const b=document.querySelector('#dash-button');return !!b &&
              (b.tagName==='BUTTON'||b.getAttribute('role')==='button'&&b.tabIndex>=0) &&
              /dash/i.test(b.getAttribute('aria-label')||b.textContent);})()`,observerContext);
            requireThat(accessible,'Accessible Dash control missing');
            await touch('touchStart',await point({selector:'#dash-button'}));await pause(60);
            record.during=await read();await touch('touchEnd');await pause(50);record.after=await read();
            requireThat(record.after.state==='PLAYING'&&(record.during.is_dashing||record.after.is_dashing)
              &&record.after.dash_cooldown>before.dash_cooldown&&moved(before,record.after),'Touch Dash control produced no dash movement/cooldown effect');
            requireThat(released(record.after),'Touch Dash release left held controls');
          } else {
            record.fixture='Trusted driver seeds score=17 and enters GAME_OVER; natural death and score persistence are not covered by this scenario.';
            await evaluate(`(() => { const g=window.game; g.score=17; if(typeof g.gameOver==='function')g.gameOver();else g.state='GAME_OVER'; })()`,mainContext);
            await pause(50);const ended=await read();
            requireThat(ended.state==='GAME_OVER'&&ended.score===17,'GAME_OVER score-reset fixture was not established');
            const keyCode=profile==='game085-v1'||profile==='game086-v1'?'Enter':'Space';
            await key(keyCode,true);await pause(60);await key(keyCode,false);await pause(80);
            if((await read()).state==='TITLE'){await key(keyCode,true);await pause(60);await key(keyCode,false);await pause(80);}
            record.after=await read();
            requireThat(record.after.state==='PLAYING'&&record.after.score===0,'Restart did not create a fresh playable run');
            requireThat(released(record.after),'Restart left held controls');
            if(profile==='game085-v1'||profile==='game086-v1')requireThat(record.after.projectiles===0,'Restart gesture leaked a gameplay projectile');
          }
          requireThat(pageErrors.length===errorCount,'Browser errors occurred during scenario');
          record.status='PASS';
        } catch(error){record.reason=String(error.message).slice(0,500);}
        finally {
          // A failing scenario must not leave physical input held for the next.
          try {await key('KeyD',false,'d');await key('Escape',false);await key('Enter',false);await key('Space',false);await touch('touchCancel');
            if(lastPoint)await send('Input.dispatchMouseEvent',{type:'mouseReleased',...lastPoint,button:'left',clickCount:1},sessionId);
          } catch(error){record.status='FAIL';record.cleanup_error=String(error.message).slice(0,500);}
        }
        record.elapsed_ms=performance.now()-began;
        evidence.scenarios.push(record);
      }
    }
    await send('Browser.close');
    await delay(100);
  } finally {
    for(const entry of outstanding.values())clearTimeout(entry.timer);
    socket?.close();
    if(!browserExited)child.kill('SIGKILL');
  }
}
main().catch(error=>{process.stderr.write(String(error.message).slice(0,1500)+'\n');process.exitCode=2;});
