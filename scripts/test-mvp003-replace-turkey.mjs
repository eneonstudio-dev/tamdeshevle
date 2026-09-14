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
  {id:"chicken",name:"Филе куриное",pack:"1 кг",emoji:"🍗",prices:{pyat:379,perek:399}},
  {id:"turkey",name:"Филе индейки",pack:"1 кг",emoji:"🦃",prices:{pyat:499,perek:519}},
  {id:"bread",name:"Хлеб",pack:"1 шт",emoji:"🍞",prices:{pyat:70,perek:65}}
])};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const seeded=context.TDShoppingConversation.apply("fixture",[
  {type:"CHANGE_BUDGET",value:4000},
  {type:"SET_MODE",value:"one"},
  {type:"CHANGE_STORE",value:"pyat"},
  {type:"SET_ONLY_PRODUCTS",value:["chicken","bread"]},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"chicken",amount:2,unit:"pack"}},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"bread",amount:1,unit:"pack"}}
]);
assert.equal(seeded.ok,true);
assert.equal(seeded.state.quantityTargets.chicken.amount,2);
assert.equal(seeded.state.quantityTargets.bread.amount,1);

const parsed=context.TDShoppingConversation.parse("Замени курицу на индейку");
const replace=parsed.find(op=>op.type==="REPLACE_PRODUCT");
assert.ok(replace,"MVP-003: canonical replace request must emit REPLACE_PRODUCT");
assert.equal(replace.value.from,"chicken");
assert.equal(replace.value.to,"turkey");
assert.equal(parsed.some(op=>op.type==="NOTE"),false,"recognized replacement must not fall through to NOTE");

const result=context.TDShoppingConversation.apply("Замени курицу на индейку");
assert.equal(result.ok,true);
assert.equal(result.state.requiredProducts.includes("chicken"),false,"old product must leave required basket");
assert.equal(result.state.requiredProducts.includes("turkey"),true,"replacement must enter required basket");
assert.equal(result.state.requiredProducts.includes("bread"),true,"unrelated product must remain");
assert.equal(result.state.quantityTargets.chicken,undefined,"old quantity target must be removed");
assert.equal(result.state.quantityTargets.turkey.amount,2,"replacement must inherit explicit quantity");
assert.equal(result.state.quantityTargets.turkey.unit,"pack");
assert.equal(result.state.quantityTargets.bread.amount,1,"unrelated quantity must remain");
assert.ok(result.plans[0]?.products.some(line=>(line.sourceId||line.id)==="turkey"),"PurchasePlan must contain replacement product");
assert.ok(result.plans[0]?.products.some(line=>(line.sourceId||line.id)==="bread"),"PurchasePlan must preserve unrelated basket line");
assert.equal(result.state.currentTotal,result.plans[0].total,"state total must remain synchronized with replacement plan");

console.log("MVP-003 replacement regression passed: chicken -> turkey preserves quantity and unrelated basket state.");
