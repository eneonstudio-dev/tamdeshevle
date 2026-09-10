(function(){
  "use strict";
  let suppressScrollSyncUntil=0;

  function markers(){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function cards(){return [...document.querySelectorAll(".td-map-store")];}
  function reducedMotion(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}

  function setActive(index){
    window.TDMapTheme?.setActive?.(index);
    const cs=cards(),ms=markers();
    cs.forEach((card,i)=>card.dataset.active=i===index?"true":"false");
    ms.forEach((marker,i)=>marker.dataset.active=i===index?"true":"false");
  }

  function centerCard(index){
    const list=document.querySelector(".td-map-list"),card=cards()[index];
    if(!list||!card||card.hidden||getComputedStyle(card).display==="none")return false;
    const top=card.offsetTop-(list.clientHeight-card.offsetHeight)/2;
    suppressScrollSyncUntil=performance.now()+520;
    list.scrollTo({top:Math.max(0,top),behavior:reducedMotion()?"auto":"smooth"});
    setActive(index);
    return true;
  }

  function markerIndex(marker){return markers().indexOf(marker);}
  function install(){
    document.addEventListener("click",e=>{
      const marker=e.target.closest?.("img.leaflet-marker-icon.td-themed-marker");
      if(!marker||marker.style.pointerEvents==="none")return;
      const index=markerIndex(marker);if(index<0)return;
      requestAnimationFrame(()=>centerCard(index));
    },true);

    document.addEventListener("keydown",e=>{
      if(e.key!=="Enter"&&e.key!==" ")return;
      const marker=e.target.closest?.("img.leaflet-marker-icon.td-themed-marker");
      if(!marker)return;
      const index=markerIndex(marker);if(index<0)return;
      requestAnimationFrame(()=>centerCard(index));
    },true);

    const listObserver=new MutationObserver(()=>{
      const list=document.querySelector(".td-map-list");
      if(list&&!list.dataset.tdMarkerCardSync){
        list.dataset.tdMarkerCardSync="1";
        list.addEventListener("scroll",()=>{
          if(performance.now()<suppressScrollSyncUntil)return;
        },{passive:true});
      }
    });
    listObserver.observe(document.body,{childList:true,subtree:true});
  }

  window.TDMapMarkerCardSync={center:centerCard};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
