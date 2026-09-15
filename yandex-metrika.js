// Closed-beta A–F replay marker only; no runtime behavior change.
(()=>{
  "use strict";
  const CONSENT_KEY="td:analytics-consent";
  const src="https://mc.yandex.ru/metrika/tag.js?id=112427683";

  function hasConsent(){
    try{return localStorage.getItem(CONSENT_KEY)==="granted"}catch{return false}
  }
  function grant(){
    try{localStorage.setItem(CONSENT_KEY,"granted")}catch{return false}
    boot();
    return true;
  }
  function revoke(){
    try{localStorage.setItem(CONSENT_KEY,"denied")}catch{}
    return true;
  }
  function boot(){
    if(!hasConsent())return false;
    window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};
    window.ym.l=Date.now();
    if(![...document.scripts].some(script=>script.src===src)){
      const script=document.createElement("script");
      script.async=true;
      script.src=src;
      document.head.appendChild(script);
    }
    window.ym(112427683,"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
    return true;
  }

  window.TDAnalyticsConsent={key:CONSENT_KEY,hasConsent,grant,revoke,boot};
  boot();
})();