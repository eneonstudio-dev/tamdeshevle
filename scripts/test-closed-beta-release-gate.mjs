import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

const gate=read("RELEASE_GATE.md");
const evidence=read("CLOSED_BETA_RELEASE_EVIDENCE.md");
const matrix=read("MVP_ACCEPTANCE_MATRIX.md");
const regressions=read("REGRESSION_BANK.md");
const security=read("SECURITY_GATE_F.md");
const capabilities=read("RETAILER_CAPABILITIES.md");
const providers=read("SOURCE_PROVIDER_REGISTRY.md");
const limitations=read("KNOWN_LIMITATIONS.md");

function section(name,next){
  const start=gate.indexOf(`## ${name}`);
  assert.ok(start>=0,`missing RELEASE_GATE section ${name}`);
  const end=next?gate.indexOf(`## ${next}`,start+1):gate.length;
  return gate.slice(start,end<0?gate.length:end);
}

const gates=[
  ["Gate A — Core shopping loop","Gate B — Product/data truth"],
  ["Gate B — Product/data truth","Gate C — Purchase strategy"],
  ["Gate C — Purchase strategy","Gate D — Handoff"],
  ["Gate D — Handoff","Gate E — Reliability / UX"],
  ["Gate E — Reliability / UX","Gate F — Security / legal / cost"],
  ["Gate F — Security / legal / cost","Gate G — Brand / launch hygiene"]
];
for(const [name,next] of gates){
  const body=section(name,next);
  assert.match(body,/- \[x\]/i,`${name} must contain checked evidence items`);
  assert.doesNotMatch(body,/- \[ \]/,`${name} still has an unchecked release item`);
}
const gateG=section("Gate G — Brand / launch hygiene","Decision");
assert.match(gateG,/- \[ \]/,"Gate G must remain open for closed beta");
assert.doesNotMatch(gateG,/- \[x\]/i,"closed-beta decision must not silently mark public Gate G complete");

const mvpRows=matrix.split("\n").filter(line=>/^\| 0\d\d \|/.test(line));
assert.equal(mvpRows.length,30,"acceptance matrix must contain exactly 30 canonical MVP rows");
assert.ok(mvpRows.every(line=>line.includes("GUARDED")),"all 30 canonical MVP rows must be GUARDED");

const p01Rows=regressions.split("\n").filter(line=>/^\| `REG-\d+` \| P[01] \|/.test(line));
assert.ok(p01Rows.length>0,"regression bank must contain P0/P1 cases");
assert.equal(p01Rows.some(line=>/\| OPEN \|/.test(line)),false,"OPEN P0/P1 regression blocks closed beta");

assert.match(security,/PASS\s*[—-]\s*CLOSED-BETA LOCAL-ONLY SCOPE/i,"Gate F must be explicitly scoped PASS");
assert.match(security,/scope reduction/i,"Gate F must record scope reduction rather than legal approval");
assert.match(evidence,/CANDIDATE PASS/i,"release evidence must remain conditional until replay merge verification");
assert.match(evidence,/Gate G stays OPEN/i,"release evidence must keep public launch separate");

assert.match(capabilities,/COMPARE_ONLY\s*→\s*REDIRECT\s*→\s*DEEP_LINK\s*→\s*PARTNER\s*→\s*API_CART\s*→\s*API_ORDER/,"retailer capability ladder must remain explicit");
assert.match(capabilities,/\| Пятёрочка \| REDIRECT \| NO \|/,"enabled retailer handoff must stay capability-honest");
assert.match(capabilities,/\| Магнит \| REDIRECT \| NO \|/,"enabled retailer handoff must stay capability-honest");
assert.match(providers,/Discovery-only sources must never be silently upgraded/i,"discovery must remain non-authoritative");
assert.match(providers,/Zero-budget mode must not auto-upgrade into paid usage/i,"provider registry must keep zero-budget fail-closed rule");

assert.match(limitations,/does not yet have universal fresh exact-store price\/stock coverage/i,"release must retain exact-store coverage limitation");
assert.match(limitations,/does not currently promise universal automatic retailer cart filling or ordering/i,"release must retain retailer execution limitation");
assert.match(limitations,/not yet final legal clearance/i,"closed beta must not imply public brand/legal clearance");

console.log("Closed-beta release gate A-F evidence: PASS; Gate G remains OPEN.");
