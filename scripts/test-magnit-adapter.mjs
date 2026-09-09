import assert from "node:assert/strict";
import { adaptMagnitCatalog, parseMagnitPack } from "../retailers/magnit.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const snapshot = {
  schema: "tamdeshevle.retailer-snapshot.v1",
  retailer: "magnit",
  city: "msk",
  channel: "delivery_catalog",
  checked_at: "2026-09-10T02:00:00+03:00",
  method: "public_product_pages",
  store_context: {
    shop_code: "770105",
    address: "Москва, тестовый магазин",
    shop_type: "1"
  },
  rows: [
    { id: "3454700001", shop_code: "770105", name: "Куриное яйцо C1 10шт в ассортименте", price: 70.79, availability: "В корзину", url: "https://magnit.ru/product/3454700001-test?shopCode=770105" },
    { id: "1000166930", shop_code: "770105", name: "Макароны Лапша Магнит 450г в ассортименте", price: 36.99, availability: "В корзину", url: "https://magnit.ru/product/1000166930-test?shopCode=770105" },
    { id: "9639630174", shop_code: "770105", name: "Масло подсолнечное Золотая семечка рафинированное 1л", price: 144.99, availability: "В корзину", url: "https://magnit.ru/product/9639630174-test?shopCode=770105" }
  ]
};

const products = adaptMagnitCatalog(snapshot.rows, snapshot);
assert.equal(products.length, 3);
assert.ok(products.every(product => product.retailer === "magnit"));
assert.ok(products.every(product => product.store_context.shop_code === "770105"));
assert.ok(products.every(product => product.availability === "in_stock"));
assert.deepEqual(parseMagnitPack("Макароны 450г"), { value: 450, unit: "g", source: "450г" });
assert.deepEqual(parseMagnitPack("Масло 1л"), { value: 1000, unit: "ml", source: "1л" });

const overlay = buildOverlayFromSnapshot(snapshot);
assert.equal(overlay.retailer, "magnit");
assert.equal(overlay.store_context.shop_code, "770105");
assert.equal(overlay.prices.eggs_c1, 70.79);
assert.equal(overlay.prices.pasta, 36.99);
assert.equal(overlay.prices.oil_sunflower, 144.99);
assert.equal(overlay.matched.length, 3);

assert.throws(() => adaptMagnitCatalog(snapshot.rows, { city: "msk" }), /store_context\.shop_code/);
assert.throws(() => adaptMagnitCatalog([{ ...snapshot.rows[0], shop_code: "999999" }], snapshot), /shop_code mismatch/);

console.log("Magnit adapter tests passed: store context enforced and three basket SKUs matched.");
