(()=>{
  "use strict";
  if(window.TDBaiSameBasketReprojection)return;

  const SAME_PHRASES=["то же самое","ту же корзину","те же товары","тот же набор","такую же корзину"];
  const DROP=new Set(["RESET_BASKET","CLEAR_ONLY","SET_ONLY_PRODUCTS"]);
  const key=op=>`${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`;
  const textOf=raw=>String(raw||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
  const sameBasket=raw=>SAME_PHRASES.some(phrase=>textOf(raw).includes(phrase));
  const hasStoreChange=ops=>(Array.isArray(ops)?ops:[]).some(op=>op?.type==="CHANGE_STORE"&&op?.value);

  function stripRebuild(ops){
    return (Array.isArray(ops)?ops:[]).filter(op=>{
      if(DROP.has(op?.type))return false;
      if(op?.type==="SET_INTENT"&&["build","only"].includes(String(op?.value||"")))return false;
      return true;
    });
  }
  function ensureReoptimize(ops){
    const out=stripRebuild(ops);
    if(!out.some(op=>op?.type==="REOPTIMIZE"))out.push({type:"REOPTIMIZE"});
    const seen=new Set();
    return out.filter(op=>{const k=key(op);if(seen.has(k))return false;seen.add(k);return true});
  }
  function shouldApply(raw,ops){return sameBasket(raw)&&hasStoreChange(ops)}
  function normalizeOps(ops,raw){return shouldApply(raw,ops)?ensureReoptimize(ops):(Array.isArray(ops)?ops:[])}
  function normalizeOrigin(origin,raw,fallbackOps=[]){
    if(!origin||typeof origin!=="object"||!shouldApply(raw,fallbackOps))return origin;
    const explicit=stripRebuild(origin.explicitOperations);
    const explicitKeys=new Set(explicit.map(key));
    const generated=stripRebuild(origin.generatedOperations).filter(op=>!explicitKeys.has(key(op)));
    const operations=ensureReoptimize([...(generated||[]),...(explicit||[])]);
    return {...origin,explicitOperations:explicit,generatedOperations:generated,operations};
  }
  function enrich(result,raw){
    if(!result||typeof result!=="object"||!shouldApply(raw,result.operations))return result;
    const operations=normalizeOps(result.operations,raw);
    return {...result,operations,operationOrigin:normalizeOrigin(result.operationOrigin,raw,result.operations)};
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
    const original=conversation.parse.bind(conversation);
    Object.defineProperty(conversation,"__sameBasketReprojectionWrapped",{value:true,configurable:true});
    conversation.parse=function(raw,...rest){const ops=original(raw,...rest);return normalizeOps(ops,raw)};
    return conversation;
  }

  wrapBrain(window.TDBaiBrain);
  wrapConversation(window.TDShoppingConversation);
  window.TDBaiSameBasketReprojection={sameBasket,normalizeOps,enrich,wrapBrain,wrapConversation};
})();
