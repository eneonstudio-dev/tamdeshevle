(()=>{
  "use strict";
  if(window.__TDRoxyRuntimeStatesV1)return;
  window.__TDRoxyRuntimeStatesV1=true;

  const ASSETS={
    empty:"assets/bai/bai-curious-approved-v1.webp",
    loading:"assets/bai/bai-checking-approved-v1.webp",
    error:"assets/bai/bai-suspicious-approved-v1.webp",
    offline:"assets/bai/bai-sleeping-approved-v1.webp"
  };
  const LABELS={empty:"Готов включиться",loading:"Проверяю",error:"Спокойно, поправим",offline:"Жду сеть"};
  let root=null,observer=null,frame=0,wrapped=false;

  function ensureStyle(){
    if(!document.querySelector('link[data-roxy-runtime-states-v1="1"]')){
      const link=document.createElement("link");
      link.rel="stylesheet";
      link.href="votonobay-roxy-runtime-states-v1.css?v=20260913-v1";
      link.dataset.roxyRuntimeStatesV1="1";
      document.head.appendChild(link);
    }
    if(!document.querySelector('style[data-roxy-runtime-reduced-motion-v1="1"]')){
      const guard=document.createElement("style");
      guard.dataset.roxyRuntimeReducedMotionV1="1";
      guard.textContent=`@media(prefers-reduced-motion:reduce){
        body>.td-ai[data-roxy-runtime-state] .roxy-runtime-state-visual img,
        body>.td-ai[data-roxy-runtime-state] .roxy-runtime-state-visual:before,
        body>.td-ai[data-roxy-runtime-state] .roxy-runtime-state-progress span{
          animation:none!important;
          transform:none!important;
        }
      }`;
      document.head.appendChild(guard);
    }
  }

  function stateCard(){return root?.querySelector(".td-ai-state-card")||null}
  function mode(){return root?.dataset.baiRuntimeState||stateCard()?.dataset.state||"normal"}
  function approvedAsset(name){return ASSETS[name]||""}

  function ensureVisual(card,name){
    let visual=card.querySelector(".roxy-runtime-state-visual");
    if(!visual){
      visual=document.createElement("div");
      visual.className="roxy-runtime-state-visual";
      visual.setAttribute("aria-hidden","true");
      visual.innerHTML=`<span class="roxy-runtime-state-glow"></span><img alt="" draggable="false"><em></em>`;
      card.prepend(visual);
    }
    visual.dataset.state=name;
    const img=visual.querySelector("img"),src=approvedAsset(name);
    if(img&&src&&!img.getAttribute("src")?.endsWith(src))img.src=src;
    const label=visual.querySelector("em");
    if(label)label.textContent=LABELS[name]||"";
    return visual;
  }

  function syncPanelPortrait(name){
    const src=approvedAsset(name);
    if(!src||!root)return;
    const portrait=root.querySelector("[data-ai-bai]");
    if(portrait&&!portrait.getAttribute("src")?.endsWith(src))portrait.src=src;
    if(portrait)portrait.dataset.roxyRuntimePortrait=name;
    const avatar=root.querySelector(".roxy-bay-head-avatar");
    if(avatar&&!avatar.getAttribute("src")?.endsWith(src))avatar.src=src;
    if(avatar)avatar.dataset.roxyRuntimePortrait=name;
  }

  function addProgress(card,name){
    let progress=card.querySelector(".roxy-runtime-state-progress");
    if(name!=="loading"){
      progress?.remove();
      return;
    }
    if(progress)return;
    progress=document.createElement("div");
    progress.className="roxy-runtime-state-progress";
    progress.setAttribute("aria-hidden","true");
    progress.innerHTML="<span></span>";
    const dots=card.querySelector(":scope>i");
    (dots||card.lastElementChild)?.insertAdjacentElement("afterend",progress);
  }

  function decorate(){
    frame=0;
    if(!root?.isConnected)return false;
    ensureStyle();
    const card=stateCard();
    const name=mode();
    root.dataset.roxyRuntimeState=name;
    if(!card||card.hidden||name==="normal"){
      if(card)card.querySelector(".roxy-runtime-state-visual")?.remove();
      card?.querySelector(".roxy-runtime-state-progress")?.remove();
      return false;
    }
    card.dataset.roxyRuntimeVisual="1";
    ensureVisual(card,name);
    addProgress(card,name);
    syncPanelPortrait(name);
    return true;
  }

  function queue(){
    cancelAnimationFrame(frame);
    frame=requestAnimationFrame(decorate);
  }

  function attach(next){
    if(next===root)return queue();
    observer?.disconnect?.();
    observer=null;
    root=next||null;
    if(!root)return false;
    observer=new MutationObserver(queue);
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["data-bai-runtime-state","data-state","hidden","data-bai-busy"]});
    queue();
    return true;
  }

  function wrapOpen(){
    const api=window.TDShoppingAssistant;
    if(!api||typeof api.open!=="function"||api.open.__roxyRuntimeWrapped)return false;
    const original=api.open;
    const wrappedOpen=function(...args){
      const result=original.apply(api,args);
      requestAnimationFrame(discover);
      Promise.resolve(result).finally(()=>requestAnimationFrame(discover));
      return result;
    };
    wrappedOpen.__roxyRuntimeWrapped=true;
    wrappedOpen.__roxyRuntimeOriginal=original;
    api.open=wrappedOpen;
    wrapped=true;
    return true;
  }

  function discover(){
    ensureStyle();
    wrapOpen();
    return attach(document.querySelector("body>.td-ai"));
  }

  function boot(){
    discover();
    window.addEventListener("pageshow",discover);
    window.addEventListener("td:v2-rendered",discover);
    document.addEventListener("click",event=>{
      if(!event.target.closest?.(".v2-bay-primary,.v2-hero-bai,.td-ai-entry,[data-action='basket']"))return;
      requestAnimationFrame(discover);
      setTimeout(discover,80);
    },{passive:true});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();

  window.TDRoxyRuntimeStatesV1={decorate,discover,mode,assets:{...ASSETS},isWrapped:()=>wrapped};
})();