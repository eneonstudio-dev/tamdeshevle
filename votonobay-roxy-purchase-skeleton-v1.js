(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyPurchaseSkeletonV1)return;
  window.__TDVotonobayRoxyPurchaseSkeletonV1=true;

  import("./votonobay-roxy-handoff-v1.js?v=20260914-v1").catch(error=>console.warn("[Votonobay Handoff] load failed",error));
  import("./votonobay-roxy-split-decision-v1.js?v=20260914-v1").catch(error=>console.warn("[Votonobay Split Decision] load failed",error));

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

  const money=value=>`${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  const storeCount=plan=>new Set((plan?.products||[]).map(item=>String(item?.storeId||"").split("_")[0]).filter(Boolean)).size;
  function trust(plan){
    const fallback={total:(plan?.products||[]).length,good:(plan?.products||[]).filter(line=>String(line?.quality||"").toUpperCase()==="LIVE").length};
    try{return window.TDComparisonResultV2?.trustFor?.(plan)||fallback}catch{return fallback}
  }
  function decisionFacts(best,other){
    if(!best)return null;
    const bestTrust=trust(best),otherTrust=other?trust(other):{good:0,total:0};
    const bestTotal=Number(best.total),otherTotal=Number(other?.total),bestGoods=Number(best.goods),otherGoods=Number(other?.goods);
    return{
      best,other,bestTrust,otherTrust,bestTotal,otherTotal,bestGoods,otherGoods,
      totalDelta:other&&Number.isFinite(bestTotal)&&Number.isFinite(otherTotal)?Math.round(otherTotal-bestTotal):null,
      goodsDelta:other&&Number.isFinite(bestGoods)&&Number.isFinite(otherGoods)?Math.round(otherGoods-bestGoods):null,
      frictionDelta:other?Math.round((Number(best.convenienceCost)||0)-(Number(other.convenienceCost)||0)):null,
      bestStores:storeCount(best),otherStores:storeCount(other)
    };
  }
  function verdictFromFacts(f){
    if(!f?.other)return f?.bestStores===1?"Один магазин и одна полная корзина по текущему расчёту.":`План использует ${f?.bestStores||0} магазина. Сравнение альтернатив пока недоступно.`;
    if(f.totalDelta===0){
      if((f.bestTrust.good||0)>(f.otherTrust.good||0))return`Итог одинаковый — ${money(f.bestTotal)}. У этого варианта лучше подтверждены цены: ${f.bestTrust.good}/${f.bestTrust.total} против ${f.otherTrust.good}/${f.otherTrust.total}.`;
      if(f.bestStores<f.otherStores)return`Итог одинаковый — ${money(f.bestTotal)}. Этот вариант проще: ${f.bestStores} магазин вместо ${f.otherStores}.`;
      return`Итог одинаковый — ${money(f.bestTotal)}. По доступным подтверждённым признакам явного преимущества не вижу.`;
    }
    if(f.totalDelta>0){
      const extra=f.bestStores-f.otherStores;
      if(extra>0)return`После учёта разбиения этот вариант дешевле на ${money(f.totalDelta)}. За экономию приходится идти в ${f.bestStores} магазина вместо ${f.otherStores}.`;
      return`Этот вариант дешевле ближайшей альтернативы на ${money(f.totalDelta)} при той же корзине.`;
    }
    return`Есть вариант на ${money(Math.abs(f.totalDelta))} дешевле. Не выдаю текущий первый план за более выгодный по цене — сравни альтернативу ниже.`;
  }
  function factLines(f){
    if(!f?.other)return[];
    const out=[];
    if(f.goodsDelta!==null&&f.goodsDelta!==0)out.push(f.goodsDelta>0?`На товарах: −${money(f.goodsDelta)} против альтернативы`:`На товарах: +${money(Math.abs(f.goodsDelta))} против альтернативы`);
    if(f.frictionDelta!==null&&f.frictionDelta!==0)out.push(f.frictionDelta>0?`Разбиение и дополнительные действия: +${money(f.frictionDelta)}`:`Разбиение и дополнительные действия: −${money(Math.abs(f.frictionDelta))}`);
    if(f.totalDelta===0)out.push(`Итог: одинаковые ${money(f.bestTotal)}`);
    else if(f.totalDelta>0)out.push(`Итог: этот вариант дешевле на ${money(f.totalDelta)}`);
    else if(f.totalDelta<0)out.push(`Итог: этот вариант дороже на ${money(Math.abs(f.totalDelta))}`);
    out.push(`Подтверждённые цены: ${f.bestTrust.good}/${f.bestTrust.total} против ${f.otherTrust.good}/${f.otherTrust.total}`);
    return out;
  }
  function groundDecision(root){
    const all=window.TDShoppingState?.get?.()?.lastPlans||[],best=all[0],other=all.find(plan=>plan?.id!==best?.id)||null;
    if(!best)return false;
    const f=decisionFacts(best,other),verdict=root.querySelector(".td-compare-verdict"),why=root.querySelector(".td-compare-why");
    if(verdict){verdict.textContent=verdictFromFacts(f);verdict.dataset.mvp030Truth="1"}
    if(why){
      why.querySelector(".roxy-mvp030-facts")?.remove();
      const lines=factLines(f);
      if(lines.length){
        const box=document.createElement("div");box.className="td-compare-note roxy-mvp030-facts";box.dataset.mvp030Truth="1";
        const label=document.createElement("b");label.textContent="Факты решения";box.appendChild(label);
        lines.forEach(text=>{const p=document.createElement("p");p.textContent=text;box.appendChild(p)});
        why.querySelector(".td-compare-section-head")?.insertAdjacentElement("afterend",box);
      }
    }
    return true;
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
    groundDecision(root);

    const tradeoff=buildTradeoff(main,hero);
    const action=buildAction(main,hero);
    const alternatives=main.querySelector(".td-compare-alternatives");
    const trust=main.querySelector(".td-trust");
    const note=main.querySelector(".td-compare-note:not(.roxy-mvp030-facts)");

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

  window.TDRoxyPurchaseSkeletonV1={decorate,schedule,decisionFacts,verdictFromFacts,factLines};
})();
