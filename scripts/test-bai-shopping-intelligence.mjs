import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../bai-shopping-intelligence.js",import.meta.url),"utf8");
const catalog=[
  {id:"chicken_fil",name:"Филе куриное",category:"Мясо и птица",pack:"1 кг",tags:["мясо","protein"],base:379},
  {id:"chicken_thigh",name:"Бедро куриное",category:"Мясо и птица",pack:"1 кг",tags:["мясо","protein"],base:289},
  {id:"ham",name:"Ветчина",category:"Колбасы",pack:"400 г",tags:["мясо","ready"],base:319},
  {id:"apple",name:"Яблоки",category:"Фрукты",pack:"1 кг",tags:["фрукты"],base:149},
  {id:"banana",name:"Бананы",category:"Фрукты",pack:"1 кг",tags:["фрукты"],base:135},
  {id:"buckwheat",name:"Гречка",category:"Бакалея",pack:"800 г",tags:["крупа"],base:95},
  {id:"pasta",name:"Макароны",category:"Бакалея",pack:"450 г",tags:["крупа"],base:75},
  {id:"water_still",name:"Вода",category:"Напитки",pack:"1,5 л",tags:["вода"],base:42}
];
const context={window:{TDStoreAdapters:{catalog:()=>catalog}},console,structuredClone:globalThis.structuredClone};
context.window.window=context.window;vm.createContext(context);vm.runInContext(code,context,{filename:"bai-shopping-intelligence.js"});
const intel=context.window.TDBaiShoppingIntelligence;assert.ok(intel,"Shopping Intelligence must install");

let session=intel.emptySession();
assert.equal(session.hard.budgetMax,null);
assert.deepEqual(Array.from(session.hard.excludedBrands),[]);

session=intel.mergeSession(session,{action:"build",hard:{budgetMax:5000,excludedBrands:["Мираторг"]},soft:{price:"economy",categoryQuality:{meat:"normal"}},duration:7,confidence:"high"});
assert.equal(session.hard.budgetMax,5000,"budget is a persisted hard constraint");
assert.deepEqual(Array.from(session.hard.excludedBrands),["мираторг"]);
assert.equal(session.soft.price,"economy");
assert.equal(session.soft.categoryQuality.meat,"normal");
assert.equal(session.duration,7);

session=intel.mergeSession(session,{action:"adjust",soft:{categoryWeights:{fruit:2}}});
assert.equal(session.hard.budgetMax,5000,"later fuzzy edits must retain the hard budget");
assert.deepEqual(Array.from(session.hard.excludedBrands),["мираторг"],"brand exclusion must survive later turns");
assert.equal(session.soft.categoryWeights.fruit,2);

session=intel.mergeSession(session,{action:"adjust",soft:{categoryQuality:{meat:"better_if_evidenced"}}});
assert.equal(session.soft.categoryQuality.meat,"better_if_evidenced");
assert.equal(session.hard.budgetMax,5000);

session=intel.mergeSession(session,{action:"adjust",clear:["hard.excludedBrands:мираторг"]});
assert.deepEqual(Array.from(session.hard.excludedBrands),[],"explicit cancellation must clear the matching hard constraint");

const plan=intel.buildShoppingPlan({budget:5000,peopleCount:1,duration:7,mode:"multi",products:[]},session,catalog);
assert.ok(plan&&Array.isArray(plan.categories)&&plan.categories.length>=4,"planner must create a structured category plan");
assert.equal(plan.rawReasoning,undefined,"raw chain-of-thought must never be stored");
assert.ok(plan.categories.every(row=>row.id&&Number.isFinite(row.weight)),"category plan must be machine-checkable");
assert.ok(plan.budgetReservePct>=0&&plan.budgetReservePct<=.25);

let hard=intel.validateHard({total:5100,stores:["pyat"],products:[]},{...session,hard:{...session.hard,budgetMax:5000,excludedBrands:[]}});
assert.equal(hard.ok,false,"hard budget may not be violated");
assert.ok(hard.issues.some(x=>x.code==="over_budget"&&x.severity==="hard"));

