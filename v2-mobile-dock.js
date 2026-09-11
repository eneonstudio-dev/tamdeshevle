(() => {
  "use strict";

  function createDock(){
    const nav=document.createElement("nav");
    nav.className="v2-bottom-nav";
    nav.setAttribute("aria-label","Мобильная навигация");
    nav.innerHTML=`<button type="button" data-screen="home"><i aria-hidden="true">⌂</i><span>Главная</span></button><button type="button" data-screen="catalog"><i aria-hidden="true">⌕</i><span>Поиск</span></button><button type="button" data-screen="cart"><i aria-hidden="true">☷</i><span>Список</span></button><button type="button" data-screen="stores"><i aria-hidden="true">⌖</i><span>Карта</span></button><button type="button" data-screen="profile" class="td-profile-btn"><i aria-hidden="true">○</i><span>Профиль</span></button>`;
    nav.querySelectorAll("button[data-screen]").forEach(button=>{
      if(button.dataset.screen!=="profile") button.onclick=()=>button.dataset.screen==="stores"&&window.TDGeo?.openMap?TDGeo.openMap():go(button.dataset.screen);
    });
    document.body.appendChild(nav);
    return nav;
  }

  function hydrate(){
    if(!window.state)return;
    const docks=[...document.querySelectorAll(".v2-bottom-nav")];
    let nav=docks.find(dock=>dock.parentElement===document.body)||docks[0];
    if(!nav) nav=createDock();
    docks.forEach(dock=>{if(dock!==nav)dock.remove();});
    nav.querySelectorAll("button").forEach(button=>{
      const active=button.dataset.screen===state.screen;
      button.classList.toggle("is-active",active);
      if(active) button.setAttribute("aria-current","page");
      else button.removeAttribute("aria-current");
    });
  }

  window.addEventListener("td:v2-rendered",hydrate);
  window.addEventListener("pageshow",hydrate);
  hydrate();
})();
