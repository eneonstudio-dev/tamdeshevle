import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const normalizer=fs.readFileSync(new URL("../bai-soft-tradeoff-intents.js",import.meta.url),"utf8");
const config=fs.readFileSync(new URL("../supabase-config.js",import.meta.url),"utf8");
assert.ok(config.indexOf("bai-soft-tradeoff-intents.js")>config.indexOf("bai-category-intents.js"),"soft tradeoff normalizer must load after basic category/dietary intent normalization");
assert.ok(config.indexOf("bai-soft-tradeoff-intents.js")<config.indexOf("bai-same-basket-reprojection.js"),"soft tradeoff intent must settle before basket reprojection and decision-quality layers");

const brainContext={console,JSON,Math,Number,String,Object,Array,Set};
brainContext.window=brainContext;
brainContext.TDShoppingState={get:()=>({products:[{id:"chicken"}],budget:5000})};
vm.createContext(brainContext);
vm.runInContext(fs.readFileSync(new URL("../bai-brain.js",import.meta.url),"utf8"),brainContext,{filename:"bai-brain.js"});
vm.runInContext(normalizer,brainContext,{filename:"bai-soft-tradeoff-intents.js"});

let result=await brainContext.TDBaiBrain.route("Сделай подешевле, но мясо оставь хорошее");
assert.equal(result.operations.some(op=>op.type==="CHANGE_BUDGET"),false,"MVP-004 generic `подешевле` must stay a soft optimization goal instead of silently cutting the hard budget");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="budget"),true,"MVP-004 must persist the user's global savings preference");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),true,"MVP-004 must persist the explicit meat-quality preference separately from savings");
assert.equal(result.operations.some(op=>op.type==="REOPTIMIZE"),true,"MVP-004 must re-evaluate the plan after the soft trade-off update");
assert.equal(result.goal.budget,null,"qualitative savings must not poison hidden goal memory with an invented hard budget");
assert.equal(result.goal.preferences.includes("budget"),true);
assert.equal(result.goal.preferences.includes("quality_meat"),true);

brainContext.TDBaiBrain.reset();
result=await brainContext.TDBaiBrain.route("Сделай дешевле на 1000 ₽");
assert.equal(result.operations.some(op=>op.type==="CHANGE_BUDGET"&&op.value===4000),true,"explicit numeric savings must remain a hard budget update");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),false,"ordinary numeric budget changes must not invent meat-quality intent");

brainContext.TDBaiBrain.reset();
result=await brainContext.TDBaiBrain.route("Добавь мясо");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),false,"mentioning meat alone must not create a quality preference");

const fallbackContext={console,JSON,Math,Number,String,Object,Array,Set,Map,Date};
fallbackContext.window=fallbackContext;
fallbackContext.state={city:"msk",storeId:"pyat"};
fallbackContext.STORES=[{id:"pyat",kind:"shop",city:["msk"]}];
fallbackContext.TDStoreAdapters={catalog:()=>[]};
fallbackContext.TDShoppingOptimizer={eligibleStores:()=>[],optimize:()=>[],planOne:()=>({products:[],stores:["pyat"],total:0})};
vm.createContext(fallbackContext);
vm.runInContext(fs.readFileSync(new URL("../shopping-conversation.js",import.meta.url),"utf8"),fallbackContext,{filename:"shopping-conversation.js"});
vm.runInContext(normalizer,fallbackContext,{filename:"bai-soft-tradeoff-intents.js"});
let fallback=fallbackContext.TDShoppingConversation.parse("Сделай подешевле, но мясо оставь хорошее");
assert.equal(fallback.some(op=>op.type==="CHANGE_BUDGET"),false,"fallback must not invent a new hard budget from qualitative savings language");
assert.equal(fallback.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="budget"),true,"fallback must preserve the savings preference");
assert.equal(fallback.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),true,"fallback must preserve the meat-quality preference");
assert.equal(fallback.some(op=>op.type==="REOPTIMIZE"),true,"fallback must request plan re-evaluation");

fallback=fallbackContext.TDShoppingConversation.parse("Снизь бюджет на 10%");
assert.equal(fallback.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),false,"explicit budget changes must not gain unrelated quality intent");

console.log("MVP-004 passed: qualitative savings stays soft while meat quality remains explicit, and numeric savings remains a hard budget change.");
