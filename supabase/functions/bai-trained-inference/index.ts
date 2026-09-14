import { withSupabase } from "npm:@supabase/server@1.6.0";
import { expectedRelease,releaseMatches,validateBackendEnvelope } from "./contract.ts";
import { cleanMessage,safeHistory,studentContext } from "./context.ts";

const AUTH_URL="https://pdsxeddldrmehdqaaksl.supabase.co";
const SITE_ORIGIN="https://eneonstudio-dev.github.io";
const MAX_BODY=128*1024,MAX_PER_HOUR=30;
function cors(req:Request){const origin=req.headers.get("origin")||"";const ok=origin===SITE_ORIGIN||/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);return{"Access-Control-Allow-Origin":ok?origin:SITE_ORIGIN,"Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return Response.json(body,{status,headers:cors(req)})}
function originAllowed(req:Request){const origin=req.headers.get("origin");return !origin||origin===SITE_ORIGIN||/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)}
async function authenticate(req:Request){const key=String(Deno.env.get("TD_AUTH_PUBLISHABLE_KEY")||"").trim(),header=req.headers.get("authorization")||"";if(!key||!/^Bearer\s+\S+$/i.test(header))return null;try{const res=await fetch(`${AUTH_URL}/auth/v1/user`,{headers:{Authorization:header,apikey:key}});if(!res.ok)return null;const user=await res.json();return typeof user?.id==="string"&&user.id?user.id:null}catch{return null}}
async function sha256(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("")}

export default {fetch:withSupabase({auth:"none"},async(req,ctx)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
  if(!originAllowed(req))return json(req,{ok:false,error:"origin_not_allowed"},403);
  if(req.method!=="POST")return json(req,{ok:false,error:"method_not_allowed"},405);
  if(Number(req.headers.get("content-length")||0)>MAX_BODY)return json(req,{ok:false,error:"payload_too_large"},413);
  const userId=await authenticate(req);if(!userId)return json(req,{ok:false,error:"unauthorized"},401);
  const expected=expectedRelease();if(!expected)return json(req,{ok:false,error:"trained_release_not_bound"},503);
  let payload:any;try{payload=await req.json()}catch{return json(req,{ok:false,error:"invalid_json"},400)}
  if(!releaseMatches(payload?.release,expected))return json(req,{ok:false,error:"release_pin_mismatch"},409);
  const message=cleanMessage(payload?.message);if(!message)return json(req,{ok:false,error:"empty_message"},400);
  const reservation=await ctx.supabaseAdmin.rpc("reserve_bai_agent_request",{p_actor_hash:await sha256(`bai-trained-v1:${userId}`),p_limit:MAX_PER_HOUR});
  if(reservation.error)return json(req,{ok:false,error:"rate_check_failed"},503);
  if(!Number.isSafeInteger(Number(reservation.data))||Number(reservation.data)<1)return json(req,{ok:false,error:"rate_limited"},429);
  const backend=String(Deno.env.get("BAI_TRAINED_BACKEND_URL")||"").trim(),token=String(Deno.env.get("BAI_TRAINED_BACKEND_TOKEN")||"").trim();let url:URL;
  try{url=new URL(backend)}catch{return json(req,{ok:false,error:"trained_backend_not_configured"},503)}
  if(url.protocol!=="https:"||!token)return json(req,{ok:false,error:"trained_backend_not_configured"},503);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
    const upstream=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},signal:controller.signal,body:JSON.stringify({release:expected,user_request:message,session_context:studentContext(payload),history:safeHistory(payload?.history)})});
    let body:any=null;try{body=await upstream.json()}catch{}
    if(!upstream.ok)return json(req,{ok:false,error:`trained_backend_http_${upstream.status}`},502);
    const invalid=validateBackendEnvelope(body,expected);if(invalid)return json(req,{ok:false,error:invalid},502);
    return json(req,{ok:true,release:expected,output:body.output});
  }catch(error){return json(req,{ok:false,error:error instanceof DOMException&&error.name==="AbortError"?"trained_backend_timeout":"trained_backend_failed"},502)}finally{clearTimeout(timer)}
})};
