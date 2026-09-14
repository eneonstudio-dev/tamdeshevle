import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {bindBrainRelease,_test} from '../teacher-lab/training/bind-brain-release.mjs';

const endpoint=_test.DEFAULT_ENDPOINT,origin=new URL(endpoint).origin;
const config=fs.readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');
const proxy=fs.readFileSync(new URL('../supabase/functions/bai-trained-inference/index.ts',import.meta.url),'utf8');
const contract=fs.readFileSync(new URL('../supabase/functions/bai-trained-inference/contract.ts',import.meta.url),'utf8');
assert.ok(config.includes(endpoint),'browser config must expose only the approved trained proxy');
assert.ok(config.includes('TD_BAI_BRAIN_ALLOWED_ORIGINS'),'trained proxy origin must enter the explicit registry allowlist');
for(const marker of ['TD_AUTH_PUBLISHABLE_KEY','BAI_TRAINED_BACKEND_URL','BAI_TRAINED_BACKEND_TOKEN','reserve_bai_agent_request','release_pin_mismatch'])assert.ok(proxy.includes(marker),`proxy missing ${marker}`);
for(const marker of ['backend_unverified_facts','backend_action_contract_invalid','confidence'])assert.ok(contract.includes(marker),`contract missing ${marker}`);

const registrySource=fs.readFileSync(new URL('../bai-brain-registry.js',import.meta.url),'utf8');
const context={window:null,console,JSON,URL,Map,Set,localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},location:{origin:'https://eneonstudio-dev.github.io'},TD_BAI_BRAIN_ALLOWED_ORIGINS:[origin]};context.window=context;context.globalThis=context;vm.createContext(context);vm.runInContext(registrySource,context);
const staged=bindBrainRelease({release:{schema_version:'1.0',id:'bai-trained-test',kind:'trained',status:'promoted',enabled:false,action_contract:'bai-actions-v1',model:'bai-shopping-brain-v0.1',checkpoint_sha256:'a'.repeat(64),endpoint:null,auth:'supabase',promotion:{pass:true,source:'test'}}});
const registered=context.TDBaiBrainRegistry.register(staged);assert.equal(registered.endpoint,endpoint);assert.equal(registered.enabled,false);assert.throws(()=>context.TDBaiBrainRegistry.activate(registered.id),/disabled/);
console.log('Trained serving path passed: approved origin, auth proxy guards, staged binding and disabled-by-default runtime registration are enforced.');
