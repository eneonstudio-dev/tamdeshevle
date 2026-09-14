export const ACTION_CONTRACT="bai-actions-v1";
export const MAX_ACTIONS=20;
const ACTIONS=new Set(["add_item","remove_item","replace_item","change_quantity","set_constraint","rebuild_basket","compare_stores","optimize_basket","explain_choice","prepare_purchase"]);
const FORBIDDEN=new Set(["price","availability","store","composition","quality","unit_price","line_total"]);
const SHA=/^[a-f0-9]{64}$/i,ID=/^[a-z0-9][a-z0-9._-]{2,79}$/i;

export type ReleasePin={id:string;checkpoint_sha256:string;action_contract:string};

export function expectedRelease():ReleasePin|null{
  const id=String(Deno.env.get("BAI_TRAINED_RELEASE_ID")||"").trim();
  const checkpoint=String(Deno.env.get("BAI_TRAINED_CHECKPOINT_SHA256")||"").trim().toLowerCase();
  const contract=String(Deno.env.get("BAI_TRAINED_ACTION_CONTRACT")||ACTION_CONTRACT).trim();
  return ID.test(id)&&SHA.test(checkpoint)&&contract===ACTION_CONTRACT?{id,checkpoint_sha256:checkpoint,action_contract:contract}:null;
}
export function releaseMatches(raw:any,expected:ReleasePin){return Boolean(raw&&raw.id===expected.id&&String(raw.checkpoint_sha256||"").toLowerCase()===expected.checkpoint_sha256&&raw.action_contract===expected.action_contract)}
export function forbiddenFacts(value:any,path="$",hits:string[]=[]):string[]{
  if(Array.isArray(value)){value.forEach((x,i)=>forbiddenFacts(x,`${path}[${i}]`,hits));return hits}
  if(!value||typeof value!=="object")return hits;
  for(const [key,item] of Object.entries(value)){
    const next=`${path}.${key}`,name=key.toLowerCase();
    const unknown=path.endsWith(".confidence")&&["price","availability","quality"].includes(name)&&item==="unknown";
    if(FORBIDDEN.has(name)&&item!==null&&item!==undefined&&item!==""&&!unknown)hits.push(next);
    forbiddenFacts(item,next,hits);
  }
  return hits;
}
export function validateBackendEnvelope(body:any,expected:ReleasePin):string{
  if(!body||body.ok!==true||!releaseMatches(body.release,expected))return"backend_release_mismatch";
  const output=body.output;if(!output||typeof output!=="object"||Array.isArray(output))return"backend_output_missing";
  if(forbiddenFacts(output).length)return"backend_unverified_facts";
  if(!Array.isArray(output.actions)||!output.actions.length||output.actions.length>MAX_ACTIONS)return"backend_actions_invalid";
  for(const action of output.actions){if(!action||!ACTIONS.has(String(action.type||""))||!action.payload||typeof action.payload!=="object"||Array.isArray(action.payload))return"backend_action_contract_invalid"}
  return"";
}
