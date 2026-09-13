(()=>{
  "use strict";
  if(window.TDBaiTraceContext)return;

  const VERSION=1,TTL_MS=15000,TRACE_RE=/^bai_[a-z0-9-]{8,80}$/i;
  let active=null,last=null,lastAt=0,seq=0,retries=0,telemetryBound=false;
  const now=()=>Date.now();
  const valid=value=>TRACE_RE.test(String(value||""));
  function create(){
    let id="";
    try{id=globalThis.crypto?.randomUUID?.()||""}catch{}
    if(!id)id=`${now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    return `bai_${id}`;
  }
  function begin(preferred){active=valid(preferred)?String(preferred):create();last=active;lastAt=now();return active}
  function current(){if(active)return active;if(last&&now()-lastAt<=TTL_MS)return last;return null}
  function ensure(){return current()||begin()}
  function end(id){if(active===id)active=null;last=id||last;lastAt=now();return last}
  function attach(value,id){return value&&typeof value==="object"&&!Array.isArray(value)?{...value,trace_id:id}:value}

  function wrapBrain(){
    const brain=window.TDBaiBrain;if(!brain?.route||brain.__tdBaiTraceWrapped)return Boolean(brain?.__tdBaiTraceWrapped);
    const original=brain.route.bind(brain);
    brain.route=async function(...args){const id=begin();try{return attach(await original(...args),id)}finally{end(id)}};
    try{Object.defineProperty(brain,"__tdBaiTraceWrapped",{value:true,configurable:true})}catch{brain.__tdBaiTraceWrapped=true}
    return true;
  }

  function wrapKernel(){
    const kernel=window.TDBaiShoppingAgentKernel;if(!kernel||kernel.__tdBaiTraceWrapped)return Boolean(kernel?.__tdBaiTraceWrapped);
    const originalRun=typeof kernel.run==="function"?kernel.run.bind(kernel):null;
    const originalExecute=typeof kernel.execute==="function"?kernel.execute.bind(kernel):null;
    if(originalRun)kernel.run=async function(...args){const existing=current(),id=existing||begin();try{return attach(await originalRun(...args),id)}finally{if(!existing)end(id)}};
    if(originalExecute)kernel.execute=function(...args){const existing=current(),id=existing||begin();try{return attach(originalExecute(...args),id)}finally{if(!existing)end(id)}};
    try{Object.defineProperty(kernel,"__tdBaiTraceWrapped",{value:true,configurable:true})}catch{kernel.__tdBaiTraceWrapped=true}
    return true;
  }

  function bindTelemetry(){
    if(telemetryBound)return true;telemetryBound=true;
    window.addEventListener("td:bai-telemetry",event=>{
      const id=current(),detail=event?.detail;
      if(id&&detail&&typeof detail==="object"&&!Array.isArray(detail)&&!detail.trace_id)detail.trace_id=id;
    });
    return true;
  }

  function install(){
    const result={brain:wrapBrain(),kernel:wrapKernel(),telemetry:bindTelemetry()};
    if((!result.brain||!result.kernel)&&retries<20){retries++;setTimeout(install,100)}
    return result;
  }
  function status(){return{version:VERSION,active,current:current(),last,lastAt,ttl_ms:TTL_MS,retries}}
  window.TDBaiTraceContext={version:VERSION,begin,current,ensure,end,status,install};
  install();
})();
