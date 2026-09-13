import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {exportTraining} from '../firewall.mjs';
import {renderSftJsonl} from './prepare-sft.mjs';

const root=new URL('../',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',root),'utf8'));
const student=JSON.parse(fs.readFileSync(new URL('training/student-v0.1.json',root),'utf8'));
const readJsonl=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const canon=value=>JSON.stringify(value,Object.keys(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).sort());

export function aggregateGold(files,sourceRegistry=registry){
  const byId=new Map(),inputs=[];
  for(const file of files){
    const rows=readJsonl(file); inputs.push({file:path.basename(file),sha256:sha(file),rows:rows.length});
    for(const row of rows){
      if(!row?.id)throw Error(`missing id in ${file}`);
      const existing=byId.get(row.id);
      if(existing&&canon(existing.target)!==canon(row.target))throw Error(`conflicting duplicate ${row.id}`);
      if(!existing)byId.set(row.id,row);
    }
  }
  const merged=[...byId.values()].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  const eligible=exportTraining(merged,sourceRegistry);
  if(eligible.length!==merged.length)throw Error('non-training rows reached gold aggregate');
  return {rows:merged,inputs};
}

export function writeAggregate({files,outDir,sourceRegistry=registry,studentConfig=student}){
  const result=aggregateGold(files,sourceRegistry); fs.mkdirSync(outDir,{recursive:true});
  const gold=result.rows.map(JSON.stringify).join('\n')+(result.rows.length?'\n':'');
  const sft=renderSftJsonl(result.rows,sourceRegistry);
  fs.writeFileSync(path.join(outDir,'gold.jsonl'),gold);
  fs.writeFileSync(path.join(outDir,'sft.jsonl'),sft);
  const minimum=Number(studentConfig.data?.minimum_examples||500);
  const manifest={schema_version:'1.0',examples:result.rows.length,minimum_examples:minimum,ready_for_training:result.rows.length>=minimum,gold_sha256:crypto.createHash('sha256').update(gold).digest('hex'),inputs:result.inputs};
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [outDir,...files]=process.argv.slice(2);
  if(!outDir||!files.length)throw Error('usage: aggregate-gold OUT_DIR GOLD1.jsonl [GOLD2.jsonl ...]');
  console.log(JSON.stringify(writeAggregate({files,outDir})));
}
