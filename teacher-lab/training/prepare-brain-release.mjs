import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const shaFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n')};

export function prepareBrainRelease({pipelineManifest,outFile}){
  const manifestPath=path.resolve(pipelineManifest),state=read(manifestPath),root=path.dirname(manifestPath);
  if(state.status!=='PROMOTION_READY'||state.promotion?.pass!==true)throw Error('promotion_not_passed');
  const artifact=path.resolve(String(state.promotable_artifact||''));if(!state.promotable_artifact||!fs.existsSync(artifact))throw Error('promotable_artifact_missing');
  const digest=shaFile(artifact),dataset=String(state.dataset?.gold_sha256||'');if(!/^[a-f0-9]{64}$/i.test(dataset))throw Error('dataset_digest_missing');
  const trainingFile=path.join(root,'candidate','manifest.json'),training=fs.existsSync(trainingFile)?read(trainingFile):{};
  const release={
    schema_version:'1.0',
    id:`bai-trained-${dataset.slice(0,12).toLowerCase()}`,
    kind:'trained',
    status:'promoted',
    enabled:false,
    action_contract:'bai-actions-v1',
    model:String(training.name||'bai-shopping-brain'),
    base_model:training.base_model||null,
    checkpoint_sha256:digest,
    endpoint:null,
    auth:'supabase',
    promotion:{pass:true,source:'promotion-gate',reasons:Array.isArray(state.promotion?.reasons)?state.promotion.reasons:[],pipeline_manifest_sha256:shaFile(manifestPath)},
    training:{examples:Number(state.dataset?.examples)||null,data_sha256:training.data_sha256||dataset,seed:training.seed??null},
    created_at:new Date().toISOString()
  };
  write(path.resolve(outFile),release);return release;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [pipelineManifest,outFile]=process.argv.slice(2);if(!pipelineManifest||!outFile)throw Error('usage: prepare-brain-release PIPELINE_MANIFEST OUT_JSON');
  console.log(JSON.stringify(prepareBrainRelease({pipelineManifest,outFile})));
}
