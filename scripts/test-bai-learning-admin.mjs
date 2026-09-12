import fs from "node:fs";
import assert from "node:assert/strict";

const admin=fs.readFileSync(new URL("../backend/bai-learning-admin.ts",import.meta.url),"utf8");
const schema=fs.readFileSync(new URL("../backend/bai-learning-admin-schema.sql",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../bai-learning-admin.html",import.meta.url),"utf8");
const ui=fs.readFileSync(new URL("../bai-learning-admin.js",import.meta.url),"utf8");
const index=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");

assert.ok(admin.includes("/auth/v1/user"),"admin endpoint must verify the existing TD auth token server-side");
assert.ok(admin.includes("receipt_reviewers"),"admin authorization must reuse trusted reviewer membership");
assert.ok(admin.includes("Authorization:header"),"reviewer lookup must preserve caller auth context");
assert.ok(admin.includes("apikey:apiKey"),"reviewer lookup must use the caller's public project key");
assert.ok(!/user_metadata|raw_user_meta_data|email\s*===/i.test(admin),"user-editable metadata/email must not authorize learning admins");
assert.ok(admin.includes("can_activate:false"),"admin v1 must not expose global activation");
assert.ok(!admin.includes('from("bai_approved_patterns").insert'),"admin endpoint must not activate learned patterns directly");
assert.ok(/action\s*===?\s*["']approve["']\s*\?\s*["']approved_for_regression["']/.test(admin),"approve must only move a case toward regression");
assert.ok(admin.includes('activation:false'),"admin decisions must explicitly remain non-activating");
assert.ok(admin.includes('req.method==="OPTIONS"'),"cross-origin admin UI must handle CORS preflight");

assert.ok(schema.includes("bai_learning_admin_decisions"));
assert.ok(schema.includes("enable row level security"));
assert.ok(schema.includes("from public, anon, authenticated"),"browser roles must be denied at grants layer");
assert.ok(!/security\s+definer/i.test(schema),"admin schema must not add SECURITY DEFINER helpers");

assert.match(html,/noindex,nofollow,noarchive/i,"admin page must stay out of search indexing");
assert.ok(!index.includes("bai-learning-admin"),"ordinary visitors must not get an admin navigation link");
assert.ok(ui.includes("textContent"),"untrusted learning text must render as text");
assert.ok(!ui.includes("innerHTML"),"admin UI must not inject learning text through innerHTML");
assert.ok(ui.includes("adminEndpoint"));
assert.ok(ui.includes("apikey:cfg.anonKey"));

console.log("Bai learning admin access and UI checks passed");
