import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/perekrestok.sample.json", "utf8"));
const basketOverlay = buildOverlayFromSnapshot(snapshot);
assert.equal(basketOverlay.retailer, "perek");
assert.equal(basketOverlay.city, "msk");
assert.equal(basketOverlay.channel, "regional_catalog");
assert.equal(basketOverlay.normalized_count, snapshot.rows.length);
assert.equal(basketOverlay.matched.length, 3);
assert.equal(basketOverlay.scope_verified, false);
assert.equal(basketOverlay.catalog_context.price_scope, "regional_catalog");
assert.equal(basketOverlay.catalog_context.store_verified, false);
assert.deepEqual(basketOverlay.prices, {
  eggs_c1: 114.99,
  oil_sunflower: 161.99,
  pasta: 109.99
});
assert.equal(basketOverlay.unmatched.length, 0);
assert.deepEqual(basketOverlay.unavailable || [], []);

const matchingSnapshot = {
  schema: "tamdeshevle.retailer-snapshot.v1",
  retailer: "perek",
  city: "msk",
  channel: "delivery_catalog",
  checked_at: "2026-09-10T00:00:00+03:00",
  rows: [
    { id: 2093081, name: "ПРОСТОКВАШИНО Молоко пастеризованное 2,5% 930мл", price: 101.99, availability: "В наличии много" },
    { name: "Макароны рожки, 450г", price: 74.99, availability: "В наличии много" }
  ]
};
const overlay = buildOverlayFromSnapshot(matchingSnapshot);
assert.equal(overlay.prices.milk, undefined);
assert.equal(overlay.alternatives[0].reason, "different_pack");
assert.equal(overlay.prices.pasta, 74.99);
assert.equal(overlay.matched.length, 1);
assert.equal(overlay.store_id, "perek");
assert.equal(overlay.channel, "delivery_catalog");

// Keep the legacy generic store_id deliberately: runtime must derive the
// physical price key from verified store_context and must not trust a generic
// chain key for exact-store evidence.
const magnitContext = {
  schema: "tamdeshevle.retailer-snapshot.v1",
  retailer: "magnit",
  city: "msk",
  store_id: "magnit",
  channel: "delivery_catalog",
  checked_at: new Date().toISOString(),
  source_url: "https://magnit.ru/",
  scope_verified: true,
  store_context: {
    shop_code: "770105",
    address: "г Москва, ул Чертановская, д 47 к 2",
    shop_type: "1"
  },
  catalog_context: {
    type: "store_scoped_public_catalog",
    location_verified: true,
    shop_code: "770105",
    address: "г Москва, ул Чертановская, д 47 к 2"
  }
};

const unavailableOverlay = buildOverlayFromSnapshot({
  ...magnitContext,
  rows: [{
    id: "pasta-out",
    name: "Макароны рожки 450г",
    price: 74.99,
    availability: "Нет в наличии",
    shop_code: "770105",
    url: "https://magnit.ru/product/pasta-out?shopCode=770105&shopType=1"
  }]
});
assert.equal(unavailableOverlay.prices.pasta, undefined, "out-of-stock product must not become a comparable price");
assert.equal(unavailableOverlay.matched.length, 0);
assert.equal(unavailableOverlay.unavailable.length, 1, "explicit exact-pack out-of-stock evidence must survive overlay building");
assert.equal(unavailableOverlay.unavailable[0].sku, "pasta");
assert.equal(unavailableOverlay.unavailable[0].availability, "out_of_stock");
assert.equal(unavailableOverlay.unavailable[0].comparison_eligible, false);

const mixedAvailabilityOverlay = buildOverlayFromSnapshot({
  ...magnitContext,
  rows: [
    {
      id: "pasta-out",
      name: "Макароны рожки 450г",
      price: 74.99,
      availability: "Нет в наличии",
      shop_code: "770105",
      url: "https://magnit.ru/product/pasta-out?shopCode=770105&shopType=1"
    },
    {
      id: "pasta-in",
      name: "Макароны спагетти 450г",
      price: 79.99,
      availability: "В наличии",
      shop_code: "770105",
      url: "https://magnit.ru/product/pasta-in?shopCode=770105&shopType=1"
    }
  ]
});
assert.equal(mixedAvailabilityOverlay.prices.pasta, 79.99, "an eligible in-stock equivalent must win over an unavailable duplicate");
assert.deepEqual(mixedAvailabilityOverlay.unavailable || [], [], "SKU must not be marked unavailable when an eligible equivalent is in stock");

