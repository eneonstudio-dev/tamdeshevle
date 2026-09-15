(()=>{
  "use strict";
  if(window.TDBayEngineProvider)return;

  const VERSION=1;
  const CAPABILITY_KEYS=["streaming","tools","structuredOutput","local","paid"];
  const clean=(value,max=120)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const nonNegative=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):undefined;
  const id=value=>{const out=String(value??"").trim();return/^[a-z0-9][a-z0-9._-]{1,63}$/.test(out)?out:null};

  function normalizeCapabilities(raw={}){
    const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
    const out={};
    for(const key of CAPABILITY_KEYS)out[key]=source[key]===true;
    return Object.freeze(out);
  }

  function normalizeUsage(raw={}){
    const source=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
    const out={};
    for(const [from,to] of [["inputTokens","inputTokens"],["outputTokens","outputTokens"],["cachedInputTokens","cachedInputTokens"],["totalTokens","totalTokens"],["costUsd","costUsd"]]){
      const value=nonNegative(source[from]);
      if(value!==undefined)out[to]=value;
    }
    return out;
  }

  function normalizeError(raw){
    const source=raw&&typeof raw==="object"?raw:{};
    return{
      code:clean(source.code||source.name||"PROVIDER_ERROR",64)||"PROVIDER_ERROR",
      message:clean(source.message||"Provider request failed",240)||"Provider request failed",
      retryable:source.retryable===true
    };
  }

  function normalizeResult(raw,{provider,startedAt=Date.now()}={}){
    const providerId=id(provider)||"unknown";
    const latencyMs=Math.max(0,Math.round(Date.now()-Number(startedAt||Date.now())));
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return{ok:false,provider:providerId,error:{code:"INVALID_PROVIDER_RESULT",message:"Provider returned a non-object result",retryable:false},usage:{},latencyMs};
    if(raw.ok===false)return{ok:false,provider:providerId,error:normalizeError(raw.error||raw),usage:normalizeUsage(raw.usage),latencyMs};
    const payload=raw.payload!==undefined?raw.payload:(raw.output!==undefined?raw.output:raw);
    if(!payload||typeof payload!=="object"||Array.isArray(payload))return{ok:false,provider:providerId,error:{code:"INVALID_PROVIDER_PAYLOAD",message:"Provider payload must be an object",retryable:false},usage:normalizeUsage(raw.usage),latencyMs};
    return{
      ok:true,
      provider:providerId,
      model:clean(raw.model,100),
      payload:clone(payload),
      usage:normalizeUsage(raw.usage),
      finishReason:clean(raw.finishReason||raw.finish_reason,64),
      latencyMs
    };
  }

  function create(spec={}){
    if(!spec||typeof spec!=="object"||Array.isArray(spec))throw new TypeError("Bay provider spec must be an object");
    const providerId=id(spec.id);if(!providerId)throw new TypeError("Bay provider id is invalid");
    if(typeof spec.generate!=="function")throw new TypeError(`Bay provider ${providerId} must implement generate()`);
    if(typeof spec.healthCheck!=="function")throw new TypeError(`Bay provider ${providerId} must implement healthCheck()`);
    const caps=normalizeCapabilities(typeof spec.capabilities==="function"?spec.capabilities():spec.capabilities);
    if(caps.streaming&&typeof spec.stream!=="function")throw new TypeError(`Bay provider ${providerId} declares streaming but has no stream()`);

    const adapter={
      id:providerId,
      capabilities:()=>({...caps}),
      async generate(request,options={}){
        const startedAt=Date.now();
        try{return normalizeResult(await spec.generate(clone(request),clone(options)),{provider:providerId,startedAt})}
        catch(error){return{ok:false,provider:providerId,error:normalizeError(error),usage:{},latencyMs:Math.max(0,Date.now()-startedAt)}}
      },
      async healthCheck(){
        try{
          const raw=await spec.healthCheck();
          if(raw===true)return{ok:true,status:"healthy",provider:providerId};
          if(!raw||typeof raw!=="object")return{ok:false,status:"unknown",provider:providerId};
          return{ok:raw.ok!==false,status:clean(raw.status||((raw.ok===false)?"unhealthy":"healthy"),48),provider:providerId,reason:clean(raw.reason,120)};
        }catch(error){return{ok:false,status:"error",provider:providerId,reason:normalizeError(error).code}}
      }
    };
    if(typeof spec.stream==="function")adapter.stream=(request,options={})=>spec.stream(clone(request),clone(options));
    if(typeof spec.estimateCost==="function")adapter.estimateCost=usage=>{
      const result=spec.estimateCost(normalizeUsage(usage));
      const amount=nonNegative(result?.usd??result);
      return amount===undefined?null:{usd:amount};
    };
    return Object.freeze(adapter);
  }

  window.TDBayEngineProvider={version:VERSION,create,normalizeCapabilities,normalizeUsage,normalizeResult};
})();
