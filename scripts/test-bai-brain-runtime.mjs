import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const registrySource=fs.readFileSync(new URL('../bai-brain-registry.js',import.meta.url),'utf8');
const runtimeSource=fs.readFileSync(new URL('../bai-brain-runtime.js',import.meta.url),'utf8');
const bridgeSource=fs.readFileSync(new URL('../bai-trained-bridge.js',import.meta.url),'utf8');
const storage=new Map();
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
const allowed=new Set(['add_item','remove_item','replace_item','change_quantity','set_constraint','rebuild_basket','compare_stores','optimize_basket','explain_choice','prepare_purchase']);
const session={budget:3000,constraints:{people_count:1,duration_days:7,cooking:'normal',healthy:false,excluded_brands:['Мираторг'],excluded_products:[]},store_constraints:{mode:'multi',limit:null,store_ids:[]}};
const legacy={budget:3000,peopleCount:1,duration:7,products:[]};
let responseBody=null,fetchCalls=0;
const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,RegExp,Promise,URL,AbortController,setTimeout,clearTimeout,queueMicrotask,localStorage,location:{origin:'https://votonobay.test'},fetch:async()=>{fetchCalls++;return{ok:true,status:200,json:async()=>responseBody}}};
context.window=context;context.globalThis=context;context.addEventListener=()=>{};
context.TDShoppingState={get:()=>legacy};
context.TDBaiAgentClient={sanitizeState:value=>value};
context.TDBaiShoppingAgentKernel={
  actions:[...allowed],domainGate:()=>({allowed:true}),
  state:{syncFromLegacy:()=>session,get:()=>session},
  validateAction(action){if(!allowed.has(action?.type))return{ok:false,error:{code:'ACTION_NOT_ALLOWLISTED'}};return{ok:true,action:JSON.parse(JSON.stringify(action))}},
  _test:{toLegacy(action){if(action.type==='set_constraint'&&action.payload?.key==='budget')return{type:'CHANGE_BUDGET',value:action.payload.value};if(action.type==='optimize_basket')return{type:'REOPTIMIZE'};if(action.type==='remove_item')return{type:'REMOVE_PRODUCT',value:action.payload.product_id};return null}}
};
vm.createContext(context);vm.runInContext(registrySource,context);vm.runInContext(runtimeSource,context);

const registry=context.TDBaiBrainRegistry,runtime=context.TDBaiBrainRuntime;
assert.equal(registry.current().id,'safe-rules-v1','rules must be the boot default');
assert.equal(await runtime.route('собери корзину',[],{}),null,'safe baseline must not call trained runtime');
assert.equal(fetchCalls,0);
assert.throws(()=>registry.register({id:'bad-v1',kind:'trained',status:'candidate',enabled:true,action_contract:'bai-actions-v1',checkpoint_sha256:'a'.repeat(64),endpoint:'/api/bai-brain',promotion:{pass:false}}),/not_promoted/);
registry.register({id:'disabled-v1',kind:'trained',status:'promoted',enabled:false,action_contract:'bai-actions-v1',checkpoint_sha256:'b'.repeat(64),endpoint:'/api/bai-brain',promotion:{pass:true}});
assert.throws(()=>registry.activate('disabled-v1'),/disabled/);
const release=registry.register({id:'trained-v1',kind:'trained',status:'promoted',enabled:true,action_contract:'bai-actions-v1',checkpoint_sha256:'a'.repeat(64),endpoint:'/api/bai-brain',auth:'none',promotion:{pass:true,source:'test'}});
registry.activate(release.id);

const envelope=output=>({ok:true,release:{id:release.id,checkpoint_sha256:release.checkpoint_sha256,action_contract:'bai-actions-v1'},output});
const hard={budget_max:3000,people_count:1,duration_days:7,excluded_brands:['Мираторг']};
responseBody=envelope({intent:'edit_basket',hard_constraints:hard,actions:[{type:'set_constraint',payload:{key:'budget',value:2500}}],confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}});
let result=await runtime.route('сделай дешевле',[],{ok:true,provider:'rules',reply:'Ок',operations:[]});
assert.equal(result.provider,'bai-trained-runtime');
assert.deepEqual(Array.from(result.operations,op=>op.type),['CHANGE_BUDGET']);
assert.equal(result.operations[0].value,2500);
assert.equal(result.agent.checkpoint_sha256,'a'.repeat(64));

runtime.resetBreaker();responseBody={...envelope({intent:'edit_basket',hard_constraints:hard,actions:[],confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}}),release:{id:release.id,checkpoint_sha256:'c'.repeat(64),action_contract:'bai-actions-v1'}};
assert.equal(await runtime.route('собери',[],{}),null,'checkpoint pin mismatch must fail closed');
assert.equal(runtime.status().reason,'release_pin_mismatch');

runtime.resetBreaker();responseBody=envelope({intent:'edit_basket',hard_constraints:hard,actions:[],price:199,confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}});
assert.equal(await runtime.route('собери',[],{}),null,'model-owned price fact must be rejected');
assert.equal(runtime.status().reason,'unverified_facts');

runtime.resetBreaker();responseBody=envelope({intent:'edit_basket',hard_constraints:hard,actions:[{type:'hack',payload:{}}],confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}});
assert.equal(await runtime.route('собери',[],{}),null,'non-allowlisted action must be rejected');
assert.ok(runtime.status().reason.startsWith('invalid_action:'));

runtime.resetBreaker();responseBody=envelope({intent:'edit_basket',hard_constraints:{budget_max:3000,people_count:1,duration_days:7},actions:[{type:'optimize_basket',payload:{}}],confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}});
assert.equal(await runtime.route('оптимизируй',[],{}),null,'existing excluded brand must survive model reasoning');
assert.equal(runtime.status().reason,'hard_context_lost');

registry.rollback();assert.equal(registry.current().id,'safe-rules-v1','rollback must always restore rules');
registry.activate('trained-v1');runtime.resetBreaker();
responseBody=envelope({intent:'edit_basket',hard_constraints:hard,actions:[{type:'set_constraint',payload:{key:'budget',value:2500}}],confidence:{overall:'high',price:'unknown',availability:'unknown',quality:'unknown'}});
context.TDBaiBrain={route:async()=>({ok:true,provider:'rules',reply:'Безопасный ответ',operations:[]})};
vm.runInContext(bridgeSource,context);await Promise.resolve();
result=await context.TDBaiBrain.route('сделай дешевле',[]);
assert.equal(result.provider,'bai-trained-runtime','trained bridge must prefer a valid promoted brain');
responseBody=null;runtime.resetBreaker();
result=await context.TDBaiBrain.route('сделай дешевле',[]);
assert.equal(result.provider,'rules','broken trained response must fall back to already-computed rules result');

console.log('Bai trained brain runtime passed: promotion pin, action validation, truth guard, constraint retention, rollback and rules fallback.');
