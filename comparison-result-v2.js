(()=>{
  "use strict";
  if(!document.querySelector('link[data-td-compare-v2-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='comparison-result-v2.css?v=20260911-v2';l.dataset.tdCompareV2Css='1';document.head.appendChild(l)}
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money=v=>`${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;
  const storeName=id=>(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===id)?.name||id||"магазин";
  const plans=()=>window.TDShoppingState?.get?.().lastPlans||[];
  const storeCount=p=>new Set((p?.products||[]).map(x=>x.storeId).filter(Boolean)).size;
  const title=p=>p?.type==="multi"?"По разным магазинам":"В одном магазине";
  function explain(best,other){
    if(!best||!other)return[];
    const byId=new Map((other.products||[]).map(x=>[x.id,x]));
    return(best.products||[]).map(x=>{const prev=byId.get(x.id);if(!prev||prev.storeId===x.storeId)return null;const diff=((prev.price||0)-(x.price||0))*(x.quantity||1);return{...x,from:prev.storeId,diff};}).filter(Boolean).sort((a,b)=>b.diff-a.diff);
  }
  function applyPlan(id){
    const all=plans(),chosen=all.find(x=>x.id===id);if(!chosen)return;
    window.TDShoppingState?.commit?.("SELECT_COMPARISON_PLAN",s=>{s.products=JSON.parse(JSON.stringify(chosen.products||[]));s.currentTotal=chosen.total;s.mode=chosen.type==="multi"?"multi":"one";s.stores=chosen.type==="one"?[chosen.stores?.[0]].filter(Boolean):[];s.lastPlans=[chosen,...all.filter(x=>x.id!==chosen.id)]},`Выбран вариант ${title(chosen)}`);
    window.TDShoppingState?.syncCart?.();
    close();
    window.TDBaiCheckout?.scan?.();
  }
  function close(){document.querySelector(".td-compare-v2")?.remove()}
  function open(){
    close();
    const all=plans();if(!all.length)return;
    const sorted=[...all].sort((a,b)=>a.total-b.total),best=sorted[0],baseline=sorted.find(x=>x.type==="one")||sorted[sorted.length-1],saved=Math.max(0,(baseline?.total||0)-(best?.total||0)),moves=explain(best,baseline);
    const root=document.createElement("section");root.className="td-compare-v2";
    root.innerHTML=`<div class="td-compare-v2-shell"><header><button data-compare-close>←</button><div><small>Сравнение корзины</small><b>Где действительно дешевле</b></div></header><main>
      <section class="td-compare-hero"><small>Лучший вариант сейчас</small><strong>${money(best.total)}</strong><span>${title(best)} · ${storeCount(best)} ${storeCount(best)===1?"магазин":"магаз."}</span>${saved>0?`<em>Экономия ${money(saved)}</em>`:""}</section>
      <div class="td-compare-grid">${sorted.map((p,i)=>`<article class="td-compare-plan ${i===0?"best":""}"><div><small>${i===0?"Выгоднее":"Альтернатива"}</small><b>${title(p)}</b></div><strong>${money(p.total)}</strong><span>${(p.products||[]).length} товаров · ${storeCount(p)} ${storeCount(p)===1?"магазин":"магаз."}${p.convenienceCost?` · +${money(p.convenienceCost)} за разбиение`:""}</span><button data-compare-apply="${esc(p.id)}">${i===0?"Применить этот вариант":"Выбрать вариант"}</button></article>`).join("")}</div>
      <section class="td-compare-why"><h3>Почему так дешевле</h3>${moves.length?moves.slice(0,6).map(x=>`<div><span>${esc(x.emoji||"•")} ${esc(x.name)}<small>${esc(storeName(x.from))} → ${esc(storeName(x.storeId))}</small></span><b>${x.diff>0?`−${money(x.diff)}`:"выгоднее здесь"}</b></div>`).join(""):`<p>Разница получается из общей стоимости корзины и количества магазинов. Ничего лишнего Бай не добавлял.</p>`}</section>
      <div class="td-compare-note">Цены берутся из текущих источников проекта. Если цена оценочная, финальную сумму лучше проверить перед покупкой.</div>
    </main></div>`;
    document.body.appendChild(root);root.querySelector("[data-compare-close]").onclick=close;root.onclick=e=>{if(e.target===root)close()};root.querySelectorAll("[data-compare-apply]").forEach(b=>b.onclick=()=>applyPlan(b.dataset.compareApply));
  }
  window.TDComparisonResultV2={open,close,applyPlan};
})();