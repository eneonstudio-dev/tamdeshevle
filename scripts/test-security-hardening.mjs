import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const index=read("index.html");
const admin=read("bai-learning-admin.html");
const auth=read("auth-client.js");
const geo=read("geo-store-map.js");
const app=read("app.js");
const covers=read("store-covers.js");
const provenance=read("price-provenance-ui.js");
const analytics=read("yandex-metrika.js");
const agent=read("backend/bai-agent-core.ts");
const schema=read("backend/bai-agent-core-schema.sql");
const trained=read("supabase/functions/bai-trained-inference/index.ts");

assert.match(index,/Content-Security-Policy/i,"main page must define a CSP");
assert.match(index,/object-src 'none'/,"CSP must block plugin/object content");
assert.match(index,/base-uri 'self'/,"CSP must prevent base-tag injection");
assert.match(index,/gsap@3\.12\.7[^>]+integrity="sha384-/,"GSAP must be pinned with SRI");
assert.ok(index.includes('src="yandex-metrika.js"'),"analytics bootstrap must be a local CSP-governed script");
assert.doesNotMatch(index,/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i,"main page must not contain inline script blocks");

assert.match(admin,/Content-Security-Policy/i,"admin page must define a CSP");
assert.match(admin,/@supabase\/supabase-js@2\.116\.0[^>]+integrity="sha384-/,"admin SDK must be exactly pinned with SRI");
assert.ok(auth.includes('@supabase/supabase-js@2.116.0/dist/umd/supabase.min.js'),"dynamic auth SDK must be exactly pinned");
assert.ok(auth.includes('s.integrity=CDN_INTEGRITY'),"dynamic auth SDK must verify SRI");
assert.ok(geo.includes('leaflet@1.9.4')&&geo.includes('script.integrity=')&&geo.includes('link.integrity='),"Leaflet JS and CSS must verify SRI");

assert.doesNotMatch(app,/value="\$\{state\.(?:q|address)\}/,"user-controlled input values must be HTML-escaped");
assert.doesNotMatch(covers,/value="\$\{state\.address/,'home address must be HTML-escaped');
assert.ok(provenance.includes('function safeUrl(')&&provenance.includes('link.rel = "noopener noreferrer"'),"retailer source links must reject unsafe schemes");

assert.ok(analytics.includes('td:analytics-consent'),"analytics must have an explicit persisted consent gate");
assert.ok(analytics.indexOf('if(!hasConsent())return false')<analytics.indexOf('document.createElement("script")'),"analytics must fail closed before loading a third-party script");
assert.ok(analytics.includes('localStorage.setItem(CONSENT_KEY,"granted")'),"analytics opt-in must be explicit rather than inferred from page use");

assert.ok(agent.includes('reserve_bai_agent_request'),"Agent Core must use the atomic database limiter");
assert.ok(schema.includes('pg_advisory_xact_lock'),"atomic limiter must lock per actor");
assert.ok(schema.includes('to service_role'),"atomic limiter must remain server-only");

const paidFlagIndex=agent.indexOf('BAI_LLM_PAID_ENABLED');
const providerFetchIndex=agent.indexOf('const res=await fetch(endpoint');
assert.ok(paidFlagIndex>=0,"zero-budget release path must require an explicit server-side paid-provider enable flag");
assert.ok(providerFetchIndex>paidFlagIndex,"paid-provider enable decision must happen before external LLM fetch");
assert.match(agent,/model_disabled_zero_budget/,"disabled paid-provider path must fail closed to deterministic rules");
assert.ok(trained.includes('trained_release_not_bound'),"trained inference must fail closed when no promoted release is bound");
assert.ok(trained.indexOf('trained_release_not_bound')<trained.indexOf('BAI_TRAINED_BACKEND_URL'),"trained release binding must be verified before a private backend can be called");

const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name===".git"||entry.name==="node_modules")continue;const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else files.push(full)}}
walk(root);
const secretPatterns=[/sb_secret_[A-Za-z0-9_-]{16,}/,/gh[pousr]_[A-Za-z0-9]{20,}/,/sk-[A-Za-z0-9_-]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
for(const file of files){if(!/\.(?:js|mjs|ts|html|json|sql|ya?ml|md)$/i.test(file))continue;const source=fs.readFileSync(file,"utf8");for(const pattern of secretPatterns)assert.doesNotMatch(source,pattern,`tracked secret-like value in ${path.relative(root,file)}`)}

for(const file of files.filter(file=>/\.ya?ml$/i.test(file)&&file.includes(`${path.sep}.github${path.sep}workflows${path.sep}`))){
  const source=fs.readFileSync(file,"utf8");
  assert.doesNotMatch(source,/\buses:\s*[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@v\d+\b/,`GitHub Action must be pinned to a commit SHA in ${path.relative(root,file)}`);
}

console.log("Security hardening checks passed: CSP/SRI, DOM escaping, URL filtering, consent-gated analytics, zero-budget AI fail-closed, atomic rate limiting, trained release binding, secret scan, and pinned Actions.");