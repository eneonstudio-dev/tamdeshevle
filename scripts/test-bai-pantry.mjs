import assert from 'node:assert/strict';

const store=new Map();
global.window=globalThis;
global.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
await import(`../bai-pantry.js?pantry=${Date.now()}`);

const pantry=global.TDBaiPantry;
pantry.clear();
pantry.observe('Дома есть масло и гречка',[{type:'HAS_AT_HOME',value:'масло и гречка'}]);
assert.equal(pantry.has('oil'),true,'explicit home stock must remember oil');
assert.equal(pantry.has('buck'),true,'explicit home stock must remember buck');
assert.equal(pantry.count(),2,'pantry must keep distinct mapped products');
const applied=pantry.applyToState({existingProducts:[]});
assert.ok(applied.existingProducts.includes('масло')&&applied.existingProducts.includes('гречка'),'pantry must project labels into optimizer existingProducts');
const ops=pantry.operations();
assert.ok(ops.every(x=>x.type==='HAS_AT_HOME'),'pantry projection must use existing safe HAS_AT_HOME operation');
pantry.clear();
pantry.add('вода');
pantry.observe('Дома есть гречка и сыр, нужна вода и фрукты',[]);
assert.equal(pantry.has('гречка'),true);
assert.equal(pantry.has('сыр'),true,'cheese at home must be remembered');
assert.equal(pantry.has('вода'),false,'a required product after the home clause must not be mistaken for pantry stock');
pantry.add('вода');
pantry.observe('Дома есть гречка и сыр, нужна вода и фрукты',[{type:'REQUIRE',value:'water'}]);
assert.equal(pantry.has('вода'),false,'an explicit requirement must repair stale poisoned pantry state');

pantry.observe('Масло вкусное',[]);
assert.equal(pantry.count(),2,'un-grounded mention must not change pantry');
pantry.observe('Дома нет масла',[]);
assert.equal(pantry.has('oil'),false,'explicit no-stock statement must remove stale pantry item');

console.log('Bai pantry passed: explicit home stock persists, projects into optimizer state and can be removed without learning random mentions.');
