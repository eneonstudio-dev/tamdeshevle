import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const storage=new Map();
const catalog=[
  {id:"chicken_fil",name:"Филе куриное",category:"Мясо и птица",pack:"1 кг",brand:"Фермерское",tags:["мясо","protein"],base:379},
  {id:"chicken_thigh",name:"Бедро куриное",category:"Мясо и птица",pack:"1 кг",brand:"Птицефабрика",tags:["мясо","protein"],base:289},
  {id:"minced_beef",name:"Фарш говяжий",category:"Мясо и птица",pack:"500 г",brand:"Мираторг",tags:["мясо","protein"],base:259},
  {id:"ham",name:"Ветчина",category:"Колбасы",pack:"400 г",brand:"Останкино",tags:["мясо","ready"],base:319},
  {id:"eggs_c1",name:"Яйца куриные С1",category:"Молочное и яйца",pack:"10 шт",brand:"",tags:["яйца","protein"],base:115},
  {id:"bread_dark",name:"Хлеб дарницкий",category:"Хлеб",pack:"650 г",brand:"",tags:["хлеб"],base:69},
  {id:"buckwheat",name:"Гречка",category:"Бакалея",pack:"800 г",brand:"",tags:["крупа"],base:95},
  {id:"pasta",name:"Макароны",category:"Бакалея",pack:"450 г",brand:"",tags:["крупа"],base:75},
  {id:"apple",name:"Яблоки",category:"Фрукты",pack:"1 кг",brand:"",tags:["фрукты"],base:149},
  {id:"banana",name:"Бананы",category:"Фрукты",pack:"1 кг",brand:"",tags:["фрукты"],base:135},
  {id:"water_still",name:"Вода б/г",category:"Напитки",pack:"1,5 л",brand:"",tags:["вода"],base:42}
];
const storeMult={pyat:1,magnit:.93,lenta:.96};
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,Promise};context.window=context;
context.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
context.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}};context.dispatchEvent=()=>{};context.addEventListener=()=>{};
context.state={city:"msk",storeId:"pyat",cart:{},cartTouched:false};context.render=()=>{};
context.STORES=[{id:"pyat",kind:"shop",city:["msk"]},{id:"magnit",kind:"shop",city:["msk"]},{id:"lenta",kind:"shop",city:["msk"]}];
context.PRODUCTS=catalog.map(item=>({...item,prices:Object.fromEntries(Object.entries(storeMult).map(([id,m])=>[id,Math.round(item.base*m)]))}));
context.TDStoreAdapters={catalog:()=>catalog,adapter:storeId=>({getProduct:id=>catalog.find(p=>p.id===id)||null,getPrice:id=>{const p=catalog.find(x=>x.id===id);return{value:p?Math.round(p.base*(storeMult[storeId]||1)):null,quality:"ESTIMATED"}}})};
vm.createContext(context);
for(const file of ["shopping-state.js","shopping-optimizer.js","shopping-conversation.js","bai-food-knowledge.js","bai-smart-substitutions.js","bai-shopping-intelligence.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}
const intel=context.TDBaiShoppingIntelligence,conversation=context.TDShoppingConversation,stateApi=context.TDShoppingState;
assert.ok(intel&&conversation&&stateApi);

async function turn(text,aiIntent,baseline=[]){
  const routed=await intel.enhanceRoute(text,{ok:true,provider:"test-ai",operations:baseline,reply:"",suggestions:[],aiIntent},stateApi.get());
  assert.ok(Array.isArray(routed.operations));
  return conversation.apply(text,routed.operations);
}
function ids(){return stateApi.get().products.map(x=>x.id)}
function fruitUnits(){return stateApi.get().products.filter(x=>["apple","banana"].includes(x.id)).reduce((n,x)=>n+(x.quantity||1),0)}

let result=await turn("Собери еды на неделю до 5000 ₽, без Мираторга, мясо нормальное, остальное подешевле",{
  action:"build",hard:{budgetMax:5000,excludedBrands:["мираторг"]},soft:{price:"economy",categoryQuality:{meat:"normal"},budgetReservePct:.1},duration:7,confidence:"high"
});
let state=stateApi.get();
assert.equal(state.budget,5000);
assert.equal(state.duration,7);
assert.ok(state.excludedBrands.some(x=>String(x).toLowerCase()==="мираторг"));
assert.equal(state.shoppingIntelligence.hard.budgetMax,5000);
assert.ok(state.currentTotal<=5000,"initial intelligent basket must obey hard budget");
assert.equal(ids().includes("minced_beef"),false,"excluded brand product must never leak into basket");
assert.ok(state.shoppingIntelligence.plan?.categories?.length>=4,"structured plan should be persisted, not chain-of-thought");
assert.equal(state.shoppingIntelligence.plan?.rawReasoning,undefined);
assert.notEqual(state.shoppingIntelligence.confidence.price,"verified","estimated adapter data may not be promoted to verified price");
assert.equal(state.shoppingIntelligence.confidence.availability,"unknown","availability is unknown unless evidence exists");
const fruitBefore=fruitUnits();

result=await turn("Добавь фруктов",{action:"adjust",soft:{categoryWeights:{fruit:2}},confidence:"high"});
state=stateApi.get();
assert.equal(state.shoppingIntelligence.hard.budgetMax,5000,"budget must survive fruit follow-up");
assert.ok(state.excludedBrands.some(x=>String(x).toLowerCase()==="мираторг"),"brand exclusion must survive fruit follow-up");
assert.ok(fruitUnits()>fruitBefore,"fruit follow-up should materially increase fruit, not merely change reply text");
assert.ok(state.currentTotal<=5000);

result=await turn("Мяса хочу получше",{action:"adjust",soft:{categoryQuality:{meat:"better_if_evidenced"}},confidence:"high"});
state=stateApi.get();
assert.equal(state.shoppingIntelligence.soft.categoryQuality.meat,"better_if_evidenced");
assert.equal(state.shoppingIntelligence.confidence.quality,"low","without product quality evidence the system must admit uncertainty");
assert.ok(ids().includes("chicken_fil"),"better meat preference should prefer the less processed fresh-meat option available in this fixture");
assert.ok(state.currentTotal<=5000,"quality preference must compensate elsewhere instead of breaking hard budget");

// Ensure the sequential remove/replace case has a ham line while retaining all session constraints.
result=conversation.apply("добавь ветчину",[{type:"ADD_PRODUCT",value:"ham"},{type:"REOPTIMIZE"}]);
assert.ok(ids().includes("ham"));
result=await turn("Убери ветчину",{action:"remove",entities:["ham"],confidence:"high"},[{type:"REMOVE_PRODUCT",value:"ham"},{type:"REOPTIMIZE"}]);
assert.equal(ids().includes("ham"),false,"explicit remove must actually remove ham");
assert.equal(stateApi.get().shoppingIntelligence.lastTouchedProduct,"ham");

result=await turn("Замени чем-нибудь похожим",{action:"replace",needsContext:true,replacementReason:"similar",confidence:"medium"});
state=stateApi.get();
const replaceOp=result.operations.find(op=>op.type==="REPLACE_PRODUCT");
assert.ok(replaceOp,"contextual replace must produce an actual replace action");
assert.equal(replaceOp.value.from,"ham");
assert.ok(["chicken_fil","chicken_thigh"].includes(replaceOp.value.to),"replacement must remain semantically close to meat/protein");
assert.equal(["apple","banana","buckwheat","pasta"].includes(replaceOp.value.to),false,"cheap unrelated products are invalid substitutions");
assert.equal(state.shoppingIntelligence.hard.budgetMax,5000);

result=await turn("Хочу всё из одного магазина",{action:"rebuild",hard:{storeLimit:1},confidence:"high"});
state=stateApi.get();
assert.equal(state.mode,"one");
assert.equal(state.shoppingIntelligence.hard.storeLimit,1);
assert.ok((state.lastPlans[0]?.stores||[]).length<=1,"one-store hard constraint must reach the optimizer");
assert.equal(state.shoppingIntelligence.hard.budgetMax,5000);
assert.ok(state.excludedBrands.some(x=>String(x).toLowerCase()==="мираторг"));
assert.ok(state.currentTotal<=5000);

const report=intel.metrics(state.shoppingIntelligence.metricEvents||[]);
for(const key of ["constraint_pass_rate","action_success_rate","context_retention_rate","invalid_substitution_rate","repair_success_rate"])assert.ok(key in report,`metric ${key} must be observable`);

console.log("Bai Shopping Intelligence E2E passed: constraints persist across fuzzy rebuilds, substitutions stay semantic, one-store rebuild works, and evidence confidence stays honest.");
