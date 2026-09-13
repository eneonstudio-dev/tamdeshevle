import fs from 'node:fs';
import path from 'node:path';
import {buildCorpus} from './corpus-builder.mjs';
import {buildManifest,shardCorpus,renderCorpusJsonl} from './batch-manifest.mjs';

const here=new URL('./',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,here),'utf8'));
const outDir=path.resolve(process.argv[2]||'teacher-lab/out');
const rows=buildCorpus();
const profiles=[read('profiles/deepseek-r1-distill-qwen-7b.json'),read('profiles/qwen3-8b.json')];
const batches=shardCorpus(rows,64);
const manifest=buildManifest({rows,profiles,batchSize:64});

fs.mkdirSync(path.join(outDir,'batches'),{recursive:true});
fs.writeFileSync(path.join(outDir,'corpus.jsonl'),renderCorpusJsonl(rows));
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const batch of batches)fs.writeFileSync(path.join(outDir,'batches',`${batch.id}.jsonl`),batch.jsonl);
console.log(JSON.stringify({out_dir:outDir,tasks:rows.length,batches:batches.length,corpus_sha256:manifest.corpus.sha256}));
