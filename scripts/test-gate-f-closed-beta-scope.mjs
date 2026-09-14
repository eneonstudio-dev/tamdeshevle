import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

const scope=read("release-scope.js");
const index=read("index.html");
const auth=read("auth-client.js");
const account=read("account-hub.js");
const receipt=read("receipt-entry-ui.js");
const participationQa=read("scripts/test-gate-f-user-data-notice.py");

assert.match(scope,/remoteAccount\s*:\s*false/,"closed beta must disable remote account flow by default");
assert.match(scope,/cloudSync\s*:\s*false/,"closed beta must disable cloud sync by default");
assert.match(scope,/receiptUpload\s*:\s*false/,"closed beta must disable receipt upload by default");
assert.doesNotMatch(scope,/qa-remote-enabled/,"production release scope must not contain the remote-enabled QA override");

const scopePos=index.indexOf('src="release-scope.js');
assert.ok(scopePos>=0,"index must load release-scope.js");
for(const script of ["receipt-entry-ui.js","auth-client.js","account-auth-ui.js"]){
  const pos=index.indexOf(`src="${script}`);
  assert.ok(pos>scopePos,`release scope must load before ${script}`);
}

assert.match(auth,/TDReleaseScope/,"auth client must consult release scope");
assert.match(auth,/remoteAccount/,"auth initialization must be gated by remoteAccount");
assert.match(auth,/cloudSync/,"cloud operations must be gated by cloudSync");
assert.match(auth,/receiptUpload/,"receipt evidence upload must be gated by receiptUpload");
assert.match(auth,/RELEASE_SCOPE_DISABLED/,"disabled remote data flows must fail closed with an explicit error");
assert.ok(
  auth.indexOf('if(!releaseEnabled("remoteAccount"))return false') < auth.indexOf('function loadSdk()'),
  "remote account scope must fail closed before loading the Supabase SDK"
);
assert.ok(
  auth.indexOf('if(!releaseEnabled("receiptUpload"))throw new Error("RELEASE_SCOPE_DISABLED")') < auth.indexOf('client.storage.from(RECEIPT_BUCKET).upload'),
  "receipt upload scope must fail closed before any storage upload"
);

assert.match(account,/TDReleaseScope/,"account UI must consult release scope");
assert.match(account,/closed-beta-local-first|Закрытая бета/,"account UI must explain local-only beta scope");
assert.match(receipt,/TDReleaseScope/,"receipt UI must consult release scope");
assert.match(receipt,/receiptUpload/,"receipt remote submission UI must be gated by receiptUpload");
assert.match(receipt,/локаль|Локаль|закрыт/i,"receipt UI must explain local-only behavior when upload is disabled");

assert.match(participationQa,/Page\.addScriptToEvaluateOnNewDocument/,"remote participation QA must opt in before document scripts run");
assert.match(participationQa,/qa-remote-enabled/,"remote participation QA must use an explicit test-only release mode");
assert.match(participationQa,/enabled:\(\)=>true/,"remote participation QA must explicitly enable remote flows only in its isolated browser");

console.log("Gate F closed-beta release scope: PASS");