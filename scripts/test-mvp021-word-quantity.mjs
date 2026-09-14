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
vm.runInContext(`const STORES=${JSON.stringify([{id:"pyat",name:"Пятёрочка",city:["msk"],kind:"shop"}])}; const PRODUCTS=${JSON.stringify([{id:"pasta",name:"Макароны",pack:"450 г",emoji:"🍝",prices:{pyat:75}}])};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const parsed=context.TDShoppingConversation.parse("Добавь две пачки макарон");
const amountOp=parsed.find(op=>op.type==="SET_PRODUCT_AMOUNT"&&op.value?.id==="pasta");
assert.ok(amountOp,"MVP-021: canonical word quantity must produce an explicit pasta amount operation");
assert.equal(amountOp.value.amount,2);
assert.equal(amountOp.value.unit,"pack");

context.TDShoppingConversation.apply("Только макароны");
const result=context.TDShoppingConversation.apply("Добавь две пачки макарон");
assert.equal(result.ok,true);
assert.equal(result.state.quantityTargets.pasta.amount,2);
assert.equal(result.state.quantityTargets.pasta.unit,"pack");
const line=result.state.products.find(item=>item.id==="pasta");
assert.ok(line,"pasta must stay in the basket");
assert.equal(line.quantity,2,"explicit two-pack request must produce quantity 2");
const selected=result.plans[0];
assert.ok(selected,"a PurchasePlan must be produced");
const recomputedGoods=selected.products.reduce((sum,item)=>sum+Number(item.price)*Number(item.quantity||1),0);
assert.equal(selected.goods,recomputedGoods,"PurchasePlan goods total must use every line quantity");
assert.equal(selected.total,recomputedGoods+Number(selected.convenienceCost||0),"PurchasePlan charged total must use quantity-aware goods plus known convenience cost");
assert.equal(result.state.currentTotal,selected.total,"shopping state total must match the selected PurchasePlan");

const direct=context.TDShoppingOptimizer.planOne({
  budget:0,peopleCount:1,duration:1,cookingPreference:"normal",
  selectionMode:"only",onlyProducts:["pasta"],requiredProducts:["pasta"],preferredProducts:[],
  excludedProducts:[],excludedBrands:[],existingProducts:[],
  quantityTargets:{pasta:{amount:amountOp.value.amount,unit:amountOp.value.unit}},
  stores:["pyat"],mode:"one"
},"pyat");
const directLine=direct.products.find(item=>item.id==="pasta");
assert.ok(directLine);
assert.equal(directLine.quantity,2);
assert.equal(direct.total,directLine.price*2,"isolated one-store projection must price two packs as two units of the selected product");

console.log("MVP-021 word quantity regression passed: 'две пачки макарон' maps to quantity 2 and totals use it.");
