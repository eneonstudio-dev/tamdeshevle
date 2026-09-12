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
  name: id.toUpperCase(),
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
  assert.equal(result.travelKnown, false);
  assert.equal(result.netSaving, null, 'walk split cannot claim net saving without configured travel cost');
  assert.deepEqual(Array.from(result.bestTwo.usedStoreIds), ['a', 'b']);
}

{
  const products = [product('x', 100, 140), product('y', 200, 120)];
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk', mode: 'walk', extraStopCost: 15 });
  assert.equal(result.netSaving, 25);
  assert.equal(result.travelKnown, true);
  const explicitZero = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk', mode: 'walk', extraStopCost: 0 });
  assert.equal(explicitZero.netSaving, 40, 'explicitly configured zero travel cost may count as known');
}

{
  const products = [product('x', 100, 140), product('y', 200, 120, true, false)];
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk', mode: 'walk' });
  assert.equal(result.bestTwo, null);
  assert.equal(result.worthSplitting, false);
}

{
  const products = [product('x', 100, 140), product('y', 200, 120)];
  for (const badQuantity of [0.5, 1.5, Infinity, NaN, 100]) {
    const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: badQuantity, y: 1 }, city: 'msk', mode: 'walk' });
    assert.equal(result.bestTwo, null, `invalid quantity ${String(badQuantity)} must not enter a two-store total`);
    assert.equal(result.worthSplitting, false);
  }
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

{
  const deliveryStores = [
    { id: 'a', name: 'A', kind: 'delivery', city: ['msk'], has_bring: true, delivery: 50 },
    { id: 'b', name: 'B', kind: 'delivery', city: ['msk'], has_bring: true, delivery: 30 }
  ];
  const products = [
    { id: 'x', name: 'X', bring: { a: 100, b: 180 }, priceMeta: { a: { bring: meta() }, b: { bring: meta() } } },
    { id: 'y', name: 'Y', bring: { a: 220, b: 100 }, priceMeta: { a: { bring: meta() }, b: { bring: meta() } } }
  ];
  const result = context.window.TDBasketSplit.optimize({ stores: deliveryStores, products, cart: { x: 2, y: 2 }, city: 'msk', mode: 'delivery' });
  assert.equal(result.bestOne, null, 'unknown delivery minimum must block one-store split baseline');
  assert.equal(result.bestTwo, null, 'unknown delivery minimum must block two-store delivery recommendation');
  assert.equal(result.worthSplitting, false);
}

{
  const noMinimumStores = [
    { id: 'a', name: 'A', kind: 'delivery', city: ['msk'], has_bring: true, delivery: 50, minOrder: 0 },
    { id: 'b', name: 'B', kind: 'delivery', city: ['msk'], has_bring: true, delivery: 30, minOrder: 0 }
  ];
  const products = [
    { id: 'x', name: 'X', bring: { a: 100, b: 180 }, priceMeta: { a: { bring: meta() }, b: { bring: meta() } } },
    { id: 'y', name: 'Y', bring: { a: 220, b: 100 }, priceMeta: { a: { bring: meta() }, b: { bring: meta() } } }
  ];
  const result = context.window.TDBasketSplit.optimize({ stores: noMinimumStores, products, cart: { x: 2, y: 2 }, city: 'msk', mode: 'delivery' });
  assert.ok(result.bestOne && result.bestTwo, 'explicit minOrder 0 means there is no minimum and may be ranked');
}

{
  const products = [product('x', 100, 140), product('y', 200, 120)];
  context.STORES = stores;
  context.PRODUCTS = products;
  context.state = { mode: 'walk', city: 'msk', cart: { x: 1, y: 1 } };
  context.window.state = context.state;
  context.window.TDAssemblyPreferences = { hasConfiguredCost: () => false, extraStopCost: () => 0 };
  const result = context.window.TDBasketSplit.fromWindow();
  assert.equal(result.travelKnown, false, 'default zero settings must not masquerade as a known travel cost');
  assert.equal(result.netSaving, null);
}

console.log('basket split tests passed: verified prices, valid quantities, known delivery terms and explicit travel costs only.');
