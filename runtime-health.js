(()=>{
  "use strict";
  const seen=new Set();
  const report=(kind,message,source)=>{
    const text=String(message||"Неизвестная ошибка");
    const key=`${kind}|${text}|${source||""}`;
    if(seen.has(key))return;
    seen.add(key);
    console.warn(`[TD Runtime] ${kind}: ${text}${source?` · ${source}`:""}`);
  };
  window.addEventListener("error",e=>report("error",e.message,e.filename));
  window.addEventListener("unhandledrejection",e=>report("promise",e.reason?.message||e.reason||"Unhandled rejection"));
  window.TDRuntimeHealth={report};
})();