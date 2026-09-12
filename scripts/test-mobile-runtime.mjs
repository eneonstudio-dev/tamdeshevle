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
  loadPrices(){priceRefreshes+=1;return Promise.resolve(true)}
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

console.log("Mobile runtime lifecycle passed: viewport, keyboard, BFCache resume, idempotent listeners.");
