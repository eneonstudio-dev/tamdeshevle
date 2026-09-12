(()=>{
  "use strict";
  if(window.__TDVotonobayPurchaseLifecycleV1)return;
  window.__TDVotonobayPurchaseLifecycleV1=true;

  let observing=false;
  const observer=new MutationObserver(records=>{
    const api=window.TDPurchaseExperienceV1;
    if(!api?.hydrate)return;
    for(const record of records){
      for(const node of record.addedNodes){
        if(node instanceof Element)api.hydrate(node);
      }
    }
  });

  function start(){
    if(observing)return;
    const root=document.documentElement;
    if(!root)return;
    observer.observe(root,{childList:true,subtree:true});
    observing=true;
    window.TDPurchaseExperienceV1?.hydrate?.();
  }

  function stop(){
    observer.disconnect();
    observing=false;
  }

  window.addEventListener("pagehide",stop);
  window.addEventListener("pageshow",start);
  document.addEventListener("visibilitychange",()=>{
    if(document.hidden)return;
    start();
    window.TDPurchaseExperienceV1?.hydrate?.();
  });

  start();
  window.TDPurchaseExperienceLifecycleV1={start,stop,get observing(){return observing}};
})();
