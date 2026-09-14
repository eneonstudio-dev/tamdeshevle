import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = { window: {}, console, Date, Number, Set, String, Array, Object, Math };
vm.createContext(context);
vm.runInContext(fs.readFileSync('receipt-observations.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('receipt-verification.js', 'utf8'), context);

const Receipt = context.window.TDReceiptObservations;
const Verify = context.window.TDReceiptVerification;
const now = '2026-09-10T09:00:00.000Z';
const scopedStore = () => ({ chain_id: 'pyat', store_id: 'S105', external_store_id: 'osm:node:105', address: 'Москва, Кировоградская улица, 17', scope_source: 'verified_store_point', scope_method: 'osm_store_ref', scope_confidence: 1 });

const exact = Receipt.create({
  receipt_id: 'r1',
  observed_at: '2026-09-10T08:30:00.000Z',
  store: scopedStore(),
  image_ref: 'receipt://r1',
  items: [
    { product_id: 'milk', barcode: '460000000001', match_method: 'barcode', price: 89, quantity: 1, receipt_name: 'Молоко' },
    { product_id: 'bread', match_method: 'name', price: 55, quantity: 1, receipt_name: 'Хлеб' }
  ]
});

const promoted = Verify.promote(exact, { now });
assert.equal(promoted.gate.ok, true);
assert.equal(promoted.gate.eligible_for_history, true);
assert.equal(promoted.candidates.length, 2);
assert.equal(promoted.candidates[0].eligible_for_ranking, true);
assert.equal(promoted.candidates[0].rankable, false);
assert.equal(promoted.candidates[1].eligible_for_ranking, false);

const stale = Receipt.create({
  receipt_id: 'r2',
  observed_at: '2026-09-08T08:30:00.000Z',
  store: scopedStore(),
  image_ref: 'receipt://r2',
  items: [{ product_id: 'milk', match_method: 'sku', price: 90, receipt_name: 'Молоко' }]
});
assert.equal(Verify.promote(stale, { now }).gate.ok, false);

const unscoped = Receipt.create({
  receipt_id: 'r3',
  observed_at: '2026-09-10T08:30:00.000Z',
  chain_id: 'pyat',
  image_ref: 'receipt://r3',
  items: [{ product_id: 'milk', match_method: 'sku', price: 90, receipt_name: 'Молоко' }]
});
assert.equal(Verify.promote(unscoped, { now }).gate.ok, false);

const noProof = Receipt.create({
  receipt_id: 'r4',
  observed_at: '2026-09-10T08:30:00.000Z',
  store: scopedStore(),
  items: [{ product_id: 'milk', match_method: 'sku', price: 90, receipt_name: 'Молоко' }]
});
assert.equal(Verify.promote(noProof, { now }).gate.ok, false);

const toleratedClockSkew = Receipt.create({
  receipt_id: 'r5',
  observed_at: '2026-09-10T09:10:00.000Z',
  store: scopedStore(),
  image_ref: 'receipt://r5',
  items: [{ product_id: 'milk', match_method: 'barcode', price: 91, receipt_name: 'Молоко' }]
});
assert.equal(Verify.promote(toleratedClockSkew, { now }).gate.ok, true, 'small clock skew should stay usable');

const future = Receipt.create({
  receipt_id: 'r6',
  observed_at: '2026-09-10T09:30:00.000Z',
  store: scopedStore(),
  image_ref: 'receipt://r6',
  items: [{ product_id: 'milk', match_method: 'barcode', price: 92, receipt_name: 'Молоко' }]
});
const futurePromotion = Verify.promote(future, { now });
assert.equal(futurePromotion.gate.ok, false, 'future evidence must not be promoted as fresh');
assert.equal(futurePromotion.candidates.length, 0);
assert.equal(futurePromotion.gate.reasons.includes('receipt timestamp is in the future'), true);

console.log('receipt verification tests passed');
