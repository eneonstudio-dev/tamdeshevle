import fs from "node:fs";
import vm from "node:vm";

const productUI=fs.readFileSync("product-ui.js","utf8");
const polish=fs.readFileSync("v2-polish.js","utf8");
const purchaseLifecycle=fs.readFileSync("purchase-experience-lifecycle-v1.js","utf8");
const profileBasket=fs.readFileSync("profile-basket.js","utf8");

function assert(condition,message){if(!condition)throw new Error(message);}

new Function(productUI);
new Function(polish);
new Function(purchaseLifecycle);
new Function(profileBasket);

assert(productUI.includes('window.addEventListener("pagehide",pause)'),"product UI must pause on every pagehide");
assert(productUI.includes('window.addEventListener("pageshow",resume)'),"product UI must resume after BFCache restore");
assert(!productUI.includes('pagehide",pause,{once:true}'),"product UI cleanup must not disappear after the first navigation");
assert(productUI.includes('window.addEventListener("online",retryImages)'),"product imagery must retry after connectivity returns");
assert(productUI.includes("delete card.dataset.productUiSignature"),"card image retry must invalidate decoration signature");
assert(productUI.includes("delete img.dataset.tdPreparedSource"),"tile image retry must invalidate prepared source signature");

assert(polish.includes('window.addEventListener("pageshow",hydrate)'),"V2 polish must rehydrate after BFCache restore");
assert(polish.includes('window.addEventListener("pagehide",()=>{'),"V2 polish must clean up pending animation work on pagehide");
assert(!polish.includes('}, {once:true})')&&!polish.includes('},{once:true})'),"V2 pagehide cleanup must remain active across repeated navigation cycles");
assert(polish.includes("cancelAnimationFrame(headerScrollFrame)"),"V2 polish must cancel pending scroll animation work when hidden or leaving");
assert(polish.includes('purchase-experience-lifecycle-v1.js'),"V2 polish must load the purchase lifecycle guard with the purchase experience");

assert(purchaseLifecycle.includes('window.addEventListener("pagehide",stop)'),"purchase lifecycle must disconnect its observer on every pagehide");
assert(purchaseLifecycle.includes('window.addEventListener("pageshow",start)'),"purchase lifecycle must reconnect after BFCache restore");
assert(!purchaseLifecycle.includes('once:true'),"purchase lifecycle recovery must survive repeated navigation cycles");
assert(purchaseLifecycle.includes('observer.observe(root,{childList:true,subtree:true})'),"purchase lifecycle must resume observing dynamically mounted comparison and handoff UI");
assert(purchaseLifecycle.includes('window.TDPurchaseExperienceV1?.hydrate?.()'),"purchase lifecycle must immediately rehydrate current UI after returning");

function profileContext({failWrites=false}={}){
  const data=new Map();let writes=0;
  const localStorage={
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>{writes+=1;if(failWrites)throw new Error("quota");data.set(key,String(value));}
  };
  const state={screen:"home",city:"msk",storeId:"pyat",cart:{milk:2}};
  const PRODUCTS=[{id:"milk"}];
  const STORES=[{id:"pyat",short:"Пятёрочка"}];
  const TDCompare={
    defaultChannel:()=>"shelf",
    basketQuote:()=>({verifiedComplete:true,goods:100}),
    feeQuote:()=>({known:true,value:0})
  };
  const document={
    readyState:"loading",activeElement:null,body:{style:{overflow:""}},head:{appendChild(){}},
    addEventListener(){},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},
    createElement(){return{style:{},setAttribute(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return[];},remove(){},focus(){},appendChild(){},innerHTML:"",className:"",tabIndex:0};}
  };
  class MutationObserver{observe(){}disconnect(){}}
  class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
  const window={state,TDCompare,addEventListener(){},dispatchEvent(){return true;}};
  const context=vm.createContext({window,document,localStorage,state,PRODUCTS,STORES,TDCompare,MutationObserver,CustomEvent,requestAnimationFrame:fn=>fn(),console:{...console,warn(){}},Date,Math,Number,String,JSON,Object,Array,Set,Map});
  vm.runInContext(profileBasket,context,{filename:"profile-basket.js"});
  return{api:window.TDProfileBasket,data,get writes(){return writes;}};
}

{
  const ctx=profileContext();
  const first=ctx.api.snapshot();
  const writesAfterFirst=ctx.writes;
  const second=ctx.api.snapshot();
  assert(first&&first.verified===true,"verified basket snapshot must persist");
  assert(second&&second.date===first.date,"unchanged same-day snapshot must reuse persisted history");
  assert(ctx.writes===writesAfterFirst,"unchanged same-day snapshot must not churn localStorage");
  const saved=ctx.api.saveProfile({name:"Тест"});
  assert(saved?.name==="Тест","profile save must report success only after persistence");
}

{
  const ctx=profileContext({failWrites:true});
  assert(ctx.api.snapshot()===null,"failed history persistence must not return a fake saved snapshot");
  assert(ctx.api.history().length===0,"failed history persistence must not appear in history");
  assert(ctx.api.saveProfile({name:"Не сохранится"})===null,"failed profile persistence must be observable to the UI");
  assert(ctx.api.storageFault===true,"profile module must expose current storage failure state");
}

assert(profileBasket.includes('setAttribute("role","dialog")')&&profileBasket.includes('setAttribute("aria-modal","true")'),"profile overlay must be an accessible modal dialog");
assert(profileBasket.includes('event.key==="Escape"')&&profileBasket.includes("trapTab(event,sheet)"),"profile dialog must support Escape and trap focus");
assert(profileBasket.includes('document.body.style.overflow="hidden"')&&profileBasket.includes("safeFocus(profileOpener)"),"profile dialog must lock the background and restore opener focus");
assert(profileBasket.includes('window.addEventListener("pagehide",()=>closeProfile({restore:false}))'),"profile overlay must release page state on pagehide");
assert(profileBasket.includes("if(!writeJson(HISTORY_KEY,next.slice(-MAX_HISTORY)))return null"),"history persistence failure must fail closed");

assert(!productUI.includes("TDBai")&&!productUI.includes("bai-"),"product lifecycle recovery must remain independent from Bai");
assert(!polish.includes("TDBai")&&!polish.includes("bai-"),"V2 lifecycle cleanup must remain independent from Bai");
assert(!purchaseLifecycle.includes("TDBai")&&!purchaseLifecycle.includes("bai-"),"purchase lifecycle recovery must remain independent from Bay internals");
assert(!profileBasket.includes("TDBai")&&!profileBasket.includes("bai-"),"profile resilience must remain independent from Bai");

console.log("UI lifecycle resilience passed: product visuals, V2 polish, purchase handoff and profile persistence recover safely across storage failures, repeated navigation and connectivity changes.");
