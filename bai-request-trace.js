(()=>{
  "use strict";
  const TRACE_RE=/^bai_[a-z0-9-]{8,80}$/i;
  const valid=value=>TRACE_RE.test(String(value||""));
  function current(){const value=window.TDBaiTraceContext?.current?.();return valid(value)?String(value):null}
  function withTrace(payload){const id=current();return payload&&typeof payload==="object"&&!Array.isArray(payload)&&id?{...payload,trace_id:id}:payload}
  window.TDBaiRequestTrace={valid,current,withTrace};
})();
