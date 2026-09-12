await import("./bai-food-knowledge.js?v=20260911-food-v2").catch(()=>{});
await import("./bai-sufficiency.js?v=20260912-sufficiency-v1").catch(()=>{});
(()=>{
  "use strict";
  if(window.TDBaiAutopilot)return;

  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const food=()=>window.TDBaiFoodKnowledge||null,suff=()=>window.TDBaiSufficiency||null;
  let plannerWrapped=false;

  function ids(plan){return uniq((plan?.products||[]).map(x=>x?.id).filter(Boolean))}
  function units(plan){return (plan?.products||[]).reduce((n,x)=>n+Math.max(1,Number(x?.quantity)||1),0)}
  function explicitOneStore(state,text=""){const t=low(text);return state?.mode==="one"||/в\s+одном\s+магазин|один\s+магазин|не\s+хочу\s+(?:ходить|ездить).*магазин/.test(t)}

  function audit(state,plan,meal=null,text="",mealPlan=null){
    const s=state||{},productIds=ids(plan),set=new Set(productIds),issues=[];
    const requiredMissing=(s.requiredProducts||[]).filter(id=>!set.has(id)),excludedHits=(s.excludedProducts||[]).filter(id=>set.has(id));
    const budget=Number(s.budget)||0,total=Number(plan?.total)||0,overBudget=budget>0&&total>budget,storeCount=(plan?.stores||[]).length,oneStoreMismatch=explicitOneStore(s,text)&&storeCount>1;
    const k=food(),balance=k?.balancePlan?.(productIds,meal)||null,foodMissing=uniq([...(balance?.coverage?.mealMissing||[]),...(balance?.coverage?.missing||[])]),weakFood=Boolean(balance&&(!balance.balanced||foodMissing.length));
    const supply=suff()?.audit?.(s,plan,mealPlan)||null,understocked=Boolean(supply&&supply.score<65),cookHeavy=productIds.filter(id=>k?.info?.(id)?.prep==="cook").length,minimalCookingMismatch=s.cookingPreference==="minimal"&&cookHeavy>=3;
    if(overBudget)issues.push({code:"budget_over",critical:true,detail:`${Math.round(total-budget)} ₽ сверх бюджета`});
    if(requiredMissing.length)issues.push({code:"required_missing",critical:true,detail:requiredMissing.join(","),ids:requiredMissing});
    if(excludedHits.length)issues.push({code:"excluded_present",critical:true,detail:excludedHits.join(","),ids:excludedHits});
    if(oneStoreMismatch)issues.push({code:"too_many_stores",critical:true,detail:String(storeCount)});
    if(weakFood)issues.push({code:"food_gaps",critical:false,detail:foodMissing.join(","),ids:foodMissing});
    if(supply?.gaps?.length)issues.push({code:"supply_gaps",critical:false,detail:supply.gaps.map(x=>x.role).join(","),roles:supply.gaps.map(x=>x.role)});
    if(minimalCookingMismatch)issues.push({code:"cooking_mismatch",critical:false,detail:String(cookHeavy)});
    if(understocked)issues.push({code:"understocked",critical:false,detail:`${supply.score}/100`});
    let score=100;if(overBudget)score-=45;score-=requiredMissing.length*35;score-=excludedHits.length*45;if(oneStoreMismatch)score-=35;if(balance)score-=Math.max(foodMissing.length*6,Math.max(0,Math.round((78-Number(balance.coverage?.score||0))*.35)));if(supply)score-=Math.max(0,Math.round((78-supply.score)*.55));if(minimalCookingMismatch)score-=18;score=Math.max(0,Math.min(100,score));
    return{score,critical:issues.some(x=>x.critical),issues,productIds,foodMissing,understocked,units:units(plan),demand:supply?.demand?.personDays||Math.max(1,(Number(s.peopleCount)||1)*(Number(s.duration)||1)),foodScore:Number(balance?.coverage?.score||0),sufficiency:supply};
  }

  function repair(state,plan,meal=null,text="",mealPlan=null){
    const scenario=clone(state),before=audit(scenario,plan,meal,text,mealPlan),operations=[],reasons=[];scenario.requiredProducts=uniq(scenario.requiredProducts||[]);scenario.excludedProducts=uniq(scenario.excludedProducts||[]);
    const excluded=new Set(scenario.excludedProducts),existing=new Set(ids(plan)),k=food();
    const supplyAdds=(suff()?.repairSuggestions?.(scenario,plan,mealPlan,3)||[]).filter(id=>!excluded.has(id)&&!existing.has(id));
    const foodAdds=before.foodMissing.length&&k?(k.suggestAdditions?.(before.productIds,meal)||[]):[];
    for(const id of uniq([...supplyAdds,...foodAdds]).slice(0,3)){if(excluded.has(id)||existing.has(id))continue;scenario.requiredProducts=uniq([...scenario.requiredProducts,id]);operations.push({type:"REQUIRE",value:id});existing.add(id)}
    if(supplyAdds.length)reasons.push("добрал запас под людей и дни");else if(foodAdds.length)reasons.push("закрыл пробелы по составу корзины");
    if(before.issues.some(x=>x.code==="too_many_stores")){scenario.mode="one";operations.push({type:"SET_MODE",value:"one"});reasons.push("собрал в одном магазине по просьбе пользователя")}
    return{scenario,operations,reasons,before};
  }

  function refine({state,plan,meal=null,text="",mealPlan=null,optimize}={}){
    const before=audit(state,plan,meal,text,mealPlan);if(!plan||typeof optimize!=="function")return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const fix=repair(state,plan,meal,text,mealPlan);if(!fix.operations.length)return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const candidate=(optimize(fix.scenario)||[])[0];if(!candidate)return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const after=audit(fix.scenario,candidate,meal,text,mealPlan),budget=Number(fix.scenario.budget)||0,budgetSafe=!budget||Number(candidate.total||0)<=budget,criticalSafe=!after.critical,meaningfulGain=after.score>=before.score+6||(before.critical&&!after.critical),notNarrower=after.productIds.length>=Math.min(before.productIds.length,4);
    if(!budgetSafe||!criticalSafe||!meaningfulGain||!notNarrower)return{plan,refined:false,before,after,operations:[],reasons:[]};return{plan:candidate,refined:true,before,after,operations:fix.operations,reasons:fix.reasons};
  }

  function applyPlannerOps(base,operations){const s=clone(base);s.requiredProducts=uniq(s.requiredProducts||[]);s.preferences=uniq(s.preferences||[]);s.quantityTargets=s.quantityTargets||{};for(const op of operations||[]){if(!op)continue;if(op.type==="CHANGE_BUDGET")s.budget=Number(op.value)||s.budget;else if(op.type==="SET_MODE")s.mode=op.value;else if(op.type==="SET_COOKING")s.cookingPreference=op.value;else if(op.type==="ADD_PREFERENCE")s.preferences=uniq([...s.preferences,op.value]);else if(op.type==="REQUIRE")s.requiredProducts=uniq([...s.requiredProducts,op.value]);else if(op.type==="SET_PRODUCT_AMOUNT"&&op.value?.id)s.quantityTargets[op.value.id]={amount:Number(op.value.amount)||1,unit:op.value.unit||"pack"}}return s}
  function opKey(op){return `${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`}
  function mergeOps(base,extra){const out=[],seen=new Set();for(const op of [...(base||[]).filter(x=>x?.type!=="REOPTIMIZE"),...(extra||[])]){const key=opKey(op);if(!seen.has(key)){seen.add(key);out.push(op)}}out.push({type:"REOPTIMIZE"});return out}
  function refreshStrategy(strategy,plan,auto){const products=plan?.products||[];strategy.total=Math.round(Number(plan?.total)||0);strategy.goods=Math.round(Number(plan?.goods)||0);strategy.stores=(plan?.stores||[]).length;strategy.productCount=products.length;strategy.unitCount=products.reduce((n,p)=>n+(Number(p?.quantity)||1),0);strategy.productNames=products.slice(0,5).map(p=>p.name);strategy.productIds=products.map(p=>p.id).filter(Boolean);strategy.operations=mergeOps(strategy.operations,auto.operations);strategy.autopilotRefined=true;strategy.autopilotReasons=auto.reasons||[];strategy.autopilotAudit={before:auto.before,after:auto.after};strategy.sufficiency=auto.after?.sufficiency||strategy.sufficiency;strategy.score=Number(strategy.score||0)+Math.max(1,Math.round((auto.after.score-auto.before.score)*.45));const k=food();if(k){strategy.foodScore=k.scorePlan?.(strategy.productIds,strategy.meal)||strategy.foodScore||0;strategy.foodReasons=k.explain?.(strategy.productIds,strategy.meal)||[];strategy.foodRecipes=(k.recipesFor?.(strategy.productIds,strategy.meal)||[]).slice(0,2)}return strategy}

  function wrapPlanner(planner){if(!planner?.build||planner.__baiAutopilotWrapped)return planner;const originalBuild=planner.build.bind(planner),originalExplain=planner.explain?.bind(planner);Object.defineProperty(planner,"__baiAutopilotWrapped",{value:true,configurable:true});planner.build=function(state,text=""){const result=originalBuild(state,text)||{strategies:[],recommended:null};if(!window.TDShoppingOptimizer?.optimize)return result;const strategies=(result.strategies||[]).map(strategy=>{const scenario=applyPlannerOps(state,strategy.operations||[]),baseline=(window.TDShoppingOptimizer.optimize(scenario)||[])[0];if(!baseline)return strategy;const auto=refine({state:scenario,plan:baseline,meal:strategy.meal||result.meal||null,mealPlan:strategy.mealPlan||null,text,optimize:s=>window.TDShoppingOptimizer.optimize(s)});return auto.refined?refreshStrategy(strategy,auto.plan,auto):strategy});strategies.sort((a,b)=>Number(b.score||0)-Number(a.score||0));return{...result,strategies,recommended:strategies[0]||null}};if(originalExplain)planner.explain=function(result,state){let text=originalExplain(result,state)||"";const r=result?.recommended;if(r?.autopilotRefined&&r.autopilotReasons?.length)text+=` Перед рекомендацией я перепроверил корзину и ${r.autopilotReasons.join("; ")}.`;return text};plannerWrapped=true;return planner}
  function installPlanner(){if(window.TDBaiPlanner){wrapPlanner(window.TDBaiPlanner);return true}let value;try{Object.defineProperty(window,"TDBaiPlanner",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapPlanner(next)}});return true}catch{return false}}
  window.TDBaiAutopilot={audit,repair,refine,applyPlannerOps,mergeOps,installPlanner,status:()=>({plannerWrapped})};installPlanner();
})();
