(function(){
  "use strict";
  let mapInstance=null,raf=0,lastVisible=-1;

  function points(){return window.TDGeo&&Array.isArray(TDGeo.nearby)?TDGeo.nearby:[];}
  function markers(){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function cards(){return [...document.querySelectorAll(".td-map-store")];}
  function reducedMotion(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}

  function captureMap(target,map){
    const id=typeof target==="string"?target:target&&target.id;
    if(id==="td-map")mapInstance=map;
    return map;
  }
  function patchLeaflet(){
    if(!window.L||typeof L.map!=="function"||L.map.__tdCardFocusPatched)return false;
    const original=L.map;
    function wrapped(target,...args){return captureMap(target,original.call(this,target,...args));}
    wrapped.__tdCardFocusPatched=true;
    L.map=wrapped;
    return true;
  }
  function watchLeafletLoad(){
    if(patchLeaflet())return;
    const attach=script=>{
      if(!(script instanceof HTMLScriptElement)||!String(script.src||"").includes("leaflet"))return;
      script.addEventListener("load",patchLeaflet,{once:true});
    };
    document.querySelectorAll("script[src*='leaflet']").forEach(attach);
    new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(attach))).observe(document.documentElement,{childList:true,subtree:true});
  }

  function mapForUi(){return mapInstance&&document.querySelector("#td-map")?mapInstance:null;}
  function markerAt(index){return markers()[index]||null;}
  function pointAt(index){return points()[index]||null;}
  function focusPoint(index,{popup=true}={}){
    const point=pointAt(index),marker=markerAt(index),map=mapForUi();
    if(!point||!marker)return false;
    window.TDMapTheme?.setActive?.(index);
    if(map&&Number.isFinite(Number(point.lat))&&Number.isFinite(Number(point.lon))){
      const zoom=Math.max(Number(map.getZoom?.())||14,15);
      if(reducedMotion())map.setView?.([point.lat,point.lon],zoom,{animate:false});
      else if(typeof map.flyTo==="function")map.flyTo([point.lat,point.lon],zoom,{animate:true,duration:.38,easeLinearity:.22});
      else map.setView?.([point.lat,point.lon],zoom,{animate:true});
    }
    if(popup)setTimeout(()=>{
      const current=markerAt(index);if(!current||current.hidden||current.style.pointerEvents==="none")return;
      current.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window}));
    },reducedMotion()?0:260);
    return true;
  }

  function visibleCardIndex(){
    const list=document.querySelector(".td-map-list");if(!list)return-1;
    const lr=list.getBoundingClientRect(),center=lr.top+lr.height*.42;
    let best=-1,bestDistance=Infinity;
    cards().forEach((card,index)=>{
      if(card.hidden||getComputedStyle(card).display==="none")return;
      const r=card.getBoundingClientRect();
      if(r.bottom<=lr.top||r.top>=lr.bottom)return;
      const d=Math.abs((r.top+r.bottom)/2-center);
      if(d<bestDistance){bestDistance=d;best=index;}
    });
    return best;
  }
  function syncFromScroll(){
    cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
      const index=visibleCardIndex();
      if(index<0||index===lastVisible)return;
      lastVisible=index;
      window.TDMapTheme?.setActive?.(index);
    });
  }
  function installListSync(){
    const list=document.querySelector(".td-map-list");
    if(!list||list.dataset.tdCardFocusScroll)return;
    list.dataset.tdCardFocusScroll="1";
    list.addEventListener("scroll",syncFromScroll,{passive:true});
    syncFromScroll();
  }
  function installCardCapture(){
    document.addEventListener("click",e=>{
      const card=e.target.closest?.(".td-map-store");
      if(!card||e.target.closest("button,a"))return;
      const index=cards().indexOf(card);if(index>=0)focusPoint(index,{popup:true});
    },true);
    document.addEventListener("keydown",e=>{
      if(e.key!=="Enter"&&e.key!==" ")return;
      const card=e.target.closest?.(".td-map-store");if(!card)return;
      const index=cards().indexOf(card);if(index>=0)focusPoint(index,{popup:true});
    },true);
  }
  let installRaf=0;
  const obs=new MutationObserver(()=>{cancelAnimationFrame(installRaf);installRaf=requestAnimationFrame(()=>{installListSync();patchLeaflet();});});
  function start(){
    watchLeafletLoad();installCardCapture();installListSync();
    obs.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("td:selected-store-point-current",e=>{
      const point=e.detail&&e.detail.point,index=points().findIndex(p=>point&&String(p.id)===String(point.id));
      if(index>=0)focusPoint(index,{popup:false});
    });
  }
  window.TDMapCardFocus={focus:focusPoint,get map(){return mapForUi();}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
