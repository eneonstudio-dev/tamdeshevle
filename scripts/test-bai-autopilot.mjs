import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../bai-autopilot.js',import.meta.url),'utf8');
const roles={buck:['carb','base'],water:['drink'],eggs:['protein'],banana:['fruit'],apple:['fruit'],bread:['carb','base']};
const prep={buck:'cook',water:'ready',eggs:'quick',banana:'ready',apple:'ready',bread:'ready'};
function balancePlan(ids){
  const r=new Set(ids.flatMap(id=>roles[id]||[])),missing=[];
  if(!r.has('protein'))missing.push('protein');
  if(!r.has('base')&&!r.has('carb'))missing.push('base');
  if(!r.has('fruit'))missing.push('fruit');
  if(!r.has('drink'))missing.push('drink');
  return{balanced:missing.length===0,coverage:{missing,mealMissing:[],score:Math.max(0,100-missing.length*16)}};
}
const food={
  info:id=>({prep:prep[id]||'ready'}),
  balancePlan,
  suggestAdditions:ids=>{const m=balancePlan(ids).coverage.missing,out=[];if(m.includes('protein'))out.push('eggs');if(m.includes('base'))out.push('bread');if(m.includes('fruit'))out.push('banana','apple');if(m.includes('drink'))out.push('water');return out},
  scorePlan:ids=>balancePlan(ids).coverage.score,
  explain:ids=>balancePlan(ids).coverage.missing.map(x=>`missing:${x}`),
  recipesFor:()=>[]
};
const context={console,JSON,Math,Number,String,Object,Array,Set,Date,RegExp};
context.window=context;context.TDBaiFoodKnowledge=food;
vm.createContext(context);vm.runInContext(source,context);
const A=context.TDBaiAutopilot;
assert.ok(A?.audit&&A?.refine,'autopilot must expose audit/refine');

const weak={id:'weak',stores:['pyat'],products:[{id:'buck',quantity:2},{id:'water',quantity:2}],goods:300,total:300};
const state={budget:2000,peopleCount:1,duration:4,mode:'multi',requiredProducts:[],excludedProducts:[],preferences:[]};
const optimize=s=>{
  const productIds=[...new Set(['buck','water',...(s.requiredProducts||[])])];
  return[{id:'fixed',stores:['pyat'],products:productIds.map(id=>({id,quantity:2})),goods:productIds.length*100,total:productIds.length*100}];
};
let out=A.refine({state,plan:weak,optimize});
assert.equal(out.refined,true,'weak basket should be repaired when audit score materially improves');
assert.ok(out.operations.some(x=>x.type==='REQUIRE'&&x.value==='eggs'),'repair should add missing protein');
assert.ok(out.operations.some(x=>x.type==='REQUIRE'&&x.value==='banana'),'repair should add missing fruit');
assert.ok(out.after.score>out.before.score,'self-repair must improve audit score');

const excluded={...state,excludedProducts:['banana']};
out=A.repair(excluded,weak);
assert.equal(out.operations.some(x=>x.value==='banana'),false,'autopilot must never re-add an excluded product');
assert.ok(out.operations.some(x=>x.value==='apple'),'autopilot should use a safe alternative when the first addition is excluded');

const twoStores={id:'multi',stores:['pyat','magnit'],products:[{id:'buck',quantity:2},{id:'water',quantity:2},{id:'eggs',quantity:2},{id:'banana',quantity:2}],total:600,goods:480};
const oneState={...state,mode:'one'};
out=A.refine({state:oneState,plan:twoStores,text:'собери в одном магазине',optimize:s=>[{...twoStores,stores:['pyat'],total:520,goods:520}]});
assert.equal(out.refined,true,'explicit one-store request should trigger a safe one-store repair');
assert.ok(out.operations.some(x=>x.type==='SET_MODE'&&x.value==='one'),'one-store repair must be represented as an explicit safe operation');
assert.equal(out.after.critical,false,'one-store repair must clear the critical mismatch');

out=A.refine({state:{...state,budget:350},plan:weak,optimize:s=>[{id:'bad',stores:['pyat'],products:[{id:'buck',quantity:2},{id:'water',quantity:2},{id:'eggs',quantity:2},{id:'banana',quantity:2}],total:700,goods:700}]});
assert.equal(out.refined,false,'autopilot must reject its own repair when it breaks the budget');

assert.equal(source.includes('MutationObserver'),false,'autopilot must not add DOM observers');
assert.equal(source.includes('requestAnimationFrame'),false,'autopilot must not add render loops');
console.log('Bai Autopilot regression suite passed: food-gap repair, exclusions, one-store intent, budget fail-closed and no observer loops.');
