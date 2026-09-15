import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const plain=value=>JSON.parse(JSON.stringify(value));
const window={};
const context=vm.createContext({window,console,setTimeout,clearTimeout,Date,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,TypeError});
for(const file of ["../bai-engine-provider.js","../bai-engine-adapters.js","../bai-provider-contract.js"]){
  vm.runInContext(fs.readFileSync(new URL(file,import.meta.url),"utf8"),context,{filename:file});
}
const Engine=window.TDBayEngineProvider;
const Adapters=window.TDBayEngineAdapters;
const Safety=window.TDBaiProviderContract;
assert.equal(Adapters.version,1);

assert.throws(()=>Adapters.createMistral({apiKey:"browser-secret",transport:async()=>({})}),/do not accept browser credentials/);
assert.throws(()=>Adapters.createMistral({}),/server-side transport/);

let mistralTransportRequest=null;
const transport=async request=>{
  mistralTransportRequest=request;
  return{
    model:"mistral-small-test",
    choices:[{finish_reason:"stop",message:{content:JSON.stringify({price:123,availability:true,operations:[{type:"ADD_PRODUCT",value:"milk"}],reply:"Добавил молоко."})}}],
    usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}
  };
};
const mistral=Adapters.createMistral({transport,model:"mistral-small-test"});
assert.deepEqual(plain(mistral.capabilities()),{streaming:false,tools:true,structuredOutput:true,local:false,paid:true});
const mistralResult=await mistral.generate({message:"добавь молоко",context:{budget:500},tools:[{type:"function",function:{name:"shopping_action"}}]},{maxTokens:200});
assert.equal(mistralResult.ok,true);
assert.equal(mistralResult.provider,"mistral-hosted");
assert.equal(mistralResult.usage.totalTokens,120);
assert.equal(Object.hasOwn(mistralTransportRequest,"apiKey"),false);
assert.equal(Object.hasOwn(mistralTransportRequest,"authorization"),false);
assert.equal(mistralTransportRequest.body.model,"mistral-small-test");
assert.equal(mistralTransportRequest.body.response_format.type,"json_object");
assert.equal(mistralTransportRequest.body.tools.length,1);
const safe=Safety.normalize(mistralResult.payload,{catalog:[{id:"milk"}]});
assert.equal(safe.ok,true);
assert.deepEqual(plain(safe.operations),[{type:"ADD_PRODUCT",value:"milk"}]);
assert.equal(Object.hasOwn(safe,"price"),false);
assert.equal(Object.hasOwn(safe,"availability"),false);
assert.equal((await mistral.healthCheck()).status,"configured");

const retryTransport=async()=>({ok:false,status:429,error:{message:"rate limited"}});
const retryMistral=Adapters.createMistral({id:"mistral-retry",transport:retryTransport});
const retryFailure=await retryMistral.generate({message:"x"});
assert.equal(retryFailure.ok,false);assert.equal(retryFailure.error.retryable,true);
const authTransport=async()=>({ok:false,status:401,error:{message:"bad auth"}});
const authMistral=Adapters.createMistral({id:"mistral-auth",transport:authTransport});
const authFailure=await authMistral.generate({message:"x"});
assert.equal(authFailure.ok,false);assert.equal(authFailure.error.retryable,false);

const missingQwen=Adapters.createQwenLocal();
assert.deepEqual(plain(missingQwen.capabilities()),{streaming:false,tools:true,structuredOutput:true,local:true,paid:false});
assert.equal((await missingQwen.healthCheck()).ok,false);
const missingResult=await missingQwen.generate({message:"x"});
assert.equal(missingResult.ok,false);assert.equal(missingResult.error.code,"LOCAL_RUNTIME_UNAVAILABLE");
assert.deepEqual(plain(missingQwen.estimateCost({inputTokens:999})),{usd:0});

let localRequest=null;
const runtime={
  isReady:()=>true,
  async generate(request){
    localRequest=request;
    return{model:"qwen-local-test",choices:[{message:{content:JSON.stringify({operations:[{type:"ADD_PRODUCT",value:"bread"}],reply:"Добавил хлеб."})},finish_reason:"stop"}],usage:{prompt_tokens:50,completion_tokens:10,total_tokens:60}};
  }
};
const qwen=Adapters.createQwenLocal({runtime,model:"qwen-local-test"});
assert.equal((await qwen.healthCheck()).ok,true);
const qwenResult=await qwen.generate({message:"добавь хлеб",tools:[]});
assert.equal(qwenResult.ok,true);assert.equal(qwenResult.provider,"qwen-local");assert.equal(qwenResult.usage.totalTokens,60);
assert.equal(localRequest.model,"qwen-local-test");
const safeQwen=Safety.normalize(qwenResult.payload,{catalog:[{id:"bread"}]});
assert.equal(safeQwen.ok,true);
assert.deepEqual(plain(safeQwen.operations),[{type:"ADD_PRODUCT",value:"bread"}]);

assert.deepEqual(plain(Adapters.toMessages({system:"system",message:"hi",context:{a:1}})),[
  {role:"system",content:"system"},
  {role:"user",content:'hi\n\n<bounded_context>{"a":1}</bounded_context>'}
]);
assert.equal(Engine.version,1);
console.log("Bay Engine adapters passed: Mistral server-side transport/no browser secret, retry classification, Qwen local fail-closed/runtime path, and downstream truth normalization.");
