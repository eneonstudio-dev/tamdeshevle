(() => {
  "use strict";
  function hydrate(){
    if(!window.state)return;
    let nav=document.querySelector(".v2-bottom-nav");
    if(!nav){
      nav=document.createElement("nav");nav.className="v2-bottom-nav";nav.setAttribute("aria-label","Мобильная навигация");
      nav.innerHTML=`<button data-screen="home"><i>⌂</i><span>Главная</span></button><button data-screen="catalog"><i>⌕</i><span>Поиск</span></button><button data-screen="cart"><i>☷</i><span>Список</span></button><button data-screen="stores"><i>⌖</i><span>Карта</span></button><button data-screen="profile" class="td-profile-btn"><i>○</i><span>Профиль</span></button>`;
      document.body.appendChild(nav);
      nav.querySelectorAll("button[data-screen]").forEach(button=>{if(button.dataset.screen!=="profile")button.onclick=()=>button.dataset.screen==="stores"&&window.TDGeo?.openMap?TDGeo.openMap():go(button.dataset.screen);});
    }
    nav.querySelectorAll("button").forEach(button=>button.classList.toggle("is-active",button.dataset.screen===state.screen));
  }
  window.addEventListener("td:v2-rendered",hydrate);window.addEventListener("pageshow",hydrate);hydrate();
})();
