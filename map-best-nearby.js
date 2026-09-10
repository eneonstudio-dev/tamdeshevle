(function(){
  "use strict";
  let raf=0;
  function points(){return window.TDGeo&&Array.isArray(TDGeo.nearby)?TDGeo.nearby:[];}
  function markers(){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function basket(point){try{return window.TDStoreIdBridge?.basket?.(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:window.state&&state.storeId})||null;}catch{return null;}}
  function candidates(){return points().map((point,index)=>({point,index,marker:markers()[index],basket:basket(point)})).filter(x=>x.marker&&x.marker.style.pointerEvents!=="none"&&x.marker.style.opacity!=="0"&&x.basket?.verified&&Number.isFinite(x.basket.savings)&&x.basket.savings>0);}
  function best(){return candidates().sort((a,b)=>b.basket.savings-a.basket.savings||(Number(a.point.distanceKm)||Infinity)-(Number(b.point.distanceKm)||Infinity))[0]||null;}
  function focusBest(){const hit=best();if(!hit)return false;window.TDMapMarkerCardSync?.center?.(hit.index);return Boolean(window.TDMapClusterPriority?.focus?.(hit.index,{popup:true}));}
  function injectStyle(){if(document.getElementById("td-map-best-style"))return;const s=document.createElement("style");s.id="td-map-best-style";s.textContent='.td-map-best{position:absolute;left:50%;bottom:12px;z-index:725;transform:translateX(-50%);min-height:42px;border:0;border-radius:999px;padding:0 14px;background:#ffe14a;color:#161410;box-shadow:0 10px 26px rgba(22,20,16,.22);font:900 11px Manrope,system-ui,sans-serif;white-space:nowrap;cursor:pointer;touch-action:manipulation}.td-map-best[disabled]{background:#ece7de;color:#8b8275;box-shadow:0 7px 18px rgba(22,20,16,.12);cursor:default}@media(max-width:430px){.td-map-best{min-height:44px;bottom:10px}}';document.head.appendChild(s);}
  function render(){injectStyle();const map=document.querySelector("#td-map.td-map");if(!map)return;let btn=map.querySelector("[data-map-best]");if(!btn){btn=document.createElement("button");btn.type="button";btn.className="td-map-best";btn.dataset.mapBest="1";btn.addEventListener("click",focusBest);map.appendChild(btn);}const hit=best();btn.disabled=!hit;btn.setAttribute("aria-disabled",hit?"false":"true");btn.textContent=hit?`★ Лучший рядом · −${Math.round(hit.basket.savings).toLocaleString("ru-RU")} ₽`:"★ Лучший рядом";btn.title=hit?"Показать самую выгодную подтверждённую точку":"Нет подтверждённой экономии среди видимых точек";}
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
  function start(){schedule();new MutationObserver(ms=>{if(ms.every(m=>m.target?.closest?.("[data-map-best]")))return;schedule();}).observe(document.body,{childList:true,subtree:true});window.addEventListener("td:retailer-prices-applied",schedule);window.addEventListener("td:selected-store-point-current",schedule);}
  window.TDMapBestNearby={refresh:schedule,best,focus:focusBest};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
