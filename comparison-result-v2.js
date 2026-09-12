(()=>{
  "use strict";
  if(!document.querySelector('link[data-td-compare-v2-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='comparison-result-v2.css?v=20260912-decision-v2';l.dataset.tdCompareV2Css='1';document.head.appendChild(l)}
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>`${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;
  const storeName=id=>(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===id)?.name||id||"магазин";
  const plans=()=>window.TDShoppingState?.get?.().lastPlans||[];
  const storeIds=p=>[...new Set((p?.products||[]).map(x=>x.storeId).filter(Boolean))];
  const storeCount=p=>storeIds(p).length;
  const storeWord=n=>n===1?"магазин":n>=2&&n<=4?"магазина":"магазинов";
  const title=p=>p?.type==="multi"?"По разным магазинам":"В одном магазине";
  const date=v=>{if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const APPLY_LOCK_MS=1400;
  let activeRoot=null,opener=null,previousOverflow="",applyLockId="",applyLockAt=0;

  function expectedProductIds(){
    return new Set((window.TDShoppingState?.get?.().products||[]).map(x=>String(x?.id||"")).filter(Boolean));
  }
  function canonicalPlan(plan){
    if(!plan||!Array.isArray(plan.products)||!plan.products.length)return null;
    const expected=expectedProductIds(),seen=new Set(),products=[];
    for(const raw of plan.products){
      const id=String(raw?.id||"").trim(),storeId=String(raw?.storeId||"").trim();
      const price=Number(raw?.price),quantity=Number(raw?.quantity??1);
      if(!id||!storeId||seen.has(id)||!Number.isFinite(price)||price<=0||!Number.isInteger(quantity)||quantity<1||quantity>99)return null;
      seen.add(id);products.push({...clone(raw),id,storeId,price,quantity});
    }
    if(expected.size&&(seen.size!==expected.size||[...expected].some(id=>!seen.has(id))))return null;
    const stores=storeIds({products});
    if(!stores.length)return null;
    if(plan.type==="one"&&stores.length!==1)return null;
    const goods=products.reduce((sum,line)=>sum+line.price*line.quantity,0);
    const convenienceCost=plan.type==="multi"?Math.max(0,Number(plan.convenienceCost)||0):0;
    const total=goods+convenienceCost;
    if(!Number.isFinite(total)||total<=0)return null;
    return{...clone(plan),products,stores,goods,total,convenienceCost};
  }
  function safeFocus(target){if(!target||typeof target.focus!=="function")return false;try{target.focus({preventScroll:true});return true}catch{try{target.focus();return true}catch{return false}}}
  function focusables(root){return root?[...root.querySelectorAll(FOCUSABLE)].filter(el=>!el.hidden&&el.getAttribute("aria-hidden")!=="true"):[]}
  function trapTab(event,root){
    if(event.key!=="Tab")return;
    const items=focusables(root);if(!items.length){event.preventDefault();safeFocus(root);return}
    const first=items[0],last=items[items.length-1],current=document.activeElement;
    if(event.shiftKey&&(current===first||!root.contains(current))){event.preventDefault();safeFocus(last)}
    else if(!event.shiftKey&&(current===last||!root.contains(current))){event.preventDefault();safeFocus(first)}
  }
  function mount(root){
    opener=document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow="hidden";
    activeRoot=root;root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-labelledby","td-compare-v2-title");root.tabIndex=-1;
    document.body.appendChild(root);
    root.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();close();return}trapTab(event,root)});
    requestAnimationFrame(()=>safeFocus(root.querySelector("[data-compare-close]")||root));
  }
  function metaFor(line){
    const id=line?.id,store=line?.storeId;if(!id||!store)return{kind:"unknown",label:"Не подтверждена",detail:"Источник цены не найден"};
    const real=window.TDPriceMeta?.get?.(id,store,"shelf")||null;
    const estimated=real?null:window.TDPriceMeta?.getEstimated?.(id,store,"shelf")||null;
    if(real){
      const q=window.TDDataQuality?.metaQuality?.(real)||null,status=q?.status||"fresh";
      const kind=status==="fresh"?"fresh":status==="stale"?"stale":"unknown";
      const label=kind==="fresh"?"Свежая":kind==="stale"?"Давно проверялась":"Не подтверждена";
      return{kind,label,checkedAt:real.checkedAt,sourceUrl:real.sourceUrl||"",source:real.retailerName||storeName(store),detail:date(real.checkedAt)?`Проверено ${date(real.checkedAt)}`:"Дата проверки не указана"};
    }
    if(estimated)return{kind:"estimated",label:"Оценочная",checkedAt:estimated.checkedAt,sourceUrl:estimated.sourceUrl||"",source:estimated.retailerName||estimated.catalogContext?.region||"региональный каталог",detail:date(estimated.checkedAt)?`Каталог от ${date(estimated.checkedAt)}`:"Региональный каталог"};
    if(line.quality==="LIVE")return{kind:"fresh",label:"Подтверждена",detail:"Цена помечена источником как актуальная"};
    if(line.quality==="UNKNOWN")return{kind:"unknown",label:"Не подтверждена",detail:"Перед покупкой лучше проверить"};
    return{kind:"estimated",label:"Оценочная",detail:"Используется ориентировочная цена"};
  }
  function trustFor(plan){
    const rows=(plan?.products||[]).map(line=>({line,meta:metaFor(line)}));
    const counts={fresh:0,stale:0,estimated:0,unknown:0};rows.forEach(x=>counts[x.meta.kind]++);
    const order={unknown:0,stale:1,estimated:2,fresh:3};
    const risk=rows.filter(x=>x.meta.kind!=="fresh").sort((a,b)=>(order[a.meta.kind]??9)-(order[b.meta.kind]??9));
    const total=rows.length,good=counts.fresh;
    const label=!total?"Нет данных":good===total?"Высокая уверенность":good>=Math.ceil(total*.6)?"В основном надёжно":"Нужно проверить";
    return{rows,counts,risk,total,good,label};
  }
  function trustHTML(plan){
    const t=trustFor(plan),chips=[t.counts.fresh?`<span class="fresh">${t.counts.fresh} свежих</span>`:"",t.counts.stale?`<span class="stale">${t.counts.stale} старых</span>`:"",t.counts.estimated?`<span class="estimated">${t.counts.estimated} оценочных</span>`:"",t.counts.unknown?`<span class="unknown">${t.counts.unknown} без подтверждения</span>`:""] .filter(Boolean).join("");
    const risk=t.risk.slice(0,5).map(({line,meta})=>`<div class="td-trust-row"><span>${esc(line.emoji||"•")} ${esc(line.name)}<small>${esc(storeName(line.storeId))} · ${esc(meta.detail||meta.label)}</small></span><div><b class="${meta.kind}">${esc(meta.label)}</b>${meta.sourceUrl?`<a href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener">источник ↗</a>`:""}</div></div>`).join("");
    return`<section class="td-trust"><div class="td-trust-head"><div><small>Надёжность данных</small><h3>${esc(t.label)}</h3></div><strong>${t.good}/${t.total}</strong></div><div class="td-trust-chips">${chips||'<span class="unknown">нет метаданных</span>'}</div>${risk?`<div class="td-trust-risk"><p>Что стоит перепроверить перед покупкой</p>${risk}</div>`:`<p class="td-trust-ok">Все цены в выбранном варианте подтверждены свежими данными.</p>`}</section>`;
  }
  function explain(best,other){
    if(!best||!other)return[];
    const byId=new Map((other.products||[]).map(x=>[x.id,x]));
    return(best.products||[]).map(x=>{const prev=byId.get(x.id);if(!prev||prev.storeId===x.storeId)return null;const diff=((prev.price||0)-(x.price||0))*(x.quantity||1);return{...x,from:prev.storeId,diff};}).filter(Boolean).sort((a,b)=>b.diff-a.diff);
  }
  function verdict(best,all){
    const cheapest=[...all].sort((a,b)=>a.total-b.total)[0];
    if(cheapest&&cheapest.id!==best.id&&cheapest.total<best.total){
      const delta=Math.round(best.total-cheapest.total),extraStores=storeCount(cheapest)-storeCount(best);
      if(extraStores>0)return`Можно дешевле на ${money(delta)}, но придётся добавить ${extraStores} ${storeWord(extraStores)}. Я бы не усложнял покупку ради этой разницы.`;
      return`Есть вариант на ${money(delta)} дешевле. Этот остаётся рекомендацией по текущим приоритетам и удобству.`;
    }
    if(best.type==="one")return"Всё в одном магазине. Без лишнего разбиения корзины и дополнительных действий.";
    return`Это лучший баланс по текущему расчёту. Корзина разделена между ${storeCount(best)} ${storeWord(storeCount(best))}, потому что разница это оправдывает.`;
  }
  function optionLabel(plan,best,cheapest){
    if(plan.id===cheapest?.id&&plan.total<best.total)return"Дешевле";
    if(storeCount(plan)<storeCount(best))return"Проще";
    if(plan.type==="one"&&best.type==="multi")return"Один магазин";
    return"Альтернатива";
  }
  function optionTradeoff(plan,best){
    const delta=Math.round(plan.total-best.total),stores=storeCount(plan)-storeCount(best);
    const parts=[];
    if(delta<0)parts.push(`${money(Math.abs(delta))} дешевле`);else if(delta>0)parts.push(`+${money(delta)}`);else parts.push("та же сумма");
    if(stores>0)parts.push(`+${stores} ${storeWord(stores)}`);else if(stores<0)parts.push(`${Math.abs(stores)} ${storeWord(Math.abs(stores))} меньше`);
    return parts.join(" · ");
  }
  function savingsCart(plan){return Object.fromEntries((plan?.products||[]).map(x=>[x.id,Number(x.quantity)||1]).sort((a,b)=>a[0].localeCompare(b[0])))}
  function recordSavings(chosen,all){
    const baseline=all.find(x=>x.type==="one");if(!baseline||chosen.id===baseline.id)return null;
    const saving=Math.round((Number(baseline.total)||0)-(Number(chosen.total)||0));if(saving<=0)return null;
    const trust=trustFor(chosen),verified=trust.total>0&&trust.good===trust.total;if(!verified)return null;
    return window.TDSavingsLedger?.record?.({saving,total:chosen.total,baselineTotal:baseline.total,verified:true,storeId:storeIds(chosen).join("+")||chosen.type,storeName:title(chosen),channel:"comparison",planType:chosen.type,cart:savingsCart(chosen)})||null;
  }
  function refreshAssistantSummary(){
    const best=window.TDShoppingState?.get?.().lastPlans?.[0],summary=document.querySelector(".td-ai-summary");
    if(!best||!summary)return;
    summary.innerHTML=`<div class="td-ai-summary-head"><b>Корзина · ${(best.products||[]).length}</b></div>${(best.products||[]).map(p=>`<div class="td-ai-line"><span>${esc(p.emoji)} ${esc(p.name)}<small>${esc(p.pack)} · ${esc(storeName(p.storeId))}</small></span><b>${money((p.price||0)*(p.quantity||1))}</b></div>`).join("")}<div class="td-ai-total"><span>Итого</span><strong>≈ ${money(best.total)}</strong></div>`;
  }
  function applyPlan(id){
    const now=Date.now();if(id===applyLockId&&now-applyLockAt<APPLY_LOCK_MS)return{ok:false,reason:"busy"};
    const raw=plans(),all=raw.map(canonicalPlan).filter(Boolean),chosen=all.find(x=>x.id===id);if(!chosen)return{ok:false,reason:"invalid_plan"};
    applyLockId=id;applyLockAt=now;activeRoot?.querySelectorAll?.("[data-compare-apply]").forEach(button=>{button.disabled=true;button.setAttribute("aria-disabled","true")});
    const saved=recordSavings(chosen,all);
    const ordered=[chosen,...all.filter(x=>x.id!==chosen.id)];
    window.TDShoppingState?.commit?.("SELECT_COMPARISON_PLAN",s=>{s.products=clone(chosen.products);s.currentTotal=chosen.total;s.mode=chosen.type==="multi"?"multi":"one";s.stores=chosen.type==="one"?[chosen.stores[0]]:[];s.lastPlans=clone(ordered)},`Выбран вариант ${title(chosen)}`);
    window.TDShoppingState?.syncCart?.();
    refreshAssistantSummary();
    close();window.TDBaiCheckout?.refresh?.();window.TDBaiCheckout?.scan?.();
    window.dispatchEvent(new CustomEvent("td:comparison-plan-applied",{detail:{id:chosen.id,type:chosen.type,total:chosen.total,stores:chosen.stores.slice()}}));
    if(saved)window.dispatchEvent(new CustomEvent("td:savings-proof",{detail:saved}));
    return{ok:true,plan:chosen,saved:Boolean(saved)};
  }
  function close({restoreFocus=true}={}){
    const root=activeRoot||document.querySelector(".td-compare-v2");if(!root)return false;
    root.remove();activeRoot=null;
    document.body.style.overflow=previousOverflow;previousOverflow="";
    const target=opener;opener=null;if(restoreFocus)requestAnimationFrame(()=>safeFocus(target));
    return true;
  }
  function unavailable(rawCount){
    const root=document.createElement("section");root.className="td-compare-v2";
    root.innerHTML=`<div class="td-compare-v2-shell"><header><button data-compare-close aria-label="Закрыть сравнение">←</button><div><small>Решение по корзине</small><b id="td-compare-v2-title">Пока нельзя сравнить честно</b></div></header><main><section class="td-compare-hero td-compare-hero-empty"><small>НУЖНЫ ПОЛНЫЕ ДАННЫЕ</small><h2>Пока не буду придумывать итог.</h2><p>${rawCount?"Один или несколько вариантов потеряли товар, цену или корректное количество.":"Варианты сравнения ещё не рассчитаны."}</p></section><div class="td-compare-note">Мы не считаем отсутствующую цену как 0 ₽. Вернись к корзине или обнови данные и попробуй снова.</div></main></div>`;
    root.querySelector("[data-compare-close]").onclick=()=>close();root.onclick=e=>{if(e.target===root)close()};mount(root);return false;
  }
  function open(){
    close({restoreFocus:false});const raw=plans(),all=raw.map(canonicalPlan).filter(Boolean);if(!all.length)return unavailable(raw.length);
    const best=all[0],alternatives=all.slice(1).sort((a,b)=>a.total-b.total),cheapest=[...all].sort((a,b)=>a.total-b.total)[0],baseline=all.find(x=>x.type==="one")||cheapest||best,moves=explain(best,baseline),trust=trustFor(best);
    const root=document.createElement("section");root.className="td-compare-v2";
    root.innerHTML=`<div class="td-compare-v2-shell"><header><button data-compare-close aria-label="Закрыть сравнение">←</button><div><small>Решение Бая</small><b id="td-compare-v2-title">Как лучше купить</b></div></header><main>
      <section class="td-compare-hero">
        <div class="td-compare-bay" aria-hidden="true"><img src="assets/bai/bai-peek.webp" alt=""></div>
        <small>ВЫБОР БАЯ</small>
        <h2>Я бы взял этот вариант.</h2>
        <div class="td-compare-summary"><strong>${money(best.total)}</strong><span>${title(best)} · ${storeCount(best)} ${storeWord(storeCount(best))}</span></div>
        <p class="td-compare-verdict">${esc(verdict(best,all))}</p>
        <div class="td-compare-hero-actions"><button data-compare-apply="${esc(best.id)}">Выбрать и продолжить</button><span>${esc(trust.label)}</span></div>
      </section>
      ${alternatives.length?`<section class="td-compare-alternatives"><div class="td-compare-section-head"><small>ЕСЛИ ПРИОРИТЕТ ДРУГОЙ</small><h3>Альтернативы</h3></div><div class="td-compare-grid">${alternatives.map(p=>`<article class="td-compare-plan"><div><small>${esc(optionLabel(p,best,cheapest))}</small><b>${title(p)}</b></div><strong>${money(p.total)}</strong><span>${esc(optionTradeoff(p,best))}</span><p>${(p.products||[]).length} товаров · ${storeCount(p)} ${storeWord(storeCount(p))}${p.convenienceCost?` · +${money(p.convenienceCost)} за разбиение`:""}</p><button data-compare-apply="${esc(p.id)}">Выбрать этот вариант</button></article>`).join("")}</div></section>`:""}
      <section class="td-compare-why"><div class="td-compare-section-head"><small>ЛОГИКА РЕШЕНИЯ</small><h3>Почему этот вариант</h3></div>${moves.length?moves.slice(0,6).map(x=>`<div><span>${esc(x.emoji||"•")} ${esc(x.name)}<small>${esc(storeName(x.from))} → ${esc(storeName(x.storeId))}</small></span><b>${x.diff>0?`−${money(x.diff)}`:"лучше здесь"}</b></div>`).join(""):`<p>Решение учитывает общую стоимость корзины и количество магазинов. Votonobay не добавляет лишние товары.</p>`}</section>
      ${trustHTML(best)}
      <div class="td-compare-note">Надёжность данных не меняет расчёт. Подтверждённая экономия попадёт в профиль только если весь выбранный вариант состоит из свежих подтверждённых цен.</div>
    </main></div>`;
    root.querySelector("[data-compare-close]").onclick=()=>close();root.onclick=e=>{if(e.target===root)close()};root.querySelectorAll("[data-compare-apply]").forEach(b=>b.onclick=()=>applyPlan(b.dataset.compareApply));mount(root);return true;
  }
  window.TDComparisonResultV2={open,close,applyPlan,trustFor,canonicalPlan};
})();