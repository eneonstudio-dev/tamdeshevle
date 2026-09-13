import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildCorpus} from './corpus-builder.mjs';
import {assertProfile,runTask,runBatch} from './run-local-batch.mjs';
import {importTeacherResults} from './candidate-import.mjs';
import {comparePair,buildConsensusQueue} from './teacher-consensus.mjs';

const here=new URL('./',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const registry=read('sources.json');
const deepseek=read('profiles/deepseek-r1-distill-qwen-7b.json');
const qwen=read('profiles/qwen3-8b.json');
const tasks=buildCorpus();
assert.equal(assertProfile(deepseek).id,deepseek.id);
assert.throws(()=>assertProfile({...deepseek,endpoint:'https://example.com'}));

const teacherOutput={intent:'build_basket',hard_constraints:{budget_max:2500},soft_preferences:{price:'balanced'},shopping_plan:{categories:['protein','base','fruit']},actions:[{type:'CHANGE_BUDGET',value:2500}],critic:{pass:true,issues:[]},confidence:{overall:'high'}};
let calls=0;
const fakeFetch=async()=>{calls++;return{ok:true,status:200,json:async()=>({choices:[{message:{content:`internal draft that must not be stored\n${JSON.stringify(teacherOutput)}`}}]})}};
const one=await runTask({task:tasks[0],profile:deepseek,fetchImpl:fakeFetch});
assert.equal(one.task_id,tasks[0].id);
assert.deepEqual(one.output,teacherOutput);
assert.equal(JSON.stringify(one).includes('internal draft'),false,'raw teacher prose must not be persisted');
const batch=await runBatch({tasks:tasks.slice(0,2),profile:deepseek,fetchImpl:fakeFetch});
assert.equal(batch.results.length,2);assert.equal(batch.errors.length,0);assert.equal(calls,3);

const a=importTeacherResults({rows:[one],tasks,profile:deepseek,registry}).candidates[0];
const qRaw={task_id:tasks[0].id,profile_id:qwen.id,output:teacherOutput};
const b=importTeacherResults({rows:[qRaw],tasks,profile:qwen,registry}).candidates[0];
assert.equal(comparePair(a,b).pass,true);
const bad=JSON.parse(JSON.stringify(b));bad.target.hard_constraints={budget_max:3000};
const conflict=comparePair(a,bad);
assert.equal(conflict.pass,false);assert.equal(conflict.requires_review,true);assert.ok(conflict.conflicts.includes('hard_constraints'));
const queue=buildConsensusQueue([a],[bad]);assert.equal(queue[0].status,'conflict');
const missing=buildConsensusQueue([a],[]);assert.equal(missing[0].status,'missing_teacher');
console.log('Bai local teacher runner smoke passed');
