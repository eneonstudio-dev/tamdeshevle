import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../profile-basket.js',import.meta.url),'utf8');
const storage=new Map();
const fakeHead={appendChild(){}};
const fakeDocument={
  readyState:'loading',
  head:fakeHead,
  body:{},
  createElement(){return {id:'',className:'',textContent:'',style:{},setAttribute(){},addEventListener(){},appendChild(){}};},
  getElementById(){return null;},
  querySelector(){return null;},
  querySelectorAll(){return [];},
  addEventListener(){}
};
class FakeMutationObserver{constructor(fn){this.fn=fn;}observe(){}}
const windowObj={
  state:{screen:'home',city:'msk',storeId:'pyat',cart:{milk:2}},
  TDCompare:{
    defaultChannel(){return 'shelf';},
    basketQuote(products,cart,storeId){return {goods:products.reduce((sum,p)=>sum+(Number(cart[p.id]||0)*Number(p.prices?.[storeId]||0)),0),verifiedComplete:true};},
    feeQuote(){return {known:true,value:0};}
  },
  addEventListener(){},
  dispatchEvent(){}
};
const context={
  window:windowObj,
  state:windowObj.state,
  TDCompare:windowObj.TDCompare,
  STORES:[{id:'pyat',short:'Пятёрочка',kind:'shop'}],
  PRODUCTS:[{id:'milk',prices:{pyat:100}}],
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},
  document:fakeDocument,
  MutationObserver:FakeMutationObserver,
  requestAnimationFrame:fn=>fn(),
  CustomEvent:class {constructor(type,init){this.type=type;this.detail=init?.detail;}},
  console
};
vm.createContext(context);vm.runInContext(source,context,{filename:'profile-basket.js'});
const api=windowObj.TDProfileBasket;
assert.ok(api,'TDProfileBasket exported');
assert.equal(api.currentTotal(),200,'current basket total uses TDCompare');
assert.equal(api.profile().name,'Покупатель');
api.saveProfile({name:'Иван'});assert.equal(api.profile().name,'Иван');
const first=api.snapshot();assert.equal(first.total,200);assert.equal(first.items,2);assert.equal(first.verified,true);
assert.equal(api.history().length,1,'one snapshot for the day');
windowObj.state.cart.milk=3;context.state.cart.milk=3;
const second=api.snapshot();assert.equal(second.total,300);assert.equal(api.history().length,1,'same day snapshot is replaced');assert.equal(api.history()[0].total,300);
assert.match(source,/только полностью подтверждённые корзины/,'verified-only history disclosure present');
console.log('Profile basket tests passed: local profile, current total and one daily snapshot.');
