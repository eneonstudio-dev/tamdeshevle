(function(){
  "use strict";
  const SELECTED_KEY="td:selected-store-point";
  const CLUSTER_DISTANCE=54;
  let clusterLayer=null,raf=0,expandedUntil=0;

  function points(){return window.TDGeo&&Array.isArray(TDGeo.nearby)?TDGeo.nearby:[];}
  function markers(){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function cards(){return [...document.querySelectorAll(".td-map-store")];}
  function selectedId(){try{return JSON.parse(localStorage.getItem(SELECTED_KEY)||"null")?.id||null;}catch{return null;}}
  function quote(point){
    if(!point||!window.TDStoreIdBridge)return null;
    try{
      const match=typeof TDStoreIdBridge.resolve==="function"?TDStoreIdBridge.resolve(point):null;
      const basket=typeof TDStoreIdBridge.basket==="function"?TDStoreIdBridge.basket(point,{products:typeof PRODUCTS!=="undefined"?PRODUCTS:[],cart:window.state&&state.cart||{},stores:typeof STORES!=="undefined"?STORES:[],referenceStoreId:window.state&&state.storeId}):null;
      return{match,basket};
    }catch{return null;}
  }
  function score(point){
    const q=quote(point),selected=String(selectedId()||"")===String(point?.id||"");
    let value=selected?100000:0;
    if(q?.basket?.verified&&Number.isFinite(q.basket.savings)&&q.basket.savings>0)value+=50000+Math.min(20000,q.basket.savings);
    if(q?.match?.verified)value+=20000;
    const km=Number(point?.distanceKm);if(Number.isFinite(km))value+=Math.max(0,5000-km*1000);
    return value;
  }
  function priority(point){
    const q=quote(point);
    if(String(selectedId()||"")===String(point?.id||""))return"selected";
    if(q?.basket?.verified&&Number.isFinite(q.basket.savings)&&q.basket.savings>0)return"saving";
    if(q?.match?.verified)return"verified";
    return"normal";
  }
  function rub(v){return `${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;}

  function injectStyles(){
    if(document.getElementById("td-map-cluster-style"))return;
    const s=document.createElement("style");s.id="td-map-cluster-style";s.textContent=`
      .td-map{position:relative}.td-map-cluster-layer{position:absolute;inset:0;z-index:650;pointer-events:none;overflow:hidden}.td-map-cluster{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;border:0;min-width:32px;height:32px;border-radius:999px;padding:0 9px;background:#161410;color:#fff;font:900 11px Manrope,system-ui,sans-serif;box-shadow:0 8px 22px rgba(22,20,16,.24);display:flex;align-items:center;justify-content:center;gap:4px;touch-action:manipulation}.td-map-cluster:after{content:"точек";font-size:8px;font-weight:800;opacity:.72}.td-map-cluster[data-priority="saving"]{background:#0f7b4a}.td-map-cluster[data-priority="selected"]{background:#ffe14a;color:#161410;box-shadow:0 0 0 3px rgba(15,123,74,.20),0 8px 22px rgba(22,20,16,.22)}
      .td-map-priority-pill{position:absolute;transform:translate(-50%,-100%);margin-top:-25px;pointer-events:none;white-space:nowrap;border-radius:999px;padding:5px 7px;background:#161410;color:#fff;font:900 8px Manrope,system-ui,sans-serif;box-shadow:0 6px 16px rgba(22,20,16,.18)}.td-map-priority-pill[data-priority="saving"]{background:#0f7b4a}.td-map-priority-pill[data-priority="verified"]{background:#fff;color:#0f7b4a;border:1px solid rgba(15,123,74,.18)}.td-map-priority-pill[data-priority="selected"]{background:#ffe14a;color:#161410}
      .td-map-store[data-map-priority="saving"]{border-color:#0f7b4a}.td-map-store[data-map-priority="saving"] .td-map-distance{background:#0f7b4a;color:#fff}.td-map-store[data-map-priority="verified"] .td-map-distance{color:#0f7b4a}.td-themed-marker[data-map-priority="saving"]{z-index:900!important}.td-themed-marker[data-map-priority="selected"]{z-index:950!important}
      @media(max-width:430px){.td-map-cluster{min-width:36px;height:36px}.td-map-priority-pill{margin-top:-27px}}
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
  function pillText(point,p){
    const q=quote(point);
    if(p==="selected")return"выбрана";
    if(p==="saving"&&Number.isFinite(q?.basket?.savings)&&q.basket.savings>0)return`−${rub(q.basket.savings)}`;
    if(p==="verified")return"✓ цена";
    return"";
  }
  function showPill(root,item){
    const p=priority(item.point),text=pillText(item.point,p);if(!text)return;
    const el=document.createElement("span");el.className="td-map-priority-pill";el.dataset.priority=p;el.textContent=text;el.style.left=`${item.x}px`;el.style.top=`${item.y}px`;root.appendChild(el);
  }
  function resetMarker(marker){marker.style.opacity="";marker.style.pointerEvents="";marker.style.marginLeft="-17px";marker.style.marginTop="-46px";marker.removeAttribute("data-map-priority");}
  function applyCardPriority(list){cards().forEach((card,i)=>{const p=priority(list[i]);if(p==="normal")card.removeAttribute("data-map-priority");else card.dataset.mapPriority=p;});}
  function expandGroup(group){
    expandedUntil=Date.now()+3500;
    group.items.forEach((item,i)=>{
      const angle=(Math.PI*2*i)/group.items.length-Math.PI/2,radius=Math.min(44,22+group.items.length*3);
      item.marker.style.opacity="1";item.marker.style.pointerEvents="auto";item.marker.style.marginLeft=`${-17+Math.cos(angle)*radius}px`;item.marker.style.marginTop=`${-46+Math.sin(angle)*radius}px`;
    });
    layer()?.replaceChildren();setTimeout(schedule,3600);
  }
  function render(){
    injectStyles();
    const root=layer(),mapEl=document.querySelector("#td-map.td-map"),list=points(),ms=markers();
    if(!root||!mapEl||!list.length||!ms.length)return;
    root.replaceChildren();ms.forEach(resetMarker);applyCardPriority(list);
    const rect=mapEl.getBoundingClientRect();
    const items=ms.map((marker,index)=>({marker,index,point:list[index],...markerCenter(marker,rect)})).filter(x=>x.point&&x.x>-40&&x.y>-60&&x.x<rect.width+40&&x.y<rect.height+60);
    if(Date.now()<expandedUntil){items.forEach(i=>showPill(root,i));return;}
    buildGroups(items).forEach(group=>{
      if(group.items.length===1){const item=group.items[0],p=priority(item.point);if(p!=="normal")item.marker.dataset.mapPriority=p;showPill(root,item);return;}
      const winner=[...group.items].sort((a,b)=>score(b.point)-score(a.point))[0],p=priority(winner.point);winner.marker.dataset.mapPriority=p;
      group.items.forEach(item=>{if(item!==winner){item.marker.style.opacity="0";item.marker.style.pointerEvents="none";}});
      showPill(root,winner);
      const btn=document.createElement("button");btn.type="button";btn.className="td-map-cluster";btn.dataset.priority=p;btn.textContent=String(group.items.length);btn.setAttribute("aria-label",`Показать ${group.items.length} магазинов рядом`);btn.style.left=`${winner.x}px`;btn.style.top=`${winner.y-16}px`;btn.addEventListener("click",e=>{e.stopPropagation();expandGroup(group);});root.appendChild(btn);
    });
  }
  function schedule(){cancelAnimationFrame(raf);raf=requestAnimationFrame(render);}
  function install(){
    schedule();const map=document.querySelector("#td-map.td-map");if(!map)return;
    if(!map.dataset.tdClusterEvents){map.dataset.tdClusterEvents="1";["pointerup","touchend","wheel","dblclick"].forEach(ev=>map.addEventListener(ev,()=>setTimeout(schedule,180),{passive:true}));}
    const pane=map.querySelector(".leaflet-map-pane");if(pane&&!pane.dataset.tdClusterObserved){pane.dataset.tdClusterObserved="1";new MutationObserver(schedule).observe(pane,{attributes:true,subtree:true,attributeFilter:["style","class"]});}
  }
  const obs=new MutationObserver(()=>schedule());
  function start(){obs.observe(document.body,{childList:true,subtree:true});injectStyles();schedule();setInterval(()=>{if(document.querySelector("#td-map.td-map"))install();},800);window.addEventListener("resize",schedule);window.addEventListener("td:retailer-prices-applied",schedule);window.addEventListener("td:selected-store-point-current",schedule);window.addEventListener("td:selected-store-point-cleared",schedule);}
  window.TDMapClusterPriority={refresh:schedule};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
