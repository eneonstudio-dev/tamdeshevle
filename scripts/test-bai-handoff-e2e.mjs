import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const storage=new Map();
global.window=globalThis;
global.localStorage={
  getItem:key=>storage.has(key)?storage.get(key):null,
  setItem:(key,value)=>storage.set(key,String(value)),
  removeItem:key=>storage.delete(key)
};
global.document={
  querySelector:()=>null,
  createElement:()=>({dataset:{},textContent:""}),
  head:{appendChild(){}},
  documentElement:{style:{overflow:""}}
};
global.STORES=[
  {id:"pyat",name:"Пятёрочка"},
  {id:"magnit",name:"Магнит"}
];

global.TDShoppingState={
  get:()=>({
    lastPlans:[{
      id:"multi",
      total:349,
      products:[
        {id:"milk",name:"Молоко 2,5%",storeId:"pyat",quantity:2,price:100},
        {id:"bread",name:"Хлеб дарницкий",storeId:"magnit",quantity:1,price:149}
      ]
    }]
  })
};

await import(`../pickup-flow-v1.js?handoff=${Date.now()}`);
await import(`../courier-handoff-v1.js?handoff=${Date.now()}`);

const pickup=global.TDPickupFlowV1.text("18:30");
assert.match(pickup,/Самовывоз · Там дешевле/);
assert.match(pickup,/Пятёрочка/);
assert.match(pickup,/Магнит/);
assert.match(pickup,/Когда забрать: 18:30/);
assert.match(pickup,/Заказ в магазин не отправлен/);
assert.doesNotMatch(pickup,/Самовывоз · Проще/);

const courier=global.TDCourierHandoffV1.payload({address:"Тестовая, 1",entrance:"2",floor:"3",apartment:"4",phone:"+70000000000",comment:"Позвонить"});
assert.match(courier,/Задание для курьера · Там дешевле/);
assert.match(courier,/Куда привезти: Тестовая, 1/);
assert.match(courier,/подъезд 2, этаж 3, кв\. 4/);
assert.match(courier,/Курьер не вызван и заказ не оформлен/);
assert.doesNotMatch(courier,/Задание для курьера · Проще/);

const load=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
const [checkout,continueStores,retailer]=await Promise.all([
  load("bai-checkout.js"),
  load("continue-in-stores-v1.js"),
  load("real-store-integration-v1.js")
]);

assert.match(checkout,/data-bai-checkout-action="pickup"/);
assert.match(checkout,/data-bai-checkout-action="courier"/);
assert.match(checkout,/data-bai-continue-stores/);
assert.match(checkout,/Бай ничего не оформит без тебя/);
assert.match(checkout,/const lines=\[head,"Там дешевле",""\]/);

for(const [name,source] of [["continue-in-stores",continueStores],["retailer-handoff",retailer]]){
  assert.match(source,/role="dialog"/i,`${name} must expose a dialog role`);
  assert.match(source,/aria-modal="true"/i,`${name} must be modal`);
  assert.match(source,/aria-labelledby=/i,`${name} must have an accessible title`);
  assert.match(source,/e\.key==="Escape"/,`${name} must close on Escape`);
  assert.match(source,/document\.documentElement\.style\.overflow="hidden"/,`${name} must lock background scroll`);
  assert.match(source,/safe-area-inset-bottom/,`${name} must respect mobile safe areas`);
}

assert.match(continueStores,/(?:Сайт|«Там дешевле») не читает корзину магазина/);
assert.match(retailer,/(?:Сайт|«Там дешевле») не читает и не меняет cookie или корзину Магнита/);
assert.match(retailer,/Публичный стабильный deep-link для автоматического наполнения корзины (?:пока )?не подтверждён/);

console.log("Bai handoff E2E contract passed: basket -> checkout -> pickup/courier/store transfer is truthful, branded and accessible.");
