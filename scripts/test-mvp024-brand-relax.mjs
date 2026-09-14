import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const memory=new Map();
const context={
  console,Date,JSON,Math,Number,String,Object,Array,Set,Map,
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},
  localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
  dispatchEvent(){},addEventListener(){},render(){}
};
context.window=context;
context.state={city:"msk",storeId:"pyat",cart:{}};
vm.createContext(context);
vm.runInContext(`const STORES=${JSON.stringify([
  {id:"pyat",name:"Пятёрочка",city:["msk"],kind:"shop"},
  {id:"perek",name:"Перекрёсток",city:["msk"],kind:"shop"}
])}; const PRODUCTS=${JSON.stringify([
  {id:"pasta",name:"Макароны",pack:"450 г",emoji:"🍝",brand:"goodbrand",prices:{pyat:75,perek:80}},
  {id:"bread",name:"Хлеб",pack:"1 шт",emoji:"🍞",brand:"goodbrand",prices:{pyat:70,perek:65}}
])};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const seeded=context.TDShoppingConversation.apply("fixture",[
  {type:"CHANGE_BUDGET",value:4000},
  {type:"SET_PEOPLE",value:2},
  {type:"SET_DURATION",value:7},
  {type:"SET_MODE",value:"one"},
  {type:"CHANGE_STORE",value:"perek"},
  {type:"SET_ONLY_PRODUCTS",value:["pasta","bread"]},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"pasta",amount:2,unit:"pack"}},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"bread",amount:1,unit:"pack"}},
  {type:"EXCLUDE_BRAND",value:"badbrand"}
]);
assert.equal(seeded.ok,true);
assert.deepEqual([...seeded.state.excludedBrands],["badbrand"]);
const before=JSON.parse(JSON.stringify(seeded.state));

const parsed=context.TDShoppingConversation.parse("Бренды не важны");
assert.equal(parsed.some(op=>op.type==="CLEAR_BRAND_PREFERENCES"),true,"MVP-024: canonical phrase must explicitly relax brand constraints");
assert.equal(parsed.some(op=>op.type==="NOTE"),false,"recognized brand relaxation must not fall through to NOTE");
assert.equal(parsed.every(op=>["CLEAR_BRAND_PREFERENCES","REOPTIMIZE"].includes(op.type)),true,"brand relaxation must not mutate unrelated dimensions");

const result=context.TDShoppingConversation.apply("Бренды не важны");
assert.equal(result.ok,true);
const after=result.state;
assert.deepEqual([...after.excludedBrands],[],"brand exclusions must be cleared");
assert.equal(after.budget,before.budget);
assert.equal(after.peopleCount,before.peopleCount);
assert.equal(after.duration,before.duration);
assert.equal(after.mode,before.mode);
assert.equal(after.selectionMode,before.selectionMode);
assert.equal(after.stores.join(","),before.stores.join(","));
assert.equal(after.onlyProducts.join(","),before.onlyProducts.join(","));
assert.equal(after.requiredProducts.join(","),before.requiredProducts.join(","));
assert.equal(after.quantityTargets.pasta.amount,2);
assert.equal(after.quantityTargets.pasta.unit,"pack");
assert.equal(after.quantityTargets.bread.amount,1);
assert.equal(after.quantityTargets.bread.unit,"pack");
assert.ok(Array.isArray(result.plans)&&result.plans.length>0,"brand relaxation must re-evaluate the existing basket");
assert.equal(after.currentTotal,result.plans[0].total,"state total must stay synchronized with selected PurchasePlan");

console.log("MVP-024 brand relaxation regression passed: 'Бренды не важны' clears only brand constraints and re-evaluates the same basket.");
