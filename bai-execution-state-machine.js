(()=>{
  "use strict";
  if(window.TDBaiExecutionStateMachine)return;

  const VERSION=1,MAX_TX=12,TTL_MS=15*60*1000,ID_RE=/^(?:bai|exec)_[a-z0-9-]{8,80}$/i;
  const MUTATING=new Set(["add_item","remove_item","replace_item","change_quantity","set_constraint","rebuild_basket","optimize_basket"]);
  const TERMINAL=new Set(["VERIFIED","ROLLED_BACK"]);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const now=()=>Date.now();
  const hash=value=>{const text=JSON.stringify(value),parts=[...text].reduce((out,char,index)=>{out[index%4]=(out[index%4]*33+char.charCodeAt(0))>>>0;return out},[5381,52711,31,7]);return parts.map(value=>value.toString(16).padStart(8,"0")).join("")};
  const validId=value=>ID_RE.test(String(value||""));
  let retries=0;

  function executionId(explicit){
    if(validId(explicit))return String(explicit);
    const trace=window.TDBaiTraceContext?.current?.();
    if(validId(trace))return String(trace);
    const suffix=globalThis.crypto?.randomUUID?.().replace(/-/g,"").slice(0,16)||`${Date.now().toString(36)}${Math.random().toString(36).slice(2,10)}`;
    return `exec_${suffix}`;
  }
  function key(kind,id,payload){return `${id}:${hash({kind,payload})}`}
  function ledger(kernel){
    const state=kernel?.state?.get?.()||{},entries=Array.isArray(state.execution_transactions)?state.execution_transactions:[],cutoff=now()-TTL_MS;
    return entries.filter(entry=>entry&&typeof entry.key==="string"&&Number(entry.at)>=cutoff).slice(-MAX_TX);
  }
  function persist(kernel,entry){
    const state=kernel?.state?.get?.();if(!state)return false;
    const entries=ledger(kernel).filter(item=>item.key!==entry.key);
    state.execution_transactions=[...entries,entry].slice(-MAX_TX);kernel.state.save(state);return true;
  }
  function transaction(kernel,txKey){return ledger(kernel).find(entry=>entry.key===txKey)||null}
  function transition(kernel,txKey,status,patch={}){
    const previous=transaction(kernel,txKey)||{key:txKey,states:[]};
    const entry={...previous,...clone(patch),status,states:[...(previous.states||[]),status].slice(-8),at:now()};
    if(TERMINAL.has(status))delete entry.before_legacy;
    persist(kernel,entry);
    window.TDBaiObservability?.emit?.("execution_state",{stage:"execute",status,code:String(patch.code||"")});
    return entry;
  }
  function legacyState(){try{return clone(window.TDShoppingState?.get?.()||{})}catch{return{}}}
  function restoreLegacy(before){
    if(!before||typeof before!=="object")return false;
    try{
      const target=window.TDShoppingState?.get?.();if(!target)return false;
      for(const key of Object.keys(target))delete target[key];Object.assign(target,clone(before));
      window.TDShoppingState?.save?.();window.TDShoppingState?.syncCart?.();window.render?.();return true;
    }catch{return false}
  }
  function validateActions(kernel,actions){
    const current=window.TDShoppingState?.get?.()||null;
    for(const action of Array.isArray(actions)?actions:[]){const checked=kernel.validateAction?.(clone(action),current);if(!checked?.ok)return checked}
    return{ok:true};
  }
  function proposedForRun(kernel,input){
    const gate=kernel.domainGate?.(input?.text);if(gate&&gate.allowed===false)return{ok:false,skip:true};
    const proposal=kernel.propose?.(input?.text,Array.isArray(input?.operations)?input.operations:[]);return proposal?.ok?proposal:{ok:false,skip:true};
  }
  function begin(kernel,kind,id,payload,actions){
    const txKey=key(kind,id,payload),prior=transaction(kernel,txKey);
    if(prior?.status==="VERIFIED")return{txKey,prior,alreadyVerified:true};
    const before=legacyState(),actionTypes=(actions||[]).map(item=>String(item?.type||"")).filter(Boolean);
    transition(kernel,txKey,"PROPOSED",{execution_id:id,kind,action_types:actionTypes,before_hash:hash(before),before_legacy:before});
    const valid=validateActions(kernel,actions);
    if(!valid.ok){transition(kernel,txKey,"ROLLED_BACK",{execution_id:id,kind,action_types:actionTypes,code:valid?.error?.code||"VALIDATION_FAILED",executed:false});return{txKey,valid,blocked:true}}
    transition(kernel,txKey,"VALIDATED",{execution_id:id,kind,action_types:actionTypes,before_legacy:before});
    transition(kernel,txKey,"EXECUTING",{execution_id:id,kind,action_types:actionTypes,before_legacy:before});
    return{txKey,before};
  }
  function finish(kernel,ctx,result){
    if(!ctx?.txKey)return result;
    if(result?.ok&&result?.status==="VERIFIED"){
      transition(kernel,ctx.txKey,"VERIFIED",{execution_id:result.execution_id||ctx.execution_id,code:result.idempotent_replay?"IDEMPOTENT_REPLAY":"",replay:Boolean(result.idempotent_replay),after_hash:hash(legacyState())});
      return result;
    }
    if(ctx.before)restoreLegacy(ctx.before);
    transition(kernel,ctx.txKey,"ROLLED_BACK",{execution_id:ctx.execution_id,code:result?.error?.code||"EXECUTION_FAILED",executed:true});
    return result;
  }
  function recoverIncomplete(kernel){
    const pending=ledger(kernel).filter(entry=>!TERMINAL.has(entry.status));if(!pending.length)return 0;
    const latest=pending[pending.length-1];if(latest.before_legacy)restoreLegacy(latest.before_legacy);
    for(const entry of pending)transition(kernel,entry.key,"ROLLED_BACK",{execution_id:entry.execution_id,kind:entry.kind,code:"RECOVERED_INCOMPLETE_EXECUTION",recovered:true,executed:entry.status==="EXECUTING"});
    return pending.length;
  }
  function wrapKernel(){
    const kernel=window.TDBaiShoppingAgentKernel;if(!kernel||kernel.__tdBaiExecutionStateWrapped)return Boolean(kernel?.__tdBaiExecutionStateWrapped);
    recoverIncomplete(kernel);
    const originalRun=typeof kernel.run==="function"?kernel.run.bind(kernel):null,originalExecute=typeof kernel.execute==="function"?kernel.execute.bind(kernel):null;
    if(originalRun)kernel.run=async function(input={}){
      const proposed=proposedForRun(kernel,input);if(!proposed.ok)return originalRun(input);
      const id=executionId(input?.execution_id),payload={text:String(input?.text||"").trim().slice(0,500),operations:Array.isArray(input?.operations)?input.operations:[]};
      const ctx=begin(kernel,"run",id,payload,proposed.actions);ctx.execution_id=id;
      if(ctx.alreadyVerified)return originalRun({...input,execution_id:id});
      if(ctx.blocked){const result=await originalRun({...input,execution_id:id});return finish(kernel,ctx,result)}
      try{return finish(kernel,ctx,await originalRun({...input,execution_id:id}))}catch(error){if(ctx.before)restoreLegacy(ctx.before);transition(kernel,ctx.txKey,"ROLLED_BACK",{execution_id:id,code:String(error?.name||"THREW"),executed:true});throw error}
    };
    if(originalExecute)kernel.execute=function(actions,options={}){
      const list=Array.isArray(actions)?actions:[],id=executionId(options?.execution_id),ctx=begin(kernel,"execute",id,list,list);ctx.execution_id=id;
      if(ctx.alreadyVerified)return originalExecute(list,{...options,execution_id:id});
      if(ctx.blocked){const result=originalExecute(list,{...options,execution_id:id});return finish(kernel,ctx,result)}
      try{return finish(kernel,ctx,originalExecute(list,{...options,execution_id:id}))}catch(error){if(ctx.before)restoreLegacy(ctx.before);transition(kernel,ctx.txKey,"ROLLED_BACK",{execution_id:id,code:String(error?.name||"THREW"),executed:true});throw error}
    };
    try{Object.defineProperty(kernel,"__tdBaiExecutionStateWrapped",{value:true,configurable:true})}catch{kernel.__tdBaiExecutionStateWrapped=true}
    return true;
  }
  function install(){const installed=wrapKernel();if(!installed&&retries<20){retries++;setTimeout(install,100)}return installed}
  function status(){const kernel=window.TDBaiShoppingAgentKernel,entries=kernel?ledger(kernel):[];return{version:VERSION,installed:Boolean(kernel?.__tdBaiExecutionStateWrapped),transactions:entries.length,pending:entries.filter(entry=>!TERMINAL.has(entry.status)).length,last:entries.length?clone(entries[entries.length-1]):null}}

  window.TDBaiExecutionStateMachine={version:VERSION,install,status,_test:{executionId,key,ledger,recoverIncomplete,restoreLegacy}};
  install();
})();
