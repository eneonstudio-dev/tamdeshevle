import assert from "node:assert/strict";
import { parseProshoperCatalog } from "../retailers/proshoper-collector.mjs";

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
console.log("Proshoper collector parser contract passed.");
