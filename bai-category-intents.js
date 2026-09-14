(()=>{
  "use strict";
  if(window.TDBaiCategoryIntents)return;

  const DAIRY=/(?:молочк|молочн(?:ое|ые|ых|ую|ой)|молочк[ауи])/i;
  const REMOVE=/(?:убер(?:и|ите)|удал(?:и|ите)|исключ(?:и|ите)|без|не\s+надо|не\s+нужн)/i;
  const HEALTHY=/(?:^|[^а-яa-z0-9])пп(?=$|[^а-яa-z0-9])|полезн|здоров/i;
  const NO_SUGAR=/(?:без\s+сахар|сахар(?:а)?\s+(?:не\s+надо|не\s+нужн|исключ))/i;
  const key=op=>`${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`;
  const low=raw=>String(raw||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();

  function dairyRemoval(raw){const text=low(raw);return Boolean(text&&DAIRY.test(text)&&REMOVE.test(text))}
  function healthyIntent(raw){return HEALTHY.test(low(raw))}
  function noSugarIntent(raw){return NO_SUGAR.test(low(raw))}
  function dedupe(ops){
    const seen=new Set();
    return (ops||[]).filter(op=>{const k=key(op);if(seen.has(k))return false;seen.add(k);return true});
  }
  function add(ops,op){const list=Array.isArray(ops)?ops.slice():[];if(!list.some(x=>key(x)===key(op)))list.push(op);return list}
  function normalizeOperations(ops,raw){
    let list=Array.isArray(ops)?ops.slice():[];
    if(dairyRemoval(raw))list=add(list,{type:"EXCLUDE_TAG",value:"молочка"});
    if(healthyIntent(raw))list=add(list,{type:"ADD_PREFERENCE",value:"healthy"});
    if(noSugarIntent(raw)){
      list=list.filter(op=>!(["REMOVE_PRODUCT","ADD_PRODUCT","REQUIRE"].includes(op?.type)&&String(op?.value||"")==="sugar"));
      list=add(list,{type:"EXCLUDE_TAG",value:"сахар"});
    }
    return dedupe(list);
  }
  function enrichGoal(goal,raw){
    if(!goal||typeof goal!=="object"||!healthyIntent(raw))return goal;
    const preferences=Array.isArray(goal.preferences)?goal.preferences.slice():[];
    if(!preferences.includes("healthy"))preferences.push("healthy");
    return {...goal,preferences};
  }
  function enrich(result,raw){
    if(!result||typeof result!=="object")return result;
    const operations=normalizeOperations(result.operations,raw);
    let operationOrigin=result.operationOrigin;
    if(operationOrigin&&typeof operationOrigin==="object"){
      const explicitOperations=normalizeOperations(operationOrigin.explicitOperations,raw);
      const explicitKeys=new Set(explicitOperations.map(key));
      const generatedOperations=normalizeOperations(operationOrigin.generatedOperations,raw).filter(op=>!explicitKeys.has(key(op)));
      operationOrigin={...operationOrigin,explicitOperations,generatedOperations,operations:dedupe([...explicitOperations,...generatedOperations])};
    }
    return {...result,operations,goal:enrichGoal(result.goal,raw),operationOrigin};
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__baiCategoryIntentsWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiCategoryIntentsWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){return enrich(await original(raw,history,...rest),raw)};
    return brain;
  }
  function wrapConversation(conversation){
    if(!conversation?.parse||conversation.__baiCategoryIntentsWrapped)return conversation;
    const original=conversation.parse.bind(conversation);
    Object.defineProperty(conversation,"__baiCategoryIntentsWrapped",{value:true,configurable:true});
    conversation.parse=function(raw,...rest){return normalizeOperations(original(raw,...rest),raw)};
    return conversation;
  }

  wrapBrain(window.TDBaiBrain);
  wrapConversation(window.TDShoppingConversation);
  window.TDBaiCategoryIntents={dairyRemoval,healthyIntent,noSugarIntent,normalizeOperations,enrich,wrapBrain,wrapConversation};
})();
