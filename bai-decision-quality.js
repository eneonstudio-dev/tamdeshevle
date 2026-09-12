(()=>{
  "use strict";
  if(window.TDBaiDecisionQuality)return;
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const idsOf=s=>uniq((s?.productIds||s?.products?.map(x=>x?.id)||[]).map(String));
  const money=n=>Math.max(0,Math.round(Number(n)||0));
  let plannerWrapped=false;
  function bestOneStore(list,current){return (list||[]).filter(x=>x&&x!==current&&Number(x.stores||0)<=1).sort((a,b)=>money(a.total)-money(b.total))[0]||null}
  function qualityStats(strategy){
    const products=Array.isArray(strategy?.products)?strategy.products:[];
    if(products.length){const live=products.filter(x=>x?.quality==="LIVE").length,unknown=products.filter(x=>x?.quality==="UNKNOWN").length;return{live,unknown,total:products.length,share:live/products.length}}
    const q=String(strategy?.quality||"").toUpperCase();return{live:q==="LIVE"?1:0,unknown:q==="UNKNOWN"?1:0,total:q?1:0,share:q==="LIVE"?1:0}
  }
  function evaluate(strategy,alternatives=[],state={}){
    if(!strategy)return{score:0,delta:-100,verdict:"bad",critical:true,reasons:["Нет рабочего варианта."],risks:["missing_plan"]};
    let score=82,delta=0;const reasons=[],risks=[];let critical=false;
    const total=money(strategy.total),stores=Math.max(1,Number(strategy.stores)||1),ids=idsOf(strategy),budget=money(state?.budget);
    const excluded=uniq((state?.excludedProducts||[]).map(String)),required=uniq((state?.requiredProducts||[]).map(String));
    const forbidden=ids.filter(id=>excluded.includes(id)),missing=required.filter(id=>!ids.includes(id));
    if(forbidden.length){score-=70;delta-=100;critical=true;risks.push("excluded_product");reasons.push("В корзину вернулось то, что было исключено.")}
    if(missing.length){score-=55;delta-=80;critical=true;risks.push("missing_required");reasons.push("Потерялся обязательный товар.")}
    if(budget&&total>budget){const over=total-budget;score-=over>budget*.15?45:32;delta-=over>budget*.15?55:38;critical=true;risks.push("over_budget");reasons.push(`Выше бюджета на ${over} ₽.`)}
    const q=qualityStats(strategy);
    if(q.total){
      if(q.unknown>0){score-=q.unknown===q.total?24:14;delta-=q.unknown===q.total?22:12;risks.push("unverified_data");reasons.push("Часть цены нельзя считать подтверждённой.")}
      else if(q.share>=.99){score+=5;delta+=4;reasons.push("Цены подтверждены текущими данными.")}
      else{score-=7;delta-=5;risks.push("estimated_data")}
    }
    if(stores>1){
      const one=bestOneStore(alternatives,strategy);
      if(one){
        const saving=money(one.total)-total,threshold=Math.max(150,Math.round(money(one.total)*.05));
        if(saving<=0){score-=34;delta-=30;risks.push("extra_store_no_saving");reasons.push("Дополнительные магазины не дают экономии.")}
        else if(saving<threshold){score-=24;delta-=22;risks.push("small_saving_extra_store");reasons.push(`Экономия ${saving} ₽ слишком мала для лишнего магазина.`)}
        else if(saving>=Math.max(350,Math.round(money(one.total)*.1))){score+=9;delta+=8;reasons.push(`Дополнительный магазин экономит около ${saving} ₽ — здесь крюк уже имеет смысл.`)}
        else reasons.push(`Дополнительный магазин экономит около ${saving} ₽.`)
      }else{score-=Math.max(0,stores-2)*7;delta-=Math.max(0,stores-2)*6}
      if(stores>2){score-=Math.min(18,(stores-2)*8);delta-=Math.min(16,(stores-2)*7);risks.push("too_many_stores");reasons.push(`${stores} магазина — уже заметная возня.`)}
    }
    if(state?.mode==="one"&&stores>1){score-=60;delta-=90;critical=true;risks.push("violates_one_store");reasons.push("Нарушено условие про один магазин.")}
    score=clamp(Math.round(score),0,100);delta=clamp(Math.round(delta),-100,20);
    const verdict=critical||score<45?"bad":score<65?"questionable":score<82?"acceptable":"good";
    return{score,delta,verdict,critical,reasons:reasons.slice(0,4),risks:uniq(risks),total,stores};
  }
  function apply(strategies,state={}){
    const list=Array.isArray(strategies)?strategies:[];
    for(const s of list){s.decision=evaluate(s,list,state);s.decisionScore=s.decision.score;s.score=(Number(s.score)||0)+s.decision.delta}
    list.sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.decisionScore||0)-Number(a.decisionScore||0));return list;
  }
  function explain(audit){if(!audit)return"";if(audit.verdict==="bad")return audit.reasons[0]||"Этот вариант выглядит плохим решением.";if(audit.verdict==="questionable")return audit.reasons[0]||"Вариант спорный.";return audit.reasons.slice(0,2).join(" ")}
  function wrapPlanner(planner){
    if(!planner?.build||planner.__baiDecisionQualityWrapped)return planner;
    const originalBuild=planner.build.bind(planner),originalExplain=planner.explain?.bind(planner),originalAfter=planner.afterChoice?.bind(planner);
    Object.defineProperty(planner,"__baiDecisionQualityWrapped",{value:true,configurable:true});
    planner.build=function(state,text="",...rest){const result=originalBuild(state,text,...rest)||{};const strategies=apply(result.strategies||[],state);result.strategies=strategies;result.recommended=strategies[0]||null;return result};
    if(originalExplain)planner.explain=function(result,state,...rest){const base=originalExplain(result,state,...rest)||"",extra=explain(result?.recommended?.decision);return [base,extra].filter(Boolean).join(" ").replace(/\s+/g," ").trim()};
    if(originalAfter)planner.afterChoice=function(chosen,alternatives,state,...rest){const out=originalAfter(chosen,alternatives,state,...rest)||{text:"",suggestions:[]},extra=chosen?.decision&&["bad","questionable"].includes(chosen.decision.verdict)?explain(chosen.decision):"";if(extra)out.text=[out.text,extra].filter(Boolean).join(" ").trim();return out};
    plannerWrapped=true;return planner;
  }
  function install(){const current=window.TDBaiPlanner;if(current){wrapPlanner(current);return true}let value;try{Object.defineProperty(window,"TDBaiPlanner",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapPlanner(next)}});return true}catch{return false}}
  window.TDBaiDecisionQuality={evaluate,apply,explain,install,status:()=>({plannerWrapped,version:"decision-quality-v1"}),policy:{minExtraStoreSaving:150,minExtraStoreShare:.05,strongExtraStoreSaving:350,strongExtraStoreShare:.1}};
  install();
})();
