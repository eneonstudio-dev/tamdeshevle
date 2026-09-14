(()=>{
  "use strict";
  if(window.TDBaiCategoryIntents)return;

  const DAIRY=/(?:молочк|молочн(?:ое|ые|ых|ую|ой)|молочк[ауи])/i;
  const REMOVE=/(?:убер(?:и|ите)|удал(?:и|ите)|исключ(?:и|ите)|без|не\s+надо|не\s+нужн)/i;
  const OP={type:"EXCLUDE_TAG",value:"молочка"};
  const key=op=>`${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`;

  function dairyRemoval(raw){
    const text=String(raw||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
    return Boolean(text&&DAIRY.test(text)&&REMOVE.test(text));
  }
  function append(ops){
    const list=Array.isArray(ops)?ops.slice():[];
    if(!list.some(op=>key(op)===key(OP)))list.push({...OP});
    return list;
  }
  function enrich(result,raw){
    if(!dairyRemoval(raw)||!result||typeof result!=="object")return result;
    const operations=append(result.operations);
    let operationOrigin=result.operationOrigin;
    if(operationOrigin&&typeof operationOrigin==="object"){
      const explicitOperations=append(operationOrigin.explicitOperations);
      const explicitKeys=new Set(explicitOperations.map(key));
      const generatedOperations=(Array.isArray(operationOrigin.generatedOperations)?operationOrigin.generatedOperations:[]).filter(op=>!explicitKeys.has(key(op)));
      operationOrigin={...operationOrigin,explicitOperations,generatedOperations,operations:[...explicitOperations,...generatedOperations]};
    }
    return {...result,operations,operationOrigin};
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
    conversation.parse=function(raw,...rest){const ops=original(raw,...rest);return dairyRemoval(raw)?append(ops):ops};
    return conversation;
  }

  wrapBrain(window.TDBaiBrain);
  wrapConversation(window.TDShoppingConversation);
  window.TDBaiCategoryIntents={dairyRemoval,enrich,wrapBrain,wrapConversation};
})();
