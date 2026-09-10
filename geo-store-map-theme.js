(function(){
  "use strict";

  const CHAIN_META={
    "Пятёрочка":{short:"5",tone:"#16a34a"},
    "Магнит":{short:"М",tone:"#ef4444"},
    "Перекрёсток":{short:"П",tone:"#22c55e"},
    "Лента":{short:"Л",tone:"#2563eb"},
    "Дикси":{short:"Д",tone:"#f59e0b"}
  };
  const SELECTED_KEY="td:selected-store-point";

  function injectStyles(){
    if(document.getElementById("td-map-theme-style"))return;
    const s=document.createElement("style");
    s.id="td-map-theme-style";
    s.textContent=`
      .td-map-sheet{background:linear-gradient(180deg,#f3f0e8 0%,#f8f6f1 100%)}
      .td-map-head{padding:14px 16px 12px;border-bottom:1px solid rgba(22,20,16,.06);box-shadow:0 8px 22px rgba(22,20,16,.05);z-index:3}
      .td-map-head button{box-shadow:0 6px 16px rgba(22,20,16,.08);font-weight:900}
      .td-map-head strong{font-size:17px;letter-spacing:-.03em}
      .td-map-head span{margin-top:2px;line-height:1.35}
      .td-map{height:48vh;min-height:310px;border-bottom:1px solid rgba(22,20,16,.08)}
      .td-map-list{padding:14px 14px 30px}
      .td-map-store{position:relative;border:1px solid rgba(22,20,16,.06);box-shadow:0 10px 24px rgba(22,20,16,.06);padding:13px 13px 13px 58px;min-height:86px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease;cursor:pointer;outline:none}
      .td-map-store:active{transform:scale(.992)}
      .td-map-store:focus-visible{box-shadow:0 0 0 3px rgba(15,123,74,.20),0 10px 24px rgba(22,20,16,.06)}
      .td-map-store[data-active="true"]{border-color:#0f7b4a;background:#f4fbf6;box-shadow:0 14px 30px rgba(15,123,74,.14)}
      .td-map-store[data-point-selected="true"]{border-color:#0f7b4a;background:#eef8f1;box-shadow:0 14px 32px rgba(15,123,74,.16)}
      .td-map-store[data-point-selected="true"]:after{content:"выбрана";position:absolute;right:10px;bottom:9px;border-radius:999px;background:#0f7b4a;color:#fff;padding:4px 7px;font-size:8px;font-weight:900;letter-spacing:.02em;text-transform:uppercase}
      .td-map-store[data-best="true"]{border-color:rgba(15,123,74,.28);box-shadow:0 12px 28px rgba(15,123,74,.10)}
      .td-map-store[data-active="true"][data-best="true"]{border-color:#0f7b4a;box-shadow:0 14px 30px rgba(15,123,74,.16)}
      .td-map-store-icon{position:absolute;left:13px;top:13px;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:900;box-shadow:0 5px 14px rgba(22,20,16,.12)}
      .td-map-store-badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
      .td-map-store-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 7px;background:#f2efe8;color:#665f54;font-size:9px;font-weight:900;line-height:1}
      .td-map-store-badge.near{background:#edf7f0;color:#0f7b4a}
      .td-map-store-badge.best{background:#161410;color:#fff}
      .td-map-store b{font-size:14px;letter-spacing:-.02em}
      .td-map-store small{font-size:11px}
      .td-map-distance{font-size:12px;background:#f7f4ee;border-radius:999px;padding:5px 7px}
      .td-map-price-state{font-size:9px;padding:5px 8px}
      .td-map-price-state.ok{box-shadow:inset 0 0 0 1px rgba(15,123,74,.10)}
      .td-map-basket{margin-top:8px}
      .td-map-basket span{padding:6px 8px;border-radius:10px}
      .td-map-detail-btn{padding-top:9px}
      .leaflet-control-zoom{border:0!important;box-shadow:0 8px 20px rgba(22,20,16,.16)!important}
      .leaflet-control-zoom a{border:0!important;color:#161410!important;font-weight:900!important}
      .leaflet-control-attribution{font-size:8px!important;background:rgba(255,255,255,.78)!important;backdrop-filter:blur(6px)}
      .leaflet-popup-content-wrapper{border-radius:16px;box-shadow:0 12px 30px rgba(22,20,16,.16)}
      .leaflet-popup-content{font-family:Manrope,system-ui,sans-serif;font-size:12px;line-height:1.45;margin:12px 14px}
      .td-themed-marker{filter:drop-shadow(0 4px 6px rgba(22,20,16,.20));transition:transform .16s ease,filter .16s ease;transform-origin:50% 100%}
      .td-themed-marker[data-active="true"]{transform:scale(1.16);filter:drop-shadow(0 7px 11px rgba(22,20,16,.30))}
      .td-themed-marker[data-point-selected="true"]{transform:scale(1.22);filter:drop-shadow(0 0 0 rgba(0,0,0,0)) drop-shadow(0 7px 12px rgba(15,123,74,.38))}
      .td-map-quick-controls{position:absolute;right:12px;top:76px;z-index:520;display:grid;gap:8px}
      .td-map-quick-controls button{width:44px;height:44px;border:0;border-radius:13px;background:rgba(255,255,255,.96);color:#161410;box-shadow:0 8px 22px rgba(22,20,16,.18);font:900 20px/1 Manrope,system-ui,sans-serif;display:grid;place-items:center;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .td-map-quick-controls button:active{transform:scale(.96)}
      .td-map-quick-controls button:focus-visible{outline:3px solid rgba(15,123,74,.28);outline-offset:2px}
      .td-map-quick-controls button[data-busy="true"]{opacity:.66;cursor:wait}
      @media(max-width:430px){.td-map{height:44vh;min-height:285px}.td-map-list{padding-left:12px;padding-right:12px}.td-map-store{min-height:92px}.td-map-quick-controls{top:72px;right:10px}}
      @media (min-width:700px){.td-map-sheet{left:50%;right:auto;width:min(680px,100%);transform:translateX(-50%);box-shadow:0 0 70px rgba(22,20,16,.22)}}
      @media (prefers-reduced-motion:reduce){.td-map-store,.td-themed-marker,.td-map-quick-controls button{transition:none}}
    `;
    document.head.appendChild(s);
  }

  function metaForPoint(point){return CHAIN_META[point&&point.chainLabel]||{short:"₽",tone:"#0f7b4a"};}

  function svgMarker(meta){
    const short=String(meta.short||"₽").replace(/[&<>"']/g,"");
    const tone=/^#[0-9a-f]{6}$/i.test(meta.tone||"")?meta.tone:"#0f7b4a";
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46"><path fill="${tone}" stroke="#fff" stroke-width="1.5" d="M17 1.5C8.4 1.5 1.5 8.4 1.5 17c0 11.2 15.5 27.5 15.5 27.5S32.5 28.2 32.5 17C32.5 8.4 25.6 1.5 17 1.5z"/><circle cx="17" cy="17" r="10" fill="#fff"/><text x="17" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="800" fill="${tone}">${short}</text></svg>`;
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
  }

  function readSelected(){
    try{const p=JSON.parse(localStorage.getItem(SELECTED_KEY)||"null");return p&&p.id?p:null;}catch{return null;}
  }
  function points(){return window.TDGeo&&Array.isArray(window.TDGeo.nearby)?window.TDGeo.nearby:[];}
  function storeMarkers(root=document){return [...root.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function storeCards(root=document){return [...root.querySelectorAll(".td-map-store")];}

  function setActive(index,{scroll=false}={}){
    const cards=storeCards(),markers=storeMarkers();
    cards.forEach((card,i)=>card.dataset.active=i===index?"true":"false");
    markers.forEach((marker,i)=>marker.dataset.active=i===index?"true":"false");
    if(scroll&&cards[index])cards[index].scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function syncSelected(root=document){
    const selected=readSelected(),list=points();
    const cards=storeCards(root),markers=storeMarkers(root);
    cards.forEach((card,index)=>{
      const isSelected=Boolean(selected&&list[index]&&String(list[index].id)===String(selected.id));
      if(isSelected)card.dataset.pointSelected="true";else card.removeAttribute("data-point-selected");
    });
    markers.forEach((marker,index)=>{
      const isSelected=Boolean(selected&&list[index]&&String(list[index].id)===String(selected.id));
      if(isSelected)marker.dataset.pointSelected="true";else marker.removeAttribute("data-point-selected");
    });
  }

  function refreshLocation(){
    const btn=document.querySelector("[data-td-map-locate]");
    if(btn){btn.disabled=true;btn.dataset.busy="true";btn.textContent="…";}
    if(window.TDGeo&&typeof TDGeo.locate==="function"){TDGeo.locate();return true;}
    if(btn){btn.disabled=false;btn.removeAttribute("data-busy");btn.textContent="◎";}
    return false;
  }

  function fitAll(){
    if(window.TDGeo&&typeof TDGeo.openMap==="function"){TDGeo.openMap();return true;}
    return false;
  }

  function injectMapControls(root=document){
    const sheet=root.querySelector?.(".td-map-sheet")||document.querySelector(".td-map-sheet");
    if(!sheet||sheet.querySelector("[data-td-map-controls]"))return;
    const controls=document.createElement("div");
    controls.className="td-map-quick-controls";
    controls.dataset.tdMapControls="1";
    controls.innerHTML='<button type="button" data-td-map-locate aria-label="Обновить моё местоположение" title="Моё местоположение">◎</button><button type="button" data-td-map-fit aria-label="Показать меня и все найденные магазины" title="Показать всё">⌗</button>';
    sheet.appendChild(controls);
    controls.querySelector("[data-td-map-locate]")?.addEventListener("click",refreshLocation);
    controls.querySelector("[data-td-map-fit]")?.addEventListener("click",fitAll);
  }

  function openCardDetails(index){
    const point=points()[index];
    if(point&&window.TDGeo&&typeof TDGeo.openPointDetails==="function")TDGeo.openPointDetails(point);
  }

  function themeMarkers(root=document){
    const raw=[...root.querySelectorAll("img.leaflet-marker-icon:not([data-td-themed])")];
    const list=points();
    raw.forEach((img,index)=>{
      const point=list[index],meta=metaForPoint(point);
      img.dataset.tdThemed="1";
      img.src=svgMarker(meta);
      img.classList.add("td-themed-marker");
      img.style.width="34px";
      img.style.height="46px";
      img.style.marginLeft="-17px";
      img.style.marginTop="-46px";
      img.alt="";
      if(point)img.title=`${point.chainLabel||point.name||"Магазин"}${Number.isFinite(Number(point.distanceKm))?` · ${Number(point.distanceKm)<1?Math.round(Number(point.distanceKm)*1000)+" м":Number(point.distanceKm).toFixed(1)+" км"}`:""}`;
    });
    storeMarkers(root).forEach((marker,index)=>{
      if(marker.dataset.tdLinked)return;
      marker.dataset.tdLinked="1";
      marker.addEventListener("click",()=>setActive(index,{scroll:true}));
    });
  }

  function decorateCards(root=document){
    const cards=storeCards(root);
    cards.forEach((card,index)=>{
      if(!card.dataset.tdDecorated){
        card.dataset.tdDecorated="1";
        card.tabIndex=0;
        card.setAttribute("role","button");
        const title=card.querySelector("b")?.textContent?.trim()||"Магазин";
        card.setAttribute("aria-label",`Открыть ${title}`);
        const meta=CHAIN_META[title]||{short:"₽",tone:"#0f7b4a"};
        const icon=document.createElement("span");
        icon.className="td-map-store-icon";
        icon.textContent=meta.short;
        icon.style.background=meta.tone;
        card.appendChild(icon);

        const badges=document.createElement("div");
        badges.className="td-map-store-badges";
        if(index===0){
          const near=document.createElement("span");
          near.className="td-map-store-badge near";
          near.textContent="ближе всего";
          badges.appendChild(near);
        }
        const hasSaving=Boolean(card.querySelector(".td-map-basket .save"));
        const hasVerified=Boolean(card.querySelector(".td-map-price-state.ok"));
        if(hasSaving){
          card.dataset.best="true";
          const best=document.createElement("span");
          best.className="td-map-store-badge best";
          best.textContent="выгоднее";
          badges.appendChild(best);
        }else if(hasVerified){
          const verified=document.createElement("span");
          verified.className="td-map-store-badge near";
          verified.textContent="цена подтверждена";
          badges.appendChild(verified);
        }
        if(badges.childNodes.length)card.querySelector(".td-map-store-main")?.appendChild(badges);
      }
      if(!card.dataset.tdLinked){
        card.dataset.tdLinked="1";
        card.addEventListener("click",e=>{
          if(e.target.closest("button,a"))return;
          setActive(index);
          openCardDetails(index);
        });
        card.addEventListener("keydown",e=>{
          if(e.key!=="Enter"&&e.key!==" ")return;
          e.preventDefault();
          setActive(index);
          openCardDetails(index);
        });
      }
    });
  }

  function enhance(){
    injectStyles();
    injectMapControls();
    themeMarkers();
    decorateCards();
    syncSelected();
  }

  let raf=0;
  const obs=new MutationObserver(()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(enhance);});
  function start(){
    enhance();
    obs.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("storage",e=>{if(e.key===SELECTED_KEY)enhance();});
    window.addEventListener("td:selected-store-point-current",enhance);
    window.addEventListener("td:selected-store-point-cleared",enhance);
  }
  window.TDMapTheme={refresh:enhance,syncSelected,setActive,refreshLocation,fitAll};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
