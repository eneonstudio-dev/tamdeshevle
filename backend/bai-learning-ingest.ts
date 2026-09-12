import { withSupabase } from "npm:@supabase/server@^1";

// Existing Tamdeshevle account project. The publishable key is intentionally public;
// privileged learning writes use this Edge Function's own supabaseAdmin context.
const AUTH_URL = "https://pdsxeddldrmehdqaaksl.supabase.co";
const AUTH_PUBLISHABLE_KEY = "sb_publishable_PDQ3o1sAFvGFw2MelUNw0g_Vr2Vd7vw";
const ALLOWED_ORIGINS = new Set(["https://eneonstudio-dev.github.io"]);
const MAX_TEXT = 220, MAX_PER_HOUR = 20;
const MIN_REVIEW_ACTORS = 4, MIN_APPROVAL_ACTORS = 6, MIN_REVIEW_SCORE = 85, MIN_APPROVAL_SCORE = 90, MIN_APPROVAL_SPAN_MS = 60 * 60 * 1000;
const ALLOWED = new Set(["ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","REQUIRE","SET_ONLY_PRODUCTS","SET_PRODUCT_AMOUNT","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","ADD_PREFERENCE","PREFER","CHANGE_STORE","SET_MODE","RESET_BASKET","CLEAR_ONLY"]);
const UNITS = new Set(["kg","g","ml","l","pack","pcs"]);

const low=(v:unknown)=>String(v??"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
const slug=(v:unknown)=>typeof v==="string"&&/^[a-z0-9_-]{1,64}$/.test(v);
const hasPII=(v:unknown)=>/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(v??""))||/(?:\+?\d[\d\s()\-]{8,}\d)/.test(String(v??""))||/https?:\/\/\S+/i.test(String(v??""));
const redact=(v:unknown)=>String(v??"").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[email]").replace(/(?:\+?\d[\d\s()\-]{8,}\d)/g,"[phone]").replace(/https?:\/\/\S+/gi,"[url]").replace(/\b(?:\d[ -]*?){13,19}\b/g,"[number]").slice(0,MAX_TEXT);
const injection=(t:string)=>/(игнорир(?:уй|овать)|забудь|обойди)\s+(?:все\s+)?(?:правил|инструкц|огранич)|system\s*prompt|developer\s*message|prompt\s*injection|jailbreak|раскрой\s+(?:системн|скрыт)|перепиши\s+(?:себя|код)|выполни\s+код/i.test(t);
const globalPoison=(t:string)=>/(для всех|всем пользовател|глобальн|обучи всех|научи всех|запомни для всех|всегда считай|всегда делай|теперь всегда)/i.test(t);
const explicitCorrection=(t:string)=>(/(^|[\s,.;!?])(нет|не так|я имел|я хотел|имел в виду|хотел сказать|исправь|поправь|лучше|вместо|не это|не то)(?=$|[\s,.;!?])/i).test(t);

function validOp(o:any){
  if(!o||!ALLOWED.has(o.type))return false;const v=o.value;
  if(["ADD_PRODUCT","REMOVE_PRODUCT","REQUIRE","CHANGE_STORE"].includes(o.type))return slug(String(v??""));
  if(o.type==="REPLACE_PRODUCT")return v&&slug(String(v.from??""))&&slug(String(v.to??""))&&v.from!==v.to;
  if(o.type==="SET_ONLY_PRODUCTS")return Array.isArray(v)&&v.length>0&&v.length<=20&&v.every((x:unknown)=>slug(String(x)));
  if(o.type==="SET_PRODUCT_AMOUNT")return v&&slug(String(v.id??""))&&Number(v.amount)>0&&Number(v.amount)<=1000&&UNITS.has(v.unit);
  if(o.type==="CHANGE_BUDGET")return Number(v)>=1&&Number(v)<=10000000;
  if(o.type==="SET_PEOPLE")return Number(v)>=1&&Number(v)<=100;
  if(o.type==="SET_DURATION")return Number(v)>=1&&Number(v)<=365;
  if(o.type==="SET_COOKING")return typeof v==="string"&&/^[a-z0-9_-]{1,32}$/.test(v);
  if(["ADD_PREFERENCE","PREFER"].includes(o.type))return typeof v==="string"&&v.length>0&&v.length<=64&&!/[<>\u0000-\u001f]/.test(v);
  if(o.type==="SET_MODE")return typeof v==="string"&&/^[a-z0-9_-]{1,24}$/.test(v);
  return ["RESET_BASKET","CLEAR_ONLY"].includes(o.type);
}
const safeOps=(ops:unknown)=>(Array.isArray(ops)?ops:[]).filter(validOp).slice(0,12).map((x:unknown)=>JSON.parse(JSON.stringify(x)));
const opsKey=(ops:unknown)=>JSON.stringify(safeOps(ops));
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")}

