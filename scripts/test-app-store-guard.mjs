import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync("app-store-guard.js","utf8");
const index=fs.readFileSync("index.html","utf8");
const storage=new Map([["td",JSON.stringify({storeId:"ghost",city:"msk",cart:{milk:1}})]]);
const events=[];
const calls={render:0,go:0,setQty:0,choose:0,toggle:0};
const state={storeId:"ghost",city:"msk",mode:"any"};
const rowsByCity={
  msk:[{id:"pyat",kind:"shop",rankable:true},{id:"magnit",kind:"shop",rankable:true},{id:"lavka",kind:"delivery",rankable:false}],
  spb:[{id:"perek",kind:"shop",rankable:true},{id:"lavka",kind:"delivery",rankable:false}]
};
const TDCompare={fromWindow(overrides={}){return rowsByCity[overrides.city||state.city].map(row=>({...row,same:row.id===(overrides.originStoreId??state.storeId)}));}};
const window={state,TDCompare,
  render(){calls.render++;return true;},
  go(){calls.go++;return true;},
  setQty(){calls.setQty++;return true;},
  choosePlan(){calls.choose++;return true;},
  toggleCity(){calls.toggle++;state.city=state.city==="msk"?"spb":"msk";return true;},
  dispatchEvent(event){events.push(event);},addEventListener(){}}
;
window.window=window;
const context=vm.createContext({window,state,TDCompare,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}},console});
vm.runInContext(source,context,{filename:"app-store-guard.js"});

assert.equal(state.storeId,"pyat","invalid runtime store must repair to an eligible physical store");
assert.equal(JSON.parse(storage.get("td")).storeId,"pyat","repaired store must persist without dropping the rest of saved state");
assert.equal(JSON.parse(storage.get("td")).cart.milk,1,"store repair must preserve saved cart data");
assert.equal(events.at(-1)?.type,"td:store-repaired");

state.storeId="ghost";window.setQty("milk",1);
assert.equal(state.storeId,"pyat","guarded quantity action must repair stale store before the app renders");
assert.equal(calls.setQty,1);

assert.equal(window.choosePlan("magnit"),true,"rankable store selection should pass through");
assert.equal(calls.choose,1);
assert.equal(window.choosePlan("lavka"),false,"unrankable store must be blocked before core choosePlan mutates state");
assert.equal(calls.choose,1,"blocked plan must not call the unsafe core selector");
assert.equal(events.at(-1)?.detail?.reason,"unrankable_store");

state.storeId="ghost";window.toggleCity();
assert.equal(state.city,"spb");
assert.equal(state.storeId,"perek","city switch must preselect a store valid in the destination city before core render runs");
assert.equal(calls.toggle,1);

state.storeId="ghost";window.render();
assert.equal(state.storeId,"perek");
assert.equal(calls.render,1);

const appIndex=index.indexOf('src="app.js');
const guardIndex=index.indexOf('src="app-store-guard.js');
const catalogIndex=index.indexOf('src="catalog-boot.js');
assert.ok(appIndex>=0,"production index must load core app runtime");
assert.ok(guardIndex>appIndex,"production index must load the store guard after app state exists");
assert.ok(catalogIndex<0||guardIndex<catalogIndex,"store guard must install before downstream catalog enhancers");
assert.doesNotMatch(source,/TDBai|bai:|\.td-ai|assets\/bai/,"store guard must remain independent from Bai");
console.log("App store guard passed: stale runtime store IDs repair before render/actions, the guard ships in production, city changes stay valid and unrankable plans fail closed.");
