const CORE_URL="https://cxpneczhczashanbetgj.supabase.co/functions/v1/bai-agent-core";
const TRACE_RE=/^bai_[a-z0-9-]{8,80}$/i;
const ALLOWED_ORIGINS=new Set(["https://eneonstudio-dev.github.io"]);

function traceId(req:Request){
  try{const value=new URL(req.url).searchParams.get("trace_id")||"";return TRACE_RE.test(value)?value:null}catch{return null}
}
function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const allowed=ALLOWED_ORIGINS.has(origin)||/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin);
  return {"Access-Control-Allow-Origin":allowed?origin:"https://eneonstudio-dev.github.io","Access-Control-Allow-Headers":"authorization, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"};
}
function tracedBody(raw:string,id:string|null){
  if(!id)return raw;
  try{const body=JSON.parse(raw);return body&&typeof body==="object"&&!Array.isArray(body)?JSON.stringify({...body,trace_id:id}):raw}catch{return raw}
}

Deno.serve(async(req:Request)=>{
  if(req.method!=="POST"&&req.method!=="OPTIONS")return Response.json({ok:false,error:"method_not_allowed"},{status:405,headers:cors(req)});
  const id=traceId(req),started=Date.now();
  try{
    const body=req.method==="POST"?await req.text():undefined;
    const upstream=await fetch(CORE_URL,{method:req.method,headers:req.headers,body});
    const raw=await upstream.text(),headers=new Headers(upstream.headers);headers.delete("content-length");
    if(id)headers.set("X-Bai-Trace-Id",id);
    console.log(JSON.stringify({event:"bai_agent_core_trace",trace_id:id,status:upstream.status,duration_ms:Date.now()-started}));
    return new Response(tracedBody(raw,id),{status:upstream.status,headers});
  }catch(error){
    console.error(JSON.stringify({event:"bai_agent_core_trace",trace_id:id,status:"THREW",code:String(error?.name||"Error").slice(0,64),duration_ms:Date.now()-started}));
    return Response.json({ok:false,error:"agent_proxy_failed",...(id?{trace_id:id}:{})},{status:502,headers:cors(req)});
  }
});
