import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('../receipt-entry-ui.js', import.meta.url), 'utf8');

const fakeStorage = new Map();
const context = {
  window: {},
  document: {
    readyState: 'loading',
    documentElement: {},
    addEventListener() {},
    querySelector() { return null; }
  },
  localStorage: {
    getItem(key) { return fakeStorage.get(key) ?? null; },
    setItem(key, value) { fakeStorage.set(key, value); }
  },
  MutationObserver: class { observe() {} },
  CustomEvent: class {},
  FormData: class {},
  Date,
  console
};
context.window = context;
vm.createContext(context);
vm.runInContext(code, context);
assert.equal(typeof context.TDReceiptEntry?.open, 'function');
assert.deepEqual(Array.from(context.TDReceiptEntry.loadDrafts()), []);
console.log('receipt entry UI smoke test: ok');
