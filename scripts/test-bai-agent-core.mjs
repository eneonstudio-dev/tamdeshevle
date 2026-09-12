import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const clientSource=fs.readFileSync(new URL('../bai-agent-client.js',import.meta.url),'utf8');
const gemmaSource=fs.readFileSync(new URL('../gemma-router.js',import.meta.url),'utf8');
const gemmaWorkerSource=fs.readFileSync(new URL('../gemma-browser-worker.js',import.meta.url),'utf8');
const serverSource=fs.readFileSync(new URL('../backend/bai-agent-core.ts',import.meta.url),'utf8');
const denoConfig=fs.readFileSync(new URL('../backend/bai-agent-core-deno.json',import.meta.url),'utf8');
const schemaSource=fs.readFileSync(new URL('../backend/bai-agent-core-schema.sql',import.meta.url),'utf8');
const publicConfig=fs.readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');

assert.ok(serverSource.includes('StateGraph'),'Agent Core must use a real LangGraph StateGraph');
assert.ok(serverSource.includes('.addNode("normalize"')&&serverSource.includes('.addNode("reason"')&&serverSource.includes('.addNode("policy"'),'Agent Core graph stages must stay explicit');
assert.ok(denoConfig.includes('npm:@langchain/langgraph@1.4.14'),'LangGraph dependency must be pinned');
assert.ok(denoConfig.includes('npm:@langchain/core@1.2.11'),'LangChain core dependency must be pinned');
assert.ok(denoConfig.includes('npm:@supabase/server@1.6.0'),'Supabase server dependency must be pinned');
assert.ok(serverSource.includes('BAI_LLM_API_KEY')&&serverSource.includes('Deno.env.get'),'server model credentials must remain server-only');
assert.equal(serverSource.includes('service_role'),false,'Edge source must not embed service-role credentials');
assert.ok(serverSource.includes('unknown_or_invalid_tool'),'server must fail closed on invalid tools');
assert.ok(serverSource.includes('clarification_mixed_with_mutation'),'clarification cannot be mixed with mutations');
assert.ok(serverSource.includes('MAX_PER_HOUR = 30'),'server must keep a per-user abuse/cost guard');
assert.equal(/prompt|message|basket/i.test(schemaSource.match(/create table[\s\S]*?\);/i)?.[0]?.replace(/bai_agent_usage/i,'')||''),false,'usage telemetry must not persist prompt/message/basket');
assert.ok(schemaSource.includes('enable row level security'),'usage table must keep RLS');
assert.ok(publicConfig.includes('/functions/v1/bai-agent-core'),'public config must keep the Agent Core endpoint');

assert.equal(clientSource.includes('td_bai_cloud_key'),false,'Agent client must not store cloud model keys');
assert.equal(gemmaSource.includes('Authorization'),false,'local Gemma must not send model authorization headers');
assert.equal(gemmaSource.includes('configureCloud'),false,'local Gemma must not expose cloud configuration');
assert.ok(gemmaSource.includes('td_bai_gemma_local_enabled'),'browser storage may persist only explicit Gemma consent');
assert.ok(gemmaSource.includes('onnx-community/gemma-3-270m-it-ONNX'),'local fallback must use Gemma 3 270M IT');
assert.ok(gemmaSource.includes('2dbbfdb1b59bd034eb959428c6a7da9dd7ea27f0'),'Gemma model revision must be pinned');
assert.ok(gemmaWorkerSource.includes('revision:MODEL_REVISION'),'worker must load the pinned model revision');
assert.ok(gemmaWorkerSource.includes('dtype:"q4f16"'),'local model must use bounded q4f16 weights');
assert.equal(clientSource.toLowerCase().includes('qwen'),false,'Agent client must contain no Qwen dependency');
assert.equal(gemmaSource.toLowerCase().includes('qwen'),false,'Gemma router must contain no Qwen dependency');
assert.equal(gemmaWorkerSource.toLowerCase().includes('qwen'),false,'Gemma worker must contain no Qwen dependency');
assert.equal(clientSource.includes('MutationObserver'),false,'Agent client must not add DOM observers');
assert.equal(gemmaSource.includes('MutationObserver'),false,'Gemma router must not add DOM observers');

