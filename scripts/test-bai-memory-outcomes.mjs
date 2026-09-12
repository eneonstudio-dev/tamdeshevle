import assert from 'node:assert/strict';

const storage=new Map();
global.window=globalThis;
global.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
await import(`../bai-memory.js?outcomes=${Date.now()}`);
const m=global.TDBaiMemory;

m.learn('собери на неделю до 3000',{
  operations:[{type:'CHANGE_BUDGET',value:3000},{type:'REQUIRE',value:'eggs'},{type:'REQUIRE',value:'banana'}],
  journey:{autoApplied:true,explicitOperations:[{type:'CHANGE_BUDGET',value:3000}],recommendation:{strategy:'easy',title:'Без возни',productIds:['eggs','banana']}}
});
assert.equal(m.signal('eggs').added||0,0,'Bai-generated REQUIRE must not masquerade as explicit user preference');
assert.deepEqual(m.pending().products,['eggs','banana'],'autonomous recommendation must become a pending outcome to learn from');

m.learn('убери бананы',{operations:[{type:'REMOVE_PRODUCT',value:'banana'}]});
assert.ok((m.outcome('banana').rejected||0)>=1,'removing a recommended product must create a negative outcome signal');
assert.ok(m.productAffinity('banana')<0,'rejected recommendation must reduce future affinity');
assert.ok(m.get().correctedPlans>=1,'correction count must reflect edits to Bai recommendations');

for(let i=0;i<2;i++){
  m.noteRecommendation({productIds:['banana'],source:'test'});
  m.learn('бананы опять убери',{operations:[{type:'REMOVE_PRODUCT',value:'banana'}]});
}
assert.equal(m.shouldAvoid('banana'),true,'repeated rejection must eventually stop automatic re-suggestion');

m.learn('Выбираю вариант «Без возни»',{operations:[{type:'REQUIRE',value:'eggs'}]});
assert.ok((m.signal('eggs').added||0)>=1,'explicit strategy choice may teach product preference');
assert.ok((m.outcome('eggs').accepted||0)>=1,'manual strategy selection must count as accepted outcome');

m.noteRecommendation({productIds:['cottage'],source:'test'});
m.learn('оставь так',{operations:[]});
assert.ok((m.outcome('cottage').accepted||0)>=1,'explicit approval phrase must reinforce the pending recommendation');

console.log('Bai memory outcomes passed: generated choices are separated from user intent, corrections lower affinity and explicit acceptance reinforces it.');
