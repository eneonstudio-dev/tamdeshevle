import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const sessionKey="td:shopping-session:v1";
const storage=new Map([[sessionKey,JSON.stringify({
  budget:2500,peopleCount:4,preferences:["быстро"],products:[],lastPlans:[{id:"stale"}],history:[]
})]]);
const events=[];
const listeners=new Map();
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date};
context.window=context;
context.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,String(value))
};
context.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}};
context.addEventListener=(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list)};
context.dispatchEvent=event=>{events.push(event);for(const fn of listeners.get(event.type)||[])fn(event);return true};
context.state={city:"msk",storeId:"pyat",cart:{milk:2},cartTouched:true};
context.PRODUCTS=[
  {id:"milk",name:"Молоко",pack:"1 л",emoji:"🥛"},
  {id:"bread",name:"Хлеб",pack:"650 г",emoji:"🍞"}
];
context.TDStoreAdapters={
  catalog:()=>context.PRODUCTS,
  adapter:storeId=>({getPrice:id=>({value:id==="milk"?100:60,quality:"ESTIMATED",storeId})})
};
let renders=0,assistantRefreshes=0;
context.render=()=>{renders+=1};
context.TDShoppingAssistant={refresh:()=>{assistantRefreshes+=1}};
context.setQty=(id,delta)=>{
  const next=Math.max(0,Math.min(99,(Number(context.state.cart[id])||0)+Number(delta||0)));
  if(next===0)delete context.state.cart[id];else context.state.cart[id]=next;
  context.state.cartTouched=true;
  return true;
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("shopping-state.js","utf8"),context,{filename:"shopping-state.js"});
vm.runInContext(fs.readFileSync("unified-cart-state-v1.js","utf8"),context,{filename:"unified-cart-state-v1.js"});

let rich=context.TDShoppingState.get();
assert.equal(rich.products.length,1,"existing manual cart must hydrate Bay state on boot");
assert.equal(rich.products[0].sourceId,"milk");
assert.equal(rich.products[0].quantity,2,"manual quantity must remain exact");
assert.equal(rich.selectionMode,"only","manual cart must become an exact product scope");
assert.equal(rich.intent,"manual");
assert.equal(rich.quantityTargets.milk.amount,2);
assert.equal(rich.quantityTargets.milk.unit,"pack");
assert.equal(rich.budget,2500,"manual hydration must preserve Bay budget context");
assert.equal(rich.peopleCount,4,"manual hydration must preserve people context");
assert.equal(rich.preferences.includes("быстро"),true,"manual hydration must preserve preferences");
assert.equal(rich.lastPlans.length,0,"manual hydration must invalidate stale decisions");
assert.equal(rich.history.length,0,"boot reconciliation must not create undo noise");
assert.equal(rich.currentTotal,200,"known selected-store prices may update the local estimate without changing quantities");

context.TDShoppingState.commit("TEST_PLAN",state=>{state.lastPlans=[{id:"old-plan"}]},"test plan");
const historyBeforeManual=context.TDShoppingState.get().history.length;
context.setQty("bread",1);
rich=context.TDShoppingState.get();
assert.equal(rich.products.length,2,"manual add must immediately reach Bay state");
assert.equal(rich.products.find(line=>line.sourceId==="bread")?.quantity,1);
assert.equal(rich.quantityTargets.bread.amount,1);
assert.equal(rich.lastPlans.length,0,"any real manual edit must invalidate Bay's previous plan");
assert.equal(rich.history.length,historyBeforeManual+1,"manual user edits must remain undoable");
assert.equal(rich.budget,2500,"manual edits must not discard budget context");
assert.ok(assistantRefreshes>=1,"open Bay UI must be refreshable after manual edits");
assert.ok(events.some(event=>event.type==="td:unified-cart"&&event.detail?.source==="manual"),"manual reconciliation must publish one shared cart event");

