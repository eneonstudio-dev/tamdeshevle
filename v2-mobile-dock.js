(() => {
  "use strict";
  if(window.__TDV2MobileDockInitialized)return;
  window.__TDV2MobileDockInitialized=true;

  const ROUTES=["home",null,"catalog","cart","profile"];

  function markCanonicalButtons(nav){
    const buttons=[...nav.querySelectorAll("button")];
    ROUTES.forEach((screen,index)=>{
      const button=buttons[index];
      if(!button)return;
      button.type="button";
      if(screen){button.dataset.screen=screen;delete button.dataset.action}
      else{delete button.dataset.screen;button.dataset.action="bai"}
      if(screen==="profile")button.classList.add("td-profile-btn");
    });
    return buttons;
  }

  function createDock(){
    const nav=document.createElement("nav");
    nav.className="v2-bottom-nav";
    nav.setAttribute("aria-label","Мобильная навигация");
    nav.innerHTML=`<button type="button" data-screen="home"><i aria-hidden="true">⌂</i><span>Главная</span></button><button type="button" data-action="bai"><i aria-hidden="true">✦</i><span>Бай</span></button><button type="button" data-screen="catalog"><i aria-hidden="true">⌕</i><span>Поиск</span></button><button type="button" data-screen="cart"><i aria-hidden="true">☷</i><span>Список</span></button><button type="button" data-screen="profile" class="td-profile-btn"><i aria-hidden="true">○</i><span>Профиль</span></button>`;
    nav.querySelector('[data-action="bai"]').onclick=()=>window.tdBayFirstAsk?.();
    nav.querySelectorAll("button[data-screen]").forEach(button=>{
      if(button.dataset.screen!=="profile")button.onclick=()=>window.go?.(button.dataset.screen);
    });
    document.body.appendChild(nav);
    return nav;
  }

  function hydrate(){
    const screen=window.state?.screen;
    if(!screen)return;
    const docks=[...document.querySelectorAll(".v2-bottom-nav")];
    let nav=docks.find(dock=>dock.parentElement===document.body)||docks[0];
    if(!nav)nav=createDock();
    docks.forEach(dock=>{if(dock!==nav)dock.remove();});
    markCanonicalButtons(nav).forEach(button=>{
      const active=Boolean(button.dataset.screen)&&button.dataset.screen===screen;
      button.classList.toggle("is-active",active);
      if(active)button.setAttribute("aria-current","page");
      else button.removeAttribute("aria-current");
    });
  }

  window.addEventListener("td:v2-rendered",hydrate);
  window.addEventListener("td:runtime-resume",hydrate);
  window.addEventListener("pageshow",hydrate);
  hydrate();
})();
