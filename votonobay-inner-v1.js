(()=>{
  "use strict";

  const SCREEN_COPY={
    stores:{title:"Магазины",sub:"Выбери магазин — сравнение останется на одной корзине"},
    catalog:{sub:"Собери список — Votonobay сравнит варианты целиком"},
    cart:{title:"Корзина",compare:"Сравнить варианты"},
    compare:{title:"Сравнение вариантов",sub:"Одна корзина · цена, способ покупки и подтверждённость данных"}
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

  function tuneCart(){
    const primary=document.querySelector(".dock .btn.dark");
    if(primary)setText(primary,SCREEN_COPY.cart.compare);
    const dock=document.querySelector(".dock");
    if(dock)dock.setAttribute("aria-label","Действия с корзиной");
  }

  function tuneCompare(){
    const toggle=document.querySelector(".toggle");
    if(toggle){
      toggle.setAttribute("role","group");
      toggle.setAttribute("aria-label","Способ покупки");
      toggle.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.classList.contains("on"))));
    }
    document.querySelectorAll(".plan").forEach(plan=>{
      const name=plan.querySelector("h3")?.textContent?.trim();
      if(name)plan.setAttribute("aria-label",`Вариант: ${name}`);
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

  window.TDVotonobayInner={decorate};
})();
