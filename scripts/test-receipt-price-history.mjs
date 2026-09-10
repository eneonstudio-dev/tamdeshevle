import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const migration = fs.readFileSync("supabase/migrations/20260912_receipt_price_history.sql", "utf8");
assert.match(migration, /alter table public\.receipt_price_history enable row level security/i);
assert.match(migration, /revoke all on public\.receipt_price_history from anon, authenticated/i);
assert.match(migration, /grant select on public\.receipt_price_history to authenticated/i);
assert.doesNotMatch(migration, /grant\s+(insert|update|delete).*receipt_price_history.*authenticated/i);
assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public/i);
assert.match(migration, /store_scope_verified/i);
assert.match(migration, /line\.decision = 'accepted'/i);
assert.match(migration, /new\.observed_at \+ interval '24 hours'/i);
assert.match(migration, /unique \(submission_id, line_index\)/i);

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("receipt-price-history-model.js", "utf8"), context);
const model = context.window.TDReceiptPriceHistory;
const observed = Date.parse("2026-09-10T10:00:00.000Z");
const row = { expires_at: "2026-09-11T10:00:00.000Z" };
assert.equal(model.DAY_MS, 86_400_000);
assert.equal(model.status(row, observed + model.DAY_MS - 1), "fresh");
assert.equal(model.status(row, observed + model.DAY_MS), "expired");
assert.equal(model.status({ expires_at: "bad" }, observed), "expired");
assert.equal(model.remainingMs(row, observed + model.DAY_MS - 500), 500);
assert.equal(model.remainingMs(row, observed + model.DAY_MS + 1), 0);
console.log("receipt price history tests passed");
