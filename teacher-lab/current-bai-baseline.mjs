import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {buildCorpus} from './corpus-builder.mjs';

const LEGACY={bread:'bread_dark',chicken:'chicken_fil',eggs:'eggs_c1',buck:'buckwheat'};
const PRODUCTS=[
  ['chicken_fil','Куриное филе','1 кг','Птица',['мясо','белок']],['ham','Ветчина','400 г','Другой бренд',['мясо']],
  ['eggs_c1','Яйца','10 шт','Ферма',['белок']],['bread_dark','Хлеб','400 г','Пекарня',['основа']],
  ['milk','Молоко','1 л','Ферма',['молочное']],['water','Вода','5 л','',['напиток']],['banana','Бананы','1 кг','',['фрукты']],
  ['apple','Яблоки','1 кг','',['фрукты']],['buckwheat','Гречка','800 г','',['основа']],['pasta','Макароны','450 г','',['основа']],
  ['dumplings','Пельмени','800 г','',['готовое']],['noodles','Лапша','300 г','',['готовое']],['waffles','Вафли','300 г','',['перекус']],
  ['cottage','Творог','300 г','Ферма',['молочное','белок']],['smetana','Сметана','300 г','Ферма',['молочное']]
].map(([id,name,pack,brand,tags],i)=>({id,name,pack,brand,tags,emoji:'•',prices:{pyat:70+i*23,magnit:75+i*22}}));
const STORES=[{id:'pyat',name:'Пятёрочка',city:['msk'],kind:'shop'},{id:'magnit',name:'Магнит',city:['msk'],kind:'shop'}];

function createRuntime(){
  const storage=new Map(),context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,RegExp,Promise,AbortController,setTimeout,clearTimeout,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},dispatchEvent(){},addEventListener(){},render(){},navigator:{onLine:true}};
  context.window=context;context.globalThis=context;context.state={city:'msk',storeId:'pyat',cart:{},cartTouched:false};
  vm.createContext(context);vm.runInContext(`const STORES=${JSON.stringify(STORES)};const PRODUCTS=${JSON.stringify(PRODUCTS)};`,context);
  for(const file of ['store-adapters.js','shopping-state.js','shopping-optimizer.js','shopping-conversation.js','bai-brain.js','bai-shopping-agent-kernel.js'])vm.runInContext(fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),context);
  return context;
}

const runtime=createRuntime(),brain=runtime.TDBaiBrain,kernel=runtime.TDBaiShoppingAgentKernel,legacy=runtime.TDShoppingState;
const norm=v=>String(v||'').toLowerCase().replace(/ё/g,'е').trim();
const modern=id=>LEGACY[id]||id;
const productMap=new Map(PRODUCTS.map(x=>[x.id,x]));
const semantic=id=>{id=modern(id);if(['ham','chicken_fil'].includes(id))return'meat';if(['banana','apple'].includes(id))return'fruit';if(['milk','cottage','smetana'].includes(id))return'dairy';if(['bread_dark','buckwheat','pasta','noodles'].includes(id))return'base';if(id==='eggs_c1')return'protein';return id};

