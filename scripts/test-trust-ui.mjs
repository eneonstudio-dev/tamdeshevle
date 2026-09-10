import fs from 'node:fs';
import assert from 'node:assert/strict';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const profile=fs.readFileSync(new URL('../profile-basket.js',import.meta.url),'utf8');
const covers=fs.readFileSync(new URL('../store-covers.js',import.meta.url),'utf8');
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
assert.match(retailerSync,/quality\.status === "unverified" && book\.catalog_context\?\.price_scope === "regional_catalog"/,'only explicitly regional unverified catalogs may enter the estimate side channel');
assert.match(retailerSync,/if \(quality\.usable && match\.comparison_eligible === true && match\.availability === "in_stock"\) \{[\s\S]*product\.prices/,'only usable verified overlays may mutate comparison prices');
assert.match(provenanceUi,/≈ каталог/,'regional catalog UI must visibly mark prices as approximate');
assert.match(provenanceUi,/вне рейтинга/,'regional catalog UI must explicitly keep estimates outside ranking');
assert.match(provenanceUi,/Ориентировочная цена регионального каталога/,'regional catalog UI must disclose store-scope limitation');

console.log('Trust UI checks passed: educational and regional catalog estimates stay visibly approximate, outside ranking, and out of verified history.');
