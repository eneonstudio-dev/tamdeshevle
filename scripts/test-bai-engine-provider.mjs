import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const window={};
const context=vm.createContext({window,console,setTimeout,clearTimeout,Date,JSON,Math,Number,String,Boolean,Object,Array,Set,Map,Promise,TypeError});
for(const file of ["../bai-engine-provider.js","../bai-provider-contract.js"]){
  const source=fs.readFileSync(new URL(file,import.meta.url),"utf8");
  vm.runInContext(source,context,{filename:file});
}

const Engine=window.TDBayEngineProvider;
const Safety=window.TDBaiProviderContract;
assert.equal(Engine.version,1);
assert.equal(Safety.version,1);

assert.throws(()=>Engine.create({id:"xx",capabilities:{},healthCheck:async()=>true}),/generate/);
assert.throws(()=>Engine.create({id:"bad id",capabilities:{},generate:async()=>({}),healthCheck:async()=>true}),/id/);
assert.throws(()=>Engine.create({id:"streamer",capabilities:{streaming:true},generate:async()=>({}),healthCheck:async()=>true}),/stream/);

let seenRequest=null;
const provider=Engine.create({
  id:"test-provider",
  capabilities:{streaming:false,tools:true,structuredOutput:true,local:false,paid:false},
  async generate(request){
    seenRequest=request;
    return{
      ok:true,
      model:"test-model",
      payload:{
        price:1,
        availability:true,
        operations:[{type:"ADD_PRODUCT",value:"milk"}],
        reply:"Добавил молоко."
      },
      usage:{inputTokens:120,outputTokens:30,totalTokens:150,costUsd:0}
    };
  },
  async healthCheck(){return{ok:true,status:"healthy"};},
  estimateCost(){return{usd:0};}
});

assert.deepEqual(provider.capabilities(),{streaming:false,tools:true,structuredOutput:true,local:false,paid:false});
const request={message:"молоко",context:{session:"bounded"}};
const result=await provider.generate(request);
assert.equal(result.ok,true);
assert.equal(result.provider,"test-provider");
assert.equal(result.model,"test-model");
assert.equal(result.usage.totalTokens,150);
assert.equal(result.usage.costUsd,0);
assert.notEqual(result.payload,request,"provider payload must not alias the request");
assert.deepEqual(seenRequest,request);

const safe=Safety.normalize(result.payload,{catalog:[{id:"milk"}]});
assert.equal(safe.ok,true);
assert.deepEqual(safe.operations,[{type:"ADD_PRODUCT",value:"milk"}]);
assert.equal(safe.reply,"Добавил молоко.");
assert.equal(Object.hasOwn(safe,"price"),false,"truth-critical provider fields must not escape normalization");
assert.equal(Object.hasOwn(safe,"availability"),false,"availability must not escape normalization");

const health=await provider.healthCheck();
assert.equal(health.ok,true);
assert.equal(health.provider,"test-provider");
assert.deepEqual(provider.estimateCost({inputTokens:100}),{usd:0});

const throws=Engine.create({
  id:"throws",
  capabilities:{paid:true},
  async generate(){const error=new Error("boom");error.code="TEMP";error.retryable=true;throw error;},
  async healthCheck(){throw new Error("down");}
});
const failure=await throws.generate({message:"x"});
assert.equal(failure.ok,false);
assert.equal(failure.error.code,"TEMP");
assert.equal(failure.error.retryable,true);
assert.equal((await throws.healthCheck()).ok,false);

const invalid=Engine.create({
  id:"invalid-result",
  capabilities:{},
  async generate(){return"nope";},
  async healthCheck(){return true;}
});
assert.equal((await invalid.generate({})).error.code,"INVALID_PROVIDER_RESULT");

console.log("Bay Engine provider adapter contract passed: capabilities, normalized envelope, health/cost hooks, failure isolation, and truth fields remain behind Votonobay safety normalization.");
