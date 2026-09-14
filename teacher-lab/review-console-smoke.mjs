import assert from 'node:assert/strict';
import {buildReviewPacket} from './review-decision.mjs';
import {renderReviewConsole,orderReviewPacket} from './review-console.mjs';

const base=(task,teacher,intent)=>({
  id:`${task}.${teacher}`,user_request:`${task}: Собери еды на неделю до 5000 ₽, без Мираторга`,session_context:{budget:5000,excludedBrands:['Мираторг']},
  target:{intent,hard_constraints:{budget_max:5000,excluded_brands:['Мираторг']},soft_preferences:{},shopping_plan:{},actions:[],critic:{pass:true,issues:[]},confidence:{overall:'medium',price:'unknown',availability:'unknown',quality:'unknown'},reasoning:'must not render'},
  provenance:{sources:[{source_id:teacher,corpus_task_id:task}]},review:{status:'candidate'},privacy:{sanitized:true,contains_personal_data:false}
});

const left=[base('case_001','deepseek_r1_local_mit','build_basket'),base('case_002','deepseek_r1_local_mit','edit_basket')];
const right=[base('case_001','qwen3_open_weights_apache2','build_basket'),base('case_002','qwen3_open_weights_apache2','edit_basket')];
const packet=buildReviewPacket({left,right,queue:[
  {task_id:'case_001',status:'agree',conflicts:[],flags:[]},
  {task_id:'case_002',status:'conflict',conflicts:['actions'],flags:['check_context_retention']}
]});
assert.equal(packet.length,2);
assert.equal(packet[0].task_id,'case_001');
const ordered=orderReviewPacket(packet,[{task_id:'case_002',priority_score:80},{task_id:'case_001',priority_score:-10}]);
assert.deepEqual(ordered.map(x=>x.task_id),['case_002','case_001']);
assert.throws(()=>orderReviewPacket(packet,[{task_id:'case_002'}]),/coverage mismatch/);
assert.throws(()=>orderReviewPacket(packet,[{task_id:'case_001'},{task_id:'case_001'}]),/missing\/duplicate/);

const html=renderReviewConsole(ordered);
for(const token of ['Approve left','Approve right','Approve edited','Reject','Export decisions.json','case_002'])assert.equal(html.includes(token),true,token);
assert.equal(html.includes('must not render'),false,'forbidden reasoning value leaked into review HTML');
assert.equal(html.includes('chain_of_thought'),false);
assert.ok(html.indexOf('case_002')<html.indexOf('case_001'),'priority order not preserved in HTML packet');
console.log(JSON.stringify({ok:true,cases:packet.length,priority_first:ordered[0].task_id,auto_approved:0}));
