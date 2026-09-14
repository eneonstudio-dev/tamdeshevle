import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const storage=new Map();
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date};
context.window=context;
context.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
context.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}};
context.dispatchEvent=()=>{};
context.render=()=>{};
context.state={city:"msk",storeId:"pyat",cart:{},cartTouched:false};
context.STORES=[{id:"pyat",kind:"shop",city:["msk"]}];
context.PRODUCTS=[
  {id:"milk",name:"Молоко",pack:"1 л"},
  {id:"sugar",name:"Сахар",pack:"1 кг"},
  {id:"bread",name:"Хлеб",pack:"1 шт"}
];
const catalog=[
  {id:"milk",name:"Молоко",pack:"1 л",tags:["молочка"],brand:""},
  {id:"sugar",name:"Сахар",pack:"1 кг",tags:["сахар"],brand:""},
  {id:"bread",name:"Хлеб",pack:"1 шт",tags:["хлеб"],brand:""}
];
const prices={milk:100,sugar:90,bread:60};
context.TDStoreAdapters={catalog:()=>catalog,adapter:()=>({getProduct:id=>catalog.find(p=>p.id===id)||null,getPrice:id=>({value:prices[id]??null,quality:"LIVE"})})};
vm.createContext(context);
for(const file of ["shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const seeded=context.TDShoppingConversation.apply("seed",[
  {type:"SET_ONLY_PRODUCTS",value:["milk","sugar","bread"]},
  {type:"SET_MODE",value:"one"},
  {type:"CHANGE_STORE",value:"pyat"}
]);
assert.equal(seeded.state.products.some(x=>x.id==="sugar"),true,"fixture must start with explicit sugar");

const parsed=context.TDShoppingConversation.parse("Мне ПП и без сахара");
assert.equal(parsed.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="healthy"),true,"MVP-011 must persist the healthy/PP preference");
assert.equal(parsed.some(op=>op.type==="EXCLUDE_TAG"&&op.value==="сахар"),true,"MVP-011 must persist no-sugar as a hard evidence-backed tag exclusion");

const result=context.TDShoppingConversation.apply("Мне ПП и без сахара",parsed);
assert.equal(result.state.preferences.includes("healthy"),true,"healthy preference must survive optimization");
assert.equal(result.state.excludedProducts.includes("sugar"),true,"evidence-tagged sugar must become excluded");
assert.equal(result.state.products.some(x=>x.id==="sugar"),false,"known sugar candidate must not remain in the basket");
assert.equal(result.state.products.some(x=>x.id==="milk"),true,"unrelated product must survive the dietary update");
assert.equal(result.state.products.some(x=>x.id==="bread"),true,"unrelated product must survive the dietary update");

console.log("MVP-011 passed: PP is a healthy preference and no-sugar is a hard tag exclusion when product evidence supports it.");
