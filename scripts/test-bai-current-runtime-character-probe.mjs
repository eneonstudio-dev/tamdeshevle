import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {evaluateCharacterGateBatch} from './bai-character-regression-gate.mjs';

const read=url=>JSON.parse(fs.readFileSync(url,'utf8'));
const suite=read(new URL('../data/bai-character-runtime-probe-v1.json',import.meta.url));
assert.equal(suite.training_allowed,false,'runtime probe must remain eval-only');
assert.equal(suite.suite_id,'bai-character-runtime-probe-v1');
assert.ok(Array.isArray(suite.cases)&&suite.cases.length>0,'runtime probe cases required');

let shoppingState={products:[],budget:null};
const context={console,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,TypeError,RegExp,Date};
context.window=context;context.globalThis=context;
context.TDShoppingState={get:()=>shoppingState};
vm.createContext(context);
for(const file of ['../bai-system-prompt-v1.js','../bai-brain.js','../bai-reasoning-guard.js','../bai-character.js']){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),'utf8'),context,{filename:file});
}
const brain=context.TDBaiBrain;
assert.ok(brain?.route&&brain?.reset,'current Bay brain route/reset required');
assert.ok(context.TDBaiCharacter?.filter,'production character filter required');

const plain=value=>JSON.parse(JSON.stringify(value));
const canonical=value=>JSON.stringify(plain(value));
const containsOp=(ops,expected)=>(ops||[]).some(op=>canonical(op)===canonical(expected));
const questionCount=text=>(String(text||'').match(/\?/g)||[]).length;

function toCandidate(result){
  const operations=Array.isArray(result?.operations)?result.operations:[];
  const expectsAnswer=result?.expectsAnswer===true;
  return{
    decision:expectsAnswer?'ask_clarification':operations.length?'execute':'no_action',
    clarification:expectsAnswer?String(result?.reply||'').trim()||'Нужно уточнение.':null,
    reply:String(result?.reply||'').trim(),
    claims:{},
    memory_updates:[]
  };
}

const rows=[];
const runtimeChecks=[];
for(const scenario of suite.cases){
  shoppingState={products:(scenario.initial_products||[]).map(id=>({id})),budget:null};
  brain.reset();
  const result=plain(await brain.route(scenario.user));
  const expected=scenario.runtime_expect||{};
  const actualOps=Array.isArray(result.operations)?result.operations:[];
  const errors=[];
  if(Boolean(result.expectsAnswer)!==Boolean(expected.expects_answer))errors.push(`expects_answer:${Boolean(result.expectsAnswer)}!=${Boolean(expected.expects_answer)}`);
  for(const op of expected.operations||[])if(!containsOp(actualOps,op))errors.push(`missing_operation:${canonical(op)}`);
  if((expected.operations||[]).length===0&&actualOps.length)errors.push(`unexpected_operations:${canonical(actualOps)}`);
  if(result.expectsAnswer===true&&questionCount(result.reply)>1)errors.push('runtime_too_many_questions');
  runtimeChecks.push({id:scenario.id,ok:errors.length===0,errors,reply:result.reply,operations:actualOps,expects_answer:Boolean(result.expectsAnswer)});
  rows.push({id:scenario.id,candidate:toCandidate(result)});
}

const character=evaluateCharacterGateBatch(suite.cases,rows,{maxCatchphraseUses:2});
const clusters={};
for(const item of [...runtimeChecks,...character.cases])for(const error of item.errors||[])clusters[error]=(clusters[error]||0)+1;
for(const error of character.errors||[])clusters[error]=(clusters[error]||0)+1;
const runtimeOk=runtimeChecks.every(x=>x.ok);
const report={
  schema_version:'1.0',
  suite_id:suite.suite_id,
  source:'current-main-deterministic-runtime+production-character-filter',
  training_started:false,
  training_allowed:false,
  total:suite.cases.length,
  runtime_ok:runtimeOk,
  character_ok:character.ok,
  ok:runtimeOk&&character.ok,
  failure_clusters:clusters,
  catchphrase_counts:character.catchphrase_counts,
  runtime:runtimeChecks,
  character_cases:character.cases
};

console.log(JSON.stringify(report,null,2));
assert.equal(report.ok,true,`current Bay runtime Character Regression failed: ${JSON.stringify(report.failure_clusters)}`);
