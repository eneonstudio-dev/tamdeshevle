import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../comparison-engine.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../basket-split.js', import.meta.url), 'utf8'), context);

const meta = () => ({ kind: 'retailer', scopeVerified: true, comparisonEligible: true, availability: 'in_stock', freshness: 'fresh' });
const product = (id, a, b, verifiedA = true, verifiedB = true) => ({
  id,
  prices: { a, b },
  priceMeta: {
    a: verifiedA ? { shelf: meta() } : {},
    b: verifiedB ? { shelf: meta() } : {}
  }
});
const stores = [
  { id: 'a', name: 'A', kind: 'shop', city: ['msk'] },
  { id: 'b', name: 'B', kind: 'shop', city: ['msk'] }
];

{
  const products = [product('x', 100, 140), product('y', 200, 120)];
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk', mode: 'walk' });
  assert.equal(result.bestOne.total, 260);
  assert.equal(result.bestTwo.total, 220);
  assert.equal(result.extraSaving, 40);
  assert.equal(result.worthSplitting, true);
  assert.equal(result.netSaving, null, 'walk split cannot claim net saving without travel cost');
  assert.deepEqual(Array.from(result.bestTwo.usedStoreIds), ['a', 'b']);
}

{
  const products = [product('x', 100, 140), product('y', 200, 120)];
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk', mode: 'walk', extraStopCost: 15 });
  assert.equal(result.netSaving, 25);
}

{
  const products = [product('x', 100, 140), product('y', 200, 120, true, false)];
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk', mode: 'walk' });
  assert.equal(result.bestTwo, null);
  assert.equal(result.worthSplitting, false);
}

{
  const deliveryStores = [
    { id: 'a', name: 'A', kind: 'delivery', city: ['msk'], has_bring: true, delivery: 50, minOrder: 150 },
    { id: 'b', name: 'B', kind: 'delivery', city: ['msk'], has_bring: true, delivery: 30, minOrder: 100 }
  ];
  const products = [
    { id: 'x', name: 'X', bring: { a: 100, b: 180 }, priceMeta: { a: { bring: meta() }, b: { bring: meta() } } },
    { id: 'y', name: 'Y', bring: { a: 220, b: 100 }, priceMeta: { a: { bring: meta() }, b: { bring: meta() } } }
  ];
  const result = context.window.TDBasketSplit.optimize({ stores: deliveryStores, products, cart: { x: 2, y: 2 }, city: 'msk', mode: 'delivery' });
  assert.equal(result.bestOne.total, 590);
  assert.equal(result.bestTwo.total, 480);
  assert.equal(result.netSaving, 110);
  assert.equal(result.worthSplitting, true);
}

console.log('basket split tests passed');
