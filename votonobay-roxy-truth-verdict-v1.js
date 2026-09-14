(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyTruthVerdictV1)return;
  window.__TDVotonobayRoxyTruthVerdictV1=true;

  const STYLE_HREF="votonobay-roxy-truth-verdict-v1.css?v=20260914-v1";
  let queued=false;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-truth-verdict="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE_HREF;
    link.dataset.roxyTruthVerdict="1";
    document.head.appendChild(link);
  }

  function truthState(plan){
    const trust=window.TDComparisonResultV2?.trustFor?.(plan)||null;
    if(!trust||!trust.total)return{kind:"unknown",label:"Данные не подтверждены",detail:"Итог ориентировочный — проверь цены перед покупкой"};
    if(trust.good===trust.total)return{kind:"verified",label:"Цены подтверждены",detail:`Все ${trust.total} цен свежие`};
    if(trust.good>0)return{kind:"mixed",label:"Часть цен требует проверки",detail:`${trust.good}/${trust.total} цен подтверждены · итог ориентировочный`};
    return{kind:"uncertain",label:"Цены требуют проверки",detail:"Итог ориентировочный — свежих подтверждений нет"};
  }

  function decorate(root){
    const hero=root?.querySelector?.(".td-compare-hero:not(.td-compare-hero-empty)");
    const plan=window.TDShoppingState?.get?.().lastPlans?.[0]||null;
    if(!hero||!plan)return false;
    ensureStyle();
    const info=truthState(plan);
    let badge=hero.querySelector(".roxy-truth-verdict");
    if(!badge){
      badge=document.createElement("div");
      badge.className="roxy-truth-verdict";
      badge.setAttribute("role","status");
      const summary=hero.querySelector(".td-compare-summary");
      if(summary)summary.insertAdjacentElement("afterend",badge);else hero.appendChild(badge);
    }
    badge.dataset.truthState=info.kind;
    badge.replaceChildren();
    const dot=document.createElement("i");dot.setAttribute("aria-hidden","true");
    const copy=document.createElement("span");
    const strong=document.createElement("b");strong.textContent=info.label;
    const small=document.createElement("small");small.textContent=info.detail;
    copy.append(strong,small);badge.append(dot,copy);
    hero.dataset.roxyTruthState=info.kind;

    const total=hero.querySelector(".td-compare-summary>strong");
    if(total){
      const base=total.dataset.roxyTruthBase||total.textContent.replace(/^≈\s*/,"").trim();
      total.dataset.roxyTruthBase=base;
      total.textContent=info.kind==="verified"?base:`≈ ${base}`;
      total.setAttribute("aria-label",info.kind==="verified"?`Подтверждённый итог ${base}`:`Ориентировочный итог ${base}`);
    }
    return true;
  }

  function decorateAll(){
    queued=false;
    document.querySelectorAll(".td-compare-v2").forEach(decorate);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(decorateAll)}

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("td:shopping-state",schedule);
  window.addEventListener("pageshow",schedule);
  schedule();
  window.TDRoxyTruthVerdictV1={decorate,schedule,truthState};
})();
