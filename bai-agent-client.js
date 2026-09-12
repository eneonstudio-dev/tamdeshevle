(()=>{
  "use strict";
  if(window.TDBaiAgentClient)return;

  const ALLOWED=new Set(["UNDO","RESET_BASKET","SET_INTENT","SET_ONLY_PRODUCTS","CLEAR_ONLY","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","ADD_PREFERENCE","CHANGE_STORE","SET_MODE","REQUIRE","PREFER","REOPTIMIZE","ASK_CLARIFICATION"]);
  const MAX_HISTORY=8,MAX_TEXT=500,REQUEST_TIMEOUT_MS=9000;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const trim=v=>String(v||"").replace(/\s+/g," ").trim().slice(0,MAX_TEXT);
  let wrapped=false,lastStatus={attempted:false,used:false,reason:"idle",at:0};

  function safeOps(ops){
    return (Array.isArray(ops)?ops:[]).filter(op=>op&&ALLOWED.has(op.type)).slice(0,20).map(op=>({type:op.type,...(op.value===undefined?{}:{value:clone(op.value)})}));
  }

  function sanitizeHistory(history){
    return (Array.isArray(history)?history:[]).slice(-MAX_HISTORY).map(item=>({role:item?.role==="assistant"?"assistant":"user",text:trim(item?.text)})).filter(item=>item.text);
  }

  function sanitizeState(raw){
    const s=raw&&typeof raw==="object"?raw:{};
    const ids=value=>(Array.isArray(value)?value:[]).map(x=>String(x||"").slice(0,64)).filter(Boolean).slice(0,24);
    return {
      budget:s.budget==null?null:Math.max(0,Number(s.budget)||0),
      currentTotal:Math.max(0,Number(s.currentTotal)||0),
      peopleCount:Math.max(1,Math.min(100,Number(s.peopleCount)||1)),
      duration:Math.max(1,Math.min(365,Number(s.duration)||1)),
      cookingPreference:String(s.cookingPreference||"normal").slice(0,32),
      mode:s.mode==="one"?"one":"multi",
      stores:ids(s.stores),requiredProducts:ids(s.requiredProducts),preferredProducts:ids(s.preferredProducts),excludedProducts:ids(s.excludedProducts),onlyProducts:ids(s.onlyProducts),
      preferences:ids(s.preferences),
      products:(Array.isArray(s.products)?s.products:[]).slice(0,30).map(p=>({id:String(p?.id||"").slice(0,64),name:String(p?.name||"").slice(0,90),quantity:Math.max(0,Number(p?.quantity)||0)})).filter(p=>p.id)
    };
  }

  function shouldUse(text,baseline){
    const t=low(text),ops=Array.isArray(baseline?.operations)?baseline.operations:[];
    if(!trim(text)||navigator.onLine===false)return false;
    if(baseline?.selfCheck?.safe===false)return false;
    if(!ops.length&&(/не понял|уточни|что именно|на что заменить/i.test(String(baseline?.reply||""))||baseline?.expectsAnswer))return true;
    if(/\b(сам реши|что бы ты|что лучше|как лучше|предложи|подбери|посоветуй|нормальн\w* ед|рацион|меню|что купить|как собрать|сравни варианты)\b/.test(t))return true;
    const constraints=[/бюджет|до\s*\d|руб|₽/.test(t),/готовить|готовк/.test(t),/на\s+\d+\s*(?:дн|дня|дней)|недел/.test(t),/нас\s+\w+|на\s+\d+\s*(?:человек|чел)/.test(t),/не хочу|без\s+\w+|исключ/.test(t),/одном магазин|разным магазин|где дешевле/.test(t)].filter(Boolean).length;
    return t.length>=55&&constraints>=2;
  }

  async function accessToken(){
    if(!window.TDAuth?.init)return null;
    try{const auth=await window.TDAuth.init();if(!auth||!window.TDAuth.user?.())return null;const {data,error}=await auth.auth.getSession();return error?null:(data?.session?.access_token||null)}catch{return null}
  }

  async function remoteRoute(text,history,baseline){
    const endpoint=window.TD_BAI_AGENT?.endpoint;if(!endpoint)return null;
    const token=await accessToken();if(!token)return null;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},signal:controller.signal,body:JSON.stringify({message:trim(text),history:sanitizeHistory(history),basket:sanitizeState(window.TDShoppingState?.get?.()||{}),baseline:{operations:safeOps(baseline?.operations),reply:trim(baseline?.reply),expectsAnswer:Boolean(baseline?.expectsAnswer)}})});
      let body=null;try{body=await response.json()}catch{}
      if(!response.ok||body?.ok===false)return null;
      const operations=safeOps(body?.operations),reply=trim(body?.reply),suggestions=(Array.isArray(body?.suggestions)?body.suggestions:[]).map(trim).filter(Boolean).slice(0,3);
      if(!operations.length&&!reply)return null;
      return {...baseline,ok:true,provider:"bai-agent-core",operations,reply:reply||baseline?.reply||"",suggestions,expectsAnswer:Boolean(body?.expectsAnswer),agent:{version:String(body?.version||"v1"),model:String(body?.model||"server"),trace:Array.isArray(body?.trace)?body.trace.slice(0,8):[]}};
    }catch{return null}finally{clearTimeout(timer)}
  }

  async function route(text,history,baseline){
    lastStatus={attempted:true,used:false,reason:"fallback",at:Date.now()};
    if(!shouldUse(text,baseline)){lastStatus.reason="rules_sufficient";return baseline}
    const candidate=await remoteRoute(text,history,baseline);
    if(!candidate){lastStatus.reason="agent_unavailable";return baseline}
    lastStatus={attempted:true,used:true,reason:"agent",at:Date.now()};
    return candidate;
  }

  function wrapBrain(brain){
    if(!brain?.route||brain.__baiAgentCoreWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiAgentCoreWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){
      const baseline=await original(raw,history,...rest);
      return route(raw,history,baseline);
    };
    wrapped=true;
    return brain;
  }

  function install(){
    const current=window.TDBaiBrain;
    if(current){wrapBrain(current);return true}
    let value;
    try{
      Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapBrain(next)}});
      return true;
    }catch{return false}
  }

  window.TDBaiAgentClient={install,route,shouldUse,sanitizeState,safeOps,status:()=>({...lastStatus,wrapped,configured:Boolean(window.TD_BAI_AGENT?.endpoint)})};
  install();
})();
