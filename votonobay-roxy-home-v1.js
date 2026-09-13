(()=>{
  "use strict";

  let raf=0;
  let observer=null;

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

  function decorate(){
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
    const proofHtml="<span>◈ Умные рекомендации</span><span>♥ Выгодные находки</span><span>✦ Экономия времени</span><span>▣ Надёжные магазины</span>";
    if(proof&&proof.innerHTML!==proofHtml)proof.innerHTML=proofHtml;

    makePreview(hero);
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

  window.TDRoxyHome={decorate};
})();
