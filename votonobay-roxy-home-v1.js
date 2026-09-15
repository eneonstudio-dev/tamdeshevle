(()=>{
  "use strict";
  if(window.__TDRoxyHomeV1)return;
  window.__TDRoxyHomeV1=true;

  let raf=0;
  let observer=null;

  function ensureCss(){
    if(document.querySelector('link[data-roxy-home-tune]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-roxy-home-tune-v1.css?v=20260914-opening-v1";
    link.dataset.roxyHomeTune="1";
    document.head.appendChild(link);
  }

  function ensureUxWave(){
    if(!document.querySelector('link[data-roxy-ux-wave]')){
      const link=document.createElement("link");
      link.rel="stylesheet";
      link.href="votonobay-roxy-ux-wave-v1.css?v=20260915-v1";
      link.dataset.roxyUxWave="1";
      document.head.appendChild(link);
    }
    if(!document.querySelector('script[data-roxy-ux-wave]')){
      const script=document.createElement("script");
      script.src="votonobay-roxy-ux-wave-v1.js?v=20260915-v1";
      script.defer=true;
      script.dataset.roxyUxWave="1";
      document.head.appendChild(script);
    }
  }

  function makePreview(hero){
    if(hero.querySelector(".roxy-bay-card"))return;
    const panel=document.createElement("div");
    panel.className="roxy-bay-card";
    panel.setAttribute("role","group");
    panel.setAttribute("aria-label","Быстрый старт с Баем");
    panel.innerHTML=`
      <div class="roxy-bay-card-head">
        <img src="assets/bai/bai-idle.webp" alt="" aria-hidden="true">
        <div><strong>Привет!<br>Что решаем сегодня?</strong><span>Напиши, что ищешь, или выбери готовый вариант.</span></div>
      </div>
      <button class="roxy-bay-prompt" type="button" data-roxy-prompt=""><span>✦</span><b>Например: «найти ноутбук для учёбы»</b><i>→</i></button>
      <div class="roxy-bay-quicks">
        <button type="button" data-roxy-prompt="Найди лучший товар под мои условия">Лучший товар</button>
        <button type="button" data-roxy-prompt="Помоги собрать корзину под мой бюджет">Собрать корзину</button>
        <button type="button" data-roxy-prompt="Сравни варианты и объясни, какой лучше">Сравнить</button>
        <button type="button" data-roxy-prompt="Проверь, настоящая ли скидка">Проверить скидку</button>
      </div>`;
    panel.addEventListener("click",event=>{
      const button=event.target.closest("[data-roxy-prompt]");
      if(!button)return;
      const prompt=button.dataset.roxyPrompt||"";
      if(typeof window.tdBayFirstAsk==="function")window.tdBayFirstAsk(prompt);
    });
    hero.appendChild(panel);
  }

  function signalReady(hero){
    if(!hero||hero.dataset.roxyHomeReady==="1")return;
    hero.dataset.roxyHomeReady="1";
    window.dispatchEvent(new CustomEvent("td:roxy-home-ready",{detail:{approved:true}}));
  }

  function decorate(){
    ensureCss();
    const hero=document.querySelector(".v2-hero.v2-bay-first");
    if(!hero)return false;
    hero.dataset.roxyApproved="1";

    const eyebrow=hero.querySelector(".v2-eyebrow");
    if(eyebrow&&eyebrow.textContent.trim()!=="Больше возможностей рядом.")eyebrow.innerHTML="<i></i> Больше возможностей рядом.";

    const title=hero.querySelector(".v2-hero-copy h1");
    const titleHtml="Спросить Бая —<br><em>самый простой путь.</em>";
    if(title&&title.innerHTML!==titleHtml)title.innerHTML=titleHtml;

    const copy=hero.querySelector(".v2-hero-copy p");
    const copyText="Бай подберёт лучшие товары, сравнит варианты, соберёт корзину и объяснит, почему это — хороший выбор.";
    if(copy&&copy.textContent!==copyText)copy.textContent=copyText;

    const speech=hero.querySelector(".v2-hero-bai span");
    const speechHtml="Привет! Я Бай.<br>Помогу с выбором.";
    if(speech&&speech.innerHTML!==speechHtml)speech.innerHTML=speechHtml;

    const proof=hero.querySelector(".v2-hero-proof");
    const proofHtml="<span>Умные рекомендации</span><span>Выгодные находки</span><span>Экономия времени</span><span>Надёжные магазины</span>";
    if(proof&&proof.innerHTML!==proofHtml)proof.innerHTML=proofHtml;

    makePreview(hero);
    signalReady(hero);
    return true;
  }

  function queue(){
    if(typeof cancelAnimationFrame==="function")cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>decorate());
  }

  function boot(){
    ensureCss();decorate();
    if(typeof MutationObserver==="function"&&document.body){
      observer?.disconnect?.();
      observer=new MutationObserver(queue);
      observer.observe(document.body,{childList:true,subtree:true});
    }
  }

  // UX-wave assets are presentation-only and are intentionally not part of
  // the canonical cold-start readiness contract. Load them early so density
  // settles quickly without delaying td:roxy-home-ready.
  ensureUxWave();

  // Register lifecycle listeners as soon as this preload evaluates. The V2 shell
  // can render before DOMContentLoaded on mobile; waiting until boot() used to
  // miss that event and expose its older intermediate Home before Roxy caught up.
  window.addEventListener?.("td:v2-rendered",queue);
  window.addEventListener?.("pageshow",queue);
  window.TDRoxyHome={decorate,queue};

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
