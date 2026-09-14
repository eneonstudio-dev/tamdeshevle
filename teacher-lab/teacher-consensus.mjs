const canonical=value=>{
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value??null);
};
const hasOwn=(obj,key)=>Boolean(obj&&Object.prototype.hasOwnProperty.call(obj,key));
const actionKeys=row=>(row?.target?.actions||[]).map(a=>{
  const type=String(a?.type||'');
  if(hasOwn(a,'payload'))return `${type}:payload:${canonical(a.payload)}`;
  return `${type}:missing_payload:${canonical(a?.value??null)}`;
}).sort();
const taskId=row=>row?.provenance?.sources?.[0]?.corpus_task_id||null;

export function comparePair(a,b){
  if(!a||!b)throw Error('two candidates required');
  if(taskId(a)!==taskId(b))throw Error('task mismatch');
  const checks={
    intent:String(a.target?.intent||'')===String(b.target?.intent||''),
    hard_constraints:canonical(a.target?.hard_constraints||{})===canonical(b.target?.hard_constraints||{}),
    soft_preferences:canonical(a.target?.soft_preferences||{})===canonical(b.target?.soft_preferences||{}),
    actions:JSON.stringify(actionKeys(a))===JSON.stringify(actionKeys(b))
  };
  const conflicts=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return {task_id:taskId(a),pass:conflicts.length===0,requires_review:conflicts.length>0,conflicts,checks};
}

export function buildConsensusQueue(left,right){
  const bMap=new Map((Array.isArray(right)?right:[]).map(x=>[taskId(x),x]));
  const queue=[];
  for(const a of Array.isArray(left)?left:[]){
    const id=taskId(a),b=bMap.get(id);
    if(!b){queue.push({task_id:id,status:'missing_teacher',requires_review:true,conflicts:['missing_teacher']});continue}
    const comparison=comparePair(a,b);
    queue.push({...comparison,status:comparison.pass?'agree':'conflict'});
  }
  return queue;
}
