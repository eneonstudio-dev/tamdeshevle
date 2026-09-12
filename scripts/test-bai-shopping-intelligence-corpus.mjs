import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync(new URL("../bai-shopping-intelligence.js",import.meta.url),"utf8");
const corpus=JSON.parse(fs.readFileSync(new URL("../tests/bai-shopping-intelligence-corpus.json",import.meta.url),"utf8"));
const context={window:{TDStoreAdapters:{catalog:()=>[]}},console};context.window.window=context.window;vm.createContext(context);vm.runInContext(source,context,{filename:"bai-shopping-intelligence.js"});
const intel=context.window.TDBaiShoppingIntelligence;assert.ok(intel);
assert.ok(corpus.cases.length>=50,"regression corpus must stay at 50+ realistic Russian shopping commands");

function comparable(value){return value&&typeof value==="object"?JSON.parse(JSON.stringify(value)):value}
function partial(actual,expected,path="intent"){
  if(Array.isArray(expected)){
    assert.ok(Array.isArray(actual),`${path} should be array`);
    for(const item of expected)assert.ok(actual.some(value=>JSON.stringify(comparable(value))===JSON.stringify(comparable(item))),`${path} missing ${JSON.stringify(item)}`);
    return;
  }
  if(expected&&typeof expected==="object"){
    assert.ok(actual&&typeof actual==="object",`${path} should be object`);
    for(const [key,value] of Object.entries(expected))partial(actual[key],value,`${path}.${key}`);
    return;
  }
  assert.equal(actual,expected,`${path} mismatch`);
}

let passed=0;
for(const row of corpus.cases){
  const intent=intel.interpretFallback(row.input,{lastTouchedProduct:"ham",session:intel.emptySession()});
  try{partial(intent,row.expect);passed++;}
  catch(error){error.message=`[${row.input}] ${error.message}`;throw error}
}
assert.equal(passed,corpus.cases.length);

// AI reasoning is primary when present: normalized model intent wins over the conservative fallback.
const ai=intel.resolveIntent("непонятная разговорная формулировка",{
  aiIntent:{action:"adjust",soft:{categoryWeights:{fruit:1.7},categoryQuality:{meat:"better_if_evidenced"}},confidence:"high"},
  session:intel.emptySession()
});
assert.equal(ai.source,"ai");
assert.equal(ai.intent.soft.categoryWeights.fruit,1.7);
assert.equal(ai.intent.soft.categoryQuality.meat,"better_if_evidenced");

// Unsafe/unknown model fields are stripped rather than becoming executable state.
const sanitized=intel.normalizeIntent({action:"build",hard:{budgetMax:-10,storeLimit:99,evil:"x"},soft:{oneStore:7,categoryWeights:{fruit:999,evil:2}},rawReasoning:"secret",confidence:"superhuman"});
assert.equal(sanitized.hard.budgetMax,null);
assert.equal(sanitized.hard.storeLimit,null);
assert.equal(sanitized.hard.evil,undefined);
assert.equal(sanitized.soft.oneStore,1);
assert.equal(sanitized.soft.categoryWeights.fruit,3);
assert.equal(sanitized.soft.categoryWeights.evil,undefined);
assert.equal(sanitized.rawReasoning,undefined);
assert.ok(["low","medium","high"].includes(sanitized.confidence));

console.log(`Bai Shopping Intelligence corpus passed: ${passed} fuzzy/short Russian commands plus AI-first schema sanitization.`);
