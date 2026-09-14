const ACTIONS=new Set(['add_item','remove_item','replace_item','change_quantity','set_constraint','rebuild_basket','compare_stores','optimize_basket','explain_choice','prepare_purchase']);
const object=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const norm=v=>String(v??'').trim().toLowerCase().replace(/ё/g,'е');
const actionRows=row=>Array.isArray(row?.target?.actions)?row.target.actions:[];
const hardOf=row=>object(row?.target?.hard_constraints)?row.target.hard_constraints:{};

function payloadText(action){
  try{return norm(JSON.stringify(action?.payload??null))}catch{return ''}
}
function actionHas(row,type,...tokens){
  return actionRows(row).some(a=>norm(a?.type)===type&&tokens.every(t=>payloadText(a).includes(norm(t))));
}
function actionConstraint(row,key,value){
  return actionRows(row).some(a=>{
    if(norm(a?.type)!=='set_constraint'||!object(a?.payload))return false;
    const k=norm(a.payload.key??a.payload.name);
    const v=a.payload.value;
    if(k!==norm(key))return false;
    if(value===undefined)return true;
    return norm(v)===norm(value)||Number(v)===Number(value);
  });
}
function includesBrand(value,brand){
  if(Array.isArray(value))return value.some(x=>norm(x)===norm(brand));
  return norm(value)===norm(brand);
}
function constraintPresent(row,token){
  const hard=hardOf(row),text=String(token||''); let m;
  if((m=text.match(/^budget<=(\d+)$/))){const n=Number(m[1]);return Number(hard.budget_max??hard.budget)===n||actionConstraint(row,'budget',n)||actionConstraint(row,'budget_max',n)}
  if((m=text.match(/^people:(\d+)$/))){const n=Number(m[1]);return Number(hard.people_count??hard.people)===n||actionConstraint(row,'people_count',n)}
  if((m=text.match(/^days:(\d+)$/))){const n=Number(m[1]);return Number(hard.duration_days??hard.days)===n||actionConstraint(row,'duration_days',n)}
  if((m=text.match(/^exclude_brand:(.+)$/))){const brand=m[1];return includesBrand(hard.excluded_brands,brand)||includesBrand(hard.exclude_brand,brand)||includesBrand(hard.excluded_brand,brand)||actionConstraint(row,'excluded_brand',brand)}
  if(text==='mode:one')return norm(hard.store_mode)==='one'||Number(hard.store_limit)===1||actionConstraint(row,'store_mode','one')||actionConstraint(row,'store_limit',1);
  if(text==='mode:max2')return Number(hard.store_limit)===2||norm(hard.store_mode)==='max2'||actionConstraint(row,'store_limit',2)||actionConstraint(row,'store_mode','max2');
  if((m=text.match(/^cooking:(.+)$/))){const value=m[1];return norm(hard.cooking)===norm(value)||actionConstraint(row,'cooking',value)}
  return true;
}
function actionContractFlags(row){
  const flags=[];
  for(const a of actionRows(row)){
    if(!object(a)){flags.push('malformed_action');continue}
    const type=norm(a.type);
    if(!ACTIONS.has(type)){flags.push(`unsupported_action:${type||'missing'}`);continue}
    if(!object(a.payload))flags.push(`action_missing_payload:${type}`);
  }
  return flags;
}
function expectedFlags(row){
  const expected=row?.evaluation?.expected;
  if(!object(expected))return [];
  const flags=[];
  for(const token of expected.must_retain||[])if(!constraintPresent(row,token))flags.push(`retain_missing:${token}`);
  for(const token of expected.new_hard||[])if(!constraintPresent(row,token))flags.push(`new_hard_missing:${token}`);
  for(const token of expected.must_drop||[])if(token&&constraintPresent(row,token))flags.push(`must_drop_violation:${token}`);
  for(const effect of expected.required_effects||[]){
    let m;
    if((m=String(effect).match(/^remove_product:(.+)$/))&&!actionHas(row,'remove_item',m[1]))flags.push(`effect_missing:${effect}`);
    else if((m=String(effect).match(/^replace_product:([^:]+):(.+)$/))){
      const from=m[1],to=m[2];
      const ok=to==='similar'?actionHas(row,'replace_item',from):actionHas(row,'replace_item',from,to);
      if(!ok)flags.push(`effect_missing:${effect}`);
    }else if((m=String(effect).match(/^decrement_product:([^:]+):(\d+)$/))){
      const product=m[1],delta=Number(m[2]),current=Number(row?.session_context?.quantities?.[product]||0),target=current?current-delta:null;
      const ok=actionRows(row).some(a=>{
        if(norm(a?.type)!=='change_quantity'||!object(a.payload)||!payloadText(a).includes(norm(product)))return false;
        const values=[a.payload.delta,a.payload.change,a.payload.quantity,a.payload.value,a.payload.amount].filter(v=>v!==undefined).map(Number);
        return values.includes(-delta)||(target!==null&&values.includes(target));
      });
      if(!ok)flags.push(`effect_missing:${effect}`);
    }
  }
  return flags;
}

export function contractCriticFlags(row){
  return [...new Set([...actionContractFlags(row),...expectedFlags(row)])].sort();
}
export {ACTIONS as PRODUCTION_ACTIONS};
