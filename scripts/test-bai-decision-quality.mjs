import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const code=fs.readFileSync(new URL("../bai-decision-quality.js",import.meta.url),"utf8");
const context={window:{},console};context.window.window=context.window;vm.createContext(context);vm.runInContext(code,context);
const dq=context.window.TDBaiDecisionQuality;assert.ok(dq,"decision quality should install");

const one={id:"one",total:1000,stores:1,productIds:["eggs","bread"],score:70,quality:"LIVE"};
const weakMulti={id:"multi",total:920,stores:2,productIds:["eggs","bread"],score:75,quality:"LIVE"};
let audit=dq.evaluate(weakMulti,[one,weakMulti],{});
assert.ok(audit.risks.includes("small_saving_extra_store"),"80 rubles should not justify another store");
assert.ok(audit.delta<0,"weak multi-store saving should reduce ranking");

const strongOne={id:"one2",total:1500,stores:1,productIds:["eggs","bread"],score:70,quality:"LIVE"};
const strongMulti={id:"multi2",total:1050,stores:2,productIds:["eggs","bread"],score:70,quality:"LIVE"};
audit=dq.evaluate(strongMulti,[strongOne,strongMulti],{});
assert.ok(audit.delta>0,"450 rubles should be allowed to justify another store");
assert.equal(audit.verdict,"good");

const over=dq.evaluate({id:"over",total:1300,stores:1,productIds:["eggs"]},[],{budget:1000});
assert.equal(over.critical,true,"budget violation is critical");
assert.ok(over.risks.includes("over_budget"));

const forbidden=dq.evaluate({id:"bad",total:500,stores:1,productIds:["ham"]},[],{excludedProducts:["ham"]});
assert.equal(forbidden.verdict,"bad");
assert.ok(forbidden.risks.includes("excluded_product"));

const missing=dq.evaluate({id:"missing",total:500,stores:1,productIds:["bread"]},[],{requiredProducts:["eggs"]});
assert.ok(missing.risks.includes("missing_required"));
assert.equal(missing.critical,true);

const unknown=dq.evaluate({id:"unknown",total:500,stores:1,productIds:["eggs"],quality:"UNKNOWN"},[],{});
assert.ok(unknown.risks.includes("unverified_data"),"unverified price data must reduce confidence");

const violates=dq.evaluate({id:"multi",total:500,stores:2,productIds:["eggs"]},[],{mode:"one"});
assert.ok(violates.risks.includes("violates_one_store"));
assert.equal(violates.critical,true);

// Integration: a planner that slightly prefers a pointless split must be corrected.
const ctx2={window:{},console};ctx2.window.window=ctx2.window;vm.createContext(ctx2);vm.runInContext(code,ctx2);
ctx2.window.TDBaiPlanner={
  build(){return{strategies:[
    {id:"split",total:920,stores:2,productIds:["eggs","bread"],score:100,quality:"LIVE"},
    {id:"one",total:1000,stores:1,productIds:["eggs","bread"],score:90,quality:"LIVE"}
  ],recommended:null}},
  explain(){return"base"},afterChoice(){return{text:"base",suggestions:[]}}
};
const result=ctx2.window.TDBaiPlanner.build({},"");
assert.equal(result.recommended.id,"one","decision critic should overrule a tiny multi-store saving");
assert.ok(result.strategies[1].decision.risks.includes("small_saving_extra_store"));

console.log("Bai decision quality passed: constraints, data confidence and convenience can overrule fake savings.");
