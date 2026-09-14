(()=>{
  "use strict";
  if(window.TDBaiSoftTradeoffIntents)return;

  const SOFT_SAVINGS=/(?:подешевле|сэконом(?:ить|ь)?|сделай\s+дешевле|хочу\s+дешевле)/i;
  const HARD_BUDGET=/(?:бюджет(?:ом)?|до|не\s+больше|улож(?:ись|иться)\s+в)\s*\d+|(?:дешевле|меньше|снизь|уменьши)\s*(?:бюджет\s*)?(?:на)?\s*\d+\s*(?:%|р|руб|₽)?|(?:на\s+)?\d+\s*(?:р|руб|₽)?\s*(?:дешевле|меньше)|(?:дешевле|меньше|снизь|уменьши)\s+(?:бюджет\s+)?на\s+(?:косарь|тысячу|тыщу)/i;
  const MEAT_QUALITY=/(?:мяс)[^.!?]{0,48}(?:хорош|качеств|получше|нормальн)|(?:хорош|качеств|получше|нормальн)[^.!?]{0,48}(?:мяс)/i;
  const key=op=>`${String(op?.type||"")}:${JSON.stringify(op?.value??null)}`;
  const textOf=raw=>String(raw||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
  const softSavings=raw=>{const text=textOf(raw);return Boolean(text&&SOFT_SAVINGS.test(text)&&!HARD_BUDGET.test(text))};
  const meatQuality=raw=>MEAT_QUALITY.test(textOf(raw));

  function relativeSavings(raw){
    const text=textOf(raw);
    let match=text.match(/(?:дешевле|меньше|снизь|уменьши)\s*(?:бюджет\s*)?(?:на)?\s*(\d+)\s*%/i);
    if(match)return{kind:"percent",value:Number(match[1])};
    match=text.match(/(?:дешевле|меньше|снизь|уменьши)\s*(?:бюджет\s*)?на\s*(\d+)\s*(?:р|руб|₽)?/i)
      ||text.match(/(?:на\s+)?(\d+)\s*(?:р|руб|₽)?\s*(?:дешевле|меньше)/i);
    if(match)return{kind:"amount",value:Number(match[1])};
    if(/(?:дешевле|меньше|снизь|уменьши)\s+(?:бюджет\s+)?на\s+(?:косарь|тысячу|тыщу)/i.test(text)
      ||/(?:на\s+)?(?:косарь|тысячу|тыщу)\s*(?:дешевле|меньше)/i.test(text))return{kind:"amount",value:1000};
    return null;
  }
  function currentBudget(){
    const value=Number(window.TDShoppingState?.get?.()?.budget);
    return Number.isFinite(value)&&value>0?value:null;
  }
  function explicitRelativeBudget(raw){
    const delta=relativeSavings(raw),current=currentBudget();
    if(!delta||!current)return null;
    if(delta.kind==="percent")return Math.max(1,Math.round(current*(1-Math.max(0,delta.value)/100)));
    return Math.max(1,current-Math.max(0,delta.value));
  }
  function sanitizeForBrain(raw){
    if(!softSavings(raw))return String(raw||"");
    return String(raw||"")
      .replace(/сделай\s+дешевле/gi,"сделай бюджетно")
      .replace(/хочу\s+дешевле/gi,"хочу бюджетно")
      .replace(/подешевле/gi,"бюджетно")
      .replace(/сэконом(?:ить|ь)?/gi,"бюджетно");
  }
  function dedupe(ops){
    const seen=new Set();
    return (ops||[]).filter(op=>{const k=key(op);if(seen.has(k))return false;seen.add(k);return true});
  }
  function add(ops,op){const list=Array.isArray(ops)?ops.slice():[];if(!list.some(x=>key(x)===key(op)))list.push(op);return list}
  function normalizeOperations(ops,raw){
    let list=Array.isArray(ops)?ops.slice():[];
    const relativeBudget=explicitRelativeBudget(raw);
    if(softSavings(raw)){
      list=list.filter(op=>op?.type!=="CHANGE_BUDGET");
      list=add(list,{type:"ADD_PREFERENCE",value:"budget"});
      list=list.filter(op=>op?.type!=="NOTE");
    }else if(relativeBudget!=null){
      list=list.filter(op=>op?.type!=="CHANGE_BUDGET");
      list=add(list,{type:"CHANGE_BUDGET",value:relativeBudget});
    }
    if(meatQuality(raw)){
      list=add(list,{type:"ADD_PREFERENCE",value:"quality_meat"});
      list=list.filter(op=>op?.type!=="NOTE");
    }
    if((softSavings(raw)||meatQuality(raw)||relativeBudget!=null)&&!list.some(op=>op?.type==="REOPTIMIZE"))list.push({type:"REOPTIMIZE"});
    return dedupe(list);
  }
  function enrichGoal(goal,raw){
    if(!goal||typeof goal!=="object")return goal;
    const preferences=Array.isArray(goal.preferences)?goal.preferences.slice():[];
    const relativeBudget=explicitRelativeBudget(raw);
    if(softSavings(raw)&&!preferences.includes("budget"))preferences.push("budget");
    if(meatQuality(raw)&&!preferences.includes("quality_meat"))preferences.push("quality_meat");
    return {...goal,preferences,...(relativeBudget!=null?{budget:relativeBudget}:{})};
  }
  function normalizeOrigin(origin,raw){
    if(!origin||typeof origin!=="object")return origin;
    const explicitOperations=normalizeOperations(origin.explicitOperations,raw);
    const explicitKeys=new Set(explicitOperations.map(key));
    const generatedOperations=normalizeOperations(origin.generatedOperations,raw).filter(op=>!explicitKeys.has(key(op)));
    return {...origin,explicitOperations,generatedOperations,operations:dedupe([...explicitOperations,...generatedOperations])};
  }
  function enrich(result,raw){
    if(!result||typeof result!=="object")return result;
    return {...result,operations:normalizeOperations(result.operations,raw),goal:enrichGoal(result.goal,raw),operationOrigin:normalizeOrigin(result.operationOrigin,raw)};
  }
  function wrapBrain(brain){
    if(!brain?.route||brain.__softTradeoffIntentsWrapped)return brain;
    const original=brain.route.bind(brain);
    Object.defineProperty(brain,"__softTradeoffIntentsWrapped",{value:true,configurable:true});
    brain.route=async function(raw,history=[],...rest){return enrich(await original(sanitizeForBrain(raw),history,...rest),raw)};
    return brain;
  }
  function wrapConversation(conversation){
    if(!conversation?.parse||conversation.__softTradeoffIntentsWrapped)return conversation;
    const original=conversation.parse.bind(conversation);
    Object.defineProperty(conversation,"__softTradeoffIntentsWrapped",{value:true,configurable:true});
    conversation.parse=function(raw,...rest){return normalizeOperations(original(raw,...rest),raw)};
    return conversation;
  }

  wrapBrain(window.TDBaiBrain);
  wrapConversation(window.TDShoppingConversation);
  window.TDBaiSoftTradeoffIntents={softSavings,meatQuality,relativeSavings,explicitRelativeBudget,sanitizeForBrain,normalizeOperations,enrich,wrapBrain,wrapConversation};
})();
