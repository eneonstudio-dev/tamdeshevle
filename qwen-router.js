(()=>{
  "use strict";
  if(window.TDQwenRouter)return;

  const STORAGE_KEY="td_bai_local_model_enabled";
  const BROWSER_MODEL="onnx-community/Qwen3-0.6B-ONNX";
  const MODEL_REVISION="558750086ed49d78cb701ed6fa85af33fd16453f";
  const ALLOWED=new Set(["UNDO","RESET_BASKET","SET_INTENT","SET_ONLY_PRODUCTS","CLEAR_ONLY","ADD_PRODUCT","REPLACE_PRODUCT","CHANGE_BUDGET","SET_PEOPLE","SET_DURATION","SET_COOKING","ADD_PREFERENCE","CHANGE_STORE","SET_MODE","REMOVE_PRODUCT","REQUIRE","PREFER","EXCLUDE_BRAND","HAS_AT_HOME","EXCLUDE_TAG","REOPTIMIZE","ASK_CLARIFICATION","NOTE"]);
  const FALLBACK_PRODUCTS=new Set(["milk","bread","chicken","banana","oil","eggs","buck","sour","sugar","pasta","water","apple","ham","dumplings","noodles","waffles","cottage"]);
  let worker=null,seq=0,lastProgress=null;
  const pending=new Map();
  const get=()=>{try{return localStorage.getItem(STORAGE_KEY)}catch{return null}};
  const set=v=>{try{localStorage.setItem(STORAGE_KEY,v?"1":"0")}catch{}};
  const enabled=()=>get()==="1";
  const supported=()=>Boolean(globalThis.Worker&&navigator?.gpu);
  const clean=v=>String(v??"").replace(/\s+/g," ").trim();
  const clone=v=>JSON.parse(JSON.stringify(v));

  function catalog(){
    const seen=new Set(),out=[];
    const raw=window.TDStoreAdapters?.catalog?.()||[];
    for(const item of (Array.isArray(raw)?raw:[]).slice(0,80)){
      const id=String(item?.id||"");
      if(!/^[a-z0-9_-]{1,64}$/.test(id)||seen.has(id))continue;
      seen.add(id);out.push({id,name:clean(item?.name||id).slice(0,80)});
    }
    return out;
  }

  function knownProducts(){return new Set([...FALLBACK_PRODUCTS,...catalog().map(x=>x.id)])}

  function stateContext(){
    const s=window.TDShoppingState?.get?.()||{};
    return {
      budget:s.budget||null,people:s.peopleCount||1,days:s.duration||1,cooking:s.cookingPreference||null,
      mode:s.mode||null,stores:Array.isArray(s.stores)?s.stores.slice(0,12):[],intent:s.intent||"build",
      only:Array.isArray(s.onlyProducts)?s.onlyProducts.slice(0,24):[],required:Array.isArray(s.requiredProducts)?s.requiredProducts.slice(0,24):[],
      preferred:Array.isArray(s.preferredProducts)?s.preferredProducts.slice(0,24):[],excluded:Array.isArray(s.excludedProducts)?s.excludedProducts.slice(0,24):[],
      existing:Array.isArray(s.existingProducts)?s.existingProducts.slice(0,24):[],
      products:(Array.isArray(s.products)?s.products:[]).slice(0,30).map(x=>({id:x.id,name:clean(x.name).slice(0,80),qty:Number(x.quantity)||0})),
      total:Number(s.currentTotal)||0
    };
  }

  function prompt(){
    const products=catalog().slice(0,60).map(x=>`${x.id}:${x.name}`).join(", ");
    return `Ты Бай — локальный разговорный агент сервиса «Там дешевле». Понимай живую русскую речь и контекст. Не выдумывай цены, наличие, скидки или магазины: расчёты делает код. Верни только JSON {"reply":"короткий естественный ответ","operations":[...]}. Если данных недостаточно — только ASK_CLARIFICATION. Сохраняй ограничения прошлых сообщений, если пользователь их не отменил. /no_think\nРазрешённые операции: RESET_BASKET,SET_INTENT,SET_ONLY_PRODUCTS,CLEAR_ONLY,ADD_PRODUCT,REPLACE_PRODUCT,CHANGE_BUDGET,SET_PEOPLE,SET_DURATION,SET_COOKING,ADD_PREFERENCE,CHANGE_STORE,SET_MODE,REMOVE_PRODUCT,REQUIRE,PREFER,EXCLUDE_BRAND,HAS_AT_HOME,EXCLUDE_TAG,REOPTIMIZE,ASK_CLARIFICATION,NOTE,UNDO.\nКаталог: ${products||[...FALLBACK_PRODUCTS].join(",")}.`;
  }

  function msgs(text,history=[]){
    const recent=(Array.isArray(history)?history:[]).slice(-8).map(m=>({role:m?.role==="assistant"?"assistant":"user",content:clean(m?.text).slice(0,500)})).filter(m=>m.content);
    return [{role:"system",content:prompt()},...recent,{role:"user",content:`Состояние покупок: ${JSON.stringify(stateContext())}\nСообщение: ${clean(text).slice(0,500)}\n/no_think`}];
  }

  function safeOperation(op){
    if(!op||typeof op!=="object"||!ALLOWED.has(op.type))return null;
    const known=knownProducts(),value=op.value;
    if(["ADD_PRODUCT","REMOVE_PRODUCT","REQUIRE","PREFER"].includes(op.type))return known.has(String(value||""))?{type:op.type,value:String(value)}:null;
    if(op.type==="REPLACE_PRODUCT"){
      const from=String(value?.from||""),to=String(value?.to||"");
      return known.has(from)&&known.has(to)&&from!==to?{type:op.type,value:{from,to}}:null;
    }
    if(op.type==="SET_ONLY_PRODUCTS"){
      const ids=(Array.isArray(value)?value:[]).map(String).filter(id=>known.has(id)).slice(0,20);
      return ids.length?{type:op.type,value:ids}:null;
    }
    if(op.type==="CHANGE_BUDGET"){const n=Number(value);return Number.isFinite(n)&&n>=1&&n<=10000000?{type:op.type,value:Math.round(n)}:null}
    if(op.type==="SET_PEOPLE"){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=100?{type:op.type,value:n}:null}
    if(op.type==="SET_DURATION"){const n=Number(value);return Number.isInteger(n)&&n>=1&&n<=365?{type:op.type,value:n}:null}
    if(op.type==="ASK_CLARIFICATION"||op.type==="NOTE"){
      const v=clean(value).slice(0,180);return v?{type:op.type,value:v}:null;
    }
    if(value===undefined)return{type:op.type};
    if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return{type:op.type,value};
    return{type:op.type,value:clone(value)};
  }

  function parse(text){
    const raw=String(text||"").replace(/<think>[\s\S]*?<\/think>/gi,"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,""),a=raw.indexOf("{"),b=raw.lastIndexOf("}");
    if(a<0||b<a)throw Error("no_json");
    const data=JSON.parse(raw.slice(a,b+1)),operations=[];
    for(const op of (Array.isArray(data.operations)?data.operations:[]).slice(0,20)){
      const safe=safeOperation(op);if(!safe)throw Error("invalid_operation");operations.push(safe);
    }
    return {operations,reply:typeof data.reply==="string"?clean(data.reply).slice(0,420):""};
  }

  function ensureWorker(){
    if(worker)return worker;
    if(!enabled())throw Error("local_model_disabled");
    if(!supported())throw Error("webgpu_unavailable");
    worker=new Worker(new URL("qwen-browser-worker.js",location.href),{type:"module"});
    worker.onmessage=e=>{
      const d=e.data||{};
      if(d.type==="progress"){lastProgress=d.data||null;return}
      const p=pending.get(d.id);if(!p)return;
      if(d.type==="result"){pending.delete(d.id);p.resolve(d.text)}
      else if(d.type==="error"){pending.delete(d.id);p.reject(Error(d.error||"worker"))}
    };
    worker.onerror=()=>{for(const [,p] of pending)p.reject(Error("worker_failed"));pending.clear();worker?.terminate?.();worker=null};
    return worker;
  }

  async function browser(text,history){
    const w=ensureWorker(),id=++seq,out=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(Error("timeout"))},90000);
      pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});
      w.postMessage({type:"generate",id,messages:msgs(text,history)});
    });
    return {ok:true,provider:"qwen-browser",model:BROWSER_MODEL,revision:MODEL_REVISION,...parse(out)};
  }

  async function route(text,history=[]){
    if(!enabled())return{ok:false,provider:"qwen-browser",reason:"disabled",operations:null,reply:""};
    if(!supported())return{ok:false,provider:"qwen-browser",reason:"webgpu_unavailable",operations:null,reply:""};
    try{return await browser(text,history)}catch(error){console.warn("[Bai Local Qwen]",error);return{ok:false,provider:"qwen-browser",reason:String(error?.message||"failed").slice(0,80),operations:null,reply:""}}
  }

  window.TDQwenRouter={
    route,
    enable(){set(true);return this.status()},
    disable(){set(false);worker?.terminate?.();worker=null;return this.status()},
    status:()=>({provider:"qwen-browser",enabled:enabled(),supported:supported(),model:BROWSER_MODEL,revision:MODEL_REVISION,progress:lastProgress})
  };
})();
