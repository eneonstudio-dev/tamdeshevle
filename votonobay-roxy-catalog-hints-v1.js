(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyCatalogHintsV1)return;
  window.__TDVotonobayRoxyCatalogHintsV1=true;

  let queued=false;
  let dismissed=false;
  const SELECTOR=".voto-catalog-search";
  const HINT_CLASS="roxy-catalog-bay-hint";
  const DISMISS_KEY="votonobay:catalog-hint-dismissed:v1";
  const WINDOW_DISMISS_KEY="__TDRoxyCatalogHintDismissedV1";

  function readDismissed(){
    if(dismissed||window[WINDOW_DISMISS_KEY]===true)return true;
    try{dismissed=sessionStorage.getItem(DISMISS_KEY)==="1"}catch{}
    if(dismissed)window[WINDOW_DISMISS_KEY]=true;
    return dismissed;
  }
  function rememberDismissed(){
    dismissed=true;
    window[WINDOW_DISMISS_KEY]=true;
    try{sessionStorage.setItem(DISMISS_KEY,"1")}catch{}
  }

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-catalog-hints-v1="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-roxy-catalog-hints-v1.css?v=20260913-v1";
    link.dataset.roxyCatalogHintsV1="1";
    document.head.appendChild(link);
  }

  function catalogSearch(){return document.querySelector(SELECTOR)}
  function anchorFor(search){
    if(!search)return null;
    if(search.matches("input,textarea"))return search.closest("form")||search;
    return search;
  }
  function isCatalogVisible(search){
    if(!search)return false;
    const r=search.getBoundingClientRect(),style=getComputedStyle(search);
    return r.width>0&&r.height>0&&style.display!=="none"&&style.visibility!=="hidden";
  }

  function removeStale(){
    document.querySelectorAll(`.${HINT_CLASS}`).forEach(node=>{
      if(!catalogSearch()||!isCatalogVisible(catalogSearch()))node.remove();
    });
  }

  function openBay(){
    window.TDBai?.setState?.("curious","Покажи, что выбираешь — посмотрю корзину целиком.",1800,false);
    if(window.TDShoppingAssistant?.open){
      Promise.resolve(window.TDShoppingAssistant.open()).finally(()=>window.TDRoxyBayPanel?.decorate?.());
      return;
    }
    window.TDBai?.openPanel?.();
  }

  function dismissHint(hint=document.querySelector(`.${HINT_CLASS}`)){
    rememberDismissed();
    if(hint)hint.classList.add("is-leaving");
    document.querySelectorAll(`.${HINT_CLASS}`).forEach(node=>node.remove());
  }

  function makeHint(){
    const hint=document.createElement("aside");
    hint.className=HINT_CLASS;
    hint.dataset.roxyCatalogHint="1";
    hint.setAttribute("aria-label","Подсказка Бая");
    hint.innerHTML=`
      <div class="roxy-catalog-bay-media" aria-hidden="true">
        <img src="assets/bai/bai-curious-approved-v1.webp" alt="" draggable="false">
      </div>
      <div class="roxy-catalog-bay-copy">
        <small>ПОДСКАЗКА БАЯ</small>
        <b>Смотри на корзину целиком.</b>
        <p>Один дешёвый товар ещё не делает всю покупку выгоднее. Могу проверить цену, удобство и магазины.</p>
      </div>
      <div class="roxy-catalog-bay-actions">
        <button class="roxy-catalog-bay-ask" type="button">Проверить с Баем</button>
        <button class="roxy-catalog-bay-dismiss" type="button" aria-label="Скрыть подсказку">×</button>
      </div>`;
    hint.querySelector(".roxy-catalog-bay-ask")?.addEventListener("click",openBay);
    return hint;
  }

  function decorate(){
    ensureStyle();
    const search=catalogSearch();
    if(!isCatalogVisible(search)){
      removeStale();
      return false;
    }
    if(readDismissed()){
      document.querySelectorAll(`.${HINT_CLASS}`).forEach(node=>node.remove());
      return false;
    }
    if(document.querySelector(`.${HINT_CLASS}`))return true;
    const anchor=anchorFor(search);
    if(!anchor?.parentElement)return false;
    const hint=makeHint();
    anchor.insertAdjacentElement("afterend",hint);
    requestAnimationFrame(()=>hint.classList.add("is-ready"));
    return true;
  }

  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;decorate()});
  }

  // Capture dismissal at the document boundary so a simultaneous panel/render
  // mutation cannot replace the hint before its own button listener runs.
  document.addEventListener("click",event=>{
    const target=event.target instanceof Element?event.target:null;
    const dismiss=target?.closest?.(`.${HINT_CLASS} .roxy-catalog-bay-dismiss`);
    if(!dismiss)return;
    event.preventDefault();
    dismissHint(dismiss.closest(`.${HINT_CLASS}`));
  },true);

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("td:v2-rendered",schedule);
  window.addEventListener("pageshow",schedule);
  document.addEventListener("input",event=>{if(event.target.closest?.(SELECTOR))schedule()},{passive:true});
  schedule();

  window.TDRoxyCatalogHintsV1={decorate,schedule,dismiss:()=>dismissHint()};
})();
