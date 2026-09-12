(()=>{"use strict";
const K="td_bai_memory_v1",u=a=>[...new Set((a||[]).filter(Boolean))],clone=v=>JSON.parse(JSON.stringify(v));
const finite=v=>Number.isFinite(Number(v))?Number(v):null,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blank=()=>({version:5,turns:0,preferences:[],productsLiked:[],productsAvoided:[],productSignals:{},preferenceSignals:{},outcomeSignals:{},tradeoffSignals:[],cooking:null,usualBudget:null,usualPeople:null,storeMode:null,corrections:0,acceptedPlans:0,correctedPlans:0,pendingRecommendation:null});
let p;try{p={...blank(),...JSON.parse(localStorage.getItem(K)||"{}")}}catch{p=blank()}
p.productSignals=p.productSignals||{};p.preferenceSignals=p.preferenceSignals||{};p.outcomeSignals=p.outcomeSignals||{};p.tradeoffSignals=Array.isArray(p.tradeoffSignals)?p.tradeoffSignals.slice(-30):[];p.version=5;
let history=[];
function save(){try{localStorage.setItem(K,JSON.stringify(p))}catch{}return p}
function bump(map,key,field,amount=1){if(!key)return;map[key]=map[key]||{};map[key][field]=(map[key][field]||0)+amount}
function remember(){history.push(clone(p));if(history.length>20)history=history.slice(-20)}
function normalize(){p={...blank(),...p};p.productSignals=p.productSignals||{};p.preferenceSignals=p.preferenceSignals||{};p.outcomeSignals=p.outcomeSignals||{};p.tradeoffSignals=Array.isArray(p.tradeoffSignals)?p.tradeoffSignals.slice(-30):[];p.version=5;return p}
function undo(){if(!history.length)return save();p=history.pop();normalize();return save()}
function outcome(id){return p.outcomeSignals?.[id]||{}}
function productAffinity(id){const s=p.productSignals?.[id]||{},o=outcome(id);return(s.added||0)*1.5+(o.accepted||0)*2.5+(o.replacedTo||0)*2-(s.removed||0)*2.5-(o.rejected||0)*3-(o.replacedAway||0)*3+(o.addedAfterRecommendation||0)}
function noteRecommendation(value={}){const products=u((value.productIds||value.products||[]).map(x=>String(x?.id||x)).filter(Boolean)).slice(0,20);if(!products.length)return null;p.pendingRecommendation={products,source:String(value.source||"bai"),strategy:value.strategy||value.id||null,title:value.title||null,at:Date.now()};save();return clone(p.pendingRecommendation)}
function clearPending(){p.pendingRecommendation=null}
function pendingFresh(){const q=p.pendingRecommendation;if(!q)return null;if(Date.now()-Number(q.at||0)>12*60*60*1000){clearPending();return null}return q}
function feedbackText(raw){return /(?:оставь так|так и оставь|бер[её]м|подходит|норм(?:ально)?|годится|мне нравится|ок(?:ей)?\b)/i.test(String(raw||""))}
function corrective(ops){return(ops||[]).some(o=>["REMOVE_PRODUCT","REPLACE_PRODUCT","SET_ONLY_PRODUCTS","RESET_BASKET"].includes(o?.type))}
function learnPendingOutcome(raw,ops){const q=pendingFresh();if(!q)return;const set=new Set(q.products),t=String(raw||"");let changed=false;
  if(feedbackText(t)&&!corrective(ops)){for(const id of q.products)bump(p.outcomeSignals,id,"accepted");p.acceptedPlans++;clearPending();return}
  for(const o of ops||[]){if(o?.type==="REMOVE_PRODUCT"&&set.has(String(o.value))){bump(p.outcomeSignals,String(o.value),"rejected");set.delete(String(o.value));changed=true}
    if(o?.type==="REPLACE_PRODUCT"&&o.value){const from=String(o.value.from),to=String(o.value.to);if(set.has(from)){bump(p.outcomeSignals,from,"replacedAway");bump(p.outcomeSignals,to,"replacedTo");set.delete(from);changed=true}}
    if(o?.type==="ADD_PRODUCT"&&!set.has(String(o.value))){bump(p.outcomeSignals,String(o.value),"addedAfterRecommendation");changed=true}}
  if(changed){p.correctedPlans++;p.pendingRecommendation=set.size?{...q,products:[...set],at:Date.now()}:null}
}
function explicitOps(r){const all=Array.isArray(r?.operations)?r.operations:[];if(r?.journey?.autoApplied&&Array.isArray(r.journey.explicitOperations))return r.journey.explicitOperations;return all}
function learn(raw,r){const all=Array.isArray(r?.operations)?r.operations:[],ops=explicitOps(r);if(all.some(o=>o?.type==="UNDO"))return undo();remember();p.turns++;learnPendingOutcome(raw,ops);
  const manualStrategy=/^\s*выбираю\s+вариант/i.test(String(raw||""));const learnOps=manualStrategy?all:ops;
  for(const o of learnOps){if(["ADD_PREFERENCE","PREFER"].includes(o.type)){const v=String(o.value);p.preferences=u([...p.preferences,v]);bump(p.preferenceSignals,v,"chosen")}if(o.type==="SET_COOKING")p.cooking=o.value;if(o.type==="SET_PEOPLE")p.usualPeople=Number(o.value)||p.usualPeople;if(o.type==="CHANGE_BUDGET"&&Number(o.value)>0)p.usualBudget=Number(o.value);if(o.type==="SET_MODE")p.storeMode=o.value;if(["ADD_PRODUCT","REQUIRE"].includes(o.type)){const id=String(o.value);p.productsLiked=u([...p.productsLiked,id]);bump(p.productSignals,id,"added");if(manualStrategy)bump(p.outcomeSignals,id,"accepted")}if(o.type==="SET_ONLY_PRODUCTS"&&Array.isArray(o.value))for(const id of o.value){p.productsLiked=u([...p.productsLiked,String(id)]);bump(p.productSignals,String(id),"added")}if(o.type==="REMOVE_PRODUCT"){const id=String(o.value);p.productsAvoided=u([...p.productsAvoided,id]);bump(p.productSignals,id,"removed")}if(o.type==="REPLACE_PRODUCT"&&o.value){const from=String(o.value.from),to=String(o.value.to);p.productsAvoided=u([...p.productsAvoided,from]);p.productsLiked=u([...p.productsLiked,to]);bump(p.productSignals,from,"removed");bump(p.productSignals,to,"added")}}
  if(/не люблю|не нравится|не предлагай|не бери|больше не/.test(String(raw||"").toLowerCase()))p.corrections++;
  const rec=r?.journey?.recommendation;if(rec?.productIds?.length)noteRecommendation({...rec,source:"journey"});
  return save()}
function noteTradeoffChoice(value={}){
  const choice=value.choice==="split"?"split":value.choice==="one"?"one":null;if(!choice)return null;
  remember();
  const signal={choice,recommendedChoice:value.recommendedChoice==="split"?"split":value.recommendedChoice==="one"?"one":null,grossSaving:finite(value.grossSaving),netSaving:finite(value.netSaving),timeMinutes:finite(value.timeMinutes),operationalCost:finite(value.operationalCost),mode:String(value.mode||"walk"),confidence:String(value.confidence||"estimated"),override:Boolean(value.override),source:String(value.source||"explicit"),at:Number(value.at)||Date.now()};
  p.tradeoffSignals=[...(p.tradeoffSignals||[]),signal].slice(-30);save();return clone(signal)
}
function tradeoffProfile(defaultThreshold=250,mode="walk"){
  const fallback=clamp(Math.round(Number(defaultThreshold)||250),50,2500),all=(p.tradeoffSignals||[]).filter(x=>!mode||String(x.mode||"walk")===String(mode));
  const usable=all.filter(x=>Number.isFinite(Number(x.netSaving))&&Number(x.netSaving)>=0),sampleCount=all.length,usableCount=usable.length;
  if(!usableCount)return{sampleCount,usableCount,thresholdRub:fallback,confidence:0,tendency:"balanced",personalized:false,errorRate:null};
  const values=u(usable.map(x=>clamp(Math.round(Number(x.netSaving)),50,2500))),candidates=u([50,fallback,...values.map(v=>clamp(v,50,2500)),2500]).sort((a,b)=>a-b);
  let best={threshold:fallback,error:Infinity,total:0};
  for(const threshold of candidates){let error=0,total=0;usable.forEach((x,index)=>{const recency=.8+.2*((index+1)/usable.length),weight=recency*(x.override?1.5:1),predicted=Number(x.netSaving)>=threshold?"split":"one";total+=weight;if(predicted!==x.choice)error+=weight});const normalized=total?error/total:1;if(normalized<best.error-1e-9||(Math.abs(normalized-best.error)<1e-9&&Math.abs(threshold-fallback)<Math.abs(best.threshold-fallback)))best={threshold,error:normalized,total};}
  const consistency=clamp(1-best.error,0,1),evidence=clamp(usableCount/5,0,1),confidence=clamp(consistency*evidence,0,1),thresholdRub=Math.round(fallback*(1-confidence)+best.threshold*confidence),personalized=usableCount>=2&&confidence>=.3;
  let tendency="balanced";if(personalized&&thresholdRub>=fallback*1.25)tendency="convenience";else if(personalized&&thresholdRub<=fallback*.75)tendency="saving";
  return{sampleCount,usableCount,thresholdRub:clamp(thresholdRub,50,2500),rawThresholdRub:best.threshold,confidence:Number(confidence.toFixed(3)),tendency,personalized,errorRate:Number(best.error.toFixed(3))}
}
function signal(id){return p.productSignals?.[id]||{}}
function shouldAvoid(id){const s=signal(id),o=outcome(id),negative=(s.removed||0)+(o.rejected||0)*1.5+(o.replacedAway||0)*1.5,positive=(s.added||0)+(o.accepted||0)+(o.replacedTo||0);return negative>=3&&negative>=positive+1.5}
function avoidList(){return u([...Object.keys(p.productSignals||{}),...Object.keys(p.outcomeSignals||{})]).filter(shouldAvoid)}
function filterRequired(ids){return (ids||[]).filter(id=>!shouldAvoid(id))}
function scoreStrategy(strategy){let delta=0,reasons=[];const id=strategy?.id,ops=strategy?.operations||[],required=u([...(strategy?.productIds||[]),...ops.filter(o=>o.type==="REQUIRE").map(o=>String(o.value))]),avoided=required.filter(shouldAvoid);if(avoided.length){delta-=70*avoided.length;reasons.push(`не тащу ${avoided.length} товар(а), которые ты регулярно убираешь`)}const prefs=p.preferences||[];if(id==="easy"&&p.cooking==="minimal"){delta+=24;reasons.push("ты обычно выбираешь минимум готовки")}if(id==="economy"&&prefs.includes("budget")){delta+=22;reasons.push("для тебя часто важна цена")}if(id==="hearty"&&prefs.includes("hearty")){delta+=22;reasons.push("ты чаще выбираешь сытность")}if(id==="healthy"&&prefs.includes("healthy")){delta+=22;reasons.push("ты чаще выбираешь более обычную еду и фрукты")}if(p.storeMode==="one"&&Number(strategy?.stores)<=1){delta+=14;reasons.push("ты обычно предпочитаешь один магазин")}if(p.usualBudget&&strategy?.total){if(strategy.total<=p.usualBudget)delta+=8;else if(strategy.total>p.usualBudget*1.1)delta-=12}const affinity=required.reduce((n,x)=>n+productAffinity(x),0);delta+=Math.max(-24,Math.min(18,Math.round(affinity*1.5)));if(affinity>=4)reasons.push("часть этих продуктов ты раньше оставлял");return{delta,reasons:u(reasons).slice(0,2),avoided}}
function hint(){const b=[];if(p.cooking==="minimal")b.push("обычно без лишней готовки");if(p.usualPeople>1)b.push(`обычно на ${p.usualPeople}`);if(p.preferences.includes("budget"))b.push("цена важна");if(p.preferences.includes("hearty"))b.push("любишь сытнее");const tp=tradeoffProfile(250,"walk");if(tp.personalized&&tp.confidence>=.45){if(tp.tendency==="convenience")b.push("обычно не едешь во второй магазин ради небольшой экономии");if(tp.tendency==="saving")b.push("обычно готов заехать ещё в магазин ради заметной экономии")}const n=avoidList().length;if(n)b.push(`${n} товар(а) больше не предлагаю автоматически`);if(p.correctedPlans)b.push(`учёл ${p.correctedPlans} правок моих корзин`);return b.slice(0,3).join(", ")}
function clear(){p=blank();history=[];try{localStorage.removeItem(K)}catch{}return p}
window.TDBaiMemory={get:()=>clone(p),learn,hint,clear,signal,outcome,productAffinity,shouldAvoid,avoidList,filterRequired,scoreStrategy,noteRecommendation,pending:()=>clone(p.pendingRecommendation),isFeedback:feedbackText,noteTradeoffChoice,tradeoffProfile};
import("./bai-learning-safety.js?v=20260912-safety-v1").then(()=>import("./bai-learning-loop.js?v=20260912-learning-v2")).catch(()=>{});
})();
