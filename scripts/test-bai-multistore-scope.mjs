import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const storage=new Map();
const products=[
  {id:"milk",name:"Молоко",pack:"1 л",emoji:"🥛",brand:"",prices:{pyat:100,magnit:90}},
  {id:"bread",name:"Хлеб",pack:"650 г",emoji:"🍞",brand:"",prices:{pyat:60,magnit:70}}
];
const stores=[
  {id:"pyat",name:"Пятёрочка",city:["msk"],kind:"shop"},
  {id:"magnit",name:"Магнит",city:["msk"],kind:"shop"}
];
const context={
  console,JSON,Math,Number,String,Object,Array,Set,Map,Date,RegExp,Promise,
  localStorage:{
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key)
  },
  CustomEvent:class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}},
  dispatchEvent(){return true},addEventListener(){},render(){},navigator:{onLine:true}
};
context.window=context;
context.globalThis=context;
context.state={city:"msk",storeId:"pyat",cart:{},cartTouched:false};
vm.createContext(context);
vm.runInContext(`const STORES=${JSON.stringify(stores)}; const PRODUCTS=${JSON.stringify(products)};`,context);
for(const file of ["store-adapters.js","shopping-state.js","shopping-optimizer.js","shopping-conversation.js","bai-shopping-agent-kernel.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const kernel=context.TDBaiShoppingAgentKernel;
const mapped=kernel._test.legacyToActions([
  {type:"CHANGE_STORE",value:"pyat"},
  {type:"CHANGE_STORE",value:"magnit"},
  {type:"SET_MODE",value:"multi"}
]);
assert.equal(mapped.ok,true);
const storeConstraints=mapped.actions.filter(action=>action.type==="set_constraint"&&action.payload?.key==="store_ids");
assert.equal(storeConstraints.length,1,"multiple CHANGE_STORE ops must become one canonical store_ids constraint");
assert.deepEqual(new Set(storeConstraints[0].payload.value),new Set(["pyat","magnit"]),"canonical store_ids must preserve every explicitly selected retailer");

const result=await kernel.run({
  text:"Сравни Пятёрочку и Магнит, где дешевле",
  operations:[
    {type:"CHANGE_STORE",value:"pyat"},
    {type:"CHANGE_STORE",value:"magnit"},
    {type:"SET_MODE",value:"multi"},
    {type:"SET_ONLY_PRODUCTS",value:["milk","bread"]},
    {type:"REOPTIMIZE"}
  ]
});
assert.equal(result.ok,true,JSON.stringify(result.error),"Bay kernel must not roll back a valid multi-store scope as EFFECT_NOT_VERIFIED");
assert.deepEqual(new Set(context.TDShoppingState.get().stores),new Set(["pyat","magnit"]),"canonical shopping state must retain both requested retailers");
assert.deepEqual(new Set(kernel.state.get().store_constraints.store_ids),new Set(["pyat","magnit"]),"Bay session must retain the same retailer allow-list as canonical state");
assert.ok((context.TDShoppingState.get().lastPlans||[]).every(plan=>(plan.stores||[]).every(id=>["pyat","magnit"].includes(id))),"optimizer plans must stay inside the requested retailer set");

console.log("Bay multi-store scope passed: multiple selected retailers survive mapping, execution, verification and optimization without rollback.");
