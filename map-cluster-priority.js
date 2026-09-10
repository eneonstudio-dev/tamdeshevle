(function(){
  "use strict";
  const SELECTED_KEY="td:selected-store-point";
  const CLUSTER_DISTANCE=54;
  const FILTERS=[
    {id:"all",label:"Все"},
    {id:"verified",label:"✓ Цена"},
    {id:"saving",label:"Выгоднее"},
    {id:"near",label:"До 1 км"}
  ];
  let clusterLayer=null,raf=0,expandedUntil=0,activeFilter="all",mapInstance=null,scrollRaf=0,lastVisible=-1;

  function points(){return window.TDGeo&&Array.isArray(TDGeo.nearby)?TDGeo.nearby:[];}
  function markers(){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function cards(){return [...document.querySelectorAll(".td-map-store")];}
  function selectedId(){try{return JSON.parse(localStorage.getItem(SELECTED_KEY)||"null")?.id||null;}catch{return null;}}
  function reducedMotion(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
  function quote(point){
    if(!point||!window.TDStoreIdBridge)return null;
    try{
      const match=typeof TDStoreIdBridge.resolve==="function"?TDStoreIdBridge.resolve(point):null;
      const basket=typeof TDStoreIdBridge.basket==="function"?TDStoreIdBridge.basket(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:window.state&&state.storeId}):null;
      return{match,basket};
    }catch{return null;}
  }
  function score(point,q,selected){
    let value=selected?100000:0;
    if(q?.basket?.verified&&Number.isFinite(q.basket.savings)&&q.basket.savings>0)value+=50000+Math.min(20000,q.basket.savings);
    if(q?.match?.verified)value+=20000;
    const km=Number(point?.distanceKm);if(Number.isFinite(km))value+=Math.max(0,5000-km*1000);
    return value;
  }
  function priority(point,q,selected){
    if(selected)return"selected";
    if(q?.basket?.verified&&Number.isFinite(q.basket.savings)&&q.basket.savings>0)return"saving";
    if(q?.match?.verified)return"verified";
    return"normal";
  }
  function matchesFilter(item){
    if(activeFilter==="verified")return Boolean(item.quote?.match?.verified);
    if(activeFilter==="saving")return Boolean(item.quote?.basket?.verified&&Number.isFinite(item.quote.basket.savings)&&item.quote.basket.savings>0);
    if(activeFilter==="near")return Number.isFinite(Number(item.point?.distanceKm))&&Number(item.point.distanceKm)<=1;
    return true;
  }
  function rub(v){return `${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;}

  function injectStyles(){
    if(document.getElementById("td-map-cluster-style"))return;
    const s=document.createElement("style");s.id="td-map-cluster-style";s.textContent=`
      .td-map{position:relative}.td-map-filter-bar{position:absolute;left:10px;right:66px;top:10px;z-index:720;display:flex;gap:6px;overflow:auto;padding:2px;scrollbar-width:none;pointer-events:auto}.td-map-filter-bar::-webkit-scrollbar{display:none}.td-map-filter{flex:0 0 auto;border:0;border-radius:999px;min-height:34px;padding:0 10px;background:rgba(255,255,255,.94);color:#4f493f;font:850 10px Manrope,system-ui,sans-serif;box-shadow:0 6px 18px rgba(22,20,16,.14);backdrop-filter:blur(8px);cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}.td-map-filter[aria-pressed="true"]{background:#161410;color:#fff;box-shadow:0 7px 20px rgba(22,20,16,.24)}.td-map-filter:focus-visible{outline:3px solid rgba(15,123,74,.28);outline-offset:2px}.td-map-filter-count{opacity:.66;margin-left:3px;font-size:9px}.td-map-filter-empty{margin:0 0 10px;padding:11px 12px;border-radius:14px;background:#fff;color:#6b6458;font-size:11px;font-weight:750;line-height:1.4;box-shadow:0 8px 20px rgba(22,20,16,.05)}
      .td-map-cluster-layer{position:absolute;inset:0;z-index:650;pointer-events:none;overflow:hidden}.td-map-cluster{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;border:0;min-width:32px;height:32px;border-radius:999px;padding:0 9px;background:#161410;color:#fff;font:900 11px Manrope,system-ui,sans-serif;box-shadow:0 8px 22px rgba(22,20,16,.24);display:flex;align-items:center;justify-content:center;gap:4px;touch-action:manipulation}.td-map-cluster:after{content:"точек";font-size:8px;font-weight:800;opacity:.72}.td-map-cluster[data-priority="saving"]{background:#0f7b4a}.td-map-cluster[data-priority="selected"]{background:#ffe14a;color:#161410;box-shadow:0 0 0 3px rgba(15,123,74,.20),0 8px 22px rgba(22,20,16,.22)}
      .td-map-priority-pill{position:absolute;transform:translate(-50%,-100%);margin-top:-25px;pointer-events:none;white-space:nowrap;border-radius:999px;padding:5px 7px;background:#161410;color:#fff;font:900 8px Manrope,system-ui,sans-serif;box-shadow:0 6px 16px rgba(22,20,16,.18)}.td-map-priority-pill[data-priority="saving"]{background:#0f7b4a}.td-map-priority-pill[data-priority="verified"]{background:#fff;color:#0f7b4a;border:1px solid rgba(15,123,74,.18)}.td-map-priority-pill[data-priority="selected"]{background:#ffe14a;color:#161410}
      .td-map-store[data-map-priority="saving"]{border-color:#0f7b4a}.td-map-store[data-map-priority="saving"] .td-map-distance{background:#0f7b4a;color:#fff}.td-map-store[data-map-priority="verified"] .td-map-distance{color:#0f7b4a}.td-themed-marker[data-map-priority="saving"]{z-index:900!important}.td-themed-marker[data-map-priority="selected"]{z-index:950!important}
      @media(max-width:430px){.td-map-filter-bar{left:8px;right:62px;top:8px}.td-map-filter{min-height:36px;padding:0 10px}.td-map-cluster{min-width:36px;height:36px}.td-map-priority-pill{margin-top:-27px}}
      @media(prefers-reduced-motion:reduce){.td-map-filter{scroll-behavior:auto}}
    `;document.head.appendChild(s);
  }
  function layer(){
    const map=document.querySelector("#td-map.td-map");if(!map)return null;
    if(clusterLayer&&clusterLayer.isConnected)return clusterLayer;
    clusterLayer=document.createElement("div");clusterLayer.className="td-map-cluster-layer";map.appendChild(clusterLayer);return clusterLayer;
  }
  function markerCenter(marker,mapRect){const r=marker.getBoundingClientRect();return{x:r.left+r.width/2-mapRect.left,y:r.top+r.height/2-mapRect.top};}
  function buildGroups(items){
    const groups=[];
    items.forEach(item=>{
      let best=null,bestD=Infinity;
      groups.forEach(g=>{const d=Math.hypot(item.x-g.cx,item.y-g.cy);if(d<CLUSTER_DISTANCE&&d<bestD){best=g;bestD=d;}});
      if(!best){groups.push({items:[item],cx:item.x,cy:item.y});return;}
      best.items.push(item);best.cx=best.items.reduce((s,v)=>s+v.x,0)/best.items.length;best.cy=best.items.reduce((s,v)=>s+v.y,0)/best.items.length;
    });
    return groups;
  }
  function pillText(item){
    if(item.priority==="selected")return"выбрана";
    if(item.priority==="saving"&&Number.isFinite(item.quote?.basket?.savings)&&item.quote.basket.savings>0)return`−${rub(item.quote.basket.savings)}`;
    if(item.priority==="verified")return"✓ цена";
    return"";
  }
  function showPill(root,item){
    const text=pillText(item);if(!text)return;
    const el=document.createElement("span");el.className="td-map-priority-pill";el.dataset.priority=item.priority;el.textContent=text;el.style.left=`${item.x}px`;el.style.top=`${item.y}px`;root.appendChild(el);
  }
  function resetMarker(marker){marker.style.opacity="";marker.style.pointerEvents="";marker.style.marginLeft="-17px";marker.style.marginTop="-46px";marker.removeAttribute("data-map-priority");}
  function applyCardPriority(items){cards().forEach((card,i)=>{const p=items[i]?.priority||"normal";if(p==="normal")card.removeAttribute("data-map-priority");else card.dataset.mapPriority=p;});}
  function applyFilterVisibility(items){
    const cs=cards();
    items.forEach(item=>{
      const visible=matchesFilter(item);
      item.visible=visible;
      if(cs[item.index])cs[item.index].hidden=!visible;
      if(!visible){item.marker.style.opacity="0";item.marker.style.pointerEvents="none";}
    });
  }
  function updateEmptyState(items){
    const list=document.querySelector(".td-map-list");if(!list)return;
    const visible=items.filter(item=>item.visible).length;
    let empty=list.querySelector(".td-map-filter-empty");
    if(visible||activeFilter==="all"){empty?.remove();return;}
    if(!empty){empty=document.createElement("div");empty.className="td-map-filter-empty";list.prepend(empty);}
    empty.textContent=activeFilter==="saving"?"Пока нет точек с подтверждённой экономией для этой корзины.":activeFilter==="verified"?"Пока нет точек с подтверждённой ценой.":"В пределах 1 км поддерживаемых магазинов пока нет.";
  }
  function filterCounts(items){
    return{
      all:items.length,
      verified:items.filter(item=>item.quote?.match?.verified).length,
      saving:items.filter(item=>item.quote?.basket?.verified&&Number.isFinite(item.quote.basket.savings)&&item.quote.basket.savings>0).length,
      near:items.filter(item=>Number.isFinite(Number(item.point?.distanceKm))&&Number(item.point.distanceKm)<=1).length
    };
  }
  function ensureFilterBar(items){
    const map=document.querySelector("#td-map.td-map");if(!map)return;
    let bar=map.querySelector(".td-map-filter-bar");
    if(!bar){
      bar=document.createElement("div");bar.className="td-map-filter-bar";bar.setAttribute("role","group");bar.setAttribute("aria-label","Фильтр магазинов на карте");
      FILTERS.forEach(filter=>{
        const btn=document.createElement("button");btn.type="button";btn.className="td-map-filter";btn.dataset.mapFilter=filter.id;btn.addEventListener("click",()=>{if(activeFilter===filter.id)return;activeFilter=filter.id;expandedUntil=0;schedule();});bar.appendChild(btn);
      });
      map.appendChild(bar);
    }
    const counts=filterCounts(items);
    FILTERS.forEach(filter=>{
      const btn=bar.querySelector(`[data-map-filter="${filter.id}"]`);if(!btn)return;
      btn.setAttribute("aria-pressed",activeFilter===filter.id?"true":"false");
      btn.innerHTML=`${filter.label}<span class="td-map-filter-count">${counts[filter.id]}</span>`;
    });
  }
  function expandGroup(group){
    expandedUntil=Date.now()+3500;
    group.items.forEach((item,i)=>{
      const angle=(Math.PI*2*i)/group.items.length-Math.PI/2,radius=Math.min(44,22+group.items.length*3);
      item.marker.style.opacity="1";item.marker.style.pointerEvents="auto";item.marker.style.marginLeft=`${-17+Math.cos(angle)*radius}px`;item.marker.style.marginTop=`${-46+Math.sin(angle)*radius}px`;
    });
    layer()?.replaceChildren();setTimeout(schedule,3600);
  }

  function patchLeaflet(){
    if(!window.L||typeof L.map!=="function"||L.map.__tdFocusPatched)return false;
    const original=L.map;
    function wrapped(target,...args){const instance=original.call(this,target,...args),id=typeof target==="string"?target:target&&target.id;if(id==="td-map")mapInstance=instance;return instance;}
    wrapped.__tdFocusPatched=true;L.map=wrapped;return true;
  }
  function watchLeaflet(){
    if(patchLeaflet())return;
    const attach=node=>{if(node instanceof HTMLScriptElement&&String(node.src||"").includes("leaflet"))node.addEventListener("load",patchLeaflet,{once:true});};
    document.querySelectorAll("script[src*='leaflet']").forEach(attach);
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(attach))).observe(document.documentElement,{childList:true,subtree:true});
  }
  function focusPoint(index,{popup=true}={}){
    const point=points()[index],marker=markers()[index];if(!point||!marker)return false;
    window.TDMapTheme?.setActive?.(index);
    if(mapInstance&&document.querySelector("#td-map")&&Number.isFinite(Number(point.lat))&&Number.isFinite(Number(point.lon))){
      const zoom=Math.max(Number(mapInstance.getZoom?.())||14,15);
      if(reducedMotion())mapInstance.setView?.([point.lat,point.lon],zoom,{animate:false});
      else if(typeof mapInstance.flyTo==="function")mapInstance.flyTo([point.lat,point.lon],zoom,{animate:true,duration:.38,easeLinearity:.22});
      else mapInstance.setView?.([point.lat,point.lon],zoom,{animate:true});
    }
    if(popup)setTimeout(()=>{const current=markers()[index];if(current&&current.style.pointerEvents!=="none")current.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));},reducedMotion()?0:260);
    return true;
  }
  function visibleCardIndex(){
    const list=document.querySelector(".td-map-list");if(!list)return-1;
    const lr=list.getBoundingClientRect(),center=lr.top+lr.height*.42;let best=-1,bestD=Infinity;
    cards().forEach((card,index)=>{if(card.hidden||getComputedStyle(card).display==="none")return;const r=card.getBoundingClientRect();if(r.bottom<=lr.top||r.top>=lr.bottom)return;const d=Math.abs((r.top+r.bottom)/2-center);if(d<bestD){bestD=d;best=index;}});
    return best;
  }
  function syncListFocus(){cancelAnimationFrame(scrollRaf);scrollRaf=requestAnimationFrame(()=>{const index=visibleCardIndex();if(index<0||index===lastVisible)return;lastVisible=index;window.TDMapTheme?.setActive?.(index);});}
  function installListSync(){const list=document.querySelector(".td-map-list");if(!list||list.dataset.tdFocusScroll)return;list.dataset.tdFocusScroll="1";list.addEventListener("scroll",syncListFocus,{passive:true});syncListFocus();}
  function installCardFocus(){
    document.addEventListener("click",e=>{const card=e.target.closest?.(".td-map-store");if(!card||e.target.closest("button,a"))return;const index=cards().indexOf(card);if(index>=0)focusPoint(index,{popup:true});},true);
    document.addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const card=e.target.closest?.(".td-map-store");if(!card)return;const index=cards().indexOf(card);if(index>=0)focusPoint(index,{popup:true});},true);
  }

  function render(){
    injectStyles();
    const root=layer(),mapEl=document.querySelector("#td-map.td-map"),list=points(),ms=markers();
    if(!root||!mapEl||!list.length||!ms.length)return;
    root.replaceChildren();ms.forEach(resetMarker);
    const rect=mapEl.getBoundingClientRect(),selected=String(selectedId()||"");
    const all=ms.map((marker,index)=>{const point=list[index],q=quote(point),isSelected=Boolean(point&&selected&&String(point.id)===selected),pos=markerCenter(marker,rect);return{marker,index,point,quote:q,priority:priority(point,q,isSelected),score:score(point,q,isSelected),visible:true,...pos};});
    applyCardPriority(all);ensureFilterBar(all);applyFilterVisibility(all);updateEmptyState(all);
    const items=all.filter(x=>x.visible&&x.point&&x.x>-40&&x.y>-60&&x.x<rect.width+40&&x.y<rect.height+60);
    if(Date.now()<expandedUntil){items.forEach(i=>showPill(root,i));return;}
    buildGroups(items).forEach(group=>{
      if(group.items.length===1){const item=group.items[0];if(item.priority!=="normal")item.marker.dataset.mapPriority=item.priority;showPill(root,item);return;}
      const winner=[...group.items].sort((a,b)=>b.score-a.score)[0];winner.marker.dataset.mapPriority=winner.priority;
      group.items.forEach(item=>{if(item!==winner){item.marker.style.opacity="0";item.marker.style.pointerEvents="none";}});
      showPill(root,winner);
      const btn=document.createElement("button");btn.type="button";btn.className="td-map-cluster";btn.dataset.priority=winner.priority;btn.textContent=String(group.items.length);btn.setAttribute("aria-label",`Показать ${group.items.length} магазинов рядом`);btn.style.left=`${winner.x}px`;btn.style.top=`${winner.y-16}px`;btn.addEventListener("click",e=>{e.stopPropagation();expandGroup(group);});root.appendChild(btn);
    });
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
  function install(){
    patchLeaflet();installListSync();schedule();const map=document.querySelector("#td-map.td-map");if(!map)return;
    if(!map.dataset.tdClusterEvents){map.dataset.tdClusterEvents="1";["pointerup","touchend","wheel","dblclick"].forEach(ev=>map.addEventListener(ev,()=>setTimeout(schedule,180),{passive:true}));}
    const pane=map.querySelector(".leaflet-map-pane");if(pane&&!pane.dataset.tdClusterObserved){pane.dataset.tdClusterObserved="1";new MutationObserver(schedule).observe(pane,{attributes:true,attributeFilter:["style","class"]});}
  }
  const obs=new MutationObserver(mutations=>{if(mutations.every(m=>m.target?.closest?.(".td-map-cluster-layer,.td-map-filter-bar")))return;schedule();installListSync();});
  function start(){watchLeaflet();installCardFocus();obs.observe(document.body,{childList:true,subtree:true});injectStyles();schedule();setInterval(()=>{if(document.querySelector("#td-map.td-map"))install();},800);window.addEventListener("resize",schedule);window.addEventListener("td:retailer-prices-applied",schedule);window.addEventListener("td:selected-store-point-current",schedule);window.addEventListener("td:selected-store-point-cleared",schedule);}
  window.TDMapClusterPriority={refresh:schedule,focus:focusPoint,get filter(){return activeFilter;},setFilter(id){if(FILTERS.some(f=>f.id===id)){activeFilter=id;expandedUntil=0;schedule();return true;}return false;}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
