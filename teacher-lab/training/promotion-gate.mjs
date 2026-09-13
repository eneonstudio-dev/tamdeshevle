const HIGHER=['intent_accuracy','constraint_pass_rate','action_success_rate','context_retention_rate','repair_success_rate'];
const LOWER=['invalid_substitution_rate'];
const num=v=>Number.isFinite(Number(v))?Number(v):null;

export function promotionGate(baseline,candidate){
  const reasons=[];
  if(!baseline||!candidate)return {pass:false,reasons:['metrics_missing']};
  if(num(candidate.examples)!==null&&num(baseline.examples)!==null&&candidate.examples<baseline.examples)reasons.push('fewer_examples');
  for(const key of HIGHER){
    const b=num(baseline[key]),c=num(candidate[key]);
    if(b===null&&c===null)continue;
    if(b!==null&&c===null){reasons.push(`${key}_missing`);continue}
    if(b!==null&&c<b)reasons.push(`${key}_regressed`);
  }
  for(const key of LOWER){
    const b=num(baseline[key]),c=num(candidate[key]);
    if(b===null&&c===null)continue;
    if(b!==null&&c===null){reasons.push(`${key}_missing`);continue}
    if(b!==null&&c>b)reasons.push(`${key}_regressed`);
  }
  const constraints=num(candidate.constraint_pass_rate);
  if(constraints!==null&&constraints<0.98)reasons.push('constraint_floor_not_met');
  const intent=num(candidate.intent_accuracy);
  if(intent!==null&&intent<0.85)reasons.push('intent_floor_not_met');
  return {pass:reasons.length===0,reasons};
}
