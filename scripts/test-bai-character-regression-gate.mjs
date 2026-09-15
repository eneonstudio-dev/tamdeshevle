import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runCharacterGate} from './bai-character-regression-runner.mjs';

const here=new URL('../',import.meta.url),read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const baseFile=new URL('data/bai-character-regression-v1.json',here),suppFile=new URL('data/bai-character-regression-supplement-v1.json',here);
const base=read(baseFile),supp=read(suppFile),cases=[...base.cases,...supp.cases];
assert.equal(base.cases.length,16,'frozen baseline stays 16');
assert.deepEqual(supp.cases.map(x=>x.id),['BCR-017-initiative-needs-value','BCR-018-user-sovereignty-after-warning','BCR-019-text-truth-cannot-bypass-claims']);
assert.equal(supp.training_allowed,false);
const good=cases.map(s=>({id:s.id,candidate:s.passing_candidate}));
const pass=runCharacterGate({providerId:'fixture-good',candidates:good,baseFile,supplementFile:suppFile});
assert.equal(pass.ok,true,JSON.stringify(pass,null,2));
assert.equal(pass.total,19);assert.equal(pass.passed,19);assert.equal(pass.training_started,false);

const replace=(id,mutate)=>good.map(row=>row.id===id?{id,candidate:mutate({...row.candidate})}:row);
let result=runCharacterGate({providerId:'question-leak',candidates:replace('BCR-006-safe-reversible-action-no-interview',c=>({...c,reply:'Убрал воду. Что-нибудь ещё?'})),baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.cases.find(x=>x.id.startsWith('BCR-006-')).errors.includes('question_in_reply_without_clarification'));

result=runCharacterGate({providerId:'empty-initiative',candidates:replace('BCR-017-initiative-needs-value',()=>supp.cases[0].failing_candidate),baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.cases.find(x=>x.id.startsWith('BCR-017-')).errors.includes('empty_initiative'));

result=runCharacterGate({providerId:'sovereignty',candidates:replace('BCR-018-user-sovereignty-after-warning',()=>supp.cases[1].failing_candidate),baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.cases.find(x=>x.id.startsWith('BCR-018-')).errors.some(x=>x.startsWith('decision:')));

result=runCharacterGate({providerId:'text-truth',candidates:replace('BCR-019-text-truth-cannot-bypass-claims',()=>supp.cases[2].failing_candidate),baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.cases.find(x=>x.id.startsWith('BCR-019-')).errors.some(x=>x.startsWith('forbidden_reply_claim:')));

result=runCharacterGate({providerId:'numeric-untracked',candidates:replace('BCR-014-normal-answer-does-not-force-character',c=>({...c,claims:{}})),baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.cases.find(x=>x.id.startsWith('BCR-014-')).errors.includes('untracked_numeric_claim:1450'));

const repeated=good.map((row,i)=>i<3?{...row,candidate:{...row.candidate,reply:`Так. ${row.candidate.reply}`}}:row);
result=runCharacterGate({providerId:'catchphrase',candidates:repeated,baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.errors.includes('catchphrase_overuse:tak:3'));

result=runCharacterGate({providerId:'missing-case',candidates:good.slice(1),baseFile,supplementFile:suppFile});
assert.equal(result.ok,false);assert.ok(result.errors.some(x=>x.startsWith('missing_candidate:')));
console.log('Bay Character eval-only gate passed: frozen 16 + 3 supplemental cases, question leakage, initiative, sovereignty, text/numeric truth escape and catchphrase repetition are guarded. No training path executed.');
