import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read=path=>fs.readFileSync(path,"utf8");
const shell=read("v2-shell.js");
const dock=read("v2-mobile-dock.js");
const bayCss=read("votonobay-bay-first.css");
const runtime=read("runtime-bridge.js");
const decision=read("votonobay-decision-handoff-v1.js");
const continueStores=read("continue-in-stores-v1.js");
const overlay=read("overlay-history-v1.js");
const androidCss=read("android-viewport-fix.css");

// 1) Home must remain Bay-first while self-service stays available.
assert.match(shell,/data-bay-first="true"/,"mobile Home must render the native Bay-first hero");
assert.match(shell,/onclick="tdBayFirstAsk\(\)"[^>]*>Спросить Бая|>Спросить Бая<\/button>/,"Home must expose Bay as the primary action");
assert.match(shell,/Искать самому/,"self-service search must remain available next to Bay");
assert.match(shell,/data-action="bai"|<span>Бай<\/span>/,"mobile navigation must keep a dedicated Bay action");
assert.match(shell,/window\.TDShoppingAssistant\?\.open|TDShoppingAssistant/,"Bay-first entry must target the real shopping assistant");

// 2) The canonical mobile dock must keep Bay second and route state must not be hard-coded.
assert.match(dock,/const ROUTES=\["home",null,"catalog","cart","profile"\]/,"mobile dock order must be Home → Bay → Search → List → Profile");
assert.match(dock,/data-action="bai"/,"fallback dock must expose Bay as an action rather than a fake route");
assert.match(dock,/tdBayFirstAsk/,"mobile Bay dock action must open Bay-first assistant");
assert.match(dock,/button\.dataset\.screen===screen/,"active dock state must follow the actual route");
assert.doesNotMatch(dock,/data-screen="stores"/,"legacy Map slot must not replace Bay in the mobile dock");

// 3) Keyboard/visual-viewport behavior: one runtime variable owns the real visible height.
assert.match(runtime,/visualViewport/,"runtime must observe the mobile visual viewport");
assert.match(runtime,/--td-vvh/,"runtime must publish the canonical visual viewport variable");
assert.match(runtime,/data-td-keyboard-open/,"runtime must publish keyboard-open state");
assert.match(bayCss,/height:min\(82dvh,var\(--td-vvh,82dvh\)\)/,"mobile Bay sheet must use the real visual viewport");
assert.match(bayCss,/body\[data-td-keyboard-open\] \.td-ai\{height:var\(--td-vvh,100dvh\)/,"keyboard-open Bay sheet must expand only inside the visible viewport");
assert.doesNotMatch(bayCss,/td-ai-vvh/,"Bay sheet must not depend on a dead viewport variable");
assert.match(androidCss,/data-td-keyboard-open/,"Android layout must react to keyboard state");

// 4) A finished Bay decision must expose an honest next step and preserve offline safety.
assert.match(decision,/План готов — можно переходить к покупке/,"Bay result must end with a purchase-ready conclusion");
assert.match(decision,/Продолжить в \$\{ids\.length\} магазинах/,"multi-store Bay result must expose the guided handoff CTA");
assert.match(decision,/navigator\.onLine===false/,"retailer handoff must fail closed while offline");
assert.match(decision,/TDContinueInStoresV1\?\.open\?\.\(best\)/,"Bay must pass the exact recommended plan into guided store handoff");
assert.match(decision,/Ничего не считаю добавленным без твоего подтверждения/,"Bay must not claim automatic retailer cart mutation");

// Execute the handoff API: offline must not open a store, online must open the guided flow.
class CustomEventMock{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const events=[];
let opened=0;
const onlineState={onLine:false};
const best={quality:"VERIFIED",products:[{id:"milk",name:"Молоко",storeId:"pyat",quantity:1,price:100},{id:"bread",name:"Хлеб",storeId:"magnit",quantity:1,price:80}]};
const fakeDocument={
  hidden:false,
  head:{appendChild(){}},
  addEventListener(){},
  querySelector(){return null},
  querySelectorAll(){return[]},
  createElement(tag){return{tagName:String(tag).toUpperCase(),dataset:{},style:{},setAttribute(){},append(){},insertAdjacentElement(){},remove(){}}}
};
const context={
  console,
  CustomEvent:CustomEventMock,
  navigator:onlineState,
  document:fakeDocument,
  requestAnimationFrame(fn){fn();return 1},
  cancelAnimationFrame(){},
  setInterval(){return 1},
  clearInterval(){},
  setTimeout,
  clearTimeout
};
context.window={
  TDShoppingState:{get:()=>({lastPlans:[best]})},
  TDContinueInStoresV1:{open:async plan=>{assert.equal(plan,best,"handoff must receive the exact Bay plan");opened+=1;return true}},
  TDShoppingAssistant:{open(){},submit(){},applyStrategy(){},refresh(){},newSession(){}},
  TDBai:{setState(){}},
  addEventListener(){},
  dispatchEvent(event){events.push(event);return true}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(decision,context,{filename:"votonobay-decision-handoff-v1.js"});
const api=context.window.TDVotonobayDecisionHandoffV1;
assert.ok(api,"decision handoff API must install");
const status={textContent:""},button={disabled:false};
assert.equal(await api.continuePlan(best,status,button),false,"offline handoff must fail closed");
assert.equal(opened,0,"offline handoff must not open retailer flow");
assert.match(status.textContent,/офлайн/i,"offline handoff must explain why it stopped");
assert.ok(events.some(event=>event.type==="td:bai-handoff-blocked"&&event.detail?.reason==="offline"),"offline reason must be observable");

onlineState.onLine=true;
assert.equal(await api.continuePlan(best,status,button),true,"online handoff must continue into guided stores");
assert.equal(opened,1,"online handoff must open exactly once");
assert.match(status.textContent,/официальный путь по магазинам/i,"online handoff must explain the next step");
assert.ok(events.some(event=>event.type==="td:bai-handoff-opened"),"successful handoff must emit completion telemetry");

// 5) Guided stores and browser Back must stay truthful and mobile-safe.
assert.match(continueStores,/role="dialog"/i,"guided store flow must be an accessible dialog");
assert.match(continueStores,/aria-modal="true"/i,"guided store flow must be modal");
assert.match(continueStores,/safe-area-inset-bottom/,"guided store flow must respect mobile safe area");
assert.match(continueStores,/Votonobay не читает корзину магазина/,"guided flow must state its retailer boundary plainly");
assert.match(continueStores,/Прогресс — только твоя отметка/,"guided flow must not fake retailer cart state");
assert.match(overlay,/selector:"\.td-ai"/,"browser Back stack must include the Bay sheet");
assert.match(overlay,/selector:"\.td-continue-stores"/,"browser Back stack must include guided stores");
assert.match(overlay,/selector:"\.td-retailer-handoff"/,"browser Back stack must include retailer detail handoff");
assert.match(overlay,/window\.addEventListener\("popstate"/,"mobile Back must close the active overlay before leaving the journey");

console.log("Mobile Bay-first E2E passed: Home → Bay → decision → honest store handoff is keyboard-safe, offline-safe and Back-safe.");
