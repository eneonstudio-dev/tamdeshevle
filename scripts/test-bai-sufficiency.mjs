import assert from 'node:assert/strict';

global.window=globalThis;
await import(`../bai-food-knowledge.js?suff=${Date.now()}`);
await import(`../bai-sufficiency.js?suff=${Date.now()}`);

const state={peopleCount:1,duration:7,excludedProducts:[]};
const weak={products:[{id:'waffles',quantity:4},{id:'water',quantity:2}]};
const solid={products:[
  {id:'eggs',quantity:3},{id:'chicken',quantity:3},{id:'bread',quantity:3},{id:'buck',quantity:2},
  {id:'pasta',quantity:2},{id:'banana',quantity:2},{id:'apple',quantity:2},{id:'water',quantity:2}
]};

const a=global.TDBaiSufficiency.audit(state,weak);
const b=global.TDBaiSufficiency.audit(state,solid);
assert.ok(a.score<65,'snacks alone must not look sufficient for a week');
assert.ok(a.gaps.some(x=>x.role==='protein'),'weak basket must expose missing protein role');
assert.ok(a.gaps.some(x=>x.role==='base'),'weak basket must expose missing meal base');
assert.ok(b.score>a.score+25,'mixed food basket must score materially better than snack-only basket');
assert.ok(b.ratios.protein>a.ratios.protein,'protein coverage must improve with meal products');

const twoPeople=global.TDBaiSufficiency.audit({...state,peopleCount:2},solid);
assert.ok(twoPeople.score<b.score,'same basket must look less sufficient when people count doubles');
const repairs=global.TDBaiSufficiency.repairSuggestions(state,weak,null,3);
assert.ok(repairs.length>=2,'weak basket should get bounded repair suggestions');
assert.ok(repairs.some(id=>['eggs','cottage','chicken','ham','dumplings'].includes(id)),'repair must include a protein-role product');

console.log('Bai sufficiency passed: people/days scale demand and snack-heavy baskets cannot masquerade as a full grocery supply.');