context.TDShoppingState.commit("BAY_REBUILD",state=>{
  state.products=[
    {id:"milk",sourceId:"milk",name:"Молоко",pack:"1 л",quantity:3,storeId:"pyat",price:100,unitPrice:100,quality:"ESTIMATED"},
    {id:"bread",sourceId:"bread",name:"Хлеб",pack:"650 г",quantity:2,storeId:"pyat",price:60,unitPrice:60,quality:"ESTIMATED"}
  ];
},"Bay rebuild");
assert.equal(context.TDShoppingState.syncCart(),true);
assert.equal(context.state.cart.milk,3,"Bay quantity must flow back to the ordinary cart");
assert.equal(context.state.cart.bread,2,"Bay product additions must flow back to the ordinary cart");
assert.equal(context.state.cartTouched,true);
assert.ok(renders>=1,"Bay-to-manual sync must refresh the ordinary UI");
assert.ok(events.some(event=>event.type==="td:unified-cart"&&event.detail?.source==="bai"),"Bay reconciliation must publish the same shared cart event");
assert.equal(context.TDShoppingState.syncFromCart(context.state.cart).changed,false,"an already synchronized cart must be a no-op instead of creating a feedback loop");

const freshPlan={
  id:"fresh-plan",type:"one",total:420,
  products:[
    {id:"milk",sourceId:"milk",storeId:"pyat",price:100,quantity:3},
    {id:"bread",sourceId:"bread",storeId:"pyat",price:60,quantity:2}
  ]
};
const staleQuantityPlan={...freshPlan,id:"stale-qty",products:[
  {...freshPlan.products[0],quantity:2},
  {...freshPlan.products[1]}
]};
assert.equal(context.TDShoppingState.planMatchesProducts(freshPlan,context.TDShoppingState.get().products),true,"fresh plan must match the exact canonical basket signature");
assert.equal(context.TDShoppingState.planMatchesProducts(staleQuantityPlan,context.TDShoppingState.get().products),false,"same SKUs with an old quantity must be stale");
context.TDShoppingState.commit("FRESH_PLAN",state=>{state.lastPlans=[freshPlan]},"fresh plan");
assert.equal(context.TDShoppingState.currentPlans().length,1,"a plan for the exact current quantities must stay actionable");
context.TDShoppingState.get().lastPlans=[staleQuantityPlan];
assert.equal(context.TDShoppingState.get().lastPlans.length,0,"canonical get must fail closed if a stale quantity plan is injected without a normal cart event");
context.TDShoppingState.commit("RESTORE_FRESH_PLAN",state=>{state.lastPlans=[freshPlan]},"restore fresh plan");
assert.equal(context.TDShoppingState.get().lastPlans[0]?.id,"fresh-plan","fresh plan must remain available after canonical validation");

context.setQty("milk",-3);
context.setQty("bread",-2);
rich=context.TDShoppingState.get();
assert.equal(Object.keys(context.state.cart).length,0,"manual UI must be able to clear the shared cart");
assert.equal(rich.products.length,0,"clearing manual cart must clear Bay products too");
assert.equal(rich.requiredProducts.length,0);
assert.equal(rich.onlyProducts.length,0);
assert.equal(Object.keys(rich.quantityTargets).length,0);
assert.equal(rich.lastPlans.length,0,"an empty canonical basket must never retain a purchase plan");
assert.equal(rich.budget,2500,"clearing products must still preserve decision preferences/context");

