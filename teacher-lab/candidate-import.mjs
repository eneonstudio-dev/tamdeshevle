import {validateExample,sourceMap} from './firewall.mjs';

const clone=v=>JSON.parse(JSON.stringify(v));
const allowedOverall=new Set(['low','medium','high']);
const forbidden=new Set(['chain_of_thought','reasoning','hidden_reasoning','scratchpad','cot']);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

function hasForbidden(value){
  if(Array.isArray(value))return value.some(hasForbidden);
  if(!value||typeof value!=='object')return false;
  return Object.entries(value).some(([k,v])=>forbidden.has(k.toLowerCase())||hasForbidden(v));
}

function normalizeTarget(output){
  const x=output&&typeof output==='object'&&!Array.isArray(output)?output:{};
  const critic=x.critic&&typeof x.critic==='object'?x.critic:{};
  const confidence=x.confidence&&typeof x.confidence==='object'?x.confidence:{};
  return {
    intent:clean(x.intent),
    hard_constraints:x.hard_constraints&&typeof x.hard_constraints==='object'?clone(x.hard_constraints):{},
    soft_preferences:x.soft_preferences&&typeof x.soft_preferences==='object'?clone(x.soft_preferences):{},
    shopping_plan:x.shopping_plan&&typeof x.shopping_plan==='object'?clone(x.shopping_plan):{},
    actions:Array.isArray(x.actions)?clone(x.actions.slice(0,20)):[],
    critic:{pass:critic.pass===true,issues:Array.isArray(critic.issues)?critic.issues.map(v=>clean(v)).filter(Boolean).slice(0,12):[]},
    confidence:{overall:allowedOverall.has(confidence.overall)?confidence.overall:'low',price:'unknown',availability:'unknown',quality:'unknown'}
  };
}

export function importTeacherResults({rows,tasks,profile,registry}){
  const sources=sourceMap(registry),source=sources.get(profile?.source_id);
  if(!source||source.status!=='training_allowed')throw Error('profile source is not training_allowed');
  if(profile?.enabled_by_default!==false)throw Error('teacher profile must be opt-in');
  if(!/^[0-9a-f]{40}$/i.test(clean(profile?.revision)))throw Error('teacher profile revision must be pinned');
  const taskMap=new Map((Array.isArray(tasks)?tasks:[]).map(x=>[x.id,x]));
  const seen=new Set(),candidates=[],rejected=[];
  for(const raw of Array.isArray(rows)?rows:[]){
    const taskId=clean(raw?.task_id),profileId=clean(raw?.profile_id);
    try{
      if(!taskMap.has(taskId))throw Error('unknown_task');
      if(seen.has(taskId))throw Error('duplicate_task');
      if(profileId!==profile.id)throw Error('profile_mismatch');
      if(clean(raw?.model)!==clean(profile.model))throw Error('model_mismatch');
      if(clean(raw?.revision)!==clean(profile.revision))throw Error('revision_mismatch');
      if(hasForbidden(raw?.output))throw Error('forbidden_reasoning_field');
      seen.add(taskId);
      const task=taskMap.get(taskId),candidate={
        id:`${taskId}.${profile.id}`.slice(0,80),schema_version:'1.0',language:'ru',user_request:task.user_request,
        session_context:clone(task.session_context||{}),target:normalizeTarget(raw.output),
        provenance:{sources:[{source_id:profile.source_id,model:profile.model,revision:profile.revision,profile_id:profile.id,corpus_task_id:taskId}]},
        review:{status:'candidate'},privacy:{sanitized:true,contains_personal_data:false},
        evaluation:{category:task.category,scenario_id:task.scenario_id||null,turn:task.turn||null,expected:clone(task.expected||{})}
      };
      validateExample(candidate,registry);candidates.push(candidate);
    }catch(error){rejected.push({task_id:taskId||null,reason:String(error?.message||error)})}
  }
  return {candidates,rejected};
}

export function buildReviewQueue(candidates){
  return (Array.isArray(candidates)?candidates:[]).map(row=>{
    const flags=[],expected=row.evaluation?.expected||{};
    if(expected.intent_family&&row.target?.intent!==expected.intent_family)flags.push('intent_mismatch');
    if(row.target?.critic?.pass!==true)flags.push('critic_failed');
    if(row.target?.confidence?.overall==='low')flags.push('low_confidence');
    if(Array.isArray(expected.must_retain)&&expected.must_retain.length)flags.push('check_context_retention');
    return {id:row.id,task_id:row.provenance?.sources?.[0]?.corpus_task_id||null,priority:flags.length?'review':'normal',flags};
  });
}

export function candidatePrediction(row){
  return {id:row.provenance?.sources?.[0]?.corpus_task_id||row.id,intent:row.target?.intent||'',hard_constraints:clone(row.target?.hard_constraints||{}),actions:clone(row.target?.actions||[]),critic:clone(row.target?.critic||{}),repair_attempted:false};
}
