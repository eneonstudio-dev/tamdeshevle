import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SHA=/^[a-f0-9]{64}$/i;
const ID=/^[a-z0-9][a-z0-9._-]{2,79}$/i;
const CONTRACT='bai-actions-v1';
const DEFAULT_ENDPOINT='https://cxpneczhczashanbetgj.supabase.co/functions/v1/bai-trained-inference';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,Object.keys(value||{}).sort());

export function bindBrainRelease({release,endpoint=DEFAULT_ENDPOINT}){
  if(!release||typeof release!=='object'||Array.isArray(release))throw Error('release_invalid');
  if(release.schema_version!=='1.0')throw Error('release_schema_mismatch');
  if(!ID.test(String(release.id||'')))throw Error('release_bad_id');
  if(release.kind!=='trained'||release.status!=='promoted'||release.promotion?.pass!==true)throw Error('release_not_promoted');
  if(release.action_contract!==CONTRACT)throw Error('release_contract_mismatch');
  if(!SHA.test(String(release.checkpoint_sha256||'')))throw Error('release_bad_checkpoint');
  const url=new URL(String(endpoint||''));
  if(url.protocol!=='https:')throw Error('endpoint_https_required');
  if(url.origin!=='https://cxpneczhczashanbetgj.supabase.co'||url.pathname!=='/functions/v1/bai-trained-inference')throw Error('endpoint_not_approved');
  if(release.enabled===true)throw Error('source_release_must_be_staged');
  const bound={...release,enabled:false,endpoint:url.toString(),auth:'supabase',binding:{schema_version:'1.0',mode:'staged',endpoint_origin:url.origin,bound_at:new Date().toISOString(),source_release_sha256:sha(Buffer.from(JSON.stringify(release)))} };
  return bound;
}

export function writeBoundRelease({releaseFile,outFile,jsOut,endpoint}){
  const source=read(path.resolve(releaseFile));
  const bound=bindBrainRelease({release:source,endpoint});
  fs.mkdirSync(path.dirname(path.resolve(outFile)),{recursive:true});
  fs.writeFileSync(path.resolve(outFile),JSON.stringify(bound,null,2)+'\n');
  if(jsOut){
    const js=`(()=>{window.TD_BAI_BRAIN_RELEASES=Array.isArray(window.TD_BAI_BRAIN_RELEASES)?window.TD_BAI_BRAIN_RELEASES:[];window.TD_BAI_BRAIN_RELEASES.push(${JSON.stringify(bound)});})();\n`;
    fs.mkdirSync(path.dirname(path.resolve(jsOut)),{recursive:true});
    fs.writeFileSync(path.resolve(jsOut),js);
  }
  return bound;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [releaseFile,outFile,jsOut]=process.argv.slice(2);
  if(!releaseFile||!outFile)throw Error('usage: bind-brain-release RELEASE_JSON OUT_JSON [OUT_JS]');
  console.log(JSON.stringify(writeBoundRelease({releaseFile,outFile,jsOut})));
}

export const _test={DEFAULT_ENDPOINT,CONTRACT,stable};
