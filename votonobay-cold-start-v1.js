(()=>{
  "use strict";
  if(window.__VotonobayColdStartV1)return;
  window.__VotonobayColdStartV1=true;

  const root=document.documentElement;
  const storageKey="td";
  const navigation=performance.getEntriesByType?.("navigation")?.[0];
  const navigationType=navigation?.type||"navigate";
  let released=false;
  let fallbackTimer=0;

  const style=document.createElement("style");
  style.dataset.votonobayColdStartV1="1";
  style.textContent=`html[data-votonobay-boot="pending"] #app{visibility:hidden!important;opacity:0!important}html[data-votonobay-boot="pending"],html[data-votonobay-boot="pending"] body{background:#050a07!important}`;
  document.head.appendChild(style);
  root.dataset.votonobayBoot="pending";

  // A fresh top-level visit always starts from the Bay-first Home. Basket, city,
  // address and every other persisted field remain untouched. Browser history
  // restores are exempt so Back/Forward keeps its expected in-app destination.
  if(navigationType!=="back_forward"){
    try{
      const saved=JSON.parse(localStorage.getItem(storageKey)||"null");
      if(saved&&typeof saved==="object"&&!Array.isArray(saved)&&saved.screen!=="home"){
        saved.screen="home";
        localStorage.setItem(storageKey,JSON.stringify(saved));
      }
    }catch(error){
      console.warn("[Votonobay] cold-start route guard skipped",error);
    }
  }

  function release(){
    if(released)return;
    released=true;
    if(fallbackTimer)clearTimeout(fallbackTimer);
    root.dataset.votonobayBoot="ready";
    window.dispatchEvent(new CustomEvent("td:votonobay-first-paint-ready"));
  }

  window.addEventListener("td:v2-rendered",event=>{
    if(event.detail?.screen==="home")release();
  });
  window.addEventListener("pageshow",event=>{
    if(event.persisted)release();
  });

  // Fail open if the V2 decorator itself fails: never leave a usable fallback
  // application permanently hidden.
  fallbackTimer=window.setTimeout(release,1800);

  window.TDVotonobayColdStartV1={release,navigationType};
})();
