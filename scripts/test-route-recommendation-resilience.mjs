import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function makeRuntime(file){
  const listeners=new Map(),docListeners=new Map(),observers=[];
  const add=(map,name,fn)=>{const list=map.get(name)||[];list.push(fn);map.set(name,list)};
  const context={
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame(fn){context.__raf=(context.__raf||0)+1;fn();return context.__raf},
    cancelAnimationFrame(){},
    MutationObserver:class{constructor(cb){this.cb=cb;this.observeCount=0;this.disconnectCount=0;observers.push(this)}observe(){this.observeCount++}disconnect(){this.disconnectCount++}},
    document:{
      readyState:"complete",visibilityState:"visible",body:{},head:{appendChild(){}},
      getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},
      createElement(){return{dataset:{},style:{},appendChild(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}}},
      addEventListener(name,fn){add(docListeners,name,fn)}
    },
    state:{storeId:"magnit",cart:{milk:1},address:""},
    PRODUCTS:[{id:"milk"}],STORES:[{id:"magnit"},{id:"perek"}],
    TDGeo:{nearby:[],position:{lat:55.75,lon:37.61},openMap(){},locate(){}},
    TDStoreIdBridge:{basket(point,opts){context.__lastReference=opts.referenceStoreId;return{verified:true,savings:240,total:760}}},
    fetch:async()=>({ok:true,json:async()=>[{lat:"55.76",lon:"37.62",display_name:"Точка"}]}),
    AbortController:class{constructor(){this.signal={};this.aborted=false}abort(){this.aborted=true}},
    prompt(){return""},alert(){},
    addEventListener(name,fn){add(listeners,name,fn)},dispatchEvent(){}
  };
  context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(file,"utf8"),context,{filename:file});
  return{context,listeners,docListeners,observers};
}

for(const [file,apiName] of [["worth-it.js","TDWorthIt"],["on-the-way.js","TDOnTheWay"]]){
  const {context,listeners,observers}=makeRuntime(file);
  const api=context[apiName];
  assert.ok(api,`${file} exposes ${apiName}`);

  const point={chainId:"magnit",referenceStoreId:"perek",distanceKm:0.6,lat:55.755,lon:37.615};
  if(apiName==="TDOnTheWay")api.setDestination({lat:55.77,lon:37.63,label:"Финиш"});
  api.forPoint(point);
  assert.equal(context.__lastReference,"perek",`${file} must keep the pre-selection comparison store`);

  context.__lastReference="sentinel";
  api.forPoint({...point,referenceStoreId:null});
  assert.equal(context.__lastReference,null,`${file} must not compare a selected chain against itself`);

  assert.equal(observers.length,1,`${file} should own one mutation observer`);
  const observer=observers[0],initialObserve=observer.observeCount;
  assert.ok(initialObserve>=1,`${file} should observe after initial boot`);
  for(const fn of listeners.get("pagehide")||[])fn({persisted:true});
  assert.ok(observer.disconnectCount>=1,`${file} should disconnect on pagehide`);
  for(const fn of listeners.get("pageshow")||[])fn({persisted:true});
  assert.ok(observer.observeCount>initialObserve,`${file} should resume after pageshow/BFCache`);
}

{
  const {context}=makeRuntime("worth-it.js");
  context.TDStoreIdBridge.basket=()=>{throw new Error("bridge down")};
  assert.equal(context.TDWorthIt.forPoint({chainId:"magnit",distanceKm:1}).state,"unknown","worth-it should fail closed when basket bridge throws");
}

{
  const {context}=makeRuntime("on-the-way.js");
  context.TDOnTheWay.setDestination({lat:55.77,lon:37.63});
  context.TDStoreIdBridge.basket=()=>{throw new Error("bridge down")};
  assert.equal(context.TDOnTheWay.forPoint({chainId:"magnit",lat:55.76,lon:37.62}).state,"unknown","on-the-way should fail closed when basket bridge throws");
  const hit=await context.TDOnTheWay.geocode("Москва");
  assert.ok(Number.isFinite(hit.lat)&&Number.isFinite(hit.lon),"geocode must normalize coordinates to finite numbers");
}

console.log("Route recommendation resilience passed: reference-store truthfulness, bridge fail-closed behavior, BFCache lifecycle and geocode normalization are guarded.");
