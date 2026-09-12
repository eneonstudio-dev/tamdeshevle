import fs from 'node:fs';
import assert from 'node:assert/strict';
import {scoreCase,scoreSuite,compareCandidate} from '../server/bai-evolution-policy.mjs';

const cases=JSON.parse(fs.readFileSync(new URL('../backend/bai-evolution-cases.json',import.meta.url),'utf8'));
assert.ok(cases.length>=12,'evolution suite must cover a meaningful grocery corpus');
assert.equal(new Set(cases.map(x=>x.id)).size,cases.length,'evolution case ids must be unique');
assert.ok(cases.filter(x=>x.critical).length>=8,'most core shopping safety cases should be critical');

const ambiguous=cases.find(x=>x.id==='ambiguous_replace');
const unsafe=scoreCase(ambiguous,{operations:[{type:'REPLACE_PRODUCT',value:{from:'milk',to:'water'}}]});
assert.equal(unsafe.passed,false,'ambiguous replacement must not pass with a guessed mutation');
assert.equal(unsafe.criticalFailure,true,'guessed ambiguous replacement is a critical regression');
const safe=scoreCase(ambiguous,{operations:[{type:'ASK_CLARIFICATION',value:'На что заменить молоко?'}],expectsAnswer:true});
assert.equal(safe.passed,true,'one clarification should pass an ambiguous replacement case');

const baselineOutputs=cases.map(c=>({id:c.id,output:{operations:[]}}));
const baseline=scoreSuite(cases,baselineOutputs);
const candidateOutputs=cases.map(c=>({id:c.id,output:{operations:c.requiredOperations||[...(c.requiredTypes||[]).map(type=>({type,value:type==='CHANGE_BUDGET'?3000:type==='SET_PEOPLE'?4:type==='SET_DURATION'?3:type==='SET_COOKING'?'minimal':type==='ADD_PREFERENCE'?'fruit':type==='SET_MODE'?'one':undefined}))],expectsAnswer:Boolean(c.expectsClarification)}}));
for(const item of candidateOutputs){
  const c=cases.find(x=>x.id===item.id);
  if(c.expectsClarification)item.output.operations=[{type:'ASK_CLARIFICATION',value:'Уточни, пожалуйста.'}];
  item.output.operations=item.output.operations.filter(Boolean);
}
const candidate=scoreSuite(cases,candidateOutputs);
assert.ok(candidate.averageScore>baseline.averageScore,'candidate fixture must outperform empty baseline');
const decision=compareCandidate(baseline,candidate,{minGain:1,minPassRate:70});
assert.equal(decision.autoPromote,false,'evolution gate must never auto-promote directly to production');
assert.equal(decision.requiresCanary,true,'eligible candidates must require canary');

const bad={...candidate,averageScore:candidate.averageScore+5,passRate:100,criticalFailures:1};
const blocked=compareCandidate(baseline,bad,{minGain:1,minPassRate:70});
assert.equal(blocked.eligible,false,'one critical regression must block promotion');
assert.ok(blocked.reasons.includes('critical_regression'));

const worse={...candidate,averageScore:baseline.averageScore-1,passRate:baseline.passRate-1,criticalFailures:0};
const regressed=compareCandidate(baseline,worse,{minGain:1,minPassRate:0});
assert.equal(regressed.eligible,false,'lower-scoring candidate must not advance');
assert.ok(regressed.reasons.includes('insufficient_score_gain'));
assert.ok(regressed.reasons.includes('pass_rate_regression'));

console.log(`Bai evolution gate passed: ${cases.length} behavior cases, critical-regression block, score gain gate, canary-only promotion.`);
