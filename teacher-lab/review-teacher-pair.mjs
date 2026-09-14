import fs from 'node:fs';
import path from 'node:path';
import {buildCorpus} from './corpus-builder.mjs';
import {importTeacherResults,buildReviewQueue} from './candidate-import.mjs';
import {buildConsensusQueue} from './teacher-consensus.mjs';
import {contractCriticFlags} from './teacher-contract-critic.mjs';

const here=new URL('./',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const jsonl=rows=>rows.map(x=>JSON.stringify(x)).join('\n')+'\n';
const taskId=row=>row?.provenance?.sources?.[0]?.corpus_task_id||null;

export function buildTeacherReview({leftRun,rightRun,leftProfile,rightProfile,registry,tasks=buildCorpus()}){
  const leftRows=Array.isArray(leftRun?.results)?leftRun.results:[];
  const rightRows=Array.isArray(rightRun?.results)?rightRun.results:[];
  const left=importTeacherResults({rows:leftRows,tasks,profile:leftProfile,registry});
  const right=importTeacherResults({rows:rightRows,tasks,profile:rightProfile,registry});
  const consensus=buildConsensusQueue(left.candidates,right.candidates);
  const leftReview=buildReviewQueue(left.candidates),rightReview=buildReviewQueue(right.candidates);
  const reviewByTask=new Map(),contractByTask=new Map();
  for(const item of [...leftReview,...rightReview]){
    const current=reviewByTask.get(item.task_id)||new Set();
    for(const flag of item.flags||[])current.add(flag);
    reviewByTask.set(item.task_id,current);
  }
  for(const [side,candidates] of [['left',left.candidates],['right',right.candidates]]){
    for(const candidate of candidates){
      const id=taskId(candidate),current=contractByTask.get(id)||[];
      for(const flag of contractCriticFlags(candidate))current.push(`${side}_contract:${flag}`);
      contractByTask.set(id,current);
    }
  }
  const queue=consensus.map(item=>{
    const contractFlags=[...new Set(contractByTask.get(item.task_id)||[])];
    const contractBad=contractFlags.length>0;
    const conflicts=[...new Set([...(item.conflicts||[]),...(contractBad?['contract_violation']:[])])];
    return {
      ...item,
      status:item.status==='missing_teacher'?'missing_teacher':contractBad?'conflict':item.status,
      requires_review:item.requires_review||contractBad,
      conflicts,
      flags:[...new Set([...conflicts,...(reviewByTask.get(item.task_id)||[]),...contractFlags])],
      decision:'pending_review'
    };
  });
  const summary={
    left_candidates:left.candidates.length,right_candidates:right.candidates.length,
    left_rejected:left.rejected.length,right_rejected:right.rejected.length,
    compared:queue.length,agreements:queue.filter(x=>x.status==='agree').length,
    conflicts:queue.filter(x=>x.status==='conflict').length,missing:queue.filter(x=>x.status==='missing_teacher').length,
    contract_violations:queue.filter(x=>(x.conflicts||[]).includes('contract_violation')).length,
    auto_approved:0
  };
  return {left,right,queue,summary};
}

export function writeTeacherReview(result,outDir){
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'left-candidates.jsonl'),jsonl(result.left.candidates));
  fs.writeFileSync(path.join(outDir,'right-candidates.jsonl'),jsonl(result.right.candidates));
  fs.writeFileSync(path.join(outDir,'review-queue.json'),JSON.stringify(result.queue,null,2)+'\n');
  fs.writeFileSync(path.join(outDir,'summary.json'),JSON.stringify(result.summary,null,2)+'\n');
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [leftRunFile,rightRunFile,outDir]=process.argv.slice(2);
  if(!leftRunFile||!rightRunFile||!outDir)throw Error('usage: node review-teacher-pair.mjs LEFT_RUN RIGHT_RUN OUT_DIR');
  const registry=read('sources.json'),leftProfile=read('profiles/deepseek-r1-distill-qwen-7b.json'),rightProfile=read('profiles/qwen3-8b.json');
  const result=buildTeacherReview({leftRun:JSON.parse(fs.readFileSync(leftRunFile,'utf8')),rightRun:JSON.parse(fs.readFileSync(rightRunFile,'utf8')),leftProfile,rightProfile,registry});
  writeTeacherReview(result,outDir);console.log(JSON.stringify(result.summary));
}
