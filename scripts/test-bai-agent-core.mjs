import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const clientSource=fs.readFileSync(new URL('../bai-agent-client.js',import.meta.url),'utf8');
const serverSource=fs.readFileSync(new URL('../backend/bai-agent-core.ts',import.meta.url),'utf8');
const denoConfig=fs.readFileSync(new URL('../backend/bai-agent-core-deno.json',import.meta.url),'utf8');
const schemaSource=fs.readFileSync(new URL('../backend/bai-agent-core-schema.sql',import.meta.url),'utf8');
const publicConfig=fs.readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');

assert.ok(serverSource.includes('StateGraph'),'Agent Core must use a real LangGraph StateGraph');
assert.ok(serverSource.includes('.addNode("normalize"')&&serverSource.includes('.addNode("reason"')&&serverSource.includes('.addNode("policy"'),'Agent Core must keep normalize/reason/policy as separate graph nodes');
assert.ok(denoConfig.includes('npm:@langchain/langgraph@1.4.14'),'LangGraph dependency must be exactly pinned');
assert.ok(denoConfig.includes('npm:@langchain/core@1.2.11'),'LangChain core dependency must be exactly pinned');
assert.ok(denoConfig.includes('npm:@supabase/server@1.6.0'),'Supabase server dependency must be exactly pinned');
assert.ok(serverSource.includes('BAI_LLM_API_KEY')&&serverSource.includes('Deno.env.get'),'model credentials must come from server environment');
assert.equal(serverSource.includes('service_role'),false,'Edge Function source must not embed service_role credentials');
assert.ok(serverSource.includes('unknown_or_invalid_tool'),'server must fail closed on unknown/invalid tools');
assert.ok(serverSource.includes('clarification_mixed_with_mutation'),'clarification must not be mixed with basket mutations');
assert.ok(serverSource.includes('MAX_PER_HOUR = 30'),'server must enforce a per-user cost/abuse guard');
assert.equal(/prompt|message|basket/i.test(schemaSource.match(/create table[\s\S]*?\);/i)?.[0]?.replace(/bai_agent_usage/i,'')||''),false,'usage table must not persist prompt/message/basket content');
assert.ok(schemaSource.includes('enable row level security'),'agent usage table must have RLS enabled');
assert.ok(publicConfig.includes('/functions/v1/bai-agent-core'),'public config must point to the Agent Core Edge Function');
assert.equal(clientSource.includes('td_bai_cloud_key'),false,'new Agent Core must not use the legacy browser cloud key');
assert.equal(clientSource.includes('localStorage'),false,'Agent Core client must not persist model credentials in browser storage');
assert.equal(clientSource.includes('MutationObserver'),false,'Agent Core client must not add DOM observers');
assert.equal(serverSource.includes('MutationObserver'),false,'Agent Core server must not contain DOM observer logic');

let fetchCalls=0,lastPayload=null;
const context={
  console,JSON,Math,Number,String,Object,Array,Set,Date,RegExp,Promise,AbortController,setTimeout,clearTimeout,
  navigator:{onLine:true},
  fetch:async(_url,options)=>{fetchCalls++;lastPayload=JSON.parse(options.body);return{ok:true,status:200,json:async()=>({ok:true,version:'brain-2.0-agent-core-v1',model:'test-model',reply:'Собрал осмысленный вариант.',operations:[{type:'REQUIRE',value:'eggs'},{type:'HACK',value:'x'},{type:'REOPTIMIZE'}],suggestions:['Сделай дешевле'],expectsAnswer:false,trace:['normalize','reason','policy']})}}
};
context.window=context;
context.TD_BAI_AGENT={endpoint:'https://example.test/bai-agent-core'};
context.TDAuth={
  init:async()=>({auth:{getSession:async()=>({data:{session:{access_token:'user-token'}},error:null})}}),
  user:()=>({id:'user-1'})
};
context.TDShoppingState={get:()=>({budget:3000,currentTotal:0,peopleCount:1,duration:4,mode:'multi',requiredProducts:[],products:[],secretField:'must-not-leak'})};
context.TDStoreAdapters={catalog:()=>Array.from({length:90},(_,i)=>({id:`item_${i}`,name:`Товар ${i}`,tags:['food']}))};
vm.createContext(context);
vm.runInContext(clientSource,context);

assert.ok(context.TDBaiAgentClient?.install,'Agent Core client must expose install()');
assert.equal(context.TDBaiAgentClient.shouldUse('добавь молоко',{operations:[{type:'ADD_PRODUCT',value:'milk'}]}),false,'simple deterministic command must stay on fast rules');
assert.equal(context.TDBaiAgentClient.shouldUse('собери мне нормальную еду, сам реши, готовить не хочу',{operations:[]}),true,'complex planning request must be eligible for Agent Core');

context.TDBaiBrain={route:async()=>({ok:true,provider:'rules',operations:[],reply:'Не понял, что изменить.',suggestions:[],expectsAnswer:false})};
let result=await context.TDBaiBrain.route('собери мне нормальную еду, сам реши, готовить не хочу',[]);
assert.equal(result.provider,'bai-agent-core','complex request should use server agent when available');
assert.deepEqual(Array.from(result.operations,o=>o.type),['REQUIRE','REOPTIMIZE'],'client must drop operations outside its whitelist');
assert.equal(fetchCalls,1,'complex request should call Agent Core once');
assert.equal(lastPayload.basket.secretField,undefined,'client must send a strict basket projection');
assert.equal(lastPayload.catalog.length,80,'catalog context must be capped');
assert.equal(lastPayload.history.length,0,'empty history must stay empty');

fetchCalls=0;
context.TDBaiBrain={route:async()=>({ok:true,provider:'rules',operations:[{type:'ADD_PRODUCT',value:'milk'}],reply:'Добавил.',suggestions:[],expectsAnswer:false})};
result=await context.TDBaiBrain.route('добавь молоко',[]);
assert.equal(result.provider,'rules','simple command must preserve deterministic route');
assert.equal(fetchCalls,0,'simple command must not spend an agent request');

context.navigator.onLine=false;
result=await context.TDBaiAgentClient.route('сам реши что купить',[],{ok:true,provider:'rules',operations:[],reply:'Не понял.'});
assert.equal(result.provider,'rules','offline Agent Core must fail back to local rules');

console.log('Bai Agent Core regression suite passed: LangGraph wiring, server-only secrets, tool policy, data minimization, fast-rule routing and offline fallback.');
