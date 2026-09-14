import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const context={console,JSON,Math,Number,String,Object,Array,Set,Map,Date,RegExp,Intl,queueMicrotask};
context.window=context;
context.globalThis=context;
context.state={mode:"walk"};
context.TDBaiMemory={tradeoffProfile(){return null}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL("../bai-tradeoff-advisor-v1.js",import.meta.url),"utf8"),context,{filename:"bai-tradeoff-advisor-v1.js"});

const advisor=context.TDBaiTradeoffAdvisorV1;
assert.ok(advisor);
assert.equal(
  advisor.isTradeoffPrompt("Почему этот вариант?"),
  true,
  "MVP-030: the canonical explanation follow-up must route into the grounded tradeoff advisor"
);
assert.equal(advisor.isTradeoffPrompt("Почему именно этот вариант?"),true);

const known=advisor.evaluate({
  oneTotal:1000,
  splitGoods:850,
  oneStores:1,
  splitStores:2,
  state:{preferences:[]},
  mode:"walk",
  confidence:"live",
  assembly:{
    configured:true,
    delivery:false,
    extraStops:1,
    minutesPerStop:15,
    timeMinutes:15,
    timeValueRub:100,
    transportRub:0,
    operationalCost:100
  }
});
assert.equal(known.available,true);
assert.equal(known.choice,"one");
assert.equal(known.grossSaving,150);
assert.equal(known.netSaving,50);
const knownText=advisor.explain(known);
assert.match(knownText,/50\s*₽/u,"explanation must use the actual net benefit from the decision object");
assert.match(knownText,/15\s*мин/u,"explanation must use the actual configured time trade-off");
assert.match(knownText,/свежим данным/u,"explanation must disclose the actual evidence class");

const unknown=advisor.evaluate({
  oneTotal:1000,
  splitGoods:900,
  oneStores:1,
  splitStores:2,
  state:{preferences:[]},
  mode:"walk",
  confidence:"estimated",
  assembly:{
    configured:false,
    delivery:false,
    extraStops:1,
    minutesPerStop:0,
    timeMinutes:0,
    timeValueRub:0,
    transportRub:0,
    operationalCost:null
  }
});
assert.equal(unknown.available,true);
assert.equal(unknown.netSaving,null);
const unknownText=advisor.explain(unknown);
assert.match(unknownText,/дополнительного времени пока не (?:задана|настроена)/u,"unknown friction must be disclosed instead of inventing a net saving");
assert.match(unknownText,/ориентировочным данным/u,"estimated evidence must stay labeled as estimated");

console.log("MVP-030 explanation regression passed: canonical why-follow-up routes to grounded decision facts and discloses uncertainty.");
