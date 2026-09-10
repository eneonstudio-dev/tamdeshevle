import fs from "node:fs";
import assert from "node:assert/strict";
import { adaptPerekrestokCatalog, parsePack } from "../retailers/perekrestok.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/perekrestok.sample.json", "utf8"));
const products = adaptPerekrestokCatalog(snapshot.rows, snapshot);

assert.equal(products.length, snapshot.rows.length);
assert.ok(products.every(product => product.schema === "tamdeshevle.retailer-product.v1"));
assert.ok(products.every(product => product.retailer === "perek"));
assert.ok(products.every(product => product.city === "msk"));
assert.ok(products.every(product => product.source_url && product.source_url.startsWith("https://promo.perekrestok.ru/")));
assert.ok(products.every(product => product.price_rub > 0));
assert.ok(products.every(product => product.availability === "in_stock"));
assert.ok(products.every(product => product.scope_verified === false));
assert.ok(products.every(product => product.channel === "regional_catalog"));
assert.ok(products.every(product => product.catalog_context?.price_scope === "regional_catalog"));
assert.ok(products.every(product => product.source.site === "promo.perekrestok.ru"));

const milk = products.find(product => product.name.startsWith("Молоко Для Всей Семьи"));
assert.ok(milk);
assert.equal(milk.price_rub, 71.99);
assert.equal(milk.promo, false);
assert.deepEqual(milk.pack, { value: 900, unit: "ml", source: "900мл" });

const oil = products.find(product => product.retailer_product_id === "4269568");
assert.ok(oil);
assert.equal(oil.price_rub, 161.99);
assert.deepEqual(oil.pack, { value: 1000, unit: "ml", source: "1л" });

const overlay = buildOverlayFromSnapshot(snapshot);
assert.equal(overlay.scope_verified, false);
assert.equal(overlay.channel, "regional_catalog");
assert.equal(overlay.catalog_context.store_verified, false);
assert.equal(overlay.catalog_context.price_scope, "regional_catalog");
assert.equal(Object.keys(overlay.prices).length, 3);

assert.deepEqual(parsePack("Молоко 2,5%, 930 мл"), { value: 930, unit: "ml", source: "930 мл" });
assert.deepEqual(parsePack("Крупа, 1 кг"), { value: 1000, unit: "g", source: "1 кг" });
assert.deepEqual(parsePack("Вода, 1.5 л"), { value: 1500, unit: "ml", source: "1.5 л" });

console.log(`Perekrestok adapter tests passed: ${products.length} regional catalog products normalized without claiming store verification.`);
