(()=>{
  "use strict";
  if(window.__TDVotonobayPurchaseExperienceV1)return;
  window.__TDVotonobayPurchaseExperienceV1=true;

  const STYLE_HREF="purchase-experience-v1.css?v=20260912-purchase-v2";
  const compareSelector=".td-compare-v2";
  const continueSelector=".td-continue-stores";
  const STORE_LABELS={pyat:"Пятёрочка",perek:"Перекрёсток",magnit:"Магнит",lenta:"Лента",dixy:"Дикси",okey:"О’КЕЙ",vkusvill:"ВкусВилл",auchan:"Ашан",metro:"METRO"};
  let followTimer=0,lastChoiceId="";

  function ensureStyle(){
    if(document.querySelector('link[data-td-purchase-experience]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE_HREF;
    link.dataset.tdPurchaseExperience="1";
    document.head.appendChild(link);
  }

  const state=()=>window.TDShoppingState?.get?.()||{};
  const plans=()=>Array.isArray(state().lastPlans)?state().lastPlans:[];
  const activePlan=()=>plans()[0]||null;
  const retailerId=value=>String(value||"").split("_")[0];
  const uniqueStores=plan=>[...new Set((plan?.products||[]).map(x=>retailerId(x?.storeId)).filter(Boolean))];
  const productCount=plan=>(plan?.products||[]).reduce((sum,x)=>sum+Math.max(1,Number(x?.quantity)||1),0);
  const money=value=>`${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  const storeLabel=id=>STORE_LABELS[retailerId(id)]||retailerId(id)||"Магазин";
  const storeItems=(plan,storeId)=>(plan?.products||[]).filter(item=>retailerId(item?.storeId)===retailerId(storeId));

  function formatStoreList(plan,storeId){
    const items=storeItems(plan,storeId);
    if(!items.length)return"";
    const lines=items.map((item,index)=>{
      const qty=Math.max(1,Number(item?.quantity)||1);
      const pack=String(item?.pack||"").trim();
      const name=String(item?.name||item?.title||item?.productName||item?.id||"Товар").trim();
      return `${index+1}. ${name}${pack?` · ${pack}`:""} — ${qty} шт.`;
    });
    return `Votonobay · ${storeLabel(storeId)}\n${lines.join("\n")}\n\nЦена и наличие подтверждаются магазином.`;
  }

  async function copyText(text){
    if(!text)return false;
    try{
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true}
    }catch{}
    try{
      const textarea=document.createElement("textarea");
      textarea.value=text;
      textarea.setAttribute("readonly","");
      textarea.style.position="fixed";
      textarea.style.opacity="0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok=document.execCommand?.("copy")===true;
      textarea.remove();
      return ok;
    }catch{return false}
  }

  async function copyStoreList(storeId,plan=activePlan()){
    const text=formatStoreList(plan,storeId);
    if(!text){feedback("Не удалось собрать список для этого магазина.","error");return false}
    const ok=await copyText(text);
    feedback(ok?`Список для «${storeLabel(storeId)}» скопирован.`:"Не получилось скопировать автоматически — список остаётся в Votonobay.",ok?"success":"warn");
    return ok;
  }

  function decisionForPlan(plan,{online=navigator.onLine!==false}={}){
    if(!plan||!Array.isArray(plan.products)||!plan.products.length)return{action:"none",label:"Корзина сохранена"};
    if(!online)return{action:"offline",label:"Вариант выбран · продолжим после подключения"};
    const stores=uniqueStores(plan);
    if(!stores.length)return{action:"none",label:"Вариант выбран"};
    return{
      action:"handoff",
      label:stores.length>1?`Продолжить в ${stores.length} магазинах`:`Продолжить в магазине`,
      stores,
      items:productCount(plan)
    };
  }

  function feedback(text,tone="warn"){
    if(window.TDPurchase?.feedback)return window.TDPurchase.feedback(text,tone);
    try{window.dispatchEvent(new CustomEvent("td:purchase-experience-feedback",{detail:{text,tone}}))}catch{}
    return false;
  }

  async function ensureHandoff(){
    if(window.TDContinueInStoresV1)return window.TDContinueInStoresV1;
    try{
      await import("./continue-in-stores-v1.js?v=20260912-purchase-v1");
      return window.TDContinueInStoresV1||null;
    }catch(error){
      console.warn("[Votonobay] purchase handoff unavailable",error);
      return null;
    }
  }

  async function continuePlan(plan=activePlan()){
    const decision=decisionForPlan(plan);
    if(decision.action==="offline"){
      feedback("Вариант выбран и сохранён. Для перехода в магазин нужен интернет — продолжим после подключения.");
      return false;
    }
    if(decision.action!=="handoff"){
      feedback("Вариант выбран. Корзина сохранена — можно вернуться к ней в любой момент.");
      return false;
    }
    const handoff=await ensureHandoff();
    if(!handoff?.open){
      feedback("Вариант выбран, но прямой переход сейчас недоступен. Корзина сохранена — можно открыть магазин вручную.","error");
      return false;
    }
    const opened=await handoff.open(plan);
    if(!opened){
      feedback("Вариант выбран. Для этого магазина пока нет подтверждённого прямого шага — корзина остаётся сохранённой.");
      return false;
    }
    return true;
  }

  function copy(el,text){if(el&&el.textContent!==text)el.textContent=text}

  function enhanceComparison(root){
    if(!root||root.dataset.tdPurchaseEnhanced==="1")return;
    root.dataset.tdPurchaseEnhanced="1";
    const header=root.querySelector("header>div");
    if(header){
      copy(header.querySelector("small"),"Решение по корзине");
      copy(header.querySelector("b"),"Как лучше собрать эту корзину");
    }
    const hero=root.querySelector(".td-compare-hero");
    if(hero){
      copy(hero.querySelector("small"),"Рекомендация Votonobay");
      const span=hero.querySelector("span");
      if(span&&!span.dataset.tdPurchaseCopy){
        span.dataset.tdPurchaseCopy="1";
        span.textContent=`${span.textContent} · итог перед покупкой подтверждает магазин`;
      }
    }
    root.querySelectorAll(".td-compare-plan").forEach((card,index)=>{
      copy(card.querySelector("small"),index===0?"Я бы выбрал":"Альтернатива");
      const button=card.querySelector("[data-compare-apply]");
      if(button){
        button.textContent=index===0?"Выбрать и продолжить":"Выбрать этот вариант";
        button.dataset.tdPurchaseContinue="1";
      }
    });
    const why=root.querySelector(".td-compare-why h3");
    if(why)copy(why,"Почему этот вариант лучше");
    const note=root.querySelector(".td-compare-note");
    if(note)note.textContent="Цена — только часть решения. Перед переходом Votonobay показывает надёжность данных; финальные наличие и сумма подтверждаются магазином.";
  }

  function addCopyButtons(root){
    const plan=activePlan();
    if(!plan)return;
    root.querySelectorAll?.(".td-continue-store-row").forEach(row=>{
      const trigger=row.querySelector("[data-open-store]");
      const storeId=trigger?.dataset?.openStore;
      const controls=row.querySelector(".td-store-progress-controls");
      if(!storeId||!controls||controls.querySelector("[data-copy-store]")||!storeItems(plan,storeId).length)return;
      const button=document.createElement("button");
      button.type="button";
      button.dataset.copyStore=retailerId(storeId);
      button.className="td-copy-store-list";
      button.textContent="Скопировать список";
      button.setAttribute("aria-label",`Скопировать список товаров для ${storeLabel(storeId)}`);
      controls.appendChild(button);
    });
  }

  function enhanceContinue(root){
    if(!root)return;
    if(root.dataset.tdPurchaseEnhanced!=="1"){
      root.dataset.tdPurchaseEnhanced="1";
      const card=root.querySelector(".td-continue-stores-card");
      if(!card)return;
      copy(card.querySelector(":scope>small"),"Следующий шаг");
      copy(card.querySelector("h2"),"Забираем корзину по магазинам");
      const intro=card.querySelector("h2+p");
      if(intro)intro.textContent="Votonobay уже разложил покупки. Открывай магазины по очереди и отмечай только то, что действительно добавил на стороне сети.";
      const note=card.querySelector(".td-continue-stores-note");
      if(note)note.textContent="Votonobay не притворяется кассой магазина: прогресс — твоя отметка, а наличие, цена и фактическое добавление подтверждаются самой сетью.";
    }
    addCopyButtons(root);
  }

  function enhanceSplit(root=document){
    root.querySelectorAll?.(".split-basket:not([data-td-purchase-enhanced])").forEach(card=>{
      card.dataset.tdPurchaseEnhanced="1";
      copy(card.querySelector(".split-basket__eyebrow"),"АЛЬТЕРНАТИВА · ДВА МАГАЗИНА");
      copy(card.querySelector(".split-basket__title"),"Разделить корзину, если экономия стоит второго захода");
      const button=card.querySelector("[data-split-continue]");
      if(button)button.textContent="Выбрать два магазина →";
    });
  }

  function followChoice(button){
    const id=button?.dataset?.compareApply;
    if(!id)return;
    lastChoiceId=id;
    clearTimeout(followTimer);
    followTimer=setTimeout(async()=>{
      const plan=activePlan();
      if(!plan||String(plan.id||"")!==String(lastChoiceId))return;
      await continuePlan(plan);
    },80);
  }

  function hydrate(root=document){
    ensureStyle();
    root.querySelectorAll?.(compareSelector).forEach(enhanceComparison);
    root.querySelectorAll?.(continueSelector).forEach(enhanceContinue);
    enhanceSplit(root);
  }

  document.addEventListener("click",event=>{
    const target=event.target instanceof Element?event.target:null;
    const copyButton=target?.closest?.("[data-copy-store]");
    if(copyButton){
      event.preventDefault();
      copyStoreList(copyButton.dataset.copyStore);
      return;
    }
    const choice=target?.closest?.("[data-compare-apply][data-td-purchase-continue]");
    if(choice)followChoice(choice);
  },true);

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.(compareSelector))enhanceComparison(node);
        if(node.matches?.(continueSelector))enhanceContinue(node);
        hydrate(node);
      }
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("online",()=>feedback("Связь вернулась. Выбранная корзина сохранена — можно продолжить в магазин."));
  window.addEventListener("pagehide",()=>{clearTimeout(followTimer);observer.disconnect()},{once:true});
  hydrate();

  window.TDPurchaseExperienceV1={hydrate,enhanceComparison,enhanceContinue,decisionForPlan,continuePlan,uniqueStores,productCount,money,storeItems,formatStoreList,copyStoreList};
})();
