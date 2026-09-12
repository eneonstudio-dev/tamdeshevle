(()=>{
  "use strict";
  if(window.TDBaiAgentClient)return;

  const ALLOWED=new Set(["UNDO","RESET_BASKET","SET_INTENT","SET_ONLY_PRODUCTS","CLEAR_ONLY","ADD_PRODUCT","REMOVE_PRODUCT","REPLACE_PRODUCT","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","ADD_PREFERENCE","CHANGE_STORE","SET_MODE","REQUIRE","PREFER","REOPTIMIZE","ASK_CLARIFICATION"]);
  const MAX_HISTORY=8,MAX_TEXT=500,REQUEST_TIMEOUT_MS=9000,LOCAL_MODEL_MB=310;
  const LOCAL_STORAGE_KEY="td_bai_gemma_local_enabled";
  const LOCAL_ENABLE=/включ(?:и|ить)\s+(?:локальн[а-я]*\s+)?нейро[-\s]?режим/i;
  const LOCAL_DISABLE=/выключ(?:и|ить)\s+(?:локальн[а-я]*\s+)?нейро[-\s]?режим/i;
  const LOCAL_SUGGESTION=`Включить нейро-режим (~${LOCAL_MODEL_MB} МБ)`;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const trim=v=>String(v||"").replace(/\s+/g," ").trim().slice(0,MAX_TEXT);
  let wrapped=false,localLoad=null,lastStatus={attempted:false,used:false,provider:"rules",reason:"idle",at:0};

  function safeOps(ops){return (Array.isArray(ops)?ops:[]).filter(op=>op&&ALLOWED.has(op.type)).slice(0,20).map(op=>({type:op.type,...(op.value===undefined?{}:{value:clone(op.value)})}))}
  function safeIntent(value){if(!value||typeof value!=="object"||Array.isArray(value))return null;try{const raw=JSON.stringify(value);return raw.length<=6000?JSON.parse(raw):null}catch{return null}}
  function sanitizeHistory(history){return (Array.isArray(history)?history:[]).slice(-MAX_HISTORY).map(item=>({role:item?.role==="assistant"?"assistant":"user",text:trim(item?.text)})).filter(item=>item.text)}
  function textList(value,max=24){return(Array.isArray(value)?value:[]).map(x=>trim(x).slice(0,64)).filter(Boolean).slice(0,max)}
  function safePreferenceMap(value){if(!value||typeof value!=="object"||Array.isArray(value))return{};const out={};for(const [key,raw] of Object.entries(value).slice(0,12)){const k=String(key||"").slice(0,32);if(!/^[a-z_]{1,32}$/.test(k))continue;if(typeof raw==="number"&&Number.isFinite(raw))out[k]=Math.max(-10,Math.min(10,raw));else if(typeof raw==="string")out[k]=trim(raw).slice(0,48)}return out}
  function sanitizeIntelligence(raw){
    const x=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{},hard=x.hard&&typeof x.hard==="object"?x.hard:{},soft=x.soft&&typeof x.soft==="object"?x.soft:{};
    return{
      hard:{budgetMax:hard.budgetMax==null?null:Math.max(0,Number(hard.budgetMax)||0),storeLimit:[1,2,3].includes(Number(hard.storeLimit))?Number(hard.storeLimit):null,excludedBrands:textList(hard.excludedBrands),excludedProducts:textList(hard.excludedProducts),excludedTags:textList(hard.excludedTags)},
      soft:{price:trim(soft.price).slice(0,32),oneStore:Number.isFinite(Number(soft.oneStore))?Math.max(0,Math.min(1,Number(soft.oneStore))):null,health:trim(soft.health).slice(0,32),satiety:trim(soft.satiety).slice(0,32),cooking:trim(soft.cooking).slice(0,32),meal:trim(soft.meal).slice(0,32),time:trim(soft.time).slice(0,32),variety:trim(soft.variety).slice(0,32),budgetReservePct:Number.isFinite(Number(soft.budgetReservePct))?Math.max(0,Math.min(.25,Number(soft.budgetReservePct))):null,categoryWeights:safePreferenceMap(soft.categoryWeights),categoryQuality:safePreferenceMap(soft.categoryQuality),categoryPrice:safePreferenceMap(soft.categoryPrice),categoryBudgetCaps:safePreferenceMap(soft.categoryBudgetCaps)},
      people:x.people==null?null:Math.max(1,Math.min(100,Number(x.people)||1)),duration:x.duration==null?null:Math.max(1,Math.min(365,Number(x.duration)||1)),lastAction:trim(x.lastAction).slice(0,32),lastTouchedProduct:trim(x.lastTouchedProduct).slice(0,64)
    };
  }
  function sanitizeState(raw){
    const s=raw&&typeof raw==="object"?raw:{},ids=value=>(Array.isArray(value)?value:[]).map(x=>String(x||"").slice(0,64)).filter(Boolean).slice(0,24);
    return {budget:s.budget==null?null:Math.max(0,Number(s.budget)||0),currentTotal:Math.max(0,Number(s.currentTotal)||0),peopleCount:Math.max(1,Math.min(100,Number(s.peopleCount)||1)),duration:Math.max(1,Math.min(365,Number(s.duration)||1)),cookingPreference:String(s.cookingPreference||"normal").slice(0,32),mode:s.mode==="one"?"one":"multi",stores:ids(s.stores),requiredProducts:ids(s.requiredProducts),preferredProducts:ids(s.preferredProducts),excludedProducts:ids(s.excludedProducts),excludedBrands:textList(s.excludedBrands),onlyProducts:ids(s.onlyProducts),preferences:ids(s.preferences),products:(Array.isArray(s.products)?s.products:[]).slice(0,30).map(p=>({id:String(p?.id||"").slice(0,64),name:String(p?.name||"").slice(0,90),quantity:Math.max(0,Number(p?.quantity)||0)})).filter(p=>p.id),shoppingIntelligence:sanitizeIntelligence(s.shoppingIntelligence)};
  }
  function sanitizeCatalog(raw){
    const seen=new Set(),out=[];
    for(const item of (Array.isArray(raw)?raw:[]).slice(0,80)){
      const id=String(item?.id||"").slice(0,64);if(!/^[a-z0-9_-]{1,64}$/.test(id)||seen.has(id))continue;seen.add(id);
      out.push({id,name:String(item?.name||id).replace(/[<>]/g," ").slice(0,90),tags:(Array.isArray(item?.tags)?item.tags:[]).map(x=>String(x||"").replace(/[<>]/g," ").slice(0,32)).filter(Boolean).slice(0,8)});
    }
    return out;
  }
  function shouldUse(text,baseline){
    const t=low(text),ops=Array.isArray(baseline?.operations)?baseline.operations:[];
    if(!trim(text)||navigator.onLine===false)return false;
    if(baseline?.selfCheck?.safe===false)return false;
    if(!ops.length&&(/не понял|уточни|что именно|на что заменить/i.test(String(baseline?.reply||""))||baseline?.expectsAnswer))return true;
    if(/сам реши|что бы ты|что лучше|как лучше|предложи|подбери|посоветуй|нормальн[а-я]*\s+ед|рацион|меню|что купить|как собрать|сравни варианты/.test(t))return true;
    if(/не самое деш|без переплат|не настолько деш|давай дешевле|мяс[ао].*(?:хорош|получше|маловато)|на остальном эконом|перекус.*вечер|пп\b|без фанатизм|фрукт.*побольше|еще фрукт|ещё фрукт|пожестче|пожёстче|что-нибудь получше|другой бренд|слишком дорого.*замен|таскаться по двум|все в одном магазин|всё в одном магазин/.test(t))return true;
    const constraints=[/бюджет|до\s*\d|руб|₽/.test(t),/готовить|готовк/.test(t),/на\s+\d+\s*(?:дн|дня|дней)|недел/.test(t),/нас\s+[а-я0-9]+|на\s+\d+\s*(?:человек|чел)/.test(t),/не хочу|без\s+[а-я]+|исключ/.test(t),/одном магазин|разным магазин|где дешевле/.test(t)].filter(Boolean).length;
    return t.length>=55&&constraints>=2;
  }
  async function accessToken(){if(!window.TDAuth?.init)return null;try{const auth=await window.TDAuth.init();if(!auth||!window.TDAuth.user?.())return null;const {data,error}=await auth.auth.getSession();return error?null:(data?.session?.access_token||null)}catch{return null}}
  async function remoteRoute(text,history,baseline){
    const endpoint=window.TD_BAI_AGENT?.endpoint;if(!endpoint)return null;
    const token=await accessToken();if(!token)return null;
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
    try{
      const catalog=sanitizeCatalog(window.TDStoreAdapters?.catalog?.()||[]);
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},signal:controller.signal,body:JSON.stringify({message:trim(text),history:sanitizeHistory(history),basket:sanitizeState(window.TDShoppingState?.get?.()||{}),catalog,baseline:{operations:safeOps(baseline?.operations),reply:trim(baseline?.reply),expectsAnswer:Boolean(baseline?.expectsAnswer)}})});
      let body=null;try{body=await response.json()}catch{}
      if(!response.ok||body?.ok===false)return null;
      const operations=safeOps(body?.operations),reply=trim(body?.reply),suggestions=(Array.isArray(body?.suggestions)?body.suggestions:[]).map(trim).filter(Boolean).slice(0,3),aiIntent=safeIntent(body?.intent);
      if(!operations.length&&!reply&&!aiIntent)return null;
      return {...baseline,ok:true,provider:"bai-agent-core",operations,reply:reply||baseline?.reply||"",suggestions,expectsAnswer:Boolean(body?.expectsAnswer),aiIntent,agent:{version:String(body?.version||"v1"),model:String(body?.model||"server"),trace:Array.isArray(body?.trace)?body.trace.slice(0,8):[]}};
    }catch{return null}finally{clearTimeout(timer)}
  }
  function localSupported(){return Boolean(globalThis.Worker&&navigator?.gpu)}
  function localEnabled(){try{return localStorage.getItem(LOCAL_STORAGE_KEY)==="1"}catch{return false}}
  async function ensureLocalRouter(){
    if(window.TDGemmaRouter)return window.TDGemmaRouter;
    localLoad=localLoad||import("./gemma-router.js?v=20260913-gemma-intent-v1").catch(error=>{console.warn("[Bai Local Gemma] load failed",error);return null});
    await localLoad;return window.TDGemmaRouter||null;
  }
  async function localRoute(text,history,baseline){
    if(!localSupported()||!localEnabled())return null;
    const router=await ensureLocalRouter();if(!router?.route)return null;
    const out=await router.route(text,history);if(!out?.ok)return null;
    const operations=safeOps(out.operations),reply=trim(out.reply),aiIntent=safeIntent(out.aiIntent);
    if(!operations.length&&!reply&&!aiIntent)return null;
    return {...baseline,ok:true,provider:"gemma-browser",operations,reply:reply||baseline?.reply||"",suggestions:[],aiIntent,agent:{version:"local-gemma-v1",model:String(out.model||"gemma-browser"),trace:["browser","policy"]}};
  }
  function offerLocal(baseline){
    if(!localSupported()||localEnabled())return baseline;
    const existing=(Array.isArray(baseline?.suggestions)?baseline.suggestions:[]).map(trim).filter(Boolean).filter(x=>x!==LOCAL_SUGGESTION).slice(0,2),hasOps=Array.isArray(baseline?.operations)&&baseline.operations.length>0;
    const note=`Могу включить бесплатный локальный нейро-режим: Gemma работает на устройстве, первый запуск скачает около ${LOCAL_MODEL_MB} МБ.`;
    const reply=hasOps?baseline?.reply:trim(`${baseline?.reply||""} ${note}`);
    return {...baseline,reply,suggestions:[...existing,LOCAL_SUGGESTION].slice(0,3)};
  }
  async function localControl(text,baseline){
    const t=low(text);
    if(LOCAL_DISABLE.test(t)){
      const router=await ensureLocalRouter();router?.disable?.();
      lastStatus={attempted:true,used:true,provider:"gemma-browser",reason:"local_disabled",at:Date.now()};
      return {...baseline,operations:[],reply:"Локальный нейро-режим выключен. Бай снова использует серверный мозг и быстрые правила.",suggestions:[],provider:"gemma-browser-control"};
    }
    if(!LOCAL_ENABLE.test(t))return null;
    if(!localSupported()){
      lastStatus={attempted:true,used:false,provider:"rules",reason:"webgpu_unavailable",at:Date.now()};
      return {...baseline,operations:[],reply:"На этом устройстве локальная нейромодель недоступна: нужен браузер с WebGPU. Обычный Бай продолжит работать.",suggestions:[],provider:"gemma-browser-control"};
    }
    const router=await ensureLocalRouter();router?.enable?.();
    lastStatus={attempted:true,used:true,provider:"gemma-browser",reason:"local_enabled",at:Date.now()};
    return {...baseline,operations:[],reply:`Нейро-режим включён бесплатно. На первом сложном запросе браузер загрузит Gemma около ${LOCAL_MODEL_MB} МБ; дальше она работает локально на устройстве.`,suggestions:[],provider:"gemma-browser-control"};
  }
  async function route(text,history,baseline){
    const control=await localControl(text,baseline);if(control)return control;
    lastStatus={attempted:true,used:false,provider:"rules",reason:"fallback",at:Date.now()};
    if(!shouldUse(text,baseline)){lastStatus.reason="rules_sufficient";return baseline}
    const remote=await remoteRoute(text,history,baseline);
    if(remote){lastStatus={attempted:true,used:true,provider:"bai-agent-core",reason:"server_agent",at:Date.now()};return remote}
    const local=await localRoute(text,history,baseline);
    if(local){lastStatus={attempted:true,used:true,provider:"gemma-browser",reason:"local_model",at:Date.now()};return local}
    if(localSupported()&&!localEnabled()){
      lastStatus={attempted:true,used:false,provider:"rules",reason:"local_opt_in_required",at:Date.now()};
      return offerLocal(baseline);
    }
    lastStatus.reason="agent_unavailable";return baseline;
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__baiAgentCoreWrapped)return brain;
    const original=brain.route.bind(brain);Object.defineProperty(brain,"__baiAgentCoreWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){const baseline=await original(raw,history,...rest);return route(raw,history,baseline)};wrapped=true;return brain;
  }
  function install(){
    const current=window.TDBaiBrain;if(current){wrapBrain(current);return true}
    let value;try{Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapBrain(next)}});return true}catch{return false}
  }
  window.TDBaiAgentClient={install,route,shouldUse,sanitizeState,sanitizeCatalog,safeOps,safeIntent,enableLocal:async()=>{const router=await ensureLocalRouter();return router?.enable?.()||null},disableLocal:async()=>{const router=await ensureLocalRouter();return router?.disable?.()||null},status:()=>({...lastStatus,wrapped,configured:Boolean(window.TD_BAI_AGENT?.endpoint),localSupported:localSupported(),localEnabled:localEnabled(),localModel:"gemma-3-270m-it",localModelMB:LOCAL_MODEL_MB})};
  install();
})();