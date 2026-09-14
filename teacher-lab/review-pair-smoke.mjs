import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildCorpus} from './corpus-builder.mjs';
import {structuredHash} from './candidate-import.mjs';
import {buildTeacherReview} from './review-teacher-pair.mjs';

const here=new URL('./',import.meta.url),read=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const registry=read('sources.json'),leftProfile=read('profiles/deepseek-r1-distill-qwen-7b.json'),rightProfile=read('profiles/qwen3-8b.json');
const tasks=buildCorpus().slice(0,3);
const output=(budget=2500)=>({intent:'build_basket',hard_constraints:{budget_max:budget},soft_preferences:{price:'balanced'},shopping_plan:{categories:['protein','base','fruit']},actions:[{type:'set_constraint',payload:{key:'budget',value:budget}}],critic:{pass:true,issues:[]},confidence:{overall:'high'}});
const rawOutput=(task,profile,o)=>({task_id:task.id,profile_id:profile.id,model:profile.model,revision:profile.revision,prompt_version:'test-v2',prompt_sha256:'a'.repeat(64),output_sha256:structuredHash(o),runtime_fingerprint:'b'.repeat(64),generation:{temperature:0.2,max_tokens:100},output:o});
const raw=(task,profile,budget=2500)=>rawOutput(task,profile,output(budget));
const leftRun={results:tasks.map(t=>raw(t,leftProfile))};
const rightRun={results:[raw(tasks[0],rightProfile),raw(tasks[1],rightProfile,3000)]};
const result=buildTeacherReview({leftRun,rightRun,leftProfile,rightProfile,registry,tasks});
assert.equal(result.left.candidates.length,3);
assert.equal(result.right.candidates.length,2);
assert.equal(result.summary.auto_approved,0);
assert.equal(result.summary.agreements,1);
assert.equal(result.summary.conflicts,1);
assert.equal(result.summary.missing,1);
assert.equal(result.summary.contract_violations,0);
assert.equal(result.queue.every(x=>x.decision==='pending_review'),true);
assert.ok(result.queue.find(x=>x.status==='conflict').flags.includes('hard_constraints'));
assert.equal(result.left.candidates[0].provenance.sources[0].revision,leftProfile.revision);
assert.equal(result.right.candidates[0].provenance.sources[0].revision,rightProfile.revision);
assert.match(result.left.candidates[0].provenance.sources[0].runtime_fingerprint,/^[0-9a-f]{64}$/);

const semanticTask={id:'semantic_budget_edit',user_request:'Бюджет теперь 4000, больше ничего не меняй',session_context:{budget:5000,constraints:['budget<=5000','exclude_brand:Мираторг'],basket:['курица','рис']},guards:{must_keep_hard_constraints:true},expected:{intent_family:'edit_basket',must_retain:['exclude_brand:Мираторг'],must_drop:['budget<=5000'],new_hard:['budget<=4000'],required_effects:['budget:4000']}};
const invalid={intent:'edit_basket',hard_constraints:{budget_max:5000,excluded_brands:['Мираторг']},soft_preferences:{},shopping_plan:{},actions:[{type:'set_constraint',payload:{key:'budget',value:5000}}],critic:{pass:true,issues:[]},confidence:{overall:'high'}};
const invalidReview=buildTeacherReview({leftRun:{results:[rawOutput(semanticTask,leftProfile,invalid)]},rightRun:{results:[rawOutput(semanticTask,rightProfile,invalid)]},leftProfile,rightProfile,registry,tasks:[semanticTask]});
assert.equal(invalidReview.queue[0].status,'conflict','teachers agreeing on an invalid contract must not stay agreement');
assert.ok(invalidReview.queue[0].conflicts.includes('contract_violation'));
assert.ok(invalidReview.queue[0].flags.includes('left_contract:new_hard_missing:budget<=4000'));
assert.ok(invalidReview.queue[0].flags.includes('right_contract:must_drop_violation:budget<=5000'));
assert.equal(invalidReview.summary.contract_violations,1);

const valid={intent:'edit_basket',hard_constraints:{budget_max:4000,excluded_brands:['Мираторг']},soft_preferences:{},shopping_plan:{},actions:[{type:'set_constraint',payload:{key:'budget',value:4000}}],critic:{pass:true,issues:[]},confidence:{overall:'high'}};
const validReview=buildTeacherReview({leftRun:{results:[rawOutput(semanticTask,leftProfile,valid)]},rightRun:{results:[rawOutput(semanticTask,rightProfile,valid)]},leftProfile,rightProfile,registry,tasks:[semanticTask]});
assert.equal(validReview.queue[0].status,'agree');
assert.equal(validReview.summary.contract_violations,0);

console.log('Bai teacher pair review smoke passed');
