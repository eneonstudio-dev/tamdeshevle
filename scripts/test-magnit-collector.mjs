import assert from "node:assert/strict";
import { discoverMagnitProductUrls, pageImage, pagePack, pagePriceTerms, pageUnitPrice, parseMagnitProductPage, rankMagnitProductUrls, verifyMagnitScopeConfig, withMagnitStore } from "../retailers/magnit-collector.mjs";
import { buildOverlayFromSnapshot } from "../retailers/overlay-builder.mjs";

const store_context = { shop_code: "770105", shop_type: "1", address: "г Москва, ул Чертановская, д 47 к 2" };
const context = { store_context, expected_address_tokens: ["Чертановская", "47"] };
assert.deepEqual(verifyMagnitScopeConfig(context), store_context);
assert.throws(()=>verifyMagnitScopeConfig({store_context:{shop_code:"770105",address:"Москва"},expected_address_tokens:[]}),/expected_address_tokens/);
assert.throws(()=>verifyMagnitScopeConfig({store_context:{shop_code:"770105",address:"Москва"},expected_address_tokens:["Чертановская"]}),/does not match/);
const imageUrl = "https://images-foodtech.magnit.ru/example/egg.webp";
const productHtml = `<!doctype html><html><head>
<title>Куриное яйцо C1 10шт в ассортименте – купить с доставкой | г Москва, ул Чертановская, д 47 к 2</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Куриное яйцо C1 10шт в ассортименте","image":"${imageUrl}","brand":{"@type":"Brand","name":"Магнит"},"offers":{"@type":"Offer","price":"70.79","priceCurrency":"RUB"}}</script>
</head><body><div>Финальная цена</div><div>+5% с Премиум</div><h1>Куриное яйцо C1 10шт в ассортименте</h1><button>Добавить в корзину</button><footer>г Москва, ул Чертановская, д 47 к 2</footer></body></html>`;
const row = parseMagnitProductPage(productHtml, "https://magnit.ru/product/3454700001-yaytso_stolovoe_s1_10sht_boks_20", context);
assert.equal(row.id, "3454700001");assert.equal(row.name, "Куриное яйцо C1 10шт в ассортименте");assert.equal(row.price, 70.79);assert.equal(row.unit_price, null);assert.equal(row.pack, null);assert.equal(row.shop_code, "770105");assert.equal(row.availability, "В наличии");assert.equal(row.image_url, imageUrl);assert.equal(pageImage(productHtml), imageUrl);assert.match(row.url, /shopCode=770105/);
assert.equal(row.promo,false,"base price must stay rankable when Premium is only an extra benefit");
assert.deepEqual(row.price_terms,{status:"promotion_context",conditional:false,markers:["final_price","premium_extra_benefit"],evidence_scope:"product_price_context"});
assert.deepEqual(pagePriceTerms(productHtml),row.price_terms);
const cardPriceHtml=productHtml.replace("<h1>","<div>Цена по карте</div><h1>");
const cardPriceRow=parseMagnitProductPage(cardPriceHtml,"https://magnit.ru/product/3454700001-yaytso_stolovoe_s1_10sht_boks_20",context);
assert.equal(cardPriceRow.promo,true);assert.equal(cardPriceRow.promo_eligibility_verified,false);assert.equal(cardPriceRow.promo_terms_verified,false);assert.equal(cardPriceRow.price_terms.conditional,true);assert.ok(cardPriceRow.price_terms.markers.includes("card_price"));
const premiumPriceHtml=productHtml.replace("<h1>","<div>Цена с Премиум</div><h1>");
assert.equal(pagePriceTerms(premiumPriceHtml).conditional,true,"explicit Premium-gated price must fail closed");
const remoteCardCopy=`<html><body><h1>Товар</h1><div>${"x".repeat(1800)}</div><div>Цена по карте</div></body></html>`;
assert.equal(pagePriceTerms(remoteCardCopy).conditional,false,"remote loyalty copy outside product price context must not taint the item");
const ogHtml = `<html><head><meta property="og:image" content="https://images-foodtech.magnit.ru/example/fallback.webp"></head><body>Чертановская 47</body></html>`;
assert.equal(pageImage(ogHtml), "https://images-foodtech.magnit.ru/example/fallback.webp");
const produceHtml = `<html><head><title>Лук репчатый – купить | г Москва, ул Чертановская, д 47 к 2</title></head><body><h1>Лук репчатый</h1><div>41.99 ₽</div><div>59.99 ₽/1кг</div><div>Вес, кг 0.7</div><button>Добавить в корзину</button><div>Чертановская 47</div></body></html>`;
const produce = parseMagnitProductPage(produceHtml, "https://magnit.ru/product/9072651204-luk_repchatyy", context);assert.equal(produce.price,41.99);assert.equal(produce.unit_price,59.99);assert.equal(produce.unit_price_unit,"kg");assert.deepEqual(produce.pack,{value:700,unit:"g",source:"characteristic_weight_kg"});assert.deepEqual(pagePack(produceHtml),{value:700,unit:"g",source:"characteristic_weight_kg"});assert.deepEqual(pageUnitPrice(produceHtml),{price:59.99,unit:"kg"});
const bananaHtml = `<html><head><title>Бананы – купить | г Москва, ул Чертановская, д 47 к 2</title></head><body><h1>Бананы</h1><div>149.99 ₽</div><div>149.99 ₽/кг</div><section><div>Вес, кг</div><div>1</div></section><button>Добавить в корзину</button><div>Чертановская 47</div></body></html>`;
const banana = parseMagnitProductPage(bananaHtml, "https://magnit.ru/product/9072651501-banany", context);assert.equal(banana.name,"Бананы");assert.equal(banana.unit_price,149.99);assert.equal(banana.unit_price_unit,"kg");assert.deepEqual(banana.pack,{value:1000,unit:"g",source:"characteristic_weight_kg"});assert.deepEqual(pageUnitPrice(bananaHtml),{price:149.99,unit:"kg"});
const milkHtml = `<html><head><title>Молоко Калория питьевое ультрапастеризованное 2.5% 1л – купить | г Москва, ул Чертановская, д 47 к 2</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Молоко Калория питьевое ультрапастеризованное 2.5% 1л","offers":{"@type":"Offer","price":"109.99","priceCurrency":"RUB"}}</script></head><body><h1>Молоко Калория питьевое ультрапастеризованное 2.5% 1л</h1><div>Вес, кг 1.028</div><button>Добавить в корзину</button><div>Чертановская 47</div></body></html>`;
const milk = parseMagnitProductPage(milkHtml,"https://magnit.ru/product/1000548435-kaloriya_moloko_pitevoe_ultrapast_2_5_1000ml",context);
assert.deepEqual(milk.pack,{value:1000,unit:"ml",source:"1л"},"explicit sale volume must not be replaced by physical package weight");
assert.deepEqual(milk.physical_pack,{value:1028,unit:"g",source:"characteristic_weight_kg"},"physical package weight must remain available as provenance");
assert.equal(milk.availability,"В наличии");
const milkOverlay=buildOverlayFromSnapshot({schema:"tamdeshevle.retailer-snapshot.v1",retailer:"magnit",city:"msk",store_id:"magnit",channel:"delivery_catalog",checked_at:"2026-09-14T18:20:35.236Z",source_url:"https://magnit.ru/",method:"public_store_scoped_catalog_collector",scope_verified:true,store_context,catalog_context:{type:"store_scoped_public_catalog",location_verified:true,shop_code:"770105",address:store_context.address},rows:[milk]});
assert.equal(milkOverlay.prices.milk,109.99,"exact-store in-stock 1L milk should pass the existing strict matcher once sale-pack evidence is preserved");
assert.deepEqual(milkOverlay.matched[0].source_pack,{value:1000,unit:"ml"});
const gramHtml = `<div>Вес, г: 350</div>`;assert.deepEqual(pagePack(gramHtml),{value:350,unit:"g",source:"characteristic_weight_g"});
assert.equal(pagePack(`<div>Цена за 1 кг 59.99</div>`),null,"unit-price copy alone must not fabricate package weight");
const catalogHtml = `<a href="/product/3454700001-yaytso_stolovoe_s1_10sht_boks_20">Яйца</a><a href="https://magnit.ru/product/1000166930-magnit_makarony_lapsha_450g_p_up_24?shopCode=999999">Макароны</a>`;
const urls=discoverMagnitProductUrls(catalogHtml,"https://magnit.ru/catalog/1",store_context);assert.equal(urls.length,2);assert.ok(urls.every(url=>new URL(url).searchParams.get("shopCode")==="770105"));assert.ok(urls.every(url=>new URL(url).searchParams.get("shopType")==="1"));
const ranked=rankMagnitProductUrls(["https://magnit.ru/product/3-zhevatelnaya_rezinka?shopCode=770105","https://magnit.ru/product/2-moloko_2_5_900g?shopCode=770105","https://magnit.ru/product/1-yaytso_s1_10sht?shopCode=770105"],["yaytso","moloko"],["https://magnit.ru/product/1-yaytso_s1_10sht?shopCode=770105"]);assert.match(ranked[0],/yaytso/);assert.match(ranked[1],/moloko/);assert.match(ranked[2],/zhevatelnaya/);
assert.match(withMagnitStore("https://magnit.ru/product/1-test?shopCode=123",store_context),/shopCode=770105/);assert.throws(()=>withMagnitStore("https://example.com/product/1",store_context),/Unsupported Magnit host/);assert.throws(()=>parseMagnitProductPage(productHtml.replace(/Чертановская/g,"Дубнинская"),row.url,context),/expected store address/);
const fallbackHtml=`<html><head><title>Макароны Makfa Рожки гладкие 450г – купить | г Москва, ул Чертановская, д 47 к 2</title></head><body><h1>Макароны Makfa Рожки гладкие 450г</h1><div>74.99 ₽</div><div>В корзину</div><div>Чертановская 47</div></body></html>`;const fallback=parseMagnitProductPage(fallbackHtml,"https://magnit.ru/product/1234567890-makarony",context);assert.equal(fallback.price,74.99);assert.equal(fallback.name,"Макароны Makfa Рожки гладкие 450г");
console.log("Magnit collector tests passed: store scoping, conditional-price semantics, product images, JSON-LD, sale-pack vs physical-pack provenance, unit-price parsing and fallback parsing.");
const diversified = rankMagnitProductUrls([
  'https://magnit.ru/product/1-yaytso_a', 'https://magnit.ru/product/2-yaytso_b',
  'https://magnit.ru/product/3-yaytso_c', 'https://magnit.ru/product/4-moloko',
  'https://magnit.ru/product/5-maslo_podsolnechnoe'
], ['yaytso', 'moloko', 'maslo_podsol']);
assert.deepEqual(diversified.slice(0,3).map(x=>x.split('/').pop()),['1-yaytso_a','4-moloko','5-maslo_podsolnechnoe']);
assert.equal(new Set(diversified).size,5);
