import assert from "node:assert/strict";
import fs from "node:fs";
import { adaptPyatCatalog, parsePyatPack } from "../retailers/pyat.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/pyat.sample.json", "utf8"));
const products = adaptPyatCatalog(snapshot.rows, snapshot);

assert.equal(products.length, 18);
assert.ok(products.every(product => product.retailer === "pyat"));
assert.ok(products.every(product => product.channel === "regional_catalog"));
assert.ok(products.every(product => product.scope_verified === false));
assert.ok(products.every(product => product.source.site === "proshoper.ru"));
assert.ok(products.every(product => product.source.kind === "aggregator_catalog"));
assert.deepEqual(parsePyatPack("Молоко 1 л"), { value: 1000, unit: "ml", source: "1 л" });
assert.deepEqual(parsePyatPack("Морковь 1 кг"), { value: 1000, unit: "g", source: "1 кг" });
assert.equal(products[0].price_rub, 49.99);
assert.equal(products[0].old_price_rub, 89.99);
assert.equal(products[0].promo, true);

const overlay = buildOverlayFromSnapshot(snapshot);
assert.equal(overlay.retailer, "pyat");
assert.equal(overlay.scope_verified, false);
assert.equal(overlay.catalog_context.location_verified, true);
assert.equal(overlay.catalog_context.store_verified, false);
assert.equal(overlay.catalog_context.price_scope, "regional_catalog");
assert.equal(overlay.normalized_count, 18);
assert.equal(overlay.prices.carrot, 49.99);
assert.equal(overlay.prices.potato, 79.99);
assert.equal(Object.keys(overlay.prices).length, 2);
assert.equal(overlay.unmatched.length, 16);

console.log("Pyaterochka adapter tests passed: regional aggregator catalog normalized without falsely claiming store verification.");
