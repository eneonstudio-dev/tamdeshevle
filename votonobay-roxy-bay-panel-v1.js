(()=>{
  "use strict";

  let wrapped=false;
  const HEAD_POSES={
    idle:"assets/bai/bai-idle-approved-v1.webp",
    greeting:"assets/bai/bai-peek-approved.webp",
    peek:"assets/bai/bai-peek-approved.webp",
    curious:"assets/bai/bai-curious-approved-v1.webp",
    thinking:"assets/bai/bai-curious-approved-v1.webp",
    checking:"assets/bai/bai-checking-approved-v1.webp",
    suspicious:"assets/bai/bai-suspicious-approved-v1.webp",
    confused:"assets/bai/bai-suspicious-approved-v1.webp",
    scared:"assets/bai/bai-suspicious-approved-v1.webp",
    happy:"assets/bai/bai-happy-approved-v1.webp",
    excited:"assets/bai/bai-happy-approved-v1.webp",
    "big-saving":"assets/bai/bai-happy-approved-v1.webp",
    playful:"assets/bai/bai-happy-approved-v1.webp",
    sleepy:"assets/bai/bai-sleeping-approved-v1.webp",
    sleeping:"assets/bai/bai-sleeping-approved-v1.webp"
  };

  function ensureStyles(){
    if(!document.querySelector('link[data-roxy-bay-panel-style="1"]')){
      const link=document.createElement("link");
      link.rel="stylesheet";
      link.href="votonobay-roxy-bay-panel-v1.css?v=20260913-v1";
      link.dataset.roxyBayPanelStyle="1";
      document.head.appendChild(link);
    }
    if(!document.querySelector('link[data-roxy-bay-panel-tune="1"]')){
      const tune=document.createElement("link");
      tune.rel="stylesheet";
      tune.href="votonobay-roxy-bay-panel-tune-v1.css?v=20260915-v2";
      tune.dataset.roxyBayPanelTune="1";
      document.head.appendChild(tune);
    }
  }

  function isTouchLayout(){
    return window.matchMedia?.("(max-width:820px), (hover:none) and (pointer:coarse) and (max-width:1100px)")?.matches;
  }

  function syncExpandControls(root,expanded){
    root?.querySelectorAll(".roxy-bay-sheet-toggle,.roxy-bay-sheet-handle").forEach(control=>{
      control.setAttribute("aria-expanded",expanded?"true":"false");
      control.setAttribute("aria-label",expanded?"Свернуть Бая":"Развернуть Бая");
    });
  }

  function setExpanded(root,expanded){
    if(!root)return;
    root.dataset.roxyBayExpanded=expanded?"1":"0";
    syncExpandControls(root,expanded);
  }

  function currentState(){return document.getElementById("bai-assistant")?.dataset.state||"idle";}
  function syncHeadAvatar(state=currentState()){
    const avatar=document.querySelector("body>.td-ai .roxy-bay-head-avatar");
    if(!avatar)return;
    const src=HEAD_POSES[state]||HEAD_POSES.idle;
    if(!avatar.getAttribute("src")?.endsWith(src))avatar.src=src;
    avatar.dataset.bayMood=state;
  }

  function decorate(){
    ensureStyles();
    const root=document.querySelector("body>.td-ai");
    if(!root)return false;
    root.dataset.roxyBayPanel="1";
    if(!root.dataset.roxyBayExpanded)setExpanded(root,false);

    const shell=root.querySelector(".td-ai-shell");
    if(shell&&!shell.querySelector(".roxy-bay-sheet-handle")){
      const handle=document.createElement("button");
      handle.type="button";
      handle.className="roxy-bay-sheet-handle";
      handle.innerHTML='<span aria-hidden="true"></span>';
      handle.addEventListener("click",()=>setExpanded(root,root.dataset.roxyBayExpanded!=="1"));
      shell.prepend(handle);
    }

    const head=root.querySelector(".td-ai-head");
    if(head){
      if(!head.querySelector(".roxy-bay-head-avatar")){
        const avatar=document.createElement("img");
        avatar.className="roxy-bay-head-avatar";
        avatar.src=HEAD_POSES[currentState()]||HEAD_POSES.idle;
        avatar.alt="";
        avatar.setAttribute("aria-hidden","true");
        head.prepend(avatar);
      }
      syncHeadAvatar();

      const identity=head.querySelector(":scope>div");
      const subtitle=identity?.querySelector("small");
      if(subtitle&&subtitle.textContent!=="готов помочь")subtitle.textContent="готов помочь";

      if(!head.querySelector(".roxy-bay-sheet-toggle")){
        const toggle=document.createElement("button");
        toggle.type="button";
        toggle.className="roxy-bay-sheet-toggle";
        toggle.addEventListener("click",()=>setExpanded(root,root.dataset.roxyBayExpanded!=="1"));
        identity?.after(toggle);
      }
    }

    syncExpandControls(root,root.dataset.roxyBayExpanded==="1");

    const textarea=root.querySelector(".td-ai-compose textarea");
    if(textarea&&!textarea.dataset.roxyBayBound){
      textarea.dataset.roxyBayBound="1";
      textarea.addEventListener("focus",()=>{
        if(isTouchLayout()&&document.body.hasAttribute("data-td-keyboard-open"))setExpanded(root,true);
      });
    }

    return true;
  }

  function wrapOpen(){
    const api=window.TDShoppingAssistant;
    if(!api||typeof api.open!=="function"||api.open.__roxyBayWrapped)return false;
    const original=api.open;
    const wrappedOpen=function(...args){
      const result=original.apply(api,args);
      decorate();
      Promise.resolve(result).finally(()=>decorate());
      return result;
    };
    wrappedOpen.__roxyBayWrapped=true;
    wrappedOpen.__roxyBayOriginal=original;
    api.open=wrappedOpen;
    wrapped=true;
    return true;
  }

  function boot(){
    ensureStyles();
    wrapOpen();
    decorate();
    document.addEventListener("click",event=>{
      if(event.target.closest(".td-ai-entry,.v2-bay-primary,.v2-hero-bai,[data-action='basket']")){
        requestAnimationFrame(()=>{wrapOpen();decorate()});
      }
    });
    window.addEventListener("td:bai-state",event=>syncHeadAvatar(event.detail?.state));
    window.addEventListener("pageshow",()=>{wrapOpen();decorate()});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();

  window.TDRoxyBayPanel={decorate,setExpanded,syncHeadAvatar,isWrapped:()=>wrapped};
})();
