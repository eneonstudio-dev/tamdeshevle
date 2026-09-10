(function(){
  "use strict";
  const KEY="td:selected-store-point";

  function rub(value){return `${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;}
  function pointAt(index){const list=window.TDGeo&&Array.isArray(window.TDGeo.nearby)?window.TDGeo.nearby:[];return list[index]||null;}
  function distanceText(point){const km=Number(point&&point.distanceKm);if(!Number.isFinite(km))return"";return km<1?`${Math.round(km*1000)} м`:`${km.toFixed(1)} км`;}
  function persistChain(chainId){
    if(!chainId)return;
    if(window.state)state.storeId=chainId;
    try{const saved=JSON.parse(localStorage.getItem("td")||"{}");saved.storeId=chainId;localStorage.setItem("td",JSON.stringify(saved));}catch{}
  }
  function basket(point){
    if(!point||!window.TDStoreIdBridge||typeof TDStoreIdBridge.basket!=="function")return null;
    try{return TDStoreIdBridge.basket(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:window.state&&state.storeId});}catch{return null;}
  }
  function resolve(point){
    if(!point||!window.TDStoreIdBridge||typeof TDStoreIdBridge.resolve!=="function")return null;
    try{return TDStoreIdBridge.resolve(point);}catch{return null;}
  }
  function quoteText(point){
    const b=basket(point);
    if(b&&b.totalItems){
      if(b.verified&&Number.isFinite(b.total))return{kind:"verified",main:`Корзина ${rub(b.total)}`,sub:Number.isFinite(b.savings)&&b.savings>0?`экономия ${rub(b.savings)}`:`${b.coveredItems}/${b.totalItems} цен подтверждены`};
      if(Number(b.coveredItems)>0)return{kind:"partial",main:`${b.coveredItems} из ${b.totalItems} цен подтверждены`,sub:"Полный итог пока не показываем"};
      return{kind:"pending",main:"Цена корзины пока не подтверждена",sub:"Расчёт обновится, когда появятся подтверждённые цены"};
    }
    return{kind:"empty",main:"Точка выбрана",sub:"Добавьте товары — здесь появится сумма корзины"};
  }
  function injectStyles(){
    if(document.getElementById("td-one-tap-style"))return;
    const s=document.createElement("style");s.id="td-one-tap-style";s.textContent=`
      .td-one-tap{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:92;width:min(404px,calc(100% - 24px));background:#161410;color:#fff;border-radius:18px;padding:12px;box-shadow:0 18px 48px rgba(22,20,16,.28)}
      .td-one-tap-top{display:flex;gap:10px;align-items:flex-start}.td-one-tap-pin{width:34px;height:34px;border-radius:11px;display:grid;place-items:center;flex:none;background:#0f7b4a;font-weight:900}.td-one-tap-copy{min-width:0;flex:1}.td-one-tap-title{font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.td-one-tap-sub{margin-top:3px;font-size:10px;line-height:1.35;color:#cfc8bc}.td-one-tap-price{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.08);font-size:11px;font-weight:800}.td-one-tap-price small{display:block;margin-top:2px;color:#b9b2a7;font-size:9px}.td-one-tap-actions{display:flex;gap:7px;margin-top:9px}.td-one-tap-actions button{min-height:44px;border:0;border-radius:12px;padding:10px 11px;font:900 11px Manrope,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}.td-one-tap-compare{flex:1;background:#ffe14a;color:#161410}.td-one-tap-detail{background:#fff;color:#161410}.td-one-tap[data-disabled="true"] .td-one-tap-compare{opacity:.45;pointer-events:none}
      .td-map-list{padding-bottom:170px!important}
      @media (min-width:700px){.td-one-tap{width:min(620px,calc(100% - 32px))}}
    `;document.head.appendChild(s);
  }
  function cleanupTray(){document.querySelector(".td-one-tap")?.remove();}
  function renderTray(point,index,match){
    injectStyles();cleanupTray();
    const verified=Boolean(match&&match.verified),distance=distanceText(point);
    const q=verified?quoteText(point):{kind:"unverified",main:"Точка пока не выбрана для расчёта",sub:"Нет подтверждённого Store ID для этой точки"};
    const tray=document.createElement("section");tray.className="td-one-tap";tray.dataset.disabled=verified?"false":"true";tray.dataset.index=String(index);tray.setAttribute("aria-live","polite");
    tray.innerHTML=`<div class="td-one-tap-top"><div class="td-one-tap-pin">⌖</div><div class="td-one-tap-copy"><div class="td-one-tap-title">${escapeHtml(point.chainLabel||point.name||"Магазин")}${distance?` · ${escapeHtml(distance)}`:""}</div><div class="td-one-tap-sub">${escapeHtml(point.address||"Адрес точки")}</div></div></div><div class="td-one-tap-price">${escapeHtml(q.main)}<small>${escapeHtml(q.sub)}</small></div><div class="td-one-tap-actions"><button type="button" class="td-one-tap-compare"${verified?"":' aria-disabled="true"'}>Сравнить</button><button type="button" class="td-one-tap-detail">Подробнее</button></div>`;
    document.body.appendChild(tray);
    tray.querySelector(".td-one-tap-compare")?.addEventListener("click",()=>goCompare(point));
    tray.querySelector(".td-one-tap-detail")?.addEventListener("click",()=>window.TDGeo?.openPointDetails?.(point));
  }
  function escapeHtml(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function choosePoint(index){
    const point=pointAt(index);if(!point)return null;
    const match=resolve(point);
    document.querySelectorAll(".td-map-store").forEach((card,i)=>card.dataset.active=i===index?"true":"false");
    document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker").forEach((marker,i)=>marker.dataset.active=i===index?"true":"false");
    if(match&&match.verified){
      persistChain(point.chainId);
      try{localStorage.setItem(KEY,JSON.stringify({id:point.id,chainId:point.chainId,storeId:String(match.storeId),address:point.address,selectedAt:new Date().toISOString()}));}catch{}
      window.TDSelectedStore?.refresh?.();
      window.dispatchEvent(new CustomEvent("td:selected-store-point-current",{detail:{point,match,source:"map-one-tap"}}));
    }
    renderTray(point,index,match);
    return{point,match};
  }
  function goCompare(point){
    const match=resolve(point);
    if(!point||!match||!match.verified)return false;
    persistChain(point.chainId);
    document.querySelector(".td-point-detail")?.remove();cleanupTray();document.querySelector(".td-map-sheet")?.remove();
    if(typeof window.go==="function")window.go("compare");else if(window.state){state.screen="compare";window.render?.();}
    return true;
  }
  function cardIndex(card){return [...document.querySelectorAll(".td-map-store")].indexOf(card);}
  function markerIndex(marker){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")].indexOf(marker);}
  function installEvents(){
    document.addEventListener("click",e=>{
      if(e.target.closest("[data-close-map]")){cleanupTray();return;}
      const card=e.target.closest(".td-map-store");
      if(card&&!e.target.closest("button,a")){
        const index=cardIndex(card);if(index>=0){e.preventDefault();e.stopImmediatePropagation();choosePoint(index);}return;
      }
      const marker=e.target.closest("img.leaflet-marker-icon.td-themed-marker");
      if(marker){const index=markerIndex(marker);if(index>=0)choosePoint(index);}
    },true);
    document.addEventListener("keydown",e=>{
      if(e.key!=="Enter"&&e.key!==" ")return;const card=e.target.closest(".td-map-store");if(!card)return;
      const index=cardIndex(card);if(index<0)return;e.preventDefault();e.stopImmediatePropagation();choosePoint(index);
    },true);
  }
  function polishBackLink(){
    if(!document.querySelector(".td-map-sheet"))cleanupTray();
    if(!window.state||state.screen!=="compare")return;
    const btn=document.querySelector("[data-td-selected-store] .td-selected-store-change");
    if(btn&&btn.textContent!=="← К магазинам рядом")btn.textContent="← К магазинам рядом";
  }
  let raf=0;const obs=new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(polishBackLink);});
  function start(){injectStyles();installEvents();polishBackLink();obs.observe(document.body,{childList:true,subtree:true});window.addEventListener("pagehide",cleanupTray);}
  window.TDMapOneTap={choosePoint,compare:()=>{const tray=document.querySelector(".td-one-tap");const index=Number(tray&&tray.dataset.index);return Number.isInteger(index)?goCompare(pointAt(index)):false;},close:cleanupTray};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
