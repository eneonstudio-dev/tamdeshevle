(function(){
  "use strict";
  const KEY="td:selected-store-point";

  function readPoint(){
    try{
      const raw=localStorage.getItem(KEY);
      if(!raw)return null;
      const point=JSON.parse(raw);
      if(!point||!point.chainId||!point.storeId)return null;
      return point;
    }catch{return null;}
  }

  function chainName(id){
    const store=Array.isArray(window.STORES)?window.STORES.find(s=>s.id===id):null;
    return store&&store.name?store.name:id;
  }

  function injectStyles(){
    if(document.getElementById("td-selected-store-style"))return;
    const s=document.createElement("style");
    s.id="td-selected-store-style";
    s.textContent=`
      .td-selected-store{margin:0 0 12px;background:#fff;border:1px solid rgba(15,123,74,.18);border-radius:18px;padding:12px 12px 12px 13px;box-shadow:0 10px 26px rgba(22,20,16,.06)}
      .td-selected-store-top{display:flex;align-items:flex-start;gap:10px}
      .td-selected-store-pin{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:none;background:#0f7b4a;color:#fff;font-size:16px;box-shadow:0 6px 14px rgba(15,123,74,.18)}
      .td-selected-store-copy{min-width:0;flex:1}
      .td-selected-store-kicker{font-size:9px;line-height:1.2;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:#0f7b4a;margin-bottom:3px}
      .td-selected-store-title{font-size:14px;font-weight:900;letter-spacing:-.02em;color:#161410}
      .td-selected-store-address{font-size:11px;line-height:1.35;font-weight:650;color:#6b6458;margin-top:3px;overflow-wrap:anywhere}
      .td-selected-store-actions{display:flex;gap:7px;margin-top:10px}
      .td-selected-store-actions button{border:0;border-radius:11px;padding:9px 10px;font:800 11px Manrope,system-ui,sans-serif;cursor:pointer}
      .td-selected-store-change{background:#161410;color:#fff;flex:1}
      .td-selected-store-clear{background:#f3f0e9;color:#5f594f}
      .td-map-store[data-point-selected="true"]{border-color:#0f7b4a!important;box-shadow:0 12px 30px rgba(15,123,74,.14)!important}
      .td-map-store[data-point-selected="true"]::after{content:"выбран";position:absolute;right:10px;bottom:10px;border-radius:999px;background:#0f7b4a;color:#fff;padding:4px 7px;font-size:9px;font-weight:900}
      @media (prefers-reduced-motion:reduce){.td-selected-store *{scroll-behavior:auto!important}}
    `;
    document.head.appendChild(s);
  }

  function clearSelection(){
    try{localStorage.removeItem(KEY);}catch{}
    document.querySelectorAll("[data-point-selected]").forEach(el=>el.removeAttribute("data-point-selected"));
    renderBanner();
    window.dispatchEvent(new CustomEvent("td:selected-store-point-cleared"));
  }

  function changeSelection(){
    if(window.TDGeo&&typeof window.TDGeo.locate==="function"){
      window.TDGeo.locate();
      return;
    }
    if(typeof window.go==="function")window.go("stores");
  }

  function bannerHtml(point){
    const name=chainName(point.chainId);
    const address=point.address||"Точка магазина выбрана";
    return `<section class="td-selected-store" data-td-selected-store>
      <div class="td-selected-store-top">
        <div class="td-selected-store-pin" aria-hidden="true">⌖</div>
        <div class="td-selected-store-copy">
          <div class="td-selected-store-kicker">Выбранная точка</div>
          <div class="td-selected-store-title">${escapeHtml(name)}</div>
          <div class="td-selected-store-address">${escapeHtml(address)}</div>
        </div>
      </div>
      <div class="td-selected-store-actions">
        <button type="button" class="td-selected-store-change">Сменить точку</button>
        <button type="button" class="td-selected-store-clear">Сбросить</button>
      </div>
    </section>`;
  }

  function escapeHtml(v){
    return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }

  function renderBanner(){
    injectStyles();
    const point=readPoint();
    document.querySelectorAll("[data-td-selected-store]").forEach(n=>n.remove());
    if(!point||!window.state)return;

    if(state.storeId!==point.chainId)return;
    if(!["catalog","cart","compare","stores"].includes(state.screen))return;

    const wrap=document.querySelector("#app .wrap");
    if(!wrap)return;
    wrap.insertAdjacentHTML("afterbegin",bannerHtml(point));
    const banner=wrap.querySelector("[data-td-selected-store]");
    banner.querySelector(".td-selected-store-change")?.addEventListener("click",changeSelection);
    banner.querySelector(".td-selected-store-clear")?.addEventListener("click",clearSelection);
  }

  function markMapCard(){
    const point=readPoint();
    const cards=[...document.querySelectorAll(".td-map-store")];
    cards.forEach(card=>card.removeAttribute("data-point-selected"));
    if(!point||!window.TDGeo||!Array.isArray(window.TDGeo.nearby))return;
    const nearby=window.TDGeo.nearby;
    const idx=nearby.findIndex(p=>p&&p.id===point.id);
    if(idx>=0&&cards[idx])cards[idx].dataset.pointSelected="true";
  }

  function sync(){
    renderBanner();
    markMapCard();
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(sync));
  function start(){
    sync();
    obs.observe(document.getElementById("app")||document.body,{childList:true,subtree:true});
  }

  window.addEventListener("storage",e=>{if(e.key===KEY)sync();});
  window.addEventListener("td:retailer-prices-applied",sync);
  window.TDSelectedStore={get:readPoint,clear:clearSelection,change:changeSelection,refresh:sync};

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
