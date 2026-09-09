import assert from "node:assert/strict";
import { discoverMagnitProductUrls, pageUnitPrice, parseMagnitProductPage, rankMagnitProductUrls, withMagnitStore } from "../retailers/magnit-collector.mjs";

const store_context = { shop_code: "770105", shop_type: "1", address: "г Москва, ул Чертановская, д 47 к 2" };
const context = { store_context, expected_address_tokens: ["Чертановская", "47"] };

const productHtml = `<!doctype html><html><head>
<title>Куриное яйцо C1 10шт в ассортименте – купить с доставкой | г Москва, ул Чертановская, д 47 к 2</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Куриное яйцо C1 10шт в ассортименте","brand":{"@type":"Brand","name":"Магнит"},"offers":{"@type":"Offer","price":"70.79","priceCurrency":"RUB"}}</script>
</head><body><h1>Куриное яйцо C1 10шт в ассортименте</h1><button>Добавить в корзину</button><footer>г Москва, ул Чертановская, д 47 к 2</footer></body></html>`;

const row = parseMagnitProductPage(productHtml, "https://magnit.ru/product/3454700001-yaytso_stolovoe_s1_10sht_boks_20", context);
assert.equal(row.id, "3454700001");
assert.equal(row.name, "Куриное яйцо C1 10шт в ассортименте");
assert.equal(row.price, 70.79);
assert.equal(row.unit_price, null);
assert.equal(row.shop_code, "770105");
assert.equal(row.availability, "В наличии");
assert.match(row.url, /shopCode=770105/);

const produceHtml = `<html><head><title>Лук репчатый 700г – купить | г Москва, ул Чертановская, д 47 к 2</title></head><body><h1>Лук репчатый 700г</h1><div>41.99 ₽</div><div>59.99 ₽/1кг</div><button>Добавить в корзину</button><div>Чертановская 47</div></body></html>`;
const produce = parseMagnitProductPage(produceHtml, "https://magnit.ru/product/9072651204-luk_repchatyy", context);
assert.equal(produce.price, 41.99);
assert.equal(produce.unit_price, 59.99);
assert.equal(produce.unit_price_unit, "kg");
assert.deepEqual(pageUnitPrice(produceHtml), { price: 59.99, unit: "kg" });

const catalogHtml = `<a href="/product/3454700001-yaytso_stolovoe_s1_10sht_boks_20">Яйца</a>
<a href="https://magnit.ru/product/1000166930-magnit_makarony_lapsha_450g_p_up_24?shopCode=999999">Макароны</a>`;
const urls = discoverMagnitProductUrls(catalogHtml, "https://magnit.ru/catalog/1", store_context);
assert.equal(urls.length, 2);
assert.ok(urls.every(url => new URL(url).searchParams.get("shopCode") === "770105"));
assert.ok(urls.every(url => new URL(url).searchParams.get("shopType") === "1"));

const ranked = rankMagnitProductUrls([
  "https://magnit.ru/product/3-zhevatelnaya_rezinka?shopCode=770105",
  "https://magnit.ru/product/2-moloko_2_5_900g?shopCode=770105",
  "https://magnit.ru/product/1-yaytso_s1_10sht?shopCode=770105"
], ["yaytso", "moloko"], ["https://magnit.ru/product/1-yaytso_s1_10sht?shopCode=770105"]);
assert.match(ranked[0], /yaytso/);
assert.match(ranked[1], /moloko/);
assert.match(ranked[2], /zhevatelnaya/);

assert.match(withMagnitStore("https://magnit.ru/product/1-test?shopCode=123", store_context), /shopCode=770105/);
assert.throws(() => withMagnitStore("https://example.com/product/1", store_context), /Unsupported Magnit host/);
assert.throws(() => parseMagnitProductPage(productHtml.replace(/Чертановская/g, "Дубнинская"), row.url, context), /expected store address/);

const fallbackHtml = `<html><head><title>Макароны Makfa Рожки гладкие 450г – купить | г Москва, ул Чертановская, д 47 к 2</title></head><body><h1>Макароны Makfa Рожки гладкие 450г</h1><div>74.99 ₽</div><div>В корзину</div><div>Чертановская 47</div></body></html>`;
const fallback = parseMagnitProductPage(fallbackHtml, "https://magnit.ru/product/1234567890-makarony", context);
assert.equal(fallback.price, 74.99);
assert.equal(fallback.name, "Макароны Makfa Рожки гладкие 450г");

console.log("Magnit collector tests passed: store scoping, basket prioritization, JSON-LD, unit-price parsing, fallback parsing and URL discovery.");
