(()=>{
  "use strict";
  if(window.__TDBaiRuntimeStatesV1)return;
  window.__TDBaiRuntimeStatesV1=true;

  const QUICK=[
    {label:"Собрать корзину",prompt:"Помоги собрать корзину под мой бюджет"},
    {label:"Что лучше выбрать?",prompt:"Сравни варианты и скажи, какой лучше выбрать"},
    {label:"Проверить скидку",prompt:"Проверь, настоящая ли скидка и стоит ли покупать сейчас"}
  ];
  const ERROR_RE=/Не получилось (?:обработать сообщение до конца|применить этот вариант|открыть магазины)/i;
  let root=null,rootObserver=null,frame=0;

  function classify({online=true,busy=false,userCount=0,lastAssistant=""}={}){
    if(!online)return"offline";
    if(ERROR_RE.test(String(lastAssistant||"")))return"error";
    if(busy)return"loading";
    if(!userCount)return"empty";
    return"normal";
  }

  function lastText(selector){
    const nodes=root?[...root.querySelectorAll(selector)]:[];
    return String(nodes.at(-1)?.textContent||"").trim();
  }
  function state(){
    return classify({
      online:navigator.onLine!==false,
      busy:Boolean(root?.hasAttribute("data-bai-busy")),
      userCount:root?.querySelectorAll(".td-ai-msg.user").length||0,
      lastAssistant:lastText(".td-ai-msg.assistant")
    });
  }
  function ensureCard(){
    if(!root)return null;
    let card=root.querySelector(".td-ai-state-card");
    if(card)return card;
    const messages=root.querySelector(".td-ai-messages");
    if(!messages)return null;
    card=document.createElement("section");
    card.className="td-ai-state-card";
    card.hidden=true;
    card.setAttribute("aria-live","polite");
    card.setAttribute("aria-atomic","true");
    messages.insertAdjacentElement("beforebegin",card);
    return card;
  }
  function closeBay(){root?.querySelector("[data-ai-close]")?.click?.()}
  function manualSearch(){closeBay();requestAnimationFrame(()=>{if(window.tdBayFirstSelfSearch)window.tdBayFirstSelfSearch();else window.go?.("catalog")})}
  function openCart(){closeBay();requestAnimationFrame(()=>window.go?.("cart"))}
  function retry(){const value=lastText(".td-ai-msg.user");if(value)window.TDShoppingAssistant?.submit?.(value)}
  function quick(index){const item=QUICK[Number(index)];if(item)window.TDShoppingAssistant?.submit?.(item.prompt)}

  function paint(){
    frame=0;if(!root?.isConnected)return;
    const card=ensureCard();if(!card)return;
    const mode=state();root.dataset.baiRuntimeState=mode;
    card.dataset.state=mode;
    card.hidden=mode==="normal";
    if(mode==="normal"){card.replaceChildren();return}
    if(mode==="offline"){
      card.innerHTML=`<small>БЕЗ СЕТИ</small><b>Текущая корзина остаётся с тобой</b><p>Можно менять список локально. Свежие цены, новые рекомендации и переходы в магазины вернутся после подключения.</p><div><button type="button" data-bai-state-cart>Открыть список</button></div>`;
      card.querySelector("[data-bai-state-cart]").onclick=openCart;return;
    }
    if(mode==="error"){
      const canRetry=Boolean(lastText(".td-ai-msg.user"));
      card.innerHTML=`<small>НЕ ДОКРУТИЛОСЬ</small><b>Корзина сохранена</b><p>Можно повторить последний запрос или продолжить вручную — ничего уже выбранного не потеряется.</p><div>${canRetry?`<button type="button" data-bai-state-retry>Повторить</button>`:""}<button type="button" class="secondary" data-bai-state-search>Искать самому</button></div>`;
      card.querySelector("[data-bai-state-retry]")?.addEventListener("click",retry);card.querySelector("[data-bai-state-search]").onclick=manualSearch;return;
    }
    if(mode==="loading"){
      card.innerHTML=`<small>БАЙ ДУМАЕТ</small><b>Разбираю задачу</b><p>Сверяю варианты и ограничения. Пока не закончу, не считаю решение готовым.</p><i aria-hidden="true"><span></span><span></span><span></span></i>`;return;
    }
    card.innerHTML=`<small>БЫСТРЫЙ СТАРТ</small><b>С чего начнём?</b><p>Напиши задачу своими словами или выбери один из сценариев.</p><div>${QUICK.map((item,index)=>`<button type="button" data-bai-state-quick="${index}">${item.label}</button>`).join("")}</div>`;
    card.querySelectorAll("[data-bai-state-quick]").forEach(button=>button.onclick=()=>quick(button.dataset.baiStateQuick));
  }
  function queue(){cancelAnimationFrame(frame);frame=requestAnimationFrame(paint)}
  function attach(next){
    if(next===root)return;
    rootObserver?.disconnect?.();rootObserver=null;root=next||null;
    if(!root)return;
    rootObserver=new MutationObserver(queue);rootObserver.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["data-bai-busy"]});queue();
  }
  function discover(){attach(document.querySelector(".td-ai"))}
  const mountObserver=new MutationObserver(discover);mountObserver.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("online",queue);window.addEventListener("offline",queue);window.addEventListener("pageshow",discover);window.addEventListener("td:v2-rendered",discover);discover();

  function css(){
    if(document.querySelector("style[data-bai-runtime-states-v1]"))return;
    const style=document.createElement("style");style.dataset.baiRuntimeStatesV1="1";style.textContent=`
      .td-ai-state-card{display:grid;gap:7px;margin:6px 0 12px;padding:13px 14px;border:1px solid rgba(79,245,154,.18);border-radius:17px;background:rgba(79,245,154,.055);box-shadow:0 12px 30px rgba(0,0,0,.12)}.td-ai-state-card[hidden]{display:none}.td-ai-state-card>small{color:#78f4ad;font:900 9px/1.2 Manrope,sans-serif;letter-spacing:.1em}.td-ai-state-card>b{color:#f3fbf6;font:850 14px/1.25 Manrope,sans-serif}.td-ai-state-card>p{margin:0;color:#9eb5a8;font:650 11px/1.45 Manrope,sans-serif}.td-ai-state-card>div{display:flex;gap:7px;flex-wrap:wrap;margin-top:2px}.td-ai-state-card button{min-height:38px;border:0;border-radius:12px;padding:8px 11px;background:#4ff59a;color:#04140b;font:850 10px Manrope,sans-serif;cursor:pointer}.td-ai-state-card button.secondary{background:rgba(255,255,255,.075);color:#dce9e1;border:1px solid rgba(255,255,255,.1)}.td-ai-state-card[data-state="offline"]{border-color:rgba(255,194,92,.22);background:rgba(255,194,92,.07)}.td-ai-state-card[data-state="offline"]>small{color:#ffd28a}.td-ai-state-card[data-state="error"]{border-color:rgba(255,128,110,.24);background:rgba(255,128,110,.065)}.td-ai-state-card[data-state="error"]>small{color:#ffb0a4}.td-ai-state-card[data-state="loading"]>i{display:flex;gap:5px;height:10px;align-items:center}.td-ai-state-card[data-state="loading"]>i span{width:6px;height:6px;border-radius:50%;background:#4ff59a;animation:td-bai-state-dot 1s ease-in-out infinite}.td-ai-state-card[data-state="loading"]>i span:nth-child(2){animation-delay:.14s}.td-ai-state-card[data-state="loading"]>i span:nth-child(3){animation-delay:.28s}@keyframes td-bai-state-dot{50%{transform:translateY(-3px);opacity:.5}}@media(max-width:520px){.td-ai-state-card{padding:12px;margin:4px 0 10px}.td-ai-state-card>div{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.td-ai-state-card button{white-space:nowrap;flex:0 0 auto;min-height:40px}}@media(prefers-reduced-motion:reduce){.td-ai-state-card[data-state="loading"]>i span{animation:none}}
    `;document.head.appendChild(style)
  }
  css();
  window.TDBaiRuntimeStatesV1={classify,paint,state,discover,quick,retry};
})();
