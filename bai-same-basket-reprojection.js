(()=>{
  "use strict";
  if(window.TDBaiSameBasketReprojection)return;

  const SAME_PHRASES=["то же самое","ту же корзину","те же товары","тот же набор","такую же корзину"];
  const DROP=new Set(["RESET_BASKET","CLEAR_ONLY","SET_ONLY_PRODUCTS"]);
  const key=op=>`${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`;
  const textOf=raw=>String(raw||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
  const sameBasket=raw=>SAME_PHRASES.some(phrase=>textOf(raw).includes(phrase));
  const hasStoreChange=ops=>(Array.isArray(ops)?ops:[]).some(op=>op?.type==="CHANGE_STORE"&&op?.value);
  let activeQuantities=null;

  function currentQuantities(){
    const map=new Map();
    const products=window.TDShoppingState?.get?.()?.products||[];
    for(const line of products){
      const id=String(line?.sourceId||line?.id||"");
      const quantity=Math.max(0,Math.floor(Number(line?.quantity)||0));
      if(id&&quantity)map.set(id,quantity);
    }
    return map;
  }
  function stripRebuild(ops){
    return (Array.isArray(ops)?ops:[]).filter(op=>{
      if(DROP.has(op?.type))return false;
      if(op?.type==="SET_INTENT"&&["build","only"].includes(String(op?.value||"")))return false;
      return true;
    });
  }
  function quantityTargets(ops){
    const list=Array.isArray(ops)?ops:[];
    if(list.some(op=>op?.type==="SET_PRODUCT_AMOUNT"||op?.type==="CHANGE_QUANTITY"))return list.slice();
    const quantities=currentQuantities();
    return [...list,...[...quantities].map(([id,amount])=>({type:"SET_PRODUCT_AMOUNT",value:{id,amount,unit:"pack"}}))];
  }
  function dedupe(ops){
    const seen=new Set();
    return (ops||[]).filter(op=>{const k=key(op);if(seen.has(k))return false;seen.add(k);return true});
  }
  function ensureReoptimize(ops){
    const out=quantityTargets(stripRebuild(ops));
    if(!out.some(op=>op?.type==="REOPTIMIZE"))out.push({type:"REOPTIMIZE"});
    return dedupe(out);
  }
  function shouldApply(raw,ops){return sameBasket(raw)&&hasStoreChange(ops)}
  function normalizeOps(ops,raw){return shouldApply(raw,ops)?ensureReoptimize(ops):(Array.isArray(ops)?ops:[])}
  function normalizeOrigin(origin,raw,fallbackOps=[]){
    if(!origin||typeof origin!=="object"||!shouldApply(raw,fallbackOps))return origin;
    const explicit=quantityTargets(stripRebuild(origin.explicitOperations));
    const explicitKeys=new Set(explicit.map(key));
    const generated=stripRebuild(origin.generatedOperations).filter(op=>!explicitKeys.has(key(op)));
    const operations=ensureReoptimize([...(generated||[]),...(explicit||[])]);
    return {...origin,explicitOperations:dedupe(explicit),generatedOperations:dedupe(generated),operations};
  }
  function enrich(result,raw){
    if(!result||typeof result!=="object"||!shouldApply(raw,result.operations))return result;
    const operations=normalizeOps(result.operations,raw);
    return {...result,operations,operationOrigin:normalizeOrigin(result.operationOrigin,raw,result.operations)};
  }
  function preservePlanQuantities(plan){
    if(!plan||!activeQuantities?.size)return plan;
    const products=(Array.isArray(plan.products)?plan.products:[]).map(line=>{
      const id=String(line?.sourceId||line?.id||"");
      const quantity=activeQuantities.get(id);
      return quantity?{...line,quantity,requestedMinQuantity:quantity,requestedAmountLabel:`${quantity} уп.`}:line;
    });
    const priced=products.map(line=>({line,unit:Number(line?.unitPrice??line?.price)}));
    const goods=priced.every(x=>Number.isFinite(x.unit))?priced.reduce((sum,x)=>sum+x.unit*(Number(x.line?.quantity)||0),0):null;
    const convenience=Number(plan.convenienceCost);
    const total=Number.isFinite(goods)&&Number.isFinite(convenience)?goods+convenience:goods;
    return {...plan,products,goods,total,quality:Number.isFinite(goods)?plan.quality:"UNKNOWN"};
  }
  function wrapOptimizer(optimizer){
    if(!optimizer?.optimize||optimizer.__sameBasketReprojectionWrapped)return optimizer;
    const original=optimizer.optimize.bind(optimizer);
    Object.defineProperty(optimizer,"__sameBasketReprojectionWrapped",{value:true,configurable:true});
    optimizer.optimize=function(state,...rest){
      const plans=original(state,...rest);
      return activeQuantities?.size&&Array.isArray(plans)?plans.map(preservePlanQuantities):plans;
    };
    return optimizer;
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__sameBasketReprojectionWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__sameBasketReprojectionWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){return enrich(await original(raw,history,...rest),raw)};
    return brain;
  }
  function wrapConversation(conversation){
    if(!conversation?.parse||conversation.__sameBasketReprojectionWrapped)return conversation;
    const originalParse=conversation.parse.bind(conversation);
    const originalApply=typeof conversation.apply==="function"?conversation.apply.bind(conversation):null;
    Object.defineProperty(conversation,"__sameBasketReprojectionWrapped",{value:true,configurable:true});
    conversation.parse=function(raw,...rest){const ops=originalParse(raw,...rest);return normalizeOps(ops,raw)};
    if(originalApply)conversation.apply=function(raw,providedOps,...rest){
      const candidate=Array.isArray(providedOps)&&providedOps.length?normalizeOps(providedOps,raw):conversation.parse(raw);
      if(!shouldApply(raw,candidate))return originalApply(raw,candidate,...rest);
      activeQuantities=currentQuantities();
      try{return originalApply(raw,candidate,...rest)}finally{activeQuantities=null}
    };
    return conversation;
  }

  wrapOptimizer(window.TDShoppingOptimizer);
  wrapBrain(window.TDBaiBrain);
  wrapConversation(window.TDShoppingConversation);
  window.TDBaiSameBasketReprojection={sameBasket,normalizeOps,enrich,wrapOptimizer,wrapBrain,wrapConversation};
})();
