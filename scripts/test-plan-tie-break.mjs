import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const products=[
  {id:"milk",name:"Молоко",pack:"1 л",emoji:"🥛",brand:"",prices:{pyat:100,magnit:40,perek:300}},
  {id:"bread",name:"Хлеб",pack:"650 г",emoji:"🍞",brand:"",prices:{pyat:100,magnit:300,perek:40}}
];
const stores=[
  {id:"pyat",name:"Пятёрочка",city:["msk"],kind:"shop"},
  {id:"magnit",name:"Магнит",city:["msk"],kind:"shop"},
  {id:"perek",name:"Перекрёсток",city:["msk"],kind:"shop"}
];
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,RegExp};
context.window=context;
context.globalThis=context;
context.state={city:"msk",storeId:"pyat"};
context.TDPriceMeta={
  get(_productId,storeId){
    return storeId==="magnit"||storeId==="perek"?{scopeVerified:true,freshness:"fresh"}:null;
  }
};
context.TDDataQuality={metaQuality(){return{status:"fresh"}}};
vm.createContext(context);
vm.runInContext(`const STORES=${JSON.stringify(stores)}; const PRODUCTS=${JSON.stringify(products)};`,context);
for(const file of ["store-adapters.js","shopping-optimizer.js"]){
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"),context,{filename:file});
}

const plans=context.TDShoppingOptimizer.optimize({
  selectionMode:"only",
  onlyProducts:["milk","bread"],
  mode:"multi",
  stores:["pyat","magnit","perek"],
  requiredProducts:[],
  preferredProducts:[],
  excludedProducts:[],
  excludedBrands:[],
  quantityTargets:{},
  existingProducts:[]
});

assert.equal(plans.length,2);
assert.equal(plans[0].total,200);
assert.equal(plans[1].total,200);
assert.equal(plans.find(plan=>plan.type==="one")?.quality,"ESTIMATED");
assert.equal(plans.find(plan=>plan.type==="multi")?.quality,"LIVE");
assert.equal(
  plans[0].type,
  "multi",
  "MVP-029: equal charged totals must prefer stronger evidence instead of inheriting array order"
);
assert.equal(plans[0].quality,"LIVE");

const compare=context.TDShoppingOptimizer.comparePlans;
assert.equal(typeof compare,"function");
const wanted=["milk","bread"];
const base={total:100,convenienceCost:0,stores:["pyat"],products:[{id:"milk",quality:"LIVE"}]};
const fullCoverage={...base,id:"full",stores:["magnit","perek"],convenienceCost:120,products:[{id:"milk",quality:"UNKNOWN"},{id:"bread",quality:"UNKNOWN"}]};
assert.ok(compare(fullCoverage,{...base,id:"partial"},wanted)<0,"coverage must outrank weaker convenience/evidence when charged cost is equal");

const live={...base,id:"live",products:[{id:"milk",quality:"LIVE"},{id:"bread",quality:"LIVE"}]};
const estimated={...base,id:"estimated",products:[{id:"milk",quality:"ESTIMATED"},{id:"bread",quality:"ESTIMATED"}]};
assert.ok(compare(live,estimated,wanted)<0,"stronger evidence must win after equal cost and coverage");

const convenient={...live,id:"convenient",convenienceCost:0,stores:["pyat"]};
const inconvenient={...live,id:"inconvenient",convenienceCost:120,stores:["magnit","perek"]};
assert.ok(compare(convenient,inconvenient,wanted)<0,"lower convenience cost/fewer stores must win after equal cost, coverage and evidence");
assert.ok(compare({...convenient,id:"a"},{...convenient,id:"b"},wanted)<0,"final tie-break must be stable by plan id");

console.log("MVP-029 plan tie-break regression passed: equal charged totals rank by coverage, evidence, convenience and stable id.");
