import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const kernelState={execution_transactions:[],idempotency_log:[]};
const legacy={products:[{id:"milk",quantity:1}],budget:5000,history:[]};
let mutations=0;
const kernel={
  state:{get:()=>kernelState,save:next=>{Object.keys(kernelState).forEach(key=>delete kernelState[key]);Object.assign(kernelState,JSON.parse(JSON.stringify(next)));return kernelState}},
  domainGate:()=>({allowed:true}),
  propose:(_text,operations)=>({ok:true,actions:Array.isArray(operations)?operations:[]}),
  validateAction:action=>action&&["change_quantity","set_constraint"].includes(action.type)?{ok:true,action}:{ok:false,error:{code:"ACTION_NOT_ALLOWLISTED"}},
  run:async input=>{
    const action=input.operations?.[0];mutations++;
    if(action?.type==="change_quantity")legacy.products[0].quantity+=Number(action.payload?.delta)||0;
    if(action?.type==="set_constraint"){legacy.budget=Number(action.payload?.value)||legacy.budget;return{ok:false,status:"ERROR",error:{code:"SIMULATED_FAILURE"},actions:[action],provider_actions_executed:true}}
    return{ok:true,status:"VERIFIED",actions:input.operations||[],provider_actions_executed:true};
  },
  execute:(actions,options={})=>kernel.run({operations:actions,execution_id:options.execution_id})
};
const events=[];
const context={
  console,JSON,Math,Date,Set,Map,Promise,setTimeout,clearTimeout,
  crypto:{randomUUID:()=>"12345678-1234-4234-8234-123456789abc"},
  TDBaiShoppingAgentKernel:kernel,
  TDShoppingState:{get:()=>legacy,save:()=>legacy,syncCart:()=>true},
  TDBaiObservability:{emit:(type,detail)=>events.push({type,...detail})},
  TDBaiTraceContext:{current:()=>null},
  render(){}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../bai-idempotency-guard.js",import.meta.url),"utf8"),context);
vm.runInContext(fs.readFileSync(new URL("../bai-execution-state-machine.js",import.meta.url),"utf8"),context);

assert.equal(context.TDBaiExecutionStateMachine.status().installed,true);
const input={text:"Добавь упаковку молока",operations:[{type:"change_quantity",payload:{product_id:"milk",delta:1}}],execution_id:"exec_state-0001"};
const first=await kernel.run(input);
assert.equal(first.ok,true);assert.equal(legacy.products[0].quantity,2);assert.equal(mutations,1);
let tx=context.TDBaiExecutionStateMachine.status().last;
assert.deepEqual(Array.from(tx.states),["PROPOSED","VALIDATED","EXECUTING","VERIFIED"]);
assert.equal(tx.status,"VERIFIED");assert.equal(tx.before_legacy,undefined,"terminal transactions must not retain a basket snapshot");

const duplicate=await kernel.run(input);
assert.equal(duplicate.idempotent_replay,true,"verified retry must be served by the idempotency layer");
assert.equal(legacy.products[0].quantity,2);assert.equal(mutations,1,"retry must not execute a second mutation");

const failed=await kernel.run({text:"Сломанный шаг",operations:[{type:"set_constraint",payload:{key:"budget",value:9999}}],execution_id:"exec_state-0002"});
assert.equal(failed.ok,false);assert.equal(failed.error.code,"SIMULATED_FAILURE");assert.equal(legacy.budget,5000,"failed execution must restore the exact pre-execution shopping state");
tx=context.TDBaiExecutionStateMachine.status().last;
assert.equal(tx.status,"ROLLED_BACK");assert.deepEqual(Array.from(tx.states),["PROPOSED","VALIDATED","EXECUTING","ROLLED_BACK"]);

const crashBefore=JSON.parse(JSON.stringify(legacy));
const crashKey=context.TDBaiExecutionStateMachine._test.key("run","exec_state-0003",{text:"crash",operations:[]});
kernelState.execution_transactions.push({key:crashKey,execution_id:"exec_state-0003",kind:"run",status:"EXECUTING",states:["PROPOSED","VALIDATED","EXECUTING"],at:Date.now(),before_legacy:crashBefore});
legacy.products[0].quantity=9;
assert.equal(context.TDBaiExecutionStateMachine._test.recoverIncomplete(kernel),1);
assert.equal(legacy.products[0].quantity,2,"startup recovery must fail closed to the stored pre-execution state");
tx=kernelState.execution_transactions.find(entry=>entry.key===crashKey);assert.equal(tx.status,"ROLLED_BACK");assert.equal(tx.code,"RECOVERED_INCOMPLETE_EXECUTION");
assert.ok(events.some(event=>event.type==="execution_state"&&event.status==="VERIFIED"));assert.ok(events.some(event=>event.type==="execution_state"&&event.status==="ROLLED_BACK"));

console.log("Bai execution state machine passed: proposed -> validated -> executing -> verified/rolled back, idempotent retry, and crash recovery are fail-closed.");
