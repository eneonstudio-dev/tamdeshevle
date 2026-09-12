(()=>{
  "use strict";
  if(window.TDBaiQuestionSelector)return;
  const clone=v=>JSON.parse(JSON.stringify(v||{}));
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  let pending=null;
  const noQuestions=text=>/сам реши|реши сам|на тво[её] усмотрение|без вопросов|не спрашивай/.test(low(text));
  const hasType=(ops,type)=>(ops||[]).some(op=>op?.type===type);
  function candidateList({text,routed,state,goal,pantry}={}){
    if(noQuestions(text)||routed?.expectsAnswer)return[];
    const explicit=routed?.operations||[],t=low(text),out=[];
    // Missing optional context is not a blocker. Build immediately with honest
    // defaults (1 person, 1 day, no hard budget) and let the user refine it.
    // Ask only when the user explicitly supplied an incomplete constraint.
    if(!hasType(explicit,"SET_DURATION")&&/(?:на|примерно на)\s+(?:несколько|сколько-то|пару-тройку|пару)\s+(?:дней|недель)(?=$|[\s,.!?])/.test(t))out.push({id:"duration",score:95,expected:"SET_DURATION",question:"На сколько дней собираем корзину?",suggestions:["На 3 дня","На неделю","Сам реши"]});
    if(!hasType(explicit,"CHANGE_BUDGET")&&/(?:бюджет|уложись|не дороже|максимум)\s*(?:не знаю|пока не знаю|без цифр)?\s*$/.test(t))out.push({id:"budget",score:90,expected:"CHANGE_BUDGET",question:"Какой максимум по бюджету?",suggestions:["До 2000 ₽","До 3000 ₽","Без лимита, сам реши"]});
    if(!hasType(explicit,"SET_PEOPLE")&&/(?:на|для)\s+(?:компанию|семью|нас всех)(?=$|[\s,.!?])/.test(t))out.push({id:"people",score:85,expected:"SET_PEOPLE",question:"На сколько человек собираем?",suggestions:["На одного","На двоих","Сам реши"]});
    if((pantry?.count?.()||0)===0&&/(?:дома|у меня)\s+(?:уже\s+)?(?:есть|осталось)\s*$/.test(t))out.push({id:"pantry",score:82,expected:"HAS_AT_HOME",question:"Что именно уже есть дома?",suggestions:["Дома ничего нет","Дома есть масло и гречка","Сам реши"]});
    return out.sort((a,b)=>b.score-a.score);
  }
  function choose(args={}){const best=candidateList(args)[0];if(!best)return null;pending={id:best.id,expected:best.expected,originalText:String(args.text||""),originalOperations:clone(args.routed?.operations||[]),at:Date.now()};return{...best}}
  function answered(raw,routed){if(!pending)return false;if(noQuestions(raw))return true;if((routed?.operations||[]).some(op=>op?.type===pending.expected))return true;if(pending.id==="pantry"&&/(ничего\s+(?:нет|не осталось)|пусто)/.test(low(raw)))return true;return false}
  function resume(raw,routed){if(!pending||Date.now()-pending.at>20*60*1000){pending=null;return null}if(!answered(raw,routed))return null;const prev=pending;pending=null;const operations=[...(prev.originalOperations||[]),...((routed?.operations)||[])];return{text:`${prev.originalText} ${String(raw||"")}`.trim(),operations,question:prev.id}}
  function askResult(base,best){return{...base,provider:"bai-question-selector",operations:[{type:"ASK_CLARIFICATION",value:best.question}],reply:best.question,suggestions:best.suggestions,expectsAnswer:true,questionSelector:{id:best.id,score:best.score}}}
  function clear(){pending=null}
  window.TDBaiQuestionSelector={candidateList,choose,resume,askResult,clear,pending:()=>clone(pending),noQuestions};
})();
