import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const context={console,JSON,Math,Number,String,Object,Array,Set};
context.window=context;
context.TDShoppingState={get:()=>({products:[],budget:null})};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../bai-brain.js",import.meta.url),"utf8"),context,{filename:"bai-brain.js"});

const brain=context.TDBaiBrain;
assert.ok(brain?.route,"core Bai brain must expose route()");
const hasOp=(result,type,value)=>result.operations.some(op=>op.type===type&&(value===undefined||JSON.stringify(op.value)===JSON.stringify(value)));

brain.reset();
let result=await brain.route("собери корзину на 3 дня");
assert.ok(hasOp(result,"SET_DURATION",3),"duration-only phrase must set duration in core parser");
assert.equal(hasOp(result,"SET_PEOPLE"),false,"duration-only phrase must never become people count in core parser");
assert.equal(result.goal.days,3);
assert.equal(result.goal.people,null);

brain.reset();
result=await brain.route("собери продукты на две недели");
assert.ok(hasOp(result,"SET_DURATION",14),"numbered weeks must convert to days in core parser");
assert.equal(hasOp(result,"SET_PEOPLE"),false,"week duration must not become people count");

brain.reset();
result=await brain.route("нас будет двое, собери на неделю");
assert.ok(hasOp(result,"SET_PEOPLE",2),"collective people form must be parsed");
assert.ok(hasOp(result,"SET_DURATION",7),"people and duration must coexist without collision");

brain.reset();
result=await brain.route("собери на двоих на 3 дня");
assert.ok(hasOp(result,"SET_PEOPLE",2),"dative people form must be parsed");
assert.ok(hasOp(result,"SET_DURATION",3),"explicit duration must survive next to people form");

brain.reset();
result=await brain.route("мы втроем, продукты на пару дней");
assert.ok(hasOp(result,"SET_PEOPLE",3),"natural group phrase must set people count");
assert.ok(hasOp(result,"SET_DURATION",2),"natural pair-of-days phrase must set two days");

brain.reset();
result=await brain.route("собери на завтра");
assert.ok(hasOp(result,"SET_DURATION",1),"tomorrow request must resolve to one day");
assert.equal(hasOp(result,"SET_PEOPLE"),false,"tomorrow must never affect people count");

brain.reset();
result=await brain.route("будет трое, собери на выходные");
assert.ok(hasOp(result,"SET_PEOPLE",3),"standalone collective form must set people count");
assert.ok(hasOp(result,"SET_DURATION",2),"weekend request must resolve to two days");

console.log("Bai core parser passed: people and duration grammar are independent without guard/self-check assistance.");
