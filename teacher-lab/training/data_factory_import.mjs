import fs from 'node:fs';
import path from 'node:path';
import {importTeacherResults,buildReviewQueue} from '../candidate-import.mjs';

const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const readJsonl=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeJsonl=(file,rows)=>fs.writeFileSync(file,rows.map(JSON.stringify).join('\n')+(rows.length?'\n':''));

export function importFactoryRun({tasksFile,teacherRunFile,profileFile,registryFile,outDir}){
  const tasks=readJsonl(tasksFile);
  const teacherRun=readJson(teacherRunFile);
  const profile=readJson(profileFile);
  const registry=readJson(registryFile);
  const imported=importTeacherResults({rows:teacherRun.results||[],tasks,profile,registry});
  const review=buildReviewQueue(imported.candidates);
  const out=path.resolve(outDir);fs.mkdirSync(out,{recursive:true});
  writeJsonl(path.join(out,'candidates.jsonl'),imported.candidates);
  writeJsonl(path.join(out,'review-queue.jsonl'),review);
  fs.writeFileSync(path.join(out,'import-summary.json'),JSON.stringify({schema_version:'2.0',tasks:tasks.length,teacher_results:(teacherRun.results||[]).length,candidates:imported.candidates.length,rejected:imported.rejected.length,training_allowed:false,requires_human_review:true,rejected_rows:imported.rejected},null,2)+'\n');
  return {tasks:tasks.length,candidates:imported.candidates.length,rejected:imported.rejected.length};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [tasksFile,teacherRunFile,profileFile,registryFile,outDir]=process.argv.slice(2);
  if(!tasksFile||!teacherRunFile||!profileFile||!registryFile||!outDir)throw Error('usage: node data_factory_import.mjs TASKS.jsonl TEACHER_RUN.json PROFILE.json SOURCES.json OUT_DIR');
  console.log(JSON.stringify(importFactoryRun({tasksFile,teacherRunFile,profileFile,registryFile,outDir}),null,2));
}
