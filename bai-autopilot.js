(()=>{
  "use strict";
  if(window.TDBaiAutopilot)return;

  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const food=()=>window.TDBaiFoodKnowledge||null;

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
    const understocked=units(plan)<Math.max(4,Math.ceil(demand*.8));

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
    if(understocked)issues.push({code:"understocked",critical:false,detail:`${units(plan)}/${demand}`});

    let score=100;
    if(overBudget)score-=45;
    score-=requiredMissing.length*35;
    score-=excludedHits.length*45;
    if(oneStoreMismatch)score-=35;
    if(balance)score-=Math.max(0,Math.round((78-Number(balance.coverage?.score||0))*.45));
    if(minimalCookingMismatch)score-=18;
    if(understocked)score-=15;
    score=Math.max(0,Math.min(100,score));

    return {score,critical:issues.some(x=>x.critical),issues,productIds,foodMissing,understocked,units:units(plan),demand,foodScore:Number(balance?.coverage?.score||0)};
  }

  function repair(state,plan,meal=null,text=""){
    const scenario=clone(state),before=audit(scenario,plan,meal,text),operations=[],reasons=[];
    scenario.requiredProducts=uniq(scenario.requiredProducts||[]);
    scenario.excludedProducts=uniq(scenario.excludedProducts||[]);
    const excluded=new Set(scenario.excludedProducts);
    const existing=new Set(ids(plan));
    const k=food();

    if(before.foodMissing.length&&k){
      const additions=(k.suggestAdditions?.(before.productIds,meal)||[]).filter(id=>!excluded.has(id)&&!existing.has(id)).slice(0,2);
      for(const id of additions){
        scenario.requiredProducts=uniq([...scenario.requiredProducts,id]);
        operations.push({type:"REQUIRE",value:id});
        existing.add(id);
      }
      if(additions.length)reasons.push("закрыл пробелы по составу корзины");
    }

    if(before.understocked){
      const candidates=["eggs","bread","banana","water"].filter(id=>!excluded.has(id)&&!existing.has(id)).slice(0,2);
      for(const id of candidates){
        scenario.requiredProducts=uniq([...scenario.requiredProducts,id]);
        operations.push({type:"REQUIRE",value:id});
        existing.add(id);
      }
      if(candidates.length)reasons.push("добавил запас под людей и дни");
    }

    if(before.issues.some(x=>x.code==="too_many_stores")){
      scenario.mode="one";
      operations.push({type:"SET_MODE",value:"one"});
      reasons.push("собрал в одном магазине по просьбе пользователя");
    }

    return {scenario,operations,reasons,before};
  }

  function refine({state,plan,meal=null,text="",optimize}={}){
    const before=audit(state,plan,meal,text);
    if(!plan||typeof optimize!=="function")return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const fix=repair(state,plan,meal,text);
    if(!fix.operations.length)return{plan,refined:false,before,after:before,operations:[],reasons:[]};

    const candidates=optimize(fix.scenario)||[];
    const candidate=candidates[0];
    if(!candidate)return{plan,refined:false,before,after:before,operations:[],reasons:[]};
    const after=audit(fix.scenario,candidate,meal,text);
    const budget=Number(fix.scenario.budget)||0;
    const budgetSafe=!budget||Number(candidate.total||0)<=budget;
    const criticalSafe=!after.critical;
    const meaningfulGain=after.score>=before.score+6||(before.critical&&!after.critical);
    const notNarrower=after.productIds.length>=Math.min(before.productIds.length,4);
    if(!budgetSafe||!criticalSafe||!meaningfulGain||!notNarrower)return{plan,refined:false,before,after,operations:[],reasons:[]};

    return{plan:candidate,refined:true,before,after,operations:fix.operations,reasons:fix.reasons};
  }

  window.TDBaiAutopilot={audit,repair,refine};
})();
