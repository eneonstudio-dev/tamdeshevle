import assert from "node:assert/strict";
import fs from "node:fs";
import { adaptPyatCatalog, parsePyatPack } from "../retailers/pyat.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/pyat.sample.json", "utf8"));
const products = adaptPyatCatalog(snapshot.rows, snapshot);

assert.ok(products.length > 0);
assert.equal(products.length, snapshot.rows.length);
assert.ok(products.every(product => product.retailer === "pyat"));
assert.ok(products.every(product => product.channel === "regional_catalog"));
assert.ok(products.every(product => product.scope_verified === false));
assert.ok(products.every(product => product.source.site === "proshoper.ru"));
assert.ok(products.every(product => product.source.kind === "aggregator_catalog"));
assert.deepEqual(parsePyatPack("Молоко 1 л"), { value: 1000, unit: "ml", source: "1 л" });
assert.deepEqual(parsePyatPack("Морковь 1 кг"), { value: 1000, unit: "g", source: "1 кг" });

const overlay = buildOverlayFromSnapshot(snapshot);
assert.equal(overlay.retailer, "pyat");
assert.equal(overlay.scope_verified, false);
assert.equal(overlay.catalog_context.location_verified, true);
assert.equal(overlay.catalog_context.store_verified, false);
assert.equal(overlay.catalog_context.price_scope, "regional_catalog");
assert.equal(overlay.normalized_count, products.length);
assert.ok(Object.values(overlay.prices).every(Number.isFinite));
assert.ok(overlay.matched.length + overlay.unmatched.length > 0);
assert.ok(overlay.matched.length + overlay.unmatched.length <= products.length);

console.log("Pyaterochka adapter tests passed: changing regional catalogs normalize without falsely claiming store verification.");
