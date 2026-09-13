const stable=v=>JSON.stringify(v,Object.keys(v||{}).sort());
const actionKey=a=>`${a?.type||''}:${JSON.stringify(a?.value??null)}`;

function same(values){
  if(!values.length)return {agree:false,value:null};
  const first=stable(values[0]);
  return values.every(v=>stable(v)===first)?{agree:true,value:values[0]}:{agree:false,value:null};
}

export function compareCandidates(candidates){
  const rows=(Array.isArray(candidates)?candidates:[]).filter(Boolean);
  if(rows.length<2)throw Error('at least two teacher candidates required');
  const sourceIds=new Set(rows.flatMap(row=>(row.provenance?.sources||[]).map(x=>x.source_id)));
  if(sourceIds.size<2)throw Error('consensus requires distinct teacher sources');
  const request=rows[0].user_request;
  if(rows.some(row=>row.user_request!==request))throw Error('teacher candidates must describe the same request');

  const intents=same(rows.map(row=>row.target?.intent));
  const hard=same(rows.map(row=>row.target?.hard_constraints||{}));
  const soft=same(rows.map(row=>row.target?.soft_preferences||{}));
  const plans=same(rows.map(row=>row.target?.shopping_plan||{}));

  const actionSets=rows.map(row=>new Set((row.target?.actions||[]).map(actionKey)));
  const commonActions=[...actionSets[0]].filter(key=>actionSets.every(set=>set.has(key)));
  const conflicts=[];
  if(!intents.agree)conflicts.push('intent');
  if(!hard.agree)conflicts.push('hard_constraints');
  if(!soft.agree)conflicts.push('soft_preferences');
  if(!plans.agree)conflicts.push('shopping_plan');
  if(actionSets.some(set=>set.size!==commonActions.length))conflicts.push('actions');

  return {
    pass:conflicts.length===0,
    requires_review:conflicts.length>0,
    sources:[...sourceIds],
    conflicts,
    agreements:{intent:intents.agree,hard_constraints:hard.agree,soft_preferences:soft.agree,shopping_plan:plans.agree,actions:!conflicts.includes('actions')},
    common_action_keys:commonActions
  };
}
