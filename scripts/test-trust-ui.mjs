import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const profile=fs.readFileSync(new URL('../profile-basket.js',import.meta.url),'utf8');
const covers=fs.readFileSync(new URL('../store-covers.js',import.meta.url),'utf8');
const dataQuality=fs.readFileSync(new URL('../data-quality.js',import.meta.url),'utf8');
const retailerSync=fs.readFileSync(new URL('../retailer-price-sync.js',import.meta.url),'utf8');
const provenanceUi=fs.readFileSync(new URL('../price-provenance-ui.js',import.meta.url),'utf8');

assert.match(app,/p\.rankable/,'best badge must depend on ranking eligibility');
assert.match(app,/оценка · вне рейтинга/,'estimated basket must be disclosed outside the ranking');
assert.match(app,/Оценка здесь/,'cart must label an unverified total as an estimate');
assert.match(app,/≈ /,'estimated totals must have an approximation marker');
assert.match(app,/function displayPrice/,'item prices must use provenance-aware formatting');
assert.match(app,/verified \? "" : "≈ "/,'unverified item prices must be visibly approximate');
assert.match(profile,/quote\.verifiedComplete/,'daily basket history must require fully verified prices');
assert.match(profile,/verified:true/,'saved history must retain verification provenance');
assert.doesNotMatch(covers,/молоко 72 ₽|яйца 115 ₽|−187 ₽ корзина/,'home hero must not present invented prices as live facts');

assert.match(retailerSync,/estimatedPriceMeta/,'regional catalog estimates must use a separate metadata channel');
assert.match(retailerSync,/getEstimated/,'regional catalog estimates must be queryable without becoming verified prices');
assert.match(retailerSync,/regional_catalog_estimate/,'regional catalog estimates must retain explicit provenance kind');
assert.match(retailerSync,/freshness: quality\.status/,'retailer price metadata must preserve freshness status into the provenance layer');
assert.match(retailerSync,/quality\.status === "unverified" && quality\.estimateUsable === true && book\.catalog_context\?\.price_scope === "regional_catalog"/,'only fresh, in-period regional unverified catalogs may enter the estimate side channel');
assert.match(retailerSync,/if \(quality\.usable && match\.comparison_eligible === true && match\.availability === "in_stock"\) \{[\s\S]*product\.prices/,'only usable verified overlays may mutate comparison prices');
assert.match(dataQuality,/status: "stale", rank: TRUST\.VERIFIED, verified: true, usable: true/,'stale exact-store observations intentionally remain usable until expiry and therefore require explicit disclosure');
assert.match(provenanceUi,/meta\.freshness === "stale"/,'stale exact-store evidence must have an explicit UI branch');
assert.match(provenanceUi,/△ наблюдение устарело/,'stale item prices must not look like fresh store prices');
assert.match(provenanceUi,/ценовых наблюдений устарели — перепроверь цену перед покупкой/,'a rankable plan containing stale prices must disclose that those observations need re-checking');
assert.match(provenanceUi,/overlays\.filter\(item => item\.freshness === "stale"\)/,'home provenance summary must count stale observations separately from fresh prices');
assert.match(provenanceUi,/Устаревшие наблюдения могут участвовать в сравнении до истечения TTL, но требуют перепроверки перед покупкой/,'the product must explain the current stale-but-usable truth contract instead of calling stale evidence fresh');
assert.match(provenanceUi,/≈ каталог/,'regional catalog UI must visibly mark prices as approximate');
assert.match(provenanceUi,/вне рейтинга/,'regional catalog UI must explicitly keep estimates outside ranking');
assert.match(provenanceUi,/Ориентировочная цена регионального каталога/,'regional catalog UI must disclose store-scope limitation');

console.log('Trust UI checks passed: regional estimates stay approximate/outside ranking and stale exact-store evidence stays visibly distinct from fresh price truth.');
