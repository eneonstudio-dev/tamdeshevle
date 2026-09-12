import assert from 'node:assert/strict';

global.window=globalThis;
global.state={city:'msk'};
global.STORES=[{id:'pyat',city:['msk'],kind:'offline'}];
const prices={milk:90,bread:65,chicken:220,banana:90,oil:110,eggs:120,buck:80,sour:85,pasta:75,water:55,apple:95,ham:260,dumplings:180,noodles:70,waffles:100,cottage:130};
global.TDStoreAdapters={adapter:()=>({getPrice:id=>({value:prices[id]??150})})};
global.TDBaiMemory={
  get:()=>({cooking:'minimal',preferences:[]}),
  filterRequired:ids=>ids.filter(id=>id!=='ham'),
  shouldAvoid:id=>id==='ham',
  productAffinity:id=>id==='eggs'?2:0,
  scoreStrategy:()=>({delta:0,reasons:[],avoided:[]})
};
global.TDShoppingOptimizer={
  eligibleStores:()=>['pyat'],
  optimize:s=>{
    const ids=[...new Set(s.requiredProducts||[])];
    const products=ids.map(id=>({id,name:id,quantity:Math.max(1,Number(s.quantityTargets?.[id]?.amount)||1),price:prices[id]??150,storeId:'pyat'}));
    const goods=products.reduce((n,x)=>n+x.price*x.quantity,0);
    return[{id:'one_pyat',type:'one',stores:['pyat'],products,goods,total:goods,quality:'ESTIMATED'}];
  }
};

await import(`../bai-planner.js?pipeline=${Date.now()}`);
const base={budget:3000,peopleCount:1,duration:7,cookingPreference:'minimal',mode:'one',stores:['pyat'],preferences:[],requiredProducts:[],preferredProducts:[],excludedProducts:['ham'],quantityTargets:{}};
const pack=global.TDBaiPlanner.build(base,'собери мне еду на неделю до 3000, готовить лень, сам реши');
assert.ok(pack.recommended,'planner must still return a recommendation');
assert.ok(pack.recommended.mealPlan,'full grocery journey must carry a meal plan');
assert.equal(pack.recommended.mealPlan.schedule.length,7,'planner must preserve day-by-day plan');
assert.ok(pack.recommended.operations.some(x=>x.type==='SET_PRODUCT_AMOUNT'),'planner must turn meal quantities into safe basket operations');
assert.ok(pack.recommended.sufficiency,'planner must score whether planned quantities cover people and days');
assert.equal(pack.recommended.productIds.includes('ham'),false,'learned/excluded product must not leak back into final optimizer plan');
assert.match(global.TDBaiPlanner.explain(pack,base),/По запасу:/,'explanation must surface sufficiency instead of hiding it');

const snack=global.TDBaiPlanner.build({...base,duration:1,budget:500},'собери перекус к фильму');
assert.ok(snack.recommended,'single-meal request must still produce a strategy');
assert.equal(Boolean(snack.recommended.mealPlan),false,'single snack request must not explode into a full-day/week meal plan');

console.log('Bai meal pipeline passed: full journeys get schedule, quantities and sufficiency while narrow meal requests stay narrow.');
