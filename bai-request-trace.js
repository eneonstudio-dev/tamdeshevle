(()=>{
  "use strict";
  if(window.TDBaiRequestTrace)return;
  const TRACE_RE=/^bai_[a-z0-9-]{8,80}$/i;
  const valid=value=>TRACE_RE.test(String(value||""));
  const base=String(window.TD_BAI_AGENT?.endpoint||"").split("?")[0].replace(/\/$/,"");
  function current(){const value=window.TDBaiTraceContext?.current?.();return valid(value)?String(value):null}
  function endpoint(){const id=current();return base&&id?`${base}?trace_id=${encodeURIComponent(id)}`:base}
  function withTrace(payload){const id=current();return payload&&typeof payload==="object"&&!Array.isArray(payload)&&id?{...payload,trace_id:id}:payload}
  if(base&&window.TD_BAI_AGENT){try{Object.defineProperty(window.TD_BAI_AGENT,"endpoint",{configurable:true,enumerable:true,get:endpoint})}catch{}}
  window.TDBaiRequestTrace={valid,current,endpoint,withTrace,base};
})();
