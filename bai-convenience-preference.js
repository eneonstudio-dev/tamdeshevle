(()=>{
  "use strict";
  if(window.TDBaiConveniencePreference)return;

  const SPEED=/(?:побыстрее|поскорее|\bбыстрее\b|\bскорее\b|скорост(?:ь|и)|врем(?:я|ени)\s+(?:важн|главн))/i;
  const PRICE_SECONDARY=/(?:цена\s+не\s+(?:главн|важн)|цена\s+не\s+приоритет|(?:скорост|врем)[^.!?]{0,40}важнее[^.!?]{0,24}цен|быстрее[^.!?]{0,40}(?:чем|а не)[^.!?]{0,20}(?:дешев|цен))/i;
  const OP={type:"ADD_PREFERENCE",value:"convenience"};
  const key=op=>`${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`;

  function matches(raw){
    const text=String(raw||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
    return Boolean(text&&SPEED.test(text)&&PRICE_SECONDARY.test(text));
  }
  function append(ops){
    const list=Array.isArray(ops)?ops.slice():[];
    const seen=new Set(list.map(key));
    if(!seen.has(key(OP)))list.push({...OP});
    return list;
  }
  function addGoalPreference(goal){
    if(!goal||typeof goal!=="object")return goal;
    const preferences=Array.isArray(goal.preferences)?goal.preferences.slice():[];
    if(!preferences.includes("convenience"))preferences.push("convenience");
    return {...goal,preferences};
  }
  function addOrigin(origin){
    if(!origin||typeof origin!=="object")return origin;
    const explicitOperations=append(origin.explicitOperations);
    const explicitKeys=new Set(explicitOperations.map(key));
    const generatedOperations=(Array.isArray(origin.generatedOperations)?origin.generatedOperations:[]).filter(op=>!explicitKeys.has(key(op)));
    return {...origin,explicitOperations,generatedOperations,operations:append([...(generatedOperations||[]),...explicitOperations])};
  }
  function enrich(result,raw){
    if(!matches(raw)||!result||typeof result!=="object")return result;
    return {...result,operations:append(result.operations),goal:addGoalPreference(result.goal),operationOrigin:addOrigin(result.operationOrigin)};
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__baiConveniencePreferenceWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__baiConveniencePreferenceWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){return enrich(await original(raw,history,...rest),raw)};
    return brain;
  }
  function wrapConversation(conversation){
    if(!conversation?.parse||conversation.__baiConveniencePreferenceWrapped)return conversation;
    const original=conversation.parse.bind(conversation);
    Object.defineProperty(conversation,"__baiConveniencePreferenceWrapped",{value:true,configurable:true});
    conversation.parse=function(raw,...rest){const ops=original(raw,...rest);return matches(raw)?append(ops):ops};
    return conversation;
  }

  wrapBrain(window.TDBaiBrain);
  wrapConversation(window.TDShoppingConversation);
  window.TDBaiConveniencePreference={matches,enrich,wrapBrain,wrapConversation};
})();
