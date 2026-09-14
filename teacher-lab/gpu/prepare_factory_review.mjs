import fs from 'node:fs';
import path from 'node:path';
import {buildTeacherReview,writeTeacherReview} from '../review-teacher-pair.mjs';

const here=new URL('../',import.meta.url);
const readJson=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const readJsonl=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);

export function loadFactoryTasks(file){
  const rows=readJsonl(file);
  if(!rows.length)throw Error('factory task file is empty');
  const ids=rows.map(x=>String(x?.id||''));
  if(ids.some(x=>!x))throw Error('factory task id missing');
  if(new Set(ids).size!==ids.length)throw Error('duplicate factory task id');
  return rows;
}

export function prepareFactoryReview({runDir,tasksFile,outDir}){
  const registry=readJson('sources.json');
  const leftProfile=readJson('profiles/deepseek-r1-distill-qwen-7b.json');
  const rightProfile=readJson('profiles/qwen3-8b.json');
  const tasks=loadFactoryTasks(tasksFile),ids=new Set(tasks.map(x=>x.id));
  const leftRows=readJsonl(path.join(runDir,'deepseek_r1_distill_qwen_7b.jsonl')).filter(x=>x.ok===true&&ids.has(x.task_id));
  const rightRows=readJsonl(path.join(runDir,'qwen3_8b.jsonl')).filter(x=>x.ok===true&&ids.has(x.task_id));
  const result=buildTeacherReview({leftRun:{results:leftRows},rightRun:{results:rightRows},leftProfile,rightProfile,registry,tasks});
  writeTeacherReview(result,outDir);
  return result.summary;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [runDir,tasksFile,outDir]=process.argv.slice(2);
  if(!runDir||!tasksFile||!outDir)throw Error('usage: node prepare_factory_review.mjs RUN_DIR TASKS_JSONL OUT_DIR');
  console.log(JSON.stringify(prepareFactoryReview({runDir,tasksFile,outDir})));
}
