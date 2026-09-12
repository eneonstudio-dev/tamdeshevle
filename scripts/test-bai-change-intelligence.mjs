import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const clone=value=>JSON.parse(JSON.stringify(value));
const listeners=new Map(),events=[];
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,queueMicrotask};
context.window=context;
context.CustomEvent=class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}};
context.addEventListener=(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list)};
context.dispatchEvent=event=>{events.push(event);for(const fn of listeners.get(event.type)||[])fn(event);return true};
context.STORES=[{id:"pyat",name:"Пятёрочка"},{id:"magnit",name:"Магнит"}];
let busy=false;
context.TDShoppingAssistant={isBusy:()=>busy};

let state={
  budget:1000,mode:"multi",intent:"manual",peopleCount:1,duration:1,selectionMode:"only",stores:[],
  products:[{id:"milk",sourceId:"milk",name:"Молоко",quantity:1,storeId:"pyat",price:100,unitPrice:100}],
  requiredProducts:["milk"],onlyProducts:["milk"],quantityTargets:{milk:{amount:1,unit:"pack"}},
  lastPlans:[{id:"one_pyat",type:"one",stores:["pyat"],products:[{id:"milk",sourceId:"milk",name:"Молоко",quantity:1,storeId:"pyat",price:100}],total:100}],currentTotal:100
};
context.TDShoppingState={
  get:()=>state,
  snapshot:()=>clone(state),
  save:()=>{const snap=clone(state);context.dispatchEvent(new context.CustomEvent("td:shopping-state",{detail:snap}));return state}
};
context.TDShoppingOptimizer={
  optimize:working=>{
    const rows=working.products||[],hasBread=rows.some(row=>(row.sourceId||row.id)==="bread");
    const unit=id=>id==="milk"?100:50;
    const total=rows.reduce((sum,row)=>sum+unit(row.sourceId||row.id)*(Number(row.quantity)||1),0);
    const storeId=hasBread?"magnit":"pyat";
    const products=rows.map(row=>({...clone(row),storeId,price:unit(row.sourceId||row.id),unitPrice:unit(row.sourceId||row.id)}));
    return[{id:`one_${storeId}`,type:"one",stores:[storeId],products,total,quality:"ESTIMATED"}];
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync("bai-change-intelligence-v1.js","utf8"),context,{filename:"bai-change-intelligence-v1.js"});

const api=context.TDBaiChangeIntelligenceV1;
assert.ok(api,"change intelligence API must boot");
const pure=api.diffStates(
  {products:[{id:"milk",sourceId:"milk",name:"Молоко",quantity:1}],budget:1000,mode:"multi"},
  {products:[{id:"milk",sourceId:"milk",name:"Молоко",quantity:1},{id:"bread",sourceId:"bread",name:"Хлеб",quantity:1}],budget:1000,mode:"multi"}
);
assert.equal(pure.added[0].id,"bread","diff must identify added products");
assert.equal(pure.productChanged,true);

// Structural change: adding a product changes the winning store, so Bay should speak.
state.products.push({id:"bread",sourceId:"bread",name:"Хлеб",quantity:1,storeId:"pyat",price:50,unitPrice:50});
state.requiredProducts=["milk","bread"];state.onlyProducts=["milk","bread"];state.quantityTargets.bread={amount:1,unit:"pack"};state.lastPlans=[];
context.TDShoppingState.save();
let analyzed=events.filter(event=>event.type==="td:bai-change-analyzed").at(-1)?.detail;
assert.equal(analyzed?.change?.added?.[0]?.id,"bread");
assert.equal(analyzed?.reason,"winner_changed","structural change should explain a changed winner");
assert.equal(analyzed?.notify,true,"changed winner must be surfaced");
assert.equal(state.lastPlans[0]?.stores?.[0],"magnit","manual change must receive a fresh recommendation");
assert.equal(state.products[0].storeId,"pyat","replanning a manual cart must not rewrite its canonical product rows");
let insightCount=events.filter(event=>event.type==="td:bai-change-insight").length;
assert.ok(insightCount>=1,"useful external changes should create one Bay insight");

// Tiny quantity change: same winner and <100 RUB movement should stay quiet.
state.products.find(row=>row.sourceId==="bread").quantity=2;state.quantityTargets.bread.amount=2;state.lastPlans=[];
context.TDShoppingState.save();
analyzed=events.filter(event=>event.type==="td:bai-change-analyzed").at(-1)?.detail;
assert.equal(analyzed?.reason,"minor","small quantity edits should be classified as minor");
assert.equal(analyzed?.notify,false,"small same-winner edit should not interrupt the user");
assert.equal(events.filter(event=>event.type==="td:bai-change-insight").length,insightCount,"quiet edits must not create a user-facing insight");

// Large quantity change: same winner, but meaningful total movement should be explained.
state.products.find(row=>row.sourceId==="milk").quantity=6;state.quantityTargets.milk.amount=6;state.lastPlans=[];
context.TDShoppingState.save();
analyzed=events.filter(event=>event.type==="td:bai-change-analyzed").at(-1)?.detail;
assert.equal(analyzed?.reason,"meaningful_total_change");
assert.equal(analyzed?.notify,true,"large money movement should be surfaced");
insightCount=events.filter(event=>event.type==="td:bai-change-insight").length;

// Bay's own in-flight action may be analyzed internally, but must not emit a second visible reply.
busy=true;state.budget=500;context.TDShoppingState.save();
analyzed=events.filter(event=>event.type==="td:bai-change-analyzed").at(-1)?.detail;
assert.equal(analyzed?.busy,true,"analysis must know when Bay itself is working");
assert.equal(events.filter(event=>event.type==="td:bai-change-insight").length,insightCount,"Bay must not duplicate its own in-flight response");

const life=fs.readFileSync("bai-life.js","utf8");
assert.match(life,/bai-change-intelligence-v1\.js\?v=/,"Bay lifecycle must load change intelligence in production");
console.log("Bay change intelligence passed: useful changes speak, minor edits stay quiet, manual carts replan exactly, and Bay does not duplicate itself.");
