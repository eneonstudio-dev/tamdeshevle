import assert from 'node:assert/strict';
import {comparePair,buildConsensusQueue} from './teacher-consensus.mjs';

const candidate=(actions,overrides={})=>({
  target:{
    intent:'edit_basket',
    hard_constraints:{budget_max:4000,store:{limit:1,mode:'one'}},
    soft_preferences:{price:'balanced',quality:{protein:'higher'}},
    actions,
    ...(overrides.target||{})
  },
  provenance:{sources:[{corpus_task_id:'payload_case'}]},
  ...overrides
});

const a=candidate([
  {type:'set_constraint',payload:{key:'budget',value:4000}},
  {type:'optimize_basket',payload:{}}
]);
const same=candidate([
  {type:'optimize_basket',payload:{}},
  {type:'set_constraint',payload:{value:4000,key:'budget'}}
],{target:{hard_constraints:{store:{mode:'one',limit:1},budget_max:4000},soft_preferences:{quality:{protein:'higher'},price:'balanced'}}});
let result=comparePair(a,same);
assert.equal(result.pass,true,'deep key order and action order must not create a false conflict');

const differentPayload=candidate([
  {type:'set_constraint',payload:{key:'store_mode',value:'one'}},
  {type:'optimize_basket',payload:{}}
]);
result=comparePair(a,differentPayload);
assert.equal(result.pass,false,'same action type with different payload must conflict');
assert.deepEqual(result.conflicts,['actions']);
assert.equal(buildConsensusQueue([a],[differentPayload])[0].status,'conflict');

const legacyValue=candidate([
  {type:'set_constraint',value:{key:'budget',value:4000}},
  {type:'optimize_basket',payload:{}}
]);
result=comparePair(a,legacyValue);
assert.equal(result.pass,false,'legacy value field must not masquerade as production payload');
assert.ok(result.conflicts.includes('actions'));

const nestedA=candidate([{type:'replace_item',payload:{from:{id:'chicken',qty:1},to:{id:'turkey',qty:1}}}]);
const nestedB=candidate([{type:'replace_item',payload:{to:{qty:1,id:'turkey'},from:{qty:1,id:'chicken'}}}]);
assert.equal(comparePair(nestedA,nestedB).pass,true,'nested payload key order must be canonicalized');

console.log('Teacher consensus payload regression passed: production payload differences cannot be marked as agreement.');
