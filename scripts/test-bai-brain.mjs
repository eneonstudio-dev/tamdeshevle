import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const context={console,JSON,Math,Number,String,Object,Array,Set};
context.window=context;
context.TDShoppingState={get:()=>({products:[],budget:null})};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../bai-brain.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('../bai-reasoning-guard.js',import.meta.url),'utf8'),context);

const brain=context.TDBaiBrain;
assert.ok(brain?.route,'Bai brain must expose route()');

const byType=(result,type)=>result.operations.filter(op=>op.type===type);
const hasOp=(result,type,value)=>result.operations.some(op=>op.type===type&&(value===undefined||JSON.stringify(op.value)===JSON.stringify(value)));

brain.reset();
let result=await brain.route('не добавляй молоко, добавь хлеб');
assert.ok(hasOp(result,'REMOVE_PRODUCT','milk'),'negated add must remove milk');
assert.ok(hasOp(result,'ADD_PRODUCT','bread'),'positive add in same request must add bread');
assert.equal(byType(result,'REMOVE_PRODUCT').length,1,'mixed request must not remove unrelated products');
assert.equal(byType(result,'ADD_PRODUCT').length,1,'mixed request must not add unrelated products');

brain.reset();
result=await brain.route('добавь хлеб, не добавляй молоко');
assert.ok(hasOp(result,'ADD_PRODUCT','bread'),'leading positive command must add bread');
assert.ok(hasOp(result,'REMOVE_PRODUCT','milk'),'trailing negated command must remove milk');
assert.equal(result.reply,'Готово: убрал и добавил.');

brain.reset();
result=await brain.route('не добавляй молоко и добавь хлеб');
assert.ok(hasOp(result,'REMOVE_PRODUCT','milk'));
assert.ok(hasOp(result,'ADD_PRODUCT','bread'));

brain.reset();
result=await brain.route('добавь молоко, сахар не надо');
assert.ok(hasOp(result,'ADD_PRODUCT','milk'),'positive product must still be added');
assert.ok(hasOp(result,'REMOVE_PRODUCT','sugar'),'postpositive «не надо» must exclude sugar');
assert.equal(byType(result,'ADD_PRODUCT').length,1,'postpositive exclusion must not add sugar by accident');

brain.reset();
result=await brain.route('добавь хлеб и молоко не нужно');
assert.ok(hasOp(result,'ADD_PRODUCT','bread'),'positive product before conjunction must still be added');
assert.ok(hasOp(result,'REMOVE_PRODUCT','milk'),'postpositive «не нужно» must exclude milk');

brain.reset();
result=await brain.route('замени молоко на хлеб');
assert.ok(hasOp(result,'REPLACE_PRODUCT',{from:'milk',to:'bread'}),'replacement direction must be milk -> bread');
assert.equal(result.reply,'Заменил.');

brain.reset();
result=await brain.route('хлеб вместо молока');
assert.ok(hasOp(result,'REPLACE_PRODUCT',{from:'milk',to:'bread'}),'«X вместо Y» must replace Y with X');

brain.reset();
result=await brain.route('замени молоко на воду или хлеб');
assert.equal(result.operations.length,0,'ambiguous replacement must not mutate the basket');
assert.equal(result.expectsAnswer,true,'ambiguous replacement must ask for clarification');
assert.equal(JSON.stringify(result.suggestions),JSON.stringify(['вода','хлеб']),'clarification must expose the two alternatives');

brain.reset();
result=await brain.route('добавь 2 л молока');
assert.ok(hasOp(result,'ADD_PRODUCT','milk'));
assert.ok(hasOp(result,'SET_PRODUCT_AMOUNT',{id:'milk',amount:2,unit:'l'}),'Bai must keep explicit product quantity');

brain.reset();
result=await brain.route('собери корзину до 1500 руб');
assert.ok(hasOp(result,'CHANGE_BUDGET',1500),'budget must be parsed');
assert.ok(hasOp(result,'SET_INTENT','build'),'basket request must enter build intent');
assert.equal(result.goal.budget,1500);

brain.reset();
await brain.route('добавь хлеб');
result=await brain.route('убери это');
assert.ok(hasOp(result,'REMOVE_PRODUCT','bread'),'pronoun removal must target last product');

console.log('Bai brain regression suite passed: mixed edits, postpositive negation, replacement clarification, quantities, budget and context.');
