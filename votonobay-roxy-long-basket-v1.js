(()=>{
  "use strict";
  if(window.__TDRoxyLongBasketV1)return;
  window.__TDRoxyLongBasketV1=true;
  const STYLE="votonobay-roxy-long-basket-v1.css?v=20260914-v1";
  let queued=false;
  function ensureStyle(){
    if(document.querySelector('link[data-roxy-long-basket]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE;
    link.dataset.roxyLongBasket="1";
    document.head.appendChild(link);
  }
  function maxVisible(){return matchMedia("(max-width: 820px)").matches?5:8}
  function decorate(summary){
    if(!summary)return false;
    ensureStyle();
    const lines=[...summary.querySelectorAll(":scope > .td-ai-line")];
    const total=summary.querySelector(":scope > .td-ai-total");
    let button=summary.querySelector(":scope > .roxy-long-basket-toggle");
    const max=maxVisible();
    if(lines.length<=max){
      lines.forEach(line=>line.hidden=false);
      button?.remove();
      summary.dataset.roxyLongBasket="short";
      return false;
    }
    const expanded=summary.dataset.roxyLongBasketExpanded==="1";
    summary.dataset.roxyLongBasket="1";
    lines.forEach((line,index)=>line.hidden=index>=max&&!expanded);
    if(!button){
      button=document.createElement("button");
      button.type="button";
      button.className="roxy-long-basket-toggle";
      button.onclick=()=>{
        summary.dataset.roxyLongBasketExpanded=summary.dataset.roxyLongBasketExpanded==="1"?"0":"1";
        decorate(summary);
      };
      if(total)summary.insertBefore(button,total);else summary.appendChild(button);
    }
    button.setAttribute("aria-expanded",expanded?"true":"false");
    button.textContent=expanded?"Свернуть корзину":`Показать ещё ${lines.length-max}`;
    return true;
  }
  function run(){queued=false;document.querySelectorAll(".td-ai-summary").forEach(decorate)}
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("td:shopping-state",schedule);
  schedule();
  window.TDRoxyLongBasketV1={decorate,schedule,maxVisible};
})();
