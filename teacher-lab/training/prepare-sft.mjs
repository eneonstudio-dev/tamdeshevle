import fs from 'node:fs';
import {exportTraining} from '../firewall.mjs';

const promptContract=JSON.parse(fs.readFileSync(new URL('./student-prompt-contract.json',import.meta.url),'utf8'));
export const SYSTEM=String(promptContract.system_prompt||'').trim();
const clean=v=>String(v??'').trim();
export const studentInput=row=>({user_request:clean(row?.user_request),session_context:row?.session_context||{}});

export function prepareSft(rows,registry){
  const eligible=exportTraining(Array.isArray(rows)?rows:[],registry);
  return eligible.map(row=>({
    id:row.id,
    messages:[
      {role:'system',content:SYSTEM},
      {role:'user',content:JSON.stringify(studentInput(row))},
      {role:'assistant',content:JSON.stringify(row.target)}
    ],
    metadata:{language:row.language,provenance:row.provenance}
  }));
}

export function renderSftJsonl(rows,registry){return prepareSft(rows,registry).map(x=>JSON.stringify(x)).join('\n')+'\n'}
