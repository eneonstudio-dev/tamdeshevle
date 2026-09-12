(()=>{
  "use strict";
  if(window.__TDBaiTradeoffAdvisorV1)return;
  window.__TDBaiTradeoffAdvisorV1=true;

  const clone=value=>JSON.parse(JSON.stringify(value??null));
  const money=value=>`${Math.round(Number(value)||0).toLocaleString("ru-RU")} ₽`;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const unique=value=>[...new Set((value||[]).filter(Boolean))];

  function preferences(state={}){
    const list=(state.preferences||[]).map(value=>String(value).toLowerCase());
    return{
      budget:list.some(value=>/budget|эконом|дешев/.test(value)),
      convenience:list.some(value=>/convenience|удоб|быстр|без возни/.test(value))||state.cookingPreference==="minimal"
    };
  }
  function assemblyContext(extraStops=1,mode="walk"){
    const delivery=mode==="delivery";
    const api=window.TDAssemblyPreferences;
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
    const prefs=preferences(state),confidence=input.confidence||"estimated";
    const operationalKnown=assembly.operationalCost!=null;
    const effectiveSplit=operationalKnown?splitGoods+assembly.operationalCost:null;
    const netSaving=operationalKnown?oneTotal-effectiveSplit:null;
    const neutralMargin=Math.max(80,Math.round(oneTotal*.03));
    const convenienceMargin=Math.max(250,Math.round(oneTotal*.08));
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
    let why="",tradeoff="",action="";
    const source=confidenceLabel(confidence);
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
      if(grossSaving<=0){
        why=`${source}: один магазин уже не дороже раздельной покупки.`;
        tradeoff="Компромисса почти нет: меньше действий без переплаты.";
      }else if(operationalKnown){
        const cost=Math.max(0,assembly.operationalCost),net=Math.max(0,netSaving||0);
        why=netSaving<=0
          ?`${source}: два магазина дешевле по товарам на ${money(grossSaving)}, но лишняя остановка оценивается примерно в ${money(cost)} — экономия съедается.`
          :`${source}: два магазина дают лишь около ${money(net)} чистой выгоды после учёта времени и дороги. Для такой разницы удобство важнее.`;
        tradeoff=assembly.timeMinutes>0?`Компромисс: переплачиваем около ${money(premiumForOne)}, зато без второго магазина и примерно на ${assembly.timeMinutes} мин быстрее.`:`Компромисс: переплачиваем около ${money(premiumForOne)}, зато всё забираем в одном месте.`;
      }else{
        why=`${source}: второй магазин экономит около ${money(grossSaving)}, но цена дополнительного времени пока не задана. Для небольшой разницы я бы не усложнял маршрут.`;
        tradeoff=`Компромисс: можно сэкономить ${money(grossSaving)}, если готов добавить ещё один магазин.`;
      }
      action="Собрать в одном магазине";
    }
    return{
      available:true,choice,reason,summary,why,tradeoff,action,confidence,mode,
      oneTotal,splitGoods,splitEffective:effectiveSplit,grossSaving,netSaving,threshold,prefs,
      oneStores,splitStores,extraStops,assembly:clone(assembly)
    };
  }
  function cartFromProducts(products=[]){
    const cart={};
    for(const line of products){const id=line?.sourceId||line?.id,quantity=Math.max(1,Math.floor(Number(line?.quantity)||1));if(id)cart[id]=(cart[id]||0)+quantity;}
    return cart;
  }
  function confidenceFromPlans(one,multi){
    if(one?.quality==="LIVE"&&multi?.quality==="LIVE")return"live";
    return"estimated";
  }
  function fromPlans(plans=[],state={}){
    const one=plans.find(plan=>plan?.type==="one")||null,multi=plans.find(plan=>plan?.type==="multi")||null;
    if(!one||!multi)return{available:false,reason:"missing_plan_pair"};
    const oneTotal=Number(one.goods??one.total),splitGoods=Number(multi.goods??multi.total),splitStores=Math.max(2,(multi.stores||[]).length||2),mode=normalizedMode(state),assembly=assemblyContext(Math.max(1,splitStores-1),mode);
    return evaluate({oneTotal,splitGoods,oneStores:1,splitStores,state,mode,assembly,confidence:confidenceFromPlans(one,multi)});
  }
  function fromCurrent(state=window.TDShoppingState?.get?.()||{}){
    const split=window.TDBasketSplit?.fromWindow?.();
    if(split?.bestOne&&split?.bestTwo){
      const mode=normalizedMode(state),splitStores=split.bestTwo.stores?.length||2,assembly=assemblyContext(Math.max(1,splitStores-1),mode);
      return evaluate({oneTotal:split.bestOne.total,splitGoods:split.bestTwo.total,oneStores:1,splitStores,state,mode,assembly,confidence:"verified"});
    }
    const plans=window.TDShoppingOptimizer?.optimize?.(clone(state))||[];
    return fromPlans(plans,state);
  }
  function explain(decision){
    if(!decision?.available)return"";
    return`${decision.summary} ${decision.why} ${decision.tradeoff}`.replace(/\s+/g," ").trim();
  }
  function compact(decision){
    if(!decision?.available)return"";
    return`${decision.summary} ${decision.tradeoff}`.replace(/\s+/g," ").trim();
  }
  function suggestions(decision){
    if(!decision?.available)return[];
    const list=[];
    if(decision.choice==="one")list.push("Собрать в одном магазине","Покажи вариант дешевле");
    else list.push("Разнести по магазинам","Собрать в одном магазине");
    if(!decision.assembly?.configured&&decision.mode!=="delivery")list.push("Учесть моё время");
    return unique(list).slice(0,3);
  }

  window.TDBaiTradeoffAdvisorV1={evaluate,fromPlans,fromCurrent,explain,compact,suggestions,assemblyContext,cartFromProducts,preferences};
})();
