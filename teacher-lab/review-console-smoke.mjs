import assert from 'node:assert/strict';
import {buildReviewPacket} from './review-decision.mjs';
import {renderReviewConsole} from './review-console.mjs';

const base=(teacher,intent)=>({
  id:`case.${teacher}`,user_request:'Собери еды на неделю до 5000 ₽, без Мираторга',session_context:{budget:5000,excludedBrands:['Мираторг']},
  target:{intent,hard_constraints:{budget_max:5000,excluded_brands:['Мираторг']},soft_preferences:{},shopping_plan:{},actions:[],critic:{pass:true,issues:[]},confidence:{overall:'medium',price:'unknown',availability:'unknown',quality:'unknown'},reasoning:'must not render'},
  provenance:{sources:[{source_id:teacher,corpus_task_id:'case_001'}]},review:{status:'candidate'},privacy:{sanitized:true,contains_personal_data:false}
});

const packet=buildReviewPacket({
  left:[base('deepseek_r1_local_mit','build_basket')],
  right:[base('qwen3_open_weights_apache2','build_basket')],
  queue:[{task_id:'case_001',status:'agree',conflicts:[],flags:['check_context_retention']}]
});
assert.equal(packet.length,1);
assert.equal(packet[0].user_request.includes('5000'),true);
assert.equal(packet[0].session_context.budget,5000);
assert.equal(packet[0].decision,'pending_review');

const html=renderReviewConsole(packet);
for(const token of ['Approve left','Approve right','Approve edited','Reject','Export decisions.json','Собери еды на неделю'])assert.equal(html.includes(token),true,token);
assert.equal(html.includes('must not render'),false,'forbidden reasoning value leaked into review HTML');
assert.equal(html.includes('chain_of_thought'),false);
console.log(JSON.stringify({ok:true,cases:packet.length,auto_approved:0}));
