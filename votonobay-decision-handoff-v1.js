(()=>{
  "use strict";
  if(window.__TDVotonobayDecisionHandoffV1)return;
  window.__TDVotonobayDecisionHandoffV1=true;

  const KNOWN=["perek","pyat","magnit","lenta","dixy"],NAMES={perek:"Перекрёсток",pyat:"Пятёрочка",magnit:"Магнит",lenta:"Лента",dixy:"Дикси"};
  let raf=0,pollTimer=0,pollCount=0;

  function storeKey(value){const raw=String(value||"");return KNOWN.find(id=>raw===id||raw.startsWith(`${id}_`))||raw.split("_")[0]||"unknown"}
  function plan(){const current=window.TDShoppingState?.get?.(),best=current?.lastPlans?.[0];return best&&Array.isArray(best.products)&&best.products.length?best:null}
  function signature(best){return(best?.products||[]).map(item=>`${storeKey(item.storeId)}:${item.id||item.productId||item.name||"?"}:${item.quantity||1}`).sort().join("|")}
  function stores(best){return[...new Set((best?.products||[]).map(item=>storeKey(item.storeId)).filter(Boolean))]}
  function storePhrase(ids){if(ids.length===1)return NAMES[ids[0]]?`«${NAMES[ids[0]]}»`:"магазине";return`${ids.length} магазинах`}
  function remove(){document.querySelectorAll(".td-ai-decision-cta").forEach(node=>node.remove())}
  function emit(name,detail){try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch{}}

  async function continuePlan(best,status,button){
    if(!best||button?.disabled)return false;
    if(navigator.onLine===false){if(status)status.textContent="Сейчас офлайн. План сохранён — продолжишь, когда появится сеть.";emit("td:bai-handoff-blocked",{reason:"offline"});return false}
    if(button)button.disabled=true;if(status)status.textContent="Готовлю пошаговый переход в магазины…";
    try{
      if(!window.TDContinueInStoresV1)await import("./continue-in-stores-v1.js?v=20260912-handoff-five-v2");
      const opened=await window.TDContinueInStoresV1?.open?.(best);
      if(opened){if(status)status.textContent="Открываю официальный путь по магазинам. Ничего не считаю добавленным без твоего подтверждения.";emit("td:bai-handoff-opened",{stores:stores(best),signature:signature(best)});window.TDBai?.setState?.("happy","План готов. Дальше — по магазинам, шаг за шагом.",2200);return true}
      if(status)status.textContent="Для этого плана пока нет подтверждённого прямого шага. Можно открыть обычное сравнение.";emit("td:bai-handoff-blocked",{reason:"unsupported_plan"});window.TDBai?.setState?.("suspicious","Не буду обещать автоперенос, которого нет. Покажу честный следующий шаг.",2600);return false;
    }catch(error){console.warn("[Votonobay Decision Handoff]",error);if(status)status.textContent="Не получилось открыть магазины. План не потерян — попробуй ещё раз или открой сравнение.";emit("td:bai-handoff-blocked",{reason:"handoff_error"});return false}finally{if(button)button.disabled=false}
  }

  function compare(){document.querySelector(".td-ai [data-ai-close]")?.click?.();if(typeof window.go==="function")window.go("compare")}
  function decorate(){
    const root=document.querySelector(".td-ai"),summary=root?.querySelector(".td-ai-summary"),best=plan();if(!root||!summary||!best){remove();return false}
    const sig=signature(best),existing=root.querySelector(".td-ai-decision-cta");if(existing?.dataset.signature===sig)return true;existing?.remove();
    const ids=stores(best),section=document.createElement("section");section.className="td-ai-decision-cta";section.dataset.signature=sig;section.setAttribute("aria-label","Следующий шаг по решению Бая");
    const eyebrow=document.createElement("small");eyebrow.textContent="РЕШЕНИЕ БАЯ";const title=document.createElement("b");title.textContent="План готов — можно переходить к покупке";
    const copy=document.createElement("p");copy.textContent=ids.length>1?`Корзина разложена по ${ids.length} магазинам. Я проведу по каждому отдельно и не буду притворяться, что перенёс товары автоматически.`:`Корзина собрана для ${storePhrase(ids)}. Открою официальный следующий шаг, а фактическое добавление подтверждаешь ты.`;
    const note=document.createElement("span");note.className="td-ai-decision-note";note.textContent=best.quality==="VERIFIED"?"Расчёт подтверждён данными Votonobay; фактические цена и наличие всё равно проверяются магазином.":"Расчёт ориентировочный: фактические цена и наличие подтверждаются на стороне магазина.";
    const actions=document.createElement("div");actions.className="td-ai-decision-actions";const primary=document.createElement("button");primary.type="button";primary.className="td-ai-decision-primary";primary.dataset.bayContinuePlan="1";primary.textContent=ids.length>1?`Продолжить в ${ids.length} магазинах →`:`Продолжить в ${NAMES[ids[0]]||"магазине"} →`;
    const secondary=document.createElement("button");secondary.type="button";secondary.className="td-ai-decision-secondary";secondary.textContent="Открыть сравнение";const status=document.createElement("div");status.className="td-ai-decision-status";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    primary.onclick=()=>continuePlan(best,status,primary);secondary.onclick=compare;actions.append(primary,secondary);section.append(eyebrow,title,copy,note,actions,status);summary.insertAdjacentElement("afterend",section);return true;
  }

  function queue(frames=2){cancelAnimationFrame(raf);const step=()=>{if(frames-->0){raf=requestAnimationFrame(step);return}decorate()};raf=requestAnimationFrame(step)}
  function wrap(api,name){const original=api?.[name];if(typeof original!=="function"||original.__votonobayDecisionWrapped)return;const wrapped=function(...args){const result=original.apply(this,args);if(result&&typeof result.then==="function")return result.finally(()=>queue());queue();return result};wrapped.__votonobayDecisionWrapped=true;api[name]=wrapped}
  function patchAssistant(){const api=window.TDShoppingAssistant;if(!api)return false;["open","submit","applyStrategy","refresh","newSession"].forEach(name=>wrap(api,name));queue();return true}
  function beginPolling(){if(pollTimer||patchAssistant())return;pollTimer=setInterval(()=>{pollCount++;if(patchAssistant()||pollCount>80){clearInterval(pollTimer);pollTimer=0}},100)}
  function css(){if(document.querySelector("style[data-votonobay-decision-handoff-v1]"))return;const style=document.createElement("style");style.dataset.votonobayDecisionHandoffV1="1";style.textContent=`
    .td-ai-decision-cta{display:grid;gap:7px;margin:10px 0 14px;padding:14px;border:1px solid rgba(79,245,154,.24);border-radius:18px;background:linear-gradient(145deg,rgba(79,245,154,.10),rgba(255,255,255,.035));box-shadow:0 14px 34px rgba(0,0,0,.18)}
    .td-ai-decision-cta>small{color:#78f4ad;font:900 9px/1.2 Manrope,sans-serif;letter-spacing:.11em}.td-ai-decision-cta>b{font:850 15px/1.25 Manrope,sans-serif;color:#f4fff8}.td-ai-decision-cta>p{margin:0;color:#adc1b5;font:650 11px/1.5 Manrope,sans-serif}.td-ai-decision-note{color:#789486;font:700 9px/1.45 Manrope,sans-serif}.td-ai-decision-actions{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:8px;margin-top:4px}.td-ai-decision-actions button{min-height:43px;border-radius:13px;padding:9px 11px;font:850 11px Manrope,sans-serif;cursor:pointer}.td-ai-decision-primary{border:0;background:#4ff59a;color:#04140b}.td-ai-decision-primary:disabled{opacity:.5;cursor:wait}.td-ai-decision-secondary{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#d6e5dc}.td-ai-decision-status{min-height:14px;color:#91aa9b;font:700 9px/1.4 Manrope,sans-serif}
    body.td-votonobay .td-continue-stores-card,body.td-votonobay .td-retailer-card{background:#0b1710!important;color:#f5faf6!important;border:1px solid rgba(79,245,154,.16)!important;box-shadow:0 32px 90px rgba(0,0,0,.48)!important}body.td-votonobay .td-continue-stores-card p,body.td-votonobay .td-continue-stores-card span,body.td-votonobay .td-continue-store-row small,body.td-votonobay .td-continue-store-row em,body.td-votonobay .td-retailer-card p,body.td-votonobay .td-retailer-card small,body.td-votonobay .td-retailer-card span{color:#91a79a!important}body.td-votonobay .td-continue-stores-summary,body.td-votonobay .td-retailer-probe,body.td-votonobay .td-retailer-store-context,body.td-votonobay .td-retailer-session{background:rgba(79,245,154,.065)!important;border-color:rgba(79,245,154,.12)!important}body.td-votonobay .td-continue-store-row{border-color:rgba(255,255,255,.09)!important;background:#0e1d14!important}body.td-votonobay .td-continue-store-row>button,body.td-votonobay .td-store-progress-controls button{background:#0e1d14!important;color:#eef8f1!important}body.td-votonobay .td-store-progress-controls{border-color:rgba(255,255,255,.08)!important}body.td-votonobay .td-retailer-row a,body.td-votonobay .td-retailer-check{background:#0e1d14!important;border-color:rgba(255,255,255,.09)!important;color:#eef8f1!important}body.td-votonobay .td-retailer-main,body.td-votonobay .td-retailer-bulk{background:#4ff59a!important;color:#04140b!important}body.td-votonobay .td-continue-stores-x,body.td-votonobay .td-retailer-x{background:rgba(255,255,255,.08)!important;color:#fff!important}@media(max-width:520px){.td-ai-decision-actions{grid-template-columns:1fr}.td-ai-decision-cta{padding:12px}.td-ai-decision-actions button{min-height:46px;font-size:12px}}
  `;document.head.appendChild(style)}

  window.addEventListener("td:shopping-state",()=>queue());window.addEventListener("td:v2-rendered",()=>{patchAssistant();queue()});window.addEventListener("pageshow",()=>{beginPolling();queue()});document.addEventListener("visibilitychange",()=>{if(!document.hidden){beginPolling();queue()}});css();beginPolling();
  window.TDVotonobayDecisionHandoffV1={decorate,continuePlan,plan,signature,storeKey,patchAssistant};
})();
