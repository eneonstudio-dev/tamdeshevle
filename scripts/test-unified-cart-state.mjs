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

context.setQty("milk",-3);
context.setQty("bread",-2);
rich=context.TDShoppingState.get();
assert.equal(Object.keys(context.state.cart).length,0,"manual UI must be able to clear the shared cart");
assert.equal(rich.products.length,0,"clearing manual cart must clear Bay products too");
assert.equal(rich.requiredProducts.length,0);
assert.equal(rich.onlyProducts.length,0);
assert.equal(Object.keys(rich.quantityTargets).length,0);
assert.equal(rich.budget,2500,"clearing products must still preserve decision preferences/context");

const life=fs.readFileSync("bai-life.js","utf8");
assert.match(life,/unified-cart-state-v1\.js\?v=/,"Bay lifecycle must load the unified cart bridge in production");
const bridge=fs.readFileSync("unified-cart-state-v1.js","utf8");
assert.doesNotMatch(bridge,/Там дешевле|Тамдешевле|Проще/,"unified cart bridge must not restore a legacy master brand");

console.log("Unified cart state passed: manual UI and Bay share exact products/quantities without losing context, stale plans or creating feedback loops.");
