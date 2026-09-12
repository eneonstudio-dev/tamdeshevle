import fs from "node:fs";
import vm from "node:vm";

const assert = (condition, message) => { if (!condition) throw new Error(message); };

const purchaseSource = fs.readFileSync("purchase-flow.js", "utf8");
const savingsSource = fs.readFileSync("savings-ledger.js", "utf8");
const comparisonSource = fs.readFileSync("comparison-result-v2.js", "utf8");
const pickupSource = fs.readFileSync("pickup-flow-v1.js", "utf8");
const courierSource = fs.readFileSync("courier-handoff-v1.js", "utf8");
new Function(purchaseSource);
new Function(savingsSource);
new Function(comparisonSource);
new Function(pickupSource);
new Function(courierSource);

{
  const events = [];
  let opens = 0;
  let records = 0;
  const validPlan = { id:"pyat", channel:"bring", rankable:true, total:123, save:12, verifiedComplete:true, name:"Пятёрочка" };
  class CustomEvent { constructor(type, options={}) { this.type = type; this.detail = options.detail; } }
  const window = {
    TDCompare: { fromWindow: () => [validPlan] },
    state: { cart: { a: 1 } },
    TDSavingsLedger: { record: () => { records += 1; } },
    dispatchEvent: event => { events.push(event); return true; },
    open: () => { opens += 1; return {}; },
  };
  const context = vm.createContext({ window, CustomEvent, Date, console });
  vm.runInContext(purchaseSource, context, { filename: "purchase-flow.js" });

  assert(window.TDPurchase.start("pyat", "bring") === true, "first purchase handoff must start");
  assert(window.TDPurchase.start("pyat", "bring") === false, "duplicate purchase handoff must be blocked");
  assert(opens === 1, "duplicate tap must not open retailer twice");
  assert(records === 1, "duplicate tap must not record savings twice");
  assert(events.filter(event => event.type === "td:purchase-started").length === 1, "purchase-started must fire once");
  assert(events.some(event => event.type === "td:purchase-blocked" && event.detail?.reason === "duplicate"), "duplicate block must be observable");

  window.TDCompare.fromWindow = () => [];
  assert(window.TDPurchase.start("missing", "shelf") === false, "missing/incomplete plan must be rejected");
  assert(events.some(event => event.type === "td:purchase-blocked" && event.detail?.reason === "incomplete"), "incomplete block must be observable");
}

{
  let stored = null;
  const events = [];
  const localStorage = {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; }
  };
  class CustomEvent { constructor(type, options={}) { this.type = type; this.detail = options.detail; } }
  const window = { dispatchEvent: event => { events.push(event); return true; } };
  const context = vm.createContext({ window, localStorage, CustomEvent, Date, Math, Number, String, JSON, Object, Array, console });
  vm.runInContext(savingsSource, context, { filename: "savings-ledger.js" });
  const input = { verified:true, saving:25, total:175, storeId:"pyat", storeName:"Пятёрочка", channel:"bring", cart:{ bread:2.9, milk:1, bad:0 } };
  const first = window.TDSavingsLedger.record(input);
  const second = window.TDSavingsLedger.record(input);
  assert(first && first.id, "verified saving must be persisted");
  assert(second?.id === first.id, "same-day duplicate saving must return the existing ledger row");
  assert(first.cart.bread === 2 && first.cart.milk === 1 && first.cart.bad == null, "ledger cart snapshot must normalize quantities");
  assert(events.filter(event => event.type === "td:savings-recorded").length === 1, "duplicate saving must not emit a second recorded event");
  const stats = window.TDSavingsLedger.stats();
  assert(stats.purchases === 1 && stats.confirmed === 25, "persisted saving must be reflected in ledger stats");
}

{
  let events = 0;
  const localStorage = {
    getItem: () => null,
    setItem: () => { throw new Error("quota"); }
  };
  class CustomEvent { constructor(type, options={}) { this.type = type; this.detail = options.detail; } }
  const window = { dispatchEvent: () => { events += 1; return true; } };
  const quietConsole = { ...console, warn() {} };
  const context = vm.createContext({ window, localStorage, CustomEvent, Date, Math, Number, String, JSON, Object, Array, console:quietConsole });
  vm.runInContext(savingsSource, context, { filename: "savings-ledger.js" });
  const row = window.TDSavingsLedger.record({ verified:true, saving:10, total:100, storeId:"pyat", channel:"shelf", cart:{ milk:1 } });
  assert(row === null, "ledger must fail closed when storage rejects a write");
  assert(events === 0, "failed persistence must not emit a false savings-recorded event");
  assert(window.TDSavingsLedger.stats().purchases === 0, "failed persistence must not appear in ledger stats");
}

{
  let opens = 0;
  const validPlan = { id:"pyat", channel:"bring", rankable:true, total:123, save:12, verifiedComplete:true, name:"Пятёрочка" };
  class CustomEvent { constructor(type, options={}) { this.type = type; this.detail = options.detail; } }
  const window = {
    TDCompare: { fromWindow: () => [validPlan] },
    state: { cart: { a: 1 } },
    TDSavingsLedger: { record: () => { throw new Error("storage unavailable"); } },
    dispatchEvent: () => true,
    open: () => { opens += 1; return {}; }
  };
  const quietConsole = { ...console, warn() {} };
  const context = vm.createContext({ window, CustomEvent, Date, console:quietConsole });
  vm.runInContext(purchaseSource, context, { filename: "purchase-flow.js" });
  assert(window.TDPurchase.start("pyat", "bring") === true, "retailer handoff must continue when savings persistence fails");
  assert(opens === 1, "storage failure must not block the retailer handoff");
}