async function authenticate(req:Request){
  const header=req.headers.get("authorization")||"";
  if(!/^Bearer\s+\S+$/i.test(header))return null;
  let res:Response;
  try{res=await fetch(`${AUTH_URL}/auth/v1/user`,{headers:{Authorization:header,apikey:AUTH_PUBLISHABLE_KEY}})}catch{return null}
  if(!res.ok)return null;
  try{const user=await res.json();return typeof user?.id==="string"&&user.id?user.id:null}catch{return null}
}

async function evaluate(candidate:any,actorHash:string){
  const input=String(candidate?.input??""),correction=String(candidate?.correction??""),allOps=Array.isArray(candidate?.operations)?candidate.operations:[],operations=safeOps(allOps),text=low(`${input} ${correction}`),reasons:string[]=[];
  let score=75,hardBlock=false;
  if(candidate?.requiresServerConsensus!==true){hardBlock=true;reasons.push("missing_server_consensus_flag")}
  if(!input||input.length>MAX_TEXT||correction.length>MAX_TEXT){hardBlock=true;reasons.push("invalid_text_length")}
  if(hasPII(input)||hasPII(correction)){hardBlock=true;reasons.push("pii_present")}
  if(injection(text)){hardBlock=true;reasons.push("prompt_injection")}
  if(globalPoison(text)){hardBlock=true;reasons.push("global_instruction")}
  if(!allOps.length||allOps.length!==operations.length||allOps.length>12){hardBlock=true;reasons.push("invalid_operation")}
  if(explicitCorrection(correction))score+=10;if(operations.length>0&&operations.length<=4)score+=5;
  if(/(.)\1{10,}/.test(text)){score-=25;reasons.push("spam_pattern")}
  score=Math.max(0,Math.min(100,score));if(hardBlock)score=0;
  const normalizedInput=low(input),intentKey=(await sha256(normalizedInput)).slice(0,16),variantKey=(await sha256(`${normalizedInput}|${opsKey(operations)}`)).slice(0,16);
  return{accepted:!hardBlock&&score>=MIN_REVIEW_SCORE,score,reasons,actorHash,intentKey,variantKey,operations,inputSanitized:redact(input)||"[empty]",correctionSanitized:redact(correction),clientFingerprint:String(candidate?.fingerprint??"").slice(0,64)};
}
function median(values:number[]){const a=[...values].sort((x,y)=>x-y);if(!a.length)return 0;const m=Math.floor(a.length/2);return a.length%2?a[m]:Math.round((a[m-1]+a[m])/2)}
function consensus(rows:any[],intentKey:string){
  const byVariant=new Map<string,{actors:Set<string>;scores:number[];times:number[]}>(),allActors=new Set<string>();
  for(const row of rows){allActors.add(row.actor_hash);const item=byVariant.get(row.variant_key)??{actors:new Set<string>(),scores:[],times:[]};item.actors.add(row.actor_hash);item.scores.push(Number(row.server_score));item.times.push(Date.parse(row.created_at));byVariant.set(row.variant_key,item)}
  const ranked=[...byVariant.entries()].map(([variantKey,v])=>({variantKey,actors:v.actors.size,medianScore:median(v.scores),times:v.times})).sort((a,b)=>b.actors-a.actors||b.medianScore-a.medianScore),top=ranked[0],runner=ranked[1];
  if(!top)return{status:"quarantine",intentKey};
  const totalActors=allActors.size,share=totalActors?top.actors/totalActors:0,span=top.times.length?Math.max(...top.times)-Math.min(...top.times):0,conflictActors=runner?.actors??0;
  const reviewReady=top.actors>=MIN_REVIEW_ACTORS&&top.medianScore>=MIN_REVIEW_SCORE&&share>=.75&&conflictActors<=1;
  const approvalEligible=reviewReady&&top.actors>=MIN_APPROVAL_ACTORS&&top.medianScore>=MIN_APPROVAL_SCORE&&share>=.8&&span>=MIN_APPROVAL_SPAN_MS;
  return{status:approvalEligible?"approval_eligible":reviewReady?"review_ready":"quarantine",intentKey,variantKey:top.variantKey,independentActors:top.actors,medianScore:top.medianScore,conflictActors,share:Number(share.toFixed(4)),observationSpanMs:span,requiresRegression:true,autoApply:false};
}
const originAllowed=(req:Request)=>{const origin=req.headers.get("origin");return !origin||ALLOWED_ORIGINS.has(origin)};

