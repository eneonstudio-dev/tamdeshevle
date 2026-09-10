import fs from "node:fs";
import vm from "node:vm";

const comparison = fs.readFileSync("comparison-engine.js", "utf8");
const bridge = fs.readFileSync("store-id-bridge.js", "utf8");
const window = { dispatchEvent() {} };
const context = vm.createContext({ window, CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } } });
vm.runInContext(comparison, context, { filename: "comparison-engine.js" });

window.TDRetailerPriceState = {
  overlays: [{
    retailer: "lenta",
    channel: "delivery_catalog",
    usable: true,
    count: 2,
    storeContext: { store_code: "0293", address: "Москва, Дмитровское шоссе, 116 Д" }
  }]
};
vm.runInContext(bridge, context, { filename: "store-id-bridge.js" });

const products = [
  { id: "milk", bring: { lenta: 80, origin: 100 }, priceMeta: { lenta: { bring: { kind: "retailer", freshness: "fresh" } }, origin: { shelf: { kind: "retailer", freshness: "fresh" } } } },
  { id: "bread", bring: { lenta: 50 }, prices: { origin: 70 }, priceMeta: { lenta: { bring: { kind: "retailer", freshness: "fresh" } }, origin: { shelf: { kind: "retailer", freshness: "fresh" } } } }
];
products[0].prices = { origin: 100 };
const cart = { milk: 1, bread: 2 };
const point = { chainId: "lenta", address: "Дмитровское шоссе, 116 Д", osmTags: { ref: "0293" } };
const stores = [{ id: "origin", kind: "shop" }];

function assert(condition, message) { if (!condition) throw new Error(message); }
const match = window.TDStoreIdBridge.resolve(point);
assert(match.verified && match.storeId === "0293", "physical store id must resolve");
assert(match.priceStoreId === "lenta", "price key must stay separate from physical store id");

const basket = window.TDStoreIdBridge.basket(point, { products, cart, stores, referenceStoreId: "origin" });
assert(basket.verified === true, "fully retailer-backed point basket must be verified");
assert(basket.total === 180, "point basket total failed");
assert(basket.coveredItems === 2 && basket.totalItems === 2, "SKU coverage failed");
assert(basket.savings === 60, "verified savings failed");

const partialProducts = products.map((p, i) => i ? { ...p, bring: {}, priceMeta: { ...p.priceMeta, lenta: undefined } } : p);
const partial = window.TDStoreIdBridge.basket(point, { products: partialProducts, cart });
assert(partial.verified === false && partial.coveredItems === 1 && partial.totalItems === 2, "partial point basket must not be called complete");
assert(partial.total === null && partial.partialTotal === 80, "partial basket subtotal failed");

console.log("Store ID bridge tests passed: exact point, price key, basket coverage and verified savings.");
