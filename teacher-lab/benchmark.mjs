const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rate=(a,b)=>b?Number((a/b).toFixed(4)):null;

function hardPass(expected,actual){
  return Object.entries(expected||{}).every(([key,value])=>eq(value,(actual||{})[key]));
}

function actionKey(action){return `${action?.type||''}:${JSON.stringify(action?.value??null)}`}

export function benchmark(goldRows,predictionRows){
  const predictions=new Map(predictionRows.map(row=>[row.id,row]));
  let count=0,intents=0,constraints=0,actions=0,retained=0,retainedTotal=0,replacements=0,badReplacements=0,repairs=0,repairSuccess=0;
  for(const gold of goldRows){
    const actual=predictions.get(gold.id);if(!actual)continue;count++;
    if(actual.intent===gold.target.intent)intents++;
    const hardOk=hardPass(gold.target.hard_constraints,actual.hard_constraints);if(hardOk)constraints++;
    const expectedActions=new Set((gold.target.actions||[]).map(actionKey));
    const actualActions=new Set((actual.actions||[]).map(actionKey));
    if([...expectedActions].every(key=>actualActions.has(key)))actions++;
    const need=gold.session_context?.constraints||[];
    if(need.length){retainedTotal++;const got=new Set(actual.retained_constraints||[]);if(need.every(x=>got.has(x)))retained++}
    const allowed=gold.target.shopping_plan?.allowed_replacements||{};
    for(const action of actual.actions||[]){
      if(action?.type!=='REPLACE_PRODUCT')continue;replacements++;
      const from=String(action.value?.from||''),to=String(action.value?.to||'');
      if(!Array.isArray(allowed[from])||!allowed[from].includes(to))badReplacements++;
    }
    if(actual.repair_attempted===true){repairs++;if(actual.critic?.pass===true&&hardOk)repairSuccess++}
  }
  return {
    examples:count,
    intent_accuracy:rate(intents,count),
    constraint_pass_rate:rate(constraints,count),
    action_success_rate:rate(actions,count),
    context_retention_rate:rate(retained,retainedTotal),
    invalid_substitution_rate:rate(badReplacements,replacements),
    repair_success_rate:rate(repairSuccess,repairs)
  };
}
