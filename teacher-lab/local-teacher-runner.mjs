import { validateExample } from './firewall.mjs';

const LOOPBACK=/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i;
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();

export function assertLocalEndpoint(endpoint){
  const value=String(endpoint||'').trim();
  if(!LOOPBACK.test(value))throw Error('teacher endpoint must be loopback-only');
  return value.replace(/\/$/,'');
}

export function teacherPrompt(example){
  return [
    'You are a shopping-intent teacher for Votonobay.',
    'Return only one JSON object. No markdown and no explanations.',
    'Infer the shopping intent, hard constraints, soft preferences, shopping plan, actions, critic result and confidence.',
    'Do not invent prices, availability, stores, product composition or quality facts that are not present in the input.',
    'Hard constraints must never be weakened for a nicer basket.',
    `INPUT=${JSON.stringify({user_request:example.user_request,session_context:example.session_context})}`,
    'OUTPUT_KEYS=intent,hard_constraints,soft_preferences,shopping_plan,actions,critic,confidence'
  ].join('\n');
}

function extractJson(text){
  const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const a=raw.indexOf('{'),b=raw.lastIndexOf('}');
  if(a<0||b<a)throw Error('teacher returned no JSON object');
  return JSON.parse(raw.slice(a,b+1));
}

export function toCandidate(example,teacherOutput,{sourceId,model}){
  const target=teacherOutput&&typeof teacherOutput==='object'&&!Array.isArray(teacherOutput)?teacherOutput:{};
  return {
    id:`${example.id}.${String(sourceId).replace(/[^a-z0-9_-]/gi,'_')}`.slice(0,80),
    schema_version:'1.0',language:'ru',
    user_request:clean(example.user_request),
    session_context:example.session_context||{},
    target:{
      intent:clean(target.intent),
      hard_constraints:target.hard_constraints||{},
      soft_preferences:target.soft_preferences||{},
      shopping_plan:target.shopping_plan||{},
      actions:Array.isArray(target.actions)?target.actions:[],
      critic:target.critic||{pass:false,issues:['teacher_missing_critic']},
      confidence:target.confidence||{overall:'low',price:'unknown',availability:'unknown',quality:'unknown'}
    },
    provenance:{sources:[{source_id:sourceId,model:clean(model),role:'teacher'}]},
    review:{status:'candidate'},
    privacy:{sanitized:true,contains_personal_data:false}
  };
}

export async function runLocalTeacher({endpoint,model,sourceId,example,registry,fetchImpl=globalThis.fetch}){
  const base=assertLocalEndpoint(endpoint);
  if(typeof fetchImpl!=='function')throw Error('fetch implementation required');
  const response=await fetchImpl(`${base}/v1/chat/completions`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({model,messages:[{role:'system',content:teacherPrompt(example)}],temperature:0,max_tokens:900})
  });
  if(!response?.ok)throw Error(`teacher_http_${response?.status||0}`);
  const body=await response.json();
  const output=extractJson(body?.choices?.[0]?.message?.content);
  const candidate=toCandidate(example,output,{sourceId,model});
  validateExample(candidate,registry);
  return candidate;
}
