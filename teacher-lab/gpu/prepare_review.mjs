import fs from 'node:fs';
import path from 'node:path';
import {buildCorpus} from '../corpus-builder.mjs';
import {shardCorpus} from '../batch-manifest.mjs';
import {buildTeacherReview,writeTeacherReview} from '../review-teacher-pair.mjs';

const here=new URL('../',import.meta.url);
const readJson=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const readJsonl=file=>fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));

export function batchTasks(batchIndex){
  const all=buildCorpus();
  if(!batchIndex)return all;
  const batches=shardCorpus(all,64),batch=batches[Number(batchIndex)-1];
  if(!batch)throw Error(`invalid batch index ${batchIndex}`);
  return batch.jsonl.trim().split('\n').filter(Boolean).map(JSON.parse);
}

export function prepareReview({runDir,outDir,batchIndex=0}){
  const registry=readJson('sources.json');
  const leftProfile=readJson('profiles/deepseek-r1-distill-qwen-7b.json');
  const rightProfile=readJson('profiles/qwen3-8b.json');
  const tasks=batchTasks(batchIndex),ids=new Set(tasks.map(x=>x.id));
  const leftRows=readJsonl(path.join(runDir,'deepseek_r1_distill_qwen_7b.jsonl')).filter(x=>x.ok===true&&ids.has(x.task_id));
  const rightRows=readJsonl(path.join(runDir,'qwen3_8b.jsonl')).filter(x=>x.ok===true&&ids.has(x.task_id));
  const result=buildTeacherReview({leftRun:{results:leftRows},rightRun:{results:rightRows},leftProfile,rightProfile,registry,tasks});
  writeTeacherReview(result,outDir);
  return result.summary;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [runDir,outDir,batchArg]=process.argv.slice(2);
  if(!runDir||!outDir)throw Error('usage: node prepare_review.mjs RUN_DIR OUT_DIR [BATCH_INDEX]');
  const batchIndex=batchArg?Number(batchArg):0;
  const summary=prepareReview({runDir,outDir,batchIndex});
  console.log(JSON.stringify(summary));
}
