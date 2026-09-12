(()=>{
  "use strict";

  const BRAND="Votonobay";
  const TAGLINE="Собери корзину — покажем, как лучше";
  const TITLE="Votonobay — как лучше собрать корзину";
  const THEME="#102018";
  let raf=0;
  let observer=null;

  function ensureCss(){
    if(document.querySelector('link[data-votonobay-brand]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-brand-v1.css?v=20260912-v1";
    link.dataset.votonobayBrand="1";
    document.head.appendChild(link);
  }

  function removeLegacyBrand(){
    document.body?.classList.remove("td-prosche");
    document.querySelectorAll('link[data-prosche-visual-v2]').forEach(link=>link.remove());
  }

  function tuneMetadata(){
    document.title=TITLE;
    const theme=document.querySelector('meta[name="theme-color"]');
    if(theme)theme.setAttribute("content",THEME);
    let description=document.querySelector('meta[name="description"]');
    if(!description){description=document.createElement("meta");description.name="description";document.head.appendChild(description);}
    description.content="Votonobay помогает понять, как лучше собрать корзину: по цене, удобству и подтверждённости данных.";
  }

  function tuneV2Brand(){
    document.querySelectorAll(".v2-brand").forEach(button=>{
      button.setAttribute("aria-label","Votonobay — на главную");
      const span=button.querySelector("span");
      if(span)span.textContent=BRAND;
    });
  }

  function tuneInnerBrand(){
    document.querySelectorAll("header.app:not(.v2-header)").forEach(header=>{
      const title=header.querySelector("h1");
      if(title&&/^(Тамдешевле|Там дешевле|Проще)$/i.test(title.textContent.trim()))title.textContent=BRAND;
      const sub=header.querySelector(".sub");
      if(title&&title.textContent.trim()===BRAND&&sub)sub.textContent=TAGLINE;
      const home=header.querySelector(".brand-home");
      if(home){home.setAttribute("aria-label","Votonobay — на главную");home.dataset.votonobayBrand="1";}
    });
  }

  function decorate(){
    if(typeof document==="undefined")return false;
    ensureCss();removeLegacyBrand();tuneMetadata();
    document.body?.classList.add("td-votonobay");
    tuneV2Brand();tuneInnerBrand();
    try{localStorage.setItem("td:brand","votonobay");}catch{}
    return true;
  }

  function queue(){
    if(typeof cancelAnimationFrame==="function")cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>decorate());
  }

  function boot(){
    decorate();
    if(typeof MutationObserver==="function"&&document.body){
      observer?.disconnect?.();
      observer=new MutationObserver(queue);
      observer.observe(document.body,{childList:true,subtree:true});
    }
    window.addEventListener?.("td:v2-rendered",queue);
    window.addEventListener?.("pageshow",queue);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();

  window.TDBrand={name:BRAND,tagline:TAGLINE,decorate};
})();