{
  const handoffSource=fs.readFileSync("votonobay-decision-handoff-v1.js","utf8");
  const handoffEvents=[];
  const opened=[];
  const current={
    products:[
      {id:"milk",sourceId:"milk",storeId:"pyat",price:100,quantity:2},
      {id:"bread",sourceId:"bread",storeId:"pyat",price:60,quantity:1}
    ],
    lastPlans:[]
  };
  const currentPlan={
    id:"one-pyat",type:"one",total:260,
    products:[
      {id:"milk",sourceId:"milk",storeId:"pyat",price:100,quantity:2},
      {id:"bread",sourceId:"bread",storeId:"pyat",price:60,quantity:1}
    ]
  };
  current.lastPlans=[currentPlan];
  const productSignature=products=>{
    const map={};
    for(const line of Array.isArray(products)?products:[]){const id=line?.sourceId||line?.id,qty=Math.min(99,Math.max(0,Math.floor(Number(line?.quantity)||0)));if(id&&qty)map[id]=(map[id]||0)+qty;}
    return Object.entries(map).sort(([a],[b])=>a.localeCompare(b)).map(([id,qty])=>`${id}:${qty}`).join("|");
  };
  const hWindow={
    __TDVotonobayDecisionHandoffV1:false,
    TDShoppingState:{
      get:()=>current,
      productSignature,
      planMatchesProducts:(plan,products)=>Boolean(productSignature(plan?.products)&&productSignature(plan?.products)===productSignature(products))
    },
    TDContinueInStoresV1:{open:async plan=>{opened.push(plan);return true}},
    TDBai:{setState(){}},
    addEventListener(){},
    dispatchEvent:event=>{handoffEvents.push(event);return true}
  };
  const hDocument={
    hidden:false,
    head:{appendChild(){}},
    body:{appendChild(){}},
    addEventListener(){},
    querySelector(selector){if(selector.startsWith("style["))return null;return null},
    querySelectorAll(){return[]},
    createElement(){return{dataset:{},style:{},setAttribute(){},append(){},appendChild(){},remove(){},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},insertAdjacentElement(){},innerHTML:"",textContent:""}}
  };
  class HCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
  const hContext=vm.createContext({
    window:hWindow,document:hDocument,navigator:{onLine:true},CustomEvent:HCustomEvent,console,JSON,Math,Number,String,Object,Array,Set,Map,Promise,
    requestAnimationFrame:fn=>{fn();return 1},cancelAnimationFrame(){},setInterval:()=>1,clearInterval(){}
  });
  vm.runInContext(handoffSource,hContext,{filename:"votonobay-decision-handoff-v1.js"});
  const handoff=hWindow.TDVotonobayDecisionHandoffV1;
  assert.equal(handoff.plan(),currentPlan,"handoff may expose the plan only while it matches the current canonical basket");

  current.products[0].quantity=3;
  assert.equal(handoff.plan(),null,"handoff must hide a plan immediately when the current quantity changes");
  current.products[0].quantity=2;

  const raceStatus={textContent:""},raceButton={disabled:false};
  const pending=handoff.continuePlan(currentPlan,raceStatus,raceButton);
  current.products[0].quantity=3;
  assert.equal(await pending,false,"handoff must revalidate after its async boundary and block a plan changed during the click");
  assert.equal(opened.length,0,"stale captured plan must never reach continue-in-stores");
  assert.ok(handoffEvents.some(event=>event.type==="td:bai-handoff-blocked"&&event.detail?.reason==="stale_plan"),"stale handoff block must be observable");
  assert.match(raceStatus.textContent,/Корзина изменилась/,"stale handoff must explain why it refused to continue");
  current.products[0].quantity=2;

  const freshStatus={textContent:""},freshButton={disabled:false};
  assert.equal(await handoff.continuePlan(currentPlan,freshStatus,freshButton),true,"exact current plan must still open the retailer handoff");
  assert.equal(opened.length,1,"fresh plan must open exactly once");
  assert.equal(opened[0],currentPlan,"handoff must pass the freshly revalidated current plan, not a stale replacement");

  const recalculated={...currentPlan,total:250,products:currentPlan.products.map(line=>({...line,price:line.id==="milk"?95:60}))};
  current.lastPlans=[recalculated];
  assert.equal(await handoff.continuePlan(currentPlan,{textContent:""},{disabled:false}),false,"captured plan must be rejected when a newer calculation replaced it even with the same quantities");
  assert.equal(opened.length,1,"old-price closure must not open after a recalculation");
}

const life=fs.readFileSync("bai-life.js","utf8");
assert.match(life,/unified-cart-state-v1\.js\?v=/,"Bay lifecycle must load the unified cart bridge in production");
const bridge=fs.readFileSync("unified-cart-state-v1.js","utf8");
assert.doesNotMatch(bridge,/Там дешевле|Тамдешевле|Проще/,"unified cart bridge must not restore a legacy master brand");

console.log("Unified cart state passed: manual UI, Bay, comparison and retailer handoff share exact current products/quantities; stale plans and async click races fail closed without feedback loops.");
