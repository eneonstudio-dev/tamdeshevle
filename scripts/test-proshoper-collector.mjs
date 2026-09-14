import assert from "node:assert/strict";
import { isCatalogPeriodCurrent, parseProshoperCatalog } from "../retailers/proshoper-collector.mjs";

const html = `
<html><body>
<h1>Пятерочка</h1><h2>с 8 по 14 сентября 2026</h2>
<img alt="Логотип Пятерочка" src="logo.png">
<img alt="Морковь мытая упаковка 1кг" src="a.jpg"><div>49 99₽ <s>89 99₽</s></div><div>Морковь мытая упаковка 1кг</div>
<img alt="Картофель мытый" src="b.jpg"><div>79 99₽ <s>94 99₽</s></div><div>Картофель мытый</div>
</body></html>`;
const rows = parseProshoperCatalog(html, "https://example.test/catalog");
assert.equal(rows.length, 2);
assert.equal(rows[0].name, "Морковь мытая упаковка 1кг");
assert.equal(rows[0].price, 49.99);
assert.equal(rows[0].old_price, 89.99);
assert.equal(rows[1].price, 79.99);
assert.equal(rows[1].old_price, 94.99);
assert.ok(rows.every(row => row.availability === "каталог"));
assert.ok(rows.every(row => row.url === "https://example.test/catalog"));

const period = { valid_from: "2026-09-08", valid_to: "2026-09-14" };
assert.equal(
  isCatalogPeriodCurrent(period, "2026-09-14T20:59:00Z", "Europe/Moscow"),
  true,
  "catalog must remain current through the end date in the source market timezone"
);
assert.equal(
  isCatalogPeriodCurrent(period, "2026-09-14T21:01:00Z", "Europe/Moscow"),
  false,
  "catalog must expire once the source market local date moves past valid_to"
);
assert.equal(
  isCatalogPeriodCurrent(period, "2026-09-07T20:59:00Z", "Europe/Moscow"),
  false,
  "catalog must not be accepted before valid_from"
);
assert.equal(isCatalogPeriodCurrent({ valid_from: null, valid_to: null }, "2026-09-10T00:00:00Z"), false);

console.log("Proshoper collector parser and catalog-period contracts passed.");