function parsedConstraints(values=[]){
  const out={brands:[],excluded:[],mode:null,cooking:null};
  for(const raw of values){const x=String(raw);if(x.startsWith('exclude_brand:'))out.brands.push(x.slice(14));else if(x.startsWith('exclude_tag:'))out.excluded.push(x.slice(12));else if(x==='mode:one')out.mode='one';else if(x.startsWith('cooking:'))out.cooking=x.slice(8)}return out;
}
function line(id){id=modern(id);const p=productMap.get(id);if(!p)return null;const price=p.prices.pyat;return{id,sourceId:id,name:p.name,pack:p.pack,emoji:p.emoji,brand:p.brand,quantity:1,storeId:'pyat',unitPrice:price,price,quality:'ESTIMATED'}}
function seed(row,{resetBrain=true}={}){
  if(resetBrain)brain.reset();kernel.state.reset();legacy.reset();runtime.state.cart={};runtime.state.cartTouched=false;
  const c=row.session_context||{},pc=parsedConstraints(c.constraints),items=(c.basket||[]).map(line).filter(Boolean);
  legacy.commit('EVAL_SEED',s=>{s.budget=c.budget??null;s.peopleCount=Math.max(1,Number(c.people)||1);s.duration=Math.max(1,Number(c.days)||1);s.mode=c.mode==='one'?'one':'multi';s.cookingPreference=pc.cooking||'normal';s.excludedBrands=[...pc.brands];s.excludedProducts=[...pc.excluded];s.products=items;s.requiredProducts=items.map(x=>x.id);s.onlyProducts=[];s.selectionMode='auto';s.currentTotal=items.reduce((n,x)=>n+x.price,0);s.lastPlans=[];s.history=[]});
  kernel.state.syncFromLegacy();
}
function predictedIntent(row,route,result){
  if(result?.status==='OUT_OF_SCOPE'||!route?.operations?.length)return'unknown';
  const ops=route.operations||[];
  if(ops.some(x=>x.type==='RESET_BASKET'||(x.type==='SET_INTENT'&&x.value==='build')))return'build_basket';
  if((row.session_context?.basket||[]).length)return'edit_basket';
  if(ops.some(x=>['CHANGE_BUDGET','SET_DURATION','SET_PEOPLE','ADD_PREFERENCE','PREFER','REOPTIMIZE'].includes(x.type)))return'build_basket';
  return'unknown';
}
function constraintPass(token,state,exactBudget=false){
  const x=String(token);let m=x.match(/^budget<=(\d+)$/);if(m)return state.budget!=null&&(exactBudget?Number(state.budget)===Number(m[1]):Number(state.budget)<=Number(m[1]));
  if(x.startsWith('exclude_brand:')){const want=norm(x.slice(14));return(state.constraints?.excluded_brands||[]).some(v=>norm(v)===want)}
  if(x.startsWith('exclude_tag:'))return(state.constraints?.excluded_products||[]).includes(x.slice(12));
  if(x==='mode:one')return state.store_constraints?.mode==='one'&&state.store_constraints?.limit===1;
  if(x.startsWith('cooking:'))return state.constraints?.cooking===x.slice(8);
  return true;
}
function actionReplacementStats(operations,result){let attempts=0,bad=0;for(const op of operations||[]){if(op.type!=='REPLACE_PRODUCT')continue;attempts++;const from=op.value?.from,to=op.value?.to;if(!from||!to||from===to||semantic(from)!==semantic(to))bad++}if(attempts&&result?.error?.code==='INVALID_REPLACEMENT')bad=attempts;return{attempts,bad}}
const rate=(a,b)=>b?Number((a/b).toFixed(4)):null;

export async function evaluateCurrentBai(rows=buildCorpus()){
  let total=0,domain=0,intents=0,hard=0,actionOk=0,retained=0,retainedN=0,repl=0,badRepl=0,covered=0;const errors={},byCategory={};let scenario=null;
  for(const row of rows){
    const sameScenario=Boolean(row.scenario_id&&row.scenario_id===scenario);seed(row,{resetBrain:!sameScenario});scenario=row.scenario_id||null;
    const gate=kernel.domainGate(row.user_request);if(gate.allowed)domain++;
    const route=await brain.route(row.user_request);if(route.operations?.length)covered++;
    const result=await kernel.run({text:row.user_request,operations:route.operations||[]});total++;if(result.ok)actionOk++;else errors[result?.error?.code||result?.status||'UNKNOWN']=(errors[result?.error?.code||result?.status||'UNKNOWN']||0)+1;
    const expected=row.expected||{},predicted=predictedIntent(row,route,result);if(predicted===expected.intent_family)intents++;
    const state=kernel.state.get(),hardTokens=[...(expected.new_hard||[])];if(expected.duration)hardTokens.push(`duration:${expected.duration}`);const retainedTokens=expected.must_retain||[];
    const hardOk=hardTokens.every(t=>t.startsWith('duration:')?Number(state.constraints?.duration_days)===Number(t.slice(9)):constraintPass(t,state,true))&&retainedTokens.every(t=>constraintPass(t,state,false));if(hardOk)hard++;
    if(retainedTokens.length){retainedN++;if(retainedTokens.every(t=>constraintPass(t,state,false)))retained++}
    const rr=actionReplacementStats(route.operations,result);repl+=rr.attempts;badRepl+=rr.bad;
    const c=byCategory[row.category]||(byCategory[row.category]={examples:0,action_ok:0,intent_ok:0});c.examples++;if(result.ok)c.action_ok++;if(predicted===expected.intent_family)c.intent_ok++;
  }
  for(const c of Object.values(byCategory)){c.action_success_rate=rate(c.action_ok,c.examples);c.intent_accuracy=rate(c.intent_ok,c.examples);delete c.action_ok;delete c.intent_ok}
  return{schema_version:'1.0',evaluator:'current-bai-deterministic-kernel',examples:total,domain_gate_pass_rate:rate(domain,total),route_coverage_rate:rate(covered,total),intent_accuracy:rate(intents,total),constraint_pass_rate:rate(hard,total),action_success_rate:rate(actionOk,total),context_retention_rate:rate(retained,retainedN),invalid_substitution_rate:rate(badRepl,repl),repair_success_rate:null,repair_attempts:0,substitution_attempts:repl,error_codes:errors,by_category:byCategory};
}

if(import.meta.url===`file://${process.argv[1]}`){const out=process.argv[2],report=await evaluateCurrentBai();assert.equal(report.examples,560);const text=JSON.stringify(report,null,2)+'\n';if(out)fs.writeFileSync(out,text);console.log(text.trim())}
