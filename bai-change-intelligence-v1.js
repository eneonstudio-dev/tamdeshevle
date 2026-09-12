(()=>{
  "use strict";
  if(window.__TDBaiChangeIntelligenceV1)return;
  window.__TDBaiChangeIntelligenceV1=true;

  const clone=value=>JSON.parse(JSON.stringify(value??null));
  const money=value=>`${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  let lastSnapshot=window.TDShoppingState?.snapshot?.()||clone(window.TDShoppingState?.get?.()||{}),replanning=false,recent=null;

  function productMap(state){
    const out={};
    for(const line of state?.products||[]){
      const id=line?.sourceId||line?.id;if(!id)continue;
      const quantity=Math.max(0,Math.floor(Number(line?.quantity)||0));if(!quantity)continue;
      const current=out[id]||{id,name:line?.name||id,quantity:0};current.quantity+=quantity;if(line?.name)current.name=line.name;out[id]=current;
    }
    return out;
  }
  function sorted(value){return Array.isArray(value)?[...value].map(String).sort():[]}
  function diffStates(before={},after={}){
    const a=productMap(before),b=productMap(after),added=[],removed=[],quantity=[];
    for(const [id,row] of Object.entries(b)){if(!a[id])added.push({...row});else if(a[id].quantity!==row.quantity)quantity.push({id,name:row.name,from:a[id].quantity,to:row.quantity,delta:row.quantity-a[id].quantity});}
    for(const [id,row] of Object.entries(a))if(!b[id])removed.push({...row});
    const context={};
    const scalar=["budget","mode","peopleCount","duration","cookingPreference","deliveryPreference","selectionMode"];
    for(const key of scalar)if(!same(before?.[key]??null,after?.[key]??null))context[key]={from:before?.[key]??null,to:after?.[key]??null};
    if(!same(sorted(before?.stores),sorted(after?.stores)))context.stores={from:sorted(before?.stores),to:sorted(after?.stores)};
    const productChanged=Boolean(added.length||removed.length||quantity.length),contextChanged=Boolean(Object.keys(context).length);
    return{added,removed,quantity,context,productChanged,contextChanged,changed:productChanged||contextChanged,quantityMagnitude:quantity.reduce((sum,row)=>sum+Math.abs(row.delta),0)};
  }
  function planKey(plan){if(!plan)return"";const stores=sorted(plan.stores?.length?plan.stores:(plan.products||[]).map(line=>line.storeId).filter(Boolean));return`${plan.type||plan.id||"plan"}:${stores.join(",")}`}
  function storeName(id){return(typeof STORES!=="undefined"&&Array.isArray(STORES)?STORES:[]).find(store=>store?.id===id)?.name||id||"магазин"}
  function planLabel(plan){const stores=sorted(plan?.stores?.length?plan.stores:(plan?.products||[]).map(line=>line.storeId).filter(Boolean));if(stores.length===1)return`«${storeName(stores[0])}»`;if(stores.length>1)return`${stores.length} магазина`;return"текущий вариант"}
  function changePhrase(change){
    if(change.added.length&&change.removed.length)return"замены состава";
    if(change.added.length)return`добавления ${change.added[0].name}`;
    if(change.removed.length)return`удаления ${change.removed[0].name}`;
    if(change.context.budget)return"изменения бюджета";
    if(change.context.stores)return"смены магазина";
    if(change.context.mode)return"смены режима";
    if(change.context.peopleCount||change.context.duration)return"изменения объёма покупки";
    if(change.quantity.length)return"изменения количества";
    return"изменения условий";
  }
  function assess(before,after,change,oldBest,newBest){
    if(!change?.changed)return{notify:false,level:"none",reason:"no_change",text:""};
    const oldTotal=Number(oldBest?.total),newTotal=Number(newBest?.total),budget=Number(after?.budget),winnerChanged=Boolean(oldBest&&newBest&&planKey(oldBest)!==planKey(newBest));
    const totalDelta=Number.isFinite(oldTotal)&&Number.isFinite(newTotal)?newTotal-oldTotal:null;
    const significantMoney=totalDelta!=null&&Math.abs(totalDelta)>=Math.max(100,Math.abs(oldTotal)*.08);
    const overBudget=Number.isFinite(budget)&&budget>0&&Number.isFinite(newTotal)&&newTotal>budget?newTotal-budget:0;
    const structural=Boolean(change.added.length||change.removed.length||change.context.budget||change.context.stores||change.context.mode);
    let notify=false,level="quiet",reason="minor",text="";
    if(overBudget>0){notify=true;level="warning";reason="over_budget";text=`После ${changePhrase(change)} корзина выходит за бюджет примерно на ${money(overBudget)}.${newBest?` Лучший текущий вариант — ${planLabel(newBest)}, ≈ ${money(newTotal)}.`:""}`;}
    else if(winnerChanged){notify=true;level="important";reason="winner_changed";text=`Пересчитал: после ${changePhrase(change)} лучше ${planLabel(newBest)} — ≈ ${money(newTotal)}. До правки лидировал ${planLabel(oldBest)}.`;}
    else if(structural&&newBest){notify=true;level="useful";reason="structural_change";text=`Пересчитал после ${changePhrase(change)}. Лучший вариант не поменялся: ${planLabel(newBest)}, ≈ ${money(newTotal)}.`;}
    else if(significantMoney&&newBest){notify=true;level="useful";reason="meaningful_total_change";const direction=totalDelta>0?"дороже":"дешевле";text=`Количество изменилось заметно: теперь ≈ ${money(newTotal)} — примерно на ${money(Math.abs(totalDelta))} ${direction}. Лучший вариант пока тот же: ${planLabel(newBest)}.`;}
    return{notify,level,reason,text,winnerChanged,totalDelta,overBudget,significantMoney,structural};
  }
  function manualWorkingCopy(state){
    const working=clone(state),rows=Object.values(productMap(state));
    if(state?.intent!=="manual")return working;
    const ids=rows.map(row=>row.id);working.budget=null;working.peopleCount=1;working.duration=1;working.selectionMode="only";working.onlyProducts=[...ids];working.requiredProducts=[...ids];working.quantityTargets=Object.fromEntries(rows.map(row=>[row.id,{amount:row.quantity,unit:"pack"}]));return working;
  }
  function replan(){
    const api=window.TDShoppingState,optimizer=window.TDShoppingOptimizer,state=api?.get?.();if(!api||!optimizer?.optimize||!state?.products?.length)return state?.lastPlans?.[0]||null;
    const plans=optimizer.optimize(manualWorkingCopy(state))||[],best=plans[0]||null;if(!best)return null;
    replanning=true;
    try{state.lastPlans=clone(plans);state.currentTotal=Number(best.total)||0;if(state.intent!=="manual"&&Array.isArray(best.products))state.products=clone(best.products);api.save?.();}
    finally{replanning=false}
    return best;
  }
  function ensureCss(){
    if(typeof document==="undefined"||document.querySelector("style[data-bai-change-intelligence-v1]"))return;
    const style=document.createElement("style");style.dataset.baiChangeIntelligenceV1="1";style.textContent=`.td-bai-change-note{display:grid;gap:5px;margin:5px 0 11px;padding:11px 12px;border:1px solid rgba(79,245,154,.18);border-radius:15px;background:rgba(79,245,154,.055);color:#dce9e1}.td-bai-change-note>small{color:#78f4ad;font:900 9px/1.2 Manrope,sans-serif;letter-spacing:.1em}.td-bai-change-note>span{font:700 11px/1.45 Manrope,sans-serif}.td-bai-change-note[data-level="warning"]{border-color:rgba(255,194,92,.24);background:rgba(255,194,92,.07)}.td-bai-change-note[data-level="warning"]>small{color:#ffd28a}`;document.head.appendChild(style);
  }
  function surface(insight){
    try{window.dispatchEvent(new CustomEvent("td:bai-change-insight",{detail:clone(insight)}))}catch{}
    if(!insight?.notify||!insight.text)return;
    const root=typeof document!=="undefined"?document.querySelector(".td-ai"):null;
    if(root){ensureCss();root.querySelector(".td-bai-change-note")?.remove();const note=document.createElement("section");note.className="td-bai-change-note";note.dataset.level=insight.level;note.setAttribute("role","status");note.setAttribute("aria-live","polite");const label=document.createElement("small");label.textContent=insight.level==="warning"?"БАЙ ЗАМЕТИЛ":"БАЙ ПЕРЕСЧИТАЛ";const text=document.createElement("span");text.textContent=insight.text;note.append(label,text);root.querySelector(".td-ai-messages")?.insertAdjacentElement("beforebegin",note);return;}
    try{window.dispatchEvent(new CustomEvent("bai:hint",{detail:{state:insight.level==="warning"?"suspicious":insight.reason==="winner_changed"?"happy":"thinking",text:insight.text,ms:3400}}))}catch{}
  }
  function analyzeTransition(before,after){
    const change=diffStates(before,after);if(!change.changed)return null;
    const busy=Boolean(window.TDShoppingAssistant?.isBusy?.()),oldBest=before?.lastPlans?.[0]||null;
    let newBest=after?.lastPlans?.[0]||null;if(!busy&&(change.productChanged||change.contextChanged))newBest=replan()||newBest;
    const live=window.TDShoppingState?.snapshot?.()||after,insight={...assess(before,live,change,oldBest,newBest),change,oldBest:clone(oldBest),newBest:clone(newBest),busy,at:new Date().toISOString()};
    recent=insight;try{window.dispatchEvent(new CustomEvent("td:shopping-change",{detail:clone(insight)}));window.dispatchEvent(new CustomEvent("td:bai-change-analyzed",{detail:clone(insight)}))}catch{}
    if(!busy)surface(insight);return insight;
  }
  function onState(event){
    const after=clone(event?.detail||window.TDShoppingState?.snapshot?.()||{}),before=lastSnapshot||{};lastSnapshot=after;if(replanning)return;const insight=analyzeTransition(before,after);lastSnapshot=window.TDShoppingState?.snapshot?.()||after;return insight;
  }
  function harmonizeManualClick(event){
    if(!event.target?.closest?.(".v2-add,.step button:last-child,.step button:first-child"))return;
    queueMicrotask(()=>{if(!recent)return;const age=Date.now()-new Date(recent.at).getTime();if(age>800)return;if(recent.notify){if(typeof document!=="undefined"&&!document.querySelector(".td-ai"))surface(recent)}else window.TDBai?.setState?.("idle","",0,false);});
  }

  window.addEventListener("td:shopping-state",onState);
  if(typeof document!=="undefined")document.addEventListener("click",harmonizeManualClick);
  ensureCss();
  window.TDBaiChangeIntelligenceV1={diffStates,assess,analyzeTransition,replan,recent:()=>clone(recent),snapshot:()=>clone(lastSnapshot)};
})();
