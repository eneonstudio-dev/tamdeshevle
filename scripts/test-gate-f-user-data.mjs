import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

const analytics=read("yandex-metrika.js");
const auth=read("auth-client.js");
const accountUi=read("account-auth-ui.js");
const receiptUi=read("receipt-entry-ui.js");
const receiptRls=read("supabase/migrations/20260910_receipt_submissions.sql");
const accountRls=read("supabase/migrations/20260910_optimize_auth_rls_policies.sql");

// Third-party analytics must remain opt-in and fail closed before any remote script loads.
assert.ok(analytics.includes('const CONSENT_KEY="td:analytics-consent"'),"analytics must use an explicit persisted consent key");
assert.ok(analytics.includes('localStorage.getItem(CONSENT_KEY)==="granted"'),"analytics consent must require an explicit granted value");
assert.ok(analytics.indexOf('if(!hasConsent())return false')<analytics.indexOf('document.createElement("script")'),"analytics must fail closed before third-party script creation");
assert.ok(analytics.includes('localStorage.setItem(CONSENT_KEY,"granted")'),"analytics grant must be an explicit action");
assert.ok(analytics.includes('localStorage.setItem(CONSENT_KEY,"denied")'),"analytics revoke must persist a denied state");

// Account cloud sync must require an authenticated user and destructive restore must be user-confirmed.
assert.ok(auth.includes('async function cloudOperation(action){'),"cloud operations must use the shared authenticated guard");
assert.ok(auth.includes('if(!user())throw new Error("SIGN_IN_REQUIRED")'),"cloud operations must fail closed without a signed-in user");
assert.ok(accountUi.includes("[data-cloud-save],[data-cloud-restore]"),"cloud save/restore must be explicit UI actions");
assert.match(accountUi,/window\.confirm\('Заменить текущую корзину, профиль, адрес и историю облачной копией\?'\)/,"cloud restore must require explicit replacement confirmation");
assert.ok(accountUi.includes("if(b.hasAttribute('data-cloud-save'))await TDAuth.syncLocalToCloud();"),"cloud save must be initiated from the explicit save action");
assert.ok(auth.includes('write("td:before-cloud-restore"'),"cloud restore must preserve an undo copy before replacing device data");

// Receipt evidence must stay local until the user explicitly submits it, and cloud submission must be authenticated/user-scoped.
const receiptClick=receiptUi.indexOf('queueButton.addEventListener("click", async () => {');
const receiptSubmit=receiptUi.indexOf('await window.TDAuth.submitReceiptEvidence');
assert.ok(receiptUi.includes('type="button" disabled>Отправить фото на проверку</button>'),"receipt proof upload must be a separate explicit button, disabled initially");
assert.ok(receiptClick>=0&&receiptSubmit>receiptClick,"receipt cloud submission must occur only inside the explicit upload click handler");
assert.ok(receiptUi.includes('Фото ещё не отправлено — нажми кнопку ниже.'),"receipt UI must tell the user that saving a draft does not upload the photo");
assert.ok(auth.includes('async function submitReceiptEvidence(input){return cloudOperation(async uid=>{'),"receipt submission must inherit authenticated cloud-operation gating");
assert.ok(auth.includes('const path=`${uid}/${receiptFileName(file)}`'),"receipt proof storage path must be scoped to the authenticated user");

// Database/storage policies must enforce private, user-owned receipt evidence and account rows.
assert.ok(receiptRls.includes('alter table public.receipt_submissions enable row level security'),"receipt submissions must have RLS enabled");
assert.ok(receiptRls.includes('using ((select auth.uid()) = user_id)'),"receipt queue reads/deletes must be user-scoped");
assert.ok(receiptRls.includes("values ('receipt-proofs', 'receipt-proofs', false"),"receipt proof bucket must remain private");
assert.ok(receiptRls.includes("(storage.foldername(name))[1] = (select auth.uid()::text)"),"receipt uploads must be constrained to the authenticated user's folder");
for(const table of ["profiles","baskets","addresses","basket_history","preferences"]){
  assert.ok(accountRls.includes(`create policy \"${table} own rows\"`),`${table} must have an own-row RLS policy`);
  assert.ok(accountRls.includes('using ((select auth.uid()) = user_id)'),"account RLS must bind reads to auth.uid()");
}

console.log("Gate F user-data checks passed: analytics opt-in, authenticated explicit cloud sync/restore, explicit receipt upload, private user-scoped storage, and RLS ownership.");
