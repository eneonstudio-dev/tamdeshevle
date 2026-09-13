const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const rate=(a,b)=>b?Number((a/b).toFixed(4)):null;
const asArray=value=>Array.isArray(value)?value:[];

function hardPass(expected,actual){
  return Object.entries(expected||{}).every(([key,value])=>eq(value,(actual||{})[key]));
}

function actionKey(action){
  const type=String(action?.type||'').toLowerCase();
  const payload=action?.payload??action?.value??null;
  return `${type}:${JSON.stringify(payload)}`;
}

function replacement(action){
  const type=String(action?.type||'').toLowerCase(),payload=action?.payload??action?.value??{};
  if(type==='replace_item')return {from:String(payload?.from_product_id||''),to:String(payload?.to_product_id||'')};
  if(type==='replace_product')return {from:String(payload?.from||''),to:String(payload?.to||'')};
  return null;
}

export function benchmark(goldRows,predictionRows){
  const predictions=new Map(predictionRows.map(row=>[row.id,row]));
  let count=0,intents=0,constraints=0,actions=0,retained=0,retainedTotal=0,replacements=0,badReplacements=0,repairs=0,repairSuccess=0;
  for(const gold of goldRows){
    const actual=predictions.get(gold.id);if(!actual)continue;count++;
    if(actual.intent===gold.target.intent)intents++;
    const hardOk=hardPass(gold.target.hard_constraints,actual.hard_constraints);if(hardOk)constraints++;
    const expectedActions=new Set(asArray(gold.target.actions).map(actionKey));
    const actualActions=new Set(asArray(actual.actions).map(actionKey));
    if([...expectedActions].every(key=>actualActions.has(key)))actions++;
    const need=gold.session_context?.constraints||[];
    if(need.length){retainedTotal++;const got=new Set(asArray(actual.retained_constraints));if(need.every(x=>got.has(x)))retained++}
    const allowed=gold.target.shopping_plan?.allowed_replacements||{};
    for(const action of asArray(actual.actions)){
      const rep=replacement(action);if(!rep)continue;replacements++;
      if(!Array.isArray(allowed[rep.from])||!allowed[rep.from].includes(rep.to))badReplacements++;
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
