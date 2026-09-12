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
  { id: "milk", name: "Молоко", pack: "1 л", bring: { lenta: 80, origin: 100 }, priceMeta: { lenta: { bring: { kind: "retailer", scopeVerified: true, comparisonEligible: true, availability: "in_stock", freshness: "fresh", checkedAt: "2026-09-10T00:00:00Z", sourceUrl: "https://example.test/milk", retailerName: "Молоко Лента" } }, origin: { shelf: { kind: "retailer", scopeVerified: true, comparisonEligible: true, availability: "in_stock", freshness: "fresh" } } } },
  { id: "bread", name: "Хлеб", pack: "650 г", bring: { lenta: 50 }, prices: { origin: 70 }, priceMeta: { lenta: { bring: { kind: "retailer", scopeVerified: true, comparisonEligible: true, availability: "in_stock", freshness: "fresh", checkedAt: "2026-09-10T00:00:00Z" } }, origin: { shelf: { kind: "retailer", scopeVerified: true, comparisonEligible: true, availability: "in_stock", freshness: "fresh" } } } }
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
assert(basket.coverage === 1 && basket.reason === null, "complete basket coverage/reason failed");
assert(basket.savings === 60, "verified savings failed");
assert(basket.items.length === 2 && basket.items[0].name === "Молоко", "basket must expose SKU detail rows");
assert(basket.items[0].subtotal === 80 && basket.items[1].subtotal === 100, "SKU subtotals failed");
assert(basket.items[0].meta.sourceUrl === "https://example.test/milk", "SKU provenance must be preserved");

const partialProducts = products.map((p, i) => i ? { ...p, bring: { lenta: 1 }, priceMeta: { ...p.priceMeta, lenta: undefined } } : p);
const partial = window.TDStoreIdBridge.basket(point, { products: partialProducts, cart });
assert(partial.verified === false && partial.coveredItems === 1 && partial.totalItems === 2, "partial point basket must not be called complete");
assert(partial.total === null && partial.partialTotal === 80, "unverified educational/network price must not leak into point subtotal");
assert(partial.coverage === .5 && partial.reason === "partial", "partial basket must expose honest coverage/reason");
assert(partial.items[1].verified === false && partial.items[1].price === null, "unverified point SKU must be shown as missing, not estimated");

const noPoint = window.TDStoreIdBridge.resolve(null);
assert(noPoint.verified === false && noPoint.storeId === null, "missing point must resolve safely instead of throwing");
const noQuote = window.TDStoreIdBridge.quote(null);
assert(noQuote.verified === false && /не подтверждена/.test(noQuote.text), "missing point quote must be a safe unverified state");
const unresolvedBasket = window.TDStoreIdBridge.basket(null, { products, cart });
assert(unresolvedBasket.verified === false && unresolvedBasket.reason === "unresolved_point", "missing point basket must fail closed");

const empty = window.TDStoreIdBridge.basket(point, { products, cart: {} });
assert(empty.verified === false, "empty basket must never be called verified");
assert(empty.total === null && empty.partialTotal === 0, "empty basket must not expose a fake zero total");
assert(empty.totalItems === 0 && empty.coverage === 0 && empty.reason === "empty_cart", "empty basket must expose zero coverage and explicit reason");

const malformed = window.TDStoreIdBridge.basket(point, { products: null, cart: null });
assert(malformed.verified === false && malformed.reason === "empty_cart", "malformed basket inputs must degrade to an empty unverified basket");
const badQty = window.TDStoreIdBridge.basket(point, { products, cart: { milk: 1.5 } });
assert(badQty.verified === false && badQty.total === null && badQty.reason === "partial", "fractional/corrupt quantity must not enter a verified point total");
assert(badQty.items[0].verified === false && badQty.items[0].subtotal === null, "invalid quantity row must be surfaced as unverified");

const antipodal = window.TDStoreIdBridge.distance({ lat: 0, lon: 0 }, { lat: 0, lon: 180 });
assert(Number.isFinite(antipodal) && antipodal > 10000, "distance calculation must stay finite at numeric boundaries");

console.log("Store ID bridge tests passed: exact point, safe price key, honest empty/partial baskets, malformed input guards and verified savings.");
