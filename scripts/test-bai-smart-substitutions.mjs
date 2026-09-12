import assert from 'node:assert/strict';

global.window=globalThis;
global.state={city:'msk'};
global.STORES=[{id:'pyat',city:['msk'],kind:'offline'},{id:'magnit',city:['msk'],kind:'offline'}];
const prices={ham:320,cottage:170,eggs:190,chicken:260,dumplings:230,bread:80,buck:90,pasta:95,noodles:70,banana:110,apple:120,water:60,milk:100};
global.TDStoreAdapters={adapter:()=>({getPrice:id=>({value:prices[id]??200})})};
global.TDBaiMemory={shouldAvoid:id=>id==='chicken',productAffinity:id=>id==='cottage'?3:0};
await import(`../bai-food-knowledge.js?subs=${Date.now()}`);
await import(`../bai-smart-substitutions.js?subs=${Date.now()}`);

const state={stores:['pyat'],excludedProducts:[],cookingPreference:'minimal'};
const ranked=global.TDBaiSmartSubstitutions.rank('ham',state,{preferReady:true});
assert.ok(ranked.length,'ham must have role-compatible substitutions');
assert.equal(ranked.some(x=>x.id==='chicken'),false,'learned avoided product must not be proposed');
assert.equal(ranked[0].id,'cottage','ready, cheaper and positively learned substitute should rank first');
assert.ok(ranked[0].price<ranked[0].fromPrice,'top substitute should expose real price advantage in the mocked scope');

const repaired=global.TDBaiSmartSubstitutions.repairRequired(['ham','bread'],{...state,excludedProducts:['ham']},{preferReady:true});
assert.equal(repaired.required.includes('ham'),false,'excluded required product must be replaced rather than reintroduced');
assert.ok(repaired.replacements.some(x=>x.from==='ham'),'replacement must be auditable');
assert.ok(repaired.required.includes('bread'),'unrelated required products must survive replacement');

console.log('Bai smart substitutions passed: role, price, cooking effort, exclusions and learned taste affect replacement ranking.');
