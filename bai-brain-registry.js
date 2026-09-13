(()=>{
  "use strict";
  if(window.TDBaiBrainRegistry)return;

  const KEY="td:bai-brain-active:v1";
  const CONTRACT="bai-actions-v1";
  const SAFE_ID="safe-rules-v1";
  const ID=/^[a-z0-9][a-z0-9._-]{2,79}$/i;
  const SHA=/^[a-f0-9]{64}$/i;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const releases=new Map();

  const safe={
    schema_version:"1.0",
    id:SAFE_ID,
    kind:"deterministic",
    status:"promoted",
    enabled:true,
    action_contract:CONTRACT,
    model:"rules",
    checkpoint_sha256:null,
    endpoint:null,
    auth:"none",
    promotion:{pass:true,source:"builtin"}
  };
  releases.set(safe.id,safe);

  function endpointAllowed(value){
    if(typeof value!=="string"||!value.trim())return false;
    const raw=value.trim();
    if(raw.startsWith("/")&&!raw.startsWith("//"))return true;
    let url;try{url=new URL(raw,location?.origin||"https://invalid.local")}catch{return false}
    if(url.protocol!=="https:"){
      const dev=window.TD_BAI_BRAIN_DEV===true&&["localhost","127.0.0.1"].includes(url.hostname);
      if(!dev)return false;
    }
    if(location?.origin&&url.origin===location.origin)return true;
    const allow=new Set((Array.isArray(window.TD_BAI_BRAIN_ALLOWED_ORIGINS)?window.TD_BAI_BRAIN_ALLOWED_ORIGINS:[]).map(String));
    return allow.has(url.origin);
  }

  function normalize(raw){
    if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("brain_release_invalid");
    const id=String(raw.id||"").trim();if(!ID.test(id)||id===SAFE_ID)throw Error("brain_release_bad_id");
    if(raw.kind!=="trained")throw Error("brain_release_bad_kind");
    if(raw.status!=="promoted"||raw.promotion?.pass!==true)throw Error("brain_release_not_promoted");
    if(raw.action_contract!==CONTRACT)throw Error("brain_release_contract_mismatch");
    const checkpoint=String(raw.checkpoint_sha256||"").trim().toLowerCase();if(!SHA.test(checkpoint))throw Error("brain_release_bad_checkpoint");
    const endpoint=raw.endpoint==null?null:String(raw.endpoint).trim();
    if(endpoint!==null&&!endpointAllowed(endpoint))throw Error("brain_release_endpoint_blocked");
    const auth=raw.auth==null?"supabase":String(raw.auth);if(!["none","supabase"].includes(auth))throw Error("brain_release_bad_auth");
    return {schema_version:"1.0",id,kind:"trained",status:"promoted",enabled:raw.enabled===true,action_contract:CONTRACT,model:String(raw.model||"bai-shopping-brain").slice(0,100),checkpoint_sha256:checkpoint,endpoint,auth,promotion:{pass:true,source:String(raw.promotion?.source||"promotion-gate").slice(0,120),...(Array.isArray(raw.promotion?.reasons)?{reasons:raw.promotion.reasons.map(String).slice(0,20)}:{})},created_at:raw.created_at?String(raw.created_at):null};
  }

  function register(raw){const release=normalize(raw);releases.set(release.id,release);return clone(release)}
  function stored(){try{return localStorage.getItem(KEY)}catch{return null}}
  let activeId=SAFE_ID;
  function restore(){const id=stored();if(id&&releases.has(id)){const r=releases.get(id);if(r.kind==="trained"&&r.enabled&&r.endpoint&&endpointAllowed(r.endpoint))activeId=id}}
  function current(){return clone(releases.get(activeId)||safe)}
  function activate(id){
    const release=releases.get(String(id));if(!release)throw Error("brain_release_unknown");
    if(release.kind!=="trained"||release.status!=="promoted"||release.promotion?.pass!==true)throw Error("brain_release_not_promoted");
    if(!release.enabled)throw Error("brain_release_disabled");
    if(!release.endpoint||!endpointAllowed(release.endpoint))throw Error("brain_release_endpoint_missing");
    activeId=release.id;try{localStorage.setItem(KEY,activeId)}catch{};return current();
  }
  function rollback(){activeId=SAFE_ID;try{localStorage.removeItem(KEY)}catch{};return current()}
  function list(){return [...releases.values()].map(clone)}
  function status(){return{active:activeId,current:current(),count:releases.size,action_contract:CONTRACT}}

  for(const raw of Array.isArray(window.TD_BAI_BRAIN_RELEASES)?window.TD_BAI_BRAIN_RELEASES:[]){try{register(raw)}catch(error){console.warn("[Bai Brain Registry] release rejected",error?.message||error)}}
  restore();
  window.TDBaiBrainRegistry={version:1,contract:CONTRACT,safe_id:SAFE_ID,register,activate,rollback,current,list,status,_test:{normalize,endpointAllowed}};
})();
