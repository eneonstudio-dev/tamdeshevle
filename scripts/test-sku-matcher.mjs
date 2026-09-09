import assert from "node:assert/strict";
import { matchRetailerProduct, buildPriceOverlay } from "../retailers/sku-matcher.mjs";

const cases = [
  [{ retailer: "perek", retailer_product_id: "2093081", name: "ПРОСТОКВАШИНО Молоко пастеризованное 2,5% 930мл", price_rub: 99.99, availability: "in_stock" }, "milk", "exact_retailer_id"],
  [{ retailer: "perek", name: "Сметана Простоквашино 20%, 300г", price_rub: 129.99, availability: "in_stock" }, "smetana", "conservative_rule"],
  [{ retailer: "perek", name: "Яйца куриные С1, 10шт", price_rub: 109.99, availability: "in_stock" }, "eggs_c1", "conservative_rule"],
  [{ retailer: "perek", name: "Филе куриное охлаждённое, 1кг", price_rub: 399.99, availability: "in_stock" }, "chicken_fil", "conservative_rule"],
  [{ retailer: "perek", name: "Картофель мытый, 1кг", price_rub: 79.99, availability: "in_stock" }, "potato", "conservative_rule"],
  [{ retailer: "perek", name: "Лук репчатый, 1кг", price_rub: 69.99, availability: "in_stock" }, "onion", "conservative_rule"],
  [{ retailer: "perek", name: "Морковь мытая, 1кг", price_rub: 99.99, availability: "in_stock" }, "carrot", "conservative_rule"],
  [{ retailer: "perek", name: "Крупа гречневая ядрица, 900г", price_rub: 89.99, availability: "in_stock" }, "buckwheat", "conservative_rule"],
  [{ retailer: "perek", name: "Макароны рожки, 450г", price_rub: 79.99, availability: "in_stock" }, "pasta", "conservative_rule"],
  [{ retailer: "perek", name: "Чай чёрный Curtis, 100 пакетиков", price_rub: 299.99, availability: "in_stock" }, "tea_black", "conservative_rule"]
];

for (const [product, sku, method] of cases) {
  const result = matchRetailerProduct(product);
  assert.equal(result.matched, true, product.name);
  assert.equal(result.sku, sku, product.name);
  assert.equal(result.method, method, product.name);
}

const falsePositives = [
  { retailer: "perek", name: "Кефирный коктейль клубника 2,5%, 930мл", price_rub: 99 },
  { retailer: "perek", name: "Курица с гречкой готовая, 250г", price_rub: 299 },
  { retailer: "perek", name: "Филе куриное в маринаде для гриля, 1кг", price_rub: 399 },
  { retailer: "perek", name: "Картофель фри замороженный, 700г", price_rub: 249 },
  { retailer: "perek", name: "Морковь по-корейски, 300г", price_rub: 169 },
  { retailer: "perek", name: "Чай чёрный Curtis, 25 пакетиков", price_rub: 109 },
  { retailer: "perek", name: "Макароны по-флотски Шеф Перекрёсток, 250г", price_rub: 249 },
  { retailer: "perek", name: "Мюсли Ого с орехом запечённые, 350г", price_rub: 128.49 }
];

for (const product of falsePositives) {
  const result = matchRetailerProduct(product);
  assert.equal(result.matched, false, `False positive: ${product.name} -> ${result.sku}`);
}

const overlayInput = cases.map(([product]) => product).concat([
  { retailer: "perek", name: "Молоко другая марка 2,5%, 950мл", price_rub: 79.99, availability: "in_stock" },
  { retailer: "perek", name: "Макароны спирали, 450г", price_rub: 69.99, availability: "in_stock" }
]);
const overlay = buildPriceOverlay(overlayInput, {
  retailer: "perek",
  storeId: "perek",
  city: "msk",
  checked_at: "2026-09-10T00:00:00+03:00"
});

assert.equal(overlay.prices.milk, 99.99);
assert.equal(overlay.prices.pasta, 69.99);
assert.equal(overlay.prices.smetana, 129.99);
assert.equal(overlay.prices.eggs_c1, 109.99);
assert.equal(overlay.prices.buckwheat, 89.99);
assert.equal(overlay.prices.chicken_fil, 399.99);
assert.equal(overlay.prices.potato, 79.99);
assert.equal(overlay.prices.onion, 69.99);
assert.equal(overlay.prices.carrot, 99.99);
assert.equal(overlay.prices.tea_black, 299.99);
assert.equal(overlay.matched.length, 10);
assert.equal(overlay.matched.find(item => item.sku === "milk").method, "exact_retailer_id");

console.log("SKU matcher tests passed: exact IDs, expanded basket rules, deterministic selection and false-positive guards.");
