import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const store=new Map();
const listeners=[];
const window={
  localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))},
  dispatchEvent:e=>{listeners.push(e.type);return true},
  TDShoppingState:{get:()=>({requiredProducts:['milk','bread'],onlyProducts:[],quantityTargets:{milk:{amount:1,unit:'l'}},stores:['pyat'],mode:'one',peopleCount:1,duration:1,cookingPreference:'normal',preferences:[],excludedProducts:[],lastPlans:[{total:500,products:[{id:'milk',quantity:1},{id:'bread',quantity:1}]}]})}
};
const context={window,localStorage:window.localStorage,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},console,Date,Math,JSON};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../basket-price-history.js',import.meta.url),'utf8'),context,{filename:'basket-price-history.js'});
const api=window.TDBasketPriceHistory;
assert.ok(api,'API should be exposed');
const snap=window.TDShoppingState.get();
const sig=api.signature(snap,snap.lastPlans[0].products);
const first=api.record({basketId:'b1',name:'Недельная',signature:sig,total:500,at:'2026-09-10T10:00:00Z',source:'saved'});
assert.equal(first.total,500);
const duplicate=api.record({basketId:'b1',name:'Недельная',signature:sig,total:500,at:'2026-09-10T19:00:00Z',source:'repeat'});
assert.equal(duplicate.id,first.id,'same-day same-total record should dedupe');
api.record({basketId:'b1',name:'Недельная',signature:sig,total:450,at:'2026-09-11T10:00:00Z',source:'repeat'});
const stats=api.stats('b1');
assert.equal(stats.count,2);
assert.equal(stats.first.total,500);
assert.equal(stats.latest.total,450);
assert.equal(stats.delta,-50);
assert.equal(stats.deltaPct,-10);
assert.equal(stats.min,450);
assert.equal(api.removeBasket('b1'),true);
assert.equal(api.stats('b1').count,0);
assert.ok(listeners.includes('td:basket-price-history'));
console.log('basket price history: ok');
