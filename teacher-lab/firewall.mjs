const FORBIDDEN=new Set(['chain_of_thought','reasoning','hidden_reasoning','scratchpad','cot']);
const STATUSES=new Set(['training_allowed','evaluation_only','blocked']);
const CONF={overall:new Set(['low','medium','high']),price:new Set(['unknown','estimated','verified']),availability:new Set(['unknown','estimated','verified']),quality:new Set(['unknown','heuristic','verified'])};
const obj=v=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const ensure=(ok,msg)=>{if(!ok)throw Error(msg)};

function forbidden(value,path='$',hits=[]){
  if(Array.isArray(value)){value.forEach((v,i)=>forbidden(v,`${path}[${i}]`,hits));return hits}
  if(!obj(value))return hits;
  for(const [k,v] of Object.entries(value)){if(FORBIDDEN.has(k.toLowerCase()))hits.push(`${path}.${k}`);forbidden(v,`${path}.${k}`,hits)}
  return hits;
}

export function validateRegistry(registry){
  ensure(obj(registry),'registry must be object');
  ensure(registry.schema_version==='1.0','registry schema_version must be 1.0');
  ensure(registry.default_status==='blocked','registry must default to blocked');
  ensure(Array.isArray(registry.sources),'registry.sources must be array');
  const ids=new Set();
  for(const s of registry.sources){
    ensure(obj(s),'source must be object');
    ensure(/^[a-z0-9][a-z0-9_-]{2,99}$/.test(String(s.id||'')),`invalid source id ${s.id}`);
    ensure(!ids.has(s.id),`duplicate source ${s.id}`);ids.add(s.id);
    ensure(STATUSES.has(s.status),`invalid status ${s.id}`);
    ensure(/^\d{4}-\d{2}-\d{2}$/.test(String(s.checked_at||'')),`missing checked_at ${s.id}`);
    ensure(typeof s.license==='string'&&s.license,`missing license ${s.id}`);
    if(s.status==='training_allowed')ensure(s.training_other_models===true,`${s.id} lacks explicit training permission`);
  }
  return {ok:true,count:ids.size,training_allowed:registry.sources.filter(x=>x.status==='training_allowed').map(x=>x.id)};
}

export function sourceMap(registry){validateRegistry(registry);return new Map(registry.sources.map(x=>[x.id,x]))}

export function validateExample(row,registry){
  ensure(obj(row),'example must be object');
  const bad=forbidden(row);ensure(!bad.length,`forbidden reasoning fields: ${bad.join(', ')}`);
  ensure(/^[a-z0-9][a-z0-9._-]{2,79}$/.test(String(row.id||'')),`invalid example id ${row.id}`);
  ensure(row.schema_version==='1.0',`${row.id}: bad schema_version`);
  ensure(row.language==='ru',`${row.id}: language must be ru`);
  ensure(typeof row.user_request==='string'&&row.user_request.trim(),`${row.id}: user_request required`);
  ensure(obj(row.session_context),`${row.id}: session_context required`);
  const t=row.target;ensure(obj(t),`${row.id}: target required`);
  ensure(typeof t.intent==='string'&&t.intent,`${row.id}: intent required`);
  ensure(obj(t.hard_constraints),`${row.id}: hard_constraints required`);
  ensure(obj(t.soft_preferences),`${row.id}: soft_preferences required`);
  ensure(obj(t.shopping_plan),`${row.id}: shopping_plan required`);
  ensure(Array.isArray(t.actions),`${row.id}: actions required`);
  ensure(obj(t.critic)&&typeof t.critic.pass==='boolean'&&Array.isArray(t.critic.issues),`${row.id}: critic required`);
  ensure(obj(t.confidence),`${row.id}: confidence required`);
  for(const [k,set] of Object.entries(CONF))ensure(set.has(t.confidence[k]),`${row.id}: invalid confidence.${k}`);
  ensure(obj(row.provenance)&&Array.isArray(row.provenance.sources)&&row.provenance.sources.length,`${row.id}: provenance required`);
  const sources=sourceMap(registry);
  for(const p of row.provenance.sources){ensure(obj(p)&&sources.has(p.source_id),`${row.id}: unknown provenance source ${p?.source_id}`)}
  ensure(obj(row.review)&&['candidate','approved','rejected'].includes(row.review.status),`${row.id}: invalid review`);
  ensure(obj(row.privacy)&&row.privacy.sanitized===true&&row.privacy.contains_personal_data===false,`${row.id}: privacy gate failed`);
  return {ok:true,id:row.id};
}

export function trainingEligibility(row,registry){
  try{validateExample(row,registry)}catch(e){return {eligible:false,reasons:[e.message]}}
  const sources=sourceMap(registry),reasons=[];
  if(row.review.status!=='approved')reasons.push(`review_${row.review.status}`);
  for(const p of row.provenance.sources){const status=sources.get(p.source_id).status;if(status!=='training_allowed')reasons.push(`source_${p.source_id}_${status}`)}
  return {eligible:reasons.length===0,reasons};
}

export function exportTraining(rows,registry){
  const out=[],blocked=[];
  for(const row of rows){const e=trainingEligibility(row,registry);if(e.eligible)out.push(row);else if(row.review?.status==='approved')blocked.push({id:row.id,reasons:e.reasons})}
  ensure(!blocked.length,`approved rows blocked by provenance firewall: ${JSON.stringify(blocked)}`);
  return out;
}
