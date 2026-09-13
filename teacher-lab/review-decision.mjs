import {validateExample} from './firewall.mjs';

const clone=v=>JSON.parse(JSON.stringify(v));
const clean=v=>String(v??'').trim();
const taskId=row=>row?.provenance?.sources?.[0]?.corpus_task_id||null;
const index=rows=>new Map((Array.isArray(rows)?rows:[]).map(x=>[taskId(x),x]));

export function buildReviewPacket({left,right,queue}){
  const lm=index(left),rm=index(right);
  return (Array.isArray(queue)?queue:[]).map(item=>({
    task_id:item.task_id,status:item.status,conflicts:[...(item.conflicts||[])],flags:[...(item.flags||[])],
    left:lm.get(item.task_id)?clone(lm.get(item.task_id).target):null,
    right:rm.get(item.task_id)?clone(rm.get(item.task_id).target):null,
    decision:'pending_review'
  }));
}

function addHumanProvenance(row,decision){
  const out=clone(row),sources=Array.isArray(out.provenance?.sources)?out.provenance.sources:[];
  if(!sources.some(x=>x.source_id==='human_votonobay_reviewed'))sources.push({source_id:'human_votonobay_reviewed',model:'human-reviewed',reviewer:clean(decision.reviewer)||'operator'});
  out.provenance={...(out.provenance||{}),sources,reviewed_at:clean(decision.reviewed_at)||null};
  return out;
}

export function applyReviewDecisions({left,right,queue,decisions,registry}){
  const lm=index(left),rm=index(right),dm=new Map((Array.isArray(decisions)?decisions:[]).map(x=>[clean(x.task_id),x]));
  const approved=[],rejected=[],pending=[];
  for(const item of Array.isArray(queue)?queue:[]){
    const d=dm.get(item.task_id);
    if(!d){pending.push({task_id:item.task_id,reason:'missing_decision'});continue}
    if(!clean(d.reviewer)){pending.push({task_id:item.task_id,reason:'missing_reviewer'});continue}
    if(d.decision==='reject'){rejected.push({task_id:item.task_id,note:clean(d.note)});continue}
    let row=null;
    if(d.decision==='approve_left')row=lm.get(item.task_id);
    else if(d.decision==='approve_right')row=rm.get(item.task_id);
    else if(d.decision==='approve_edited'){
      const base=lm.get(item.task_id)||rm.get(item.task_id);
      if(base&&d.edited_target&&typeof d.edited_target==='object')row={...clone(base),target:clone(d.edited_target)};
    }
    if(!row){pending.push({task_id:item.task_id,reason:'invalid_decision'});continue}
    row=addHumanProvenance(row,d);row.review={status:'approved',reviewer:clean(d.reviewer),note:clean(d.note)};
    try{validateExample(row,registry);approved.push(row)}catch(e){pending.push({task_id:item.task_id,reason:`validation:${e.message}`})}
  }
  return {approved,rejected,pending,summary:{approved:approved.length,rejected:rejected.length,pending:pending.length,total:(queue||[]).length}};
}

export function mergeApprovedGold(existing,incoming){
  const byId=new Map();
  for(const row of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(incoming)?incoming:[])]){
    if(row?.id&&row?.review?.status==='approved')byId.set(row.id,clone(row));
  }
  return [...byId.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
}
