import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {validateExample,trainingEligibility} from '../firewall.mjs';
import {renderSftJsonl} from './prepare-sft.mjs';

const root=new URL('../',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',root),'utf8'));
const clone=v=>JSON.parse(JSON.stringify(v));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const readJsonl=f=>fs.readFileSync(f,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const stable=v=>Array.isArray(v)?`[${v.map(stable).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`:JSON.stringify(v);
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'?v:stable(v)).digest('hex');
const fingerprint=row=>sha({user_request:clean(row?.user_request).toLowerCase().replace(/ё/g,'е'),session_context:row?.session_context||{}});

function readDecisions(file){
  const text=fs.readFileSync(file,'utf8').trim();
  if(!text)return [];
  return text.startsWith('[')?JSON.parse(text):text.split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

export function exportFailureGold({candidates,decisions,manifest,sourceRegistry=registry}){
  const dm=new Map((decisions||[]).map(x=>[clean(x?.candidate_id||x?.id),x]));
  const heldoutIds=new Set(manifest?.heldout_ids||[]),heldoutFp=new Set(manifest?.heldout_fingerprints||[]);
  const approved=[],rejected=[],pending=[];
  for(const candidate of candidates||[]){
    const id=clean(candidate?.id),d=dm.get(id);
    if(!d){pending.push({id,reason:'missing_decision'});continue}
    if(!clean(d.reviewer)){pending.push({id,reason:'missing_reviewer'});continue}
    if(d.decision==='reject'){rejected.push({id,note:clean(d.note)});continue}
    let target=null;
    if(d.decision==='approve_suggested')target=clone(candidate.suggested_target);
    else if(d.decision==='approve_edited'&&d.edited_target&&typeof d.edited_target==='object')target=clone(d.edited_target);
    if(!target){pending.push({id,reason:'invalid_decision'});continue}
    const row={
      id,schema_version:'1.0',language:'ru',user_request:clean(candidate.user_request),session_context:clone(candidate.session_context||{}),guards:clone(candidate.guards||{}),target,
      provenance:{sources:[{source_id:'human_votonobay_reviewed',model:'human-reviewed',reviewer:clean(d.reviewer),generator:'failure_remediation_v1',source_failure_id:clean(candidate.source_failure_id),source_train_id:clean(candidate.source_train_id)}],reviewed_at:clean(d.reviewed_at)||null},
      review:{status:'approved',reviewer:clean(d.reviewer),note:clean(d.note)},privacy:{sanitized:true,contains_personal_data:false}
    };
    if(heldoutIds.has(row.id)||heldoutFp.has(fingerprint(row)))throw Error(`heldout leakage blocked for ${row.id}`);
    validateExample(row,sourceRegistry);const gate=trainingEligibility(row,sourceRegistry);
    if(!gate.eligible)throw Error(`${row.id}: ${gate.reasons.join(',')}`);
    approved.push(row);
  }
  return {approved,rejected,pending,summary:{approved:approved.length,rejected:rejected.length,pending:pending.length,total:(candidates||[]).length,heldout_leakage:0}};
}

export function runExport({prepDir,decisionsFile,outDir,sourceRegistry=registry}){
  const candidates=readJsonl(path.join(prepDir,'remediation-candidates.jsonl'));
  const manifest=JSON.parse(fs.readFileSync(path.join(prepDir,'manifest.json'),'utf8'));
  const result=exportFailureGold({candidates,decisions:readDecisions(decisionsFile),manifest,sourceRegistry});
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,'gold.jsonl'),result.approved.map(JSON.stringify).join('\n')+(result.approved.length?'\n':''));
  fs.writeFileSync(path.join(outDir,'sft.jsonl'),renderSftJsonl(result.approved,sourceRegistry));
  fs.writeFileSync(path.join(outDir,'summary.json'),JSON.stringify(result.summary,null,2)+'\n');
  return result;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [prepDir,decisionsFile,outDir]=process.argv.slice(2);
  if(!prepDir||!decisionsFile||!outDir)throw Error('usage: export_failure_remediation PREP_DIR DECISIONS OUT_DIR');
  console.log(JSON.stringify(runExport({prepDir,decisionsFile,outDir}).summary));
}
