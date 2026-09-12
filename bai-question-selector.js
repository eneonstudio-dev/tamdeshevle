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
    const explicit=routed?.operations||[],rec=goal?.recommend?.()||{},out=[];
    if(!hasType(explicit,"SET_DURATION")&&!(rec.duration?.confidence>=.78)&&Math.max(1,Number(state?.duration)||1)<=1)out.push({id:"duration",score:95,expected:"SET_DURATION",question:"На сколько дней собираем корзину?",suggestions:["На 3 дня","На неделю","Сам реши"]});
    if(!hasType(explicit,"CHANGE_BUDGET")&&!state?.budget&&!(rec.budget?.confidence>=.72))out.push({id:"budget",score:/дешев|эконом|бюджет|выгод/.test(low(text))?88:58,expected:"CHANGE_BUDGET",question:"Какой ориентир по бюджету?",suggestions:["До 2000 ₽","До 3000 ₽","Без лимита, сам реши"]});
    if(!hasType(explicit,"SET_PEOPLE")&&!(rec.people?.confidence>=.78)&&Math.max(1,Number(state?.peopleCount)||1)===1&&!/\b(?:я\s+один|мне\s+одному|для\s+себя)\b/.test(low(text)))out.push({id:"people",score:54,expected:"SET_PEOPLE",question:"На сколько человек собираем?",suggestions:["На одного","На двоих","Сам реши"]});
    if((pantry?.count?.()||0)===0&&/(дома|запас|лишн|не покупать повторно|что уже есть)/.test(low(text)))out.push({id:"pantry",score:72,expected:"HAS_AT_HOME",question:"Что из базовых продуктов уже есть дома?",suggestions:["Дома ничего нет","Дома есть масло и гречка","Сам реши"]});
    return out.sort((a,b)=>b.score-a.score);
  }
  function choose(args={}){const best=candidateList(args)[0];if(!best)return null;pending={id:best.id,expected:best.expected,originalText:String(args.text||""),originalOperations:clone(args.routed?.operations||[]),at:Date.now()};return{...best}}
  function answered(raw,routed){if(!pending)return false;if(noQuestions(raw))return true;if((routed?.operations||[]).some(op=>op?.type===pending.expected))return true;if(pending.id==="pantry"&&/(ничего\s+(?:нет|не осталось)|пусто)/.test(low(raw)))return true;return false}
  function resume(raw,routed){if(!pending||Date.now()-pending.at>20*60*1000){pending=null;return null}if(!answered(raw,routed))return null;const prev=pending;pending=null;const operations=[...(prev.originalOperations||[]),...((routed?.operations)||[])];return{text:`${prev.originalText} ${String(raw||"")}`.trim(),operations,question:prev.id}}
  function askResult(base,best){return{...base,provider:"bai-question-selector",operations:[{type:"ASK_CLARIFICATION",value:best.question}],reply:best.question,suggestions:best.suggestions,expectsAnswer:true,questionSelector:{id:best.id,score:best.score}}}
  function clear(){pending=null}
  window.TDBaiQuestionSelector={candidateList,choose,resume,askResult,clear,pending:()=>clone(pending),noQuestions};
})();
