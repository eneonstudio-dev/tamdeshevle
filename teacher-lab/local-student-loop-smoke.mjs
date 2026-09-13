import assert from 'node:assert/strict';
import {assertLocalModelProfile,runLocalStudentLoop} from './run-local-student-loop.mjs';

const pin='a'.repeat(40);
const studentProfile={id:'bai-student-local',model:'bai-shopping-brain-v0.1',revision:pin,endpoint:'http://127.0.0.1:8002',enabled_by_default:false,temperature:0,max_tokens:900};
const criticProfile={id:'bai-critic-local',model:'Qwen/Qwen3-8B',revision:'b'.repeat(40),endpoint:'http://localhost:8003',enabled_by_default:false,temperature:0,max_tokens:500};
assert.doesNotThrow(()=>assertLocalModelProfile(studentProfile,'student'));
assert.throws(()=>assertLocalModelProfile({...studentProfile,endpoint:'https://example.com'},'student'),/loopback/);
assert.throws(()=>assertLocalModelProfile({...studentProfile,enabled_by_default:true},'student'),/opt_in/);
assert.throws(()=>assertLocalModelProfile({...studentProfile,revision:'latest'},'student'),/pinned/);

const task={id:'local_loop_001',user_request:'Собери до 5000 без Мираторга',session_context:{constraints:[]},guards:{forbid_fabrication:['price','availability','store','composition','quality']},expected:{must_retain:[]}};
const teacher={intent:'build_basket',hard_constraints:['budget<=5000','exclude_brand:Мираторг'],actions:[{type:'SET_BUDGET',value:5000},{type:'EXCLUDE_BRAND',value:'Мираторг'}]};
const bad={intent:'build_basket',hard_constraints:['budget<=5000'],actions:[{type:'SET_BUDGET',value:5000}]};
const good={intent:'build_basket',hard_constraints:['budget<=5000','exclude_brand:Мираторг'],actions:[{type:'SET_BUDGET',value:5000},{type:'EXCLUDE_BRAND',value:'Мираторг'}]};
let studentCalls=0,criticCalls=0;

const fetchImpl=async(url,options)=>{
  const body=JSON.parse(options.body),payload=JSON.parse(body.messages[1].content);
  if(url==='http://127.0.0.1:8002/v1/chat/completions'){
    studentCalls++;
    assert.equal(body.model,studentProfile.model);
    assert.equal('teacher_target' in payload,false,'student transport must not receive teacher target');
    assert.equal('teacher_output' in payload,false,'student transport must not receive teacher output');
    const output=payload.mode==='initial'?bad:good;
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(output)}}]})};
  }
  if(url==='http://localhost:8003/v1/chat/completions'){
    criticCalls++;
    assert.equal(body.model,criticProfile.model);
    assert.deepEqual(payload.teacher_target,teacher,'critic is the only model allowed to see the reviewed teacher target');
    const pass=payload.deterministic.pass===true;
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({pass,reasons:pass?[]:['constraint_error'],feedback:'Исправь тип ошибки hard constraint.'})}}]})};
  }
  throw Error(`unexpected_url:${url}`);
};

const result=await runLocalStudentLoop({tasks:[task],teacherResults:[{task_id:task.id,output:teacher}],studentProfile,criticProfile,maxRepairs:2,fetchImpl});
assert.equal(result.summary.evaluated,1);
assert.equal(result.summary.passed,1);
assert.equal(result.summary.repaired,1);
assert.equal(studentCalls,2);
assert.equal(criticCalls,2);
assert.equal(result.review_candidates[0].training_allowed,false);
assert.equal(result.review_candidates[0].review.status,'pending');
assert.equal(result.review_candidates[0].provenance.student.profile_id,studentProfile.id);
assert.equal(result.review_candidates[0].provenance.critic.profile_id,criticProfile.id);
assert.equal(result.runtime.student.endpoint,studentProfile.endpoint);
assert.equal(result.runtime.critic.endpoint,criticProfile.endpoint);
assert.match(result.runtime.student.runtime_fingerprint,/^[0-9a-f]{64}$/);
assert.match(result.runtime.critic.runtime_fingerprint,/^[0-9a-f]{64}$/);

console.log('Local Bai student loop passed: loopback-only pinned profiles, teacher isolation, independent critic, bounded repair and provenance.');
