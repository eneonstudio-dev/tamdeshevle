import { buildReceiptIdentitySources, identifyReceiptLines, receiptIdentitySafety } from '../retailers/receipt-product-identity.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Small smoke corpus of real Russian-market EANs sourced from public food metadata.
// This is identity-only test data: no prices, stock or store claims are carried here.
const openFoodFactsRecords = [
  { barcode: '4600080322106', product_name: 'Вафли Коровка топлёное молоко', brand: 'Рот Фронт', source_ref: 'off-smoke' },
  { barcode: '4607117890836', product_name: 'Карамель Гусиные лапки', brand: 'Рот Фронт', source_ref: 'off-smoke' },
  { barcode: '4607064325016', product_name: 'Крекер Янтарный с солью', brand: 'Любятово', source_ref: 'off-smoke' },
  { barcode: '4610003253592', product_name: 'Хлопья мультизлаковые', brand: 'Любятово', source_ref: 'off-smoke' },
  { barcode: '4610003254582', product_name: 'Подушечки с банановой начинкой', brand: 'Любятово', source_ref: 'off-smoke' },
  { barcode: '4610003253103', product_name: 'Подушечки с шоколадной начинкой', brand: 'Любятово', source_ref: 'off-smoke' }
];

const sources = buildReceiptIdentitySources({ open_food_facts: openFoodFactsRecords });
const lines = identifyReceiptLines([
  { receipt_name: 'ВАФ КОРОВКА ТОП МОЛ', barcode: '4600080322106', price: 119.9, quantity: 1 },
  { receipt_name: 'КРЕКЕР ЯНТ СОЛЬ', barcode: '4607064325016', price: 79.9, quantity: 1 },
  { receipt_name: 'UNKNOWN', barcode: '4006381333931', price: 50, quantity: 1 },
  { receipt_name: 'BAD', barcode: '12345', price: 10, quantity: 1 }
], { sources });

assert(lines[0].identity_status === 'identified', 'known EAN should identify');
assert(lines[0].identity_evidence.canonical_name.includes('Коровка'), 'canonical identity should be attached');
assert(lines[0].identity_evidence.primary_source === 'open_food_facts', 'source provenance should be retained');
assert(lines[1].identity_status === 'identified', 'second known EAN should identify');
assert(lines[2].identity_status === 'barcode_not_found', 'valid unknown EAN should stay unresolved');
assert(lines[3].identity_status === 'invalid_gtin', 'invalid barcode should stay unresolved');

for (const line of lines) {
  const safety = receiptIdentitySafety(line);
  assert(safety.price_verified === false, 'identity must never verify receipt price');
  assert(safety.store_scope_verified === false, 'identity must never verify store scope');
  assert(safety.rankable === false, 'identity must never become rankable');
  assert(safety.may_auto_promote_price === false, 'identity must not auto-promote price');
}

console.log('receipt product identity bridge: ok');
