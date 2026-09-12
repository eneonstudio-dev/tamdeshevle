import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const KEY="td:shopping-session:v1";
const storage=new Map([[KEY,JSON.stringify({
  stores:null,products:null,existingProducts:null,requiredProducts:null,preferredProducts:null,
  excludedProducts:null,excludedBrands:null,onlyProducts:null,preferences:null,userNotes:null,
  history:null,quantityTargets:null,peopleCount:0,duration:0,selectionMode:"broken",mode:"broken"
})]]);
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date};
context.window=context;
context.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
context.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}};
context.dispatchEvent=()=>{};
context.render=()=>{};
context.state={city:"msk",storeId:"pyat",cart:{},cartTouched:false};
context.STORES=[
  {id:"pyat",kind:"shop",city:["msk"]},
  {id:"magnit",kind:"shop",city:["msk"]},
  {id:"perek",kind:"shop",city:["msk"]},
  {id:"lavka",kind:"delivery",city:["msk"]}
];
context.PRODUCTS=[
  {id:"milk",name:"Молоко",pack:"1 л"},
  {id:"bread",name:"Хлеб",pack:"650 г"}
];
const catalog=[
  {id:"milk",name:"Молоко",pack:"1 л",tags:["молоко"],brand:""},
  {id:"bread",name:"Хлеб",pack:"650 г",tags:["хлеб"],brand:""}
];
const prices={
  pyat:{milk:100,bread:50},
  magnit:{milk:90,bread:60},
  perek:{milk:1,bread:1},
  lavka:{milk:80,bread:40}
};
context.TDStoreAdapters={
  catalog:()=>catalog,
  adapter:storeId=>({
    getProduct:id=>catalog.find(p=>p.id===id)||null,
    getPrice:id=>({value:prices[storeId]?.[id]??null,quality:"LIVE"})
  })
};
vm.createContext(context);
for(const file of ["shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const state=context.TDShoppingState.get();
for(const key of ["stores","products","existingProducts","requiredProducts","preferredProducts","excludedProducts","excludedBrands","onlyProducts","preferences","userNotes","history"]){
  assert.ok(Array.isArray(state[key]),`${key} must be normalized to an array`);
}
assert.deepEqual({...state.quantityTargets},{},"quantityTargets must recover from invalid persisted data");
assert.equal(state.peopleCount,1,"invalid peopleCount must normalize to 1");
assert.equal(state.duration,1,"invalid duration must normalize to 1");
assert.equal(state.selectionMode,"auto","invalid selection mode must normalize");
assert.equal(state.mode,"multi","invalid basket mode must normalize");

let parsed=context.TDShoppingConversation.parse("собери корзину на 3 дня");
assert.equal(parsed.some(op=>op.type==="SET_DURATION"&&op.value===3),true,"duration must be parsed");
assert.equal(parsed.some(op=>op.type==="SET_PEOPLE"),false,"duration-only request must not become a people count in fallback parser");

let result=context.TDShoppingConversation.apply("только молоко и хлеб в Пятёрочке и Магните, где дешевле",[
  {type:"CHANGE_STORE",value:"pyat"},
  {type:"CHANGE_STORE",value:"magnit"},
  {type:"SET_MODE",value:"multi"},
  {type:"SET_ONLY_PRODUCTS",value:["milk","bread"]}
]);
assert.deepEqual(Array.from(result.state.stores),["pyat","magnit"],"multiple requested stores must survive in shopping state");
const multi=result.plans.find(plan=>plan.type==="multi");
assert.ok(multi,"multi-store plan must be produced");
assert.equal(multi.products.some(line=>line.storeId==="perek"),false,"multi optimizer must not leak into an unrequested cheaper store");
assert.deepEqual(new Set(multi.products.map(line=>line.storeId)),new Set(["pyat","magnit"]),"multi plan must use only requested stores when both are useful");

result=context.TDShoppingConversation.apply("только Перекрёсток",[
  {type:"CHANGE_STORE",value:"perek"},
  {type:"SET_MODE",value:"one"},
  {type:"SET_ONLY_PRODUCTS",value:["milk"]}
]);
assert.deepEqual(Array.from(result.state.stores),["perek"],"a later single-store command must replace the previous store scope");
assert.equal(result.plans[0].stores[0],"perek","one-store plan must follow the selected store");

context.TDShoppingConversation.apply("убери молоко",[{type:"REMOVE_PRODUCT",value:"milk"}]);
result=context.TDShoppingConversation.apply("добавь молоко обратно",[{type:"REQUIRE",value:"milk"}]);
assert.equal(result.state.excludedProducts.includes("milk"),false,"requiring a product again must clear a stale exclusion");
assert.equal(result.state.requiredProducts.includes("milk"),true,"re-required product must return to requiredProducts");

console.log("Shopping state consistency passed: persisted-state recovery, duration parsing, selected-store scope and re-require behavior.");
