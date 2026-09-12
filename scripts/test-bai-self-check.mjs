import assert from "node:assert/strict";
import fs from "node:fs";

global.window=globalThis;
let brainGoal={people:3,days:3};
global.TDBaiBrain={
  status:()=>({goal:{...brainGoal}}),
  reset:()=>{brainGoal={people:null,days:null};return true;}
};
await import(`../bai-self-check.js?test=${Date.now()}`);

const assistantSource=fs.readFileSync(new URL("../ai-shopping-assistant.js",import.meta.url),"utf8");
assert.match(assistantSource,/bai-reasoning-guard\.js/,'production assistant must load Bai reasoning guard');
assert.match(assistantSource,/TDBaiReasoningGuard/,'production assistant must wait for reasoning guard wiring');

const base={ok:true,provider:"test",reply:"",suggestions:[],expectsAnswer:false};

let out=TDBaiSelfCheck.guard("собери на 3 дня",{...base,operations:[{type:"SET_PEOPLE",value:3},{type:"SET_DURATION",value:3}],goal:{people:3,days:3}},{peopleCount:2});
assert.equal(out.operations.some(o=>o.type==="SET_PEOPLE"),false,"duration-only request must not mutate people count");
assert.equal(out.operations.some(o=>o.type==="SET_DURATION"),true,"duration operation must remain");
assert.equal(out.goal.people,2,"goal must preserve current explicit people count");
assert.equal(TDBaiBrain.status().goal.people,2,"planner-facing brain status must expose corrected people count");

TDBaiBrain.reset();
assert.equal(TDBaiBrain.status().goal.people,null,"new Bai session must clear corrected people shadow state");
assert.equal(TDBaiBrain.status().goal.days,null,"wrapped reset must still execute the original brain reset");

out=TDBaiSelfCheck.guard("нас двое, на 3 дня",{...base,operations:[{type:"SET_PEOPLE",value:2},{type:"SET_DURATION",value:3}],goal:{people:2,days:3}},{peopleCount:1});
assert.equal(out.operations.find(o=>o.type==="SET_PEOPLE")?.value,2,"explicit people phrase must be preserved");
assert.equal(TDBaiBrain.status().goal.people,2,"explicit people count must become the corrected status value");

out=TDBaiSelfCheck.guard("будет трое, на выходные",{...base,operations:[{type:"SET_PEOPLE",value:3},{type:"SET_DURATION",value:2}],goal:{people:3,days:2}},{peopleCount:1});
assert.equal(out.operations.find(o=>o.type==="SET_PEOPLE")?.value,3,"collective people phrase must not be stripped as duration noise");

out=TDBaiSelfCheck.guard("собери на 4 человека",{...base,operations:[{type:"SET_PEOPLE",value:4}],goal:{people:4,days:null}},{peopleCount:2});
assert.equal(out.operations.find(o=>o.type==="SET_PEOPLE")?.value,4,"explicit person noun must keep people mutation");

TDBaiSelfCheck.reset();
brainGoal={people:5,days:1};
assert.equal(TDBaiBrain.status().goal.people,5,"direct self-check reset must release stale people correction");

console.log("Bai self-check passed: duration guard, natural people forms and session reset cannot leak stale people context.");
