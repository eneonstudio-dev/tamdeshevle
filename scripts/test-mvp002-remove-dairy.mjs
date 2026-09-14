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
  {id:"bread",name:"Хлеб",pack:"650 г"},
  {id:"chicken",name:"Курица",pack:"1 кг"},
  {id:"sour",name:"Сметана",pack:"300 г"}
];
const catalog=[
  {id:"milk",name:"Молоко",pack:"1 л",tags:["молочка","молоко"],brand:""},
  {id:"bread",name:"Хлеб",pack:"650 г",tags:["хлеб"],brand:""},
  {id:"chicken",name:"Курица",pack:"1 кг",tags:["мясо","курица"],brand:""},
  {id:"sour",name:"Сметана",pack:"300 г",tags:["молочка","сметана"],brand:""}
];
const prices={milk:100,bread:60,chicken:350,sour:110};
context.TDStoreAdapters={
  catalog:()=>catalog,
  adapter:()=>({
    getProduct:id=>catalog.find(p=>p.id===id)||null,
    getPrice:id=>({value:prices[id]??null,quality:"LIVE"})
  })
};
vm.createContext(context);
for(const file of ["shopping-state.js","shopping-optimizer.js","shopping-conversation.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

// Seed the canonical previous-turn state without testing MVP-001 again.
let seeded=context.TDShoppingConversation.apply("seed",[
  {type:"CHANGE_BUDGET",value:5000},
  {type:"SET_DURATION",value:7},
  {type:"SET_MODE",value:"one"},
  {type:"CHANGE_STORE",value:"pyat"},
  {type:"ADD_PREFERENCE",value:"healthy"},
  {type:"SET_ONLY_PRODUCTS",value:["milk","bread","chicken","sour"]}
]);
assert.equal(seeded.state.products.some(x=>x.id==="milk"),true);
assert.equal(seeded.state.products.some(x=>x.id==="sour"),true);

const parsed=context.TDShoppingConversation.parse("Убери молочку");
assert.equal(parsed.some(op=>op.type==="EXCLUDE_TAG"&&op.value==="молочка"),true,"MVP-002 must interpret `Убери молочку` as a dairy-category exclusion");
assert.equal(parsed.some(op=>op.type==="RESET_BASKET"),false,"category removal must not rebuild the basket from scratch");

const before={
  budget:seeded.state.budget,
  duration:seeded.state.duration,
  mode:seeded.state.mode,
  stores:[...seeded.state.stores],
  preferences:[...seeded.state.preferences]
};
const result=context.TDShoppingConversation.apply("Убери молочку",parsed);
const ids=result.state.products.map(x=>x.id);
assert.equal(ids.includes("milk"),false,"milk must be removed by dairy exclusion");
assert.equal(ids.includes("sour"),false,"sour cream must be removed by dairy exclusion");
assert.equal(ids.includes("bread"),true,"unrelated bread must survive MVP-002");
assert.equal(ids.includes("chicken"),true,"unrelated chicken must survive MVP-002");
assert.deepEqual({
  budget:result.state.budget,
  duration:result.state.duration,
  mode:result.state.mode,
  stores:Array.from(result.state.stores),
  preferences:Array.from(result.state.preferences)
},before,"MVP-002 must preserve unrelated budget/duration/store/preference constraints");
assert.equal(result.state.excludedProducts.includes("milk"),true);
assert.equal(result.state.excludedProducts.includes("sour"),true);

console.log("MVP-002 passed: `Убери молочку` removes the dairy category while preserving unrelated basket lines and constraints.");
