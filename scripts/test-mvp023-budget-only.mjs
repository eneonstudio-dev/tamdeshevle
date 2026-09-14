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
  {id:"pasta",name:"Макароны",pack:"450 г",emoji:"🍝",prices:{pyat:75,perek:80}},
  {id:"bread",name:"Хлеб",pack:"1 шт",emoji:"🍞",prices:{pyat:70,perek:65}}
])};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const seeded=context.TDShoppingConversation.apply("fixture",[
  {type:"CHANGE_BUDGET",value:5000},
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
const before=seeded.state;

const parsed=context.TDShoppingConversation.parse("Бюджет теперь 4000");
const budgetOps=parsed.filter(op=>op.type==="CHANGE_BUDGET");
assert.equal(budgetOps.length,1,"MVP-023: canonical wording must emit exactly one budget change");
assert.equal(budgetOps[0].value,4000);
assert.equal(parsed.some(op=>op.type==="NOTE"),false,"recognized budget update must not fall through to NOTE");
const allowed=new Set(["CHANGE_BUDGET","REOPTIMIZE"]);
assert.equal(parsed.every(op=>allowed.has(op.type)),true,"budget update must not mutate unrelated dimensions");

const result=context.TDShoppingConversation.apply("Бюджет теперь 4000");
assert.equal(result.ok,true);
const after=result.state;
assert.equal(after.budget,4000);
assert.equal(after.peopleCount,before.peopleCount);
assert.equal(after.duration,before.duration);
assert.equal(after.mode,before.mode);
assert.equal(after.selectionMode,before.selectionMode);
assert.equal(after.stores.join(","),before.stores.join(","));
assert.equal(after.onlyProducts.join(","),before.onlyProducts.join(","));
assert.equal(after.requiredProducts.join(","),before.requiredProducts.join(","));
assert.equal(after.excludedBrands.join(","),before.excludedBrands.join(","));
assert.equal(after.quantityTargets.pasta.amount,2);
assert.equal(after.quantityTargets.pasta.unit,"pack");
assert.equal(after.quantityTargets.bread.amount,1);
assert.equal(after.quantityTargets.bread.unit,"pack");
assert.ok(Array.isArray(result.plans)&&result.plans.length>0,"budget change must re-evaluate a PurchasePlan");
assert.equal(after.currentTotal,result.plans[0].total,"state total must match the re-optimized selected plan");

console.log("MVP-023 budget regression passed: canonical 'Бюджет теперь 4000' changes only budget and re-evaluates the same constrained basket.");
