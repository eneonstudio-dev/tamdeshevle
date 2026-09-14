import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const normalizer=fs.readFileSync(new URL("../bai-convenience-preference.js",import.meta.url),"utf8");
const config=fs.readFileSync(new URL("../supabase-config.js",import.meta.url),"utf8");
assert.ok(config.indexOf("bai-convenience-preference.js")>config.indexOf("bai-mvp-vertical-gate.js"),"convenience normalizer must load after the MVP vertical gate");
assert.ok(config.indexOf("bai-convenience-preference.js")<config.indexOf("bai-decision-quality.js"),"convenience intent must be normalized before decision-quality/journey layers");

// Canonical MVP-012 must turn natural speed-over-price wording into an explicit
// convenience preference; otherwise downstream trade-off logic never sees it.
const brainContext={console,JSON,Math,Number,String,Object,Array,Set};
brainContext.window=brainContext;
brainContext.TDShoppingState={get:()=>({products:[],budget:null})};
vm.createContext(brainContext);
vm.runInContext(fs.readFileSync(new URL("../bai-brain.js",import.meta.url),"utf8"),brainContext,{filename:"bai-brain.js"});
vm.runInContext(normalizer,brainContext,{filename:"bai-convenience-preference.js"});

let result=await brainContext.TDBaiBrain.route("Побыстрее, цена не главное");
let convenience=result.operations.filter(op=>op.type==="ADD_PREFERENCE"&&op.value==="convenience");
assert.equal(convenience.length,1,"MVP-012 must deterministically persist convenience when speed matters more than price");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="budget"),false,"`цена не главное` must not be inverted into a budget-first preference");
result=await brainContext.TDBaiBrain.route("Хочу быстро приготовить ужин");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="convenience"),false,"cooking-speed wording alone must not silently become a price-vs-convenience trade-off");

// Fallback parser must preserve the same intent when neural/brain routing is unavailable.
const fallbackContext={console,JSON,Math,Number,String,Object,Array,Set,Map,Date};
fallbackContext.window=fallbackContext;
fallbackContext.state={city:"msk",storeId:"pyat"};
fallbackContext.STORES=[{id:"pyat",kind:"shop",city:["msk"]},{id:"magnit",kind:"shop",city:["msk"]}];
fallbackContext.TDStoreAdapters={catalog:()=>[]};
fallbackContext.TDShoppingOptimizer={eligibleStores:()=>[],optimize:()=>[],planOne:()=>({products:[],stores:["pyat"],total:0})};
vm.createContext(fallbackContext);
vm.runInContext(fs.readFileSync(new URL("../shopping-conversation.js",import.meta.url),"utf8"),fallbackContext,{filename:"shopping-conversation.js"});
vm.runInContext(normalizer,fallbackContext,{filename:"bai-convenience-preference.js"});
const fallback=fallbackContext.TDShoppingConversation.parse("Побыстрее, цена не главное");
assert.equal(fallback.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="convenience"),true,"fallback parser must preserve MVP-012 convenience intent");

// Existing deterministic trade-off layer must then prefer convenience over a minor saving.
const advisorContext={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,queueMicrotask};
advisorContext.window=advisorContext;
advisorContext.state={mode:"walk",city:"msk",cart:{milk:1}};
advisorContext.TDAssemblyPreferences={hasConfiguredCost:()=>false,read:()=>({minutes:35,rubPerMinute:8,transportRub:40}),extraStopCost:()=>320};
advisorContext.TDShoppingState={get:()=>({preferences:["convenience"],deliveryPreference:"any"})};
advisorContext.TDShoppingOptimizer={optimize:()=>[]};
advisorContext.TDBasketSplit={fromWindow:()=>null};
vm.createContext(advisorContext);
vm.runInContext(fs.readFileSync(new URL("../bai-tradeoff-advisor-v1.js",import.meta.url),"utf8"),advisorContext,{filename:"bai-tradeoff-advisor-v1.js"});
const decision=advisorContext.TDBaiTradeoffAdvisorV1.evaluate({
  oneTotal:2000,
  splitGoods:1880,
  state:{preferences:["convenience"]},
  mode:"walk",
  assembly:advisorContext.TDBaiTradeoffAdvisorV1.assemblyContext(1,"walk"),
  confidence:"estimated"
});
assert.equal(decision.choice,"one","MVP-012 convenience preference must beat a minor 120 RUB saving when extra-stop cost is not established");

console.log("MVP-012 passed: explicit speed-over-price intent becomes convenience while cooking-speed language stays scoped, and deterministic trade-off logic prefers the simpler plan over minor savings.");
