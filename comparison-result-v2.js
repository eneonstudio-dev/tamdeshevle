(()=>{
  "use strict";
  if(!document.querySelector('link[data-td-compare-v2-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='comparison-result-v2.css?v=20260911-trust-v1';l.dataset.tdCompareV2Css='1';document.head.appendChild(l)}
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>`${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;
  const storeName=id=>(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===id)?.name||id||"магазин";
  const plans=()=>window.TDShoppingState?.get?.().lastPlans||[];
  const storeCount=p=>new Set((p?.products||[]).map(x=>x.storeId).filter(Boolean)).size;
  const title=p=>p?.type==="multi"?"По разным магазинам":"В одном магазине";
  const date=v=>{if(!v)return"";const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})};
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
    const risk=rows.filter(x=>x.meta.kind!=="fresh").sort((a,b)=>({unknown:0,stale:1,estimated:2}[a.meta.kind]-({unknown:0,stale:1,estimated:2}[b.meta.kind]));
    const total=rows.length,good=counts.fresh;
    const label=!total?"Нет данных":good===total?"Высокая уверенность":good>=Math.ceil(total*.6)?"В основном надёжно":"Нужно проверить";
    return{rows,counts,risk,total,good,label};
  }
  function trustHTML(plan){
    const t=trustFor(plan),chips=[t.counts.fresh?`<span class="fresh">${t.counts.fresh} свежих</span>`:"",t.counts.stale?`<span class="stale">${t.counts.stale} старых</span>`:"",t.counts.estimated?`<span class="estimated">${t.counts.estimated} оценочных</span>`:"",t.counts.unknown?`<span class="unknown">${t.counts.unknown} без подтверждения</span>`:""] .filter(Boolean).join("");
    const risk=t.risk.slice(0,5).map(({line,meta})=>`<div class="td-trust-row"><span>${esc(line.emoji||"•")} ${esc(line.name)}<small>${esc(storeName(line.storeId))} · ${esc(meta.detail||meta.label)}</small></span><div><b class="${meta.kind}">${esc(meta.label)}</b>${meta.sourceUrl?`<a href="${esc(meta.sourceUrl)}" target="_blank" rel="noopener">источник ↗</a>`:""}</div></div>`).join("");
    return`<section class="td-trust"><div class="td-trust-head"><div><small>Надёжность цен</small><h3>${esc(t.label)}</h3></div><strong>${t.good}/${t.total}</strong></div><div class="td-trust-chips">${chips||'<span class="unknown">нет метаданных</span>'}</div>${risk?`<div class="td-trust-risk"><p>Что стоит перепроверить перед покупкой</p>${risk}</div>`:`<p class="td-trust-ok">Все цены в выбранном варианте подтверждены свежими данными.</p>`}</section>`;
  }
  function explain(best,other){
    if(!best||!other)return[];
    const byId=new Map((other.products||[]).map(x=>[x.id,x]));
    return(best.products||[]).map(x=>{const prev=byId.get(x.id);if(!prev||prev.storeId===x.storeId)return null;const diff=((prev.price||0)-(x.price||0))*(x.quantity||1);return{...x,from:prev.storeId,diff};}).filter(Boolean).sort((a,b)=>b.diff-a.diff);
  }
  function savingsCart(plan){return Object.fromEntries((plan?.products||[]).map(x=>[x.id,Number(x.quantity)||1]).sort((a,b)=>a[0].localeCompare(b[0])))}
  function recordSavings(chosen,all){
    const baseline=all.find(x=>x.type==="one");if(!baseline||chosen.id===baseline.id)return null;
    const saving=Math.round((Number(baseline.total)||0)-(Number(chosen.total)||0));if(saving<=0)return null;
    const trust=trustFor(chosen),verified=trust.total>0&&trust.good===trust.total;if(!verified)return null;
    return window.TDSavingsLedger?.record?.({saving,total:chosen.total,baselineTotal:baseline.total,verified:true,storeId:(chosen.stores||[]).join("+")||chosen.type,storeName:title(chosen),channel:"comparison",planType:chosen.type,cart:savingsCart(chosen)})||null;
  }
  function applyPlan(id){
    const all=plans(),chosen=all.find(x=>x.id===id);if(!chosen)return;
    const saved=recordSavings(chosen,all);
    window.TDShoppingState?.commit?.("SELECT_COMPARISON_PLAN",s=>{s.products=JSON.parse(JSON.stringify(chosen.products||[]));s.currentTotal=chosen.total;s.mode=chosen.type==="multi"?"multi":"one";s.stores=chosen.type==="one"?[chosen.stores?.[0]].filter(Boolean):[];s.lastPlans=[chosen,...all.filter(x=>x.id!==chosen.id)]},`Выбран вариант ${title(chosen)}`);
    window.TDShoppingState?.syncCart?.();close();window.TDBaiCheckout?.scan?.();
    if(saved)window.dispatchEvent(new CustomEvent("td:savings-proof",{detail:saved}));
  }
  function close(){document.querySelector(".td-compare-v2")?.remove()}
  function open(){
    close();const all=plans();if(!all.length)return;
    const sorted=[...all].sort((a,b)=>a.total-b.total),best=sorted[0],baseline=sorted.find(x=>x.type==="one")||sorted[sorted.length-1],saved=Math.max(0,(baseline?.total||0)-(best?.total||0)),moves=explain(best,baseline);
    const root=document.createElement("section");root.className="td-compare-v2";
    root.innerHTML=`<div class="td-compare-v2-shell"><header><button data-compare-close>←</button><div><small>Сравнение корзины</small><b>Где действительно дешевле</b></div></header><main>
      <section class="td-compare-hero"><small>Лучший вариант сейчас</small><strong>${money(best.total)}</strong><span>${title(best)} · ${storeCount(best)} ${storeCount(best)===1?"магазин":"магаз."}</span>${saved>0?`<em>Экономия ${money(saved)}</em>`:""}</section>
      ${trustHTML(best)}
      <div class="td-compare-grid">${sorted.map((p,i)=>`<article class="td-compare-plan ${i===0?"best":""}"><div><small>${i===0?"Выгоднее":"Альтернатива"}</small><b>${title(p)}</b></div><strong>${money(p.total)}</strong><span>${(p.products||[]).length} товаров · ${storeCount(p)} ${storeCount(p)===1?"магазин":"магаз."}${p.convenienceCost?` · +${money(p.convenienceCost)} за разбиение`:""}</span><button data-compare-apply="${esc(p.id)}">${i===0?"Применить этот вариант":"Выбрать вариант"}</button></article>`).join("")}</div>
      <section class="td-compare-why"><h3>Почему так дешевле</h3>${moves.length?moves.slice(0,6).map(x=>`<div><span>${esc(x.emoji||"•")} ${esc(x.name)}<small>${esc(storeName(x.from))} → ${esc(storeName(x.storeId))}</small></span><b>${x.diff>0?`−${money(x.diff)}`:"выгоднее здесь"}</b></div>`).join(""):`<p>Разница получается из общей стоимости корзины и количества магазинов. Ничего лишнего Бай не добавлял.</p>`}</section>
      <div class="td-compare-note">Trust Layer показывает качество уже имеющихся цен и не меняет расчёт. Подтверждённая экономия попадёт в профиль только если весь выбранный вариант состоит из свежих подтверждённых цен.</div>
    </main></div>`;
    document.body.appendChild(root);root.querySelector("[data-compare-close]").onclick=close;root.onclick=e=>{if(e.target===root)close()};root.querySelectorAll("[data-compare-apply]").forEach(b=>b.onclick=()=>applyPlan(b.dataset.compareApply));
  }
  window.TDComparisonResultV2={open,close,applyPlan,trustFor};
})();