const scopedRuntimeOverlay = buildOverlayFromSnapshot({
  ...magnitContext,
  rows: [
    {
      id: "pasta-out",
      name: "Макароны рожки 450г",
      price: 74.99,
      availability: "Нет в наличии",
      shop_code: "770105",
      url: "https://magnit.ru/product/pasta-out?shopCode=770105&shopType=1"
    },
    {
      id: "milk-in",
      name: "Молоко Калория ультрапастеризованное 2.5% 1000мл",
      price: 109.99,
      availability: "В наличии",
      shop_code: "770105",
      url: "https://magnit.ru/product/milk-in?shopCode=770105&shopType=1"
    }
  ]
});
assert.equal(scopedRuntimeOverlay.prices.milk, 109.99, "exact-store in-stock evidence must survive overlay building");
assert.equal(scopedRuntimeOverlay.unavailable[0].sku, "pasta");

const products = [
  { id: "pasta", name: "Макароны", prices: {}, bring: { magnit: 99 } },
  { id: "milk", name: "Молоко 2,5%", prices: {}, bring: { magnit: 95 } },
  ...Array.from({ length: 8 }, (_, index) => ({ id: `filler_${index}`, name: `Filler ${index}`, prices: {}, bring: {} }))
];
const listeners = new Map();
const sandbox = {
  console: { warn() {}, error() {}, log() {} },
  Date,
  Intl,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Map,
  Set,
  Math,
  PRODUCTS: products,
  state: { city: "msk" },
  render() {},
  CustomEvent: class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  },
  fetch: async url => {
    if (String(url).includes("magnit.overlay.json")) return { ok: true, json: async () => scopedRuntimeOverlay };
    return { ok: false, status: 404, json: async () => ({}) };
  },
  setInterval() { return 1; },
  clearInterval() {},
  addEventListener(type, handler) { listeners.set(type, handler); },
  dispatchEvent() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("data-quality.js", "utf8"), sandbox, { filename: "data-quality.js" });
vm.runInContext(fs.readFileSync("retailer-price-sync.js", "utf8"), sandbox, { filename: "retailer-price-sync.js" });
await new Promise(resolve => setImmediate(resolve));

const scopedMagnitId = "magnit:770105";
assert.equal(products[0].bring.magnit, 99, "exact-store out-of-stock evidence must not suppress the generic Magnit baseline");
assert.equal(products[0].bring[scopedMagnitId], null, "exact-store out-of-stock evidence must suppress only the matching physical-store price key");
assert.equal(products[1].bring.magnit, 95, "exact-store in-stock evidence must not overwrite the generic Magnit baseline");
assert.equal(products[1].bring[scopedMagnitId], 109.99, "exact-store in-stock evidence must be stored only under the physical-store price key");
assert.equal(sandbox.TDPriceMeta.get("pasta", "magnit", "bring"), null, "generic Magnit must not inherit exact-store provenance");
assert.equal(sandbox.TDPriceMeta.get("milk", "magnit", "bring"), null, "generic Magnit must not inherit exact-store price metadata");
const unavailableMeta = sandbox.TDPriceMeta.get("pasta", scopedMagnitId, "bring");
assert.equal(unavailableMeta.availability, "out_of_stock");
assert.equal(unavailableMeta.price, null);
assert.equal(unavailableMeta.scopeVerified, true);
assert.equal(unavailableMeta.comparisonEligible, false);
const milkMeta = sandbox.TDPriceMeta.get("milk", scopedMagnitId, "bring");
assert.equal(milkMeta.price, 109.99);
assert.equal(milkMeta.availability, "in_stock");
assert.equal(milkMeta.storeId, scopedMagnitId);
const magnitRuntime = sandbox.TDRetailerPriceState.overlays.find(item => item.retailer === "magnit");
assert.equal(magnitRuntime.storeId, "770105", "runtime must publish the physical store identifier for point binding");
assert.equal(magnitRuntime.priceStoreId, scopedMagnitId, "runtime must publish the scoped price key consumed by the store-id bridge");
assert.equal(magnitRuntime.count, 1);
assert.equal(magnitRuntime.unavailableCount, 1);

console.log("Retailer overlay tests passed with regional trust metadata, exact-store scoped price keys and fail-closed unavailability.");
