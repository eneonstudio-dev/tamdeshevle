import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const journeySource=fs.readFileSync("first-shopping-journey.js","utf8");
const purchaseSource=fs.readFileSync("purchase-flow.js","utf8");
const indexSource=fs.readFileSync("index.html","utf8");
new Function(journeySource);
new Function(purchaseSource);

assert.equal(journeySource.includes("TDBai"),false,"first shopping journey must stay independent from Bai");
assert.equal(purchaseSource.includes("TDBai"),false,"retailer handoff must not depend on Bai feedback");
assert.ok(indexSource.includes('first-shopping-journey.js?v=20260912-v1'),"journey layer must be loaded by the app");
assert.ok(indexSource.indexOf("purchase-flow.js")<indexSource.indexOf("first-shopping-journey.js"),"journey must load after purchase handoff API");
assert.match(journeySource,/Без фальшивых 0 ₽/,"empty home must never advertise a fake zero total");
assert.match(journeySource,/Сравнить эту корзину/,"cart CTA must describe the exact next action");
assert.match(journeySource,/Изменить магазин/,"cart secondary CTA must not pretend to keep or place an order");
assert.match(journeySource,/Сайт сам заказ не оформляет/,"comparison CTA must explicitly avoid fake order semantics");

class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}}
const events=[];const navigation=[];
const shelf={id:"pyat",name:"Пятёрочка",channel:"shelf",rankable:true,total:900,save:80,verifiedComplete:true,goods:900,delivery:0,feeKnown:true,time:"сходить"};
const bring={id:"pyat",name:"Пятёрочка",channel:"bring",rankable:true,total:990,save:0,verifiedComplete:true,goods:950,delivery:40,feeKnown:true,time:"40–60 мин"};
const context={console,CustomEvent,Number,Object,Array,String,Math,Date};
context.window={
  state:{cart:{milk:1},city:"msk",storeId:"magnit",mode:"any",openWhy:"x"},
  TDCompare:{fromWindow:()=>[shelf,bring]},
  go:screen=>navigation.push(screen),
  dispatchEvent:event=>{events.push(event);return true}
};
context.window.window=context.window;
vm.createContext(context);
vm.runInContext(journeySource,context,{filename:"first-shopping-journey.js"});
const api=context.window.TDFirstShoppingJourney;
assert.ok(api,"journey API must be exposed");
assert.equal(api.actionLabel(bring),'Перейти в «Пятёрочка»');
assert.equal(api.actionLabel(shelf),'Найти «Пятёрочка» рядом');
const unknownHint=api.safePlanHint({channel:"bring",goods:null,delivery:null,feeKnown:true,time:""});
assert.match(unknownHint,/цена товаров уточняется/);
assert.match(unknownHint,/доставка сети уточняется/);
assert.doesNotMatch(unknownHint,/null|NaN|undefined/);
assert.equal(api.choosePlan("pyat","shelf"),true,"exact shelf plan must be selectable");
assert.equal(context.window.state.storeId,"pyat");
assert.equal(context.window.state.mode,"walk","shelf handoff must keep shelf channel on the next screen");
assert.equal(navigation.at(-1),"catalog");
assert.ok(events.some(event=>event.type==="td:plan-selected"&&event.detail?.channel==="shelf"),"selected-plan telemetry must preserve the exact channel");

{
  let opens=0,eventsSeen=0;
  const valid={id:"magnit",name:"Магнит",channel:"bring",rankable:true,total:1200,save:100,verifiedComplete:true};
  const window={
    state:{cart:{milk:1}},
    TDCompare:{fromWindow:()=>[valid]},
    TDSavingsLedger:{record(){throw new Error("storage unavailable")}},
    dispatchEvent(){eventsSeen+=1;return true},
    open(){opens+=1}
  };
  const purchaseContext=vm.createContext({window,CustomEvent,Date,Number,Object,console});
  vm.runInContext(purchaseSource,purchaseContext,{filename:"purchase-flow.js"});
  assert.equal(window.TDPurchase.start("magnit","bring"),true,"ledger failure must not block retailer handoff");
  assert.equal(opens,1,"retailer must still open when local savings storage fails");
  assert.ok(eventsSeen>=1,"handoff event must still be emitted");
}

console.log("First shopping journey checks passed: empty state, truthful CTAs, exact channels and retailer handoff are resilient without Bai coupling.");
