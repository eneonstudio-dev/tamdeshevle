import fs from 'node:fs';

const LOOPBACK=/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i;
const REVISION=/^[0-9a-f]{40}$/i;
const clean=v=>String(v??'').trim();

export function assertProfile(profile){
  if(!profile||typeof profile!=='object')throw Error('profile required');
  if(!LOOPBACK.test(clean(profile.endpoint)))throw Error('teacher endpoint must be loopback-only');
  if(profile.enabled_by_default!==false)throw Error('teacher profile must be opt-in');
  if(!clean(profile.id)||!clean(profile.model)||!clean(profile.source_id))throw Error('profile identity incomplete');
  if(!REVISION.test(clean(profile.revision)))throw Error('teacher profile revision must be pinned');
  return profile;
}

function extractObject(text){
  const raw=String(text||'').trim();
  const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start<0||end<start)throw Error('teacher_no_json');
  const parsed=JSON.parse(raw.slice(start,end+1));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('teacher_bad_json');
  return parsed;
}

export function teacherMessages(task){
  return [{role:'system',content:'Ты локальный teacher для Bai Shopping Brain. Верни только JSON с полями intent, hard_constraints, soft_preferences, shopping_plan, actions, critic, confidence. Не выдумывай цену, наличие, магазин, состав или качество. Hard constraints не ослабляй.'},{role:'user',content:JSON.stringify({user_request:task.user_request,session_context:task.session_context,guards:task.guards})}];
}

export async function runTask({task,profile,fetchImpl=globalThis.fetch}){
  assertProfile(profile);
  if(typeof fetchImpl!=='function')throw Error('fetch implementation required');
  const response=await fetchImpl(`${profile.endpoint}/v1/chat/completions`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:profile.model,messages:teacherMessages(task),temperature:Number(profile.temperature)||0,max_tokens:Number(profile.max_tokens)||1200})});
  if(!response?.ok)throw Error(`teacher_http_${response?.status||0}`);
  const body=await response.json();
  const output=extractObject(body?.choices?.[0]?.message?.content);
  return {task_id:task.id,profile_id:profile.id,model:profile.model,revision:profile.revision,output};
}

export async function runBatch({tasks,profile,fetchImpl=globalThis.fetch,onProgress}){
  assertProfile(profile);
  const results=[],errors=[];
  for(let i=0;i<tasks.length;i++){
    const task=tasks[i];
    try{results.push(await runTask({task,profile,fetchImpl}))}catch(error){errors.push({task_id:task?.id||null,error:String(error?.message||error)})}
    if(typeof onProgress==='function')onProgress({done:i+1,total:tasks.length,errors:errors.length});
  }
  return {profile_id:profile.id,model:profile.model,revision:profile.revision,results,errors};
}

function readJsonl(file){return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse)}

if(import.meta.url===`file://${process.argv[1]}`){
  const [profileFile,batchFile,outFile]=process.argv.slice(2);
  if(!profileFile||!batchFile||!outFile)throw Error('usage: node run-local-batch.mjs PROFILE BATCH_JSONL OUT_JSON');
  const profile=JSON.parse(fs.readFileSync(profileFile,'utf8')),tasks=readJsonl(batchFile);
  const result=await runBatch({tasks,profile,onProgress:p=>console.error(`${p.done}/${p.total} errors=${p.errors}`)});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({profile_id:result.profile_id,revision:result.revision,results:result.results.length,errors:result.errors.length}));
}
