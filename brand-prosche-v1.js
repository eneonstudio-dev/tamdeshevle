(()=>{
  "use strict";
  const BRAND="Проще";
  const TAGLINE="Собери корзину — дальше проще";
  const replacements=[
    ["Собери корзину — скажем, где дешевле",TAGLINE],
    ["Там Дешевле продаётся","Проще продаётся"],
    ["Тамдешевле",BRAND],
    ["Там Дешевле",BRAND],
    ["Там дешевле",BRAND]
  ];
  const mark=`<svg class="logo td-prosche-logo" width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#102018"/><path d="M19 45V19h26v26M19 19h26" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M43 19h7" stroke="#35D981" stroke-width="6" stroke-linecap="round"/></svg>`;
  function ensureVisualCss(){if(document.querySelector('link[data-prosche-visual-v2]'))return;const link=document.createElement("link");link.rel="stylesheet";link.href="prosche-visual-v2.css?v=20260911-v2";link.dataset.proscheVisualV2="1";document.head.appendChild(link)}
  function rewriteText(value){let out=String(value||"");for(const [from,to] of replacements)out=out.split(from).join(to);return out}
  function tuneHero(){
    const hero=document.querySelector(".v2-hero");if(!hero)return;
    const eyebrow=hero.querySelector(".v2-eyebrow");if(eyebrow)eyebrow.innerHTML="<i></i> покупки без лишних действий";
    const title=hero.querySelector(".v2-hero h1");if(title)title.innerHTML="Покупки.<br><em>Проще.</em>";
    const copy=hero.querySelector(".v2-hero p");if(copy)copy.textContent="Собери корзину один раз. Мы сравним магазины, покажем источник цены и поможем выбрать самый удобный вариант.";
    const bubble=hero.querySelector(".v2-hero-bai span");if(bubble)bubble.innerHTML="Скажи, что нужно.<br>Остальное — проще.";
    const input=hero.querySelector(".v2-search input");if(input)input.placeholder="Например: молоко, яйца, хлеб";
    const button=hero.querySelector(".v2-search button");if(button)button.textContent="Собрать";
    const proof=hero.querySelector(".v2-hero-proof");if(proof)proof.innerHTML="<span>✓ Видно источник цены</span><span>✓ Сравниваем всю корзину</span><span>✓ Бай помогает без лишних вопросов</span>";
  }
  function tuneV2Brand(){
    document.querySelectorAll(".v2-brand").forEach(btn=>{btn.setAttribute("aria-label","Проще — на главную");const span=btn.querySelector("span");if(span)span.innerHTML="Проще";const svg=btn.querySelector("svg.logo");if(svg&&!svg.classList.contains("td-prosche-logo"))svg.outerHTML=mark});
    const popular=document.querySelector(".v2-section .v2-section-head h2");if(popular&&popular.textContent.includes("Сравниваем знакомые сети"))popular.textContent="Магазины, которые ты и так знаешь";
    document.querySelectorAll(".v2-section-head h2").forEach(h=>{if(h.textContent.includes("Начни собирать корзину"))h.textContent="Добавь нужное — дальше разберёмся"});
    document.querySelectorAll(".v2-basket-card h2").forEach(h=>{if(h.textContent.includes("Корзина готова к сравнению"))h.textContent="Корзина готова. Дальше проще."});
    document.querySelectorAll(".v2-compare").forEach(b=>{if(/Найти, где дешевле/.test(b.textContent))b.innerHTML="Сравнить корзину <span>→</span>"});
  }
  function tuneBai(){
    document.querySelectorAll(".td-ai-bai h2").forEach(h=>{if(/Что покупаем\?/.test(h.textContent))h.textContent="Скажи, что нужно"});
    document.querySelectorAll(".td-ai-bai p").forEach(p=>{if(/Напиши как обычно/.test(p.textContent))p.textContent="Можно обычной фразой: добавить, убрать, заменить или уложиться в бюджет."});
    document.querySelectorAll(".td-ai-compose textarea").forEach(t=>t.placeholder="Например: собери на 2000 ₽ без готовки");
  }
  function decorate(root=document){
    ensureVisualCss();document.body?.classList.add("td-prosche");
    document.title="Проще — покупки без лишней суеты";
    try{localStorage.setItem("td:brand","prosche")}catch{}
    const scope=root?.nodeType===1?root:document.body;
    if(scope){
      const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(node){const p=node.parentElement;if(!p||/^(SCRIPT|STYLE|TEXTAREA)$/i.test(p.tagName))return NodeFilter.FILTER_REJECT;return /Тамдешевле|Там Дешевле|Там дешевле|Собери корзину — скажем, где дешевле/.test(node.nodeValue||"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);for(const node of nodes)node.nodeValue=rewriteText(node.nodeValue);
    }
    document.querySelectorAll(".brand-home").forEach(btn=>{if(btn.dataset.proscheBrand)return;const svg=btn.querySelector("svg.logo");if(svg){svg.outerHTML=mark;btn.dataset.proscheBrand="1";btn.setAttribute("aria-label","На главную — Проще")}});
    document.querySelectorAll("header.app h1").forEach(h=>{if(h.textContent.trim()===BRAND){const sub=h.parentElement?.querySelector(".sub");if(sub)sub.textContent=TAGLINE}});
    tuneHero();tuneV2Brand();tuneBai();
  }
  let raf=0;const queue=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>decorate(document.body))};
  function boot(){decorate(document.body);new MutationObserver(queue).observe(document.body,{childList:true,subtree:true,characterData:true})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.TDBrand={name:BRAND,tagline:TAGLINE,decorate,rewriteText};
})();