(()=>{
  "use strict";
  if(window.TDBaiObservability)return;

  const VERSION=1,MAX_EVENTS=100,events=[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const text=(value,max=64)=>String(value==null?"":value).replace(/\s+/g," ").trim().slice(0,max);
  const number=value=>Number.isFinite(Number(value))?Math.max(0,Math.round(Number(value))):undefined;
  const boolean=value=>typeof value==="boolean"?value:undefined;

  function sanitize(detail={}){
    const input=detail&&typeof detail==="object"&&!Array.isArray(detail)?detail:{};
    const out={};
    for(const key of ["stage","provider","action","code","status","reason","source"]){
      const value=text(input[key]);if(value)out[key]=value;
    }
    for(const key of ["duration_ms","failures","operation_count"]){const value=number(input[key]);if(value!==undefined)out[key]=value;}
    for(const key of ["recoverable","breaker_open","used","attempted"]){const value=boolean(input[key]);if(value!==undefined)out[key]=value;}
    if(Array.isArray(input.actions))out.actions=input.actions.map(value=>text(value,48)).filter(Boolean).slice(0,12);
    return out;
  }

  function emit(type,detail={}){
    const event={version:VERSION,type:text(type,48)||"unknown",at:new Date().toISOString(),...sanitize(detail)};
    events.push(event);if(events.length>MAX_EVENTS)events.splice(0,events.length-MAX_EVENTS);
    try{window.dispatchEvent(new CustomEvent("td:bai-telemetry",{detail:clone(event)}));}catch{}
    return clone(event);
  }

  function kernelOutcome(stage,result,startedAt,actions=[]){
    const error=result?.error||{};
    return emit("kernel",{
      stage,status:result?.status||(result?.ok===false?"ERROR":"OK"),code:error.code||result?.gate?.code||"",recoverable:error.recoverable,
      duration_ms:Date.now()-startedAt,operation_count:Array.isArray(actions)?actions.length:0,
      actions:(Array.isArray(actions)?actions:result?.actions||[]).map(item=>typeof item==="string"?item:item?.type)
    });
  }

  function wrapKernel(){
    const kernel=window.TDBaiShoppingAgentKernel;if(!kernel||kernel.__tdObservabilityWrapped)return false;
    const originalRun=typeof kernel.run==="function"?kernel.run.bind(kernel):null;
    const originalExecute=typeof kernel.execute==="function"?kernel.execute.bind(kernel):null;
    if(originalRun)kernel.run=async function(input){const started=Date.now();try{const result=await originalRun(input);kernelOutcome("run",result,started,result?.actions);return result}catch(error){emit("kernel",{stage:"run",status:"THREW",code:text(error?.name)||"ERROR",duration_ms:Date.now()-started});throw error}};
    if(originalExecute)kernel.execute=function(actions,options){const started=Date.now();try{const result=originalExecute(actions,options);kernelOutcome("execute",result,started,actions);return result}catch(error){emit("kernel",{stage:"execute",status:"THREW",code:text(error?.name)||"ERROR",duration_ms:Date.now()-started,operation_count:Array.isArray(actions)?actions.length:0,actions:(actions||[]).map(item=>item?.type)});throw error}};
    try{Object.defineProperty(kernel,"__tdObservabilityWrapped",{value:true,configurable:true});}catch{kernel.__tdObservabilityWrapped=true;}
    return true;
  }

  function providerDetail(status={}){
    const remote=status?.breakers?.remote||{},local=status?.breakers?.local||{},provider=text(status?.provider||"rules");
    const breaker=provider==="gemma-browser"?local:remote;
    return{provider,reason:status?.reason,attempted:status?.attempted,used:status?.used,failures:breaker?.failures,breaker_open:Number(breaker?.openUntil||0)>Date.now()};
  }

  function wrapBrain(){
    const brain=window.TDBaiBrain;if(!brain?.route||brain.__tdObservabilityWrapped)return false;
    const original=brain.route.bind(brain);
    brain.route=async function(...args){
      const started=Date.now();
      try{
        const result=await original(...args),status=window.TDBaiAgentClient?.status?.()||{};
        emit("provider_route",{stage:"route",status:result?.status||(result?.ok===false?"ERROR":"OK"),code:result?.agentError?.code||result?.error?.code||"",duration_ms:Date.now()-started,...providerDetail(status)});
        return result;
      }catch(error){
        const status=window.TDBaiAgentClient?.status?.()||{};
        emit("provider_route",{stage:"route",status:"THREW",code:text(error?.name)||"ERROR",duration_ms:Date.now()-started,...providerDetail(status)});throw error;
      }
    };
    try{Object.defineProperty(brain,"__tdObservabilityWrapped",{value:true,configurable:true});}catch{brain.__tdObservabilityWrapped=true;}
    return true;
  }

  function summary(){
    const byType={},byCode={},byProvider={};
    for(const event of events){byType[event.type]=(byType[event.type]||0)+1;if(event.code)byCode[event.code]=(byCode[event.code]||0)+1;if(event.provider)byProvider[event.provider]=(byProvider[event.provider]||0)+1;}
    return{version:VERSION,count:events.length,byType,byCode,byProvider,last:events.length?clone(events[events.length-1]):null};
  }
  function clear(){events.splice(0,events.length);}
  function install(){return{kernel:wrapKernel(),brain:wrapBrain()};}

  window.TDBaiObservability={version:VERSION,emit,events:()=>clone(events),summary,clear,install};
  install();
})();
