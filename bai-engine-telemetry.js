(()=>{
  "use strict";
  if(window.TDBayEngineTelemetry)return;

  const VERSION=1,DEFAULT_MAX=200;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const clean=(value,max=96)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
  const nonNegative=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):undefined;
  const whole=value=>{const n=nonNegative(value);return n===undefined?undefined:Math.round(n)};

  function create(config={}){
    const maxEvents=Number.isInteger(Number(config?.maxEvents))?Math.min(1000,Math.max(10,Number(config.maxEvents))):DEFAULT_MAX;
    const events=[];
    function sanitize(detail={}){
      const source=detail&&typeof detail==="object"&&!Array.isArray(detail)?detail:{};
      const out={};
      for(const key of ["provider","model","route","status","code","reason","stage"]){const value=clean(source[key]);if(value)out[key]=value;}
      for(const [from,to] of [["latencyMs","latencyMs"],["inputTokens","inputTokens"],["outputTokens","outputTokens"],["cachedInputTokens","cachedInputTokens"],["totalTokens","totalTokens"],["attempt","attempt"]]){const value=whole(source[from]);if(value!==undefined)out[to]=value;}
      const cost=nonNegative(source.costUsd);if(cost!==undefined)out.costUsd=Math.round(cost*1_000_000)/1_000_000;
      for(const key of ["paid","local","retryable","success"]){if(typeof source[key]==="boolean")out[key]=source[key];}
      return out;
    }
    function emit(type,detail={}){
      const event={version:VERSION,type:clean(type,48)||"unknown",at:new Date().toISOString(),...sanitize(detail)};
      events.push(event);if(events.length>maxEvents)events.splice(0,events.length-maxEvents);
      try{window.dispatchEvent?.(new CustomEvent("td:bay-engine-telemetry",{detail:clone(event)}));}catch{}
      return clone(event);
    }
    function recordRoute(result={},meta={}){
      const usage=result?.usage&&typeof result.usage==="object"?result.usage:{};
      return emit("provider_route",{
        provider:result?.provider,
        model:result?.model,
        route:result?.route,
        status:result?.ok===false?"error":"ok",
        code:result?.error?.code,
        reason:meta?.reason,
        latencyMs:result?.latencyMs,
        inputTokens:usage.inputTokens,
        outputTokens:usage.outputTokens,
        cachedInputTokens:usage.cachedInputTokens,
        totalTokens:usage.totalTokens,
        costUsd:usage.costUsd,
        paid:meta?.paid,
        local:meta?.local,
        success:result?.ok!==false
      });
    }
    function summary(){
      const byProvider={},byRoute={},byCode={};let totalCostUsd=0,totalTokens=0;
      for(const event of events){
        if(event.provider)byProvider[event.provider]=(byProvider[event.provider]||0)+1;
        if(event.route)byRoute[event.route]=(byRoute[event.route]||0)+1;
        if(event.code)byCode[event.code]=(byCode[event.code]||0)+1;
        totalCostUsd+=Number(event.costUsd||0);totalTokens+=Number(event.totalTokens||0);
      }
      return{version:VERSION,count:events.length,totalCostUsd:Math.round(totalCostUsd*1_000_000)/1_000_000,totalTokens,byProvider,byRoute,byCode,last:events.length?clone(events[events.length-1]):null};
    }
    function clear(){events.splice(0,events.length);}
    return Object.freeze({version:VERSION,emit,recordRoute,events:()=>clone(events),summary,clear});
  }

  window.TDBayEngineTelemetry={version:VERSION,create};
})();
