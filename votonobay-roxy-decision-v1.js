(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyDecisionV1)return;
  window.__TDVotonobayRoxyDecisionV1=true;

  let queued=false;
  const ASSETS={happy:"assets/bai/bai-happy-approved-v1.webp",checking:"assets/bai/bai-checking-approved-v1.webp"};

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-decision-v1="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-roxy-decision-v1.css?v=20260913-v1";
    link.dataset.roxyDecisionV1="1";
    document.head.appendChild(link);
  }

  function plan(){return window.TDShoppingState?.get?.()?.lastPlans?.[0]||null}
  function storeCount(best){return new Set((best?.products||[]).map(item=>String(item?.storeId||"").split("_")[0]).filter(Boolean)).size}
  function wordStores(count){if(count===1)return"1 магазин";if(count>1&&count<5)return`${count} магазина`;return`${count} магазинов`}
  function wordPositions(count){if(count===1)return"1 позиция";if(count>1&&count<5)return`${count} позиции`;return`${count} позиций`}

  function decorateAlternatives(root){
    const strategies=root.querySelector(".td-ai-strategies");
    if(!strategies)return null;
    strategies.classList.add("roxy-decision-alternatives");
    const head=strategies.querySelector(".td-ai-strategies-head");
    const title=head?.querySelector("b"),sub=head?.querySelector("span");
    if(title&&title.textContent!=="Альтернативы")title.textContent="Альтернативы";
    if(sub&&sub.textContent!=="если приоритет другой")sub.textContent="если приоритет другой";
    return strategies;
  }

  function decorateSummary(root){
    const summary=root.querySelector(".td-ai-summary");
    if(!summary)return null;
    summary.classList.add("roxy-decision-details");
    if(summary.dataset.resultLabel!=="ДЕТАЛИ КОРЗИНЫ")summary.dataset.resultLabel="ДЕТАЛИ КОРЗИНЫ";
    return summary;
  }

  function revealDecision(root,section){
    if(section.dataset.roxyDecisionRevealed==="1")return;
    section.dataset.roxyDecisionRevealed="1";
    if(!window.matchMedia?.("(max-width:820px), (hover:none) and (pointer:coarse) and (max-width:1100px)")?.matches)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(!section.isConnected)return;
      const scroller=section.closest(".td-ai-messages");
      if(scroller){
        const sr=scroller.getBoundingClientRect(),dr=section.getBoundingClientRect();
        scroller.scrollTop+=dr.top-sr.top-8;
      }else section.scrollIntoView({block:"start",inline:"nearest",behavior:"auto"});
    }));
  }

  function decorateDecision(root){
    const section=root.querySelector(".td-ai-decision-cta");
    if(!section)return false;
    const best=plan();
    if(!best)return false;
    if(section.dataset.roxyDecision!=="1"){
      section.dataset.roxyDecision="1";
      const eyebrow=section.querySelector(":scope>small");
      const title=section.querySelector(":scope>b");
      const copy=section.querySelector(":scope>p");
      const note=section.querySelector(":scope>.td-ai-decision-note");
      const trusted=["VERIFIED","LIVE"].includes(String(best.quality||"").toUpperCase());
      const count=storeCount(best);

      if(eyebrow)eyebrow.textContent="РЕКОМЕНДАЦИЯ БАЯ";
      if(title)title.textContent="Я бы выбрал этот план.";

      const lead=document.createElement("div");
      lead.className="roxy-decision-lead";
      const avatar=document.createElement("img");
      avatar.className="roxy-decision-bay";
      avatar.src=trusted?ASSETS.happy:ASSETS.checking;
      avatar.alt="";
      avatar.setAttribute("aria-hidden","true");
      const heading=document.createElement("div");
      heading.className="roxy-decision-heading";
      if(eyebrow)heading.appendChild(eyebrow);
      if(title)heading.appendChild(title);
      lead.append(avatar,heading);
      section.prepend(lead);

      const reasons=document.createElement("div");
      reasons.className="roxy-decision-reasons";
      const productCount=(best.products||[]).length;
      [productCount?wordPositions(productCount):"Корзина собрана",count?wordStores(count):"Маршрут готов",trusted?"Данные проверены":"Расчёт ориентировочный"].forEach(text=>{
        const chip=document.createElement("span");chip.textContent=text;reasons.appendChild(chip);
      });
      lead.insertAdjacentElement("afterend",reasons);

      if(copy){
        const why=document.createElement("div");why.className="roxy-decision-block roxy-decision-why";
        const label=document.createElement("small");label.textContent="ПОЧЕМУ";
        copy.insertAdjacentElement("beforebegin",why);why.append(label,copy);
      }
      if(note){
        const tradeoff=document.createElement("div");tradeoff.className="roxy-decision-block roxy-decision-tradeoff";
        const label=document.createElement("small");label.textContent="КОМПРОМИСС";
        note.insertAdjacentElement("beforebegin",tradeoff);tradeoff.append(label,note);
      }
    }

    const alternatives=decorateAlternatives(root),summary=decorateSummary(root);
    const parent=section.parentElement;
    const anchor=alternatives||summary;
    if(parent&&anchor&&anchor.parentElement===parent&&section.nextElementSibling!==anchor)parent.insertBefore(section,anchor);
    revealDecision(root,section);
    return true;
  }

  function decorate(){
    ensureStyle();
    const root=document.querySelector("body>.td-ai");
    if(!root)return false;
    root.dataset.roxyDecisionLayer="1";
    decorateAlternatives(root);
    decorateSummary(root);
    return decorateDecision(root);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})}

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("td:shopping-state",schedule);
  window.addEventListener("td:v2-rendered",schedule);
  window.addEventListener("pageshow",schedule);
  schedule();

  window.TDRoxyDecisionV1={decorate,schedule};
})();
