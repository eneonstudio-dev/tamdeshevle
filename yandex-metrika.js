(()=>{
  "use strict";
  const src="https://mc.yandex.ru/metrika/tag.js?id=112427683";
  window.ym=window.ym||function(){(window.ym.a=window.ym.a||[]).push(arguments)};
  window.ym.l=Date.now();
  if(![...document.scripts].some(script=>script.src===src)){
    const script=document.createElement("script");
    script.async=true;
    script.src=src;
    document.head.appendChild(script);
  }
  window.ym(112427683,"init",{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
})();
