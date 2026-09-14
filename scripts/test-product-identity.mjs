import assert from 'node:assert/strict';
import {
  buildIdentityIndex,
  identitySourcePolicy,
  isValidGtin,
  normalizeBarcode,
  resolveProductIdentity
} from '../retailers/product-identity.mjs';

assert.equal(normalizeBarcode(' 460-1234 567890 '), '4601234567890');
assert.equal(isValidGtin('4006381333931'), true);
assert.equal(isValidGtin('4006381333932'), false);
assert.equal(identitySourcePolicy('open_food_facts').enabled, true);
assert.equal(identitySourcePolicy('ru_barcode').enabled, false);
assert.equal(identitySourcePolicy('ru_barcode').reason, 'blocked_pending_license_review');
assert.equal(identitySourcePolicy('unknown_source').enabled, false);

const canonical = buildIdentityIndex([
  { barcode: '4006381333931', canonical_name: 'Тестовое молоко 1 л', brand: 'Бренд А', category: 'Молоко', quantity: '1 л', source_ref: 'local:milk-1' }
], { source: 'canonical' });

const ru = buildIdentityIndex([
  { barcode: '4006381333931', name: 'Молоко тестовое 1000 мл', brand: 'Бренд А', manufacturer: 'Завод 1' }
], { source: 'ru_barcode' });

const off = buildIdentityIndex([
  { barcode: '4006381333931', product_name: 'Milk test 1L', brand: 'Brand A', category: 'Dairy', quantity: '1 L' }
], { source: 'open_food_facts' });

const result = resolveProductIdentity('4006381333931', {
  sources: [
    { name: 'canonical', index: canonical },
    { name: 'ru_barcode', index: ru },
    { name: 'open_food_facts', index: off }
  ]
});

assert.equal(result.matched, true);
assert.equal(result.method, 'exact_barcode');
assert.equal(result.primary_source, 'canonical');
assert.equal(result.confidence, 1);
assert.equal(result.identity.canonical_name, 'Тестовое молоко 1 л');
assert.equal(result.identity.manufacturer, null, 'blocked source must not enrich runtime identity');
assert.equal(result.rankable, false);
assert.equal(result.price_verified, false);
assert.equal(result.store_scope_verified, false);
assert.ok(result.conflicts.length >= 1, 'conflicting approved lower-priority metadata should be recorded');
assert.equal(result.evidence.length, 2);
assert.deepEqual(result.ignored_sources, [
  { source: 'ru_barcode', reason: 'blocked_pending_license_review' }
]);

const forcedBlocked = resolveProductIdentity('4006381333931', {
  priority: ['ru_barcode'],
  sources: [{ name: 'ru_barcode', index: ru }]
});
assert.equal(forcedBlocked.matched, false);
assert.equal(forcedBlocked.reason, 'barcode_not_found');
assert.deepEqual(forcedBlocked.ignored_sources, [
  { source: 'ru_barcode', reason: 'blocked_pending_license_review' }
]);

const unknown = resolveProductIdentity('5901234123457', {
  sources: [{ name: 'canonical', index: canonical }]
});
assert.equal(unknown.matched, false);
assert.equal(unknown.reason, 'barcode_not_found');
assert.equal(unknown.rankable, false);

const invalid = resolveProductIdentity('123');
assert.equal(invalid.matched, false);
assert.equal(invalid.reason, 'invalid_gtin');

const fallbackOnly = resolveProductIdentity('4006381333931', {
  sources: [{ name: 'open_food_facts', index: off }]
});
assert.equal(fallbackOnly.matched, true);
assert.equal(fallbackOnly.primary_source, 'open_food_facts');
assert.equal(fallbackOnly.confidence, 0.72);
assert.equal(fallbackOnly.rankable, false);

const unregistered = buildIdentityIndex([
  { barcode: '4006381333931', product_name: 'Unregistered candidate' }
], { source: 'universe_htt' });
const unregisteredOnly = resolveProductIdentity('4006381333931', {
  priority: ['universe_htt'],
  sources: [{ name: 'universe_htt', index: unregistered }]
});
assert.equal(unregisteredOnly.matched, false);
assert.deepEqual(unregisteredOnly.ignored_sources, [
  { source: 'universe_htt', reason: 'source_not_registered' }
]);

console.log('product identity cascade: ok');
