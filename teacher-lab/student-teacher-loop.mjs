import crypto from 'node:crypto';

const clone=value=>JSON.parse(JSON.stringify(value));
const stable=value=>{
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const sha=value=>crypto.createHash('sha256').update(typeof value==='string'?value:stable(value)).digest('hex');
const clean=value=>String(value??'').trim();
const array=value=>Array.isArray(value)?value:[];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};

function canonicalConstraint(value){
  if(Array.isArray(value))return [...new Set(value.map(x=>clean(x)).filter(Boolean))].sort();
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,value[key]]));
  return value;
}

function constraintContains(expected,actual){
  if(Array.isArray(expected)){
    const got=new Set(array(actual).map(x=>clean(x)));
    return expected.every(item=>got.has(clean(item)));
  }
  if(expected&&typeof expected==='object'){
    const got=object(actual);
    return Object.entries(expected).every(([key,value])=>stable(value)===stable(got[key]));
  }
  return stable(expected)===stable(actual);
}

function actionKey(action){
  const a=object(action);
  return `${clean(a.type).toLowerCase()}:${stable(a.payload??a.value??null)}`;
}

function scanForbiddenFacts(value,forbidden,path='$',hits=[]){
  if(Array.isArray(value)){
    value.forEach((item,index)=>scanForbiddenFacts(item,forbidden,`${path}[${index}]`,hits));
    return hits;
  }
  if(!value||typeof value!=='object')return hits;
  for(const [key,item] of Object.entries(value)){
    const next=`${path}.${key}`;
    if(forbidden.has(key.toLowerCase())&&item!==null&&item!==undefined&&item!=='')hits.push(next);
    scanForbiddenFacts(item,forbidden,next,hits);
  }
  return hits;
}

export function deterministicJudge({task,teacherOutput,bayOutput}){
  const teacher=object(teacherOutput),bay=object(bayOutput),failures=[];
  if(!Object.keys(bay).length)failures.push('student_output_missing');

  if(teacher.intent!==undefined&&stable(teacher.intent)!==stable(bay.intent))failures.push('intent_mismatch');

  if(teacher.hard_constraints!==undefined&&!constraintContains(canonicalConstraint(teacher.hard_constraints),canonicalConstraint(bay.hard_constraints))){
    failures.push('hard_constraints_mismatch');
  }

  const expectedActions=array(teacher.actions).map(actionKey).filter(Boolean);
  const actualActions=new Set(array(bay.actions).map(actionKey));
  if(expectedActions.some(key=>!actualActions.has(key)))failures.push('required_actions_missing');

  const retained=array(task?.expected?.must_retain).map(clean).filter(Boolean);
  if(retained.length){
    const actual=bay.hard_constraints;
    const ok=Array.isArray(actual)
      ? retained.every(item=>new Set(actual.map(clean)).has(item))
      : retained.every(item=>Object.values(object(actual)).some(value=>clean(value)===item)||Object.keys(object(actual)).some(key=>`${key}:${clean(actual[key])}`===item));
    if(!ok)failures.push('context_constraints_lost');
  }

  const forbidden=new Set(array(task?.guards?.forbid_fabrication).map(x=>clean(x).toLowerCase()).filter(Boolean));
  const fabricated=forbidden.size?scanForbiddenFacts(bay,forbidden):[];
  if(fabricated.length)failures.push('unverified_facts_present');

  return {
    pass:failures.length===0,
    failures,
    checks:{
      intent:!failures.includes('intent_mismatch'),
      hard_constraints:!failures.includes('hard_constraints_mismatch')&&!failures.includes('context_constraints_lost'),
      actions:!failures.includes('required_actions_missing'),
      truth_guard:!failures.includes('unverified_facts_present')
    },
    forbidden_fact_paths:fabricated
  };
}

function criticVerdict(raw,deterministic){
  const value=object(raw);
  const reasons=array(value.reasons).map(clean).filter(Boolean).slice(0,12);
  const criticPass=value.pass===true;
  return {
    pass:deterministic.pass&&criticPass,
    reasons:[...new Set([...deterministic.failures,...reasons])],
    feedback:clean(value.feedback).slice(0,1200)
  };
}

function safeFeedback(verdict){
  return {
    failures:[...verdict.reasons],
    instruction:'Исправь только перечисленные типы ошибок. Не ослабляй hard constraints и не выдумывай price/availability/store/composition/quality. Эталон teacher тебе не предоставляется.'
  };
}

