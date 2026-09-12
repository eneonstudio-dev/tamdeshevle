import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

class FakeElement {}
class FakeMutationObserver { constructor(cb){this.cb=cb} observe(){} disconnect(){} }
const appended=[];
const document={
  documentElement:{},
  head:{appendChild(node){appended.push(node)}},
  querySelector(){return null},
  querySelectorAll(){return[]},
  createElement(){return{dataset:{},set rel(v){this._rel=v},set href(v){this._href=v}}},
  addEventListener(){}
};
const context={
  console,JSON,Math,Number,String,Object,Array,Set,Map,Date,
  setTimeout,clearTimeout,queueMicrotask,
  document,navigator:{onLine:true},MutationObserver:FakeMutationObserver,Element:FakeElement,
  CustomEvent:class{constructor(name,opts){this.type=name;this.detail=opts?.detail}},
  addEventListener(){},dispatchEvent(){return true}
};
context.window=context;
context.TDShoppingState={get:()=>({lastPlans:[]})};
vm.createContext(context);
vm.runInContext(fs.readFileSync("purchase-experience-v1.js","utf8"),context,{filename:"purchase-experience-v1.js"});

const api=context.TDPurchaseExperienceV1;
assert.ok(api,"purchase experience must boot without Bay");
assert.equal(api.decisionForPlan(null).action,"none");
assert.equal(api.decisionForPlan({products:[{storeId:"pyat",quantity:2}]},{online:false}).action,"offline","offline choice must stay saved instead of pretending to open a store");
const one=api.decisionForPlan({products:[{storeId:"pyat",quantity:2}]},{online:true});
assert.equal(one.action,"handoff");
assert.deepEqual(Array.from(one.stores),["pyat"]);
assert.equal(one.items,2);
const multi=api.decisionForPlan({products:[{storeId:"pyat_msk",quantity:1},{storeId:"magnit",quantity:3},{storeId:"pyat",quantity:1}]},{online:true});
assert.equal(multi.action,"handoff");
assert.deepEqual(Array.from(multi.stores),["pyat","magnit"],"regional store ids must collapse to the retailer for handoff");
assert.equal(multi.items,5);
assert.match(multi.label,/2 магазина/);

const source=fs.readFileSync("purchase-experience-v1.js","utf8");
const polish=fs.readFileSync("v2-polish.js","utf8");
const css=fs.readFileSync("purchase-experience-v1.css","utf8");
assert.match(polish,/purchase-experience-v1\.js\?v=/,"generic V2 lifecycle must load the purchase experience");
assert.doesNotMatch(source,/TDBai|bai-/i,"purchase journey must stay usable without Bay");
assert.match(source,/Как лучше собрать эту корзину/);
assert.match(source,/Выбрать и продолжить/);
assert.match(source,/финальные наличие и сумма подтверждаются магазином/);
assert.match(source,/TDContinueInStoresV1/,"chosen plans must continue through the truthful retailer handoff");
assert.match(css,/\.td-continue-stores-card/);
assert.match(css,/--td-purchase-mint/);
assert.ok(appended.some(x=>String(x._href||"").includes("purchase-experience-v1.css")),"purchase CSS must load with the runtime layer");

console.log("Votonobay purchase experience passed: decision → trust → chosen plan → truthful store handoff works without Bay and stays offline-safe.");
