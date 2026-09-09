import fs from "node:fs";
import assert from "node:assert/strict";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/perekrestok.sample.json", "utf8"));
const emptyOverlay = buildOverlayFromSnapshot(snapshot);
assert.equal(emptyOverlay.retailer, "perek");
assert.equal(emptyOverlay.city, "msk");
assert.equal(emptyOverlay.channel, "delivery_catalog");
assert.equal(emptyOverlay.normalized_count, snapshot.rows.length);
assert.equal(emptyOverlay.matched.length, 0);
assert.equal(Object.keys(emptyOverlay.prices).length, 0);

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

console.log("Retailer overlay builder tests passed.");
