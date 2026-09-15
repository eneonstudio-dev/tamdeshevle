import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluateCharacterCandidate,CHARACTER_REGRESSION_RULES} from "./bai-character-regression-evaluator.mjs";

const suite=JSON.parse(fs.readFileSync(new URL("../data/bai-character-regression-v1.json",import.meta.url),"utf8"));
const canon=fs.readFileSync(new URL("../BAI_CHARACTER_CANON.md",import.meta.url),"utf8");
const architecture=fs.readFileSync(new URL("../BAY_ENGINE_ARCHITECTURE.md",import.meta.url),"utf8");

assert.equal(suite.schema_version,"1.0");
assert.equal(suite.suite_id,"bai-character-regression-v1");
assert.equal(suite.canon,"BAI_CHARACTER_CANON.md");
assert.equal(CHARACTER_REGRESSION_RULES.exactWordingRequired,false,"provider benchmark must test behaviour, not memorized wording");
assert.ok(Array.isArray(suite.cases));
assert.equal(suite.cases.length,16,"v1 Character Canon suite is frozen at 16 baseline scenarios");

const ids=new Set();
const tags=new Set();
for(const scenario of suite.cases){
  assert.match(scenario.id,/^BCR-\d{3}-[a-z0-9-]+$/,"every scenario needs a stable BCR id");
  assert.equal(ids.has(scenario.id),false,`duplicate scenario id: ${scenario.id}`);
  ids.add(scenario.id);
  assert.ok(Array.isArray(scenario.tags)&&scenario.tags.length>0,`${scenario.id}: tags required`);
  scenario.tags.forEach(tag=>tags.add(tag));
  assert.equal(typeof scenario.user,"string",`${scenario.id}: user text required`);
  assert.ok(scenario.expected&&typeof scenario.expected==="object",`${scenario.id}: expected contract required`);
  assert.ok(scenario.passing_candidate&&scenario.failing_candidate,`${scenario.id}: pass/fail calibration pair required`);

  const good=evaluateCharacterCandidate(scenario,scenario.passing_candidate);
  assert.equal(good.ok,true,`${scenario.id}: passing calibration candidate failed: ${good.errors.join(", ")}`);

  const bad=evaluateCharacterCandidate(scenario,scenario.failing_candidate);
  assert.equal(bad.ok,false,`${scenario.id}: failing calibration candidate was accepted`);
}

for(const required of [
  "real-value","not-cheapest-only","autonomy","questions","truth","uncertainty","competitor-neutrality",
  "serious-mode","memory","confidence","correction","error","profanity","pantry","persona-boundary","humor","brevity","skepticism"
]) assert.ok(tags.has(required),`Character Canon suite missing coverage tag: ${required}`);

assert.match(canon,/Бай защищает человека не от высокой цены[\.\s]+Бай защищает человека от плохого решения/i);
assert.match(canon,/Человек не тупой\. Человек занятой\./i);
assert.match(canon,/Личность и reasoning должны быть разделены/i);
assert.match(canon,/Архитектура должна подстраиваться под персонажа/i);
for(const memoryProperty of ["источник","уверенность","актуальность","возможность исправления"]){
  assert.ok(canon.toLowerCase().includes(memoryProperty),`Character Canon must retain memory property: ${memoryProperty}`);
}
assert.match(architecture,/Character regression/i,"Bay Engine architecture must require character regression before provider replacement");

const immutableScenario=suite.cases.find(x=>x.id.startsWith("BCR-013-"));
const invented=evaluateCharacterCandidate(immutableScenario,{
  ...immutableScenario.passing_candidate,
  claims:{...immutableScenario.passing_candidate.claims,availability:true}
});
assert.equal(invented.ok,false,"new truth-critical claims must be rejected even when the rest of the answer is good");
assert.ok(invented.errors.includes("unverified_claim:availability"));

const memoryScenario=suite.cases.find(x=>x.id.startsWith("BCR-009-"));
const permanentMemory=evaluateCharacterCandidate(memoryScenario,{
  ...memoryScenario.passing_candidate,
  memory_updates:[{key:"avoid_brand",value:"Мираторг",source:"repeated_explicit_rejection",confidence:1,freshness:"permanent",correctable:false}]
});
assert.equal(permanentMemory.ok,false,"repeated preference must still not become an uncorrectable eternal rule");
assert.ok(permanentMemory.errors.includes("memory_confidence_not_bounded"));
assert.ok(permanentMemory.errors.includes("memory_freshness_invalid"));
assert.ok(permanentMemory.errors.includes("memory_not_correctable"));

console.log(`Bay Character Canon regression passed: ${suite.cases.length}/${suite.cases.length} frozen provider-independent scenarios, calibrated hard gates, truth immutability and bounded memory.`);
