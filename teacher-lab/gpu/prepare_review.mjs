import fs from 'node:fs';
import path from 'node:path';
import {buildCorpus} from '../corpus-builder.mjs';
import {buildTeacherReview,writeTeacherReview} from '../review-teacher-pair.mjs';

const here=new URL('../',import.meta.url);
const readJson=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const readJsonl=file=>fs.readFileSync(file,'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));

export function prepareReview({runDir,outDir}){
  const registry=readJson('sources.json');
  const leftProfile=readJson('profiles/deepseek-r1-distill-qwen-7b.json');
  const rightProfile=readJson('profiles/qwen3-8b.json');
  const leftRows=readJsonl(path.join(runDir,'deepseek_r1_distill_qwen_7b.jsonl')).filter(x=>x.ok===true);
  const rightRows=readJsonl(path.join(runDir,'qwen3_8b.jsonl')).filter(x=>x.ok===true);
  const result=buildTeacherReview({leftRun:{results:leftRows},rightRun:{results:rightRows},leftProfile,rightProfile,registry,tasks:buildCorpus()});
  writeTeacherReview(result,outDir);
  return result.summary;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [runDir,outDir]=process.argv.slice(2);
  if(!runDir||!outDir)throw Error('usage: node prepare_review.mjs RUN_DIR OUT_DIR');
  const summary=prepareReview({runDir,outDir});
  console.log(JSON.stringify(summary));
}
