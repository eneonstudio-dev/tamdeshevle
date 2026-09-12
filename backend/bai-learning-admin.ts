import { withSupabase } from "npm:@supabase/server@^1";

const AUTH_URL = "https://pdsxeddldrmehdqaaksl.supabase.co";
const ALLOWED_ORIGINS = new Set(["https://eneonstudio-dev.github.io"]);
const DECISIONS = new Set(["approved_for_regression","rejected","reopened"]);
const originAllowed=(req:Request)=>{const origin=req.headers.get("origin");return !origin||ALLOWED_ORIGINS.has(origin)};
const cors=(req:Request)=>{const origin=req.headers.get("origin");const h:Record<string,string>={"Content-Type":"application/json","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};if(origin&&ALLOWED_ORIGINS.has(origin))h["Access-Control-Allow-Origin"]=origin;return h};
const reply=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors(req)});
async function sha256(value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")}
async function authenticate(req:Request){const header=req.headers.get("authorization")||"",apiKey=req.headers.get("apikey")||"";if(!/^Bearer\s+\S+$/i.test(header)||!apiKey.startsWith("sb_publishable_"))return null;let res:Response;try{res=await fetch(`${AUTH_URL}/auth/v1/user`,{headers:{Authorization:header,apikey:apiKey}})}catch{return null}if(!res.ok)return null;try{const user=await res.json();return typeof user?.id==="string"&&user.id?{userId:user.id,header,apiKey}:null}catch{return null}}
async function isReviewer(header:string,apiKey:string,userId:string){const url=`${AUTH_URL}/rest/v1/receipt_reviewers?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`;let res:Response;try{res=await fetch(url,{headers:{Authorization:header,apikey:apiKey,Accept:"application/json"}})}catch{return false}if(!res.ok)return false;try{const rows=await res.json();return Array.isArray(rows)&&rows.some((x:any)=>x?.user_id===userId)}catch{return false}}

export default{fetch:withSupabase({auth:"none"},async(req,ctx)=>{
  if(!originAllowed(req))return reply(req,{error:"origin_not_allowed"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(req.method!=="GET"&&req.method!=="POST")return reply(req,{error:"method_not_allowed"},405);
  const auth=await authenticate(req);if(!auth)return reply(req,{error:"unauthorized"},401);
  if(!await isReviewer(auth.header,auth.apiKey,auth.userId))return reply(req,{error:"reviewer_required"},403);
  if(req.method==="GET"){
    const [{data:queue,error:queueError},{data:decisions,error:decisionsError}]=await Promise.all([
      ctx.supabaseAdmin.from("bai_learning_review_queue").select("intent_key,variant_key,independent_actors,median_score,conflict_actors,actor_share,observation_span_ms,status,requires_regression,updated_at").order("updated_at",{ascending:false}).limit(50),
      ctx.supabaseAdmin.from("bai_learning_admin_decisions").select("intent_key,variant_key,decision,note,created_at").order("created_at",{ascending:false}).limit(500)
    ]);
    if(queueError||decisionsError)return reply(req,{error:"admin_read_failed"},503);
    const latest=new Map<string,any>();for(const d of decisions??[])if(!latest.has(d.intent_key))latest.set(d.intent_key,d);
    const items=await Promise.all((queue??[]).map(async(q:any)=>{const{data:sample}=await ctx.supabaseAdmin.from("bai_learning_events").select("input_sanitized,correction_sanitized,operations,created_at").eq("intent_key",q.intent_key).eq("variant_key",q.variant_key).order("created_at",{ascending:false}).limit(1).maybeSingle();return{...q,sample:sample??null,admin_decision:latest.get(q.intent_key)??null};}));
    return reply(req,{items,can_activate:false});
  }
  let body:any;try{body=await req.json()}catch{return reply(req,{error:"invalid_json"},400)}
  const intentKey=String(body?.intentKey||""),action=String(body?.action||""),note=String(body?.note||"").trim().slice(0,300);
  const decision=action==="approve"?"approved_for_regression":action==="reject"?"rejected":action==="reopen"?"reopened":"";
  if(!/^[a-f0-9]{8,64}$/i.test(intentKey)||!DECISIONS.has(decision))return reply(req,{error:"invalid_action"},400);
  const{data:queue,error:queueError}=await ctx.supabaseAdmin.from("bai_learning_review_queue").select("*").eq("intent_key",intentKey).maybeSingle();if(queueError)return reply(req,{error:"queue_read_failed"},503);if(!queue)return reply(req,{error:"queue_item_not_found"},404);
  const adminActorHash=await sha256(`bai-learning-admin-v1:${auth.userId}`);
  const{error:writeError}=await ctx.supabaseAdmin.from("bai_learning_admin_decisions").insert({admin_actor_hash:adminActorHash,intent_key:queue.intent_key,variant_key:queue.variant_key,decision,note,queue_snapshot:queue});if(writeError)return reply(req,{error:"decision_write_failed"},503);
  return reply(req,{ok:true,decision,activation:false});
})};
