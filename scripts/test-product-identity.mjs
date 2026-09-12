import assert from 'node:assert/strict';
import {
  buildIdentityIndex,
  isValidGtin,
  normalizeBarcode,
  resolveProductIdentity
} from '../retailers/product-identity.mjs';

assert.equal(normalizeBarcode(' 460-1234 567890 '), '4601234567890');
assert.equal(isValidGtin('4006381333931'), true);
assert.equal(isValidGtin('4006381333932'), false);

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
assert.equal(result.identity.manufacturer, 'Завод 1');
assert.equal(result.rankable, false);
assert.equal(result.price_verified, false);
assert.equal(result.store_scope_verified, false);
assert.ok(result.conflicts.length >= 1, 'conflicting lower-priority metadata should be recorded');
assert.equal(result.evidence.length, 3);

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

console.log('product identity cascade: ok');
