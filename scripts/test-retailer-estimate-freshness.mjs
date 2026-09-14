import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const quality = require("../data-quality.js");
const source = fs.readFileSync("retailer-price-sync.js", "utf8");
const NOW = "2026-09-14T12:00:00Z";

function makeProducts() {
  return [
    { id: "milk", prices: {}, bring: {} },
    ...Array.from({ length: 9 }, (_, index) => ({ id: `filler_${index}`, prices: {}, bring: {} }))
  ];
}

function overlay(overrides = {}) {
  return {
    schema: "tamdeshevle.retailer-price-overlay.v1",
    retailer: "pyat",
    store_id: "pyat_msk_catalog",
    city: "msk",
    checked_at: "2026-09-14T08:00:00Z",
    prices: { milk: 99 },
    matched: [{
      sku: "milk",
      price_rub: 99,
      source_url: "https://example.test/catalog",
      confidence: 0.9,
      method: "conservative_rule",
      comparison_eligible: true,
      availability: "in_stock"
    }],
    channel: "regional_catalog",
    source_url: "https://example.test/catalog",
    catalog_context: {
      type: "regional_promotional_catalog",
      region: "Москва",
      valid_from: "2026-09-08",
      valid_to: "2026-09-14",
      location_verified: true,
      store_verified: false,
      price_scope: "regional_catalog"
    },
    scope_verified: false,
    ...overrides
  };
}

async function runWithBook(book) {
  const PRODUCTS = makeProducts();
  const events = [];
  const tdQuality = { assessOverlay: value => quality.assessOverlay(value, NOW) };
  const window = {
    TDDataQuality: tdQuality,
    addEventListener() {},
    dispatchEvent(event) { events.push(event); }
  };
  window.window = window;

  const context = vm.createContext({
    window,
    TDDataQuality: tdQuality,
    PRODUCTS,
    state: { city: "msk" },
    fetch: async () => ({ ok: true, json: async () => structuredClone(book) }),
    render() {},
    setInterval() { return 1; },
    clearInterval() {},
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
    Set,
    console
  });

  vm.runInContext(source, context, { filename: "retailer-price-sync.js" });
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  return { PRODUCTS, window, events };
}

const current = await runWithBook(overlay());
assert.equal(
  current.PRODUCTS[0].estimatedPriceMeta.pyat.shelf.price,
  99,
  "fresh in-period regional evidence may surface only through estimatedPriceMeta"
);
assert.equal(current.PRODUCTS[0].prices.pyat, undefined, "regional evidence must never become a verified store price");

const stale = await runWithBook(overlay({
  checked_at: "2026-09-10T08:00:00Z",
  catalog_context: {
    type: "regional_promotional_catalog",
    region: "Москва",
    valid_from: "2026-09-08",
    valid_to: "2026-09-20",
    location_verified: true,
    store_verified: false,
    price_scope: "regional_catalog"
  }
}));
assert.equal(stale.PRODUCTS[0].estimatedPriceMeta, undefined, "expired snapshot must not populate estimatedPriceMeta");

const expiredPeriod = await runWithBook(overlay({
  checked_at: "2026-09-14T08:00:00Z",
  catalog_context: {
    type: "regional_promotional_catalog",
    region: "Москва",
    valid_from: "2026-09-07",
    valid_to: "2026-09-13",
    location_verified: true,
    store_verified: false,
    price_scope: "regional_catalog"
  }
}));
assert.equal(expiredPeriod.PRODUCTS[0].estimatedPriceMeta, undefined, "ended catalog period must suppress the estimate even when checked_at is fresh");

console.log("Retailer estimate freshness passed: regional prices remain non-rankable and disappear when timestamp or catalog period expires.");