let fetchCalls=0,lastPayload=null;
const storage=new Map();
const localStorage={getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
const context={console,JSON,Math,Number,String,Object,Array,Set,Date,RegExp,Promise,AbortController,setTimeout,clearTimeout,localStorage,navigator:{onLine:true},fetch:async(_url,options)=>{fetchCalls++;lastPayload=JSON.parse(options.body);return{ok:true,status:200,json:async()=>({ok:true,version:'brain-2.0-agent-core-v1',model:'test-model',reply:'Собрал осмысленный вариант.',operations:[{type:'REQUIRE',value:'eggs'},{type:'HACK',value:'x'},{type:'REOPTIMIZE'}],suggestions:['Сделай дешевле'],expectsAnswer:false,trace:['normalize','reason','policy']})}}};
context.window=context;context.globalThis=context;
context.TD_BAI_AGENT={endpoint:'https://example.test/bai-agent-core'};
context.TDAuth={init:async()=>({auth:{getSession:async()=>({data:{session:{access_token:'user-token'}},error:null})}}),user:()=>({id:'user-1'})};
context.TDShoppingState={get:()=>({budget:3000,currentTotal:0,peopleCount:1,duration:4,mode:'multi',requiredProducts:[],products:[],secretField:'must-not-leak'})};
context.TDStoreAdapters={catalog:()=>Array.from({length:90},(_,i)=>({id:`item_${i}`,name:`Товар ${i}`,tags:['food']}))};
vm.createContext(context);vm.runInContext(clientSource,context);

assert.ok(context.TDBaiAgentClient?.install,'Agent client must expose install()');
assert.equal(context.TDBaiAgentClient.shouldUse('добавь молоко',{operations:[{type:'ADD_PRODUCT',value:'milk'}]}),false,'simple command must stay on fast rules');
assert.equal(context.TDBaiAgentClient.shouldUse('собери мне нормальную еду, сам реши, готовить не хочу',{operations:[]}),true,'complex planning request must be agent-eligible');

context.TDBaiBrain={route:async()=>({ok:true,provider:'rules',operations:[],reply:'Не понял, что изменить.',suggestions:[],expectsAnswer:false})};
let result=await context.TDBaiBrain.route('собери мне нормальную еду, сам реши, готовить не хочу',[]);
assert.equal(result.provider,'bai-agent-core','server agent must stay first priority when available');
assert.deepEqual(Array.from(result.operations,o=>o.type),['REQUIRE','REOPTIMIZE'],'client must drop operations outside whitelist');
assert.equal(fetchCalls,1,'complex request should call Agent Core once');
assert.equal(lastPayload.basket.secretField,undefined,'client must send strict basket projection');
assert.equal(lastPayload.catalog.length,80,'catalog context must be capped');

fetchCalls=0;
context.TDBaiBrain={route:async()=>({ok:true,provider:'rules',operations:[{type:'ADD_PRODUCT',value:'milk'}],reply:'Добавил.',suggestions:[],expectsAnswer:false})};
result=await context.TDBaiBrain.route('добавь молоко',[]);
assert.equal(result.provider,'rules','simple command must preserve deterministic route');
assert.equal(fetchCalls,0,'simple command must not spend an agent request');

context.navigator.onLine=false;
result=await context.TDBaiAgentClient.route('сам реши что купить',[],{ok:true,provider:'rules',operations:[],reply:'Не понял.'});
assert.equal(result.provider,'rules','offline mode must fail back to rules without model download');

context.navigator.onLine=true;context.navigator.gpu={};context.Worker=function Worker(){};context.TDAuth.user=()=>null;
let localCalls=0;
context.TDGemmaRouter={status:()=>({enabled:localStorage.getItem('td_bai_gemma_local_enabled')==='1',supported:true}),enable(){localStorage.setItem('td_bai_gemma_local_enabled','1');return this.status()},disable(){localStorage.setItem('td_bai_gemma_local_enabled','0');return this.status()},route:async()=>{localCalls++;return{ok:true,provider:'gemma-browser',model:'onnx-community/gemma-3-270m-it-ONNX',operations:[{type:'REQUIRE',value:'water'}],reply:'Локально собрал вариант.'}}};
const baseline={ok:true,provider:'rules',operations:[],reply:'Не понял.',suggestions:[],expectsAnswer:false};
result=await context.TDBaiAgentClient.route('собери рацион на неделю, сам реши что купить',[],baseline);
assert.equal(result.provider,'rules','local model must not run before consent');
assert.equal(localCalls,0,'local model must not silently download/run');
assert.ok(result.suggestions.some(x=>String(x).includes('Включить нейро-режим')),'complex fallback should offer explicit local opt-in');

result=await context.TDBaiAgentClient.route('Включить нейро-режим (~310 МБ)',[],baseline);
assert.equal(localStorage.getItem('td_bai_gemma_local_enabled'),'1','explicit opt-in must persist only Gemma consent');
assert.equal(result.provider,'gemma-browser-control','opt-in must be a control action');
assert.equal(result.operations.length,0,'enabling local model must not mutate basket');

result=await context.TDBaiAgentClient.route('собери рацион на неделю, сам реши что купить',[],baseline);
assert.equal(result.provider,'gemma-browser','after consent, server-unavailable reasoning should fall back to local Gemma');
assert.equal(localCalls,1,'local Gemma should run once');
assert.deepEqual(Array.from(result.operations,o=>o.type),['REQUIRE'],'Gemma output must pass operation whitelist');

result=await context.TDBaiAgentClient.route('Выключить нейро-режим',[],baseline);
assert.equal(localStorage.getItem('td_bai_gemma_local_enabled'),'0','user must be able to disable local inference');
assert.equal(result.operations.length,0,'disabling local inference must not mutate basket');

console.log('Bai Agent Core regression suite passed: server-first routing, zero-budget opt-in Gemma fallback, no browser model secrets, safe tool policy and rules fallback.');
