import assert from 'node:assert/strict';
import {bindBrainRelease,_test} from './bind-brain-release.mjs';

const source={schema_version:'1.0',id:'bai-trained-deadbeef1234',kind:'trained',status:'promoted',enabled:false,action_contract:'bai-actions-v1',model:'bai-shopping-brain-v0.1',checkpoint_sha256:'a'.repeat(64),endpoint:null,auth:'supabase',promotion:{pass:true,source:'promotion-gate'}};
const bound=bindBrainRelease({release:source});
assert.equal(bound.endpoint,_test.DEFAULT_ENDPOINT);
assert.equal(bound.enabled,false);
assert.equal(bound.auth,'supabase');
assert.equal(bound.binding.mode,'staged');
assert.match(bound.binding.source_release_sha256,/^[a-f0-9]{64}$/);
assert.throws(()=>bindBrainRelease({release:{...source,status:'candidate'}}),/not_promoted/);
assert.throws(()=>bindBrainRelease({release:{...source,enabled:true}}),/must_be_staged/);
assert.throws(()=>bindBrainRelease({release:{...source,checkpoint_sha256:'bad'}}),/bad_checkpoint/);
assert.throws(()=>bindBrainRelease({release:source,endpoint:'http://localhost:8000/infer'}),/https_required/);
assert.throws(()=>bindBrainRelease({release:source,endpoint:'https://evil.example/infer'}),/not_approved/);
console.log('Brain release binder passed: only promoted pinned releases bind to the approved Supabase proxy and stay disabled.');
