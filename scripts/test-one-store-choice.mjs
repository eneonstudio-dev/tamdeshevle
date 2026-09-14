import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const storage=new Map();
const products=[
  {id:"milk",name:"Молоко",pack:"1 л",emoji:"🥛",brand:"",prices:{pyat:100,magnit:90,perek:80}},
  {id:"bread",name:"Хлеб",pack:"650 г",emoji:"🍞",brand:"",prices:{pyat:60,magnit:70,perek:55}}
];
const stores=[
  {id:"pyat",name:"Пятёрочка",city:["msk"],kind:"shop"},
  {id:"magnit",name:"Магнит",city:["msk"],kind:"shop"},
  {id:"perek",name:"Перекрёсток",city:["msk"],kind:"shop"}
];
const context={
  console,JSON,Math,Number,String,Object,Array,Set,Map,Date,RegExp,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)},
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},addEventListener(){},render(){}
};
context.window=context;
context.globalThis=context;
context.state={city:"msk",storeId:"pyat",cart:{},cartTouched:false};
vm.createContext(context);
vm.runInContext(`const STORES=${JSON.stringify(stores)}; const PRODUCTS=${JSON.stringify(products)};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const parsed=context.TDShoppingConversation.parse("Всё из одного магазина");
assert.ok(parsed.some(op=>op.type==="SET_MODE"&&op.value==="one"),"canonical MVP-005 wording must set one-store mode");

const result=context.TDShoppingConversation.apply("Всё из одного магазина",[
  {type:"SET_ONLY_PRODUCTS",value:["milk","bread"]},
  ...parsed
]);
assert.equal(result.ok,true);
assert.equal(context.TDShoppingState.get().mode,"one");
assert.equal(context.TDShoppingState.get().stores.length,0,"one-store request without named retailer must not invent a retailer allow-list");
assert.equal(result.plans.length,1,"one-store mode must expose one winning plan");
assert.equal(result.plans[0].stores.length,1);
assert.equal(result.plans[0].stores[0],"perek","optimizer must compare eligible single-store plans instead of pinning the current store");
assert.equal(result.plans[0].total,135);
assert.deepEqual(new Set(Array.from(result.plans[0].products,line=>String(line.id))),new Set(["milk","bread"]),"winning one-store plan must preserve the canonical basket");
assert.ok(result.plans[0].products.every(line=>line.storeId==="perek"),"every item in the one-store plan must come from the winning retailer");

console.log("one-store choice passed: canonical wording is parsed and the best eligible retailer wins without rebuilding the basket.");
