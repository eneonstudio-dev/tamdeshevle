import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const plain=value=>JSON.parse(JSON.stringify(value));
const window={};
const context=vm.createContext({window,console,setTimeout,clearTimeout,Date,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,TypeError});
for(const file of ["../bai-engine-provider.js","../bai-engine-router.js"]){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),"utf8"),context,{filename:file});
}
const Provider=window.TDBayEngineProvider;
const Router=window.TDBayEngineRouter;
assert.equal(Router.version,1);
assert.throws(()=>Router.create({}),/deterministic/);

const makeProvider=({id,paid=false,generate})=>Provider.create({
  id,
  capabilities:{streaming:false,tools:true,structuredOutput:true,local:!paid,paid},
  generate,
  healthCheck:async()=>true
});

{
  let fallbackCalls=0,deterministicCalls=0;
  const primary=makeProvider({id:"primary-ok",generate:async()=>({ok:true,payload:{reply:"primary"}})});
  const fallback=makeProvider({id:"fallback-unused",generate:async()=>{fallbackCalls++;return{ok:true,payload:{reply:"fallback"}}}});
  const router=Router.create({primary,fallback,deterministic:async()=>{deterministicCalls++;return{reply:"rules"}}});
  const result=await router.route({message:"x"});
  assert.equal(result.ok,true);assert.equal(result.route,"primary");assert.equal(result.provider,"primary-ok");
  assert.equal(fallbackCalls,0);assert.equal(deterministicCalls,0);
}

{
  let calls=0;
  const primary=makeProvider({id:"retry-primary",generate:async()=>{
    calls++;
    return calls===1?{ok:false,error:{code:"TEMP",message:"temporary",retryable:true}}:{ok:true,payload:{reply:"recovered"}};
  }});
  const router=Router.create({primary,deterministic:async()=>({reply:"rules"}),policy:{maxAttempts:2,failureThreshold:3}});
  const result=await router.route({message:"retry"});
  assert.equal(result.route,"primary");assert.equal(calls,2);
  assert.equal(result.trace.filter(x=>x.role==="primary").length,2);
}

{
  let fallbackCalls=0;
  const primary=makeProvider({id:"primary-dead",generate:async()=>({ok:false,error:{code:"BAD",retryable:false}})});
  const fallback=makeProvider({id:"fallback-ok",generate:async()=>{fallbackCalls++;return{ok:true,payload:{reply:"fallback"}}}});
  const router=Router.create({primary,fallback,deterministic:async()=>({reply:"rules"})});
  const result=await router.route({message:"x"});
  assert.equal(result.route,"fallback");assert.equal(result.provider,"fallback-ok");assert.equal(fallbackCalls,1);
}

{
  let fallbackCalls=0;
  const primary=makeProvider({id:"primary-slow",generate:async()=>new Promise(resolve=>setTimeout(()=>resolve({ok:true,payload:{reply:"late"}}),160))});
  const fallback=makeProvider({id:"fallback-fast",generate:async()=>{fallbackCalls++;return{ok:true,payload:{reply:"fast"}}}});
  const router=Router.create({primary,fallback,deterministic:async()=>({reply:"rules"}),policy:{timeoutMs:100,maxAttempts:1}});
  const started=Date.now();const result=await router.route({message:"timeout"});
  assert.equal(result.route,"fallback");assert.equal(fallbackCalls,1);assert.ok(Date.now()-started<155,"router must not wait for late primary completion");
}

{
  let paidCalls=0,deterministicCalls=0;
  const paid=makeProvider({id:"paid-off",paid:true,generate:async()=>{paidCalls++;return{ok:true,payload:{reply:"paid"}}}});
  const router=Router.create({primary:paid,deterministic:async()=>{deterministicCalls++;return{reply:"rules"}}});
  const result=await router.route({message:"x"});
  assert.equal(result.route,"deterministic");assert.equal(paidCalls,0);assert.equal(deterministicCalls,1);
  assert.equal(result.trace[0].reason,"paid_disabled");
}

{
  let paidCalls=0;
  const paid=makeProvider({id:"paid-budget",paid:true,generate:async()=>{paidCalls++;return{ok:true,payload:{reply:"paid"}}}});
  const router=Router.create({primary:paid,deterministic:async()=>({reply:"rules"}),policy:{paid:{enabled:true,monthlyCeilingUsd:5,spentUsd:()=>5}}});
  const result=await router.route({message:"x"});
  assert.equal(result.route,"deterministic");assert.equal(paidCalls,0);assert.equal(result.trace[0].reason,"budget_exhausted");
}

{
  let paidCalls=0;
  const paid=makeProvider({id:"paid-no-auth",paid:true,generate:async()=>{paidCalls++;return{ok:true,payload:{reply:"paid"}}}});
  const router=Router.create({primary:paid,deterministic:async()=>({reply:"rules"}),policy:{paid:{enabled:true,monthlyCeilingUsd:5,spentUsd:()=>1}}});
  const result=await router.route({message:"x"});
  assert.equal(result.route,"deterministic");assert.equal(paidCalls,0);assert.equal(result.trace[0].reason,"paid_authorizer_missing");
}

{
  let paidCalls=0,authCalls=0;
  const paid=makeProvider({id:"paid-authorized",paid:true,generate:async()=>{paidCalls++;return{ok:true,payload:{reply:"paid"}}}});
  const router=Router.create({primary:paid,deterministic:async()=>({reply:"rules"}),policy:{paid:{enabled:true,monthlyCeilingUsd:5,spentUsd:()=>1,authorize:ctx=>{authCalls++;return ctx.spentUsd<ctx.monthlyCeilingUsd;}}}});
  const result=await router.route({message:"x"});
  assert.equal(result.route,"primary");assert.equal(paidCalls,1);assert.equal(authCalls,1);
}

{
  let calls=0;
  const primary=makeProvider({id:"breaker-primary",generate:async()=>{calls++;return{ok:false,error:{code:"DOWN",retryable:true}}}});
  const router=Router.create({primary,deterministic:async()=>({reply:"rules"}),policy:{failureThreshold:1,maxAttempts:2,cooldownMs:1000}});
  const first=await router.route({message:"one"});assert.equal(first.route,"deterministic");assert.equal(calls,1,"circuit opening must stop the controlled retry");
  const second=await router.route({message:"two"});assert.equal(second.route,"deterministic");assert.equal(calls,1,"open circuit must skip provider");
  assert.equal(second.trace[0].reason,"circuit_open");
  router.resetBreaker("breaker-primary");assert.equal(router.status().breakers["breaker-primary"].failures,0);
}

{
  let deterministicCalls=0;
  const primary=makeProvider({id:"all-dead-primary",generate:async()=>({ok:false,error:{code:"DOWN",retryable:false}})});
  const fallback=makeProvider({id:"all-dead-fallback",generate:async()=>({ok:false,error:{code:"DOWN",retryable:false}})});
  const router=Router.create({primary,fallback,deterministic:async request=>{deterministicCalls++;return{reply:"rules",echo:request.message}}});
  const result=await router.route({message:"safe"});
  assert.equal(result.route,"deterministic");assert.equal(result.payload.echo,"safe");assert.equal(deterministicCalls,1);
  assert.deepEqual(plain(result.trace.map(x=>x.role)),["primary","fallback","deterministic"]);
}

console.log("Bay Engine router passed: primary, bounded retry, timeout fallback, circuit breaker, paid fail-closed authorization, budget ceiling, and deterministic last resort.");