hard=intel.validateHard({total:4900,stores:["pyat","magnit"],products:[]},{...session,hard:{...session.hard,budgetMax:5000,storeLimit:1}});
assert.equal(hard.ok,false,"hard one-store constraint may not be violated");
assert.ok(hard.issues.some(x=>x.code==="store_limit"));

const critique=intel.critique({
  basket:{total:4800,stores:["pyat"],products:[{id:"ham",category:"Колбасы",quantity:8,price:319},{id:"apple",category:"Фрукты",quantity:1,price:149}]},
  state:{budget:5000},session:{...session,hard:{...session.hard,budgetMax:5000},soft:{...session.soft,categoryWeights:{fruit:2}}},plan
});
assert.ok(Array.isArray(critique.issues));
assert.ok(critique.issues.some(x=>x.code==="absurd_quantity"),"critic must catch absurd quantities");
assert.ok(critique.issues.some(x=>x.code==="category_imbalance"||x.code==="missing_category"),"critic must reason about basket shape");

const same=intel.chooseReplacement("ham","similar",{excludedProducts:["ham"]},session,catalog);
assert.ok(same,"similar replacement should be found when a semantic neighbour exists");
assert.notEqual(same.id,"ham");
assert.ok(["chicken_fil","chicken_thigh"].includes(same.id),"replacement must stay semantically close instead of jumping to fruit/grain");
assert.equal(same.semanticMatch,true);

const cheaper=intel.chooseReplacement("chicken_fil","cheaper",{},session,catalog);
assert.equal(cheaper.id,"chicken_thigh","cheaper replacement must prefer a cheaper close meat option");
assert.equal(cheaper.semanticMatch,true);

const better=intel.chooseReplacement("chicken_thigh","better",{},session,catalog);
assert.ok(better);
assert.equal(better.confidence.quality,"low","without verified quality metadata Bai must not pretend quality is known");

let repairs=0,validations=0;
const repaired=await intel.runRepairLoop({
  initial:{value:0},maxAttempts:3,
  validate:async candidate=>{validations++;return{ok:candidate.value>=2,issues:candidate.value>=2?[]:[{code:"too_low",severity:"hard"}]};},
  critique:async candidate=>({ok:candidate.value>=2,issues:candidate.value>=2?[]:[{code:"too_low",severity:"hard"}]}),
  repair:async candidate=>{repairs++;return{value:candidate.value+1};}
});
assert.equal(repaired.ok,true);
assert.equal(repaired.attempts,2);
assert.equal(repairs,2);
assert.ok(validations<=3,"repair loop must be bounded");

repairs=0;
const bounded=await intel.runRepairLoop({
  initial:{value:0},maxAttempts:2,
  validate:async()=>({ok:false,issues:[{code:"never",severity:"hard"}]}),
  critique:async()=>({ok:false,issues:[{code:"never",severity:"hard"}]}),
  repair:async candidate=>{repairs++;return candidate;}
});
assert.equal(bounded.ok,false);
assert.equal(repairs,2,"repair loop must stop after maxAttempts");

const metrics=intel.metrics([
  {constraintPass:true,actionSuccess:true,contextRetained:true,invalidSubstitution:false,repairAttempted:true,repairSuccess:true},
  {constraintPass:false,actionSuccess:true,contextRetained:true,invalidSubstitution:true,repairAttempted:false,repairSuccess:false}
]);
assert.equal(metrics.constraint_pass_rate,.5);
assert.equal(metrics.action_success_rate,1);
assert.equal(metrics.context_retention_rate,1);
assert.equal(metrics.invalid_substitution_rate,.5);
assert.equal(metrics.repair_success_rate,1,"repair success rate denominator is attempted repairs only");

console.log("Bai Shopping Intelligence core contract passed: hard/soft memory, structured plan, semantic substitutions, critic, bounded repair and metrics.");
