import crypto from 'node:crypto';

const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
const jsonl=rows=>rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
const clean=v=>String(v??'').trim();

export function shardCorpus(rows,batchSize=64){
  if(!Array.isArray(rows)||!rows.length)throw Error('corpus rows required');
  if(!Number.isInteger(batchSize)||batchSize<1||batchSize>500)throw Error('invalid batch size');
  const ids=new Set();
  for(const row of rows){if(!row?.id||ids.has(row.id))throw Error(`invalid or duplicate task id ${row?.id||''}`);ids.add(row.id)}
  const out=[];
  for(let i=0;i<rows.length;i+=batchSize){
    const batchRows=rows.slice(i,i+batchSize),body=jsonl(batchRows),number=out.length+1;
    out.push({id:`batch_${String(number).padStart(3,'0')}`,offset:i,count:batchRows.length,task_ids:batchRows.map(x=>x.id),sha256:sha256(body),jsonl:body});
  }
  return out;
}

export function buildManifest({rows,profiles,batchSize=64}){
  const batches=shardCorpus(rows,batchSize),corpusBody=jsonl(rows);
  const teachers=(Array.isArray(profiles)?profiles:[]).map(profile=>({
    id:clean(profile?.id),source_id:clean(profile?.source_id),model:clean(profile?.model),revision:clean(profile?.revision),transport:clean(profile?.transport),endpoint:clean(profile?.endpoint)
  }));
  if(!teachers.length||teachers.some(x=>!x.id||!x.source_id||!x.model||!x.revision))throw Error('valid teacher profiles required');
  if(teachers.some(x=>!/^[0-9a-f]{40}$/i.test(x.revision)))throw Error('teacher revisions must be pinned commit hashes');
  return {
    schema_version:'1.0',
    corpus:{tasks:rows.length,sha256:sha256(corpusBody)},
    batch_size:batchSize,
    teachers,
    batches:batches.map(({jsonl:_,...meta})=>meta)
  };
}

export function renderCorpusJsonl(rows){return jsonl(rows)}
