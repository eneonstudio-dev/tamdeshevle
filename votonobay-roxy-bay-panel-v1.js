(()=>{
  "use strict";

  let wrapped=false;

  function isTouchLayout(){
    return window.matchMedia?.("(max-width:820px), (hover:none) and (pointer:coarse) and (max-width:1100px)")?.matches;
  }

  function setExpanded(root,expanded){
    if(!root)return;
    root.dataset.roxyBayExpanded=expanded?"1":"0";
    const toggle=root.querySelector(".roxy-bay-sheet-toggle");
    if(toggle){
      toggle.setAttribute("aria-expanded",expanded?"true":"false");
      toggle.setAttribute("aria-label",expanded?"Свернуть Бая":"Развернуть Бая");
    }
  }

  function decorate(){
    const root=document.querySelector("body>.td-ai");
    if(!root)return false;
    root.dataset.roxyBayPanel="1";
    if(!root.dataset.roxyBayExpanded)setExpanded(root,false);

    const head=root.querySelector(".td-ai-head");
    if(head){
      if(!head.querySelector(".roxy-bay-head-avatar")){
        const avatar=document.createElement("img");
        avatar.className="roxy-bay-head-avatar";
        avatar.src="assets/bai/bai-idle.webp";
        avatar.alt="";
        avatar.setAttribute("aria-hidden","true");
        head.prepend(avatar);
      }

      const identity=head.querySelector(":scope>div");
      const subtitle=identity?.querySelector("small");
      if(subtitle&&subtitle.textContent!=="готов помочь")subtitle.textContent="готов помочь";

      if(!head.querySelector(".roxy-bay-sheet-toggle")){
        const toggle=document.createElement("button");
        toggle.type="button";
        toggle.className="roxy-bay-sheet-toggle";
        toggle.setAttribute("aria-expanded","false");
        toggle.setAttribute("aria-label","Развернуть Бая");
        toggle.addEventListener("click",()=>setExpanded(root,root.dataset.roxyBayExpanded!=="1"));
        identity?.after(toggle);
      }
    }

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
    wrapOpen();
    decorate();
    document.addEventListener("click",event=>{
      if(event.target.closest(".td-ai-entry,.v2-bay-primary,.v2-hero-bai,[data-action='basket']")){
        requestAnimationFrame(()=>{wrapOpen();decorate()});
      }
    });
    window.addEventListener("pageshow",()=>{wrapOpen();decorate()});
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();

  window.TDRoxyBayPanel={decorate,setExpanded,isWrapped:()=>wrapped};
})();
