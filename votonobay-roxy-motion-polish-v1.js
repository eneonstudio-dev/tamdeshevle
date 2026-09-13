(()=>{
  "use strict";
  if(window.__TDRoxyMotionPolishV1)return;
  window.__TDRoxyMotionPolishV1=true;

  const motionQuery=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const REVEAL_SELECTOR=[
    ".v2-hero",".v2-section",".v2-basket-card",".v2-footer",
    ".voto-store-choice",".voto-product-card",".voto-cart-item",
    ".voto-cart-summary",".voto-decision-lead",".td-compare-hero",
    ".td-compare-plan",".plan",".roxy-catalog-bay-hint"
  ].join(",");
  let lastScreen="",bayTimer=0,parallaxFrame=0;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-motion-polish-v1="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-roxy-motion-polish-v1.css?v=20260913-v1";
    link.dataset.roxyMotionPolishV1="1";
    document.head.appendChild(link);
  }

  function screenRoot(){
    return document.querySelector(".v2-inner-screen")||document.querySelector(".v2-main")||document.querySelector("main");
  }

  function visible(node){
    if(!node?.isConnected)return false;
    const style=getComputedStyle(node),rect=node.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&style.display!=="none"&&style.visibility!=="hidden";
  }

  function markReveal(root){
    if(!root)return;
    root.querySelectorAll("[data-roxy-reveal='1']").forEach(node=>{
      delete node.dataset.roxyReveal;
      node.style.removeProperty("--roxy-i");
    });
    [...root.querySelectorAll(REVEAL_SELECTOR)].filter(visible).slice(0,14).forEach((node,index)=>{
      node.dataset.roxyReveal="1";
      node.style.setProperty("--roxy-i",String(Math.min(index,9)));
    });
  }

  function animateScreen(force=false){
    const root=screenRoot();
    if(!root)return false;
    const screen=String(window.state?.screen||root.dataset.screen||"page");
    markReveal(root);
    if(motionQuery?.matches){
      root.classList.remove("roxy-screen-enter");
      lastScreen=screen;
      return true;
    }
    if(!force&&screen===lastScreen)return true;
    lastScreen=screen;
    root.classList.remove("roxy-screen-enter");
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(root.isConnected)root.classList.add("roxy-screen-enter");
    }));
    return true;
  }

  function resetHero(hero){
    if(!hero)return;
    hero.style.setProperty("--roxy-bay-x","0px");
    hero.style.setProperty("--roxy-bay-y","0px");
  }

  function bindHeroParallax(){
    const hero=document.querySelector(".v2-hero");
    if(!hero||hero.dataset.roxyParallaxBound==="1")return false;
    hero.dataset.roxyParallaxBound="1";
    hero.dataset.roxyParallax="1";
    const move=event=>{
      if(motionQuery?.matches)return resetHero(hero);
      cancelAnimationFrame(parallaxFrame);
      parallaxFrame=requestAnimationFrame(()=>{
        if(!hero.isConnected)return;
        const rect=hero.getBoundingClientRect();
        if(!rect.width||!rect.height)return;
        const x=((event.clientX-rect.left)/rect.width-.5)*2;
        const y=((event.clientY-rect.top)/rect.height-.5)*2;
        hero.style.setProperty("--roxy-bay-x",`${Math.max(-1,Math.min(1,x))*6}px`);
        hero.style.setProperty("--roxy-bay-y",`${Math.max(-1,Math.min(1,y))*4}px`);
      });
    };
    hero.addEventListener("pointermove",move,{passive:true});
    hero.addEventListener("pointerleave",()=>resetHero(hero),{passive:true});
    return true;
  }

  function pulseBay(kind){
    if(motionQuery?.matches)return;
    const bai=document.getElementById("bai-assistant");
    if(!bai||bai.dataset.state==="hidden")return;
    clearTimeout(bayTimer);
    bai.classList.remove("roxy-bay-nod","roxy-bay-focus");
    requestAnimationFrame(()=>{
      if(!bai.isConnected)return;
      bai.classList.add(kind);
      bayTimer=setTimeout(()=>bai.classList.remove(kind),680);
    });
  }

  function interaction(event){
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    if(target.closest(".v2-add,.step button:last-child,.voto-product-card .step button:last-child")){
      pulseBay("roxy-bay-nod");
      return;
    }
    if(target.closest(".v2-bay-primary,.v2-compare,.voto-cart-primary,.voto-decision-lead>button,.td-compare-hero-actions button,.td-compare-plan button")){
      pulseBay("roxy-bay-focus");
    }
  }

  function hydrate(force=false){
    if(document.hidden)return;
    ensureStyle();
    document.body?.setAttribute("data-roxy-motion","1");
    animateScreen(force);
    bindHeroParallax();
  }

  document.addEventListener("click",interaction);
  window.addEventListener("td:v2-rendered",()=>requestAnimationFrame(()=>hydrate(false)));
  window.addEventListener("pageshow",()=>hydrate(true));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)hydrate(false)});
  window.addEventListener("pagehide",()=>{
    clearTimeout(bayTimer);
    cancelAnimationFrame(parallaxFrame);
    bayTimer=0;parallaxFrame=0;
  });
  motionQuery?.addEventListener?.("change",()=>{
    document.querySelectorAll(".v2-hero[data-roxy-parallax='1']").forEach(resetHero);
    if(!motionQuery.matches)animateScreen(true);
  });

  hydrate(true);
  window.TDRoxyMotionPolishV1={hydrate,animateScreen,pulseBay,bindHeroParallax};
})();
