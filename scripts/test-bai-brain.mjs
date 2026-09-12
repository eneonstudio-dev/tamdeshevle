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
result=await brain.route('без сахара добавь молоко');
assert.ok(hasOp(result,'REMOVE_PRODUCT','sugar'),'«без сахара» must apply only to sugar');
assert.ok(hasOp(result,'ADD_PRODUCT','milk'),'following add command must still add milk');
assert.equal(byType(result,'REMOVE_PRODUCT').length,1,'scoped «без» must not remove the added product');
assert.equal(byType(result,'ADD_PRODUCT').length,1,'scoped «без» must not duplicate add operations');

brain.reset();
result=await brain.route('добавь молоко без сахара');
assert.ok(hasOp(result,'ADD_PRODUCT','milk'),'leading add command must still add milk');
assert.ok(hasOp(result,'REMOVE_PRODUCT','sugar'),'trailing «без сахара» must exclude sugar only');
assert.equal(byType(result,'REMOVE_PRODUCT').length,1,'trailing «без» must stay scoped to sugar');

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
result=await brain.route('собери корзину на 3 дня');
assert.ok(hasOp(result,'SET_DURATION',3),'duration must be parsed');
assert.equal(hasOp(result,'SET_PEOPLE'),false,'duration-only phrase must not be mistaken for people count');
assert.equal(result.goal.days,3);
assert.equal(result.goal.people,null);

brain.reset();
await brain.route('нас двое');
result=await brain.route('собери на 3 дня');
assert.ok(hasOp(result,'SET_DURATION',3),'follow-up duration must still be applied');
assert.equal(hasOp(result,'SET_PEOPLE'),false,'duration follow-up must not overwrite existing people count');
assert.equal(result.goal.people,2,'existing explicit people count must survive a duration-only follow-up');

brain.reset();
result=await brain.route('собери на 3 дня, нас двое');
assert.ok(hasOp(result,'SET_DURATION',3),'combined request must retain duration');
assert.ok(hasOp(result,'SET_PEOPLE',2),'explicit people phrase must win over ambiguous «на 3» parsing');
assert.equal(result.goal.people,2);
assert.equal(result.goal.days,3);

brain.reset();
await brain.route('добавь хлеб');
result=await brain.route('убери это');
assert.ok(hasOp(result,'REMOVE_PRODUCT','bread'),'pronoun removal must target last product');

brain.reset();
await brain.route('только молоко и хлеб');
result=await brain.route('убери молоко');
assert.deepEqual(Array.from(result.goal.onlyProducts),['bread'],'removing a product from only-mode must also remove it from onlyProducts');
assert.equal(result.goal.requiredProducts.includes('milk'),false,'removed product must leave requiredProducts');
assert.ok(result.goal.excludedProducts.includes('milk'),'removed product must be excluded');

brain.reset();
await brain.route('убери молоко');
result=await brain.route('добавь молоко');
assert.ok(result.goal.requiredProducts.includes('milk'),'re-added product must be required');
assert.equal(result.goal.excludedProducts.includes('milk'),false,'re-added product must no longer stay excluded');

brain.reset();
await brain.route('только молоко и хлеб');
result=await brain.route('замени молоко на воду');
assert.deepEqual(Array.from(result.goal.onlyProducts),['water','bread'],'replacement in only-mode must swap the product instead of keeping a stale source');
assert.ok(result.goal.requiredProducts.includes('water'),'replacement target must be required');
assert.equal(result.goal.requiredProducts.includes('milk'),false,'replacement source must leave requiredProducts');
assert.ok(result.goal.excludedProducts.includes('milk'),'replacement source must be excluded');
assert.equal(result.goal.excludedProducts.includes('water'),false,'replacement target must not remain excluded');

brain.reset();
await brain.route('добавь 2 л молока');
result=await brain.route('замени молоко на воду');
assert.equal(result.goal.quantityTargets.milk,undefined,'replacement must remove stale source quantity');
assert.deepEqual({...result.goal.quantityTargets.water},{amount:2,unit:'l'},'replacement must transfer an explicit quantity to the target');

console.log('Bai brain regression suite passed: mixed edits, scoped exclusions, negation, replacement clarification, quantities, budget, people, duration, context and product-goal consistency.');
