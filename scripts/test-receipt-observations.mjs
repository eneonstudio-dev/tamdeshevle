import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../receipt-observations.js', import.meta.url), 'utf8');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(code, context);
const api = context.window.TDReceiptObservations;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const exact = api.create({
  receipt_id: 'r-1',
  observed_at: '2026-09-10T08:30:00+03:00',
  source: 'receipt',
  store: {
    chain_id: 'pyat',
    store_id: 'pyat-s105',
    external_store_id: 'S105',
    address: 'Москва, Кировоградская улица, 17',
    scope_source: 'verified_store_point',
    scope_method: 'osm_store_ref',
    scope_confidence: 1
  },
  items: [
    { receipt_name: 'Молоко 1 л', product_id: 'milk', match_method: 'sku', price: 109.99, quantity: 1 },
    { receipt_name: 'Вода 2 шт', barcode: '4600000000001', product_id: 'water', match_method: 'barcode', price: 120, quantity: 2 }
  ]
});

assert(api.validate(exact).ok, 'exact receipt should validate');
assert(exact.verification.store_scope_verified === true, 'exact store must be scoped');
assert(exact.verification.rankable === false, 'receipt evidence must never rank directly');
assert(exact.verification.price_scope === 'exact_store_receipt', 'exact receipt scope expected');
const candidates = api.toPriceCandidates(exact);
assert(candidates.length === 2, 'matched lines should become candidates');
assert(candidates.every(x => x.rankable === false), 'price candidates must stay non-rankable');
assert(candidates[1].price === 60, 'unit price should divide receipt line price by quantity');

const vague = api.create({
  observed_at: '2026-09-10T09:00:00Z',
  chain_id: 'magnit',
  items: [{ receipt_name: 'Хлеб', price: 59 }]
});
assert(api.validate(vague).ok, 'unscoped receipt may still be stored as evidence');
assert(vague.verification.store_scope_verified === false, 'missing exact store must remain unverified');
assert(vague.verification.price_scope === 'receipt_unscoped', 'unscoped price scope expected');
assert(api.toPriceCandidates(vague).length === 0, 'unmatched lines must not emit price candidates');

const typedAddress = api.create({
  observed_at: '2026-09-10T09:00:00Z',
  store: { chain_id: 'magnit', store_id: 'magnit', address: 'Москва, адрес руками' },
  items: [{ receipt_name: 'Хлеб', product_id: 'bread', match_method: 'barcode', barcode: '4600000000001', price: 59 }]
});
assert(typedAddress.verification.store_scope_verified === false, 'typed address must never verify store scope');
assert(api.toPriceCandidates(typedAddress)[0].scope_verified === false, 'typed address candidate must remain unverified');

const invalid = api.create({ chain_id: 'pyat', items: [{ receipt_name: 'Сыр', price: 0 }] });
assert(api.validate(invalid).ok === false, 'missing date / invalid price should fail validation');

console.log('receipt observations: ok');
