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
context.STORES=[
  {id:"pyat",kind:"shop",city:["msk"]},
  {id:"perek",kind:"shop",city:["msk"]}
];
context.PRODUCTS=[
  {id:"milk",name:"Молоко",pack:"1 л"},
  {id:"bread",name:"Хлеб",pack:"650 г"},
  {id:"chicken",name:"Курица",pack:"1 кг"},
  {id:"eggs",name:"Яйца",pack:"10 шт"},
  {id:"water",name:"Вода",pack:"5 л"}
];
const catalog=context.PRODUCTS.map(product=>({...product,tags:product.id==="chicken"?["мясо","курица"]:[],brand:""}));
const prices={
  pyat:{milk:100,bread:60,chicken:350,eggs:120,water:110},
  perek:{milk:105,bread:65,chicken:365,eggs:125,water:115}
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

const seeded=context.TDShoppingConversation.apply("seed",[
  {type:"CHANGE_BUDGET",value:4000},
  {type:"SET_DURATION",value:7},
  {type:"SET_MODE",value:"one"},
  {type:"CHANGE_STORE",value:"pyat"},
  {type:"ADD_PREFERENCE",value:"healthy"},
  {type:"SET_ONLY_PRODUCTS",value:["milk","bread","chicken"]},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"milk",amount:2,unit:"pack"}},
  {type:"SET_PRODUCT_AMOUNT",value:{id:"chicken",amount:2,unit:"pack"}}
]);
const beforeIds=seeded.state.products.map(x=>x.id).sort();
const beforeQty=Object.fromEntries(seeded.state.products.map(x=>[x.id,x.quantity]));
assert.deepEqual(beforeIds,["bread","chicken","milk"]);
assert.equal(beforeQty.milk,2);
assert.equal(beforeQty.chicken,2);

const parsed=context.TDShoppingConversation.parse("Собери то же самое в Перекрёстке");
assert.equal(parsed.some(op=>op.type==="CHANGE_STORE"&&op.value==="perek"),true,"MVP-015 must select Perekrestok");
assert.equal(parsed.some(op=>op.type==="RESET_BASKET"||op.type==="CLEAR_ONLY"||op.type==="SET_ONLY_PRODUCTS"),false,"same-basket reprojection must not rebuild product intent");

const result=context.TDShoppingConversation.apply("Собери то же самое в Перекрёстке",parsed);
const afterIds=result.state.products.map(x=>x.id).sort();
const afterQty=Object.fromEntries(result.state.products.map(x=>[x.id,x.quantity]));
assert.deepEqual(afterIds,beforeIds,"MVP-015 must re-project the exact UniversalBasket instead of adding default products");
assert.deepEqual(afterQty,beforeQty,"MVP-015 must preserve quantities while changing retailer projection");
assert.deepEqual(Array.from(result.state.stores),["perek"],"MVP-015 must project into the requested retailer");
assert.equal(result.state.selectionMode,"only","same-basket projection must preserve exact-item selection mode");
assert.equal(result.state.budget,4000);
assert.equal(result.state.duration,7);
assert.equal(result.state.preferences.includes("healthy"),true);
assert.equal(result.state.lastPlans[0]?.stores?.includes("perek"),true,"PurchasePlan must be recalculated against Perekrestok");

console.log("MVP-015 passed: the same UniversalBasket and quantities are re-projected to Perekrestok without rebuilding user intent.");
