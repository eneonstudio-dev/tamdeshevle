(function(){
  "use strict";

  function markers(){return [...document.querySelectorAll("img.leaflet-marker-icon.td-themed-marker")];}
  function cards(){return [...document.querySelectorAll(".td-map-store")];}
  function reducedMotion(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}

  function ensurePopupCard(){
    if(window.TDMapPopupCard||document.querySelector('script[data-td-map-popup-card]'))return;
    const s=document.createElement("script");s.src="map-popup-card.js?v=20260911-popup-v1";s.dataset.tdMapPopupCard="1";document.head.appendChild(s);
  }

  function setActive(index){
    window.TDMapTheme?.setActive?.(index);
    const cs=cards(),ms=markers();
    cs.forEach((card,i)=>card.dataset.active=i===index?"true":"false");
    ms.forEach((marker,i)=>marker.dataset.active=i===index?"true":"false");
  }

  function centerCard(index){
    const list=document.querySelector(".td-map-list"),card=cards()[index];
    if(!list||!card||card.hidden||getComputedStyle(card).display==="none")return false;
    const lr=list.getBoundingClientRect(),cr=card.getBoundingClientRect();
    const delta=(cr.top+cr.height/2)-(lr.top+lr.height/2);
    const top=Math.max(0,list.scrollTop+delta);
    list.scrollTo({top,behavior:reducedMotion()?"auto":"smooth"});
    setActive(index);
    card.dataset.markerFocused="true";
    setTimeout(()=>card.removeAttribute("data-marker-focused"),650);
    return true;
  }

  function markerIndex(marker){return markers().indexOf(marker);}
  function onMarker(marker){
    if(!marker||marker.style.pointerEvents==="none"||marker.style.opacity==="0")return false;
    const index=markerIndex(marker);if(index<0)return false;
    requestAnimationFrame(()=>centerCard(index));
    return true;
  }

  function install(){
    ensurePopupCard();
    document.addEventListener("click",e=>onMarker(e.target.closest?.("img.leaflet-marker-icon.td-themed-marker")),true);
    document.addEventListener("keydown",e=>{
      if(e.key!=="Enter"&&e.key!==" ")return;
      onMarker(e.target.closest?.("img.leaflet-marker-icon.td-themed-marker"));
    },true);
  }

  window.TDMapMarkerCardSync={center:centerCard};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
})();
