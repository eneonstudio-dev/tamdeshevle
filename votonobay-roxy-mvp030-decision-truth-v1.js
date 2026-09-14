(()=>{
  "use strict";
  if(window.__TDRoxyMvp030DecisionTruthV1)return;
  window.__TDRoxyMvp030DecisionTruthV1=true;

  let queued=false;
  const money=value=>`${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  const storeCount=plan=>new Set((plan?.products||[]).map(item=>String(item?.storeId||"").split("_")[0]).filter(Boolean)).size;
  const plans=()=>window.TDShoppingState?.get?.()?.lastPlans||[];

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-mvp030-truth="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="votonobay-roxy-mvp030-decision-truth-v1.css?v=20260914-v1";
    link.dataset.roxyMvp030Truth="1";
    document.head.appendChild(link);
  }

  function trust(plan){
    const fallback={total:(plan?.products||[]).length,good:(plan?.products||[]).filter(line=>String(line?.quality||"").toUpperCase()==="LIVE").length};
    try{return window.TDComparisonResultV2?.trustFor?.(plan)||fallback}catch{return fallback}
  }

  function facts(best,other){
    if(!best)return null;
    const bestTotal=Number(best.total),otherTotal=Number(other?.total);
    const bestGoods=Number(best.goods),otherGoods=Number(other?.goods);
    const bestCost=Number(best.convenienceCost)||0,otherCost=Number(other?.convenienceCost)||0;
    const bestTrust=trust(best),otherTrust=other?trust(other):{good:0,total:0};
    const totalDelta=other&&Number.isFinite(otherTotal)&&Number.isFinite(bestTotal)?Math.round(otherTotal-bestTotal):null;
    const goodsDelta=other&&Number.isFinite(otherGoods)&&Number.isFinite(bestGoods)?Math.round(otherGoods-bestGoods):null;
    const frictionDelta=other?Math.round(bestCost-otherCost):null;
    return{best,other,bestTotal,otherTotal,bestGoods,otherGoods,bestCost,otherCost,bestTrust,otherTrust,totalDelta,goodsDelta,frictionDelta,bestStores:storeCount(best),otherStores:storeCount(other)};
  }

  function verdictText(f){
    if(!f?.other){
      return f?.bestStores===1?"Один магазин и одна полная корзина по текущему расчёту.":`План использует ${f?.bestStores||0} магазина. Сравнение альтернатив пока недоступно.`;
    }
    if(f.totalDelta===0){
      if((f.bestTrust.good||0)>(f.otherTrust.good||0))return`Итог одинаковый — ${money(f.bestTotal)}. У этого варианта лучше подтверждены цены: ${f.bestTrust.good}/${f.bestTrust.total} против ${f.otherTrust.good}/${f.otherTrust.total}.`;
      if(f.bestStores<f.otherStores)return`Итог одинаковый — ${money(f.bestTotal)}. Этот вариант проще: ${f.bestStores} магазин вместо ${f.otherStores}.`;
      if(f.bestCost<f.otherCost)return`Итог одинаковый — ${money(f.bestTotal)}. Здесь меньше учтённых затрат на разбиение корзины.`;
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
    const lines=[];
    if(f.goodsDelta!==null&&f.goodsDelta!==0){
      lines.push(f.goodsDelta>0?`На товарах: −${money(f.goodsDelta)} против альтернативы`:`На товарах: +${money(Math.abs(f.goodsDelta))} против альтернативы`);
    }else if(f.goodsDelta===0)lines.push("На товарах: одинаковая сумма");
    if(f.frictionDelta!==null&&f.frictionDelta!==0){
      lines.push(f.frictionDelta>0?`Разбиение и дополнительные действия: +${money(f.frictionDelta)}`:`Разбиение и дополнительные действия: −${money(Math.abs(f.frictionDelta))}`);
    }
    if(f.totalDelta===0)lines.push(`Итог: одинаковые ${money(f.bestTotal)}`);
    else if(f.totalDelta>0)lines.push(`Итог: этот вариант дешевле на ${money(f.totalDelta)}`);
    else if(f.totalDelta<0)lines.push(`Итог: этот вариант дороже на ${money(Math.abs(f.totalDelta))}`);
    if(f.bestTrust.total||f.otherTrust.total)lines.push(`Подтверждённые цены: ${f.bestTrust.good}/${f.bestTrust.total} против ${f.otherTrust.good}/${f.otherTrust.total}`);
    return lines;
  }

  function decorate(){
    ensureStyle();
    const root=document.querySelector(".td-compare-v2");
    if(!root)return false;
    const all=plans();
    const best=all[0],other=all.find(plan=>plan?.id!==best?.id)||null;
    if(!best)return false;
    const f=facts(best,other),verdict=root.querySelector(".td-compare-verdict"),why=root.querySelector(".td-compare-why");
    if(verdict){
      verdict.textContent=verdictText(f);
      verdict.dataset.mvp030Truth="1";
    }
    if(why){
      why.querySelector(".roxy-mvp030-facts")?.remove();
      const lines=factLines(f);
      if(lines.length){
        const box=document.createElement("div");box.className="roxy-mvp030-facts";box.setAttribute("role","note");
        const label=document.createElement("small");label.textContent="ФАКТЫ РЕШЕНИЯ";box.appendChild(label);
        lines.forEach(text=>{const p=document.createElement("p");p.textContent=text;box.appendChild(p)});
        const head=why.querySelector(".td-compare-section-head");head?.insertAdjacentElement("afterend",box);
      }
      why.dataset.mvp030Truth="1";
    }
    return true;
  }

  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate()})}
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener("td:shopping-state",schedule);
  window.addEventListener("td:comparison-plan-applied",schedule);
  schedule();
  window.TDRoxyMvp030DecisionTruthV1={decorate,facts,verdictText,factLines};
})();
