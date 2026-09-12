(function(){
  "use strict";
  const STYLE_ID="td-ui-layer-coordinator-style";
  const BLOCKING_SELECTOR=".td-map-sheet,.td-point-detail,.td-one-tap,.td-account,.td-ai,.bai-panel,.td-pickup-backdrop,.td-courier-backdrop,.td-continue-stores,.td-retailer-handoff";
  const HISTORY_OVERLAYS=[
    {id:"bai",selector:".td-ai",close:"[data-ai-close]"},
    {id:"pickup",selector:".td-pickup-backdrop",close:".td-pickup-x"},
    {id:"courier",selector:".td-courier-backdrop",close:".td-courier-x"},
    {id:"continue-stores",selector:".td-continue-stores",close:".td-continue-stores-x"},
    {id:"retailer-handoff",selector:".td-retailer-handoff",close:".td-retailer-x"}
  ];
  let baseGo=null,historyOverlayId=null,closingFromPop=false,purchaseLockKey="",purchaseLockAt=0;

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement("style");
    s.id=STYLE_ID;
    s.textContent=`
      .bai-assistant[data-ui-parked="true"]{opacity:0!important;pointer-events:none!important;transform:translateY(125%) rotate(4deg)!important}
      body[data-td-overlay-open="true"] .dock{pointer-events:none}
      .td-map-sheet,.td-point-detail,.td-one-tap,.td-account,.td-ai,.bai-panel,.td-pickup-backdrop,.td-courier-backdrop,.td-continue-stores,.td-retailer-handoff{overscroll-behavior:contain}
      .td-flow-state{display:grid;justify-items:center;gap:8px;text-align:center;background:#fff;border:1px solid #e8e0d4;border-radius:20px;padding:26px 18px;margin:4px 0 12px;box-shadow:0 10px 30px rgba(22,20,16,.05)}
      .td-flow-state i{font-style:normal;font-size:30px;line-height:1}.td-flow-state b{font-size:18px;letter-spacing:-.03em}.td-flow-state p{max-width:390px;color:#6b6458;font-size:12px;line-height:1.5}.td-flow-state button{border:0;border-radius:13px;padding:11px 14px;background:#102018;color:#fff;font:800 12px Manrope,sans-serif;cursor:pointer}
      .td-flow-status{display:grid;gap:3px;border-radius:15px;padding:11px 12px;margin:0 0 10px;background:#eef8f1;color:#176b47;border:1px solid rgba(15,123,74,.1);font-size:11px;line-height:1.4}.td-flow-status b{font-size:12px}.td-flow-status[data-tone="loading"]{background:#f3f5f3;color:#536158}.td-flow-status[data-tone="error"]{background:#fff4df;color:#835700;border-color:#f2dfb7}
      .td-flow-status[data-tone="loading"] b:before{content:"";display:inline-block;width:8px;height:8px;margin-right:7px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:td-flow-spin .8s linear infinite}
      @keyframes td-flow-spin{to{transform:rotate(360deg)}}
      @media(max-width:430px){
        .td-one-tap{max-height:calc(100dvh - 24px - env(safe-area-inset-top));overflow:auto}
        .td-point-panel{padding-bottom:calc(16px + env(safe-area-inset-bottom))}
        .td-flow-state{padding:22px 15px}
      }
      @media(prefers-reduced-motion:reduce){.bai-assistant[data-ui-parked="true"]{transition:none!important}.td-flow-status[data-tone="loading"] b:before{animation:none!important}}
    `;
    document.head.appendChild(s);
  }

  function isVisible(node){
    if(!node||!node.isConnected)return false;
    if(node.hidden||node.getAttribute("aria-hidden")==="true")return false;
    const style=getComputedStyle(node);
    return style.display!=="none"&&style.visibility!=="hidden";
  }

  function activeOverlay(){
    return [...document.querySelectorAll(BLOCKING_SELECTOR)].reverse().find(isVisible)||null;
  }

  function sync(){
    injectStyles();
    const overlay=activeOverlay();
    const bai=document.getElementById("bai-assistant");
    const app=document.getElementById("app");
    const blocked=Boolean(overlay);
    if(blocked){
      if(document.body.dataset.tdOverlayOpen!=="true")document.body.dataset.tdOverlayOpen="true";
    }else if(document.body.hasAttribute("data-td-overlay-open")){
      document.body.removeAttribute("data-td-overlay-open");
    }

    // Never inert a container that owns the active dialog itself: on browsers with
    // native inert support that makes the dialog unclickable and looks like a freeze.
    const shouldInertApp=Boolean(blocked&&app&&overlay&&!app.contains(overlay));
    if(app&&"inert" in app&&app.inert!==shouldInertApp)app.inert=shouldInertApp;

    if(bai){
      const shouldPark=Boolean(blocked&&overlay&&!overlay.closest?.("#bai-assistant")&&!overlay.classList?.contains("bai-panel"));
      if(shouldPark){
        if(bai.dataset.uiParked!=="true")bai.dataset.uiParked="true";
        if(bai.getAttribute("aria-hidden")!=="true")bai.setAttribute("aria-hidden","true");
        if(bai.tabIndex!==-1)bai.tabIndex=-1;
      }else{
        if(bai.hasAttribute("data-ui-parked"))bai.removeAttribute("data-ui-parked");
        if(bai.hasAttribute("aria-hidden"))bai.removeAttribute("aria-hidden");
        if(bai.tabIndex!==0)bai.tabIndex=0;
      }
    }
  }

  function historyOverlay(){
    const selector=HISTORY_OVERLAYS.map(x=>x.selector).join(",");
    const nodes=[...document.querySelectorAll(selector)].filter(isVisible);
    const node=nodes[nodes.length-1];
    return node?HISTORY_OVERLAYS.find(x=>node.matches(x.selector))||null:null;
  }

  function closeHistoryOverlay(def){
    const node=document.querySelector(def.selector);if(!node)return;
    const button=node.querySelector(def.close);if(button?.click){button.click();return}node.remove();
  }

  function syncOverlayHistory(){
    if(!window.history?.pushState)return;
    const def=historyOverlay();
    if(def){
      if(historyOverlayId===def.id)return;
      historyOverlayId=def.id;
      if(history.state?.tdOverlay!==def.id){
        history.pushState({...history.state,tdScreen:window.state?.screen||history.state?.tdScreen||"home",tdOverlay:def.id},"");
      }
      return;
    }
    if(!historyOverlayId)return;
    const old=historyOverlayId;historyOverlayId=null;
    if(closingFromPop){closingFromPop=false;return}
    if(history.state?.tdOverlay===old)history.back();
  }

  function installScreenHistory(){
    if(baseGo||typeof window.go!=="function"||!window.history?.replaceState)return;
    baseGo=window.go;
    const initial=window.state?.screen||"home";
    history.replaceState({...history.state,tdScreen:initial,tdOverlay:null},"");
    window.go=function(screen){
      const before=window.state?.screen,result=baseGo.apply(this,arguments),after=window.state?.screen;
      if(after&&after!==before&&history.state?.tdScreen!==after){history.pushState({...history.state,tdScreen:after,tdOverlay:null},"")}
      requestAnimationFrame(decorateFlow);
      return result;
    };
    window.addEventListener("popstate",event=>{
      const def=historyOverlay();
      if(def&&event.state?.tdOverlay!==def.id){closingFromPop=true;closeHistoryOverlay(def);return}
      const screen=event.state?.tdScreen;
      if(screen&&window.state&&screen!==window.state.screen){baseGo(screen);requestAnimationFrame(decorateFlow)}
    });
  }

  function dataState(){
    if(window.TDDataHealth?.ok===false)return{level:"error",title:"Данные повреждены",text:"Часть каталога не прошла проверку. Корзина сохранена, но сравнение лучше повторить после обновления."};
    const retailers=window.TDRetailerPriceState;
    const collectors=Object.values(window.TDCollectorHealth?.collectors||{});
    const collectorErrors=collectors.filter(x=>x?.status==="error").length;
    if(!retailers)return{level:"loading",title:"Проверяем цены",text:"Источники ещё загружаются. Корзина уже доступна, подтверждённый рейтинг появится после проверки."};
    const issues=Array.isArray(retailers.loadIssues)?retailers.loadIssues.length:0;
    if(issues||collectorErrors)return{level:"error",title:"Не все цены обновились",text:"Показываем доступные данные и оценки. Источники с ошибкой не считаем подтверждёнными."};
    return{level:"ready",title:"",text:""};
  }

  function cartCount(){return Object.values(window.state?.cart||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0)}
  function statusMarkup(data){return `<section class="td-flow-status" data-td-flow-status data-tone="${data.level}" role="status" aria-live="polite"><b>${data.title}</b><span>${data.text}</span></section>`}
  function emptyMarkup(screen){
    const compare=screen==="compare";
    return `<section class="td-flow-state" data-td-flow-empty><i aria-hidden="true">${compare?"↙":"🧺"}</i><b>${compare?"Сравнивать пока нечего":"Корзина пустая"}</b><p>${compare?"Сначала добавь хотя бы один товар. После этого сравним одну и ту же корзину между магазинами.":"Добавь товары вручную или попроси Бая собрать список — здесь появятся позиции, сумма и следующий шаг."}</p><button type="button" onclick="go('catalog')">${compare?"Вернуться к товарам":"Добавить товары"}</button></section>`;
  }

  function decorateFlow(){
    const app=document.getElementById("app");if(!app||!window.state)return;
    const screen=window.state.screen;
    if(screen==="cart"||screen==="compare"){
      const wrap=app.querySelector(".wrap");if(!wrap)return;
      if(!cartCount()){
        if(!wrap.querySelector("[data-td-flow-empty]"))wrap.innerHTML=emptyMarkup(screen);
        app.querySelector(".dock")?.remove();
        return;
      }
      wrap.querySelector("[data-td-flow-empty]")?.remove();
      const health=dataState(),existing=wrap.querySelector("[data-td-flow-status]");
      if(health.level==="ready"){existing?.remove()}
      else if(!wrap.querySelector(".td-data-health")&&!existing){wrap.insertAdjacentHTML("afterbegin",statusMarkup(health))}
      return;
    }
    if(screen==="catalog"){
      const wrap=app.querySelector(".wrap"),search=wrap?.querySelector(".search");if(!wrap||!search)return;
      const empty=wrap.querySelector("[data-td-flow-search-empty]"),hasItems=Boolean(wrap.querySelector(".item")),query=String(window.state.q||"").trim();
      if(query&&!hasItems&&!empty){search.insertAdjacentHTML("afterend",`<section class="td-flow-state" data-td-flow-search-empty><i aria-hidden="true">⌕</i><b>Ничего не нашли</b><p>Попробуй короче: «молоко», «хлеб», «яйца». Или очисти поиск и выбери товар из списка.</p><button type="button" onclick="state.q='';render()">Показать все товары</button></section>`)}
      else if((!query||hasItems)&&empty)empty.remove();
    }
  }

  function installPurchaseGuard(){
    const purchase=window.TDPurchase;if(!purchase?.start||purchase.__tdDuplicateGuard)return;
    const original=purchase.start.bind(purchase);
    purchase.start=function(storeId,channel){
      const key=`${storeId||""}:${channel||""}`,now=Date.now();
      if(key===purchaseLockKey&&now-purchaseLockAt<1250){window.TDBai?.setState?.("checking","Уже открываю этот вариант",900);return false}
      purchaseLockKey=key;purchaseLockAt=now;
      try{const result=original(storeId,channel);if(result===false){purchaseLockKey="";purchaseLockAt=0}return result}catch(error){purchaseLockKey="";purchaseLockAt=0;throw error}
    };
    purchase.__tdDuplicateGuard=true;
  }

  let raf=0;
  const observer=new MutationObserver(()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{sync();syncOverlayHistory();decorateFlow();installPurchaseGuard()});
  });

  function start(){
    sync();installScreenHistory();installPurchaseGuard();syncOverlayHistory();decorateFlow();
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","aria-hidden","class","style"]});
    ["td:v2-rendered","td:data-health","td:retailer-health","td:collector-health","online","offline"].forEach(name=>window.addEventListener(name,()=>requestAnimationFrame(decorateFlow)));
  }

  window.TDUILayers={refresh:()=>{sync();syncOverlayHistory();decorateFlow()},get blocked(){return Boolean(activeOverlay());},get active(){return activeOverlay();},get dataState(){return dataState()}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
