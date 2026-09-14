import assert from 'node:assert/strict';
import {validateFactoryTasks} from './prepare_factory_review.mjs';

const rows=[{id:'a'},{id:'b'}];
assert.equal(validateFactoryTasks(rows),rows);
assert.throws(()=>validateFactoryTasks([]),/empty/);
assert.throws(()=>validateFactoryTasks([{id:'a'},{id:'a'}]),/duplicate/);
assert.throws(()=>validateFactoryTasks([{id:''}]),/missing/);
console.log('Data Factory review task validation passed.');
