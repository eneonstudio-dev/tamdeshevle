(()=>{
  "use strict";
  if(window.__TDRoxyMobileComposeV1)return;
  window.__TDRoxyMobileComposeV1=true;

  const STYLE="votonobay-roxy-mobile-compose-v1.css?v=20260914-v1";
  const MOBILE_QUERY="(max-width: 820px)";
  const KEYBOARD_THRESHOLD=120;
  const BOTTOM_THRESHOLD=72;
  let boundRoot=null;
  let viewportCleanup=null;
  let queued=false;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-mobile-compose]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE;
    link.dataset.roxyMobileCompose="1";
    document.head.appendChild(link);
  }

  function nearBottom(main){
    if(!main)return true;
    return main.scrollHeight-main.scrollTop-main.clientHeight<=BOTTOM_THRESHOLD;
  }

  function snapshot(main){
    return main?{scrollTop:main.scrollTop,nearBottom:nearBottom(main)}:{scrollTop:0,nearBottom:true};
  }

  function growTextarea(area){
    if(!area)return;
    area.style.height="auto";
    const css=getComputedStyle(area);
    const min=Math.max(48,parseFloat(css.minHeight)||48);
    const max=Math.max(min,parseFloat(css.maxHeight)||104);
    const wanted=Math.max(min,Math.min(max,area.scrollHeight||min));
    area.style.height=Math.round(wanted)+"px";
    area.dataset.roxyTextareaScroll=(area.scrollHeight||0)>max+1?"1":"0";
  }

  function settleScroll(main,state){
    if(!main||!state)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!document.contains(main))return;
      if(state.nearBottom){
        main.scrollTop=main.scrollHeight;
        return;
      }
      const max=Math.max(0,main.scrollHeight-main.clientHeight);
      main.scrollTop=Math.min(state.scrollTop,max);
    }));
  }

  function applyViewport(root,metrics,state){
    if(!root)return {keyboard:false,height:0,top:0,covered:0};
    const mobile=matchMedia(MOBILE_QUERY).matches;
    const metricHeight=Math.round(Number(metrics?.height)||window.innerHeight||320);
    const h=Math.max(320,mobile?metricHeight:(window.innerHeight||metricHeight));
    const top=mobile?Math.max(0,Math.round(Number(metrics?.offsetTop)||0)):0;
    const metricInner=Math.round(Number(metrics?.innerHeight)||window.innerHeight||h);
    const inner=Math.max(h,mobile?metricInner:(window.innerHeight||metricInner));
    const covered=mobile?Math.max(0,inner-h-top):0;
    const keyboard=mobile&&covered>KEYBOARD_THRESHOLD;
    root.style.setProperty("--td-ai-vvh",h+"px");
    root.style.setProperty("--td-ai-vvtop",top+"px");
    root.toggleAttribute("data-keyboard-open",keyboard);
    root.toggleAttribute("data-roxy-keyboard-open",keyboard);
    root.dataset.roxyViewportCovered=String(covered);
    settleScroll(root.querySelector(".td-ai-main"),state);
    return {keyboard,height:h,top,covered};
  }

  function currentMetrics(){
    const vv=window.visualViewport;
    return {height:vv?.height||window.innerHeight,offsetTop:vv?.offsetTop||0,innerHeight:window.innerHeight};
  }

  function bindViewport(root){
    viewportCleanup?.();
    const vv=window.visualViewport;
    const onViewport=()=>{
      const main=root.querySelector(".td-ai-main");
      applyViewport(root,currentMetrics(),snapshot(main));
    };
    vv?.addEventListener("resize",onViewport,{passive:true});
    vv?.addEventListener("scroll",onViewport,{passive:true});
    window.addEventListener("resize",onViewport,{passive:true});
    window.addEventListener("orientationchange",onViewport,{passive:true});
    viewportCleanup=()=>{
      vv?.removeEventListener("resize",onViewport);
      vv?.removeEventListener("scroll",onViewport);
      window.removeEventListener("resize",onViewport);
      window.removeEventListener("orientationchange",onViewport);
    };
    onViewport();
  }

  function decorate(root){
    if(!root)return false;
    ensureStyle();
    root.dataset.roxyMobileCompose="1";
    const area=root.querySelector(".td-ai-compose textarea");
    const compose=root.querySelector(".td-ai-compose");
    if(!area||!compose)return false;
    if(area.dataset.roxyComposeBound!=="1"){
      area.dataset.roxyComposeBound="1";
      area.addEventListener("input",()=>growTextarea(area));
      area.addEventListener("focus",()=>root.setAttribute("data-roxy-compose-focus","1"));
      area.addEventListener("blur",()=>root.removeAttribute("data-roxy-compose-focus"));
    }
    growTextarea(area);
    if(boundRoot!==root){boundRoot=root;bindViewport(root)}
    return true;
  }

  function run(){
    queued=false;
    const root=document.querySelector(".td-ai");
    if(!root){boundRoot=null;viewportCleanup?.();viewportCleanup=null;return}
    decorate(root);
  }

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(run)}

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener("input",event=>{const area=event.target.closest?.(".td-ai-compose textarea");if(area)growTextarea(area)});
  document.addEventListener("click",event=>{if(event.target.closest?.(".td-ai-entry,[data-action='basket']"))setTimeout(schedule,0)});
  schedule();

  window.TDRoxyMobileComposeV1={decorate,growTextarea,applyViewport,nearBottom,snapshot};
})();
