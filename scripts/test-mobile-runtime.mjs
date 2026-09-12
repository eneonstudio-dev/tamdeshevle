import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class Target {
  constructor(){this.listeners=new Map()}
  addEventListener(name,fn){const list=this.listeners.get(name)||[];list.push(fn);this.listeners.set(name,list)}
  removeEventListener(name,fn){const list=this.listeners.get(name)||[];this.listeners.set(name,list.filter(item=>item!==fn))}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);return true}
}
class CustomEventMock {
  constructor(type,init={}){this.type=type;this.detail=init.detail}
}

const windowTarget=new Target();
const documentTarget=new Target();
const viewportTarget=new Target();
const attrs=new Set();
const vars=new Map();
let priceRefreshes=0;
let rafSeq=0;
const context={
  console,
  Promise,
  Date,
  CustomEvent:CustomEventMock,
  navigator:{onLine:true},
  STORES:[{id:"shop"}],
  PRODUCTS:[{id:"milk"}],
  state:{cart:{milk:1},city:"msk",mode:"any",storeId:"shop"},
  TDCompare:{
    defaultChannel:()=>"shelf",
    unitPrice:()=>100,
    cartEntries:()=>[{id:"milk"}],
    goodsTotal:()=>100,
    compare:()=>[]
  },
  requestAnimationFrame(fn){rafSeq+=1;fn();return rafSeq},
  cancelAnimationFrame(){},
  document:Object.assign(documentTarget,{
    hidden:false,
    documentElement:{
      clientHeight:800,
      style:{setProperty:(name,value)=>vars.set(name,value)}
    },
    body:{toggleAttribute(name,on){if(on)attrs.add(name);else attrs.delete(name)}}
  })
};
context.window=Object.assign(windowTarget,{
  innerHeight:800,
  visualViewport:Object.assign(viewportTarget,{height:800,offsetTop:0}),
  speechSynthesis:{cancel(){}},
  loadPrices(){priceRefreshes+=1;return Promise.resolve(true)},
  TDCompare:context.TDCompare,
  state:context.state
});
context.globalThis=context;
vm.createContext(context);
const source=fs.readFileSync("runtime-bridge.js","utf8");
vm.runInContext(source,context,{filename:"runtime-bridge.js"});

assert.equal(context.window.TDRuntimeState?.installed,true,"runtime bridge should install");
assert.equal(context.window.TDRuntimeState?.mobileLifecycle,true,"mobile lifecycle flag should be exposed");
assert.equal(vars.get("--td-vvh"),"800px","initial visual viewport height should be published");
assert.equal(attrs.has("data-td-keyboard-open"),false,"keyboard should start closed");

context.window.visualViewport.height=500;
context.window.visualViewport.offsetTop=0;
context.window.visualViewport.dispatchEvent({type:"resize"});
assert.equal(vars.get("--td-vvh"),"500px","visual viewport resize should update CSS height");
assert.equal(attrs.has("data-td-keyboard-open"),true,"large covered area should mark keyboard open");

context.window.visualViewport.height=800;
context.window.visualViewport.dispatchEvent({type:"resize"});
assert.equal(attrs.has("data-td-keyboard-open"),false,"restored viewport should clear keyboard state");

const beforeResume=priceRefreshes;
context.window.dispatchEvent({type:"pageshow",persisted:true});
await Promise.resolve();
assert.equal(priceRefreshes,beforeResume+1,"BFCache restore should refresh prices once");

vm.runInContext(source,context,{filename:"runtime-bridge-second-load.js"});
const beforeOnline=priceRefreshes;
context.window.dispatchEvent({type:"online"});
await Promise.resolve();
assert.equal(priceRefreshes,beforeOnline+1,"duplicate script execution must not duplicate lifecycle listeners");

const mobileDock=fs.readFileSync("v2-mobile-dock.js","utf8");
const priceSync=fs.readFileSync("price-sync.js","utf8");
const androidCss=fs.readFileSync("android-viewport-fix.css","utf8");
const touchCss=fs.readFileSync("touch-layout-fix.css","utf8");

assert.match(source,/visualViewport/,"runtime bridge must own the real visual viewport");
assert.match(source,/data-td-keyboard-open/,"runtime bridge must publish keyboard-open state");
assert.match(mobileDock,/__TDV2MobileDockInitialized/,"mobile dock must be idempotent");
assert.doesNotMatch(mobileDock,/visualViewport/,"mobile dock must not duplicate visual viewport listeners owned by runtime bridge");
assert.match(mobileDock,/td:runtime-resume/,"mobile dock must rehydrate when runtime resumes");
assert.match(mobileDock,/pageshow/,"mobile dock must recover after BFCache/page restore");
assert.match(mobileDock,/const ROUTES=\["home",null,"catalog","cart","profile"\]/,"mobile dock must preserve the canonical Bay-first route order");
assert.match(mobileDock,/data-action="bai"/,"fallback mobile dock must keep Bai as the second primary action");
assert.match(mobileDock,/button\.dataset\.screen===screen/,"mobile dock active state must follow the current route instead of a hardcoded Home state");
assert.doesNotMatch(mobileDock,/data-screen="stores"/,"fallback mobile dock must not regress to the legacy Map slot in place of Bai");

assert.match(priceSync,/__TDPriceSyncInitialized/,"price sync must be idempotent");
assert.doesNotMatch(priceSync,/setInterval\s*\(/,"price sync must not poll continuously with setInterval");
assert.match(priceSync,/document\.hidden/,"price sync must pause in hidden tabs");
assert.match(priceSync,/navigator\.onLine/,"price sync must avoid network work while offline");
assert.match(priceSync,/window\.addEventListener\(\s*["']pagehide["']\s*,\s*suspend\s*\)/,"price sync must suspend on pagehide");
assert.match(priceSync,/window\.addEventListener\(\s*["']pageshow["']\s*,\s*resume\s*\)/,"price sync must resume after BFCache/page restore");
assert.match(priceSync,/window\.addEventListener\(\s*["']offline["']\s*,\s*suspend\s*\)/,"price sync must pause offline");
assert.match(priceSync,/window\.addEventListener\(\s*["']online["']\s*,\s*resume\s*\)/,"price sync must resume online");

assert.match(androidCss,/data-td-keyboard-open/,"Android CSS must react to keyboard state");
assert.match(androidCss,/var\(--td-vvh,100dvh\)/,"Android dialogs must use visual viewport height");
assert.match(androidCss,/\.v2-bottom-nav/,"Android keyboard state must protect bottom navigation");
assert.match(touchCss,/bottom:calc\(64px \+ env\(safe-area-inset-bottom\)\)!important/,"coarse-pointer mascot must preserve the bottom safe area");
assert.match(touchCss,/max-height:calc\(var\(--td-vvh,100dvh\) - 104px\)!important/,"coarse-pointer Bay panel must use visual viewport height");

console.log("Mobile runtime lifecycle passed: one viewport owner, Bay-first dock state, keyboard/safe areas, BFCache resume and suspended price sync are guarded.");
