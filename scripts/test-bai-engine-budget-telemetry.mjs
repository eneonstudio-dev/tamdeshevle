import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const plain=value=>JSON.parse(JSON.stringify(value));
const window={};
const context=vm.createContext({window,console,setTimeout,clearTimeout,Date,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,TypeError});
for(const file of ["../bai-engine-provider.js","../bai-engine-router.js","../bai-engine-budget.js","../bai-engine-telemetry.js"]){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),"utf8"),context,{filename:file});
}
const Provider=window.TDBayEngineProvider;
const Router=window.TDBayEngineRouter;
const Budget=window.TDBayEngineBudget;
const Telemetry=window.TDBayEngineTelemetry;

{
  const budget=Budget.create({enabled:false,monthlyCeilingUsd:5,worstCaseRequestUsd:1});
  assert.equal(budget.authorize({provider:"paid"}),false);
  assert.equal(budget.snapshot().committedUsd,0);
}

{
  const budget=Budget.create({enabled:true,monthlyCeilingUsd:0,worstCaseRequestUsd:1});
  assert.equal(budget.authorize({provider:"paid"}),false);
}

{
  const budget=Budget.create({enabled:true,monthlyCeilingUsd:5,worstCaseRequestUsd:0});
  assert.equal(budget.authorize({provider:"paid"}),false);
}

{
  const events=[];
  const budget=Budget.create({enabled:true,monthlyCeilingUsd:5,worstCaseRequestUsd:2,onEvent:event=>events.push(event)});
  assert.equal(budget.authorize({provider:"paid-a",request:{message:"must-never-be-logged"}}),true);
  assert.equal(budget.authorize({provider:"paid-a"}),true);
  assert.equal(budget.authorize({provider:"paid-a"}),false);
  const snap=budget.snapshot();
  assert.equal(snap.committedUsd,4);assert.equal(snap.remainingUsd,1);assert.equal(snap.authorizedRequests,2);
  assert.equal(JSON.stringify(events).includes("must-never-be-logged"),false);
  assert.equal(budget.recordActual({provider:"paid-a",actualCostUsd:0.75}).ok,true);
  assert.equal(budget.snapshot().actualUsd,0.75);
}

{
  let now=Date.UTC(2026,8,30,23,59,0);
  const budget=Budget.create({enabled:true,monthlyCeilingUsd:1,worstCaseRequestUsd:1,now:()=>now});
  assert.equal(budget.authorize({provider:"paid"}),true);
  assert.equal(budget.authorize({provider:"paid"}),false);
  now=Date.UTC(2026,9,1,0,1,0);
  assert.equal(budget.authorize({provider:"paid"}),true,"new UTC month must reset the conservative reservation ledger");
  assert.equal(budget.snapshot().period,"2026-10");
}

{
  const budget=Budget.create({enabled:true,monthlyCeilingUsd:1,worstCaseRequestUsd:1});
  assert.equal(budget.authorize({provider:"paid"}),true);
  const breach=budget.recordActual({provider:"paid",actualCostUsd:1.2});
  assert.equal(breach.ok,false);assert.equal(budget.snapshot().breached,true);
  assert.equal(budget.authorize({provider:"paid"}),false,"a detected reservation breach must fail closed for later requests");
}

{
  let providerCalls=0,deterministicCalls=0;
  const paidProvider=Provider.create({
    id:"paid-test",
    capabilities:{paid:true,local:false,tools:true,structuredOutput:true,streaming:false},
    generate:async()=>{providerCalls++;return{ok:true,payload:{reply:"paid"},usage:{costUsd:0.25}};},
    healthCheck:async()=>true
  });
  const budget=Budget.create({enabled:true,monthlyCeilingUsd:2,worstCaseRequestUsd:1});
  const router=Router.create({primary:paidProvider,deterministic:async()=>{deterministicCalls++;return{reply:"rules"}},policy:{paid:budget.routerPolicy()}});
  assert.equal((await router.route({message:"one"})).route,"primary");
  assert.equal((await router.route({message:"two"})).route,"primary");
  const third=await router.route({message:"three"});
  assert.equal(third.route,"deterministic");assert.equal(providerCalls,2);assert.equal(deterministicCalls,1);
  assert.equal(budget.snapshot().committedUsd,2);
}

{
  const telemetry=Telemetry.create({maxEvents:10});
  telemetry.emit("provider_route",{
    provider:"mistral-hosted",model:"model-x",route:"primary",status:"ok",latencyMs:123,inputTokens:100,outputTokens:20,totalTokens:120,costUsd:0.001234,
    message:"secret user message",prompt:"secret prompt",context:{private:true},body:{private:true},reply:"secret model reply",apiKey:"secret"
  });
  const event=telemetry.events()[0];
  assert.equal(event.provider,"mistral-hosted");assert.equal(event.totalTokens,120);assert.equal(event.costUsd,0.001234);
  for(const forbidden of ["message","prompt","context","body","reply","apiKey"])assert.equal(Object.hasOwn(event,forbidden),false,`${forbidden} must never enter engine telemetry`);
  telemetry.recordRoute({ok:false,provider:"qwen-local",route:"fallback",error:{code:"LOCAL_RUNTIME_UNAVAILABLE"},usage:{totalTokens:0},latencyMs:4},{local:true,paid:false});
  const summary=plain(telemetry.summary());
  assert.equal(summary.count,2);assert.equal(summary.byProvider["mistral-hosted"],1);assert.equal(summary.byProvider["qwen-local"],1);assert.equal(summary.byCode.LOCAL_RUNTIME_UNAVAILABLE,1);
}

console.log("Bay Engine budget/telemetry passed: default-off, worst-case pre-reservation, monthly ceiling/reset, breach fail-closed, router integration, token/cost aggregation, and no raw prompt/context logging.");
