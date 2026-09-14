(()=>{
  "use strict";
  if(window.__TDVotonobayRoxyHandoffV1)return;
  window.__TDVotonobayRoxyHandoffV1=true;

  const STYLE_HREF="votonobay-roxy-handoff-v1.css?v=20260914-v1";
  const HAPPY_BAY="assets/bai/bai-happy-approved-v1.webp";
  let queued=false;

  function ensureStyle(){
    if(document.querySelector('link[data-roxy-handoff-v1="1"]'))return;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=STYLE_HREF;
    link.dataset.roxyHandoffV1="1";
    document.head.appendChild(link);
  }

  function addTruthNote(card){
    let note=card.querySelector(".roxy-handoff-truth");
    if(note)return note;
    note=document.createElement("div");
    note.className="roxy-handoff-truth";
    note.setAttribute("role","note");
    note.innerHTML='<span>Без автопереноса корзины</span><p>Бай откроет магазин и сохранит твой список здесь. Фактические цена, наличие и добавление товара подтверждаются уже на стороне магазина.</p>';
    const summary=card.querySelector(".td-continue-stores-summary");
    if(summary)summary.insertAdjacentElement("afterend",note);
    else card.querySelector("h2")?.insertAdjacentElement("afterend",note);
    return note;
  }

  function decorateRows(card){
    card.querySelectorAll(".td-continue-store-row").forEach(row=>{
      if(row.querySelector(".roxy-handoff-store-meta"))return;
      const meta=document.createElement("div");
      meta.className="roxy-handoff-store-meta";
      meta.innerHTML='<b>Переход в магазин</b><span>Сверь итог перед оплатой — магазин остаётся источником фактической цены и наличия.</span>';
      const controls=row.querySelector(".td-store-progress-controls");
      if(controls)row.insertBefore(meta,controls);
      else row.appendChild(meta);
    });
  }

  function progressState(card){
    const rows=[...card.querySelectorAll(".td-continue-store-row")];
    const totals=rows.map(row=>Math.max(0,Number(row.dataset.total)||0));
    const complete=rows.length>0&&rows.every((row,index)=>totals[index]>0&&row.classList.contains("is-done"));
    return{rows,total:totals.reduce((sum,value)=>sum+value,0),complete};
  }

  function renderSuccess(card){
    const {complete}=progressState(card);
    let success=card.querySelector(".roxy-handoff-success");
    if(!complete){
      success?.remove();
      card.dataset.roxyHandoffComplete="0";
      return;
    }
    card.dataset.roxyHandoffComplete="1";
    if(success)return;
    success=document.createElement("div");
    success.className="roxy-handoff-success";
    success.setAttribute("role","status");
    success.setAttribute("aria-live","polite");
    success.innerHTML=`<img src="${HAPPY_BAY}" alt=""><div><small>ПО ТВОИМ ОТМЕТКАМ</small><b>Список по магазинам готов</b><span>Я сохранил прогресс. Это не подтверждение оплаты: финальный заказ и чек остаются у магазина.</span></div>`;
    const truth=card.querySelector(".roxy-handoff-truth");
    (truth||card.querySelector(".td-continue-stores-summary"))?.insertAdjacentElement("afterend",success);
  }

  function decorate(root){
    if(!root)return false;
    ensureStyle();
    const card=root.querySelector(".td-continue-stores-card");
    if(!card)return false;
    root.dataset.roxyHandoff="1";
    card.dataset.roxyHandoff="1";
    const eyebrow=card.querySelector(":scope>small");
    const title=card.querySelector("h2");
    const intro=card.querySelector("h2+p");
    if(eyebrow)eyebrow.textContent="ПЕРЕХОД К ПОКУПКЕ";
    if(title)title.textContent="Дальше — в магазин";
    if(intro)intro.textContent="Бай уже разложил корзину. Открывай магазин, добавляй позиции на его стороне и отмечай прогресс здесь — без ложного обещания автопереноса.";
    addTruthNote(card);
    decorateRows(card);
    renderSuccess(card);
    return true;
  }

  function decorateAll(){
    queued=false;
    document.querySelectorAll(".td-continue-stores").forEach(decorate);
  }
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(decorateAll)}

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
  document.addEventListener("click",event=>{
    if(event.target instanceof Element&&event.target.closest(".td-store-progress-controls"))setTimeout(schedule,0);
  },true);
  window.addEventListener("pageshow",schedule);
  schedule();

  window.TDRoxyHandoffV1={decorate,schedule,progressState};
})();
