(()=>{
  "use strict";
  if(window.TDBayEngineRouter)return;

  const VERSION=1;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const int=(value,fallback,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback};
  const amount=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;

  function create({primary=null,fallback=null,deterministic,policy={}}={}){
    if(typeof deterministic!=="function")throw new TypeError("Bay Engine router requires deterministic fallback");
    const timeoutMs=int(policy.timeoutMs,9000,100,60000);
    const maxAttempts=int(policy.maxAttempts,2,1,2);
    const failureThreshold=int(policy.failureThreshold,3,1,10);
    const cooldownMs=int(policy.cooldownMs,60000,1000,600000);
    const paidPolicy=policy.paid&&typeof policy.paid==="object"?policy.paid:{};
    const paidEnabled=paidPolicy.enabled===true;
    const monthlyCeilingUsd=amount(paidPolicy.monthlyCeilingUsd);
    const spentUsd=typeof paidPolicy.spentUsd==="function"?paidPolicy.spentUsd:()=>0;
    const authorizePaid=typeof paidPolicy.authorize==="function"?paidPolicy.authorize:null;
    const breakers=new Map();

    const stateFor=provider=>{
      const key=provider?.id||"unknown";
      if(!breakers.has(key))breakers.set(key,{failures:0,openUntil:0});
      return breakers.get(key);
    };
    const capabilities=provider=>{try{return provider?.capabilities?.()||{}}catch{return{}}};
    const eligible=(provider,request,options)=>{
      if(!provider||typeof provider.generate!=="function")return{ok:false,reason:"missing"};
      const caps=capabilities(provider);
      if(caps.paid===true){
        if(!paidEnabled)return{ok:false,reason:"paid_disabled"};
        if(monthlyCeilingUsd<=0)return{ok:false,reason:"budget_ceiling_missing"};
        const spent=amount(spentUsd());
        if(spent>=monthlyCeilingUsd)return{ok:false,reason:"budget_exhausted"};
        if(!authorizePaid)return{ok:false,reason:"paid_authorizer_missing"};
        let authorized=false;
        try{authorized=authorizePaid({provider:provider.id,spentUsd:spent,monthlyCeilingUsd,request:clone(request),options:clone(options)})===true}catch{authorized=false}
        if(!authorized)return{ok:false,reason:"paid_not_authorized"};
      }
      const breaker=stateFor(provider);
      if(Number(breaker.openUntil||0)>Date.now())return{ok:false,reason:"circuit_open"};
      return{ok:true};
    };
    const fail=provider=>{
      const breaker=stateFor(provider);breaker.failures++;
      if(breaker.failures>=failureThreshold)breaker.openUntil=Date.now()+cooldownMs;
    };
    const recover=provider=>{const breaker=stateFor(provider);breaker.failures=0;breaker.openUntil=0;};

    async function timedGenerate(provider,request,options){
      let timer;
      const timeout=new Promise(resolve=>{timer=setTimeout(()=>resolve({ok:false,provider:provider.id,error:{code:"TIMEOUT",message:"Provider timed out",retryable:true},usage:{},latencyMs:timeoutMs}),timeoutMs)});
      try{return await Promise.race([provider.generate(clone(request),{...clone(options),timeoutMs}),timeout]);}
      finally{clearTimeout(timer)}
    }

    async function attemptProvider(provider,role,request,options,trace){
      const gate=eligible(provider,request,options);
      if(!gate.ok){trace.push({role,provider:provider?.id||null,status:"skipped",reason:gate.reason});return null;}
      for(let attempt=1;attempt<=maxAttempts;attempt++){
        const result=await timedGenerate(provider,request,options);
        if(result?.ok===true){recover(provider);trace.push({role,provider:provider.id,status:"ok",attempt});return{...result,route:role,trace:clone(trace)};}
        const code=String(result?.error?.code||"PROVIDER_ERROR");
        const retryable=result?.error?.retryable===true;
        trace.push({role,provider:provider.id,status:"error",attempt,code,retryable});
        fail(provider);
        if(!retryable||attempt>=maxAttempts)break;
        if(Number(stateFor(provider).openUntil||0)>Date.now())break;
      }
      return null;
    }

    async function route(request,options={}){
      const trace=[];
      const first=await attemptProvider(primary,"primary",request,options,trace);if(first)return first;
      const second=await attemptProvider(fallback,"fallback",request,options,trace);if(second)return second;
      try{
        const raw=await deterministic(clone(request),clone(options));
        trace.push({role:"deterministic",provider:"deterministic",status:"ok"});
        return{ok:true,provider:"deterministic",route:"deterministic",payload:clone(raw),usage:{},latencyMs:0,trace:clone(trace)};
      }catch(error){
        trace.push({role:"deterministic",provider:"deterministic",status:"error",code:String(error?.code||error?.name||"DETERMINISTIC_ERROR")});
        return{ok:false,provider:"deterministic",route:"deterministic",error:{code:String(error?.code||error?.name||"DETERMINISTIC_ERROR"),message:String(error?.message||"Deterministic fallback failed"),retryable:false},usage:{},latencyMs:0,trace:clone(trace)};
      }
    }

    function status(){
      const snapshot={};
      for(const provider of [primary,fallback])if(provider){const state=stateFor(provider);snapshot[provider.id]={failures:state.failures,openUntil:state.openUntil,paid:capabilities(provider).paid===true};}
      return{version:VERSION,timeoutMs,maxAttempts,failureThreshold,cooldownMs,paid:{enabled:paidEnabled,monthlyCeilingUsd,spentUsd:amount(spentUsd()),authorizerConfigured:Boolean(authorizePaid)},breakers:snapshot};
    }
    function resetBreaker(providerId){const state=breakers.get(providerId);if(state){state.failures=0;state.openUntil=0;}return status();}

    return Object.freeze({version:VERSION,route,status,resetBreaker});
  }

  window.TDBayEngineRouter={version:VERSION,create};
})();
