(function(){
  "use strict";
  const products=()=>typeof PRODUCTS!=="undefined"?PRODUCTS:[];
  const count=()=>products().reduce((sum,p)=>sum+Number(window.state&&state.cart&&state.cart[p.id]||0),0);
  const items=()=>products().filter(p=>window.state&&state.cart&&state.cart[p.id]>0);
  let headerScrollFrame=0;

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

  function enhanceMobileMenu(){
    const button=document.querySelector(".v2-menu");
    const menu=document.querySelector(".v2-mobile-nav");
    if(!button||!menu) return;
    if(!menu.id) menu.id="v2-mobile-menu";
    button.setAttribute("aria-controls",menu.id);
    button.setAttribute("aria-expanded",String(!menu.hidden));
  }

  function closeMobileMenu(returnFocus){
    const button=document.querySelector(".v2-menu");
    const menu=document.querySelector(".v2-mobile-nav");
    if(!button||!menu||menu.hidden) return;
    menu.hidden=true;
    button.setAttribute("aria-expanded","false");
    if(returnFocus) button.focus();
  }

  function syncHeaderScrollState(){
    const header=document.querySelector(".v2-header");
    if(header) header.classList.toggle("td-scrolled",window.scrollY>8);
  }

  function queueHeaderScrollState(){
    if(headerScrollFrame) return;
    headerScrollFrame=requestAnimationFrame(()=>{
      headerScrollFrame=0;
      syncHeaderScrollState();
    });
  }

  function hydrate(){
    ensureMobileCart();
    enhanceMobileMenu();
    syncHeaderScrollState();
  }

  document.addEventListener("click",function(event){
    const target=event.target instanceof Element?event.target:null;
    const add=target&&target.closest(".v2-add");
    if(add){
      const card=add.closest(".v2-product-card");
      if(card){
        card.classList.remove("td-added");
        requestAnimationFrame(()=>card.classList.add("td-added"));
        setTimeout(()=>card.classList.remove("td-added"),450);
      }
      requestAnimationFrame(ensureMobileCart);
      return;
    }

    const menuButton=target&&target.closest(".v2-menu");
    if(menuButton){
      requestAnimationFrame(()=>{
        enhanceMobileMenu();
        const menu=document.querySelector(".v2-mobile-nav");
        if(menu&&!menu.hidden) menu.querySelector("button")?.focus();
      });
      return;
    }

    const header=document.querySelector(".v2-header");
    if(header&&target&&!header.contains(target)) closeMobileMenu(false);
  });

  document.addEventListener("keydown",function(event){
    if(event.key==="Escape") closeMobileMenu(true);
  });

  window.addEventListener("scroll",queueHeaderScrollState,{passive:true});

  window.addEventListener("td:v2-rendered",hydrate);
  window.addEventListener("pageshow",hydrate);
  hydrate();
})();