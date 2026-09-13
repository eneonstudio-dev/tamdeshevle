(()=>{
  "use strict";
  if(window.TDBaiBrainRuntime)return;

  const TIMEOUT_MS=9000,MAX_ACTIONS=20;
  const MUTATING=new Set(["add_item","remove_item","replace_item","change_quantity","set_constraint","rebuild_basket","optimize_basket"]);
  const FORBIDDEN=new Set(["price","availability","store","composition","quality","unit_price","line_total"]);
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  let failures=0,openUntil=0,last={attempted:false,used:false,reason:"idle",release:null,at:0};

  function fail(reason,release=null){failures++;if(failures>=3)openUntil=Date.now()+60000;last={attempted:true,used:false,reason,release:release?.id||null,at:Date.now()};return null}
  function skipped(reason,release=null){last={attempted:true,used:false,reason,release:release?.id||null,at:Date.now()};return null}
  function success(release){failures=0;openUntil=0;last={attempted:true,used:true,reason:"trained_model",release:release.id,at:Date.now()}}
  function available(){return Date.now()>=openUntil}
  function timeout(promise,ms=TIMEOUT_MS){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error("trained_timeout")),ms))])}
  async function token(){
    if(!window.TDAuth?.init)return null;
    try{const auth=await window.TDAuth.init();if(!auth||!window.TDAuth.user?.())return null;const {data,error}=await auth.auth.getSession();return error?null:(data?.session?.access_token||null)}catch{return null}
  }
  function sanitizeHistory(history){return(Array.isArray(history)?history:[]).slice(-8).map(x=>({role:x?.role==="assistant"?"assistant":"user",text:clean(x?.text).slice(0,500)})).filter(x=>x.text)}
  function forbiddenFacts(value,path="$",hits=[]){
    if(Array.isArray(value)){value.forEach((item,i)=>forbiddenFacts(item,`${path}[${i}]`,hits));return hits}
    if(!value||typeof value!=="object")return hits;
    for(const [key,item] of Object.entries(value)){
      const next=`${path}.${key}`,name=key.toLowerCase();
      const confidenceUnknown=path.endsWith(".confidence")&&["price","availability","quality"].includes(name)&&item==="unknown";
      if(FORBIDDEN.has(name)&&item!==null&&item!==undefined&&item!==""&&!confidenceUnknown)hits.push(next);
      forbiddenFacts(item,next,hits);
    }
    return hits;
  }
  function contains(expected,actual){
    if(Array.isArray(expected)){const got=new Set(Array.isArray(actual)?actual.map(String):[]);return expected.every(x=>got.has(String(x)))}
    return JSON.stringify(expected)===JSON.stringify(actual);
  }
  function mutated(actions,key){return actions.some(a=>a.type==="set_constraint"&&String(a.payload?.key||"")===key)}
  function retainsContext(output,actions,state){
    const hard=output?.hard_constraints;if(!hard||typeof hard!=="object"||Array.isArray(hard))return false;
    const checks=[];
    if(Number(state?.budget)>0&&!mutated(actions,"budget"))checks.push(contains(Number(state.budget),hard.budget_max));
    const c=state?.constraints||{};
    if(Number(c.people_count)>0&&!mutated(actions,"people_count"))checks.push(contains(Number(c.people_count),hard.people_count));
    if(Number(c.duration_days)>0&&!mutated(actions,"duration_days"))checks.push(contains(Number(c.duration_days),hard.duration_days));
    if(c.cooking&&c.cooking!=="normal"&&!mutated(actions,"cooking"))checks.push(contains(String(c.cooking),hard.cooking));
    if(c.healthy===true&&!mutated(actions,"healthy"))checks.push(hard.healthy===true);
    if((c.excluded_brands||[]).length&&!mutated(actions,"excluded_brand"))checks.push(contains(c.excluded_brands,hard.excluded_brands));
    if((c.excluded_products||[]).length&&!mutated(actions,"excluded_product"))checks.push(contains(c.excluded_products,hard.excluded_products));
    const s=state?.store_constraints||{};
    if(s.mode==="one"&&!mutated(actions,"store_mode")){checks.push(hard.store_mode==="one");if(!mutated(actions,"store_limit"))checks.push(Number(hard.store_limit)===1)}
    return checks.every(Boolean);
  }
  function validateEnvelope(raw,release,kernel,state,legacy){
    if(!raw||typeof raw!=="object"||raw.ok===false)return{ok:false,reason:"invalid_response"};
    const pin=raw.release||{};
    if(pin.id!==release.id||String(pin.checkpoint_sha256||"").toLowerCase()!==release.checkpoint_sha256||pin.action_contract!==release.action_contract)return{ok:false,reason:"release_pin_mismatch"};
    const output=raw.output;if(!output||typeof output!=="object"||Array.isArray(output))return{ok:false,reason:"output_missing"};
    if(forbiddenFacts(output).length)return{ok:false,reason:"unverified_facts"};
    const input=Array.isArray(output.actions)?output.actions:[];if(!input.length)return{ok:false,reason:"no_actions"};if(input.length>MAX_ACTIONS)return{ok:false,reason:"too_many_actions"};
    const actions=[];
    for(const candidate of input){const checked=kernel.validateAction(clone(candidate),legacy);if(!checked?.ok)return{ok:false,reason:`invalid_action:${checked?.error?.code||"unknown"}`};actions.push(checked.action)}
    if(!retainsContext(output,actions,state))return{ok:false,reason:"hard_context_lost"};
    const legacyOps=[];
    for(const action of actions){const converted=kernel._test?.toLegacy?.(action);if(converted)legacyOps.push(converted);else if(MUTATING.has(action.type))return{ok:false,reason:`action_not_bridgeable:${action.type}`}}
    if(!legacyOps.length)return{ok:false,reason:"passive_action_not_bridgeable"};
    return{ok:true,output,actions,legacyOps};
  }

  async function route(text,history,baseline){
    const registry=window.TDBaiBrainRegistry,kernel=window.TDBaiShoppingAgentKernel;
    const release=registry?.current?.();
    if(!release||release.kind!=="trained"){last={attempted:false,used:false,reason:"safe_baseline",release:null,at:Date.now()};return null}
    if(!release.enabled||!release.endpoint||release.promotion?.pass!==true)return fail("release_not_runnable",release);
    if(!available())return skipped("circuit_open",release);
    if(!kernel?.validateAction||!kernel?._test?.toLegacy)return fail("kernel_unavailable",release);
    const gate=kernel.domainGate?.(text);if(gate&&gate.allowed===false)return null;
    let access=null;if(release.auth==="supabase"){access=await token();if(!access)return fail("auth_unavailable",release)}
    const legacy=window.TDShoppingState?.get?.()||{};
    let state;try{state=kernel.state?.syncFromLegacy?.(legacy)||kernel.state?.get?.()||{}}catch{state=kernel.state?.get?.()||{}}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
    try{
      const headers={"Content-Type":"application/json"};if(access)headers.Authorization=`Bearer ${access}`;
      const response=await timeout(fetch(release.endpoint,{method:"POST",headers,signal:controller.signal,body:JSON.stringify({release:{id:release.id,checkpoint_sha256:release.checkpoint_sha256,action_contract:release.action_contract},message:clean(text).slice(0,1000),history:sanitizeHistory(history),session:state,basket:window.TDBaiAgentClient?.sanitizeState?.(legacy)||legacy})}));
      let body=null;try{body=await response.json()}catch{}
      if(!response.ok)return fail(`http_${response.status}`,release);
      const checked=validateEnvelope(body,release,kernel,state,legacy);if(!checked.ok)return fail(checked.reason,release);
      success(release);
      return {...(baseline||{}),ok:true,provider:"bai-trained-runtime",operations:checked.legacyOps,reply:baseline?.reply||"",suggestions:Array.isArray(baseline?.suggestions)?baseline.suggestions:[],expectsAnswer:false,agent:{version:release.id,model:release.model,checkpoint_sha256:release.checkpoint_sha256,trace:["trained","release-pin","kernel-validated"]},trained:{actions:clone(checked.actions),intent:checked.output.intent||null,passive:false}};
    }catch(error){return fail(error?.name==="AbortError"?"timeout":"runtime_error",release)}finally{clearTimeout(timer)}
  }
  function status(){return{...last,failures,openUntil,available:available(),release:window.TDBaiBrainRegistry?.current?.()||null}}
  function resetBreaker(){failures=0;openUntil=0;last={attempted:false,used:false,reason:"reset",release:null,at:Date.now()};return status()}
  window.TDBaiBrainRuntime={version:1,route,status,resetBreaker,_test:{forbiddenFacts,retainsContext,validateEnvelope}};
})();
