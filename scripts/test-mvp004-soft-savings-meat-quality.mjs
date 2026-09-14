import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const brainContext={console,JSON,Math,Number,String,Object,Array,Set};
brainContext.window=brainContext;
brainContext.TDShoppingState={get:()=>({products:[{id:"chicken"}],budget:5000})};
vm.createContext(brainContext);
vm.runInContext(fs.readFileSync(new URL("../bai-brain.js",import.meta.url),"utf8"),brainContext,{filename:"bai-brain.js"});

const result=await brainContext.TDBaiBrain.route("Сделай подешевле, но мясо оставь хорошее");
assert.equal(result.operations.some(op=>op.type==="CHANGE_BUDGET"),false,"MVP-004 generic `подешевле` must stay a soft optimization goal instead of silently cutting the hard budget");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="budget"),true,"MVP-004 must persist the user's global savings preference");
assert.equal(result.operations.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),true,"MVP-004 must persist the explicit meat-quality preference separately from savings");
assert.equal(result.operations.some(op=>op.type==="REOPTIMIZE"),true,"MVP-004 must re-evaluate the plan after the soft trade-off update");

const fallbackContext={console,JSON,Math,Number,String,Object,Array,Set,Map,Date};
fallbackContext.window=fallbackContext;
fallbackContext.state={city:"msk",storeId:"pyat"};
fallbackContext.STORES=[{id:"pyat",kind:"shop",city:["msk"]}];
fallbackContext.TDStoreAdapters={catalog:()=>[]};
fallbackContext.TDShoppingOptimizer={eligibleStores:()=>[],optimize:()=>[],planOne:()=>({products:[],stores:["pyat"],total:0})};
vm.createContext(fallbackContext);
vm.runInContext(fs.readFileSync(new URL("../shopping-conversation.js",import.meta.url),"utf8"),fallbackContext,{filename:"shopping-conversation.js"});
const fallback=fallbackContext.TDShoppingConversation.parse("Сделай подешевле, но мясо оставь хорошее");
assert.equal(fallback.some(op=>op.type==="CHANGE_BUDGET"),false,"fallback must not invent a new hard budget from qualitative savings language");
assert.equal(fallback.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="budget"),true,"fallback must preserve the savings preference");
assert.equal(fallback.some(op=>op.type==="ADD_PREFERENCE"&&op.value==="quality_meat"),true,"fallback must preserve the meat-quality preference");
assert.equal(fallback.some(op=>op.type==="REOPTIMIZE"),true,"fallback must request plan re-evaluation");

console.log("MVP-004 passed: qualitative savings stays soft while meat quality remains an explicit competing preference.");
