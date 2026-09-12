(()=>{
  "use strict";
  if(window.TDBaiAutopilot)return;

  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const food=()=>window.TDBaiFoodKnowledge||null;
  let plannerWrapped=false;

  function ids(plan){return uniq((plan?.products||[]).map(x=>x?.id).filter(Boolean))}
  function units(plan){return (plan?.products||[]).reduce((n,x)=>n+Math.max(1,Number(x?.quantity)||1),0)}
  function explicitOneStore(state,text=""){
    const t=low(text);
    return state?.mode==="one"||/в\s+одном\s+магазин|один\s+магазин|не\s+хочу\s+(?:ходить|ездить).*магазин/.test(t);
  }

  function audit(state,plan,meal=null,text=""){
    const s=state||{},productIds=ids(plan),set=new Set(productIds),issues=[];
    const requiredMissing=(s.requiredProducts||[]).filter(id=>!set.has(id));
    const excludedHits=(s.excludedProducts||[]).filter(id=>set.has(id));
    const budget=Number(s.budget)||0,total=Number(plan?.total)||0;
    const overBudget=budget>0&&total>budget;
    const storeCount=(plan?.stores||[]).length;
    const oneStoreMismatch=explicitOneStore(s,text)&&storeCount>1;
    const demand=Math.max(1,(Number(s.peopleCount)||1)*(Number(s.duration)||1));
    const unitCount=units(plan),understocked=unitCount<Math.max(4,Math.ceil(demand*.8));

    const k=food(),balance=k?.balancePlan?.(productIds,meal)||null;
    const foodMissing=uniq([...(balance?.coverage?.mealMissing||[]),...(balance?.coverage?.missing||[])]);
    const weakFood=Boolean(balance&&(!balance.balanced||foodMissing.length));
    const cookHeavy=productIds.filter(id=>k?.info?.(id)?.prep==="cook").length;
    const minimalCookingMismatch=s.cookingPreference==="minimal"&&cookHeavy>=3;

    if(overBudget)issues.push({code:"budget_over",critical:true,detail:`${Math.round(total-budget)} ₽ сверх бюджета`});
    if(requiredMissing.length)issues.push({code:"required_missing",critical:true,detail:requiredMissing.join(","),ids:requiredMissing});
    if(excludedHits.length)issues.push({code:"excluded_present",critical:true,detail:excludedHits.join(","),ids:excludedHits});
    if(oneStoreMismatch)issues.push({code:"too_many_stores",critical:true,detail:String(storeCount)});
    if(weakFood)issues.push({code:"food_gaps",critical:false,detail:foodMissing.join(","),ids:foodMissing});
    if(minimalCookingMismatch)issues.push({code:"cooking_mismatch",critical:false,detail:String(cookHeavy)});
    if(understocked)issues.push({code:"understocked",critical:false,detail:`${unitCount}/${demand}`});

    let score=100;
    if(overBudget)score-=45;
    score-=requiredMissing.length*35;
    score-=excludedHits.length*45;
    if(oneStoreMismatch)score-=35;
    if(balance)score-=Math.max(foodMissing.length*8,Math.max(0,Math.round((78-Number(balance.coverage?.score||0))*.45)));
    if(minimalCookingMismatch)score-=18;
    if(understocked)score-=15;
    score=Math.max(0,Math.min(100,score));
    return {score,critical:issues.some(x=>x.critical),issues,productIds,foodMissing,understocked,units:unitCount,demand,foodScore:Number(balance?.coverage?.score||0)};
  }

  function repair(state,plan,meal=null,text=""){
    const scenario=clone(state),before=audit(scenario,plan,meal,text),operations=[],reasons=[];
    scenario.requiredProducts=uniq(scenario.requiredProducts||[]);
    scenario.excludedProducts=uniq(scenario.excludedProducts||[]);
    const excluded=new Set(scenario.excludedProducts),existing=new Set(ids(plan)),k=food();

    if(before.foodMissing.length&&k){
      const additions=(k.suggestAdditions?.(before.productIds,meal)||[]).filter(id=>!excluded.has(id)&&!existing.has(id)).slice(0,2);
      for(const id of additions){scenario.requiredProducts=uniq([...scenario.requiredProducts,id]);operations.push({type:"REQUIRE",value:id});existing.add(id)}
      if(additions.length)reasons.push("закрыл пробелы по составу корзины");
    }

    if(before.understocked){
      const candidates=["eggs","bread","banana","water"].filter(id=>!excluded.has(id)&&!existing.has(id)).slice(0,2);
      for(const id of candidates){scenario.requiredProducts=uniq([...scenario.requiredProducts,id]);operations.push({type:"REQUIRE",value:id});existing.add(id)}
      if(candidates.length)reasons.push("добавил запас под людей и дни");
    }

    if(before.issues.some(x=>x.code==="too_many_stores")){
      scenario.mode="one";operations.push({type:"SET_MODE",value:"one"});reasons.push("собрал в одном магазине по просьбе пользователя");
    }
    return {scenario,operations,reasons,before};
  }

  function refine({state,plan,meal=null,text="",optimize}={}){
    const before=audit(state,plan,meal,text);
    if(!plan||typeof optimize!=="function")return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const fix=repair(state,plan,meal,text);
    if(!fix.operations.length)return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const candidate=(optimize(fix.scenario)||[])[0];
    if(!candidate)return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const after=audit(fix.scenario,candidate,meal,text),budget=Number(fix.scenario.budget)||0;
    const budgetSafe=!budget||Number(candidate.total||0)<=budget;
    const criticalSafe=!after.critical;
    const meaningfulGain=after.score>=before.score+6||(before.critical&&!after.critical);
    const notNarrower=after.productIds.length>=Math.min(before.productIds.length,4);
    if(!budgetSafe||!criticalSafe||!meaningfulGain||!notNarrower)return{plan,refined:false,before,after,operations:[],reasons:[]};
    return{plan:candidate,refined:true,before,after,operations:fix.operations,reasons:fix.reasons};
  }

  function applyPlannerOps(base,operations){
    const s=clone(base);s.requiredProducts=uniq(s.requiredProducts||[]);s.preferences=uniq(s.preferences||[]);
    for(const op of operations||[]){
      if(!op)continue;
      if(op.type==="CHANGE_BUDGET")s.budget=Number(op.value)||s.budget;
      else if(op.type==="SET_MODE")s.mode=op.value;
      else if(op.type==="SET_COOKING")s.cookingPreference=op.value;
      else if(op.type==="ADD_PREFERENCE")s.preferences=uniq([...s.preferences,op.value]);
      else if(op.type==="REQUIRE")s.requiredProducts=uniq([...s.requiredProducts,op.value]);
    }
    return s;
  }

  function opKey(op){return `${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`}
  function mergeOps(base,extra){
    const out=[],seen=new Set();
    for(const op of [...(base||[]).filter(x=>x?.type!=="REOPTIMIZE"),...(extra||[])]){const key=opKey(op);if(!seen.has(key)){seen.add(key);out.push(op)}}
    out.push({type:"REOPTIMIZE"});return out;
  }

  function refreshStrategy(strategy,plan,auto){
    const products=plan?.products||[];
    strategy.total=Math.round(Number(plan?.total)||0);strategy.goods=Math.round(Number(plan?.goods)||0);
    strategy.stores=(plan?.stores||[]).length;strategy.productCount=products.length;
    strategy.unitCount=products.reduce((n,p)=>n+(Number(p?.quantity)||1),0);
    strategy.productNames=products.slice(0,5).map(p=>p.name);strategy.productIds=products.map(p=>p.id).filter(Boolean);
    strategy.operations=mergeOps(strategy.operations,auto.operations);strategy.autopilotRefined=true;
    strategy.autopilotReasons=auto.reasons||[];strategy.autopilotAudit={before:auto.before,after:auto.after};
    strategy.score=Number(strategy.score||0)+Math.max(1,Math.round((auto.after.score-auto.before.score)*.45));
    const k=food();
    if(k){strategy.foodScore=k.scorePlan?.(strategy.productIds,strategy.meal)||strategy.foodScore||0;strategy.foodReasons=k.explain?.(strategy.productIds,strategy.meal)||[];strategy.foodRecipes=(k.recipesFor?.(strategy.productIds,strategy.meal)||[]).slice(0,2)}
    return strategy;
  }

  function wrapPlanner(planner){
    if(!planner?.build||planner.__baiAutopilotWrapped)return planner;
    const originalBuild=planner.build.bind(planner),originalExplain=planner.explain?.bind(planner);
    Object.defineProperty(planner,"__baiAutopilotWrapped",{value:true,configurable:true});
    planner.build=function(state,text=""){
      const result=originalBuild(state,text)||{strategies:[],recommended:null};
      if(!window.TDShoppingOptimizer?.optimize)return result;
      const strategies=(result.strategies||[]).map(strategy=>{
        const scenario=applyPlannerOps(state,strategy.operations||[]),baseline=(window.TDShoppingOptimizer.optimize(scenario)||[])[0];
        if(!baseline)return strategy;
        const auto=refine({state:scenario,plan:baseline,meal:strategy.meal||result.meal||null,text,optimize:s=>window.TDShoppingOptimizer.optimize(s)});
        return auto.refined?refreshStrategy(strategy,auto.plan,auto):strategy;
      });
      strategies.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
      return {...result,strategies,recommended:strategies[0]||null};
    };
    if(originalExplain)planner.explain=function(result,state){
      let text=originalExplain(result,state)||"";const r=result?.recommended;
      if(r?.autopilotRefined&&r.autopilotReasons?.length)text+=` Перед рекомендацией я перепроверил корзину и ${r.autopilotReasons.join("; ")}.`;
      return text;
    };
    plannerWrapped=true;return planner;
  }

  function installPlanner(){
    if(window.TDBaiPlanner){wrapPlanner(window.TDBaiPlanner);return true}
    let value;
    try{Object.defineProperty(window,"TDBaiPlanner",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapPlanner(next)}});return true}catch{return false}
  }

  window.TDBaiAutopilot={audit,repair,refine,applyPlannerOps,mergeOps,installPlanner,status:()=>({plannerWrapped})};
  installPlanner();
})();
