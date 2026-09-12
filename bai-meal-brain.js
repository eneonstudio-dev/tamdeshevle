(()=>{
  "use strict";
  if(window.TDBaiMealBrain)return;

  const TEMPLATES={
    breakfast:[
      {id:"eggs_bread",title:"Яйца с хлебом",items:["eggs","bread"],prep:"quick"},
      {id:"cottage_fruit",title:"Творог с фруктом",items:["cottage","banana"],prep:"ready"},
      {id:"milk_bread_fruit",title:"Молоко, хлеб и фрукт",items:["milk","bread","apple"],prep:"ready"}
    ],
    lunch:[
      {id:"chicken_buck",title:"Курица с гречкой",items:["chicken","buck","oil"],prep:"cook"},
      {id:"chicken_pasta",title:"Курица с макаронами",items:["chicken","pasta","oil"],prep:"cook"},
      {id:"dumplings_sour",title:"Пельмени со сметаной",items:["dumplings","sour"],prep:"quick"},
      {id:"noodles_eggs",title:"Лапша с яйцом",items:["noodles","eggs"],prep:"quick"},
      {id:"ham_bread",title:"Ветчина с хлебом и фруктом",items:["ham","bread","apple"],prep:"ready"}
    ],
    dinner:[
      {id:"buck_eggs",title:"Гречка с яйцом",items:["buck","eggs"],prep:"quick"},
      {id:"chicken_buck_dinner",title:"Курица с гречкой",items:["chicken","buck","oil"],prep:"cook"},
      {id:"dumplings_dinner",title:"Пельмени со сметаной",items:["dumplings","sour"],prep:"quick"},
      {id:"noodles_dinner",title:"Лапша с яйцом",items:["noodles","eggs"],prep:"quick"},
      {id:"eggs_bread_dinner",title:"Яйца с хлебом",items:["eggs","bread"],prep:"quick"}
    ],
    snack:[
      {id:"banana_snack",title:"Банан",items:["banana"],prep:"ready"},
      {id:"apple_snack",title:"Яблоко",items:["apple"],prep:"ready"},
      {id:"cottage_snack",title:"Творог с фруктом",items:["cottage","apple"],prep:"ready"},
      {id:"waffles_snack",title:"Вафли с молоком",items:["waffles","milk"],prep:"ready"}
    ]
  };
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const memory=()=>window.TDBaiMemory||null;
  const suff=()=>window.TDBaiSufficiency||null;
  const substitutions=()=>window.TDBaiSmartSubstitutions||null;

  function preferences(state={},text=""){
    const t=low(text),p=new Set(state.preferences||[]);
    if(/готовить\s*(?:лень|не хочу|не буду)|без готовки|минимум готовки|быстро и просто/.test(t))return{minimal:true,budget:p.has("budget")||/дешев|эконом|бюджет/.test(t),healthy:p.has("healthy")||/полез|полегче|здоров/.test(t),hearty:p.has("hearty")||/сытн|плотн/.test(t)};
    return{minimal:state.cookingPreference==="minimal",budget:p.has("budget")||/дешев|эконом|бюджет/.test(t),healthy:p.has("healthy")||/полез|полегче|здоров/.test(t),hearty:p.has("hearty")||/сытн|плотн/.test(t)};
  }
  function blocked(id,state={}){return (state.excludedProducts||[]).includes(id)||Boolean(memory()?.shouldAvoid?.(id))}
  function templateScore(template,state,prefs){
    if(template.items.some(id=>blocked(id,state)))return-999;
    let score=50;
    if(prefs.minimal){score+=template.prep==="ready"?24:template.prep==="quick"?16:-24}
    if(prefs.healthy){if(template.items.some(id=>["banana","apple","cottage","chicken","buck","eggs"].includes(id)))score+=8;if(template.items.includes("waffles"))score-=16}
    if(prefs.hearty&&template.items.some(id=>["chicken","eggs","buck","pasta","dumplings"].includes(id)))score+=9;
    const affinities=template.items.map(id=>memory()?.productAffinity?.(id)).filter(Number.isFinite);if(affinities.length)score+=Math.max(-18,Math.min(18,affinities.reduce((a,b)=>a+b,0)*1.6));
    if(prefs.budget){const prices=template.items.map(id=>substitutions()?.price?.(id,state)).filter(Number.isFinite);if(prices.length)score-=Math.min(18,prices.reduce((a,b)=>a+b,0)/120)}
    return score;
  }
  function rankedTemplates(meal,state,prefs){return (TEMPLATES[meal]||[]).map(x=>({...x,score:templateScore(x,state,prefs)})).filter(x=>x.score>-900).sort((a,b)=>b.score-a.score)}

  function makeSchedule(state={},text=""){
    const people=Math.max(1,Number(state.peopleCount)||1),days=Math.max(1,Math.min(30,Number(state.duration)||1)),prefs=preferences(state,text),ranked={};
    for(const meal of Object.keys(TEMPLATES))ranked[meal]=rankedTemplates(meal,state,prefs);
    const schedule=[];
    for(let day=0;day<days;day++){
      const row={day:day+1};
      for(const meal of ["breakfast","lunch","dinner","snack"]){const list=ranked[meal];row[meal]=list.length?clone(list[day%Math.min(list.length,3)]):null}
      schedule.push(row);
    }
    return{people,days,prefs,schedule,ranked};
  }

  function usageFromSchedule(pack){
    const usage={};
    for(const day of pack.schedule||[])for(const meal of ["breakfast","lunch","dinner","snack"]){
      const template=day[meal];if(!template)continue;
      const multiplier=meal==="snack"?.7:1;
      for(const id of template.items||[])usage[id]=(usage[id]||0)+pack.people*multiplier;
    }
    return usage;
  }
  function targetsFromUsage(usage){
    const caps=suff()?.PACK_SERVINGS||{},targets={};
    for(const [id,count] of Object.entries(usage||{})){const cap=Math.max(1,Number(caps[id])||2),packs=Math.max(1,Math.min(12,Math.ceil(Number(count||0)/cap)));targets[id]={amount:packs,unit:"pack"}}
    return targets;
  }
  function targetCost(targets,state={}){
    let total=0,known=0;for(const [id,t] of Object.entries(targets||{})){const p=substitutions()?.price?.(id,state);if(Number.isFinite(p)){total+=p*Math.max(1,Number(t?.amount)||1);known++}}
    return known?{total:Math.round(total),known}:null;
  }
  function replaceTarget(targets,from,to){if(!targets[from]||!to)return false;const next=Math.max(Number(targets[to]?.amount)||0,Number(targets[from]?.amount)||1);targets[to]={amount:next,unit:"pack"};delete targets[from];return true}
  function fitBudget(targets,state,prefs){
    const budget=Number(state.budget)||0;if(!budget)return{targets,replacements:[],pressure:false,estimate:targetCost(targets,state)};
    const out=clone(targets),replacements=[];let estimate=targetCost(out,state),guard=0;
    while(estimate&&estimate.total>budget*.9&&guard++<8){
      const costly=Object.keys(out).map(id=>({id,price:substitutions()?.price?.(id,state)||0})).sort((a,b)=>b.price-a.price);
      let changed=false;
      for(const item of costly){const pick=substitutions()?.cheaper?.(item.id,state,{preferReady:prefs.minimal});if(!pick?.id||out[pick.id])continue;if(replaceTarget(out,item.id,pick.id)){replacements.push({from:item.id,to:pick.id,saving:pick.fromPrice&&pick.price?Math.round(pick.fromPrice-pick.price):null,reason:"budget"});changed=true;break}}
      if(!changed)break;estimate=targetCost(out,state);
    }
    estimate=targetCost(out,state);
    if(estimate&&estimate.total>budget*.92){
      const factor=Math.max(.55,Math.min(1,(budget*.88)/estimate.total));
      for(const id of Object.keys(out))out[id].amount=Math.max(1,Math.floor((Number(out[id].amount)||1)*factor));
      estimate=targetCost(out,state);
    }
    return{targets:out,replacements,pressure:Boolean(estimate&&estimate.total>budget*.92),estimate};
  }

  function operationsFor(required,targets){
    const ops=[];for(const id of required)ops.push({type:"REQUIRE",value:id});
    for(const [id,target] of Object.entries(targets||{}))ops.push({type:"SET_PRODUCT_AMOUNT",value:{id,amount:target.amount,unit:"pack"}});
    return ops;
  }
  function daySummary(day){return{day:day.day,breakfast:day.breakfast?.title||null,lunch:day.lunch?.title||null,dinner:day.dinner?.title||null,snack:day.snack?.title||null}}
  function plan(state={},text=""){
    const pack=makeSchedule(state,text),usage=usageFromSchedule(pack),rawTargets=targetsFromUsage(usage),fit=fitBudget(rawTargets,state,pack.prefs),repair=substitutions()?.repairRequired?.(Object.keys(fit.targets),state,{preferReady:pack.prefs.minimal})||{required:Object.keys(fit.targets),replacements:[]};
    const targets={...fit.targets};for(const r of repair.replacements||[])replaceTarget(targets,r.from,r.to);
    const required=uniq(repair.required||Object.keys(targets)),ops=operationsFor(required,targets),estimate=targetCost(targets,state);
    return{people:pack.people,days:pack.days,preferences:pack.prefs,schedule:pack.schedule.map(daySummary),requiredProducts:required,quantityTargets:targets,operations:ops,replacements:uniq([...(fit.replacements||[]),...(repair.replacements||[])].map(x=>JSON.stringify(x))).map(x=>JSON.parse(x)),estimatedGoods:estimate?.total||null,budgetPressure:fit.pressure,usage};
  }
  function explain(mealPlan){
    if(!mealPlan)return"";const bits=[`разложил закупку на ${mealPlan.days} дн. для ${mealPlan.people} чел.`];
    if(mealPlan.preferences?.minimal)bits.push("держу упор на готовое и быстрое");
    if(mealPlan.replacements?.length)bits.push(`сделал ${mealPlan.replacements.length} замен(ы), чтобы не тащить неподходящее или слишком дорогое`);
    if(mealPlan.budgetPressure)bits.push("бюджет очень плотный — запас пришлось ужать");
    return bits.join("; ");
  }

  window.TDBaiMealBrain={templates:TEMPLATES,preferences,templateScore,rankedTemplates,makeSchedule,usageFromSchedule,targetsFromUsage,targetCost,fitBudget,operationsFor,plan,explain};
})();
