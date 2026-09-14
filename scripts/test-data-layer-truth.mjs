import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

class CustomEventStub {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

const context = {
  window: { dispatchEvent() {} },
  console: { warn() {}, error() {}, log() {} },
  Date,
  Number,
  Set,
  String,
  Array,
  Object,
  Math,
  CustomEvent: CustomEventStub,
  queueMicrotask: fn => fn(),
  STORES: [
    { id: 's1', name: 'Store 1', kind: 'shop', city: ['msk'] }
  ],
  PRODUCTS: [
    { id: 'milk', name: 'Milk', prices: { s1: 100 }, bring: { s1: 120 } },
    { id: 'unknown', name: 'Unknown price', prices: {}, bring: {} },
    { id: 'zero', name: 'Invalid zero price', prices: { s1: 0 }, bring: {} }
  ]
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('data-layer.js', 'utf8'), context);

const Data = context.window.TDData;

assert.equal(Data.price('milk', 's1'), 100);
assert.equal(Data.price('milk', 's1', 'bring'), 120);
assert.equal(Data.price('unknown', 's1'), null);
assert.equal(Data.price('zero', 's1'), null, 'zero must not become a verified grocery price');

assert.equal(Data.cartTotal({}, 's1'), 0, 'an empty basket has a known zero total');
assert.equal(Data.cartTotal({ milk: 2 }, 's1'), 200);
assert.equal(
  Data.cartTotal({ milk: 1, unknown: 1 }, 's1'),
  null,
  'a selected item with a missing price must make the total unknown instead of cheaper'
);
assert.equal(Data.cartTotal({ unknown: 0 }, 's1'), 0, 'zero-quantity entries do not make an empty basket unknown');
assert.equal(Data.cartTotal({ milk: 'bad-quantity' }, 's1'), null, 'invalid quantity must fail closed');
assert.equal(Data.cartTotal({ milk: -1 }, 's1'), null, 'negative quantity must fail closed');

console.log('data layer truth tests passed');
