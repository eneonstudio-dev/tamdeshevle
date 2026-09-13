import fs from 'node:fs';
import assert from 'node:assert/strict';
import {prepareSft,renderSftJsonl} from './prepare-sft.mjs';
import {promotionGate} from './promotion-gate.mjs';

const here=new URL('../',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',here),'utf8'));
const recipe=JSON.parse(fs.readFileSync(new URL('training/student-v0.1.json',here),'utf8'));
const row=(id,status='approved',source='human_votonobay_reviewed')=>({
  id,schema_version:'1.0',language:'ru',user_request:'Собери еду до 5000',session_context:{budget:null,constraints:[],basket:[]},
  target:{intent:'build_basket',hard_constraints:{budget_max:5000},soft_preferences:{price:'balanced'},shopping_plan:{categories:['protein','base','fruit']},actions:[{type:'CHANGE_BUDGET',value:5000}],critic:{pass:true,issues:[]},confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}},
  provenance:{sources:[{source_id:source}]},review:{status},privacy:{sanitized:true,contains_personal_data:false}
});

assert.equal(recipe.name,'bai-shopping-brain-v0.1');
assert.equal(recipe.runtime.external_api_required,false);
assert.equal(recipe.runtime.teacher_required_in_production,false);
assert.ok(recipe.data.minimum_examples>=500);
const approved=row('train_001'),candidate=row('train_002','candidate');
const sft=prepareSft([approved,candidate],registry);
assert.equal(sft.length,1,'only approved eligible rows may enter SFT');
assert.equal(JSON.parse(sft[0].messages[2].content).hard_constraints.budget_max,5000);
assert.ok(renderSftJsonl([approved],registry).endsWith('\n'));
assert.throws(()=>prepareSft([row('blocked_001','approved','yandex_foundation_models_api')],registry));

const baseline={examples:500,intent_accuracy:0.9,constraint_pass_rate:0.99,action_success_rate:0.9,context_retention_rate:0.92,invalid_substitution_rate:0.03,repair_success_rate:0.8};
const better={examples:500,intent_accuracy:0.92,constraint_pass_rate:1,action_success_rate:0.91,context_retention_rate:0.94,invalid_substitution_rate:0.02,repair_success_rate:0.84};
assert.equal(promotionGate(baseline,better).pass,true);
const badConstraints={...better,constraint_pass_rate:0.97};
assert.equal(promotionGate(baseline,badConstraints).pass,false);
assert.ok(promotionGate(baseline,badConstraints).reasons.includes('constraint_pass_rate_regressed'));
const badReplacement={...better,invalid_substitution_rate:0.04};
assert.equal(promotionGate(baseline,badReplacement).pass,false);
assert.ok(promotionGate(baseline,badReplacement).reasons.includes('invalid_substitution_rate_regressed'));
console.log('Bai student training recipe smoke passed');
