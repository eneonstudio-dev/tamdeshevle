import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const storage = new Map();
const PRODUCTS = [
  { id:"bread_dark", name:"Хлеб ржано-пшеничный", pack:"650 г", brand:"", tags:["хлеб"] },
  { id:"chicken_fil", name:"Филе куриное", pack:"1 кг", brand:"", tags:["мясо","курица"] },
  { id:"eggs_c1", name:"Яйца С1", pack:"10 шт", brand:"", tags:["яйца"] },
  { id:"milk", name:"Молоко 2,5%", pack:"1 л", brand:"", tags:["молочка"] },
  { id:"water", name:"Вода", pack:"5 л", brand:"", tags:["вода"] },
  { id:"banana", name:"Бананы", pack:"1 кг", brand:"", tags:["фрукты"] },
  { id:"apple", name:"Яблоки", pack:"1 кг", brand:"", tags:["фрукты"] },
  { id:"buckwheat", name:"Гречка", pack:"900 г", brand:"", tags:["крупы"] },
  { id:"pasta", name:"Макароны", pack:"450 г", brand:"", tags:["макароны"] },
  { id:"potato", name:"Картофель", pack:"1 кг", brand:"", tags:["овощи"] },
  { id:"onion", name:"Лук", pack:"1 кг", brand:"", tags:["овощи"] },
  { id:"carrot", name:"Морковь", pack:"1 кг", brand:"", tags:["овощи"] }
];
const prices = {
  bread_dark:80, chicken_fil:430, eggs_c1:125, milk:105, water:120, banana:150,
  apple:140, buckwheat:100, pasta:90, potato:85, onion:75, carrot:90
};

const context = { console, JSON, Math, Number, String, Object, Array, Set, Map, Date, Promise };
context.window = context;
context.localStorage = {
  getItem:key => storage.get(key) ?? null,
  setItem:(key,value) => storage.set(key,String(value))
};
context.CustomEvent = class CustomEvent { constructor(type,init={}) { this.type=type; this.detail=init.detail; } };
context.dispatchEvent = () => {};
context.render = () => {};
context.state = { city:"msk", storeId:"pyat", cart:{}, cartTouched:false };
context.STORES = [{ id:"pyat", name:"Пятёрочка", kind:"shop", city:["msk"] }];
context.PRODUCTS = PRODUCTS;
context.TDStoreAdapters = {
  catalog:() => PRODUCTS,
  adapter:storeId => ({
    getProduct:id => PRODUCTS.find(product => product.id === id) || null,
    getPrice:id => ({ value:prices[id] ?? null, quality:"LIVE" })
  })
};
vm.createContext(context);

for (const file of ["shopping-state.js","shopping-optimizer.js","shopping-conversation.js","bai-brain.js"]) {
  vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),"utf8"), context, { filename:file });
}

const prompt = "Собери продукты на неделю до 5000 ₽";
const proposal = await context.TDBaiBrain.route(prompt, []);
const operations = Array.from(proposal.operations || []);

assert.equal(
  operations.some(op => op.type === "CHANGE_BUDGET" && Number(op.value) === 5000),
  true,
  "MVP-001 must preserve the explicit 5000 RUB hard budget"
);
assert.equal(
  operations.some(op => op.type === "SET_DURATION" && Number(op.value) === 7),
  true,
  "MVP-001 must interpret one week as seven days"
);
assert.equal(
  operations.some(op => op.type === "SET_INTENT" && op.value === "build") || proposal.goal?.task === "basket",
  true,
  "MVP-001 must remain a grocery basket-build intent"
);

const result = context.TDShoppingConversation.apply(prompt, operations);
const state = result.state;
const plan = result.plans?.[0];

assert.equal(state.budget, 5000, "executed ShoppingState must retain the hard budget");
assert.equal(state.duration, 7, "executed ShoppingState must retain seven-day duration");
assert.ok(plan, "MVP-001 must produce an executable PurchasePlan");
assert.ok(Array.isArray(plan.products) && plan.products.length >= 5, "week basket must contain a realistic non-empty grocery mix");
assert.ok(plan.products.every(line => PRODUCTS.some(product => product.id === line.id)), "PurchasePlan may contain only grounded grocery candidates");
assert.ok(new Set(plan.products.map(line => line.id)).size >= 5, "week basket must contain multiple grocery categories/SKUs");
assert.ok(Number.isFinite(plan.total), "MVP-001 plan total must be calculable for the fully priced fixture");
assert.ok(plan.total <= 5000, `hard budget must hold when a feasible basket exists; got ${plan.total}`);
assert.equal(state.lastPlans?.[0]?.id, plan.id, "executed plan must be persisted as the current PurchasePlan");

console.log(`MVP-001 passed: week intent -> ${plan.products.length} grounded grocery SKUs, total ${plan.total} ₽ within 5000 ₽.`);
