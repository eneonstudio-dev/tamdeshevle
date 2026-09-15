import {evaluateCharacterCandidate} from './bai-character-regression-evaluator.mjs';

const EMPTY_INITIATIVE=/(?:а ещё я могу|а еще я могу|хочешь,? я|хотите,? я|могу ещё|могу еще|у меня есть предложение)/i;
const NUMBER=/[-−]?\d+(?:[.,]\d+)?/g;
const CATCHPHRASES=[
  ['tak',/^\s*так[.!,:]?\s/iu],['vo',/^\s*во[.!,:]?\s/iu],['hm',/^\s*хм[.!,:]?\s/iu],['smotri',/^\s*смотри[.!,:]?\s/iu],
  ['second_quest',/втор(?:ой|ого) квест/iu],['historic_document',/исторический документ/iu],['sniff_internet',/понюхаю интернет/iu]
];
const norm=x=>String(x).replace('−','-').replace(',','.');
const nums=text=>(String(text||'').match(NUMBER)||[]).map(norm);
function collect(value,out=[]){
  if(typeof value==='number'&&Number.isFinite(value))out.push(norm(value));
  else if(typeof value==='string')out.push(...nums(value));
  else if(Array.isArray(value))value.forEach(x=>collect(x,out));
  else if(value&&typeof value==='object')Object.values(value).forEach(x=>collect(x,out));
  return out;
}

export function evaluateCharacterGateCase(scenario,candidate){
  const base=evaluateCharacterCandidate(scenario,candidate),errors=[...base.errors];
  if(!scenario||!candidate)return base;
  const expected=scenario.expected||{},reply=String(candidate.reply||''),clarification=String(candidate.clarification||'');
  const replyQuestions=(reply.match(/\?/g)||[]).length,totalQuestions=replyQuestions+(clarification.match(/\?/g)||[]).length;
  if(expected.clarification==='none'&&replyQuestions)errors.push('question_in_reply_without_clarification');
  if(expected.max_questions!=null&&totalQuestions>Number(expected.max_questions))errors.push('too_many_questions_total');
  if(expected.initiative==='none'&&EMPTY_INITIATIVE.test(reply))errors.push('empty_initiative');
  for(const fragment of Array.isArray(expected.forbidden_reply_substrings)?expected.forbidden_reply_substrings:[]){
    if(reply.toLocaleLowerCase('ru').includes(String(fragment).toLocaleLowerCase('ru')))errors.push(`forbidden_reply_claim:${fragment}`);
  }
  const verified=new Set(collect(scenario.verified_facts||{})),tracked=new Set(collect(candidate.claims||{}));
  for(const token of nums(reply)){
    if(!verified.has(token))errors.push(`unverified_numeric_mention:${token}`);
    else if(!tracked.has(token))errors.push(`untracked_numeric_claim:${token}`);
  }
  return{ok:errors.length===0,errors:[...new Set(errors)]};
}

export function evaluateCharacterGateBatch(scenarios,rows,{maxCatchphraseUses=2}={}){
  const expectedIds=new Set(scenarios.map(x=>x.id)),map=new Map(),errors=[];
  for(const row of rows||[]){
    const id=String(row?.id||'');
    if(!id){errors.push('candidate_id_missing');continue;}
    if(map.has(id)){errors.push(`duplicate_candidate:${id}`);continue;}
    map.set(id,row.candidate&&typeof row.candidate==='object'?row.candidate:row);
  }
  for(const id of expectedIds)if(!map.has(id))errors.push(`missing_candidate:${id}`);
  for(const id of map.keys())if(!expectedIds.has(id))errors.push(`unexpected_candidate:${id}`);
  const cases=scenarios.map(s=>{const c=map.get(s.id);return c?{id:s.id,...evaluateCharacterGateCase(s,c)}:{id:s.id,ok:false,errors:['candidate_missing']};});
  const counts=Object.fromEntries(CATCHPHRASES.map(([name])=>[name,0]));
  for(const candidate of map.values())for(const [name,re] of CATCHPHRASES)if(re.test(String(candidate.reply||'')))counts[name]++;
  for(const [name,count] of Object.entries(counts))if(count>maxCatchphraseUses)errors.push(`catchphrase_overuse:${name}:${count}`);
  return{ok:errors.length===0&&cases.every(x=>x.ok),errors:[...new Set(errors)],cases,catchphrase_counts:counts};
}
