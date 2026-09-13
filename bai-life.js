(() => {
  "use strict";
  if(window.__TDBaiLifeInitialized)return;
  window.__TDBaiLifeInitialized=true;
  import("./bai-runtime-states-v1.js?v=20260912-states-v1").catch(error=>console.warn("[Bay Runtime States] load failed",error));
  import("./unified-cart-state-v1.js?v=20260912-v1")
    .then(()=>Promise.all([
      import("./bai-change-intelligence-v1.js?v=20260912-v1"),
      import("./bai-tradeoff-advisor-v1.js?v=20260912-v1")
    ]))
    .catch(error=>console.warn("[Bay Cart Intelligence] load failed",error));
  const bai=document.getElementById("bai-assistant");
  if(!bai)return;
  const character=bai.querySelector(".bai-character");
  const image=bai.querySelector(".bai-image");
  if(!character||!image)return;

  const APPROVED_PEEK="assets/bai/bai-peek-approved.webp";
  const APPROVED_PEEK_STATES=new Set(["greeting","peek","curious","thinking","excited","big-saving"]);
  function ensureApprovedStyle(){
    if(document.querySelector("style[data-approved-bay-v1]"))return;
    const style=document.createElement("style");
    style.dataset.approvedBayV1="1";
    style.textContent=`
      #bai-assistant .bai-image[src*="bai-peek-approved.webp"]{
        object-fit:cover!important;object-position:50% 68%!important;border-radius:34px!important;
        -webkit-mask-image:radial-gradient(ellipse 78% 72% at 50% 63%,#000 56%,rgba(0,0,0,.94) 68%,transparent 92%);
        mask-image:radial-gradient(ellipse 78% 72% at 50% 63%,#000 56%,rgba(0,0,0,.94) 68%,transparent 92%);
        filter:drop-shadow(0 14px 22px rgba(0,0,0,.28)) saturate(1.02)!important;
      }
      .v2-hero-bai img[src*="bai-peek-approved.webp"]{
        object-fit:cover!important;object-position:50% 72%!important;border-radius:38px!important;
        -webkit-mask-image:radial-gradient(ellipse 82% 76% at 50% 66%,#000 58%,rgba(0,0,0,.96) 70%,transparent 94%);
        mask-image:radial-gradient(ellipse 82% 76% at 50% 66%,#000 58%,rgba(0,0,0,.96) 70%,transparent 94%);
        filter:drop-shadow(0 26px 36px rgba(0,0,0,.34)) saturate(1.03)!important;
      }
      @media(max-width:700px){.v2-hero-bai img[src*="bai-peek-approved.webp"]{border-radius:28px!important}}
    `;
    document.head.appendChild(style);
  }
  function syncApprovedVisual(state=bai.dataset.state){
    if(APPROVED_PEEK_STATES.has(String(state||"")))image.src=APPROVED_PEEK;
  }
  function syncHeroVisual(){
    document.querySelectorAll(".v2-hero-bai img").forEach(node=>{
      if(!node.src.includes("bai-peek-approved.webp"))node.src=APPROVED_PEEK;
      node.alt="Бай — помощник Votonobay";
    });
  }

  ensureApprovedStyle();
  let life=bai.querySelector(".bai-life");
  if(!life){life=document.createElement("span");life.className="bai-life";life.setAttribute("aria-hidden","true");life.innerHTML="<i></i><i></i>";character.insertBefore(life,image)}
  let wake=bai.querySelector(".bai-wake");
  if(!wake){wake=document.createElement("span");wake.className="bai-wake";wake.textContent="Нажми, чтобы разбудить";character.appendChild(wake)}
  const motionQuery=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let timer=0,settleTimer=0,lastMicro="";
  function clearTimers(){clearTimeout(timer);clearTimeout(settleTimer);timer=0;settleTimer=0}
  function schedule(){clearTimeout(timer);timer=0;if(document.hidden||motionQuery?.matches)return;timer=setTimeout(ambient,7000+Math.random()*6500)}
  function ambient(){
    clearTimeout(timer);timer=0;
    bai.classList.remove("micro-ear","micro-blink","micro-tail");
    if(document.hidden||motionQuery?.matches)return;
    if(["idle","peek"].includes(bai.dataset.state)&&!bai.classList.contains("panel-open")){
      const variants=["micro-ear","micro-blink","micro-tail"].filter(x=>x!==lastMicro);
      const micro=variants[Math.floor(Math.random()*variants.length)]||"micro-blink";
      lastMicro=micro;
      requestAnimationFrame(()=>{if(!document.hidden&&!motionQuery?.matches)bai.classList.add(micro)});
    }
    schedule();
  }
  function settleResult(){settleTimer=0;if(document.hidden||window.state?.screen!=="compare")return;const verified=document.querySelector(".v2-verdict:not(.v2-verdict-wait)");window.TDBai?.setState(verified?"big-saving":"suspicious",verified?"Вот это уже настоящая экономия":"Не буду выдумывать победителя",3000)}
  function scheduleSettle(delay){clearTimeout(settleTimer);settleTimer=0;if(document.hidden)return;settleTimer=setTimeout(settleResult,delay)}
  function pause(){clearTimers();bai.classList.remove("micro-ear","micro-blink","micro-tail")}
  function resume(){if(document.hidden)return;syncHeroVisual();syncApprovedVisual();ambient();scheduleSettle(180)}
  function visibilityChanged(){document.hidden?pause():resume()}
  window.addEventListener("td:bai-state",event=>{
    character.setAttribute("aria-label",event.detail?.state==="hidden"?"Разбудить Бая":"Открыть Бая");
    syncApprovedVisual(event.detail?.state);
  });
  window.addEventListener("td:v2-rendered",()=>{syncHeroVisual();syncApprovedVisual();scheduleSettle(180)});
  document.addEventListener("click",event=>{if(event.target.closest(".v2-compare,.btn.dark"))scheduleSettle(520)});
  document.addEventListener("visibilitychange",visibilityChanged);
  window.addEventListener("pagehide",pause);
  window.addEventListener("pageshow",resume);
  motionQuery?.addEventListener?.("change",()=>motionQuery.matches?pause():resume());
  syncHeroVisual();syncApprovedVisual();
  ambient();scheduleSettle(900);
})();
