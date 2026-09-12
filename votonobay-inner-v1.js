(()=>{
  "use strict";

  import("./app-store-guard.js?v=20260912-v1").catch(error=>console.warn("[Votonobay store guard] load failed",error));

  const SCREEN_COPY={
    stores:{title:"Магазины",sub:"Выбери магазин — Votonobay сравнит его с остальными"},
    catalog:{sub:"Собери корзину — Votonobay поможет выбрать лучший способ покупки"},
    cart:{title:"Корзина",compare:"Решить, как купить"},
    compare:{title:"Как лучше купить",sub:"Одна корзина · цена, удобство, способ покупки и подтверждённость"}
  };

  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}
  function screen(){return window.state&&typeof state.screen==="string"?state.screen:"home";}

  function tuneHeader(name){
    const header=document.querySelector("header.app:not(.v2-header)");
    if(!header)return;
    const copy=SCREEN_COPY[name]||{};
    const title=header.querySelector("h1");
    const sub=header.querySelector(".sub");
    if(copy.title)setText(title,copy.title);
    if(copy.sub)setText(sub,copy.sub);
    const back=header.querySelector(".back");
    if(back)back.setAttribute("aria-label","Назад");
    const city=header.querySelector(".city");
    if(city)city.setAttribute("aria-label",`Сменить город. Сейчас ${city.textContent.trim()}`);
    const home=header.querySelector(".brand-home");
    if(home)home.setAttribute("aria-label","Votonobay — на главную");
  }

  function tuneStores(){
    document.querySelectorAll(".wrap > .store").forEach((button,index)=>{
      button.classList.add("voto-store-choice");
      const name=button.querySelector("b")?.textContent?.trim()||`Магазин ${index+1}`;
      button.setAttribute("aria-label",`Выбрать ${name}`);
    });
  }

  function tuneCatalog(){
    const input=document.querySelector(".wrap .addr");
    if(input){
      input.type="search";
      input.setAttribute("aria-label","Поиск товара в выбранном магазине");
      input.setAttribute("enterkeyhint","search");
      input.setAttribute("autocomplete","off");
    }
    const products=document.querySelector(".products");
    if(products)products.setAttribute("aria-label","Товары");
  }

  function deliveryConstraint(plan){
    if(!plan||plan.channel!=="bring"||plan.operationalReason==null)return"";
    if(plan.operationalReason==="fee_unknown")return"Тариф доставки сети не подтверждён — вариант вне рейтинга.";
    if(plan.operationalReason==="minimum_unknown")return"Минимальный заказ сети не подтверждён — вариант вне рейтинга.";
    if(plan.operationalReason==="minimum_unmet"){
      const gap=Number(plan.minimumShortfall);
      return Number.isFinite(gap)&&gap>0?`До минимального заказа не хватает ${Math.ceil(gap)} ₽ — вариант вне рейтинга.`:"Минимальный заказ сети не достигнут — вариант вне рейтинга.";
    }
    return"Условия доставки пока не подтверждены — вариант вне рейтинга.";
  }

  function currentPlan(){
    const rows=window.TDCompare?.fromWindow?.()||[];
    return rows.find(row=>row.same)||rows.find(row=>row.id===state.storeId)||null;
  }

  function tuneCart(){
    const primary=document.querySelector(".dock .btn.dark");
    if(primary)setText(primary,SCREEN_COPY.cart.compare);
    const dock=document.querySelector(".dock");
    if(dock)dock.setAttribute("aria-label","Действия с корзиной");
    document.querySelector(".voto-cart-constraint")?.remove();
    const better=[...document.querySelectorAll(".dock > div")].find(node=>/Эту корзину можно собрать дешевле на/i.test(node.textContent||""));
    if(better){
      const match=(better.textContent||"").match(/([\d\s]+)\s*₽/);
      const saving=match?.[1]?.trim();
      better.classList.add("voto-cart-better");
      better.textContent=saving?`Есть вариант лучше: можно сэкономить ${saving} ₽ без потери корзины.`:"Есть вариант лучше — сравним цену, способ покупки и удобство.";
    }
    const plan=currentPlan();
    const copy=deliveryConstraint(plan);
    if(copy&&dock){
      const summary=dock.querySelector(":scope > div");
      const spans=summary?.querySelectorAll("span");
      if(spans?.length>=2){
        spans[0].textContent="Оценка здесь";
        spans[1].textContent=Number.isFinite(plan?.indicativeTotal)?`≈ ${Math.round(plan.indicativeTotal)} ₽ · условия`:"условия уточняются";
      }
      const note=document.createElement("div");
      note.className="voto-cart-constraint";
      note.setAttribute("role","status");
      note.textContent=copy.replace(" — вариант вне рейтинга.",".");
      (summary||dock.firstElementChild)?.insertAdjacentElement("afterend",note);
    }
  }

  function tuneCompare(){
    const toggle=document.querySelector(".toggle");
    if(toggle){
      toggle.setAttribute("role","group");
      toggle.setAttribute("aria-label","Способ покупки");
      toggle.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.classList.contains("on"))));
    }
    const rows=window.TDCompare?.fromWindow?.()||[];
    document.querySelectorAll(".plan").forEach((plan,index)=>{
      const name=plan.querySelector("h3")?.textContent?.trim();
      if(name)plan.setAttribute("aria-label",`Вариант: ${name}`);
      const badge=plan.querySelector(".badge");
      if(badge)setText(badge,"рекомендую");
      const why=[...plan.querySelectorAll("button")].find(button=>/Почему так/i.test(button.textContent||""));
      if(why)setText(why,"Почему этот вариант");
      plan.querySelector(".voto-delivery-constraint")?.remove();
      const copy=deliveryConstraint(rows[index]);
      if(copy){
        const note=document.createElement("div");
        note.className="voto-delivery-constraint";
        note.setAttribute("role","status");
        note.textContent=copy;
        const hint=plan.querySelector(".hint");
        (hint||plan.querySelector(".sum")||plan).insertAdjacentElement("afterend",note);
      }
    });
    document.querySelectorAll(".wrap > .hint").forEach(note=>{
      if(note.textContent.includes("Тамдешевле сам ничего не везёт")){
        note.textContent=note.textContent.replace("Тамдешевле сам ничего не везёт","Votonobay сам ничего не везёт и не выдаёт переход в магазин за оформленный заказ");
      }
    });
  }

  function tuneSaleCopy(){
    const title=document.querySelector(".sale-title");
    if(title&&/Там\s*Дешевле/i.test(title.textContent))title.textContent="Votonobay открыт к разговору";
  }

  function decorate(){
    if(typeof document==="undefined")return false;
    const name=screen();
    document.body?.classList.toggle("td-votonobay-inner",name!=="home");
    document.body?.setAttribute("data-votonobay-screen",name);
    tuneSaleCopy();
    if(name==="home")return true;
    tuneHeader(name);
    if(name==="stores")tuneStores();
    if(name==="catalog")tuneCatalog();
    if(name==="cart")tuneCart();
    if(name==="compare")tuneCompare();
    return true;
  }

  window.addEventListener?.("td:v2-rendered",decorate);
  window.addEventListener?.("pageshow",decorate);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",decorate,{once:true});
  else decorate();

  window.TDVotonobayInner={decorate,deliveryConstraint,currentPlan};
})();
