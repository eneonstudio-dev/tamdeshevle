import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../receipt-local-tools.js', import.meta.url), 'utf8');

function createTools({ failSet = false, failRemove = false } = {}) {
  const storage = new Map();
  let changedEvents = 0;
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => { if (failSet) throw new Error('quota'); storage.set(key, String(value)); },
    removeItem: key => { if (failRemove) throw new Error('blocked'); storage.delete(key); }
  };

  const window = {
    TDReceiptObservations: {
      validate(observation) {
        const ok = Boolean(observation && observation.schema === 'td.receipt_observation' && observation.receipt_id && Array.isArray(observation.items));
        return { ok, errors: ok ? [] : ['invalid receipt'] };
      }
    },
    dispatchEvent(event) { if (event?.type === 'td:receipt-drafts-changed') changedEvents += 1; }
  };

  const context = vm.createContext({
    window,
    localStorage,
    console: { ...console, warn() {} },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    Blob,
    URL,
    document: { createElement() { return { click() {}, remove() {}, set href(_) {}, set download(_) {} }; }, body: { appendChild() {} } },
    setTimeout
  });
  vm.runInContext(source, context);
  return { tools: window.TDReceiptLocal, storage, get changedEvents() { return changedEvents; } };
}

const observation = {
  schema: 'td.receipt_observation',
  version: 1,
  receipt_id: 'r-1',
  observed_at: '2026-09-10T09:00:00.000Z',
  store: { store_id: 'pyat', address: 'Москва, Кировоградская улица, 17' },
  items: [{ receipt_name: 'Молоко', product_id: 'milk', match_method: 'barcode', barcode: '4600000000001', price: 99, quantity: 1 }]
};

{
  const ctx = createTools();
  const tools = ctx.tools;
  assert.ok(tools);

  let result = tools.importPayload({ schema: tools.EXPORT_SCHEMA, version: 1, drafts: [{ saved_at: '2026-09-10T09:10:00.000Z', observation }] });
  assert.equal(result.imported, 1);
  assert.equal(tools.loadDrafts().length, 1);
  assert.equal(tools.summarizeDraft(tools.loadDrafts()[0]).strong_match_count, 1);
  assert.equal(tools.summarizeDraft(tools.loadDrafts()[0]).rankable, false);
  assert.equal(ctx.changedEvents, 1, 'successful import must emit one drafts-changed event');

  result = tools.importPayload({ schema: tools.EXPORT_SCHEMA, version: 1, drafts: [{ observation }] });
  assert.equal(result.imported, 0, 'duplicate receipt ids must not duplicate local drafts');
  assert.equal(ctx.changedEvents, 1, 'duplicate import must not emit a fake persistence event');

  result = tools.importPayload('{bad json');
  assert.equal(result.ok, false);
  assert.equal(result.imported, 0);

  const payload = tools.exportPayload();
  assert.equal(payload.schema, 'td.receipt_drafts_export');
  assert.equal(payload.rankable, false);
  assert.equal(payload.drafts.length, 1);

  assert.equal(tools.clearDrafts(), true);
  assert.equal(tools.loadDrafts().length, 0);
  assert.equal(ctx.changedEvents, 2, 'successful clear must emit drafts-changed');
}

{
  const ctx = createTools({ failSet: true });
  const tools = ctx.tools;
  const result = tools.importPayload({ schema: tools.EXPORT_SCHEMA, version: 1, drafts: [{ observation }] });
  assert.equal(result.ok, false, 'failed persistence must not report a successful import');
  assert.equal(result.imported, 0, 'failed persistence must not count drafts as imported');
  assert.equal(result.rejected, 1);
  assert.ok(result.errors.includes('local receipt storage unavailable'));
  assert.equal(tools.loadDrafts().length, 0, 'failed persistence must not create phantom drafts');
  assert.equal(ctx.changedEvents, 0, 'failed persistence must not emit drafts-changed');
  assert.ok(tools.storageError instanceof Error, 'storage failure must remain observable');
  assert.equal(tools.saveDrafts([{ observation }]), null, 'direct save must fail closed');
}

{
  const ctx = createTools({ failRemove: true });
  const tools = ctx.tools;
  assert.equal(tools.clearDrafts(), false, 'blocked clear must report failure');
  assert.equal(ctx.changedEvents, 0, 'blocked clear must not emit a false empty-state event');
  assert.ok(tools.storageError instanceof Error, 'clear failure must remain observable');
}

assert.ok(source.includes('votonobay-receipts-'), 'local receipt export should use current Votonobay naming');
assert.ok(source.includes('if (fresh.length && !saveDrafts'), 'imports must only count persisted drafts');

console.log('receipt local tools: persistence failures are fail-closed and do not create phantom drafts');