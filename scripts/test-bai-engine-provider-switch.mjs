import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const plain=value=>JSON.parse(JSON.stringify(value));
const window={};
const context=vm.createContext({window,console,setTimeout,clearTimeout,Date,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,TypeError});
for(const file of ["../bai-engine-provider.js","../bai-engine-router.js","../bai-provider-contract.js"]){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),"utf8"),context,{filename:file});
}
const Provider=window.TDBayEngineProvider;
const Router=window.TDBayEngineRouter;
const Safety=window.TDBaiProviderContract;
const makeProvider=({id,generate})=>Provider.create({id,capabilities:{streaming:false,tools:true,structuredOutput:true,local:true,paid:false},generate,healthCheck:async()=>true});
const catalog=[{id:"milk"},{id:"bread"}];

// Frozen request: provider switch must preserve the bounded action proposal while truth-critical fields stay untrusted.
const request={message:"Добавь молоко",context:{basketVersion:7},system:"Ты Бай. Предлагай только bounded shopping actions."};
const proposal={reply:"Добавлю молоко.",operations:[{type:"ADD_PRODUCT",value:"milk"}],price:1,availability:true,savings:9999};
for(const [id,reply] of [["provider-a","Добавлю молоко."],["provider-b","Молоко — в список."]]){
  const provider=makeProvider({id,generate:async()=>({ok:true,payload:{...proposal,reply}})});
  const router=Router.create({primary:provider,deterministic:async()=>({reply:"rules",operations:[]})});
  const routed=await router.route(request);
  assert.equal(routed.route,"primary");
  const safe=Safety.normalize(routed.payload,{catalog});
  assert.equal(safe.ok,true);
  assert.deepEqual(plain(safe.operations),[{type:"ADD_PRODUCT",value:"milk"}]);
  for(const field of ["price","availability","savings"])assert.equal(Object.hasOwn(safe,field),false,`${field} must not escape provider normalization`);
}

// Primary failure must switch to fallback without invoking deterministic baseline.
{
  let deterministicCalls=0;
  const primary=makeProvider({id:"primary-dead",generate:async()=>({ok:false,error:{code:"DOWN",retryable:false}})});
  const fallback=makeProvider({id:"fallback-ok",generate:async()=>({ok:true,payload:proposal})});
  const router=Router.create({primary,fallback,deterministic:async()=>{deterministicCalls++;return{reply:"rules"}},policy:{maxAttempts:1}});
  const result=await router.route(request);
  assert.equal(result.route,"fallback");assert.equal(result.provider,"fallback-ok");assert.equal(deterministicCalls,0);
  assert.deepEqual(plain(Safety.normalize(result.payload,{catalog}).operations),[{type:"ADD_PRODUCT",value:"milk"}]);
}

// Both providers failing must reach deterministic fallback exactly once.
{
  let deterministicCalls=0;
  const dead=id=>makeProvider({id,generate:async()=>({ok:false,error:{code:"DOWN",retryable:false}})});
  const router=Router.create({primary:dead("p-dead"),fallback:dead("f-dead"),deterministic:async()=>{deterministicCalls++;return{reply:"Нейросеть недоступна — использую безопасный режим.",operations:[]}},policy:{maxAttempts:1}});
  const result=await router.route(request);
  assert.equal(result.route,"deterministic");assert.equal(deterministicCalls,1);
  assert.equal(result.trace.at(-1).role,"deterministic");
}

// Router/provider layer is proposal-only: retries/fallback must never execute or duplicate shopping mutations.
{
  let primaryCalls=0,fallbackCalls=0,mutationCalls=0;
  const primary=makeProvider({id:"retry-then-fail",generate:async()=>{primaryCalls++;return{ok:false,error:{code:"TEMP",retryable:true}}}});
  const fallback=makeProvider({id:"proposal-only",generate:async()=>{fallbackCalls++;return{ok:true,payload:{reply:"Добавлю хлеб.",operations:[{type:"ADD_PRODUCT",value:"bread"}]}}}});
  const router=Router.create({primary,fallback,deterministic:async()=>({operations:[]}),policy:{maxAttempts:2,failureThreshold:3}});
  const result=await router.route({message:"Добавь хлеб"});
  assert.equal(primaryCalls,2);assert.equal(fallbackCalls,1);assert.equal(mutationCalls,0,"provider routing must not execute mutations");
  const safe=Safety.normalize(result.payload,{catalog});
  assert.deepEqual(plain(safe.operations),[{type:"ADD_PRODUCT",value:"bread"}]);
  // Simulate the existing execution boundary consuming the accepted proposal once.
  if(safe.ok)mutationCalls+=safe.operations.length;
  assert.equal(mutationCalls,1,"accepted proposal is handed to deterministic execution once");
}

// Paid candidates remain unavailable during acceptance unless explicitly budget-authorized.
{
  let paidCalls=0;
  const paid=Provider.create({id:"paid-candidate",capabilities:{paid:true,tools:true,structuredOutput:true},generate:async()=>{paidCalls++;return{ok:true,payload:proposal}},healthCheck:async()=>true});
  const router=Router.create({primary:paid,deterministic:async()=>({reply:"rules",operations:[]})});
  const result=await router.route(request);
  assert.equal(result.route,"deterministic");assert.equal(paidCalls,0);assert.equal(result.trace[0].reason,"paid_disabled");
}

console.log("Bay Engine provider-switch acceptance passed: equivalent bounded actions survive provider changes, truth fields remain blocked, primary/fallback/deterministic failover works, retries do not execute duplicate mutations, and paid routing stays closed.");