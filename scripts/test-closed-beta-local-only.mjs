import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const config = fs.readFileSync(new URL('../supabase-config.js', import.meta.url), 'utf8');
const receiptUi = fs.readFileSync(new URL('../receipt-entry-ui.js', import.meta.url), 'utf8');
const policySource = config.split('// Bai learning data is isolated')[0];

assert.match(config, /personalDataMode:\s*"local-only"/);
assert.match(config, /accountCloudEnabled:\s*false/);
assert.match(config, /receiptProofUploadEnabled:\s*false/);
assert.match(config, /window\.TD_SUPABASE\s*=\s*null/);
assert.doesNotMatch(policySource, /sb_publishable_/);
assert.match(policySource, /Object\.defineProperty\(window,\s*"TDAuth"/);
assert.match(policySource, /value\.submitReceiptEvidence\s*=\s*null/);
assert.match(policySource, /value\.syncLocalToCloud\s*=\s*disabledAsync/);
assert.match(policySource, /value\.hydrateLocalFromCloud\s*=\s*disabledAsync/);
assert.match(policySource, /\.receipt-upload/);
assert.match(policySource, /\[data-cloud-save\]/);
assert.match(policySource, /Закрытая бета/);

// Local receipt drafts must remain available even while cloud photo upload is disabled.
assert.match(receiptUi, /localStorage\.setItem\(STORAGE_KEY/);
assert.match(receiptUi, /Сохранить черновик/);
assert.match(receiptUi, /td:receipt-draft-saved/);

const listeners = {};
const makeButton = () => ({
  disabled: false,
  textContent: '',
  attrs: {},
  getAttribute(name) { return this.attrs[name] ?? null; },
  setAttribute(name, value) { this.attrs[name] = String(value); }
});
const authButton = makeButton();
const cloudSave = makeButton();
const cloudRestore = makeButton();
const receiptButton = makeButton();
const accountStatus = { textContent: '' };
const cloudStatus = { textContent: '' };
const receiptStatus = { textContent: '', hidden: true, className: '' };
const accountRoot = {
  querySelector(selector) {
    if (selector === '.td-account-status') return accountStatus;
    if (selector === '.td-cloud-status') return cloudStatus;
    if (selector === '[data-auth]') return authButton;
    if (selector === '[data-cloud-save]') return cloudSave;
    if (selector === '[data-cloud-restore]') return cloudRestore;
    return null;
  }
};
const document = {
  readyState: 'complete',
  documentElement: {},
  querySelector(selector) { return selector === '.receipt-entry-status' ? receiptStatus : null; },
  querySelectorAll(selector) {
    if (selector === '.td-account') return [accountRoot];
    if (selector === '.receipt-upload') return [receiptButton];
    return [];
  },
  addEventListener() {}
};
class MutationObserver { observe() {} }
const window = {
  TDAuth: null,
  TD_SUPABASE: { url: 'https://should-be-disabled.supabase.co', anonKey: 'public-key' },
  addEventListener(type, fn) { listeners[type] = fn; }
};

vm.runInNewContext(policySource, { window, document, MutationObserver, console, Error, Object, Promise });
assert.equal(window.TD_RELEASE_SCOPE.channel, 'closed-beta');
assert.equal(window.TD_RELEASE_SCOPE.personalDataMode, 'local-only');
assert.equal(window.TD_SUPABASE, null);

window.TDAuth = {
  configured: () => true,
  user: () => ({ id: 'should-not-survive' }),
  signInWithEmail: async () => true,
  signOut: async () => true,
  syncLocalToCloud: async () => true,
  hydrateLocalFromCloud: async () => true,
  cloudSummary: async () => ({ baskets: [{}] }),
  submitReceiptEvidence: async () => ({ status: 'pending' }),
  receiptQueue: async () => [{}],
  receiptPriceHistory: async () => [{}],
  isReceiptReviewer: async () => true,
  receiptReviewQueue: async () => [{}],
  receiptProofUrl: async () => 'https://example.test/proof',
  reviewReceipt: async () => ({ status: 'accepted' })
};

assert.equal(window.TDAuth.configured(), false);
assert.equal(window.TDAuth.user(), null);
assert.equal(window.TDAuth.submitReceiptEvidence, null);
assert.equal(window.TDAuth.receiptQueue, null);
await assert.rejects(window.TDAuth.syncLocalToCloud(), /CLOSED_BETA_LOCAL_ONLY/);
await assert.rejects(window.TDAuth.hydrateLocalFromCloud(), /CLOSED_BETA_LOCAL_ONLY/);

assert.equal(authButton.disabled, true);
assert.equal(authButton.textContent, 'Локальный режим');
assert.equal(cloudSave.disabled, true);
assert.equal(cloudRestore.disabled, true);
assert.equal(receiptButton.disabled, true);
assert.match(receiptButton.textContent, /отключена/i);
assert.match(accountStatus.textContent, /данные хранятся только на этом устройстве/i);
assert.match(cloudStatus.textContent, /облачная синхронизация отключена/i);

listeners['td:receipt-draft-saved']?.();
await Promise.resolve();
assert.equal(receiptStatus.hidden, false);
assert.match(receiptStatus.textContent, /Черновик сохранён на устройстве/);
assert.match(receiptStatus.textContent, /отключена в закрытой бете/);

console.log('Closed-beta local-only guard passed: account/cloud/receipt personal-data flows fail closed while local drafts remain available.');
