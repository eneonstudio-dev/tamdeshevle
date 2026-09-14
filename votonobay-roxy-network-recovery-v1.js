(()=>{
  "use strict";
  if(window.__TDRoxyNetworkRecoveryV1)return;
  window.__TDRoxyNetworkRecoveryV1=true;

  const STYLE="votonobay-roxy-network-recovery-v1.css?v=20260914-v1";
  let root=null;
  let lastOnline=null;
  let queued=false;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-network-recovery]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE;
    link.dataset.roxyNetworkRecovery="1";
    document.head.appendChild(link);
  }

  function banner(){return root?.querySelector(":scope > .td-ai-shell > .roxy-network-restored")||null}

  function dismiss({focus=false}={}){
    const current=banner();
    current?.remove();
    root?.removeAttribute("data-roxy-network-restored");
    if(focus){
      const area=root?.querySelector(".td-ai-compose textarea");
      try{area?.focus?.({preventScroll:true})}catch(_){area?.focus?.()}
    }
  }

  function showRestored(){
    if(!root?.isConnected)return false;
    ensureStyle();
    const shell=root.querySelector(":scope > .td-ai-shell");
    if(!shell)return false;
    let note=banner();
    if(!note){
      note=document.createElement("aside");
      note.className="roxy-network-restored";
      note.setAttribute("role","status");
      note.setAttribute("aria-live","polite");
      note.setAttribute("aria-atomic","true");
      note.innerHTML=`<span><small>СЕТЬ ВЕРНУЛАСЬ</small><b>Корзина на месте</b><p>Бай снова может проверять свежие цены и открывать магазины. Ничего не отправляю повторно без твоей команды.</p></span><button type="button" data-roxy-network-continue>Продолжить</button>`;
      const head=shell.querySelector(":scope > .td-ai-head");
      const main=shell.querySelector(":scope > .td-ai-main");
      if(head)head.insertAdjacentElement("afterend",note);
      else if(main)shell.insertBefore(note,main);
      else shell.prepend(note);
      note.querySelector("[data-roxy-network-continue]")?.addEventListener("click",()=>dismiss({focus:true}));
    }
    root.setAttribute("data-roxy-network-restored","1");
    return true;
  }

  function networkOnline(){return navigator.onLine!==false}

  function sync(nextOnline=networkOnline()){
    const online=Boolean(nextOnline);
    if(!root?.isConnected){lastOnline=online;return online?"online":"offline"}
    root.dataset.roxyNetwork=online?"online":"offline";
    if(!online){
      dismiss();
      lastOnline=false;
      return"offline";
    }
    if(lastOnline===false)showRestored();
    lastOnline=true;
    return"online";
  }

  function attach(next,online=networkOnline()){
    root=next||null;
    if(!root)return false;
    ensureStyle();
    root.dataset.roxyNetworkRecovery="1";
    const first=lastOnline===null;
    if(first)lastOnline=Boolean(online);
    sync(online);
    return true;
  }

  function discover(){
    const next=document.querySelector(".td-ai");
    if(next!==root)attach(next);
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;discover()});
  }

  window.addEventListener("offline",()=>{discover();sync(false)});
  window.addEventListener("online",()=>{discover();sync(true)});
  window.addEventListener("pageshow",()=>{discover();sync()});
  document.addEventListener("input",event=>{
    if(event.target?.closest?.(".td-ai-compose textarea")&&root?.hasAttribute("data-roxy-network-restored"))dismiss();
  });
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  schedule();

  window.TDRoxyNetworkRecoveryV1={attach,sync,showRestored,dismiss,discover};
})();