export default{fetch:withSupabase({auth:"none"},async(req,ctx)=>{
  if(!originAllowed(req))return Response.json({error:"origin_not_allowed"},{status:403});
  if(req.method!=="POST")return Response.json({error:"method_not_allowed"},{status:405});
  const userId=await authenticate(req);if(!userId)return Response.json({error:"unauthorized"},{status:401});
  let candidate:any;try{candidate=await req.json()}catch{return Response.json({error:"invalid_json"},{status:400})}
  const actorHash=await sha256(`bai-learning-v1:${userId}`),since=new Date(Date.now()-3600000).toISOString();
  const[countA,countQ]=await Promise.all([
    ctx.supabaseAdmin.from("bai_learning_events").select("id",{count:"exact",head:true}).eq("actor_hash",actorHash).gte("created_at",since),
    ctx.supabaseAdmin.from("bai_learning_quarantine").select("id",{count:"exact",head:true}).eq("actor_hash",actorHash).gte("created_at",since)
  ]);
  if(countA.error||countQ.error)return Response.json({error:"rate_check_failed"},{status:503});
  if((countA.count??0)+(countQ.count??0)>=MAX_PER_HOUR)return Response.json({error:"rate_limited"},{status:429});
  const verdict=await evaluate(candidate,actorHash);
  if(!verdict.accepted){
    const{error}=await ctx.supabaseAdmin.from("bai_learning_quarantine").insert({actor_hash:actorHash,intent_key:verdict.intentKey,variant_key:verdict.variantKey,input_sanitized:verdict.inputSanitized,correction_sanitized:verdict.correctionSanitized,operations:verdict.operations,server_score:verdict.score,reasons:verdict.reasons});
    if(error)return Response.json({error:"quarantine_write_failed"},{status:503});
    return Response.json({accepted:false,status:"quarantine",reasons:verdict.reasons},{status:202});
  }
  const{error:writeError}=await ctx.supabaseAdmin.from("bai_learning_events").upsert({actor_hash:actorHash,intent_key:verdict.intentKey,variant_key:verdict.variantKey,client_fingerprint:verdict.clientFingerprint,input_sanitized:verdict.inputSanitized,correction_sanitized:verdict.correctionSanitized,operations:verdict.operations,server_score:verdict.score,reasons:verdict.reasons},{onConflict:"actor_hash,variant_key",ignoreDuplicates:true});
  if(writeError)return Response.json({error:"event_write_failed"},{status:503});
  const{data:rows,error:readError}=await ctx.supabaseAdmin.from("bai_learning_events").select("actor_hash,variant_key,server_score,created_at").eq("intent_key",verdict.intentKey).limit(500);
  if(readError)return Response.json({error:"consensus_read_failed"},{status:503});
  const decision=consensus(rows??[],verdict.intentKey);
  if(decision.status==="review_ready"||decision.status==="approval_eligible"){
    const{error}=await ctx.supabaseAdmin.from("bai_learning_review_queue").upsert({intent_key:decision.intentKey,variant_key:decision.variantKey,independent_actors:decision.independentActors,median_score:decision.medianScore,conflict_actors:decision.conflictActors,actor_share:decision.share,observation_span_ms:decision.observationSpanMs,status:decision.status,requires_regression:true,updated_at:new Date().toISOString()},{onConflict:"intent_key"});
    if(error)return Response.json({error:"review_queue_write_failed"},{status:503});
  }else await ctx.supabaseAdmin.from("bai_learning_review_queue").delete().eq("intent_key",verdict.intentKey);
  return Response.json({accepted:true,...decision},{status:202});
})};
