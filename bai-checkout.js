(()=>{
  "use strict";
  if(!document.querySelector('link[data-bai-checkout-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='bai-checkout.css?v=20260911-checkout-v1';l.dataset.baiCheckoutCss='1';document.head.appendChild(l)}
  import("./comparison-result-v2.js?v=20260911-v2").catch(e=>console.warn("[Comparison Result v2] load failed",e));
  let statusTimer=null;
  const state=()=>window.TDShoppingState?.get?.()||{};
  const storeName=id=>(typeof STORES!=="undefined"?STORES:[]).find(x=>x.id===id)?.name||id||"магазин";
  const money=v=>`${Math.round(Number(v)||0).toLocaleString("ru-RU")} ₽`;
  const best=()=>state().lastPlans?.[0]||null;

  function listText(kind="list"){
    const plan=best();
    if(!plan?.products?.length)return"Корзина пока пустая.";
    const groups=new Map();
    for(const p of plan.products){
      const name=storeName(p.storeId);
      if(!groups.has(name))groups.set(name,[]);
      groups.get(name).push(p);
    }
    const head=kind==="courier"?"Заказ для курьера":kind==="pickup"?"Список для самовывоза":"Список покупок";
    const lines=[head,"Там дешевле",""];
    for(const [shop,items] of groups){
      lines.push(shop);
      for(const p of items)lines.push(`• ${p.name} — ${p.quantity||1} шт. · ${money((p.price||0)*(p.quantity||1))}`);
      lines.push("");
    }
    lines.push(`Итого: ≈ ${money(plan.total)}`);
    return lines.join("\n").trim();
  }

  function showStatus(text){
    const el=document.querySelector("[data-bai-checkout-status]");
    if(!el)return;
    el.textContent=text;
    el.hidden=false;
    clearTimeout(statusTimer);
    statusTimer=setTimeout(()=>{if(el)el.hidden=true},4200);
  }

  async function copy(text,ok="Список скопирован"){
    try{
      await navigator.clipboard.writeText(text);
      showStatus(ok);
    }catch{
      const ta=document.createElement("textarea");
      ta.value=text;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();
      try{document.execCommand("copy");showStatus(ok)}catch{showStatus("Не получилось скопировать. Попробуй ещё раз.")}
      ta.remove();
    }
  }

  async function shareCourier(){
    const text=listText("courier");
    if(navigator.share){
      try{await navigator.share({title:"Заказ из Там дешевле",text});showStatus("Заказ подготовлен и передан в меню отправки");return}catch(e){if(e?.name==="AbortError")return}
    }
    await copy(text,"Заказ для курьера скопирован");
  }

  async function chooseMode(mode){
    const assistant=window.TDShoppingAssistant;
    if(!assistant?.submit){showStatus("Бай ещё загружается. Нажми ещё раз через секунду.");return}
    await assistant.submit(mode==="one"?"собери в одном магазине":"где дешевле по разным магазинам");
  }

  function renderCard(summary){
    if(!summary||summary.parentElement?.querySelector(":scope > .td-ai-checkout"))return;
    const plan=best();
    if(!plan?.products?.length)return;
    const stores=new Set(plan.products.map(p=>p.storeId).filter(Boolean)).size;
    const canCompare=(state().lastPlans||[]).length>1;
    const card=document.createElement("section");
    card.className="td-ai-checkout";
    card.innerHTML=`
      <div class="td-ai-checkout-head">
        <div><small>Следующий шаг</small><b>Что делаем с корзиной?</b></div>
        <span>${stores>1?`${stores} магаз.`:"1 магазин"}</span>
      </div>
      ${canCompare?`<button type="button" class="td-ai-checkout-compare" data-bai-checkout-compare>Сравнить варианты и увидеть экономию →</button>`:""}
      <div class="td-ai-checkout-mode">
        <button type="button" data-bai-checkout-mode="one"><b>В одном магазине</b><small>Проще забрать</small></button>
        <button type="button" data-bai-checkout-mode="multi"><b>Максимально выгодно</b><small>Можно разделить корзину</small></button>
      </div>
      <div class="td-ai-checkout-label">Когда корзина устраивает</div>
      <div class="td-ai-checkout-actions">
        <button type="button" data-bai-checkout-action="pickup"><span>↗</span><b>Сам заберу</b><small>Список по магазинам</small></button>
        <button type="button" data-bai-checkout-action="courier"><span>→</span><b>Курьер</b><small>Подготовить и отправить</small></button>
        <button type="button" data-bai-checkout-action="list"><span>✓</span><b>Список</b><small>Скопировать покупки</small></button>
      </div>
      <div class="td-ai-checkout-note">Заказы в магазины пока не отправляются автоматически — Бай готовит корзину и следующий шаг, ничего не оформляя без тебя.</div>
      <div class="td-ai-checkout-status" data-bai-checkout-status hidden></div>`;
    summary.insertAdjacentElement("afterend",card);
    card.querySelector('[data-bai-checkout-compare]')?.addEventListener("click",()=>window.TDComparisonResultV2?.open?.());
    card.querySelector('[data-bai-checkout-mode="one"]').onclick=()=>chooseMode("one");
    card.querySelector('[data-bai-checkout-mode="multi"]').onclick=()=>chooseMode("multi");
    card.querySelector('[data-bai-checkout-action="pickup"]').onclick=()=>copy(listText("pickup"),"Список для самовывоза скопирован");
    card.querySelector('[data-bai-checkout-action="courier"]').onclick=shareCourier;
    card.querySelector('[data-bai-checkout-action="list"]').onclick=()=>copy(listText("list"));
  }

  function scan(){document.querySelectorAll(".td-ai-summary").forEach(renderCard)}
  const observer=new MutationObserver(scan);
  function boot(){observer.observe(document.body,{childList:true,subtree:true});scan()}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
  window.TDBaiCheckout={listText,scan};
})();