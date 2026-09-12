(()=>{
  "use strict";
  if(window.TDBaiSufficiency)return;

  const PACK_SERVINGS={
    milk:4,bread:6,chicken:3,banana:5,oil:12,eggs:5,buck:5,sour:6,sugar:12,
    pasta:5,water:6,apple:5,ham:3,dumplings:2,noodles:2,waffles:3,cottage:2
  };
  const ROLE_PRODUCTS={
    protein:["eggs","cottage","chicken","ham","dumplings"],
    base:["bread","buck","pasta","noodles","dumplings"],
    fruit:["banana","apple"],
    drink:["water","milk"]
  };
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const food=()=>window.TDBaiFoodKnowledge||null;
  const memory=()=>window.TDBaiMemory||null;
  const servingsFor=(id,quantity=1)=>Math.max(0,Number(quantity)||0)*(PACK_SERVINGS[id]||2);

  function demand(state={}){
    const people=Math.max(1,Number(state.peopleCount)||1),days=Math.max(1,Number(state.duration)||1),pd=people*days;
    return {
      people,days,personDays:pd,
      breakfast:pd,lunch:pd,dinner:pd,snack:Math.ceil(pd*.65),
      roles:{protein:pd*2.1,base:pd*2.2,fruit:pd*.8,drink:pd*1.2}
    };
  }

  function supplies(plan){
    const k=food(),roles={protein:0,base:0,fruit:0,drink:0},byProduct={};
    for(const line of plan?.products||[]){
      const id=String(line?.id||""),q=Math.max(1,Number(line?.quantity)||1),cap=servingsFor(id,q),r=k?.info?.(id)?.roles||[];
      byProduct[id]=(byProduct[id]||0)+cap;
      if(r.includes("protein"))roles.protein+=cap;
      if(r.some(x=>x==="carb"||x==="base"||x==="side"))roles.base+=cap;
      if(r.includes("fruit"))roles.fruit+=cap;
      if(r.includes("drink"))roles.drink+=cap;
    }
    return {roles,byProduct};
  }

  function ratio(have,need){return need>0?Math.max(0,Math.min(1.5,have/need)):1}
  function audit(state={},plan={},mealPlan=null){
    const d=demand(state),s=supplies(plan),ratios={};
    for(const role of Object.keys(d.roles))ratios[role]=ratio(s.roles[role]||0,d.roles[role]);
    const gaps=[];
    if(ratios.protein<.72)gaps.push({role:"protein",severity:1-ratios.protein,label:"мало белковой основы"});
    if(ratios.base<.72)gaps.push({role:"base",severity:1-ratios.base,label:"мало основы для основных приёмов еды"});
    if(ratios.fruit<.52)gaps.push({role:"fruit",severity:1-ratios.fruit,label:"мало фруктов/простых перекусов"});
    if(ratios.drink<.48)gaps.push({role:"drink",severity:1-ratios.drink,label:"мало базовых напитков"});

    const mealTargets=mealPlan?.quantityTargets||{},targetMiss=[];
    for(const [id,target] of Object.entries(mealTargets)){
      const wanted=Math.max(1,Number(target?.amount)||1),line=(plan?.products||[]).find(x=>x?.id===id),have=Math.max(0,Number(line?.quantity)||0);
      if(have<wanted)targetMiss.push({id,wanted,have});
    }
    const weighted=ratios.protein*.32+ratios.base*.32+ratios.fruit*.18+ratios.drink*.18;
    let score=Math.round(Math.min(1,weighted)*100)-Math.min(24,targetMiss.length*4);
    score=Math.max(0,Math.min(100,score));
    return {
      score,demand:d,supply:s,ratios,gaps:gaps.sort((a,b)=>b.severity-a.severity),targetMiss,
      sufficient:gaps.length===0&&targetMiss.length<=1,
      label:score>=85?"запас выглядит уверенно":score>=65?"запас в целом рабочий":"запаса мало для заданного срока"
    };
  }

  function candidates(role,state={}){
    const excluded=new Set(state.excludedProducts||[]),m=memory();
    return (ROLE_PRODUCTS[role]||[]).filter(id=>!excluded.has(id)&&!m?.shouldAvoid?.(id));
  }
  function repairSuggestions(state,plan,mealPlan=null,limit=3){
    const a=audit(state,plan,mealPlan),used=new Set((plan?.products||[]).map(x=>x?.id)),out=[];
    for(const gap of a.gaps){
      const id=candidates(gap.role,state).find(x=>!used.has(x))||candidates(gap.role,state)[0];
      if(id&&!out.includes(id)){out.push(id);used.add(id)}
      if(out.length>=limit)break;
    }
    return out;
  }

  window.TDBaiSufficiency={PACK_SERVINGS,ROLE_PRODUCTS,servingsFor,demand,supplies,audit,candidates,repairSuggestions};
})();
