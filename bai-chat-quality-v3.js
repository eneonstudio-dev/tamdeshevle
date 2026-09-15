(()=>{
  "use strict";
  if(window.TDBaiChatQualityV3)return;

  let obsLoad=null,observer=null,lastRoute=null,lastKernel=null,annotating=false;
  const text=(value,max=800)=>String(value==null?"":value).replace(/\s+/g," ").trim().slice(0,max);

  function ensureStyles(){
    if(document.querySelector('link[data-bai-chat-quality-v3]'))return;
    const link=document.createElement("link");link.rel="stylesheet";link.href="bai-chat-quality-v3.css?v=20260915-v1";link.dataset.baiChatQualityV3="1";document.head.appendChild(link);
  }

  async function observability(){
    if(window.TDBaiObservability?.version>=2)return window.TDBaiObservability;
    obsLoad=obsLoad||import("./bai-observability.js?v=20260915-chat-quality-v2").catch(error=>{console.warn("[Bai Chat Quality] observability load failed",error);return null});
    await obsLoad;
    window.TDBaiObservability?.install?.();
    return window.TDBaiObservability||null;
  }

  function recentKernel(api){
    const events=api?.events?.()||[],now=Date.now();
    for(let i=events.length-1;i>=0;i--){
      const event=events[i];if(event?.type!=="kernel")continue;
      const at=Date.parse(event.at||"");if(Number.isFinite(at)&&now-at<=15000)return event;
    }
    return null;
  }

  function providerStatus(api){
    const status=window.TDBaiAgentClient?.status?.()||{};
    const provider=text(lastRoute?.provider||status.provider||"rules",48)||"rules";
    const reason=text(lastRoute?.reason||status.reason||"",80);
    return{provider,reason,label:api?.providerLabel?.(provider)||provider.toUpperCase()};
  }

  function latestExchange(container){
    const nodes=[...container.querySelectorAll(":scope > .td-ai-msg")];
    if(!nodes.length)return null;
    const assistant=nodes[nodes.length-1];
    if(!assistant.classList.contains("assistant"))return null;
    let user=null;
    for(let i=nodes.length-2;i>=0;i--){if(nodes[i].classList.contains("user")){user=nodes[i];break}}
    if(!user)return null;
    return{assistant,user,request:text(user.textContent,500),reply:text(assistant.dataset.baiRawReply||assistant.textContent,800)};
  }

  async function annotateLatest(){
    if(annotating)return;annotating=true;
    try{
      const api=await observability();if(!api?.debugEnabled?.())return;
      ensureStyles();
      const container=document.querySelector(".td-ai-messages");if(!container)return;
      const exchange=latestExchange(container);if(!exchange||exchange.assistant.querySelector("[data-bai-quality-meta]"))return;
      exchange.assistant.dataset.baiRawReply=exchange.reply;
      const status=providerStatus(api),kernel=lastKernel||recentKernel(api);
      const meta=document.createElement("div");meta.className="td-ai-quality-meta";meta.setAttribute("data-bai-quality-meta","1");
      const badge=document.createElement("span");badge.className="td-ai-brain-badge";badge.textContent=`Мозг: ${status.label}`;badge.title=status.reason?`provider=${status.provider} · ${status.reason}`:`provider=${status.provider}`;
      const bad=document.createElement("button");bad.type="button";bad.className="td-ai-bad-response";bad.textContent="Не то";bad.setAttribute("aria-label","Сохранить этот ответ как локальный regression-кейс");
      bad.onclick=()=>{
        if(bad.disabled)return;
        const saved=api.captureFailure?.({request:exchange.request,reply:exchange.reply,provider:status.provider,reason:status.reason,operations:kernel?.actions||[],state:window.TDShoppingState?.get?.()||{}});
        if(saved){bad.disabled=true;bad.textContent="Сохранено локально";meta.dataset.saved="1";}
        else{bad.textContent="Не сохранилось";}
      };
      meta.append(badge,bad);exchange.assistant.appendChild(meta);
    }finally{annotating=false;}
  }

  function schedule(){queueMicrotask(()=>void annotateLatest())}
  function installObserver(){
    if(observer||typeof MutationObserver!=="function")return;
    observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==="childList"||m.type==="subtree"))schedule()});
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  window.addEventListener("td:bai-telemetry",event=>{
    const detail=event.detail||{};
    if(detail.type==="provider_route")lastRoute=detail;
    if(detail.type==="kernel")lastKernel=detail;
    schedule();
  });
  window.addEventListener("td:bai-debug-change",schedule);

  window.TDBaiChatQualityV3={
    version:"v3-observability-1",
    refresh:schedule,
    enableDebug:async()=>{const api=await observability();const enabled=api?.setDebug?.(true);ensureStyles();window.dispatchEvent(new CustomEvent("td:bai-debug-change"));return enabled;},
    disableDebug:async()=>{const api=await observability();const enabled=api?.setDebug?.(false);document.querySelectorAll("[data-bai-quality-meta]").forEach(node=>node.remove());return enabled;},
    exportFailures:async()=>{const api=await observability();return api?.exportFailures?.()||"";},
    failures:async()=>{const api=await observability();return api?.listFailures?.()||[];}
  };

  installObserver();
  void observability().then(api=>{api?.install?.();if(api?.debugEnabled?.())ensureStyles();schedule()});
})();
