import assert from 'node:assert/strict';

global.window=globalThis;
await import(`../bai-question-selector.js?q=${Date.now()}`);
const q=global.TDBaiQuestionSelector;
q.clear();
const routed={operations:[{type:'SET_INTENT',value:'build'}],expectsAnswer:false};
const state={duration:1,peopleCount:1,budget:null};
const goal={recommend:()=>({})};
const pantry={count:()=>0};
let best=q.choose({text:'собери мне корзину',routed,state,goal,pantry});
assert.equal(best,null,'generic basket must execute immediately with safe defaults');

best=q.choose({text:'собери на несколько дней',routed,state,goal,pantry});
assert.equal(best.id,'duration','an explicitly incomplete duration may ask one blocking question');
const asked=q.askResult(routed,best);
assert.equal(asked.operations.length,1,'question selector must ask at most one blocking question');
assert.equal(asked.operations[0].type,'ASK_CLARIFICATION');
assert.equal(asked.expectsAnswer,true);
let resumed=q.resume('На неделю',{operations:[{type:'SET_DURATION',value:7}],expectsAnswer:false});
assert.ok(resumed?.text.includes('собери на несколько дней')&&resumed.text.includes('На неделю'),'answer must resume original shopping goal');
assert.ok(resumed.operations.some(x=>x.type==='SET_INTENT')&&resumed.operations.some(x=>x.type==='SET_DURATION'),'resume must preserve old and new constraints');

q.clear();
best=q.choose({text:'собери сам реши, без вопросов',routed,state,goal,pantry});
assert.equal(best,null,'explicit autonomy request must suppress clarification');

q.clear();
const rememberedGoal={recommend:()=>({duration:{value:7,confidence:.9},budget:{value:3000,confidence:.9},people:{value:1,confidence:.9}})};
best=q.choose({text:'собери мне корзину',routed,state:{...state,budget:3000,duration:7},goal:rememberedGoal,pantry});
assert.equal(best,null,'high-confidence goal memory should remove redundant questions');

console.log('Bai question selector passed: one high-value question, automatic resume, and no-question autonomy mode.');
