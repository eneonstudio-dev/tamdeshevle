(function(){
  "use strict";
  const STYLE_ID="td-ui-layer-coordinator-style";
  const BLOCKING_SELECTOR=".td-map-sheet,.td-point-detail,.td-one-tap,.td-account,.td-ai,.bai-panel";

  function injectStyles(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement("style");
    s.id=STYLE_ID;
    s.textContent=`
      .bai-assistant[data-ui-parked="true"]{opacity:0!important;pointer-events:none!important;transform:translateY(125%) rotate(4deg)!important}
      body[data-td-overlay-open="true"] .dock{pointer-events:none}
      .td-map-sheet,.td-point-detail,.td-one-tap,.td-account,.td-ai,.bai-panel{overscroll-behavior:contain}
      @media(max-width:430px){
        .td-one-tap{max-height:calc(100dvh - 24px - env(safe-area-inset-top));overflow:auto}
        .td-point-panel{padding-bottom:calc(16px + env(safe-area-inset-bottom))}
      }
      @media(prefers-reduced-motion:reduce){.bai-assistant[data-ui-parked="true"]{transition:none!important}}
    `;
    document.head.appendChild(s);
  }

  function isVisible(node){
    if(!node||!node.isConnected)return false;
    if(node.hidden||node.getAttribute("aria-hidden")==="true")return false;
    const style=getComputedStyle(node);
    return style.display!=="none"&&style.visibility!=="hidden";
  }

  function activeOverlay(){
    return [...document.querySelectorAll(BLOCKING_SELECTOR)].reverse().find(isVisible)||null;
  }

  function sync(){
    injectStyles();
    const overlay=activeOverlay();
    const bai=document.getElementById("bai-assistant");
    const app=document.getElementById("app");
    const blocked=Boolean(overlay);
    if(blocked)document.body.dataset.tdOverlayOpen="true";else document.body.removeAttribute("data-td-overlay-open");

    // Never inert a container that owns the active dialog itself: on browsers with
    // native inert support that makes the dialog unclickable and looks like a freeze.
    const shouldInertApp=Boolean(blocked&&app&&overlay&&!app.contains(overlay));
    if(app&&"inert" in app)app.inert=shouldInertApp;

    if(bai){
      const shouldPark=Boolean(blocked&&overlay&&!overlay.closest?.("#bai-assistant")&&!overlay.classList?.contains("bai-panel"));
      if(shouldPark){
        bai.dataset.uiParked="true";
        bai.setAttribute("aria-hidden","true");
        bai.tabIndex=-1;
      }else{
        bai.removeAttribute("data-ui-parked");
        bai.removeAttribute("aria-hidden");
        bai.tabIndex=0;
      }
    }
  }

  let raf=0;
  const observer=new MutationObserver(()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(sync);
  });

  function start(){
    sync();
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden","aria-hidden","class","style"]});
  }

  window.TDUILayers={refresh:sync,get blocked(){return Boolean(activeOverlay());},get active(){return activeOverlay();}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
