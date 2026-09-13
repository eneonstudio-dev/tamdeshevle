import fs from 'node:fs';
import path from 'node:path';
import {buildReviewPacket} from './review-decision.mjs';

const FORBIDDEN=new Set(['chain_of_thought','reasoning','hidden_reasoning','scratchpad','cot']);
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const readJsonl=p=>fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);

function scrub(value){
  if(Array.isArray(value))return value.map(scrub);
  if(!value||typeof value!=='object')return value;
  const out={};
  for(const [k,v] of Object.entries(value))if(!FORBIDDEN.has(k.toLowerCase()))out[k]=scrub(v);
  return out;
}

const safeJson=value=>JSON.stringify(scrub(value)).replace(/<\//g,'<\\/');

export function renderReviewConsole(packet){
  const data=safeJson(Array.isArray(packet)?packet:[]);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bai Teacher Review</title><style>
body{font:15px system-ui;margin:0;background:#f6f6f6;color:#111}header{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:12px;z-index:2}.wrap{max-width:1200px;margin:auto;padding:16px}.meta{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px}pre,textarea{white-space:pre-wrap;word-break:break-word;font:12px ui-monospace,monospace}textarea{width:100%;min-height:260px}.flags{font-weight:700}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}button{padding:9px 12px}button.sel{outline:3px solid #111}@media(max-width:800px){.grid{grid-template-columns:1fr}}
</style></head><body><header><div class="wrap meta"><b>Bai Teacher Review</b><span id="progress"></span><label>Reviewer <input id="reviewer" placeholder="operator"></label><button id="prev">←</button><button id="next">→</button><button id="export">Export decisions.json</button></div></header><main class="wrap"><div id="root"></div></main><script>
const PACKET=${data}; let index=0; const decisions=new Map();
const pretty=x=>JSON.stringify(x,null,2); const current=()=>PACKET[index];
function escapeHtml(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
function escapeAttr(s){return escapeHtml(s).replace(/"/g,'&quot;')}
function render(){
  const x=current(), root=document.getElementById('root');
  document.getElementById('progress').textContent=PACKET.length?(index+1)+'/'+PACKET.length:'0/0';
  if(!x){root.innerHTML='<p>Нет кейсов.</p>';return}
  const d=decisions.get(x.task_id)||{}, tags=[...(x.conflicts||[]),...(x.flags||[])].join(' · ')||'без флагов';
  root.innerHTML='<section class="card"><div><b>'+escapeHtml(x.task_id)+'</b> · '+escapeHtml(x.status)+'</div><div class="flags">'+escapeHtml(tags)+'</div></section>'+
    '<div class="grid"><section class="card"><h3>Left</h3><pre>'+escapeHtml(pretty(x.left))+'</pre></section><section class="card"><h3>Right</h3><pre>'+escapeHtml(pretty(x.right))+'</pre></section></div>'+
    '<div class="actions"><button data-d="approve_left">Approve left</button><button data-d="approve_right">Approve right</button><button data-d="approve_edited">Approve edited</button><button data-d="reject">Reject</button></div>'+
    '<label>Note <input id="note" style="width:100%" value="'+escapeAttr(d.note||'')+'"></label>'+
    '<div id="editBox" style="display:'+(d.decision==='approve_edited'?'block':'none')+'"><h3>Edited target JSON</h3><textarea id="edited">'+escapeHtml(d.editedText||pretty(x.left||x.right||{}))+'</textarea></div>';
  document.querySelectorAll('[data-d]').forEach(b=>{if(b.dataset.d===d.decision)b.classList.add('sel');b.onclick=()=>choose(b.dataset.d)});
}
function choose(decision){const x=current(),old=decisions.get(x.task_id)||{};decisions.set(x.task_id,{...old,task_id:x.task_id,decision,note:document.getElementById('note')?.value||'',editedText:document.getElementById('edited')?.value||old.editedText});render()}
function saveDraft(){const x=current();if(!x)return;const d=decisions.get(x.task_id);if(d)decisions.set(x.task_id,{...d,note:document.getElementById('note')?.value||'',editedText:document.getElementById('edited')?.value||d.editedText})}
document.getElementById('prev').onclick=()=>{if(index>0){saveDraft();index--;render()}};
document.getElementById('next').onclick=()=>{if(index<PACKET.length-1){saveDraft();index++;render()}};
document.getElementById('export').onclick=()=>{saveDraft();const reviewer=document.getElementById('reviewer').value.trim();if(!reviewer)return alert('Укажи reviewer');const out=[];for(const x of PACKET){const d=decisions.get(x.task_id);if(!d)continue;const row={task_id:x.task_id,decision:d.decision,reviewer,note:d.note||'',reviewed_at:new Date().toISOString()};if(d.decision==='approve_edited'){try{row.edited_target=JSON.parse(d.editedText)}catch{return alert('Некорректный JSON в edited target: '+x.task_id)}}out.push(row)}const blob=new Blob([JSON.stringify(out,null,2)+'\\n'],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='decisions.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
render();
</script></body></html>`;
}

export function buildConsoleFromDir(reviewDir){
  const left=readJsonl(path.join(reviewDir,'left-candidates.jsonl'));
  const right=readJsonl(path.join(reviewDir,'right-candidates.jsonl'));
  const queue=readJson(path.join(reviewDir,'review-queue.json'));
  return renderReviewConsole(buildReviewPacket({left,right,queue}));
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [reviewDir,outFile]=process.argv.slice(2);
  if(!reviewDir||!outFile)throw Error('usage: node teacher-lab/review-console.mjs REVIEW_DIR OUTPUT_HTML');
  fs.writeFileSync(outFile,buildConsoleFromDir(reviewDir));
  console.log(outFile);
}
