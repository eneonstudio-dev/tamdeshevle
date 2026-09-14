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
vm.runInContext(`const STORES=${JSON.stringify([{id:"pyat",name:"Пятёрочка",city:["msk"],kind:"shop"}])}; const PRODUCTS=${JSON.stringify([
  {id:"pasta",name:"Макароны",pack:"450 г",emoji:"🍝",prices:{pyat:75}},
  {id:"bread",name:"Хлеб",pack:"1 шт",emoji:"🍞",prices:{pyat:70}}
])};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const seeded=context.TDShoppingConversation.apply("fixture",[
  {type:"SET_MODE",value:"one"},
  {type:"SET_ONLY_PRODUCTS",value:["pasta","bread"]},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"pasta",amount:2,unit:"pack"}},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"bread",amount:1,unit:"pack"}}
]);
assert.equal(seeded.ok,true);
assert.equal(seeded.state.products.find(item=>item.id==="pasta")?.quantity,2);
assert.equal(seeded.state.products.find(item=>item.id==="bread")?.quantity,1);

const parsed=context.TDShoppingConversation.parse("Удали одну пачку макарон");
const decrement=parsed.find(op=>op.type==="CHANGE_QUANTITY"&&op.value?.id==="pasta");
assert.ok(decrement,"MVP-022: an explicit one-pack removal must be represented as a quantity decrement");
assert.equal(decrement.value.delta,-1);
assert.equal(parsed.some(op=>op.type==="REMOVE_PRODUCT"&&op.value==="pasta"),false,"explicit partial removal must not be encoded as full SKU deletion");

const result=context.TDShoppingConversation.apply("Удали одну пачку макарон");
assert.equal(result.ok,true);
const pasta=result.state.products.find(item=>item.id==="pasta");
const bread=result.state.products.find(item=>item.id==="bread");
assert.ok(pasta,"pasta must remain after decrementing 2 packs by 1");
assert.equal(pasta.quantity,1);
assert.ok(bread,"unrelated basket items must be preserved");
assert.equal(bread.quantity,1);
assert.equal(result.state.quantityTargets.pasta.amount,1);
assert.equal(result.state.quantityTargets.pasta.unit,"pack");
const selected=result.plans[0];
const goods=selected.products.reduce((sum,item)=>sum+Number(item.price)*Number(item.quantity||1),0);
assert.equal(selected.goods,goods);
assert.equal(selected.total,goods+Number(selected.convenienceCost||0));
assert.equal(result.state.currentTotal,selected.total);

console.log("MVP-022 decrement regression passed: removing one of two pasta packs leaves one and preserves unrelated basket state.");
