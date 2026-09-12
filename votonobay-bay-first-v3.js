(()=>{
  "use strict";
  const CSS="votonobay-bay-first-v3.css?v=20260912-v3";
  let decorateRaf=0;
  const esc=value=>String(value==null?"":value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]);
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function ensureCss(){
    if(document.querySelector('link[data-votonobay-bay-first-v3]'))return;
    const link=document.createElement("link");link.rel="stylesheet";link.href=CSS;link.dataset.votonobayBayFirstV3="1";document.head.appendChild(link);
  }

  function tuneAssistant(){
    const root=document.querySelector(".td-ai");if(!root)return false;
    const title=root.querySelector(".td-ai-bai h2"),copy=root.querySelector(".td-ai-bai p"),area=root.querySelector("textarea");
    if(title)title.textContent="Что хочешь решить?";
    if(copy)copy.textContent="Расскажи своими словами. Я уточню только то, что реально влияет на решение.";
    if(area)area.placeholder="Например: собери ужин на четверых до 2500 ₽ или помоги выбрать наушники";
    return true;
  }

  async function waitForAssistant(){
    for(let i=0;i<12;i++){
      if(window.TDShoppingAssistant?.open)return window.TDShoppingAssistant;
      await delay(80);
    }
    return null;
  }

  async function openBay(prompt=""){
    window.TDBai?.setState?.("curious","Рассказывай. Разберёмся, как лучше.",1700,false);
    const assistant=await waitForAssistant();
    if(!assistant){
      window.dispatchEvent(new CustomEvent("bai:hint",{detail:{state:"suspicious",text:"Помощник не загрузился. Поиск вручную всё ещё работает.",ms:2300}}));
      focusSelfSearch();return false;
    }
    await assistant.open();
    tuneAssistant();
    if(prompt)setTimeout(()=>assistant.submit?.(prompt),90);
    return true;
  }

  function focusSelfSearch(){
    const input=document.querySelector(".v2-self-search .v2-search input,.v2-search input");
    input?.focus({preventScroll:true});
    input?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function heroMarkup(){
    const query=window.state?.q||"";
    const categories=["Молоко","Яйца","Курица","Сыр","Хлеб","Яблоки","Для дома"];
    return `
      <div class="v2-hero-copy">
        <div class="v2-eyebrow"><i></i> Бай — умный помощник покупок</div>
        <h1>Покупки. <em>Как лучше.</em></h1>
        <p>Скажи Баю, что хочешь решить. Он уточнит только важное, сравнит варианты по цене, удобству и времени и объяснит, что лучше именно в твоей ситуации.</p>
      </div>
      <button class="v2-hero-bai" type="button" onclick="tdBayFirstAsk()" aria-label="Спросить Бая" style="border:0;background:transparent;padding:0;color:inherit;font:inherit;cursor:pointer">
        <span>Расскажи задачу.<br>Я разберусь.</span><img src="assets/bai/bai-peek.webp" alt="Бай — помощник Votonobay">
      </button>
      <div class="v2-bay-actions">
        <button class="v2-bay-primary" type="button" onclick="tdBayFirstAsk()">Спросить Бая</button>
        <button class="v2-bay-secondary" type="button" onclick="tdBayFirstSelfSearch()">Искать самому</button>
        <div class="v2-bay-scenarios" aria-label="Быстрые задачи для Бая">
          <button type="button" onclick="tdBayFirstAsk('Помоги собрать корзину под мой бюджет')">Собрать корзину</button>
          <button type="button" onclick="tdBayFirstAsk('Сравни варианты и скажи, какой лучше выбрать')">Что лучше выбрать?</button>
          <button type="button" onclick="tdBayFirstAsk('Проверь, настоящая ли скидка и стоит ли покупать сейчас')">Проверить скидку</button>
          <button type="button" onclick="tdBayFirstAsk('Найди лучший вариант с учётом цены, удобства и времени')">Найти лучший вариант</button>
        </div>
      </div>
      <div class="v2-self-search">
        <div class="v2-self-label">Или выбери сам</div>
        <form class="v2-search" role="search" onsubmit="tdV2Search(event)"><span aria-hidden="true">⌕</span><input type="search" name="query" autocomplete="off" enterkeyhint="search" autocapitalize="none" spellcheck="false" value="${esc(query)}" placeholder="Найти товар самому" aria-label="Поиск товара"><button type="submit">Найти</button></form>
        <div class="v2-categories" aria-label="Быстрые категории">${categories.map(label=>`<button type="button" onclick="tdV2Quick('${label}')">${label}</button>`).join("")}</div>
      </div>
      <div class="v2-hero-proof"><span>✓ Бай объясняет почему</span><span>✓ Сравнивает весь сценарий</span><span>✓ Можно пользоваться без Бая</span></div>`;
  }

  function decorateHome(){
    ensureCss();
    const app=document.getElementById("app"),hero=document.querySelector(".v2-hero");
    if(!app||app.dataset.screen!=="home"||!hero)return false;
    if(hero.dataset.bayFirstV3==="1")return true;
    hero.innerHTML=heroMarkup();hero.dataset.bayFirstV3="1";hero.setAttribute("aria-label","Votonobay — решить покупку с Баем или самостоятельно");
    return true;
  }

  function queue(){cancelAnimationFrame(decorateRaf);decorateRaf=requestAnimationFrame(decorateHome)}
  window.tdBayFirstAsk=openBay;
  window.tdBayFirstSelfSearch=focusSelfSearch;
  window.tdBayFirstTuneAssistant=tuneAssistant;
  window.addEventListener("td:v2-rendered",queue);
  window.addEventListener("pageshow",queue);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",queue,{once:true});else queue();
})();
