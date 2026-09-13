import fs from 'node:fs';
import path from 'node:path';
import {buildCorpus} from './corpus-builder.mjs';
import {importTeacherResults,buildReviewQueue} from './candidate-import.mjs';
import {buildConsensusQueue} from './teacher-consensus.mjs';

const here=new URL('./',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const jsonl=rows=>rows.map(x=>JSON.stringify(x)).join('\n')+'\n';

export function buildTeacherReview({leftRun,rightRun,leftProfile,rightProfile,registry,tasks=buildCorpus()}){
  const leftRows=Array.isArray(leftRun?.results)?leftRun.results:[];
  const rightRows=Array.isArray(rightRun?.results)?rightRun.results:[];
  const left=importTeacherResults({rows:leftRows,tasks,profile:leftProfile,registry});
  const right=importTeacherResults({rows:rightRows,tasks,profile:rightProfile,registry});
  const consensus=buildConsensusQueue(left.candidates,right.candidates);
  const leftReview=buildReviewQueue(left.candidates),rightReview=buildReviewQueue(right.candidates);
  const reviewByTask=new Map();
  for(const item of [...leftReview,...rightReview]){
    const current=reviewByTask.get(item.task_id)||new Set();
    for(const flag of item.flags||[])current.add(flag);
    reviewByTask.set(item.task_id,current);
  }
  const queue=consensus.map(item=>({
    ...item,
    flags:[...new Set([...(item.conflicts||[]),...(reviewByTask.get(item.task_id)||[])])],
    decision:'pending_review'
  }));
  const summary={
    left_candidates:left.candidates.length,right_candidates:right.candidates.length,
    left_rejected:left.rejected.length,right_rejected:right.rejected.length,
    compared:queue.length,agreements:queue.filter(x=>x.status==='agree').length,
    conflicts:queue.filter(x=>x.status==='conflict').length,missing:queue.filter(x=>x.status==='missing_teacher').length,
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
