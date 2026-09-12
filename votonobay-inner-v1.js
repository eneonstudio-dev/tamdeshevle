(()=>{
  "use strict";

  import("./app-store-guard.js?v=20260912-v1").catch(error=>console.warn("[Votonobay store guard] load failed",error));

  const SCREEN_COPY={
    stores:{title:"Магазины",sub:"Выбери привычный магазин — дальше сравним весь сценарий"},
    catalog:{sub:"Собери нужное — дальше сравним цену, способ покупки и удобство"},
    cart:{title:"Корзина",sub:"Проверим цену, удобство и следующий шаг",compare:"Решить, как лучше купить"},
    compare:{title:"Как лучше купить",sub:"Одна корзина · цена, удобство, способ покупки и надёжность данных"}
  };

  function setText(node,text){if(node&&node.textContent!==text)node.textContent=text;}
  function screen(){return window.state&&typeof state.screen==="string"?state.screen:"home";}
  function cartQty(){
    const cart=window.state&&state.cart&&typeof state.cart==="object"?state.cart:{};
    return Object.values(cart).reduce((sum,value)=>sum+Math.max(0,Number(value)||0),0);
  }

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

  function tuneDock(){
    const dock=document.querySelector(".dock");
    if(!dock)return;
    dock.classList.add("voto-shopping-dock");
    const shortcut=dock.querySelector(".btn.yellow");
    if(shortcut){
      shortcut.classList.add("voto-cart-shortcut");
      const spans=shortcut.querySelectorAll("span");
      if(spans.length>=2)setText(spans[1],"Проверить →");
    }
  }

  function tuneStores(){
    document.querySelectorAll(".wrap > .store").forEach((button,index)=>{
      button.classList.add("voto-store-choice");
      const name=button.querySelector("b")?.textContent?.trim()||`Магазин ${index+1}`;
      button.setAttribute("aria-label",`Выбрать ${name}`);
    });
    tuneDock();
  }

  function catalogIntro(){
    const wrap=document.querySelector(".wrap");
    const input=wrap?.querySelector(".addr");
    if(!wrap||!input)return;
    wrap.querySelector(".voto-screen-intro")?.remove();
    const intro=document.createElement("section");
    intro.className="voto-screen-intro";
    intro.setAttribute("aria-label","Как работает корзина Votonobay");
    const qty=cartQty();
    intro.innerHTML=`<div><span>СОБЕРИ КОРЗИНУ</span><h2>Добавляй то, что реально нужно</h2><p>Votonobay сравнит корзину целиком — без трюка с одной дешёвой позицией.</p></div><b class="voto-cart-count">${qty?`${qty} шт. в корзине`:"Корзина пуста"}</b>`;
    input.insertAdjacentElement("beforebegin",intro);
  }

  function tuneCatalog(){
    const input=document.querySelector(".wrap .addr");
    if(input){
      input.type="search";
      input.placeholder="Найти товар";
      input.setAttribute("aria-label","Поиск товара в выбранном магазине");
      input.setAttribute("enterkeyhint","search");
      input.setAttribute("autocomplete","off");
      input.classList.add("voto-catalog-search");
    }
    catalogIntro();
    const products=document.querySelector(".products");
    if(products){
      products.setAttribute("aria-label","Товары");
      products.querySelectorAll(":scope > .item").forEach((item,index)=>{
        item.classList.add("voto-product-row","voto-product-card");
        const title=item.querySelector(".title")?.textContent?.trim()||`Товар ${index+1}`;
        const qty=Number(item.querySelector(".step b")?.textContent)||0;
        item.classList.toggle("is-in-cart",qty>0);
        item.setAttribute("aria-label",qty>0?`${title}, в корзине ${qty}`:title);
      });
      document.querySelector(".voto-empty-state")?.remove();
      const query=String(window.state?.q||"").trim();
      if(query&&products.querySelectorAll(":scope > .item").length===0){
        const empty=document.createElement("section");
        empty.className="voto-empty-state";
        empty.setAttribute("role","status");
        empty.innerHTML=`<span>НИЧЕГО НЕ НАШЛИ</span><h2>Такого товара пока нет в этой витрине</h2><p>Сбрось поиск и продолжи собирать корзину. Состав не потеряется.</p><button type="button">Сбросить поиск</button>`;
        empty.querySelector("button").onclick=()=>{state.q="";window.render?.();};
        products.insertAdjacentElement("afterend",empty);
      }
    }
    tuneDock();
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

  function tuneEmptyCart(){
    document.querySelectorAll(".wrap > .hint").forEach(note=>{
      if(!note.textContent.includes("Корзина пока пустая"))return;
      note.classList.add("voto-empty-cart");
      const text=note.querySelector("span");
      if(text)setText(text,"Добавь нужные товары — Votonobay сравнит цену, способ покупки и удобство.");
      const button=note.querySelector("button");
      if(button)setText(button,"Добавить товары");
    });
  }

  function tuneCart(){
    document.querySelectorAll(".wrap > .item").forEach(item=>item.classList.add("voto-cart-item"));
    const primary=document.querySelector(".dock .btn.dark");
    if(primary){
      setText(primary,SCREEN_COPY.cart.compare);
      primary.classList.add("voto-cart-primary");
    }
    const dock=document.querySelector(".dock");
    if(dock){
      dock.classList.add("voto-shopping-dock","voto-cart-actions");
      dock.setAttribute("aria-label","Действия с корзиной");
      const summary=dock.querySelector(":scope > div");
      if(summary)summary.classList.add("voto-cart-summary");
      Array.from(dock.children).forEach(node=>{
        if(!(node instanceof Element)||node===summary)return;
        const match=node.textContent.match(/дешевле на\s+([\d\s]+)\s*₽/i);
        if(!match)return;
        node.classList.add("voto-cart-opportunity");
        node.textContent=`Есть вариант с экономией ${match[1].trim()} ₽ — проверим, стоит ли переключаться.`;
      });
      const secondary=dock.querySelector(".ghost");
      if(secondary)setText(secondary,"Другие магазины");
    }
    tuneEmptyCart();
    document.querySelector(".voto-cart-constraint")?.remove();
    const plan=currentPlan();
    const copy=deliveryConstraint(plan);
    if(copy&&dock){
      const summary=dock.querySelector(".voto-cart-summary")||dock.querySelector(":scope > div");
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
    document.querySelector(".v2-verdict")?.classList.add("voto-decision-lead");
    const rows=window.TDCompare?.fromWindow?.()||[];
    document.querySelectorAll(".plan").forEach((plan,index)=>{
      plan.classList.add("voto-comparison-plan","voto-option-card");
      const name=plan.querySelector("h3")?.textContent?.trim();
      if(name)plan.setAttribute("aria-label",`Вариант: ${name}`);
      const badge=plan.querySelector(".badge");
      if(badge)setText(badge,"рекомендую");
      const why=plan.querySelector(".ghost");
      if(why&&/Почему/i.test(why.textContent))setText(why,"Почему этот вариант");
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

  window.TDVotonobayInner={decorate,deliveryConstraint,currentPlan,tuneDock,tuneEmptyCart,cartQty,catalogIntro};
})();
