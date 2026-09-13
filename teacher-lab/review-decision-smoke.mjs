import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyReviewDecisions,mergeApprovedGold} from './review-decision.mjs';

const registry=JSON.parse(fs.readFileSync(new URL('./sources.json',import.meta.url),'utf8'));
const mk=(profile,source)=>({id:`task.1.${profile}`,schema_version:'1.0',language:'ru',user_request:'собери еды на неделю',session_context:{},target:{intent:'build_basket',hard_constraints:{budget_max:5000},soft_preferences:{},shopping_plan:{},actions:[],critic:{pass:true,issues:[]},confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}},provenance:{sources:[{source_id:source,profile_id:profile,corpus_task_id:'task.1'}]},review:{status:'candidate'},privacy:{sanitized:true,contains_personal_data:false}});
const left=mk('deepseek_r1_distill_qwen_7b','deepseek_r1_local_mit');
const right=mk('qwen3_8b','qwen3_open_weights_apache2');
const queue=[{task_id:'task.1',status:'agree',conflicts:[]}];

let r=applyReviewDecisions({left:[left],right:[right],queue,decisions:[],registry});
assert.equal(r.summary.approved,0);assert.equal(r.summary.pending,1);
r=applyReviewDecisions({left:[left],right:[right],queue,decisions:[{task_id:'task.1',decision:'approve_left'}],registry});
assert.equal(r.summary.approved,0);assert.equal(r.pending[0].reason,'missing_reviewer');
r=applyReviewDecisions({left:[left],right:[right],queue,decisions:[{task_id:'task.1',decision:'approve_left',reviewer:'human'}],registry});
assert.equal(r.summary.approved,1);assert.equal(r.approved[0].review.status,'approved');
assert.ok(r.approved[0].provenance.sources.some(x=>x.source_id==='human_votonobay_reviewed'));
assert.equal(mergeApprovedGold(r.approved,r.approved).length,1);
console.log('Teacher review decision gate passed.');
