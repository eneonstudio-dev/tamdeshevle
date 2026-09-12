import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,queueMicrotask};
context.window=context;
context.state={mode:"walk",city:"msk",cart:{milk:1,bread:1}};
let configured=true;
context.TDAssemblyPreferences={
  hasConfiguredCost:()=>configured,
  read:()=>({minutes:35,rubPerMinute:8,transportRub:40}),
  extraStopCost:()=>320
};
context.TDShoppingState={get:()=>({preferences:[],deliveryPreference:"any"})};
context.TDShoppingOptimizer={optimize:()=>[]};
context.TDBasketSplit={fromWindow:()=>null};
vm.createContext(context);
vm.runInContext(fs.readFileSync("bai-tradeoff-advisor-v1.js","utf8"),context,{filename:"bai-tradeoff-advisor-v1.js"});
const api=context.TDBaiTradeoffAdvisorV1;
assert.ok(api,"tradeoff advisor must boot");

const convenienceWins=api.evaluate({
  oneTotal:2000,splitGoods:1820,oneStores:1,splitStores:2,state:{preferences:[]},mode:"walk",
  assembly:api.assemblyContext(1,"walk"),confidence:"verified"
});
assert.equal(convenienceWins.choice,"one","180 RUB raw saving must not beat a 320 RUB extra-stop cost");
assert.equal(convenienceWins.grossSaving,180);
assert.equal(convenienceWins.netSaving,-140);
assert.match(convenienceWins.tradeoff,/180\s*₽/);
assert.match(convenienceWins.tradeoff,/35 мин/);
assert.match(api.explain(convenienceWins),/одном магазине/);

const savingWins=api.evaluate({
  oneTotal:2500,splitGoods:1800,oneStores:1,splitStores:2,state:{preferences:[]},mode:"walk",
  assembly:api.assemblyContext(1,"walk"),confidence:"verified"
});
assert.equal(savingWins.choice,"split","large net saving must justify the extra stop");
assert.equal(savingWins.netSaving,380);
assert.match(savingWins.why,/380\s*₽/);
assert.match(savingWins.tradeoff,/\+35 мин/);

configured=false;
const budgetUnknownTime=api.evaluate({oneTotal:2000,splitGoods:1880,state:{preferences:["budget"]},mode:"walk",assembly:api.assemblyContext(1,"walk")});
assert.equal(budgetUnknownTime.choice,"split","explicit budget preference may choose raw saving when time cost is unknown");
assert.match(budgetUnknownTime.why,/ограниченной уверенностью/);

const convenienceUnknownTime=api.evaluate({oneTotal:2000,splitGoods:1700,state:{preferences:["convenience"]},mode:"walk",assembly:api.assemblyContext(1,"walk")});
assert.equal(convenienceUnknownTime.choice,"one","explicit convenience preference must avoid an unpriced extra stop");

configured=true;
const fromPlans=api.fromPlans([
  {type:"one",stores:["pyat"],goods:2000,total:2000,quality:"ESTIMATED"},
  {type:"multi",stores:["pyat","magnit"],goods:1820,total:1940,convenienceCost:120,quality:"ESTIMATED"}
],{preferences:[]});
assert.equal(fromPlans.choice,"one","advisor must recompute convenience from user settings instead of trusting the legacy fixed 120 RUB heuristic");
assert.equal(fromPlans.splitGoods,1820,"advisor must compare raw goods before applying the user's own stop cost");
assert.equal(fromPlans.assembly.operationalCost,320);

const delivery=api.evaluate({oneTotal:2000,splitGoods:1850,state:{preferences:[]},mode:"delivery",assembly:api.assemblyContext(1,"delivery")});
assert.equal(delivery.assembly.operationalCost,0,"delivery split must not invent walking travel cost");
assert.equal(delivery.choice,"split","meaningful delivery saving should survive when there is no extra-stop cost");

assert.equal(api.isTradeoffPrompt("Что лучше выбрать — один магазин или два?"),true);
assert.equal(api.isTradeoffPrompt("добавь молоко"),false);
assert.deepEqual(Array.from(api.suggestions(convenienceWins)),["Собрать в одном магазине","Разнести покупки"],"tradeoff quick actions should be explicit decisions so user intent can be learned safely");
assert.equal(api.explicitChoice("Разнести покупки"),"split");
assert.equal(api.explicitChoice("Что лучше выбрать — один магазин или два?"),null,"comparison questions must not count as learning signals");

const life=fs.readFileSync("bai-life.js","utf8");
assert.match(life,/bai-tradeoff-advisor-v1\.js\?v=/,"Bay lifecycle must load the tradeoff advisor");
const source=fs.readFileSync("bai-tradeoff-advisor-v1.js","utf8");
assert.match(source,/td-ai-tradeoff-card/,"tradeoff advice must have an in-assistant decision card");
assert.match(source,/__tdTradeoffWrapped/,"advisor must attach to existing Bay submit paths without replacing the brain");
assert.match(source,/noteTradeoffChoice/,"explicit tradeoff actions must feed the existing Bai memory instead of a parallel learning store");
assert.doesNotMatch(source,/convenienceCost:120/,"tradeoff advisor must not hard-code the legacy stop heuristic");

console.log("Bay tradeoff advisor passed: price, time, travel cost, explicit choices, preferences and confidence produce a human decision instead of cheapest-only advice.");
