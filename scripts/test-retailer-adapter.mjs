import fs from "node:fs";
import assert from "node:assert/strict";
import { adaptPerekrestokCatalog, parsePack } from "../retailers/perekrestok.mjs";

const snapshot = JSON.parse(fs.readFileSync("data/retailers/perekrestok.sample.json", "utf8"));
const products = adaptPerekrestokCatalog(snapshot.rows, snapshot);

assert.equal(products.length, snapshot.rows.length);
assert.ok(products.every(product => product.schema === "tamdeshevle.retailer-product.v1"));
assert.ok(products.every(product => product.retailer === "perek"));
assert.ok(products.every(product => product.city === "msk"));
assert.ok(products.every(product => product.source_url === snapshot.source_url));
assert.ok(products.every(product => product.price_rub > 0));
assert.ok(products.every(product => product.availability === "in_stock"));

const cornflakes = products.find(product => product.name.includes("Любятово кукурузные 300г"));
assert.ok(cornflakes);
assert.equal(cornflakes.price_rub, 130.99);
assert.equal(cornflakes.old_price_rub, 156.99);
assert.equal(cornflakes.promo, true);
assert.deepEqual(cornflakes.pack, { value: 300, unit: "g", source: "300г" });

assert.deepEqual(parsePack("Молоко 2,5%, 930 мл"), { value: 930, unit: "ml", source: "930 мл" });
assert.deepEqual(parsePack("Крупа, 1 кг"), { value: 1000, unit: "g", source: "1 кг" });
assert.deepEqual(parsePack("Вода, 1.5 л"), { value: 1500, unit: "ml", source: "1.5 л" });

console.log(`Perekrestok adapter tests passed: ${products.length} live sample products normalized.`);
