(()=>{
  "use strict";
  if(window.TDBaiIdempotencyGuard)return;

  const VERSION=1,MAX_ENTRIES=24,TTL_MS=5*60*1000,ID_RE=/^(?:bai|exec)_[a-z0-9-]{8,80}$/i;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validId=value=>ID_RE.test(String(value||""));
  const now=()=>Date.now();
  const hash=value=>{
    const text=JSON.stringify(value),parts=[...text].reduce((out,char,index)=>{out[index%4]=(out[index%4]*33+char.charCodeAt(0))>>>0;return out},[5381,52711,31,7]);
    return parts.map(value=>value.toString(16).padStart(8,"0")).join("");
  };
  let retries=0;

  function executionId(explicit){
    if(validId(explicit))return String(explicit);
    const trace=window.TDBaiTraceContext?.current?.();
    return validId(trace)?String(trace):null;
  }
  function ledger(kernel){
    const state=kernel?.state?.get?.()||{},entries=Array.isArray(state.idempotency_log)?state.idempotency_log:[],cutoff=now()-TTL_MS;
    return entries.filter(entry=>entry&&validId(entry.execution_id)&&Number(entry.at)>=cutoff).slice(-MAX_ENTRIES);
  }
  function persist(kernel,entry){
    const state=kernel?.state?.get?.();if(!state)return false;
    const entries=ledger(kernel).filter(item=>!(item.execution_id===entry.execution_id&&item.fingerprint===entry.fingerprint));
    state.idempotency_log=[...entries,entry].slice(-MAX_ENTRIES);
    kernel.state.save(state);return true;
  }
  function replay(kernel,entry){
    window.TDBaiObservability?.emit?.("idempotency_replay",{stage:"execute",status:"VERIFIED",code:"DUPLICATE_EXECUTION"});
    return{ok:true,status:"VERIFIED",actions:clone(entry.actions||[]),state:kernel.state.get(),verification:{ok:true,idempotent:true},message:"Это действие уже применено — повторно корзину не меняю.",provider_actions_executed:false,idempotent_replay:true,execution_id:entry.execution_id};
  }
  function fingerprint(kind,payload){return hash({kind,payload})}
  function findReplay(kernel,id,fp){return id?ledger(kernel).find(entry=>entry.execution_id===id&&entry.fingerprint===fp&&entry.status==="VERIFIED")||null:null}
  function remember(kernel,id,fp,result){
    if(!id||!result?.ok||result?.status!=="VERIFIED"||result?.provider_actions_executed!==true)return result;
    persist(kernel,{execution_id:id,fingerprint:fp,status:"VERIFIED",at:now(),actions:clone(result.actions||[])});
    return{...result,execution_id:id,idempotent_replay:false};
  }

  function wrapKernel(){
    const kernel=window.TDBaiShoppingAgentKernel;if(!kernel||kernel.__tdBaiIdempotencyWrapped)return Boolean(kernel?.__tdBaiIdempotencyWrapped);
    const originalRun=typeof kernel.run==="function"?kernel.run.bind(kernel):null;
    const originalExecute=typeof kernel.execute==="function"?kernel.execute.bind(kernel):null;
    if(originalRun)kernel.run=async function(input={}){
      const id=executionId(input?.execution_id),fp=fingerprint("run",{text:String(input?.text||"").trim().slice(0,500),operations:Array.isArray(input?.operations)?input.operations:[]});
      const prior=findReplay(kernel,id,fp);if(prior)return replay(kernel,prior);
      return remember(kernel,id,fp,await originalRun(input));
    };
    if(originalExecute)kernel.execute=function(actions,options={}){
      const id=executionId(options?.execution_id),fp=fingerprint("execute",Array.isArray(actions)?actions:[]);
      const prior=findReplay(kernel,id,fp);if(prior)return replay(kernel,prior);
      return remember(kernel,id,fp,originalExecute(actions,options));
    };
    try{Object.defineProperty(kernel,"__tdBaiIdempotencyWrapped",{value:true,configurable:true})}catch{kernel.__tdBaiIdempotencyWrapped=true}
    return true;
  }
  function install(){const installed=wrapKernel();if(!installed&&retries<20){retries++;setTimeout(install,100)}return installed}
  function status(){const kernel=window.TDBaiShoppingAgentKernel;return{version:VERSION,installed:Boolean(kernel?.__tdBaiIdempotencyWrapped),entries:kernel?ledger(kernel).length:0,ttl_ms:TTL_MS}}

  window.TDBaiIdempotencyGuard={version:VERSION,install,status,_test:{executionId,fingerprint,ledger}};
  install();
})();
