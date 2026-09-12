(()=>{
  "use strict";
  if(window.__TDFirstShoppingJourneyInitialized)return;
  window.__TDFirstShoppingJourneyInitialized=true;

  const STYLE_ID="td-first-shopping-journey-style";
  let baseRender=typeof window.render==="function"?window.render:null;
  let baseChoosePlan=typeof window.choosePlan==="function"?window.choosePlan:null;
  let installed=false;

  function injectStyle(){
    if(typeof document==="undefined"||document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .td-journey-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0 0 14px}
      .td-journey-step{min-width:0;background:#fff;border:1px solid #e9e2d7;border-radius:14px;padding:10px 9px;color:#625b50;font-size:10px;line-height:1.35;font-weight:700}
      .td-journey-step b{display:block;margin-bottom:3px;color:#161410;font-size:12px}
      .td-journey-action{margin-top:10px!important;background:#102018!important;color:#fff!important}
      .td-journey-unavailable{margin-top:9px;padding:9px 10px;border-radius:12px;background:#f2efe9;color:#756d61;font-size:11px;font-weight:700;line-height:1.4}
      @media(max-width:360px){.td-journey-steps{gap:5px}.td-journey-step{padding:9px 7px;font-size:9px}.td-journey-step b{font-size:11px}}
    `;
    document.head?.appendChild(style);
  }

  function cartCount(){
    return Object.values(window.state?.cart||{}).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
  }

  function plans(){
    try{return Array.isArray(window.TDCompare?.fromWindow?.())?window.TDCompare.fromWindow():[]}catch{return[]}
  }

  function knownMoney(value){
    if(value===null||value===undefined||value==="")return false;
    const number=Number(value);return Number.isFinite(number)&&number>=0;
  }

  function actionLabel(plan){
    const name=String(plan?.name||"магазин");
    return plan?.channel==="bring"?`Перейти в «${name}»`:`Найти «${name}» рядом`;
  }

  function safePlanHint(plan){
    if(!plan)return"Детали варианта уточняются";
    if(plan.channel==="bring"){
      const goods=knownMoney(plan.goods)?`товары ${Math.round(Number(plan.goods))} ₽`:"цена товаров уточняется";
      const time=plan.time?` · ${plan.time}`:"";
      if(plan.feeKnown){
        const fee=knownMoney(plan.delivery)?`доставка сети ${Math.round(Number(plan.delivery))} ₽`:"доставка сети уточняется";
        return`${goods} + ${fee}${time}`;
      }
      return`${goods} · тариф доставки не заложен${time}`;
    }
    return"сходить, полка · точный адрес магазина выбирается на следующем шаге";
  }

  function emitPlan(plan){
    try{
      window.dispatchEvent(new CustomEvent("td:plan-selected",{detail:{
        storeId:plan.id,
        channel:plan.channel,
        total:Number.isFinite(plan.total)?plan.total:null,
        saving:Number.isFinite(plan.save)?plan.save:null,
        verified:plan.verifiedComplete===true,
        cart:{...(window.state?.cart||{})},
        city:window.state?.city||null
      }}));
    }catch{}
  }

  function choosePlan(storeId,channel){
    const exact=plans().find(plan=>plan?.id===storeId&&(!channel||plan.channel===channel)&&plan.rankable&&Number.isFinite(plan.total));
    if(!exact)return typeof baseChoosePlan==="function"?baseChoosePlan(storeId,channel):false;
    if(window.state){
      window.state.storeId=storeId;
      window.state.openWhy=null;
      if(channel==="bring")window.state.mode="delivery";
      else if(channel==="shelf")window.state.mode="walk";
    }
    emitPlan(exact);
    if(typeof window.go==="function")window.go("catalog");
    else if(typeof window.render==="function")window.render();
    return true;
  }

  function ensureSteps(root){
    if(!root||root.querySelector(".td-journey-steps"))return;
    const hero=root.querySelector(".hero");if(!hero)return;
    const section=document.createElement("section");
    section.className="td-journey-steps";
    section.setAttribute("aria-label","Как работает сравнение");
    section.innerHTML=`<div class="td-journey-step"><b>1. Корзина</b>Добавь нужные товары.</div><div class="td-journey-step"><b>2. Сравнение</b>Проверим тот же набор.</div><div class="td-journey-step"><b>3. Переход</b>Откроем магазин или карту.</div>`;
    hero.insertAdjacentElement("afterend",section);
  }

  function decorateHome(root){
    const count=cartCount(),heroTitle=root.querySelector(".hero-title"),heroSum=root.querySelector(".hero-sum");
    const primary=root.querySelector(".wrap > .btn.dark,.wrap > .btn.green");
    if(count===0){
      if(heroTitle)heroTitle.textContent="Собери корзину — сравним магазины";
      if(heroSum)heroSum.textContent="Без фальшивых 0 ₽: итог появится после добавления товаров";
      if(primary){primary.textContent="Собрать корзину";primary.onclick=()=>window.go?.("stores");primary.setAttribute("aria-label","Выбрать магазин и собрать корзину")}
    }else{
      if(heroTitle)heroTitle.textContent="Сравним готовую корзину";
      if(primary){primary.textContent="Сравнить корзину";primary.onclick=()=>window.go?.("compare");primary.setAttribute("aria-label","Сравнить текущую корзину между магазинами")}
    }
    ensureSteps(root);
  }

  function decorateCart(root){
    const primary=root.querySelector(".dock .btn.dark");
    if(primary){primary.textContent="Сравнить эту корзину";primary.setAttribute("aria-label","Сравнить эту же корзину между магазинами")}
    const secondary=root.querySelector(".dock .ghost");
    if(secondary){secondary.textContent="Изменить магазин";secondary.setAttribute("aria-label","Выбрать другой исходный магазин")}
  }

  function decorateCompare(root){
    const list=plans();
    const winner=list.find(plan=>plan?.rankable&&Number.isFinite(plan.total));
    const lead=root.querySelector(".v2-verdict:not(.v2-verdict-wait) button");
    if(lead&&winner){lead.textContent=`${actionLabel(winner)} →`;lead.setAttribute("aria-label",`${actionLabel(winner)}. Сайт сам заказ не оформляет.`)}
    const cards=[...root.querySelectorAll(".plan")];
    cards.forEach((card,index)=>{
      card.querySelector(".td-journey-action,.td-journey-unavailable")?.remove();
      const plan=list[index];if(!plan)return;
      if(plan.rankable&&Number.isFinite(plan.total)){
        const button=document.createElement("button");button.type="button";button.className="ghost td-journey-action";button.textContent=actionLabel(plan);
        button.setAttribute("aria-label",`${actionLabel(plan)}. Переход на следующий шаг без автоматического заказа.`);
        button.onclick=()=>window.TDPurchase?.start?.(plan.id,plan.channel)??choosePlan(plan.id,plan.channel);
        card.appendChild(button);
      }else{
        const status=document.createElement("div");status.className="td-journey-unavailable";status.textContent="Переход недоступен: для всей корзины пока нет полного подтверждённого расчёта.";card.appendChild(status);
      }
    });
  }

  function decorate(){
    if(typeof document==="undefined")return false;
    injectStyle();
    const root=document.getElementById("app");if(!root||!window.state)return false;
    if(window.state.screen==="home")decorateHome(root);
    else if(window.state.screen==="cart")decorateCart(root);
    else if(window.state.screen==="compare")decorateCompare(root);
    return true;
  }

  function install(){
    if(installed)return true;
    installed=true;
    if(typeof window.planHint==="function")window.planHint=safePlanHint;
    window.choosePlan=choosePlan;
    if(baseRender){
      window.render=function(){const result=baseRender.apply(this,arguments);decorate();return result};
    }
    decorate();
    if(typeof window.addEventListener==="function"){
      window.addEventListener("td:retailer-prices-applied",decorate);
      window.addEventListener("pageshow",decorate);
    }
    return true;
  }

  window.TDFirstShoppingJourney={install,decorate,actionLabel,safePlanHint,choosePlan};
  install();
})();
