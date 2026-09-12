import assert from 'node:assert/strict';

const store=new Map();
global.window=globalThis;
global.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
await import(`../bai-goal-memory.js?goal=${Date.now()}`);

const goal=global.TDBaiGoalMemory;
goal.clear();
const ops=[{type:'CHANGE_BUDGET',value:3000},{type:'SET_PEOPLE',value:1},{type:'SET_DURATION',value:7},{type:'SET_COOKING',value:'minimal'},{type:'SET_MODE',value:'one'}];
goal.observe('Собери на 7 дней для себя до 3000 ₽, готовить лень, в одном магазине',ops);
goal.observe('На 7 дней мне одному, максимум 3200 руб, без готовки, один магазин',[
  {type:'CHANGE_BUDGET',value:3200},{type:'SET_PEOPLE',value:1},{type:'SET_DURATION',value:7},{type:'SET_COOKING',value:'minimal'},{type:'SET_MODE',value:'one'}
]);
const r=goal.recommend();
assert.equal(r.duration.value,7,'repeated duration should become a reusable goal default');
assert.equal(r.people.value,1,'repeated people count should become a reusable goal default');
assert.equal(r.cooking.value,'minimal','repeated cooking preference should become a reusable goal default');
assert.equal(r.mode.value,'one','repeated store mode should become a reusable goal default');
assert.ok(r.budget.value>=3000&&r.budget.value<=3200,'budget memory should use a stable median-like value');
const defaults=goal.defaultOperations([]);
assert.ok(defaults.some(x=>x.type==='SET_DURATION'&&x.value===7),'high-confidence duration must be available as a generated default');
assert.ok(defaults.some(x=>x.type==='CHANGE_BUDGET'),'stable repeated budget must be reusable');
const explicit=goal.defaultOperations([{type:'SET_DURATION',value:3},{type:'CHANGE_BUDGET',value:1500}]);
assert.equal(explicit.some(x=>x.type==='SET_DURATION'),false,'explicit current duration must override memory');
assert.equal(explicit.some(x=>x.type==='CHANGE_BUDGET'),false,'explicit current budget must override memory');

console.log('Bai goal memory passed: repeated explicit goals become confidence-gated defaults and never override current instructions.');
