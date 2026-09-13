import fs from 'node:fs';
import assert from 'node:assert/strict';
import { validateRegistry, validateExample, trainingEligibility, exportTraining } from './firewall.mjs';
import { benchmark } from './benchmark.mjs';
import { assertLocalEndpoint, toCandidate } from './local-teacher-runner.mjs';

const here=new URL('./',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',here),'utf8'));
const gold=fs.readFileSync(new URL('gold-seed.jsonl',here),'utf8').trim().split('\n').map(JSON.parse);

assert.equal(validateRegistry(registry).ok,true);
for(const row of gold)assert.equal(validateExample(row,registry).ok,true);
assert.equal(exportTraining(gold,registry).length,gold.length);
assert.equal(trainingEligibility(gold[0],registry).eligible,true);
assert.equal(assertLocalEndpoint('http://127.0.0.1:8000'),'http://127.0.0.1:8000');
assert.throws(()=>assertLocalEndpoint('https://example.com'));

const candidate=toCandidate(gold[0],gold[0].target,{sourceId:'deepseek_r1_local_mit',model:'deepseek-r1'});
assert.equal(validateExample(candidate,registry).ok,true);
assert.equal(trainingEligibility(candidate,registry).eligible,false,'teacher candidates require review before training');

const predictions=gold.map(row=>({id:row.id,intent:row.target.intent,hard_constraints:row.target.hard_constraints,actions:row.target.actions,retained_constraints:row.session_context.constraints||[],critic:{pass:true},repair_attempted:false}));
const metrics=benchmark(gold,predictions);
assert.equal(metrics.intent_accuracy,1);
assert.equal(metrics.constraint_pass_rate,1);
assert.equal(metrics.action_success_rate,1);

console.log('Bai Teacher Lab smoke passed');