function learningRecord({task,teacherOutput,finalOutput,verdict,attempts}){
  const pass=verdict.pass===true;
  return {
    schema_version:'1.0',
    kind:pass?'teacher_student_success':'teacher_student_regression_candidate',
    id:`${clean(task?.id)||'case'}:${sha({task_id:task?.id,teacherOutput,finalOutput}).slice(0,16)}`,
    task_id:clean(task?.id)||null,
    user_request:clean(task?.user_request).slice(0,2000),
    session_context:clone(object(task?.session_context)),
    guards:clone(object(task?.guards)),
    expected:{
      intent:clone(teacherOutput?.intent??null),
      hard_constraints:clone(teacherOutput?.hard_constraints??null),
      actions:clone(array(teacherOutput?.actions))
    },
    observed:clone(object(finalOutput)),
    outcome:{pass,reasons:[...verdict.reasons],attempts},
    review:{status:'pending',requires_human_review:true},
    training_allowed:false,
    provenance:{source:'offline_teacher_student_loop',teacher_target_sha256:sha(teacherOutput),student_output_sha256:sha(finalOutput)}
  };
}

export async function runTrainingCase({task,teacherOutput,bayRunner,criticRunner,maxRepairs=2}){
  if(!task||typeof task!=='object')throw Error('task required');
  if(!teacherOutput||typeof teacherOutput!=='object')throw Error('teacher output required');
  if(typeof bayRunner!=='function')throw Error('bayRunner required');
  if(typeof criticRunner!=='function')throw Error('criticRunner required');
  const limit=Math.max(0,Math.min(3,Number(maxRepairs)||0));
  const attempts=[];
  let prior=null,feedback=null,finalVerdict=null;

  for(let attempt=0;attempt<=limit;attempt++){
    const bayOutput=await bayRunner({
      task:clone(task),
      attempt,
      mode:attempt===0?'initial':'repair',
      prior_output:prior?clone(prior):null,
      feedback:feedback?clone(feedback):null
    });
    const deterministic=deterministicJudge({task,teacherOutput,bayOutput});
    const criticRaw=await criticRunner({task:clone(task),teacher_output:clone(teacherOutput),bay_output:clone(object(bayOutput)),deterministic:clone(deterministic),attempt});
    const verdict=criticVerdict(criticRaw,deterministic);
    attempts.push({attempt,output:clone(object(bayOutput)),deterministic,critic:{pass:criticRaw?.pass===true,reasons:array(criticRaw?.reasons).map(clean).filter(Boolean),feedback:clean(criticRaw?.feedback)},verdict});
    prior=object(bayOutput);finalVerdict=verdict;
    if(verdict.pass)break;
    feedback=safeFeedback(verdict);
  }

  const final=attempts.at(-1);
  const record=learningRecord({task,teacherOutput,finalOutput:final?.output||{},verdict:finalVerdict||{pass:false,reasons:['no_attempt']},attempts:attempts.length});
  return {
    task_id:task.id,
    pass:finalVerdict?.pass===true,
    repaired:attempts.length>1&&finalVerdict?.pass===true,
    attempts,
    final_output:clone(final?.output||{}),
    final_verdict:clone(finalVerdict||{pass:false,reasons:['no_attempt']}),
    learning_record:record
  };
}

export async function runTrainingBatch({tasks,teacherResults,bayRunner,criticRunner,maxRepairs=2,onProgress}){
  const taskList=array(tasks),teacherById=new Map(array(teacherResults).map(row=>[clean(row?.task_id||row?.id),row?.output||row?.target||row]));
  const results=[],errors=[];
  for(let index=0;index<taskList.length;index++){
    const task=taskList[index],teacherOutput=teacherById.get(clean(task?.id));
    try{
      if(!teacherOutput)throw Error('teacher_target_missing');
      results.push(await runTrainingCase({task,teacherOutput,bayRunner,criticRunner,maxRepairs}));
    }catch(error){
      errors.push({task_id:task?.id||null,error:String(error?.message||error)});
    }
    if(typeof onProgress==='function')onProgress({done:index+1,total:taskList.length,errors:errors.length});
  }
  const passed=results.filter(row=>row.pass).length,repaired=results.filter(row=>row.repaired).length;
  return {
    schema_version:'1.0',
    summary:{total:taskList.length,evaluated:results.length,passed,repaired,failed:results.length-passed,errors:errors.length,pass_rate:results.length?Number((passed/results.length).toFixed(4)):null},
    results,
    errors,
    regression_candidates:results.filter(row=>!row.pass).map(row=>row.learning_record),
    review_candidates:results.map(row=>row.learning_record)
  };
}
