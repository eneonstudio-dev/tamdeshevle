import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const storage = new Map();
const localStorage = {
  getItem: key => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key)
};

const window = {
  TDReceiptObservations: {
    validate(observation) {
      const ok = Boolean(observation && observation.schema === 'td.receipt_observation' && observation.receipt_id && Array.isArray(observation.items));
      return { ok, errors: ok ? [] : ['invalid receipt'] };
    }
  },
  dispatchEvent() {}
};

const context = vm.createContext({ window, localStorage, CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } }, Blob, URL, document: { createElement() { return { click() {}, remove() {}, set href(_) {}, set download(_) {} }; }, body: { appendChild() {} } }, setTimeout });
vm.runInContext(fs.readFileSync(new URL('../receipt-local-tools.js', import.meta.url), 'utf8'), context);

const tools = window.TDReceiptLocal;
assert.ok(tools);

const observation = {
  schema: 'td.receipt_observation',
  version: 1,
  receipt_id: 'r-1',
  observed_at: '2026-09-10T09:00:00.000Z',
  store: { store_id: 'pyat', address: 'Москва, Кировоградская улица, 17' },
  items: [{ receipt_name: 'Молоко', product_id: 'milk', match_method: 'barcode', barcode: '4600000000001', price: 99, quantity: 1 }]
};

let result = tools.importPayload({ schema: tools.EXPORT_SCHEMA, version: 1, drafts: [{ saved_at: '2026-09-10T09:10:00.000Z', observation }] });
assert.equal(result.imported, 1);
assert.equal(tools.loadDrafts().length, 1);
assert.equal(tools.summarizeDraft(tools.loadDrafts()[0]).strong_match_count, 1);
assert.equal(tools.summarizeDraft(tools.loadDrafts()[0]).rankable, false);

result = tools.importPayload({ schema: tools.EXPORT_SCHEMA, version: 1, drafts: [{ observation }] });
assert.equal(result.imported, 0, 'duplicate receipt ids must not duplicate local drafts');

result = tools.importPayload('{bad json');
assert.equal(result.ok, false);
assert.equal(result.imported, 0);

const payload = tools.exportPayload();
assert.equal(payload.schema, 'td.receipt_drafts_export');
assert.equal(payload.rankable, false);
assert.equal(payload.drafts.length, 1);

tools.clearDrafts();
assert.equal(tools.loadDrafts().length, 0);

console.log('receipt local tools: ok');