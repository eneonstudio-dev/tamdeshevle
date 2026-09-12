import assert from "node:assert/strict";

global.window=globalThis;
global.TDBaiBrain={status:()=>({goal:{people:3,days:3}})};
await import(`../bai-self-check.js?test=${Date.now()}`);

const base={ok:true,provider:"test",reply:"",suggestions:[],expectsAnswer:false};

let out=TDBaiSelfCheck.guard("собери на 3 дня",{...base,operations:[{type:"SET_PEOPLE",value:3},{type:"SET_DURATION",value:3}],goal:{people:3,days:3}},{peopleCount:2});
assert.equal(out.operations.some(o=>o.type==="SET_PEOPLE"),false,"duration-only request must not mutate people count");
assert.equal(out.operations.some(o=>o.type==="SET_DURATION"),true,"duration operation must remain");
assert.equal(out.goal.people,2,"goal must preserve current explicit people count");
assert.equal(TDBaiBrain.status().goal.people,2,"planner-facing brain status must expose corrected people count");

out=TDBaiSelfCheck.guard("нас двое, на 3 дня",{...base,operations:[{type:"SET_PEOPLE",value:2},{type:"SET_DURATION",value:3}],goal:{people:2,days:3}},{peopleCount:1});
assert.equal(out.operations.find(o=>o.type==="SET_PEOPLE")?.value,2,"explicit people phrase must be preserved");
assert.equal(TDBaiBrain.status().goal.people,2,"explicit people count must become the corrected status value");

out=TDBaiSelfCheck.guard("собери на 4 человека",{...base,operations:[{type:"SET_PEOPLE",value:4}],goal:{people:4,days:null}},{peopleCount:2});
assert.equal(out.operations.find(o=>o.type==="SET_PEOPLE")?.value,4,"explicit person noun must keep people mutation");

console.log("Bai self-check passed: duration phrases cannot silently overwrite people count.");
