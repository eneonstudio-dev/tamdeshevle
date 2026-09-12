import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("app.js", "utf8");

function boot(savedValue) {
  let fetchCount = 0;
  const app = { innerHTML: "" };
  const history = {
    state: {},
    replaceState(next) { this.state = next || {}; },
    pushState(next) { this.state = next || {}; }
  };
  const window = {
    history,
    TDPriceMeta: null,
    addEventListener() {},
    dispatchEvent() {}
  };
  window.window = window;
  const context = vm.createContext({
    window,
    history,
    document: {
      hidden: false,
      addEventListener() {},
      getElementById(id) { return id === "app" ? app : null; },
      querySelector() { return null; }
    },
    localStorage: {
      getItem(key) { return key === "td" ? savedValue : null; },
      setItem() {}
    },
    TDCompare: {
      cartEntries(products, cart) { return products.filter(product => Number(cart?.[product.id]) > 0); },
      defaultChannel() { return "shelf"; },
      unitPrice(product, storeId, channel) {
        const source = channel === "bring" ? product?.bring : product?.prices;
        const value = source?.[storeId];
        return Number.isFinite(value) ? value : null;
      },
      goodsTotal() { return 0; },
      compare() { return []; },
      basketQuote() { return { complete: false, goods: 0, verifiedComplete: false }; },
      feeQuote() { return { known: false, value: 0 }; }
    },
    fetch() {
      fetchCount += 1;
      return new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ flat: {}, flat_bring: {}, delivery_fee: {} })
      }), 25));
    },
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    console: { warn() {}, error() {}, log() {} }
  });
  vm.runInContext(source, context, { filename: "app.js" });
  return { context, window, app, get fetchCount() { return fetchCount; } };
}

{
  const runtime = boot("{broken-json");
  assert.equal(runtime.window.state.screen, "home");
  assert.equal(runtime.window.state.city, "msk");
  assert.equal(runtime.window.state.storeId, "pyat");
  assert.deepEqual({ ...runtime.window.state.cart }, {});
  assert.equal(runtime.fetchCount, 1);
  runtime.window.loadPrices();
  assert.equal(runtime.fetchCount, 1, "loadPrices must be single-flight while a request is pending");
}

{
  const saved = JSON.stringify({
    screen: "evil-screen",
    city: "moon",
    storeId: "ghost-store",
    cartTouched: true,
    cart: { milk: 2.9, pasta: "3", bread: -4, ghost: 8, eggs: "nope" },
    address: "x".repeat(400)
  });
  const runtime = boot(saved);
  const state = runtime.window.state;
  assert.equal(state.screen, "home");
  assert.equal(state.city, "msk");
  assert.equal(state.storeId, "pyat");
  assert.deepEqual({ ...state.cart }, { milk: 2, pasta: 3 });
  assert.equal(state.address.length, 240);
  assert.equal(runtime.window.setQty("ghost", 1), false);
  assert.equal(Object.hasOwn(state.cart, "ghost"), false);

  vm.runInContext(`PRODUCTS.find(p=>p.id==="milk").prices.pyat=null; state.screen="catalog"; state.q="молоко"; render();`, runtime.context);
  assert.match(runtime.app.innerHTML, /цена уточняется/);
  assert.doesNotMatch(runtime.app.innerHTML, /≈\s*0\s*₽/);
}

assert.match(source, /function readSavedState\(/);
assert.match(source, /function normalizeCart\(/);
assert.match(source, /if \(!Number\.isFinite\(unit\)\) return "цена уточняется"/);
assert.match(source, /if \(priceLoad\.promise\) return priceLoad\.promise/);
assert.match(source, /if \(!Number\.isFinite\(thereUnit\)\)/);

console.log("App runtime resilience passed: corrupt persistence, invalid cart state, duplicate price loads and missing-price rendering are guarded.");
