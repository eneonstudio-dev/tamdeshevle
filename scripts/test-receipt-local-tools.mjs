import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../receipt-local-tools.js', import.meta.url), 'utf8');
const entrySource = fs.readFileSync(new URL('../receipt-entry-ui.js', import.meta.url), 'utf8');

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

function createEntry({ failSet = false } = {}) {
  const storage = new Map();
  const localStorage = {
    getItem: key => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => { if (failSet) throw new Error('quota'); storage.set(key, String(value)); }
  };
  const context = {
    window: null,
    document: {
      readyState: 'loading',
      documentElement: {},
      addEventListener() {},
      removeEventListener() {},
      querySelector() { return null; },
      body: { style: {}, appendChild() {} }
    },
    localStorage,
    MutationObserver: class { observe() {} },
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    FormData: class {},
    Date,
    console: { ...console, warn() {} },
    setTimeout
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(entrySource, context);
  return { entry: context.TDReceiptEntry, storage };
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

{
  const ctx = createEntry();
  assert.ok(ctx.entry && typeof ctx.entry.saveDraft === 'function', 'receipt entry must expose fail-closed draft persistence');
  assert.equal(ctx.entry.saveDraft(observation, 'receipt.jpg'), true, 'receipt entry draft should report successful persistence');
  assert.equal(ctx.entry.loadDrafts().length, 1, 'successful entry persistence must be readable');
}

{
  const ctx = createEntry({ failSet: true });
  assert.equal(ctx.entry.saveDraft(observation, null), false, 'receipt entry must not throw or report success when storage rejects a write');
  assert.equal(ctx.entry.loadDrafts().length, 0, 'failed entry persistence must not create a phantom draft');
}

assert.ok(source.includes('votonobay-receipts-'), 'local receipt export should use current Votonobay naming');
assert.ok(source.includes('if (fresh.length && !saveDrafts'), 'imports must only count persisted drafts');
assert.ok(entrySource.includes('Receipt draft storage unavailable'), 'entry UI must handle local storage write failures');
assert.ok(entrySource.includes('if (!saveDraft(observation'), 'entry UI must only announce a draft after it was persisted');
assert.ok(entrySource.includes('Number.isFinite(observedDate.getTime())'), 'entry UI must reject invalid receipt dates without throwing');
assert.ok(entrySource.includes('!Number.isFinite(price) || price <= 0'), 'entry UI must reject non-positive or invalid prices explicitly');
assert.ok(entrySource.includes('!Number.isFinite(quantity) || quantity <= 0'), 'entry UI must reject non-positive or invalid quantities explicitly');
assert.ok(entrySource.includes('event.key === "Escape"'), 'receipt sheet must close with Escape');
assert.ok(entrySource.includes('sheet.querySelectorAll(FOCUSABLE)'), 'receipt sheet must trap keyboard focus');
assert.ok(entrySource.includes('document.body.style.overflow = "hidden"') && entrySource.includes('document.body.style.overflow = previousOverflow'), 'receipt sheet must lock and restore background scrolling');
assert.ok(entrySource.includes('opener.focus'), 'receipt sheet must return focus to its opener');
assert.ok(!entrySource.includes('TDBai'), 'receipt entry resilience must stay independent from Bai runtime');

console.log('receipt local tools: persistence failures are fail-closed, entry validation cannot crash on invalid input, and receipt modal lifecycle is keyboard-safe');
