(()=>{
  "use strict";
  if(window.__TDRoxyReturnContinuityV1)return;
  window.__TDRoxyReturnContinuityV1=true;

  const STYLE="votonobay-roxy-return-continuity-v1.css?v=20260914-v1";
  const ARM_WINDOW=30000;
  const RETURN_WINDOW=2*60*60*1000;
  let armedAt=0;
  let hiddenAfterArm=false;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-return-continuity]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE;
    link.dataset.roxyReturnContinuity="1";
    document.head.appendChild(link);
  }

  function shoppingState(){
    try{return window.TDShoppingState?.get?.()||{}}catch{return{}}
  }
  function hasBasket(){
    const state=shoppingState();
    return Array.isArray(state.products)&&state.products.some(line=>line&&Number(line.quantity||1)>0);
  }
  function bayRoot(){return document.querySelector(".td-ai")}
  function bayMeaningful(root=bayRoot()){
    if(!root)return false;
    const draft=String(root.querySelector(".td-ai-compose textarea")?.value||"").trim();
    return hasBasket()||Boolean(draft)||Boolean(root.querySelector(".td-ai-msg.user,.td-ai-summary"));
  }
  function bayNetworkAuthority(root=bayRoot()){
    return navigator.onLine===false||root?.dataset.roxyNetwork==="offline"||root?.hasAttribute("data-bai-offline")||root?.hasAttribute("data-roxy-network-restored")||Boolean(root?.querySelector(".roxy-network-restored"));
  }
  function notices(){return[...document.querySelectorAll(".roxy-return-continuity")]}
  function dismissAll(){notices().forEach(note=>note.remove())}

  function focusWithoutScroll(target){
    if(!target)return;
    try{target.focus({preventScroll:true})}catch(_){target.focus?.()}
  }
  function focusNextFrame(target){requestAnimationFrame(()=>{if(target?.isConnected)focusWithoutScroll(target)})}
  function keepFocusInside(card,preferred){
    requestAnimationFrame(()=>{
      if(preferred?.isConnected)focusWithoutScroll(preferred);
      requestAnimationFrame(()=>{
        if(card?.isConnected&&!card.contains(document.activeElement))focusWithoutScroll(card);
      });
    });
  }
  function makeNotice(surface,title,body,action){
    const note=document.createElement("aside");
    note.className="roxy-return-continuity";
    note.dataset.surface=surface;
    note.setAttribute("role","status");
    note.setAttribute("aria-live","polite");
    note.setAttribute("aria-atomic","true");
    const copy=document.createElement("span");
    const eyebrow=document.createElement("small");
    eyebrow.textContent=surface==="retailer"?"ВЕРНУЛИСЬ ИЗ МАГАЗИНА?":"ВЕРНУЛИСЬ";
    const heading=document.createElement("b");heading.textContent=title;
    const text=document.createElement("p");text.textContent=body;
    const button=document.createElement("button");button.type="button";button.textContent=action;
    copy.append(eyebrow,heading,text);note.append(copy,button);
    return{note,button};
  }

  function showRetailer(){
    const card=document.querySelector(".td-retailer-handoff .td-retailer-card");
    if(!card)return false;
    ensureStyle();
    const existing=card.querySelector(":scope > .roxy-return-continuity");
    if(existing)return true;
    const scrollTop=card.scrollTop;
    const {note,button}=makeNotice("retailer","Список на месте","Отметь только то, что реально добавил на стороне магазина. Цены и наличие здесь не обновлялись автоматически.","Продолжить по списку");
    const intro=card.querySelector("h2+p");
    if(intro)intro.insertAdjacentElement("afterend",note);
    else card.prepend(note);
    card.scrollTop=scrollTop;
    button.addEventListener("click",()=>{
      const target=card.querySelector(".td-retailer-row a[href],.td-retailer-row [data-done],.td-retailer-x");
      note.remove();
      keepFocusInside(card,target);
    });
    return true;
  }

  function showBay(){
    const root=bayRoot();
    if(!root||!bayMeaningful(root)||bayNetworkAuthority(root))return false;
    const shell=root.querySelector(":scope > .td-ai-shell");
    if(!shell)return false;
    ensureStyle();
    const existing=shell.querySelector(":scope > .roxy-return-continuity");
    if(existing)return true;
    const main=root.querySelector(".td-ai-main"),scrollTop=main?.scrollTop||0;
    const title=hasBasket()?"Корзина на месте":"Продолжим отсюда";
    const {note,button}=makeNotice("bay",title,"Ничего не пересчитывал и не отправлял. Свежие цены и наличие проверю только после твоей команды.","Продолжить");
    const head=shell.querySelector(":scope > .td-ai-head");
    if(head)head.insertAdjacentElement("afterend",note);
    else shell.prepend(note);
    if(main)requestAnimationFrame(()=>{if(main.isConnected)main.scrollTop=scrollTop});
    button.addEventListener("click",()=>{
      const area=root.querySelector(".td-ai-compose textarea");
      note.remove();
      focusNextFrame(area);
    });
    return true;
  }

  function show(reason="history"){
    if(reason==="handoff"&&showRetailer())return true;
    return showBay();
  }

  function armOutbound(link){
    if(!(link instanceof Element)||!link.closest(".td-retailer-card")||!link.matches('a[href][target="_blank"]'))return false;
    armedAt=Date.now();
    hiddenAfterArm=false;
    return true;
  }

  function visibility(hidden=document.hidden){
    if(hidden){
      if(armedAt&&Date.now()-armedAt<=ARM_WINDOW)hiddenAfterArm=true;
      return"hidden";
    }
    if(hiddenAfterArm&&armedAt&&Date.now()-armedAt<=RETURN_WINDOW){
      hiddenAfterArm=false;
      armedAt=0;
      requestAnimationFrame(()=>show("handoff"));
      return"handoff-return";
    }
    return"visible";
  }

  function pageShow(event){
    if(event?.persisted===true){requestAnimationFrame(()=>show("history"));return true}
    return false;
  }

  document.addEventListener("click",event=>{
    const link=event.target instanceof Element?event.target.closest('.td-retailer-card a[href][target="_blank"]'):null;
    if(link)armOutbound(link);
    if(event.target instanceof Element&&event.target.closest(".roxy-network-restored")){
      const root=bayRoot();
      root?.querySelector(':scope > .td-ai-shell > .roxy-return-continuity[data-surface="bay"]')?.remove();
    }
  },true);
  document.addEventListener("visibilitychange",()=>visibility(document.hidden));
  document.addEventListener("input",event=>{
    if(event.target instanceof Element&&event.target.closest(".td-ai-compose textarea")){
      bayRoot()?.querySelector(':scope > .td-ai-shell > .roxy-return-continuity[data-surface="bay"]')?.remove();
    }
  });
  window.addEventListener("pageshow",pageShow);
  window.addEventListener("offline",dismissAll);
  window.addEventListener("online",()=>requestAnimationFrame(()=>{
    const root=bayRoot();
    if(root?.hasAttribute("data-roxy-network-restored")||root?.querySelector(".roxy-network-restored"))root.querySelector(':scope > .td-ai-shell > .roxy-return-continuity[data-surface="bay"]')?.remove();
  }));
  new MutationObserver(()=>{
    const root=bayRoot();
    if(root?.hasAttribute("data-roxy-network-restored")||root?.querySelector(".roxy-network-restored"))root.querySelector(':scope > .td-ai-shell > .roxy-return-continuity[data-surface="bay"]')?.remove();
  }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["data-roxy-network-restored"]});

  window.TDRoxyReturnContinuityV1={show,showBay,showRetailer,armOutbound,visibility,pageShow,dismissAll,hasBasket,bayMeaningful};
})();
