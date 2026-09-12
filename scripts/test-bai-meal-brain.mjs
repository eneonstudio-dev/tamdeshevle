import assert from 'node:assert/strict';

global.window=globalThis;
global.state={city:'msk'};
global.STORES=[{id:'pyat',city:['msk'],kind:'offline'}];
const prices={milk:90,bread:65,chicken:220,banana:90,oil:110,eggs:120,buck:80,sour:85,pasta:75,water:55,apple:95,ham:260,dumplings:180,noodles:70,waffles:100,cottage:130};
global.TDStoreAdapters={adapter:()=>({getPrice:id=>({value:prices[id]??150})})};
global.TDBaiMemory={shouldAvoid:id=>id==='ham',productAffinity:id=>id==='eggs'?2:0};
await import(`../bai-food-knowledge.js?meal=${Date.now()}`);
await import(`../bai-sufficiency.js?meal=${Date.now()}`);
await import(`../bai-smart-substitutions.js?meal=${Date.now()}`);
await import(`../bai-meal-brain.js?meal=${Date.now()}`);

const state={peopleCount:1,duration:7,budget:3000,cookingPreference:'minimal',preferences:[],excludedProducts:['ham'],stores:['pyat']};
const plan=global.TDBaiMealBrain.plan(state,'собери на неделю, готовить лень, фрукты тоже нужны');
assert.equal(plan.schedule.length,7,'week request must produce a seven-day meal schedule');
assert.equal(plan.people,1);
assert.equal(plan.days,7);
assert.equal(plan.requiredProducts.includes('ham'),false,'explicitly excluded or learned-avoided food must stay out of the meal plan');
assert.ok(plan.requiredProducts.some(id=>['banana','apple'].includes(id)),'meal plan should contain fruit/snack coverage');
assert.ok(Object.values(plan.quantityTargets).some(x=>Number(x.amount)>1),'week plan must calculate multi-pack quantities instead of one of everything');
assert.ok(plan.operations.some(x=>x.type==='SET_PRODUCT_AMOUNT'),'meal plan must convert quantities into existing safe shopping operations');
assert.ok(plan.operations.every(x=>['REQUIRE','SET_PRODUCT_AMOUNT'].includes(x.type)),'meal brain must not invent new mutation types');

const schedule=global.TDBaiMealBrain.makeSchedule(state,'готовить лень');
const cooked=[...schedule.schedule].flatMap(day=>['breakfast','lunch','dinner'].map(meal=>day[meal])).filter(x=>x?.prep==='cook').length;
assert.ok(cooked<=3,'minimal-cooking mode should strongly prefer ready/quick rotations across a week');

const two=global.TDBaiMealBrain.plan({...state,peopleCount:2},'на неделю, готовить лень');
const onePacks=Object.values(plan.quantityTargets).reduce((n,x)=>n+Number(x.amount||0),0);
const twoPacks=Object.values(two.quantityTargets).reduce((n,x)=>n+Number(x.amount||0),0);
assert.ok(twoPacks>onePacks,'quantities must scale when number of people increases');

console.log('Bai meal brain passed: day plan, minimal-cooking rotation, exclusions and people-scaled package quantities.');
