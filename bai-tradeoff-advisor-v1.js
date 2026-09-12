(()=>{
  "use strict";
  if(window.__TDBaiTradeoffAdvisorV1)return;
  window.__TDBaiTradeoffAdvisorV1=true;

  const clone=value=>JSON.parse(JSON.stringify(value??null));
  const money=value=>`${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  const unique=value=>[...new Set((value||[]).filter(Boolean))];
  let observer=null;

  function preferences(state={}){
    const list=(state.preferences||[]).map(value=>String(value).toLowerCase());
    return{
      budget:list.some(value=>/budget|эконом|дешев/.test(value)),
      convenience:list.some(value=>/convenience|удоб|быстр|без возни/.test(value))||state.cookingPreference==="minimal"
    };
  }
  function assemblyContext(extraStops=1,mode="walk"){
    const delivery=mode==="delivery",api=window.TDAssemblyPreferences;
    const configured=delivery||api?.hasConfiguredCost?.()===true;
    const settings=api?.read?.()||{minutes:0,rubPerMinute:0,transportRub:0};
    const stops=Math.max(0,Math.floor(Number(extraStops)||0));
    const minutesPerStop=delivery?0:Math.max(0,Number(settings.minutes)||0);
    const timeMinutes=minutesPerStop*stops;
    const timeValueRub=delivery?0:Math.round(minutesPerStop*Math.max(0,Number(settings.rubPerMinute)||0))*stops;
    const transportRub=delivery?0:Math.round(Math.max(0,Number(settings.transportRub)||0))*stops;
    const operationalCost=configured?timeValueRub+transportRub:null;
    return{configured,delivery,extraStops:stops,minutesPerStop,timeMinutes,timeValueRub,transportRub,operationalCost};
  }
  function normalizedMode(state={}){
    const appMode=window.state?.mode;
    if(appMode==="delivery"||appMode==="walk")return appMode;
    if(state.deliveryPreference==="delivery")return"delivery";
    return"walk";
  }
  function confidenceLabel(confidence){
    if(confidence==="verified")return"по подтверждённым данным";
    if(confidence==="live")return"по свежим данным";
    return"по текущим ориентировочным данным";
  }
  function evaluate(input={}){
    const oneTotal=Number(input.oneTotal),splitGoods=Number(input.splitGoods),state=input.state||{},mode=input.mode||normalizedMode(state);
    if(!Number.isFinite(oneTotal)||!Number.isFinite(splitGoods)||oneTotal<=0||splitGoods<=0)return{available:false,reason:"missing_totals"};
    const oneStores=Math.max(1,Number(input.oneStores)||1),splitStores=Math.max(oneStores+1,Number(input.splitStores)||2),extraStops=Math.max(1,splitStores-oneStores);
    const assembly=input.assembly||assemblyContext(extraStops,mode),grossSaving=oneTotal-splitGoods;
    const prefs=preferences(state),confidence=input.confidence||"estimated",operationalKnown=assembly.operationalCost!=null;
    const effectiveSplit=operationalKnown?splitGoods+assembly.operationalCost:null,netSaving=operationalKnown?oneTotal-effectiveSplit:null;
    const neutralMargin=Math.max(80,Math.round(oneTotal*.03)),convenienceMargin=Math.max(250,Math.round(oneTotal*.08));
    let choice="one",reason="convenience_wins",threshold=neutralMargin;

    if(grossSaving<=0){choice="one";reason="one_is_cheaper";threshold=0;}
    else if(operationalKnown){
      threshold=prefs.budget?1:prefs.convenience?convenienceMargin:neutralMargin;
      if(netSaving>=threshold){choice="split";reason="net_saving_wins";}
      else{choice="one";reason=netSaving>0?"saving_too_small":"convenience_wins";}
    }else if(prefs.budget){choice="split";reason="budget_prefers_saving";threshold=1;}
    else if(prefs.convenience){choice="one";reason="convenience_preference";threshold=convenienceMargin;}
    else if(grossSaving>=Math.max(250,Math.round(oneTotal*.08))){choice="split";reason="large_unpriced_saving";threshold=Math.max(250,Math.round(oneTotal*.08));}
    else{choice="one";reason="small_unpriced_saving";threshold=Math.max(250,Math.round(oneTotal*.08));}

    const premiumForOne=Math.max(0,grossSaving),summary=choice==="split"?"Я бы разделил покупки между магазинами.":"Я бы взял всё в одном магазине.";
    let why="",tradeoff="",action="";const source=confidenceLabel(confidence);
    if(choice==="split"){
      if(operationalKnown){
        why=`${source}: товары в нескольких магазинах дешевле примерно на ${money(grossSaving)}. После учёта лишней остановки остаётся около ${money(Math.max(0,netSaving))} выгоды.`;
        tradeoff=assembly.timeMinutes>0?`Компромисс: ещё ${extraStops===1?"одна остановка":`${extraStops} остановки`} и примерно +${assembly.timeMinutes} мин.`:`Компромисс: придётся зайти ещё в ${extraStops===1?"один магазин":`${extraStops} магазина`}.`;
      }else{
        why=`${source}: разнести покупки дешевле примерно на ${money(grossSaving)}. Стоимость дополнительного времени пока не настроена, поэтому это решение с ограниченной уверенностью.`;
        tradeoff=`Компромисс: экономим ${money(grossSaving)}, но добавляем ${extraStops===1?"ещё один магазин":"несколько магазинов"}.`;
      }
      action="Разнести покупки";
    }else{
      if(grossSaving<=0){why=`${source}: один магазин уже не дороже раздельной покупки.`;tradeoff="Компромисса почти нет: меньше действий без переплаты.";}
      else if(operationalKnown){
        const cost=Math.max(0,assembly.operationalCost),net=Math.max(0,netSaving||0);
        why=netSaving<=0?`${source}: два магазина дешевле по товарам на ${money(grossSaving)}, но лишняя остановка оценивается примерно в ${money(cost)} — экономия съедается.`:`${source}: два магазина дают лишь около ${money(net)} чистой выгоды после учёта времени и дороги. Для такой разницы удобство важнее.`;
        tradeoff=assembly.timeMinutes>0?`Компромисс: переплачиваем около ${money(premiumForOne)}, зато без второго магазина и примерно на ${assembly.timeMinutes} мин быстрее.`:`Компромисс: переплачиваем около ${money(premiumForOne)}, зато всё забираем в одном месте.`;
      }else{why=`${source}: второй магазин экономит около ${money(grossSaving)}, но цена дополнительного времени пока не задана. Для небольшой разницы я бы не усложнял маршрут.`;tradeoff=`Компромисс: можно сэкономить ${money(grossSaving)}, если готов добавить ещё один магазин.`;}
      action="Собрать в одном магазине";
    }
    return{available:true,choice,reason,summary,why,tradeoff,action,confidence,mode,oneTotal,splitGoods,splitEffective:effectiveSplit,grossSaving,netSaving,threshold,prefs,oneStores,splitStores,extraStops,assembly:clone(assembly)};
  }
  function confidenceFromPlans(one,multi){return one?.quality==="LIVE"&&multi?.quality==="LIVE"?"live":"estimated"}
  function fromPlans(plans=[],state={}){
    const one=plans.find(plan=>plan?.type==="one")||null,multi=plans.find(plan=>plan?.type==="multi")||null;
    if(!one||!multi)return{available:false,reason:"missing_plan_pair"};
    const oneTotal=Number(one.goods??one.total),splitGoods=Number(multi.goods??multi.total),splitStores=Math.max(2,(multi.stores||[]).length||2),mode=normalizedMode(state),assembly=assemblyContext(Math.max(1,splitStores-1),mode);
    return evaluate({oneTotal,splitGoods,oneStores:1,splitStores,state,mode,assembly,confidence:confidenceFromPlans(one,multi)});
  }
  function fromCurrent(state=window.TDShoppingState?.get?.()||{}){
    const split=window.TDBasketSplit?.fromWindow?.();
    if(split?.bestOne&&split?.bestTwo){const mode=normalizedMode(state),splitStores=split.bestTwo.stores?.length||2,assembly=assemblyContext(Math.max(1,splitStores-1),mode);return evaluate({oneTotal:split.bestOne.total,splitGoods:split.bestTwo.total,oneStores:1,splitStores,state,mode,assembly,confidence:"verified"});}
    const plans=window.TDShoppingOptimizer?.optimize?.(clone(state))||[];return fromPlans(plans,state);
  }
  function explain(decision){return decision?.available?`${decision.summary} ${decision.why} ${decision.tradeoff}`.replace(/\s+/g," ").trim():""}
  function compact(decision){return decision?.available?`${decision.summary} ${decision.tradeoff}`.replace(/\s+/g," ").trim():""}
  function suggestions(decision){if(!decision?.available)return[];const list=[];if(decision.choice==="one")list.push("Собрать в одном магазине","Покажи вариант дешевле");else list.push("Разнести по магазинам","Собрать в одном магазине");if(!decision.assembly?.configured&&decision.mode!=="delivery")list.push("Учесть моё время");return unique(list).slice(0,3)}
  function isTradeoffPrompt(text){return/(что\s+лучше|что\s+выбрат|сравн|один\s+магазин|в\s+одном\s+магазин|два\s+магазин|двух\s+магазин|разнес|удоб|быстр|дешевле|эконом)/i.test(String(text||""))}

  function renderCard(decision){
    if(!decision?.available||typeof document==="undefined")return false;
    const root=document.querySelector(".td-ai");
    if(!root){window.dispatchEvent?.(new CustomEvent("bai:hint",{detail:{state:decision.choice==="split"?"happy":"thinking",text:compact(decision),ms:3800}}));return false;}
    root.querySelector(".td-ai-tradeoff-card")?.remove();
    const card=document.createElement("section");card.className="td-ai-tradeoff-card";card.dataset.choice=decision.choice;card.setAttribute("aria-live","polite");
    const label=document.createElement("small");label.textContent="РЕШЕНИЕ БАЯ";
    const title=document.createElement("b");title.textContent=decision.summary;
    const why=document.createElement("p");why.textContent=decision.why;
    const trade=document.createElement("span");trade.textContent=decision.tradeoff;
    const actions=document.createElement("div"),primary=document.createElement("button");primary.type="button";primary.textContent=decision.action;primary.onclick=()=>window.TDShoppingAssistant?.submit?.(decision.action);actions.appendChild(primary);
    if(!decision.assembly?.configured&&decision.mode!=="delivery"){
      const secondary=document.createElement("button");secondary.type="button";secondary.className="secondary";secondary.textContent="Учесть моё время";secondary.onclick=()=>window.TDShoppingAssistant?.submit?.("Учти моё время и дорогу при выборе магазинов");actions.appendChild(secondary);
    }
    card.append(label,title,why,trade,actions);root.querySelector(".td-ai-messages")?.insertAdjacentElement("beforebegin",card);return true;
  }
  function presentCurrent(){const decision=fromCurrent();if(decision.available)renderCard(decision);return decision}
  function wrapAssistant(){
    const api=window.TDShoppingAssistant;if(!api?.submit||api.submit.__tdTradeoffWrapped)return false;
    const original=api.submit;
    const wrapped=async function(text,...args){const fallback=typeof document!=="undefined"?document.querySelector(".td-ai textarea")?.value:"",prompt=String(text||fallback||"");const result=await original.call(this,text,...args);if(isTradeoffPrompt(prompt))queueMicrotask(()=>presentCurrent());return result};
    wrapped.__tdTradeoffWrapped=true;wrapped.__tdTradeoffOriginal=original;api.submit=wrapped;return true;
  }
  function wrapBayFirst(){
    const original=window.tdBayFirstAsk;if(typeof original!=="function"||original.__tdTradeoffWrapped)return false;
    const wrapped=async function(prompt,...args){const result=await original.call(this,prompt,...args);if(isTradeoffPrompt(prompt))queueMicrotask(()=>{wrapAssistant();presentCurrent()});return result};
    wrapped.__tdTradeoffWrapped=true;wrapped.__tdTradeoffOriginal=original;window.tdBayFirstAsk=wrapped;return true;
  }
  function attach(){wrapBayFirst();wrapAssistant()}
  function ensureCss(){
    if(typeof document==="undefined"||document.querySelector("style[data-bai-tradeoff-advisor-v1]"))return;
    const style=document.createElement("style");style.dataset.baiTradeoffAdvisorV1="1";style.textContent=`.td-ai-tradeoff-card{display:grid;gap:7px;margin:5px 0 12px;padding:13px 14px;border:1px solid rgba(79,245,154,.2);border-radius:17px;background:linear-gradient(145deg,rgba(79,245,154,.075),rgba(255,255,255,.025));box-shadow:0 14px 34px rgba(0,0,0,.14)}.td-ai-tradeoff-card>small{color:#78f4ad;font:900 9px/1.2 Manrope,sans-serif;letter-spacing:.1em}.td-ai-tradeoff-card>b{color:#f3fbf6;font:850 14px/1.3 Manrope,sans-serif}.td-ai-tradeoff-card>p,.td-ai-tradeoff-card>span{margin:0;color:#a9bdb2;font:650 11px/1.5 Manrope,sans-serif}.td-ai-tradeoff-card>span{color:#d8e5dd}.td-ai-tradeoff-card>div{display:flex;gap:7px;flex-wrap:wrap;margin-top:2px}.td-ai-tradeoff-card button{min-height:38px;border:0;border-radius:12px;padding:8px 11px;background:#4ff59a;color:#04140b;font:850 10px Manrope,sans-serif;cursor:pointer}.td-ai-tradeoff-card button.secondary{background:rgba(255,255,255,.075);color:#dce9e1;border:1px solid rgba(255,255,255,.1)}@media(max-width:520px){.td-ai-tradeoff-card{padding:12px}.td-ai-tradeoff-card>div{flex-wrap:nowrap;overflow-x:auto}.td-ai-tradeoff-card button{white-space:nowrap;flex:0 0 auto}}`;document.head.appendChild(style);
  }

  if(typeof document!=="undefined"){
    ensureCss();observer=new MutationObserver(attach);observer.observe(document.body,{childList:true,subtree:true});window.addEventListener("td:v2-rendered",attach);window.addEventListener("pageshow",attach);window.addEventListener("td:assembly-settings",()=>{if(document.querySelector(".td-ai-tradeoff-card"))presentCurrent()});attach();
  }
  window.TDBaiTradeoffAdvisorV1={evaluate,fromPlans,fromCurrent,explain,compact,suggestions,assemblyContext,preferences,isTradeoffPrompt,presentCurrent,renderCard,attach};
})();
