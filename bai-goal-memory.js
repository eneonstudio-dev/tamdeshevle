(()=>{
  "use strict";
  if(window.TDBaiGoalMemory)return;
  const KEY="td_bai_goal_memory_v1",MAX=12;
  const clone=v=>JSON.parse(JSON.stringify(v));
  const low=v=>String(v||"").toLowerCase().replace(/ё/g,"е");
  const blank=()=>({version:1,budgets:[],people:[],durations:[],cooking:[],modes:[]});
  let state;try{state={...blank(),...JSON.parse(localStorage.getItem(KEY)||"{}")}}catch{state=blank()}
  for(const k of ["budgets","people","durations","cooking","modes"])if(!Array.isArray(state[k]))state[k]=[];
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}return state}
  function push(key,value){if(value==null||value==="")return;state[key].push(value);if(state[key].length>MAX)state[key]=state[key].slice(-MAX);save()}
  function mode(values){const map=new Map();for(const v of values)map.set(String(v),(map.get(String(v))||0)+1);let best=null,count=0;for(const [v,n] of map)if(n>count){best=v;count=n}return{value:best,count,total:values.length,confidence:values.length?count/values.length:0}}
  function median(values){const a=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const i=Math.floor(a.length/2);return a.length%2?a[i]:Math.round((a[i-1]+a[i])/2)}
  function budgetRecommendation(){const a=state.budgets.map(Number).filter(x=>x>0);if(a.length<2)return null;const m=median(a),spread=Math.max(...a)-Math.min(...a),stable=spread<=Math.max(600,m*.45);return{value:m,confidence:stable?Math.min(.94,.58+a.length*.08):.42,samples:a.length}}
  function categorical(key,number=false){const r=mode(state[key]);if(r.total<2||r.confidence<.66)return null;return{value:number?Number(r.value):r.value,confidence:Math.min(.96,.55+r.confidence*.4),samples:r.total}}
  function recommend(){return{budget:budgetRecommendation(),people:categorical("people",true),duration:categorical("durations",true),cooking:categorical("cooking"),mode:categorical("modes")}}
  function grounded(raw,op){const t=low(raw);if(op.type==="CHANGE_BUDGET")return /(?:бюджет|до|максимум|на)\s*\d[\d\s.,]*\s*(?:р|₽|руб)/.test(t);if(op.type==="SET_PEOPLE")return /(?:человек|чел\.?|персон|едок)|\bнас\s+(?:\d+|один|два|двое|три|трое|четыре|четверо)|\b(?:я\s+один|мне\s+одному|для\s+себя)\b/.test(t);if(op.type==="SET_DURATION")return /(?:на|примерно на)\s+(?:\d+|[а-я]+)\s*(?:день|дня|дней|сут|недел)|\b(?:на неделю|на выходные)\b/.test(t);if(op.type==="SET_COOKING")return /готовить|без готовки|быстро|минимум готовки/.test(t);if(op.type==="SET_MODE")return /один магазин|в одном магазин|нескольк.*магаз|разным магазин|где дешевле/.test(t);return false}
  function observe(raw,operations=[]){for(const op of operations||[]){if(!op||!grounded(raw,op))continue;if(op.type==="CHANGE_BUDGET"&&Number(op.value)>0)push("budgets",Number(op.value));if(op.type==="SET_PEOPLE"&&Number(op.value)>0)push("people",Number(op.value));if(op.type==="SET_DURATION"&&Number(op.value)>0)push("durations",Number(op.value));if(op.type==="SET_COOKING")push("cooking",String(op.value));if(op.type==="SET_MODE")push("modes",String(op.value))}return recommend()}
  function defaultOperations(explicitOps=[]){const types=new Set((explicitOps||[]).map(x=>x?.type)),r=recommend(),out=[];if(!types.has("CHANGE_BUDGET")&&r.budget?.confidence>=.72)out.push({type:"CHANGE_BUDGET",value:r.budget.value,_source:"goal-memory"});if(!types.has("SET_PEOPLE")&&r.people?.confidence>=.78)out.push({type:"SET_PEOPLE",value:r.people.value,_source:"goal-memory"});if(!types.has("SET_DURATION")&&r.duration?.confidence>=.78)out.push({type:"SET_DURATION",value:r.duration.value,_source:"goal-memory"});if(!types.has("SET_COOKING")&&r.cooking?.confidence>=.78)out.push({type:"SET_COOKING",value:r.cooking.value,_source:"goal-memory"});if(!types.has("SET_MODE")&&r.mode?.confidence>=.82)out.push({type:"SET_MODE",value:r.mode.value,_source:"goal-memory"});return out}
  function hint(){const r=recommend(),bits=[];if(r.duration?.confidence>=.78)bits.push(`обычно на ${r.duration.value} дн.`);if(r.people?.confidence>=.78)bits.push(`обычно на ${r.people.value} чел.`);if(r.budget?.confidence>=.72)bits.push(`обычный бюджет около ${r.budget.value} ₽`);if(r.cooking?.value==="minimal"&&r.cooking.confidence>=.78)bits.push("обычно минимум готовки");if(r.mode?.value==="one"&&r.mode.confidence>=.82)bits.push("чаще один магазин");return bits.slice(0,3).join(", ")}
  function clear(){state=blank();try{localStorage.removeItem(KEY)}catch{}return state}
  window.TDBaiGoalMemory={observe,recommend,defaultOperations,hint,clear,get:()=>clone(state)};
})();
