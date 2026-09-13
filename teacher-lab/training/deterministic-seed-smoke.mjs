import assert from 'node:assert/strict';
import {buildSeed} from './deterministic-seed.mjs';
import {benchmark} from '../benchmark.mjs';

const ALLOWED=new Set(['add_item','remove_item','replace_item','change_quantity','set_constraint','rebuild_basket','compare_stores','optimize_basket','explain_choice','prepare_purchase']);
const seed=buildSeed();
assert.equal(seed.train.length,500);assert.equal(seed.eval.length,60);
const trainIds=new Set(seed.train.map(x=>x.id));assert.equal(seed.eval.some(x=>trainIds.has(x.id)),false,'train/eval leakage');
for(const row of [...seed.train,...seed.eval]){
  assert.equal(row.review.status,'approved');assert.equal(row.review.human_reviewed,false);assert.equal(row.provenance.sources[0].source_id,'votonobay_deterministic_seed_v1');
  assert.equal(row.target.confidence.price,'unknown');assert.equal(row.target.confidence.availability,'unknown');assert.equal(row.target.confidence.quality,'unknown');
  for(const action of row.target.actions){assert.ok(ALLOWED.has(action.type),`bad action ${action.type}`);assert.ok(action.payload&&typeof action.payload==='object','payload required')}
}
const sample=seed.eval[0],prediction={id:sample.id,...sample.target};
const metrics=benchmark([sample],[prediction]);assert.equal(metrics.intent_accuracy,1);assert.equal(metrics.constraint_pass_rate,1);assert.equal(metrics.action_success_rate,1);
console.log('Bai deterministic seed smoke passed');
