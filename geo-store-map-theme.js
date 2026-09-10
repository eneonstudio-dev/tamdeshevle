(function(){
  "use strict";

  const CHAIN_META={
    "Пятёрочка":{short:"5",tone:"#16a34a"},
    "Магнит":{short:"М",tone:"#ef4444"},
    "Перекрёсток":{short:"П",tone:"#22c55e"},
    "Лента":{short:"Л",tone:"#2563eb"},
    "Дикси":{short:"Д",tone:"#f59e0b"}
  };

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
      .td-map-store{position:relative;border:1px solid rgba(22,20,16,.06);box-shadow:0 10px 24px rgba(22,20,16,.06);padding:13px 13px 13px 58px;min-height:86px;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
      .td-map-store:active{transform:scale(.992)}
      .td-map-store[data-best="true"]{border-color:rgba(15,123,74,.28);box-shadow:0 12px 28px rgba(15,123,74,.10)}
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
      .leaflet-popup-content-wrapper{border-radius:16px;box-shadow:0 12px 30px rgba(22,20,16,.16)}
      .leaflet-popup-content{font-family:Manrope,system-ui,sans-serif;font-size:12px;line-height:1.45;margin:12px 14px}
      .td-themed-marker{filter:drop-shadow(0 4px 6px rgba(15,123,74,.22))}
      @media (min-width:700px){.td-map-sheet{left:50%;right:auto;width:min(680px,100%);transform:translateX(-50%);box-shadow:0 0 70px rgba(22,20,16,.22)}}
      @media (prefers-reduced-motion:reduce){.td-map-store{transition:none}}
    `;
    document.head.appendChild(s);
  }

  function svgMarker(){
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 32 44"><path fill="#0f7b4a" d="M16 1C7.7 1 1 7.7 1 16c0 10.9 15 27 15 27s15-16.1 15-27C31 7.7 24.3 1 16 1z"/><circle cx="16" cy="16" r="9" fill="#fff"/><path fill="#0f7b4a" d="M12 11h8v3h-2.4c1.8.8 2.9 2.3 2.9 4.4 0 3-2.2 5-5.7 5H12v-3h2.7c1.7 0 2.6-.7 2.6-2s-.9-2-2.6-2H12V11z"/></svg>`;
    return "data:image/svg+xml;charset=UTF-8,"+encodeURIComponent(svg);
  }

  function themeMarkers(root=document){
    root.querySelectorAll("img.leaflet-marker-icon:not([data-td-themed])").forEach(img=>{
      img.dataset.tdThemed="1";
      img.src=svgMarker();
      img.classList.add("td-themed-marker");
      img.style.width="32px";
      img.style.height="44px";
      img.style.marginLeft="-16px";
      img.style.marginTop="-44px";
    });
  }

  function decorateCards(root=document){
    const cards=[...root.querySelectorAll(".td-map-store")];
    cards.forEach((card,index)=>{
      if(card.dataset.tdDecorated)return;
      card.dataset.tdDecorated="1";
      const title=card.querySelector("b")?.textContent?.trim()||"Магазин";
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
    });
  }

  function enhance(){
    injectStyles();
    themeMarkers();
    decorateCards();
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(enhance));
  function start(){
    enhance();
    obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
