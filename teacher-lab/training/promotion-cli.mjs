import fs from 'node:fs';
import {promotionGate} from './promotion-gate.mjs';

export function runPromotion({baselineFile,candidateFile,outFile}){
  const baseline=JSON.parse(fs.readFileSync(baselineFile,'utf8'));
  const candidate=JSON.parse(fs.readFileSync(candidateFile,'utf8'));
  const verdict=promotionGate(baseline,candidate);
  const report={schema_version:'1.0',pass:verdict.pass,reasons:verdict.reasons,baseline,candidate};
  if(outFile)fs.writeFileSync(outFile,JSON.stringify(report,null,2)+'\n');
  return report;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [baselineFile,candidateFile,outFile]=process.argv.slice(2);
  if(!baselineFile||!candidateFile)throw Error('usage: promotion-cli BASELINE.json CANDIDATE.json [OUT.json]');
  const report=runPromotion({baselineFile,candidateFile,outFile});
  console.log(JSON.stringify(report,null,2));
  if(!report.pass)process.exitCode=2;
}
