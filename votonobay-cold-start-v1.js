(()=>{
  "use strict";
  if(window.__VotonobayColdStartV1)return;
  window.__VotonobayColdStartV1=true;

  const root=document.documentElement;
  const storageKey="td";
  const navigation=performance.getEntriesByType?.("navigation")?.[0];
  const navigationType=navigation?.type||"navigate";
  const HOME_COPY="Спросить Бая";
  const ROXY_SCRIPT="votonobay-roxy-home-v1.js?v=20260914-opening-v1";
  const ROXY_CSS="votonobay-roxy-home-tune-v1.css?v=20260914-opening-v1";
  let released=false;
  let observer=null;
  let recoveryTimer=0;
  let stalledTimer=0;
  let cssReady=false;
  let lastV2Screen="";

  const style=document.createElement("style");
  style.dataset.votonobayColdStartV1="1";
  style.textContent=`
    html[data-votonobay-boot="pending"] #app,
    html[data-votonobay-boot="stalled"] #app{visibility:hidden!important;opacity:0!important}
    html[data-votonobay-boot="pending"],html[data-votonobay-boot="pending"] body,
    html[data-votonobay-boot="stalled"],html[data-votonobay-boot="stalled"] body{background:#050a07!important}
    html[data-votonobay-boot="pending"]::before,
    html[data-votonobay-boot="stalled"]::before{content:"";position:fixed;inset:0;z-index:2147483000;background:radial-gradient(circle at 50% 36%,rgba(38,112,73,.22),transparent 34%),linear-gradient(180deg,#08110c 0%,#050a07 100%);pointer-events:none}
    html[data-votonobay-boot="pending"]::after,
    html[data-votonobay-boot="stalled"]::after{content:"Votonobay\A Бай готовит главную…";white-space:pre;position:fixed;z-index:2147483001;left:50%;top:50%;transform:translate(-50%,-50%);width:min(82vw,360px);text-align:center;color:#f3f8f5;font:800 22px/1.45 Manrope,system-ui,-apple-system,sans-serif;letter-spacing:-.035em;pointer-events:none}
    html[data-votonobay-boot="pending"]::after{animation:votonobayBootPulse 1.5s ease-in-out infinite alternate}
    html[data-votonobay-boot="stalled"]::after{content:"Votonobay\A Главная не загрузилась. Обнови страницу.";font-size:18px;line-height:1.5}
    @keyframes votonobayBootPulse{from{opacity:.66}to{opacity:1}}
    @media(prefers-reduced-motion:reduce){html[data-votonobay-boot="pending"]::after{animation:none}}
  `;
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

  function ensureRoxyAssets(){
    let link=document.querySelector('link[data-roxy-home-tune]');
    if(!link){
      link=document.createElement("link");
      link.rel="stylesheet";
      link.href=ROXY_CSS;
      link.dataset.roxyHomeTune="1";
      document.head.appendChild(link);
    }
    if(link.sheet)cssReady=true;
    else link.addEventListener("load",()=>{cssReady=true;tryRelease("roxy-css")},{once:true});

    if(!window.TDRoxyHome&&!document.querySelector('script[data-roxy-home-preload]')){
      const script=document.createElement("script");
      script.src=ROXY_SCRIPT;
      script.async=true;
      script.dataset.roxyHomePreload="1";
      script.addEventListener("load",()=>{window.TDRoxyHome?.decorate?.();tryRelease("roxy-script")},{once:true});
      script.addEventListener("error",()=>console.warn("[Votonobay] Roxy Home preload failed"),{once:true});
      document.head.appendChild(script);
    }
  }

  function appScreen(){
    return String(window.state?.screen||document.getElementById("app")?.dataset.screen||"");
  }

  function canonicalHomeReady(){
    const app=document.getElementById("app");
    const hero=app?.querySelector('.v2-hero.v2-bay-first[data-roxy-approved="1"]');
    const title=hero?.querySelector(".v2-hero-copy h1")?.textContent||"";
    const tune=document.querySelector('link[data-roxy-home-tune]');
    if(tune?.sheet)cssReady=true;
    return appScreen()==="home"&&Boolean(hero)&&title.includes(HOME_COPY)&&cssReady;
  }

  function restoredScreenReady(){
    if(navigationType!=="back_forward")return false;
    const screen=appScreen();
    if(!screen)return false;
    if(screen==="home")return canonicalHomeReady();
    const app=document.getElementById("app");
    return lastV2Screen===screen&&Boolean(app?.children?.length);
  }

  function cleanup(){
    observer?.disconnect?.();
    observer=null;
    if(recoveryTimer)clearTimeout(recoveryTimer);
    if(stalledTimer)clearTimeout(stalledTimer);
  }

  function release(reason="canonical"){
    if(released)return false;
    if(!canonicalHomeReady()&&!restoredScreenReady())return false;
    released=true;
    cleanup();
    root.dataset.votonobayBoot="ready";
    root.dataset.votonobayBootReason=reason;
    window.dispatchEvent(new CustomEvent("td:votonobay-first-paint-ready",{detail:{reason,screen:appScreen()}}));
    return true;
  }

  function tryRelease(reason="check"){
    if(released)return true;
    if(appScreen()==="home")window.TDRoxyHome?.decorate?.();
    return release(reason);
  }

  ensureRoxyAssets();

  if(typeof MutationObserver==="function"){
    observer=new MutationObserver(()=>tryRelease("dom"));
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["data-screen","data-roxy-approved"]});
  }

  window.addEventListener("td:roxy-home-ready",()=>tryRelease("roxy-home"));
  window.addEventListener("td:v2-rendered",event=>{
    lastV2Screen=String(event.detail?.screen||appScreen());
    if(lastV2Screen==="home")window.TDRoxyHome?.decorate?.();
    requestAnimationFrame(()=>tryRelease("v2-rendered"));
  });
  window.addEventListener("pageshow",()=>requestAnimationFrame(()=>tryRelease("pageshow")));
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState!=="visible"||released)return;
    ensureRoxyAssets();
    window.TDRoxyHome?.decorate?.();
    requestAnimationFrame(()=>tryRelease("visible"));
  });

  // Recovery retries the canonical render. It never reveals legacy UI just
  // because startup is slow: after the safety window the branded boot surface
  // remains visible instead of exposing an intermediate/retired screen.
  recoveryTimer=window.setTimeout(()=>{
    if(released)return;
    ensureRoxyAssets();
    try{window.render?.()}catch(error){console.warn("[Votonobay] cold-start recovery render skipped",error)}
    window.TDRoxyHome?.decorate?.();
    requestAnimationFrame(()=>tryRelease("recovery"));
  },8000);
  stalledTimer=window.setTimeout(()=>{
    if(released)return;
    root.dataset.votonobayBoot="stalled";
  },20000);

  window.TDVotonobayColdStartV1={release,tryRelease,canonicalHomeReady,restoredScreenReady,ensureRoxyAssets,navigationType};
})();
