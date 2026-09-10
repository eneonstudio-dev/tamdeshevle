(function(){
  "use strict";
  const products=()=>typeof PRODUCTS!=="undefined"?PRODUCTS:[];
  const count=()=>products().reduce((sum,p)=>sum+Number(window.state&&state.cart&&state.cart[p.id]||0),0);
  const items=()=>products().filter(p=>window.state&&state.cart&&state.cart[p.id]>0);

  function ensureMobileCart(){
    if(!window.state||state.screen!=="home") return removeMobileCart();
    let bar=document.querySelector(".v2-mobile-cartbar");
    if(!bar){
      bar=document.createElement("div");
      bar.className="v2-mobile-cartbar";
      bar.setAttribute("role","region");
      bar.setAttribute("aria-label","Корзина");
      document.body.appendChild(bar);
    }
    const qty=count();
    const list=items();
    bar.hidden=qty===0;
    bar.innerHTML=`<div class="v2-mobile-cartbar-copy"><b>${list.length?`В корзине ${qty} шт.`:"Корзина пуста"}</b><span>${list.length?"Сравним всю корзину по магазинам":"Добавь товары, чтобы увидеть выгоду"}</span></div><button type="button">Сравнить →</button>`;
    const btn=bar.querySelector("button");
    if(btn) btn.onclick=()=>{ if(window.go) go("compare"); };
  }

  function removeMobileCart(){ document.querySelector(".v2-mobile-cartbar")?.remove(); }

  function hydrate(){
    ensureMobileCart();
    const header=document.querySelector(".v2-header");
    if(header) header.classList.toggle("td-scrolled",window.scrollY>8);
  }

  document.addEventListener("click",function(event){
    const add=event.target.closest(".v2-add");
    if(!add) return;
    const card=add.closest(".v2-product-card");
    if(card){
      card.classList.remove("td-added");
      requestAnimationFrame(()=>card.classList.add("td-added"));
      setTimeout(()=>card.classList.remove("td-added"),450);
    }
    requestAnimationFrame(ensureMobileCart);
  },{passive:true});

  window.addEventListener("scroll",function(){
    const header=document.querySelector(".v2-header");
    if(header) header.classList.toggle("td-scrolled",window.scrollY>8);
  },{passive:true});

  window.addEventListener("td:v2-rendered",hydrate);
  window.addEventListener("pageshow",hydrate);
  hydrate();
})();
