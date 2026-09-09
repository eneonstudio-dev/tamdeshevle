import assert from "node:assert/strict";
import fs from "node:fs";
import { adaptPyatCatalog, parsePyatPack } from "../retailers/pyat.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/pyat.sample.json", "utf8"));
const products = adaptPyatCatalog(snapshot.rows, snapshot);

assert.equal(products.length, 2);
assert.ok(products.every(product => product.retailer === "pyat"));
assert.ok(products.every(product => product.channel === "delivery_catalog"));
assert.ok(products.every(product => product.scope_verified === false));
assert.deepEqual(parsePyatPack("Молоко 1 л"), { value: 1000, unit: "ml", source: "1 л" });
assert.deepEqual(parsePyatPack("Манка 800 г"), { value: 800, unit: "g", source: "800 г" });
assert.equal(products[0].price_rub, 207.99);
assert.equal(products[1].price_rub, 62.99);
assert.equal(products[1].old_price_rub, 69.99);
assert.equal(products[1].promo, true);

const overlay = buildOverlayFromSnapshot(snapshot);
assert.equal(overlay.retailer, "pyat");
assert.equal(overlay.scope_verified, false);
assert.equal(overlay.catalog_context.location_verified, false);
assert.equal(overlay.normalized_count, 2);
assert.equal(Object.keys(overlay.prices).length, 0, "wrong-fat milk and semolina must not become basket prices");
assert.equal(overlay.unmatched.length, 2);

console.log("Pyaterochka adapter tests passed: public catalog normalized and unverified scope cannot create false basket matches.");