{
  const body = { style: { overflow: "" }, appendChild() {} };
  const document = {
    activeElement: null,
    head: { appendChild() {} },
    body,
    querySelector() { return null; },
    createElement(tag) {
      if (tag === "link") return { dataset: {} };
      return { dataset: {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, remove() {}, className:"", innerHTML:"", tabIndex:0 };
    }
  };
  const shoppingState = { products: [{ id:"a" }, { id:"b" }], lastPlans: [] };
  const window = { TDShoppingState: { get: () => shoppingState } };
  const context = vm.createContext({ window, document, console, JSON, Number, Date, Set, Map, String, Math, requestAnimationFrame: fn => fn() });
  vm.runInContext(comparisonSource, context, { filename: "comparison-result-v2.js" });
  const canonical = window.TDComparisonResultV2?.canonicalPlan;
  assert(typeof canonical === "function", "comparison canonicalizer must be exported");

  const valid = { id:"one", type:"one", products:[{ id:"a", storeId:"pyat", price:100, quantity:1 },{ id:"b", storeId:"pyat", price:40, quantity:2 }] };
  const result = canonical(valid);
  assert(result && result.goods === 180 && result.total === 180, "valid complete plan must retain real total");
  assert(canonical({ ...valid, products:[valid.products[0]] }) === null, "missing basket line must invalidate plan");
  assert(canonical({ ...valid, products:[{...valid.products[0], price:null}, valid.products[1]] }) === null, "missing price must not become zero");
  assert(canonical({ ...valid, products:[{...valid.products[0], price:0}, valid.products[1]] }) === null, "zero price must not silently count as a normal grocery price");
  assert(canonical({ ...valid, products:[{...valid.products[0], quantity:0.5}, valid.products[1]] }) === null, "fractional packaged quantity must be rejected");
  assert(canonical({ ...valid, products:[valid.products[0], {...valid.products[0]}] }) === null, "duplicate SKU must invalidate comparison plan");
  assert(canonical({ ...valid, products:[...valid.products,{id:"c",storeId:"pyat",price:1,quantity:1}] }) === null, "extra SKU must not change the canonical basket");
}

function handoffContext(source, apiName, methodName) {
  const planState = { lastPlans:[{ total:null, products:[{id:"milk",name:"Молоко",storeId:"pyat",price:null,quantity:2},{id:"bread",name:"Хлеб",storeId:"pyat",price:50,quantity:1}] }] };
  const document = {
    documentElement:{style:{overflow:""}},
    head:{appendChild(){}}, body:{appendChild(){}}, activeElement:null,
    querySelector(){return null},
    createElement(){return{dataset:{},style:{},setAttribute(){},remove(){},select(){},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},innerHTML:""}}
  };
  const localStorage={getItem(){return null},setItem(){}};
  const window={TDShoppingState:{get:()=>planState}};
  const context=vm.createContext({window,document,localStorage,console,JSON,Number,String,Math,Map,Set,HTMLElement:function(){},requestAnimationFrame:fn=>fn(),navigator:{clipboard:{writeText:async()=>{}}},STORES:[{id:"pyat",name:"Пятёрочка"}]});
  vm.runInContext(source,context);
  return window[apiName]?.[methodName]?.({});
}

const pickupText=handoffContext(pickupSource,"TDPickupFlowV1","text");
assert(typeof pickupText==="string"&&pickupText.includes("Молоко — 2 шт. · цена уточняется"),"pickup handoff must label an unknown line price instead of 0 ₽");
assert(pickupText.includes("Итого: итог уточняется"),"pickup handoff must not invent a zero total when plan total is unknown");
assert(!pickupText.includes("Молоко — 2 шт. · 0 ₽"),"pickup handoff must never serialize an unknown price as 0 ₽");

const courierText=handoffContext(courierSource,"TDCourierHandoffV1","payload");
assert(typeof courierText==="string"&&courierText.includes("Молоко — 2 шт. · цена уточняется"),"courier handoff must label an unknown line price instead of 0 ₽");
assert(courierText.includes("Товары: итог уточняется"),"courier handoff must not invent a zero total when plan total is unknown");
assert(!courierText.includes("Молоко — 2 шт. · 0 ₽"),"courier handoff must never serialize an unknown price as 0 ₽");

assert(purchaseSource.includes("LOCK_MS") && purchaseSource.includes("td:purchase-blocked"), "purchase flow must keep its own duplicate/incomplete guard");
assert(savingsSource.includes("Savings ledger storage unavailable") && savingsSource.includes("if(!write(rows))return null"), "savings ledger must fail closed when persistence is unavailable");
assert(comparisonSource.includes("APPLY_LOCK_MS"), "comparison apply action must be double-tap guarded");
assert(comparisonSource.includes('setAttribute("role","dialog")') && comparisonSource.includes('setAttribute("aria-modal","true")'), "comparison overlay must be an accessible dialog");
assert(comparisonSource.includes("trapTab") && comparisonSource.includes('event.key==="Escape"'), "comparison dialog must trap focus and support Escape");
assert(comparisonSource.includes("не считаем отсутствующую цену как 0 ₽"), "comparison UI must explain missing-price safety");
assert(pickupSource.includes("knownMoney")&&courierSource.includes("knownMoney"),"MVP handoffs must explicitly distinguish known money from missing prices");

console.log("Purchase/comparison resilience checks passed: verified savings survive storage failures honestly, incomplete baskets and MVP handoffs cannot fake zero-price totals, duplicate handoffs are blocked, and comparison modal lifecycle is guarded.");
