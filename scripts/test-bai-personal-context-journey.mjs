import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../bai-shopping-journey.js',import.meta.url),'utf8');
const pantrySource=fs.readFileSync(new URL('../bai-pantry.js',import.meta.url),'utf8');
const goalSource=fs.readFileSync(new URL('../bai-goal-memory.js',import.meta.url),'utf8');
const questionSource=fs.readFileSync(new URL('../bai-question-selector.js',import.meta.url),'utf8');
const storage=new Map();
const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
const context={console,JSON,Math,Number,String,Object,Array,Set,Date,RegExp,Promise,localStorage};
context.window=context;context.globalThis=context;context.TDBaiMemory={get:()=>({})};
context.TDShoppingState={get:()=>({budget:null,peopleCount:1,duration:1,cookingPreference:'normal',mode:'multi',stores:[],preferences:[],requiredProducts:[],preferredProducts:[],excludedProducts:[],existingProducts:[],products:[],quantityTargets:{}})};
context.TDShoppingOptimizer={optimize:()=>[]};
let plannerState=null;
context.TDBaiPlanner={build:(state)=>{plannerState=state;return{recommended:{id:'balanced',title:'Сбалансированный',productIds:['eggs','bread'],operations:[{type:'REQUIRE',value:'eggs'},{type:'REQUIRE',value:'bread'},{type:'REOPTIMIZE'}]},strategies:[]}},explain:()=> 'Собрал.'};
let brainOutput={provider:'rules',operations:[],reply:'ok',expectsAnswer:false};
context.TDBaiBrain={route:async()=>structuredClone(brainOutput)};
vm.createContext(context);vm.runInContext(pantrySource,context);vm.runInContext(goalSource,context);vm.runInContext(questionSource,context);vm.runInContext(source,context);

brainOutput={provider:'rules',operations:[{type:'HAS_AT_HOME',value:'масло и гречка'}],reply:'Запомнил.',expectsAnswer:false};
let result=await context.TDBaiBrain.route('Дома есть масло и гречка',[]);
assert.equal(result.provider,'rules');
assert.equal(context.TDBaiPantry.has('oil'),true);
assert.equal(context.TDBaiPantry.has('buck'),true);

brainOutput={provider:'rules',operations:[{type:'CHANGE_BUDGET',value:3000},{type:'SET_PEOPLE',value:1},{type:'SET_INTENT',value:'build'}],reply:'Собираю.',expectsAnswer:false};
result=await context.TDBaiBrain.route('Собери мне корзину до 3000 ₽ на одного',[]);
assert.equal(result.provider,'bai-shopping-journey','missing optional duration must not block basket execution');
assert.equal(result.operations.some(x=>x.type==='ASK_CLARIFICATION'),false);
assert.ok(result.operations.some(x=>x.type==='CHANGE_BUDGET'&&x.value===3000),'explicit budget must survive immediate planning');
assert.ok(result.operations.some(x=>x.type==='HAS_AT_HOME'&&/масло|греч/.test(String(x.value))),'persistent pantry must be projected into final optimization');
assert.ok(plannerState.existingProducts.some(x=>/масло/.test(x))&&plannerState.existingProducts.some(x=>/греч/.test(x)),'planner must see home stock before choosing products');

console.log('Bai personal context journey passed: pantry stock affects planning without an optional-question detour.');
