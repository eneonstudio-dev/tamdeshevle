import crypto from 'node:crypto';
import fs from 'node:fs';
import {runTrainingBatch} from './student-teacher-loop.mjs';

const LOOPBACK=/^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i;
const GIT_REV=/^[0-9a-f]{40}$/i;
const SHA256=/^[0-9a-f]{64}$/i;
const STUDENT_PROMPT='bai-shopping-student-eval-v1';
const CRITIC_PROMPT='bai-shopping-independent-critic-v1';
const clean=value=>String(value??'').trim();
const stable=value=>{
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');

export function assertLocalModelProfile(profile,role){
  if(!profile||typeof profile!=='object')throw Error(`${role}_profile_required`);
  if(!LOOPBACK.test(clean(profile.endpoint)))throw Error(`${role}_endpoint_must_be_loopback`);
  if(profile.enabled_by_default!==false)throw Error(`${role}_profile_must_be_opt_in`);
  if(!clean(profile.id)||!clean(profile.model))throw Error(`${role}_profile_identity_incomplete`);
  const revision=clean(profile.revision),checkpoint=clean(profile.checkpoint_sha256);
  if(!GIT_REV.test(revision)&&!SHA256.test(checkpoint))throw Error(`${role}_profile_must_be_pinned`);
  return profile;
}

function extractObject(text){
  const raw=clean(text),start=raw.indexOf('{'),end=raw.lastIndexOf('}');
  if(start<0||end<start)throw Error('local_model_no_json');
  const parsed=JSON.parse(raw.slice(start,end+1));
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('local_model_bad_json');
  return parsed;
}

function generation(profile){
  return {temperature:Number.isFinite(Number(profile.temperature))?Number(profile.temperature):0,max_tokens:Number(profile.max_tokens)||1200};
}

function descriptor(profile,role,promptVersion){
  const pin=clean(profile.revision)||clean(profile.checkpoint_sha256);
  const runtime={role,transport:'openai_compatible_local',endpoint:profile.endpoint,profile_id:profile.id,model:profile.model,pin,prompt_version:promptVersion,generation:generation(profile)};
  return {...runtime,runtime_fingerprint:sha(runtime)};
}

async function callLocal({profile,role,promptVersion,messages,fetchImpl}){
  assertLocalModelProfile(profile,role);
  if(typeof fetchImpl!=='function')throw Error('fetch_implementation_required');
  const gen=generation(profile);
  const response=await fetchImpl(`${profile.endpoint}/v1/chat/completions`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({model:profile.model,messages,temperature:gen.temperature,max_tokens:gen.max_tokens})
  });
  if(!response?.ok)throw Error(`${role}_http_${response?.status||0}`);
  const body=await response.json();
  return extractObject(body?.choices?.[0]?.message?.content);
}

function studentMessages(input){
  const payload={
    mode:input.mode,
    attempt:input.attempt,
    task:{user_request:input.task?.user_request,session_context:input.task?.session_context,guards:input.task?.guards},
    prior_output:input.prior_output,
    repair_feedback:input.feedback
  };
  return [
    {role:'system',content:'Ты Bai Shopping Brain в offline eval. Верни только JSON: intent, hard_constraints, soft_preferences, shopping_plan, actions, critic, confidence. Выполняй shopping-задачу сам. Не проси и не угадывай teacher target. Не выдумывай price, availability, store, composition или quality. Не показывай chain-of-thought.'},
    {role:'user',content:JSON.stringify(payload)}
  ];
}

function criticMessages(input){
  const payload={
    task:{user_request:input.task?.user_request,session_context:input.task?.session_context,guards:input.task?.guards},
    teacher_target:input.teacher_output,
    bai_output:input.bay_output,
    deterministic:input.deterministic,
    attempt:input.attempt
  };
  return [
    {role:'system',content:'Ты независимый critic Bai Shopping Brain. Сравни Bai с reviewed teacher target и deterministic checks. Верни только JSON {"pass":boolean,"reasons":[string],"feedback":string}. Deterministic failure нельзя отменять. Не пиши исправленный teacher answer и не раскрывай chain-of-thought; feedback должен описывать только тип ошибки.'},
    {role:'user',content:JSON.stringify(payload)}
  ];
}

export function makeLocalBayRunner({profile,fetchImpl=globalThis.fetch}){
  assertLocalModelProfile(profile,'student');
  return async input=>callLocal({profile,role:'student',promptVersion:STUDENT_PROMPT,messages:studentMessages(input),fetchImpl});
}

export function makeLocalCriticRunner({profile,fetchImpl=globalThis.fetch}){
  assertLocalModelProfile(profile,'critic');
  return async input=>callLocal({profile,role:'critic',promptVersion:CRITIC_PROMPT,messages:criticMessages(input),fetchImpl});
}

export async function runLocalStudentLoop({tasks,teacherResults,studentProfile,criticProfile,maxRepairs=2,fetchImpl=globalThis.fetch,onProgress}){
  assertLocalModelProfile(studentProfile,'student');
  assertLocalModelProfile(criticProfile,'critic');
  const student=descriptor(studentProfile,'student',STUDENT_PROMPT),critic=descriptor(criticProfile,'critic',CRITIC_PROMPT);
  const result=await runTrainingBatch({
    tasks,teacherResults,maxRepairs,onProgress,
    bayRunner:makeLocalBayRunner({profile:studentProfile,fetchImpl}),
    criticRunner:makeLocalCriticRunner({profile:criticProfile,fetchImpl})
  });
  for(const row of result.results){
    row.learning_record.provenance.student={profile_id:student.profile_id,model:student.model,pin:student.pin,runtime_fingerprint:student.runtime_fingerprint};
    row.learning_record.provenance.critic={profile_id:critic.profile_id,model:critic.model,pin:critic.pin,runtime_fingerprint:critic.runtime_fingerprint};
  }
  result.regression_candidates=result.results.filter(row=>!row.pass).map(row=>row.learning_record);
  result.review_candidates=result.results.map(row=>row.learning_record);
  return {runtime:{student,critic},...result};
}

function readJsonl(file){return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse)}
function readTeacherResults(file){const raw=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(raw)?raw:Array.isArray(raw?.results)?raw.results:[]}

if(import.meta.url===`file://${process.argv[1]}`){
  const [tasksFile,teacherFile,studentProfileFile,criticProfileFile,outFile,maxRepairsRaw]=process.argv.slice(2);
  if(!tasksFile||!teacherFile||!studentProfileFile||!criticProfileFile||!outFile){
    throw Error('usage: node run-local-student-loop.mjs TASKS_JSONL TEACHER_RESULTS_JSON STUDENT_PROFILE_JSON CRITIC_PROFILE_JSON OUT_JSON [MAX_REPAIRS]');
  }
  const tasks=readJsonl(tasksFile),teacherResults=readTeacherResults(teacherFile);
  const studentProfile=JSON.parse(fs.readFileSync(studentProfileFile,'utf8')),criticProfile=JSON.parse(fs.readFileSync(criticProfileFile,'utf8'));
  const result=await runLocalStudentLoop({tasks,teacherResults,studentProfile,criticProfile,maxRepairs:Number(maxRepairsRaw??2),onProgress:p=>console.error(`${p.done}/${p.total} errors=${p.errors}`)});
  fs.writeFileSync(outFile,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({evaluated:result.summary.evaluated,passed:result.summary.passed,repaired:result.summary.repaired,failed:result.summary.failed,errors:result.summary.errors,student_fingerprint:result.runtime.student.runtime_fingerprint,critic_fingerprint:result.runtime.critic.runtime_fingerprint}));
}
