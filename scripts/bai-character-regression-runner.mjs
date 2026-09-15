import fs from 'node:fs';
import {evaluateCharacterGateBatch} from './bai-character-regression-gate.mjs';

const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export function loadCharacterSuites(baseFile,supplementFile){
  const base=read(baseFile),supplement=read(supplementFile);
  if(base.suite_id!=='bai-character-regression-v1'||base.cases?.length!==16)throw Error('frozen BCR-v1 baseline mismatch');
  if(supplement.training_allowed!==false)throw Error('supplement must stay eval-only');
  const cases=[...base.cases,...supplement.cases];
  if(new Set(cases.map(x=>x.id)).size!==cases.length)throw Error('duplicate BCR ids across suites');
  return{base,supplement,cases};
}

export function runCharacterGate({providerId,candidates,baseFile,supplementFile}){
  if(!String(providerId||'').trim())throw Error('provider_id required');
  const suites=loadCharacterSuites(baseFile,supplementFile);
  const result=evaluateCharacterGateBatch(suites.cases,candidates);
  return{schema_version:'1.0',provider_id:providerId,training_started:false,suites:[suites.base.suite_id,suites.supplement.suite_id],total:suites.cases.length,passed:result.cases.filter(x=>x.ok).length,failed:result.cases.filter(x=>!x.ok).length,...result};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [inputFile,reportFile]=process.argv.slice(2);
  if(!inputFile)throw Error('usage: node scripts/bai-character-regression-runner.mjs INPUT.json [REPORT.json]');
  const input=read(inputFile),here=new URL('../',import.meta.url);
  const report=runCharacterGate({providerId:input.provider_id,candidates:input.candidates,baseFile:new URL('data/bai-character-regression-v1.json',here),supplementFile:new URL('data/bai-character-regression-supplement-v1.json',here)});
  const text=JSON.stringify(report,null,2)+'\n';
  if(reportFile)fs.writeFileSync(reportFile,text);else process.stdout.write(text);
  if(!report.ok)process.exitCode=1;
}
