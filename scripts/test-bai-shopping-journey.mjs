import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../bai-shopping-journey.js',import.meta.url),'utf8');
const config=fs.readFileSync(new URL('../supabase-config.js',import.meta.url),'utf8');

assert.equal(source.includes('fetch('),false,'zero-budget journey must not add network model calls');
assert.equal(source.includes('MutationObserver'),false,'journey must not add DOM observers');
assert.equal(source.includes('setInterval'),false,'journey must not add recurring loops');
assert.ok(config.indexOf('bai-agent-client.js')<config.indexOf('bai-shopping-journey.js'),'journey must load after Agent Core so wrappers compose');

const personalStubs=target=>{
  target.TDBaiPantry={observe(){},operations:()=>[],applyToState:s=>s,list:()=>[],count:()=>0};
  target.TDBaiGoalMemory={observe(){},defaultOperations:()=>[],recommend:()=>({})};
  target.TDBaiQuestionSelector={resume:()=>null,choose:()=>null,askResult:(base,best)=>({...base,provider:'bai-question-selector',operations:[{type:'ASK_CLARIFICATION',value:best.question}],reply:best.question,suggestions:best.suggestions,expectsAnswer:true})};
};

let brainOutput={
  ok:true,provider:'rules',reply:'Собираю.',suggestions:[],expectsAnswer:false,
  operations:[
    {type:'CHANGE_BUDGET',value:3000},
    {type:'SET_DURATION',value:7},
    {type:'SET_COOKING',value:'minimal'},
    {type:'CLEAR_ONLY'},
    {type:'SET_INTENT',value:'build'}
  ]
};

const context={console,JSON,Math,Number,String,Object,Array,Set,Date,RegExp,Promise};
context.window=context;context.globalThis=context;context.TDBaiMemory={get:()=>({})};personalStubs(context);
context.TDShoppingState={get:()=>({budget:0,peopleCount:1,duration:1,cookingPreference:'normal',mode:'multi',stores:[],preferences:[],requiredProducts:[],preferredProducts:[],excludedProducts:[],products:[],quantityTargets:{}})};
context.TDShoppingOptimizer={optimize:()=>[]};
context.TDBaiPlanner={
  build:(state,text)=>({
    recommended:{id:'easy',title:'Без возни',total:2450,stores:2,score:94,productIds:['eggs','banana'],mealPlan:{days:7},sufficiency:{score:88},operations:[{type:'SET_COOKING',value:'minimal'},{type:'REQUIRE',value:'eggs'},{type:'REQUIRE',value:'banana'},{type:'SET_PRODUCT_AMOUNT',value:{id:'eggs',amount:2,unit:'pack'}},{type:'REOPTIMIZE'}]},
    strategies:[
      {id:'easy',title:'Без возни',total:2450,stores:2,score:94,operations:[{type:'SET_COOKING',value:'minimal'},{type:'REQUIRE',value:'eggs'},{type:'REQUIRE',value:'banana'},{type:'REOPTIMIZE'}]},
      {id:'economy',title:'Экономный',total:2200,stores:3,score:87,operations:[{type:'REQUIRE',value:'buck'},{type:'REOPTIMIZE'}]}
    ],
    scenarioSeen:{state,text}
  }),
  explain:()=> 'Я бы выбрал «Без возни»: он лучше попадает в задачу.'
};
context.TDBaiBrain={route:async()=>structuredClone(brainOutput)};
vm.createContext(context);
vm.runInContext(source,context);

assert.ok(context.TDBaiShoppingJourney,'journey API must be exposed');
assert.equal(context.TDBaiShoppingJourney.shouldAuto('собери мне корзину на неделю',brainOutput),true,'broad basket request should enter autonomous journey');
assert.equal(context.TDBaiShoppingJourney.shouldAuto('сравни варианты и скажи что лучше',brainOutput),false,'explicit comparison must preserve user choice');
assert.equal(context.TDBaiShoppingJourney.shouldAuto('убери молоко',brainOutput),false,'narrow edit must stay on fast deterministic route');

