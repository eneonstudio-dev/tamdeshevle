import assert from 'node:assert/strict';
import {batchTasks} from './prepare_review.mjs';

const b1=batchTasks(1),b2=batchTasks(2),b9=batchTasks(9);
assert.equal(b1.length,64);assert.equal(b2.length,64);assert.equal(b9.length,48);
const ids1=new Set(b1.map(x=>x.id));
assert.equal(b2.some(x=>ids1.has(x.id)),false);
assert.equal(b9.some(x=>ids1.has(x.id)),false);
assert.throws(()=>batchTasks(10),/invalid batch index/);
console.log('Batch-scoped review partition passed.');
