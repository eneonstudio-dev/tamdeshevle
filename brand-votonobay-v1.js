(()=>{
  "use strict";

  const BRAND="Votonobay";
  const TAGLINE="Скажи, что нужно — поможем решить, как лучше";
  const TITLE="Votonobay — покупки, как лучше";
  const THEME="#04100b";
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
    description.content="Votonobay помогает решить, как лучше купить: учитывает цену, удобство, время и контекст — а выбор остаётся за тобой.";
  }

  function tuneV2Brand(){
    document.querySelectorAll(".v2-brand").forEach(button=>{
      button.setAttribute("aria-label","Votonobay — на главную");
      const span=button.querySelector("span");
      const wordmark="VOTONO<b>BAY</b>";
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
      if(home){home.setAttribute("aria-label","Votonobay — на главную");home.dataset.votonobayBrand="1";}
    });
  }

  function makeBayPreview(hero){
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

  function tuneHomeDirection(){
    const hero=document.querySelector(".v2-hero.v2-bay-first");
    if(!hero)return;
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
    const proofHtml="<span>◈ Умные рекомендации</span><span>♥ Выгодные находки</span><span>✦ Экономия времени</span><span>▣ Надёжные магазины</span>";
    if(proof&&proof.innerHTML!==proofHtml)proof.innerHTML=proofHtml;

    makeBayPreview(hero);
  }

  function decorate(){
    if(typeof document==="undefined")return false;
    ensureCss();removeLegacyBrand();tuneMetadata();
    document.body?.classList.add("td-votonobay");
    tuneV2Brand();tuneInnerBrand();tuneHomeDirection();
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
