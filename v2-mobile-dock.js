(() => {
  "use strict";
  if(window.__TDV2MobileDockInitialized)return;
  window.__TDV2MobileDockInitialized=true;

  let viewportFrame=0;

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

  function clearViewportFrame(){
    if(viewportFrame)cancelAnimationFrame(viewportFrame);
    viewportFrame=0;
  }

  function syncViewport(){
    viewportFrame=0;
    const vv=window.visualViewport;
    const viewportHeight=Math.max(320,Math.round(vv?.height||window.innerHeight||document.documentElement.clientHeight||320));
    const viewportTop=Math.max(0,Math.round(vv?.offsetTop||0));
    const layoutHeight=Math.max(viewportHeight,Math.round(window.innerHeight||viewportHeight));
    const covered=Math.max(0,layoutHeight-viewportHeight-viewportTop);
    const keyboardOpen=covered>120;
    const doc=document.documentElement;
    doc.style.setProperty("--td-vvh",`${viewportHeight}px`);
    doc.style.setProperty("--td-vvtop",`${viewportTop}px`);
    doc.style.setProperty("--td-keyboard-cover",`${covered}px`);
    if(document.body){
      if(keyboardOpen)document.body.setAttribute("data-td-keyboard-open","true");
      else document.body.removeAttribute("data-td-keyboard-open");
    }
  }

  function queueViewportSync(){
    if(document.hidden||viewportFrame)return;
    viewportFrame=requestAnimationFrame(syncViewport);
  }

  function pauseViewport(){
    clearViewportFrame();
    document.body?.removeAttribute("data-td-keyboard-open");
  }

  const vv=window.visualViewport;
  vv?.addEventListener("resize",queueViewportSync);
  vv?.addEventListener("scroll",queueViewportSync);
  window.addEventListener("orientationchange",queueViewportSync);
  document.addEventListener("visibilitychange",()=>document.hidden?pauseViewport():queueViewportSync());
  window.addEventListener("pagehide",pauseViewport);
  window.addEventListener("pageshow",()=>{hydrate();queueViewportSync()});
  window.addEventListener("td:v2-rendered",hydrate);

  hydrate();
  queueViewportSync();
})();
