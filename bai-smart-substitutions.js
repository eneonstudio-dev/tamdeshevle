(()=>{
  "use strict";
  if(window.TDBaiSmartSubstitutions)return;

  const uniq=a=>[...new Set((a||[]).filter(Boolean))];
  const food=()=>window.TDBaiFoodKnowledge||null;
  const memory=()=>window.TDBaiMemory||null;
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");

  function storeIds(state={}){
    if(window.TDShoppingOptimizer?.eligibleStores)return window.TDShoppingOptimizer.eligibleStores(state)||[];
    const city=window.state?.city||"msk",all=(typeof STORES!=="undefined"?STORES:[]).filter(x=>(x.city||[]).includes(city)&&x.kind!=="delivery").map(x=>x.id);
    return (state.stores||[]).length?state.stores:all;
  }
  function price(id,state={}){
    if(!window.TDStoreAdapters)return null;let best=null;
    for(const storeId of storeIds(state)){
      try{const q=window.TDStoreAdapters.adapter(storeId)?.getPrice?.(id,"shelf"),v=Number(q?.value);if(Number.isFinite(v)&&v>0&&(best==null||v<best))best=v}catch{}
    }
    return best;
  }
  function roleOverlap(a,b){
    const k=food(),ra=new Set(k?.info?.(a)?.roles||[]),rb=k?.info?.(b)?.roles||[];
    return rb.filter(x=>ra.has(x)).length;
  }
  function allFoodIds(){return Object.keys(food()?.food||{})}
  function candidates(from,state={}){
    const k=food(),info=k?.info?.(from),excluded=new Set(state.excludedProducts||[]),m=memory(),roles=info?.roles||[];
    const direct=info?.subs||[],sameRole=allFoodIds().filter(id=>id!==from&&(k?.info?.(id)?.roles||[]).some(r=>roles.includes(r)));
    return uniq([...direct,...sameRole]).filter(id=>!excluded.has(id)&&!m?.shouldAvoid?.(id));
  }
  function score(from,to,state={},context={}){
    const k=food(),a=k?.info?.(from),b=k?.info?.(to);if(!a||!b)return-999;
    let n=roleOverlap(from,to)*18;
    if(a.category===b.category)n+=9;
    if((a.meals||[]).some(x=>(b.meals||[]).includes(x)))n+=6;
    if(state.cookingPreference==="minimal")n+=(Number(b.easy)||0)*3-(Number(a.easy)||0);
    const pf=price(from,state),pt=price(to,state);if(pf&&pt){const saving=(pf-pt)/pf;n+=Math.max(-12,Math.min(20,Math.round(saving*35)))}
    const affinity=memory()?.productAffinity?.(to);if(Number.isFinite(affinity))n+=Math.max(-24,Math.min(24,affinity*3));
    if(context.meal&&(b.meals||[]).includes(context.meal))n+=7;
    if(context.preferReady&&["ready","quick"].includes(b.prep))n+=8;
    return n;
  }
  function rank(from,state={},context={}){
    return candidates(from,state).map(id=>({id,score:score(from,id,state,context),price:price(id,state),fromPrice:price(from,state),roles:food()?.info?.(id)?.roles||[],prep:food()?.info?.(id)?.prep||null})).sort((a,b)=>b.score-a.score||((a.price??Infinity)-(b.price??Infinity)));
  }
  function choose(from,state={},context={}){return rank(from,state,context)[0]||null}
  function repairRequired(required,state={},context={}){
    const excluded=new Set(state.excludedProducts||[]),m=memory(),out=[],replacements=[];
    for(const id of required||[]){
      if(!excluded.has(id)&&!m?.shouldAvoid?.(id)){out.push(id);continue}
      const pick=choose(id,state,context);
      if(pick){out.push(pick.id);replacements.push({from:id,to:pick.id,reason:excluded.has(id)?"excluded":"learned_avoid",saving:pick.fromPrice&&pick.price?Math.round(pick.fromPrice-pick.price):null})}
    }
    return{required:uniq(out),replacements};
  }
  function cheaper(from,state={},context={}){
    const fromPrice=price(from,state);if(!fromPrice)return choose(from,state,context);
    return rank(from,state,context).find(x=>x.price&&x.price<fromPrice*.95)||null;
  }
  function explain(replacement){
    if(!replacement)return"";const save=Number(replacement.saving);return save>0?`заменил ${replacement.from} на ${replacement.to}: роль в корзине похожая, примерно на ${save} ₽ дешевле`:`заменил ${replacement.from} на ${replacement.to}: роль в корзине похожая`;
  }

  window.TDBaiSmartSubstitutions={storeIds,price,roleOverlap,candidates,score,rank,choose,repairRequired,cheaper,explain};
})();
