import assert from "node:assert/strict";
import { normalizeKuperPayload, fetchKuperQuotes } from "../supabase/functions/alice-bai-webhook/sber-price-intelligence.mjs";

const checkedAt = new Date().toISOString();
const payload = {
  data: {
    offers: [
      { name: "Молоко Простоквашино пастеризованное 2,5% 930 мл", price: "94,99", store: { id: "pyat-1", name: "Пятёрочка", city: "Москва" }, url: "https://example.test/milk", checked_at: checkedAt },
      { name: "Яйца куриные С1 10шт", current_price: 89.9, store: { id: "magnit-2", name: "Магнит", city: "Москва" }, checked_at: checkedAt },
      { name: "Филе цыпленка-бройлера охлажденное 1кг", price_rub: 449.9, merchant: { id: "lenta-3", name: "Лента" }, city: "Москва", checked_at: checkedAt },
      { name: "Йогурт банановый 150г", price: 65, store: { id: "x", name: "Магазин", city: "Москва" }, checked_at: checkedAt },
      { name: "Молоко пастеризованное 2,5% 500мл", price: 49, store: { id: "x2", name: "Магазин", city: "Москва" }, checked_at: checkedAt },
      { name: "Яйца куриные С0 10шт", price: 75, store: { id: "x3", name: "Магазин", city: "Москва" }, checked_at: checkedAt },
      { name: "Молоко Простоквашино 2,5% 930мл", price: 90, store: { id: "spb", name: "СПБ магазин", city: "Санкт-Петербург" }, checked_at: checkedAt }
    ]
  }
};

const quotes = normalizeKuperPayload(payload, ["milk", "eggs", "chicken", "banana"], "msk");
assert.equal(quotes.length, 3);
assert.deepEqual(quotes.map(x => x.productId).sort(), ["chicken", "eggs", "milk"]);
assert.ok(quotes.every(x => x.sourceKind === "partner" && x.sourceProvider === "kuper"));
assert.equal(quotes.find(x => x.productId === "milk")?.price, 94.99);
assert.equal(quotes.find(x => x.productId === "eggs")?.sku, "eggs_c1");
assert.equal(quotes.find(x => x.productId === "chicken")?.price, 449.9);

// With no KUPER_PRICE_FEED_URL configured, provider must be a safe no-op and make no network call.
delete process.env.KUPER_PRICE_FEED_URL;
assert.deepEqual(await fetchKuperQuotes(["milk"], "msk"), []);

console.log("Sber price intelligence tests passed: Kuper normalization, false-positive guards, city filtering and safe no-op mode.");
