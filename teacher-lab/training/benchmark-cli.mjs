import fs from 'node:fs';
import {benchmark} from '../benchmark.mjs';

const readJsonl=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);

export function runBenchmark({goldFile,predictionsFile,outFile}){
  const gold=readJsonl(goldFile),predictions=readJsonl(predictionsFile);
  const metrics=benchmark(gold,predictions);
  if(outFile)fs.writeFileSync(outFile,JSON.stringify(metrics,null,2)+'\n');
  return metrics;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [goldFile,predictionsFile,outFile]=process.argv.slice(2);
  if(!goldFile||!predictionsFile)throw Error('usage: benchmark-cli GOLD.jsonl PREDICTIONS.jsonl [OUT.json]');
  console.log(JSON.stringify(runBenchmark({goldFile,predictionsFile,outFile}),null,2));
}
