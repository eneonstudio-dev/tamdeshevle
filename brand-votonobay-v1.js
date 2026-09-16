(()=>{
  "use strict";

  import("./votonobay-roxy-home-v1.js?v=20260913-v1").catch(error=>console.warn("[VOTONOBAI Home] load failed",error));

  const BRAND="VOTONOBAI";
  const TAGLINE="Скажи, что нужно — поможем решить, как лучше";
  const TITLE="VOTONOBAI — покупки, как лучше";
  const DESCRIPTION="VOTONOBAI помогает решить, как лучше купить: учитывает цену, удобство, время и контекст — а выбор остаётся за тобой.";
  const THEME="#04100b";
  const LEGACY_EXACT=[/\bVotonobay\b/g,/Тамдешевле/g,/Там Дешевле/g];
  let raf=0;
  let observer=null;

  function canonicalText(value){
    let next=String(value==null?"":value);
    for(const pattern of LEGACY_EXACT){pattern.lastIndex=0;next=next.replace(pattern,BRAND);}
    return next;
  }

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
    description.content=DESCRIPTION;
  }

  function tuneV2Brand(){
    document.querySelectorAll(".v2-brand").forEach(button=>{
      button.setAttribute("aria-label","VOTONOBAI — на главную");
      const span=button.querySelector("span");
      const wordmark="VOTONO<b>BAI</b>";
      if(span&&span.innerHTML!==wordmark)span.innerHTML=wordmark;
      if(button.closest(".v2-header")&&!button.querySelector(".voto-brand-tagline")){
        const small=document.createElement("small");
        small.className="voto-brand-tagline";
        small.textContent="Умный помощник для покупок.";
        button.appendChild(small);
      }
    });
  }

  function tuneInnerBrand(){
    document.querySelectorAll("header.app:not(.v2-header)").forEach(header=>{
      const title=header.querySelector("h1");
      if(title&&/^(Тамдешевле|Там дешевле|Проще)$/i.test(title.textContent.trim()))title.textContent=BRAND;
      const sub=header.querySelector(".sub");
      if(title&&title.textContent.trim()===BRAND&&sub)sub.textContent=TAGLINE;
      const home=header.querySelector(".brand-home");
      if(home){home.setAttribute("aria-label","VOTONOBAI — на главную");home.dataset.votonobayBrand="1";}
    });
  }

  function tuneAccountBrand(){
    document.querySelectorAll(".td-account-card h3").forEach(title=>{
      if(/^Там дешевле сэкономил$/i.test(title.textContent.trim()))title.textContent="Сэкономлено с VOTONOBAI";
    });
    document.querySelectorAll(".td-account-row span").forEach(label=>{
      if(/^Подписка Там Дешевле Plus$/i.test(label.textContent.trim()))label.textContent="Подписка VOTONOBAI Plus";
    });
  }

  function tuneLegacyCopy(){
    document.querySelectorAll(".sale-title").forEach(node=>{
      if(/Там Дешевле/i.test(node.textContent))node.textContent="VOTONOBAI продаётся";
    });
    document.querySelectorAll(".hint").forEach(node=>{
      if(/Тамдешевле сам ничего не везёт/i.test(node.textContent))node.textContent=node.textContent.replace(/Тамдешевле/gi,"VOTONOBAI");
    });
  }

  function tuneExactLegacyTokens(){
    const root=document.body;
    if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes){
      const next=canonicalText(node.nodeValue);
      if(next!==node.nodeValue)node.nodeValue=next;
    }
    document.querySelectorAll("[aria-label],[alt],[title]").forEach(node=>{
      for(const attr of ["aria-label","alt","title"]){
        if(!node.hasAttribute(attr))continue;
        const current=node.getAttribute(attr)||"";
        const next=canonicalText(current);
        if(next!==current)node.setAttribute(attr,next);
      }
    });
  }

  function decorate(){
    if(typeof document==="undefined")return false;
    ensureCss();removeLegacyBrand();tuneMetadata();
    document.body?.classList.add("td-votonobay");
    tuneV2Brand();tuneInnerBrand();tuneAccountBrand();tuneLegacyCopy();tuneExactLegacyTokens();
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

  window.TDBrand={name:BRAND,tagline:TAGLINE,decorate,canonicalText};
})();
