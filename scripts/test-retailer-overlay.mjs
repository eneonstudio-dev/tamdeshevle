import fs from "node:fs";
import assert from "node:assert/strict";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/perekrestok.sample.json", "utf8"));
const basketOverlay = buildOverlayFromSnapshot(snapshot);
assert.equal(basketOverlay.retailer, "perek");
assert.equal(basketOverlay.city, "msk");
assert.equal(basketOverlay.channel, "regional_catalog");
assert.equal(basketOverlay.normalized_count, snapshot.rows.length);
assert.equal(basketOverlay.matched.length, 4);
assert.equal(basketOverlay.scope_verified, false);
assert.equal(basketOverlay.catalog_context.price_scope, "regional_catalog");
assert.equal(basketOverlay.catalog_context.store_verified, false);
assert.deepEqual(basketOverlay.prices, {
  eggs_c1: 114.99,
  milk: 71.99,
  oil_sunflower: 161.99,
  pasta: 109.99
});
assert.equal(basketOverlay.unmatched.length, 0);

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
assert.equal(overlay.prices.milk, 101.99);
assert.equal(overlay.prices.pasta, 74.99);
assert.equal(overlay.matched.length, 2);
assert.equal(overlay.store_id, "perek");
assert.equal(overlay.channel, "delivery_catalog");

console.log("Retailer overlay builder tests passed with regional trust metadata and live basket matches.");
