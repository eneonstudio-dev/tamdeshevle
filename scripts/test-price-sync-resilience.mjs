import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("price-sync.js", "utf8");
const events = [];
const window = {
  addEventListener() {},
  dispatchEvent(event) { events.push(event); }
};
window.window = window;

const context = vm.createContext({
  window,
  document: { hidden: false, addEventListener() {} },
  navigator: { onLine: true },
  PRODUCTS: [
    { id: "milk", prices: { pyat: 104 }, bring: { pyat: 119 } },
    { id: "bread_dark", prices: { pyat: 69 }, bring: { pyat: 79 } }
  ],
  STORES: [
    { id: "pyat", name: "Пятёрочка" },
    { id: "lavka", name: "Лавка", delivery: 199 }
  ],
  PRICE_BOOK: {
    schema: "test-v1",
    flat: {
      msk: { milk: { pyat: 777 }, bread: { pyat: "88" } },
      spb: { bread: { pyat: null } }
    },
    flat_bring: {
      msk: { milk: { pyat: 888 } },
      spb: {}
    },
    delivery_fee: { lavka: "321", pyat: "broken" }
  },
  state: { city: "msk" },
  render() {},
  loadPrices: async () => true,
  setTimeout() { return 1; },
  clearTimeout() {},
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  },
  Date,
  Object,
  Number,
  Boolean,
  String,
  Array,
  Map,
  console
});

vm.runInContext(source, context, { filename: "price-sync.js" });
assert.equal(typeof window.TDApplyPrices, "function", "price applier must be exported");
assert.equal(typeof window.TDPricePlanHint, "function", "safe plan hint must be exported");

assert.equal(window.TDApplyPrices(), true);
assert.equal(context.PRODUCTS[0].prices.pyat, 777, "Moscow shelf overlay must apply");
assert.equal(context.PRODUCTS[0].bring.pyat, 888, "Moscow delivery overlay must apply");
assert.equal(context.PRODUCTS[1].prices.pyat, 88, "price aliases and numeric strings must be normalized");
assert.equal(context.STORES[1].delivery, 321, "valid delivery fee override must apply");
assert.equal(Object.hasOwn(context.STORES[0], "delivery"), false, "invalid delivery fee must not poison store data");

context.state.city = "spb";
assert.equal(window.TDApplyPrices(), true);
assert.equal(context.PRODUCTS[0].prices.pyat, 104, "missing SPB shelf price must reset to baseline instead of leaking Moscow");
assert.equal(context.PRODUCTS[0].bring.pyat, 119, "missing SPB delivery price must reset to baseline instead of leaking Moscow");
assert.equal(context.PRODUCTS[1].prices.pyat, null, "explicit null price must remain unavailable");
assert.equal(context.PRODUCTS[1].bring.pyat, 79, "missing bring row must restore baseline");
assert.equal(window.TDPriceState.city, "spb");
assert.equal(window.TDPriceState.overlayAvailable, true);

context.state.city = "ghost";
assert.equal(window.TDApplyPrices(), true);
assert.equal(context.PRODUCTS[0].prices.pyat, 104, "unknown city must not retain previous city price");
assert.equal(context.PRODUCTS[1].prices.pyat, 69, "unknown city must fully restore product baseline");
assert.equal(window.TDPriceState.overlayAvailable, false, "missing city overlay must be surfaced explicitly");

context.PRICE_BOOK.flat.msk.milk.pyat = "not-a-price";
context.state.city = "msk";
window.TDApplyPrices();
assert.equal(context.PRODUCTS[0].prices.pyat, 104, "invalid overlay value must be ignored rather than poison the baseline");

const unknownGoods = window.TDPricePlanHint({ channel: "bring", feeKnown: true, goods: null, delivery: 199, time: "20–40 мин" });
assert.match(unknownGoods, /стоимость товаров уточняется/);
assert.doesNotMatch(unknownGoods, /null|NaN/);
const unknownFee = window.TDPricePlanHint({ channel: "bring", feeKnown: false, goods: 500, delivery: null });
assert.match(unknownFee, /товары 500 ₽/);
assert.match(unknownFee, /тариф доставки не заложен/);
assert.equal(window.TDPricePlanHint({ channel: "shelf" }), "сходить, полка · без адреса");
assert.ok(events.some(event => event.type === "td:prices-applied"), "price application event must still fire");

console.log("Price sync resilience passed: city overlays reset cleanly, bad values are rejected and delivery hints never stringify missing money.");
