import assert from 'node:assert/strict';
import {deterministicJudge,runTrainingCase,runTrainingBatch} from './student-teacher-loop.mjs';

const task={
  id:'loop_001',
  user_request:'Собери на неделю до 5000 ₽, ПП, без Мираторга',
  session_context:{budget:null,days:1,constraints:[],basket:[]},
  guards:{forbid_fabrication:['price','availability','store','composition','quality'],must_keep_hard_constraints:true},
  expected:{must_retain:[]}
};
const teacher={
  intent:'build_basket',
  hard_constraints:['budget<=5000','exclude_brand:Мираторг'],
  soft_preferences:['healthy'],
  actions:[{type:'SET_BUDGET',value:5000},{type:'EXCLUDE_BRAND',value:'Мираторг'}]
};

const bad={
  intent:'build_basket',
  hard_constraints:['budget<=5000'],
  soft_preferences:[],
  actions:[{type:'SET_BUDGET',value:5000}]
};
const good={
  intent:'build_basket',
  hard_constraints:['budget<=5000','exclude_brand:Мираторг'],
  soft_preferences:['healthy'],
  actions:[{type:'SET_BUDGET',value:5000},{type:'EXCLUDE_BRAND',value:'Мираторг'}]
};

let judged=deterministicJudge({task,teacherOutput:teacher,bayOutput:{...good,price:4999}});
assert.equal(judged.pass,false,'model-owned price claims must fail the truth guard');
assert.ok(judged.failures.includes('unverified_facts_present'));

judged=deterministicJudge({task,teacherOutput:teacher,bayOutput:{...good,confidence:{price:'unknown',availability:'unknown',quality:'unknown'}}});
assert.equal(judged.pass,true,'unknown confidence sentinels must not be treated as fabricated dynamic facts');
assert.equal(judged.checks.truth_guard,true);
assert.deepEqual(judged.forbidden_fact_paths,[]);

judged=deterministicJudge({task,teacherOutput:teacher,bayOutput:{...good,price:'unknown'}});
assert.equal(judged.pass,false,'unknown is only a safe sentinel inside the confidence contract, not a top-level price claim');
assert.ok(judged.forbidden_fact_paths.includes('$.price'));

const calls=[];
const bayRunner=async input=>{
  calls.push(input);
  assert.equal('teacher_output' in input,false,'teacher target must never leak into the student prompt');
  assert.equal('teacherOutput' in input,false,'teacher target must never leak into the student prompt');
  return input.attempt===0?bad:good;
};
const criticRunner=async({bay_output,deterministic})=>{
  const semantic=bay_output.soft_preferences?.includes('healthy');
  return {pass:deterministic.pass&&semantic,reasons:semantic?[]:['healthy_preference_missing'],feedback:semantic?'':'Сохрани ПП как soft preference.'};
};

const repaired=await runTrainingCase({task,teacherOutput:teacher,bayRunner,criticRunner,maxRepairs:2});
assert.equal(repaired.pass,true);
assert.equal(repaired.repaired,true);
assert.equal(repaired.attempts.length,2,'repair must stop immediately after a passing attempt');
assert.equal(calls[0].feedback,null);
assert.ok(calls[1].feedback.failures.includes('hard_constraints_mismatch'));
assert.equal(calls[1].feedback.instruction.includes('price/availability'),true);
assert.equal(repaired.learning_record.review.status,'pending','teacher/student success must still require review');
assert.equal(repaired.learning_record.training_allowed,false,'the loop must never auto-approve training data');
assert.equal(repaired.learning_record.provenance.source,'offline_teacher_student_loop');

let attempts=0;
const failed=await runTrainingCase({
  task:{...task,id:'loop_002'},
  teacherOutput:teacher,
  maxRepairs:2,
  bayRunner:async()=>{attempts++;return {...bad,intent:'compare_products'}},
  criticRunner:async({deterministic})=>({pass:deterministic.pass,reasons:[]})
});
assert.equal(failed.pass,false);
assert.equal(attempts,3,'initial attempt plus exactly two bounded repairs are allowed');
assert.equal(failed.learning_record.kind,'teacher_student_regression_candidate');
assert.ok(failed.learning_record.outcome.reasons.includes('intent_mismatch'));

const batch=await runTrainingBatch({
  tasks:[task,{...task,id:'missing_teacher'}],
  teacherResults:[{task_id:task.id,output:teacher}],
  bayRunner:async()=>good,
  criticRunner:async({deterministic})=>({pass:deterministic.pass,reasons:[]}),
  maxRepairs:0
});
assert.equal(batch.summary.total,2);
assert.equal(batch.summary.evaluated,1);
assert.equal(batch.summary.passed,1);
assert.equal(batch.summary.errors,1);
assert.equal(batch.errors[0].error,'teacher_target_missing');
assert.equal(batch.review_candidates.length,1);

console.log('Bai student/teacher loop passed: target isolation, deterministic truth checks including unknown confidence sentinels, critic feedback, bounded repair and regression emission.');
