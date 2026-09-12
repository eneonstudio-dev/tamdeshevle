(()=>{
  "use strict";
  if(window.TDBaiShoppingJourney)return;

  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const AUTO=/(?:^|[\s,])(собери|подбери|составь|сам реши|реши сам|сделай (?:мне )?(?:корзин|рацион)|на твое усмотрение|на твоё усмотрение)(?=$|[\s,.!?])/i;
  const COMPARE=/сравни|покажи\s+вариант|какие\s+вариант|что\s+лучше|что\s+выбрать/i;
  const NARROW=/\b(?:добав|убери|удали|замени|поменяй|оставь|только|отмени|верни)\b/i;
  let plannerLoad=null,wrapped=false,descriptorInstalled=false;

  function opKey(op){return `${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`}
  function mergeOps(base,extra){
    const out=[],seen=new Set();
    for(const op of [...(base||[]),...(extra||[])]){
      if(!op||op.type==="NOTE"||op.type==="ASK_CLARIFICATION")continue;
      const key=opKey(op);if(seen.has(key))continue;seen.add(key);out.push(clone(op));
    }
    if(!out.some(op=>op.type==="REOPTIMIZE"))out.push({type:"REOPTIMIZE"});
    return out.slice(0,24);
  }

  function shouldAuto(text,routed){
    const t=low(text),ops=Array.isArray(routed?.operations)?routed.operations:[];
    if(!AUTO.test(t)||COMPARE.test(t))return false;
    if(routed?.expectsAnswer||ops.some(op=>op?.type==="ASK_CLARIFICATION"))return false;
    if(NARROW.test(t)&&!/собери|подбери|составь|сделай/.test(t))return false;
    if(ops.some(op=>op?.type==="UNDO"))return false;
    return true;
  }

  function project(base,ops,text=""){
    const s=clone(base);s.requiredProducts=uniq(s.requiredProducts||[]);s.preferredProducts=uniq(s.preferredProducts||[]);s.excludedProducts=uniq(s.excludedProducts||[]);s.preferences=uniq(s.preferences||[]);s.stores=uniq(s.stores||[]);
    for(const op of ops||[]){
      if(!op)continue;
      if(op.type==="RESET_BASKET"){s.products=[];s.requiredProducts=[];s.preferredProducts=[];s.excludedProducts=[];s.onlyProducts=[];s.preferences=[]}
      else if(op.type==="CHANGE_BUDGET")s.budget=Math.max(0,Number(op.value)||0);
      else if(op.type==="SET_PEOPLE")s.peopleCount=Math.max(1,Number(op.value)||1);
      else if(op.type==="SET_DURATION")s.duration=Math.max(1,Number(op.value)||1);
      else if(op.type==="SET_COOKING")s.cookingPreference=op.value;
      else if(op.type==="SET_MODE")s.mode=op.value;
      else if(op.type==="CHANGE_STORE")s.stores=uniq([...s.stores,String(op.value||"")]);
      else if(op.type==="ADD_PREFERENCE")s.preferences=uniq([...s.preferences,String(op.value||"")]);
      else if(op.type==="REQUIRE"||op.type==="ADD_PRODUCT"){s.requiredProducts=uniq([...s.requiredProducts,String(op.value||"")]);s.excludedProducts=s.excludedProducts.filter(x=>x!==String(op.value||""))}
      else if(op.type==="REMOVE_PRODUCT"){s.excludedProducts=uniq([...s.excludedProducts,String(op.value||"")]);s.requiredProducts=s.requiredProducts.filter(x=>x!==String(op.value||""))}
      else if(op.type==="PREFER")s.preferredProducts=uniq([...s.preferredProducts,String(op.value||"")]);
      else if(op.type==="SET_ONLY_PRODUCTS"){s.selectionMode="only";s.onlyProducts=uniq(op.value||[]);s.requiredProducts=uniq(op.value||[])}
      else if(op.type==="CLEAR_ONLY"){s.selectionMode="auto";s.onlyProducts=[]}
      else if(op.type==="REPLACE_PRODUCT"&&op.value){const from=String(op.value.from||""),to=String(op.value.to||"");s.excludedProducts=uniq([...s.excludedProducts,from]);s.requiredProducts=uniq([...s.requiredProducts.filter(x=>x!==from),to])}
    }
    if(/\b(?:я\s+один|мне\s+одному|для\s+себя)\b/.test(low(text)))s.peopleCount=1;
    return s;
  }

  async function ensurePlanner(){
    if(window.TDBaiPlanner)return window.TDBaiPlanner;
    plannerLoad=plannerLoad||import("./bai-planner.js?v=20260912-planner-v4").catch(error=>{console.warn("[Bai Journey] planner load failed",error);return null});
    await plannerLoad;return window.TDBaiPlanner||null;
  }

  function assumptions(state,routed){
    const explicit=new Set((routed?.operations||[]).map(op=>op?.type)),bits=[];
    if(!explicit.has("SET_PEOPLE"))bits.push(`${Math.max(1,Number(state.peopleCount)||1)} чел.`);
    if(!explicit.has("SET_DURATION"))bits.push(`${Math.max(1,Number(state.duration)||1)} дн.`);
    return bits;
  }

  async function autoPlan(text,routed){
    if(!shouldAuto(text,routed))return routed;
    const planner=await ensurePlanner();if(!planner?.build||!window.TDShoppingOptimizer)return routed;
    const base=window.TDShoppingState?.get?.()||{},scenario=project(base,routed?.operations||[],text),pack=planner.build(scenario,text),chosen=pack?.recommended;
    if(!chosen?.operations?.length)return routed;
    const operations=mergeOps(routed?.operations,chosen.operations);if(!operations.length)return routed;
    const assumed=assumptions(scenario,routed),why=planner.explain?.(pack,scenario)||"";
    return {...routed,provider:"bai-shopping-journey",operations,reply:why||routed?.reply||"Собрал лучший вариант.",suggestions:[],expectsAnswer:/сам реши|реши сам|на тво[её] усмотрение/.test(low(text)),journey:{autoApplied:true,strategy:chosen.id,title:chosen.title,assumptions:assumed,alternatives:(pack.strategies||[]).slice(0,3).map(x=>({id:x.id,total:x.total,stores:x.stores,score:x.score}))}};
  }

  function wrapBrain(brain){
    if(!brain?.route||brain.__baiShoppingJourneyWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiShoppingJourneyWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){const routed=await original(raw,history,...rest);return autoPlan(raw,routed)};
    wrapped=true;return brain;
  }

  function install(){
    const current=window.TDBaiBrain;if(current){wrapBrain(current);return true}
    const desc=Object.getOwnPropertyDescriptor(window,"TDBaiBrain");
    if(desc?.set&&desc?.get&&desc.configurable){
      Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:desc.enumerable,get:desc.get,set(next){desc.set.call(window,next);const ready=desc.get.call(window);if(ready)wrapBrain(ready)}});
      descriptorInstalled=true;return true;
    }
    let value;
    try{Object.defineProperty(window,"TDBaiBrain",{configurable:true,enumerable:true,get(){return value},set(next){value=wrapBrain(next)}});descriptorInstalled=true;return true}catch{return false}
  }

  window.TDBaiShoppingJourney={shouldAuto,project,mergeOps,autoPlan,install,status:()=>({wrapped,descriptorInstalled})};
  install();
})();
