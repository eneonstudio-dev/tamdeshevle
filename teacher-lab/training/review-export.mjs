import fs from 'node:fs';
import path from 'node:path';
import {applyReviewDecisions} from '../review-decision.mjs';
import {renderSftJsonl} from './prepare-sft.mjs';

const root=new URL('../',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('sources.json',root),'utf8'));
const readJsonl=f=>fs.readFileSync(f,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
export function readDecisionRows(file){
  const text=fs.readFileSync(file,'utf8').trim();
  if(!text)return [];
  if(text.startsWith('[')){
    const rows=JSON.parse(text);
    if(!Array.isArray(rows))throw Error('decisions JSON must be an array');
    return rows;
  }
  return text.split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

const [dir,decisions,out]=process.argv.slice(2);
if(!dir||!decisions||!out)throw Error('usage: review-export REVIEW_DIR DECISIONS OUT_DIR');
const left=readJsonl(path.join(dir,'left-candidates.jsonl'));
const right=readJsonl(path.join(dir,'right-candidates.jsonl'));
const queue=JSON.parse(fs.readFileSync(path.join(dir,'review-queue.json'),'utf8'));
const result=applyReviewDecisions({left,right,queue,decisions:readDecisionRows(decisions),registry});
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'gold.jsonl'),result.approved.map(JSON.stringify).join('\n')+(result.approved.length?'\n':''));
fs.writeFileSync(path.join(out,'sft.jsonl'),renderSftJsonl(result.approved,registry));
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result.summary,null,2)+'\n');
console.log(JSON.stringify(result.summary));