let result=await context.TDBaiBrain.route('собери мне на неделю до 3000, готовить лень',[]);
assert.equal(result.provider,'bai-shopping-journey','broad request should be upgraded to autonomous journey');
const types=Array.from(result.operations,op=>op.type);
assert.ok(types.includes('CHANGE_BUDGET')&&types.includes('SET_DURATION')&&types.includes('SET_COOKING'),'explicit user constraints must survive planning');
assert.ok(result.operations.some(op=>op.type==='REQUIRE'&&op.value==='eggs'),'recommended plan operations must be applied automatically');
assert.ok(result.operations.some(op=>op.type==='SET_PRODUCT_AMOUNT'&&op.value.id==='eggs'),'meal quantities must survive autonomous journey');
assert.equal(types.filter(type=>type==='REOPTIMIZE').length,1,'journey must perform one bounded reoptimization request');
assert.equal(result.journey.autoApplied,true,'journey metadata must record autonomous application');
assert.equal(result.journey.strategy,'easy','recommended strategy should be selected');
assert.equal(result.journey.alternatives.length,2,'journey may retain compact alternatives for diagnostics without blocking execution');
assert.ok(result.journey.explicitOperations.some(op=>op.type==='CHANGE_BUDGET'),'outcome learning must know which operations came from the user');
assert.ok(result.journey.generatedOperations.some(op=>op.type==='REQUIRE'&&op.value==='eggs'),'outcome learning must distinguish Bai-generated product choices');
assert.deepEqual(Array.from(result.journey.recommendation.productIds),['eggs','banana'],'chosen products must be available for outcome learning');
assert.equal(result.journey.mealPlan.days,7,'meal plan metadata must flow through journey');

brainOutput={ok:true,provider:'rules',reply:'Вот варианты.',suggestions:[],expectsAnswer:false,operations:[{type:'SET_INTENT',value:'build'}]};
result=await context.TDBaiBrain.route('сравни варианты, что лучше',[]);
assert.equal(result.provider,'rules','comparison request must not be auto-committed');
assert.deepEqual(Array.from(result.operations,op=>op.type),['SET_INTENT'],'comparison must keep original route untouched');

brainOutput={ok:true,provider:'rules',reply:'Уточни, на что заменить.',suggestions:['На воду','На яблоки'],expectsAnswer:true,operations:[{type:'ASK_CLARIFICATION',value:'На что заменить?'}]};
result=await context.TDBaiBrain.route('сам реши',[]);
assert.equal(result.provider,'rules','journey must never jump over an active clarification');
assert.equal(result.operations[0].type,'ASK_CLARIFICATION','clarification operation must be preserved');

brainOutput={ok:true,provider:'rules',reply:'Убрал.',suggestions:[],expectsAnswer:false,operations:[{type:'REMOVE_PRODUCT',value:'milk'}]};
result=await context.TDBaiBrain.route('убери молоко',[]);
assert.equal(result.provider,'rules','direct basket mutation must stay deterministic');
assert.equal(result.operations.length,1,'direct edit must not trigger planner mutations');

let stored=null,previousSetterCalls=0;
const accessorContext={console,JSON,Math,Number,String,Object,Array,Set,Date,RegExp,Promise};
accessorContext.window=accessorContext;accessorContext.globalThis=accessorContext;accessorContext.TDBaiMemory={get:()=>({})};personalStubs(accessorContext);
Object.defineProperty(accessorContext,'TDBaiBrain',{configurable:true,enumerable:true,get(){return stored},set(next){previousSetterCalls++;stored=next}});
accessorContext.TDShoppingState={get:()=>({peopleCount:1,duration:1,requiredProducts:[],preferredProducts:[],excludedProducts:[],preferences:[],stores:[],quantityTargets:{}})};
accessorContext.TDShoppingOptimizer={};
accessorContext.TDBaiPlanner={build:()=>({strategies:[],recommended:null})};
vm.createContext(accessorContext);vm.runInContext(source,accessorContext);
accessorContext.TDBaiBrain={route:async()=>({provider:'rules',operations:[],reply:'ok'})};
assert.equal(previousSetterCalls,1,'journey must preserve the pre-existing TDBaiBrain setter');
assert.equal(accessorContext.TDBaiBrain.__baiShoppingJourneyWrapped,true,'brain assigned through previous wrapper must still receive journey layer');

console.log('Bai shopping journey passed: autonomous meal-plan application, comparison/clarification guards, outcome metadata and wrapper composition.');
