import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../comparison-engine.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../basket-split.js', import.meta.url), 'utf8'), context);

const meta = () => ({ kind: 'retailer', freshness: 'fresh' });
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
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk' });
  assert.equal(result.bestOne.total, 260);
  assert.equal(result.bestTwo.total, 220);
  assert.equal(result.extraSaving, 40);
  assert.equal(result.worthSplitting, true);
  assert.deepEqual(Array.from(result.bestTwo.usedStoreIds), ['a', 'b']);
}

{
  const products = [product('x', 100, 140), product('y', 200, 120, true, false)];
  const result = context.window.TDBasketSplit.optimize({ stores, products, cart: { x: 1, y: 1 }, city: 'msk' });
  assert.equal(result.bestTwo, null);
  assert.equal(result.worthSplitting, false);
}

console.log('basket split tests passed');
