(() => {
  "use strict";
  if(window.__VotonobayApprovedExpressionsV1)return;
  window.__VotonobayApprovedExpressionsV1=true;

  const bai=document.getElementById("bai-assistant");
  const image=bai?.querySelector(".bai-image");
  if(!bai||!image)return;

  // Visual-only state map cut from the approved Roxy Bay character sheets.
  const EXPRESSIONS={
    idle:"assets/bai/bai-idle-approved-v1.webp",
    greeting:"assets/bai/bai-peek-approved.webp",
    peek:"assets/bai/bai-peek-approved.webp",
    curious:"assets/bai/bai-curious-approved-v1.webp",
    thinking:"assets/bai/bai-curious-approved-v1.webp",
    checking:"assets/bai/bai-checking-approved-v1.webp",
    suspicious:"assets/bai/bai-suspicious-approved-v1.webp",
    confused:"assets/bai/bai-suspicious-approved-v1.webp",
    scared:"assets/bai/bai-suspicious-approved-v1.webp",
    happy:"assets/bai/bai-happy-approved-v1.webp",
    excited:"assets/bai/bai-happy-approved-v1.webp",
    "big-saving":"assets/bai/bai-happy-approved-v1.webp",
    playful:"assets/bai/bai-happy-approved-v1.webp",
    sleepy:"assets/bai/bai-sleeping-approved-v1.webp",
    sleeping:"assets/bai/bai-sleeping-approved-v1.webp"
  };

  const ready=new Set();
  Object.values(EXPRESSIONS).forEach(src=>{
    if(ready.has(src))return;
    const probe=new Image();
    probe.onload=()=>ready.add(src);
    probe.src=src;
  });

  function ensureStyle(){
    if(document.querySelector("style[data-votonobay-approved-expressions-v1]"))return;
    const style=document.createElement("style");
    style.dataset.votonobayApprovedExpressionsV1="1";
    style.textContent=`
      #bai-assistant[data-approved-expression="1"] .bai-image{
        object-fit:cover!important;
        object-position:50% 50%!important;
        border-radius:36%!important;
        -webkit-mask-image:radial-gradient(ellipse 77% 76% at 50% 50%,#000 58%,rgba(0,0,0,.96) 73%,transparent 100%);
        mask-image:radial-gradient(ellipse 77% 76% at 50% 50%,#000 58%,rgba(0,0,0,.96) 73%,transparent 100%);
        filter:drop-shadow(0 11px 16px rgba(0,0,0,.28)) saturate(1.035)!important;
      }
      #bai-assistant[data-state="checking"][data-approved-expression="1"] .bai-image{object-position:52% 48%!important}
      #bai-assistant[data-state="happy"][data-approved-expression="1"] .bai-image,
      #bai-assistant[data-state="big-saving"][data-approved-expression="1"] .bai-image{filter:drop-shadow(0 12px 19px rgba(0,0,0,.3)) saturate(1.08) brightness(1.025)!important}
      #bai-assistant[data-state="suspicious"][data-approved-expression="1"] .bai-image{filter:drop-shadow(0 10px 15px rgba(0,0,0,.3)) saturate(.92) contrast(1.04)!important}
      #bai-assistant[data-state="sleepy"][data-approved-expression="1"] .bai-image,
      #bai-assistant[data-state="sleeping"][data-approved-expression="1"] .bai-image{filter:drop-shadow(0 8px 13px rgba(0,0,0,.24)) saturate(.78) brightness(.9)!important}
      @media(max-width:700px){
        #bai-assistant[data-approved-expression="1"] .bai-image{border-radius:32%!important;filter:drop-shadow(0 7px 11px rgba(0,0,0,.24)) saturate(1.03)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function apply(state=bai.dataset.state){
    const src=EXPRESSIONS[String(state||"")];
    if(!src){
      delete bai.dataset.approvedExpression;
      return;
    }
    bai.dataset.approvedExpression="1";
    if(!image.getAttribute("src")?.endsWith(src))image.src=src;
  }

  ensureStyle();
  window.addEventListener("td:bai-state",event=>apply(event.detail?.state));
  window.addEventListener("pageshow",()=>apply());
  apply();

  window.VotonobayBayExpressionsV1={apply,states:Object.keys(EXPRESSIONS)};
})();
