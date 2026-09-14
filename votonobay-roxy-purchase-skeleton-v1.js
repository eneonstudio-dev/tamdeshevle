(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyPurchaseSkeletonV1)return;
  window.__TDVotonobayRoxyPurchaseSkeletonV1=true;

  import("./votonobay-roxy-handoff-v1.js?v=20260914-v1").catch(error=>console.warn("[Votonobay Handoff] load failed",error));

  const STYLE_HREF="votonobay-roxy-purchase-skeleton-v1.css?v=20260914-v1";
  const APPROVED_CHECKING="assets/bai/bai-checking-approved-v1.webp";
  let queued=false;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-purchase-skeleton="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE_HREF;
    link.dataset.roxyPurchaseSkeleton="1";
    document.head.appendChild(link);
  }

  function sectionHead(label,title){
    const head=document.createElement("div");
    head.className="td-compare-section-head roxy-purchase-section-head";
    const small=document.createElement("small");small.textContent=label;
    const heading=document.createElement("h3");heading.textContent=title;
    head.append(small,heading);
    return head;
  }

  function buildTradeoff(main,hero){
    let section=main.querySelector(".roxy-purchase-tradeoff");
    const verdict=hero.querySelector(".td-compare-verdict")||section?.querySelector(".td-compare-verdict");
    if(!verdict)return section;
    if(!section){
      section=document.createElement("section");
      section.className="roxy-purchase-tradeoff";
      section.append(sectionHead("КОМПРОМИСС","Что важно знать"),verdict);
    }else if(verdict.parentElement!==section)section.appendChild(verdict);
    return section;
  }

  function buildAction(main,hero){
    let section=main.querySelector(".roxy-purchase-action");
    const actions=hero.querySelector(".td-compare-hero-actions")||section?.querySelector(".td-compare-hero-actions");
    if(!actions)return section;
    if(!section){
      section=document.createElement("section");
      section.className="roxy-purchase-action";
      section.append(sectionHead("СЛЕДУЮЩИЙ ШАГ","Выбрать план и перейти к покупке"),actions);
    }else if(actions.parentElement!==section)section.appendChild(actions);
    const primary=actions.querySelector("[data-compare-apply]");
    if(primary){
      primary.dataset.tdPurchaseContinue="1";
      if(primary.textContent!=="Выбрать и продолжить")primary.textContent="Выбрать и продолжить";
    }
    return section;
  }

  function fixAlternatives(root){
    root.querySelectorAll(".td-compare-plan").forEach(card=>{
      const label=card.querySelector("small");
      if(label&&label.textContent.trim()==="Я бы выбрал")label.textContent="Альтернатива";
      const button=card.querySelector("[data-compare-apply]");
      if(button){
        button.dataset.tdPurchaseContinue="1";
        if(button.textContent!=="Выбрать этот вариант")button.textContent="Выбрать этот вариант";
      }
    });
  }

  function arrange(main,nodes){
    const sequence=nodes.filter(Boolean);
    const relevant=[...main.children].filter(node=>sequence.includes(node));
    if(sequence.length===relevant.length&&sequence.every((node,index)=>relevant[index]===node))return;
    sequence.forEach(node=>main.appendChild(node));
  }

  function decorate(root){
    if(!root)return false;
    ensureStyle();
    const main=root.querySelector(".td-compare-v2-shell>main");
    const hero=main?.querySelector(".td-compare-hero:not(.td-compare-hero-empty)");
    if(!main||!hero)return false;

    root.dataset.roxyPurchaseSkeleton="1";
    const heroEyebrow=hero.querySelector(":scope>small");
    if(heroEyebrow&&heroEyebrow.textContent!=="РЕКОМЕНДАЦИЯ БАЯ")heroEyebrow.textContent="РЕКОМЕНДАЦИЯ БАЯ";
    const bay=hero.querySelector(".td-compare-bay img");
    if(bay&&!bay.src.includes("bai-checking-approved-v1.webp"))bay.src=APPROVED_CHECKING;

    const why=main.querySelector(".td-compare-why");
    if(why){
      const head=why.querySelector(".td-compare-section-head");
      const small=head?.querySelector("small"),heading=head?.querySelector("h3");
      if(small&&small.textContent!=="ПОЧЕМУ")small.textContent="ПОЧЕМУ";
      if(heading&&heading.textContent!=="Почему я выбрал этот вариант")heading.textContent="Почему я выбрал этот вариант";
    }

    const tradeoff=buildTradeoff(main,hero);
    const action=buildAction(main,hero);
    const alternatives=main.querySelector(".td-compare-alternatives");
    const trust=main.querySelector(".td-trust");
    const note=main.querySelector(".td-compare-note");

    if(alternatives){
      const head=alternatives.querySelector(".td-compare-section-head");
      const small=head?.querySelector("small"),heading=head?.querySelector("h3");
      if(small&&small.textContent!=="ЕСЛИ ПРИОРИТЕТ ДРУГОЙ")small.textContent="ЕСЛИ ПРИОРИТЕТ ДРУГОЙ";
      if(heading&&heading.textContent!=="Другие варианты")heading.textContent="Другие варианты";
    }
    fixAlternatives(root);

    arrange(main,[hero,why,tradeoff,action,alternatives,trust,note]);
    root.dataset.roxyPurchaseOrder="verdict-why-tradeoff-action-alternatives-details";
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

  window.TDRoxyPurchaseSkeletonV1={decorate,schedule};
})();
