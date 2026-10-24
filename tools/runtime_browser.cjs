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
  const deadline=performance.now()+20000;
  const bounded=()=>{
    if(performance.now()>deadline)throw new Error('CDP real-time deadline exceeded');
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
      const click=HTMLElement.prototype.click,dispatch=EventTarget.prototype.dispatchEvent;
      const style=window.getComputedStyle.bind(window),Keyboard=KeyboardEvent,Pointer=PointerEvent,Mouse=MouseEvent;
      function target(selector,release=false){const node=query.call(document,selector);if(!node||(!release&&(node.disabled||!node.getClientRects().length||style(node).visibility==='hidden')))throw new Error('Control missing/hidden/disabled');return node;}
      function interaction(start,type){
        if(start.kind==='click'){click.call(target(start.selector));return true;}
        if(start.kind==='key'){
          const node=start.target==='document'?document:start.target&&start.target!=='window'?target(start.target):window;
          dispatch.call(node,new Keyboard(type,{key:start.key,code:start.code,bubbles:true}));return true;
        }
        // Start controls may hide or disable themselves on press. Release still
        // reaches that existing element, while every initial press stays strict.
        const node=target(start.selector,type==='pointerup'||type==='mouseup'),box=rect.call(node);
        const options={clientX:box.left+box.width*(start.x??0.5),clientY:box.top+box.height*(start.y??0.5),bubbles:true};
        if(start.kind==='pointer')dispatch.call(node,new Pointer(type,{...options,pointerId:1,pointerType:'touch'}));
        else if(start.kind==='mouse')dispatch.call(node,new Mouse(type,{...options,button:0}));
        else throw new Error('Unknown input kind');
        return true;
      }
      Object.defineProperty(globalThis,'__arcadeInteraction',{value:interaction});
    })();`},sessionId);
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
    const observedAt=performance.now();
    await pause(200);
    const directStart=contract.initial_state==='PLAYING';
    let titleSeen=false,playingSeen=false,interactionSent=false,playingStartedAt,playingBaseline=0;
    const observe=async expression=>{
      try{return await evaluate(`!!(${expression})`,mainContext)===true;}
      catch(error){fail(error.message);return false;}
    };
    const input=async(start,type)=>{
      if(await evaluate(`__arcadeInteraction(${JSON.stringify(start)},${JSON.stringify(type)})`,observerContext)!==true)throw new Error('Input dispatch was not confirmed');
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
    if(playingSeen) {
      try {
        await input({kind:'key',key:'d',code:'KeyD'},'keydown');
        await input({kind:'key',key:' ',code:'Space'},'keydown');
        interactionSent=true;
        await pause(150);
        await input({kind:'key',key:'d',code:'KeyD'},'keyup');
        await input({kind:'key',key:' ',code:'Space'},'keyup');
      }catch(error){fail(error.message);}
    }
    await pause(Math.max(0,900-(performance.now()-playingStartedAt)));
    const frames=await evaluate('__arcadeObserverFrames',observerContext);
    const playingFrames=playingSeen?frames-playingBaseline:0;
    const evidence={title_seen:titleSeen,playing_seen:playingSeen,interaction_sent:interactionSent,
      frames,playing_frames:playingFrames,errors:[...new Set(pageErrors)],title_applicable:!directStart,
      observation_ms:performance.now()-observedAt,playing_observation_ms:performance.now()-playingStartedAt};
    // Only this trusted process serializes completion; no page DOM/text is read.
    process.stdout.write(JSON.stringify({schema_version:2,driver:'cdp-isolated-v1',nonce,evidence})+'\n');
    await send('Browser.close');
    await delay(100);
  } finally {
    for(const entry of outstanding.values())clearTimeout(entry.timer);
    socket?.close();
    if(!browserExited)child.kill('SIGKILL');
  }
}
main().catch(error=>{process.stderr.write(String(error.message).slice(0,1500)+'\n');process.exitCode=2;});
