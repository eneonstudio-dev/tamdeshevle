import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const memorySource=fs.readFileSync(new URL("../bai-memory.js",import.meta.url),"utf8").replace(/import\("\.\/bai-learning-safety[^;]+;/g,"");
const advisorSource=fs.readFileSync(new URL("../bai-tradeoff-advisor-v1.js",import.meta.url),"utf8");
const KEY="td_bai_memory_v1";

function boot(initial=null){
  const store=new Map();
  if(initial)store.set(KEY,JSON.stringify(initial));
  const localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  const window={state:{mode:"walk"}};
  const context=vm.createContext({window,localStorage,console,JSON,Math,Number,String,Object,Array,Set,RegExp,Date,Intl});
  vm.runInContext(memorySource,context,{filename:"bai-memory.js"});
  vm.runInContext(advisorSource,context,{filename:"bai-tradeoff-advisor-v1.js"});
  return{window,memory:window.TDBaiMemory,advisor:window.TDBaiTradeoffAdvisorV1,store};
}

// v4 storage must migrate without losing existing user knowledge.
{
  const {memory}=boot({version:4,turns:7,preferences:["budget"],productsLiked:["milk"],usualBudget:2100});
  const migrated=memory.get();
  assert.equal(migrated.version,5,"tradeoff learning must migrate old memory to v5");
  assert.equal(migrated.usualBudget,2100,"migration must preserve learned budget");
  assert.deepEqual(migrated.productsLiked,["milk"],"migration must preserve product memory");
  assert.deepEqual(migrated.tradeoffSignals,[],"old memory starts with no invented tradeoff history");
}

const {memory,advisor}=boot();
let profile=memory.tradeoffProfile(150,"walk");
assert.equal(profile.personalized,false,"fresh memory must not personalize tradeoffs");

// One click is evidence, not a personality.
memory.noteTradeoffChoice({choice:"one",recommendedChoice:"split",netSaving:200,grossSaving:400,timeMinutes:25,operationalCost:200,mode:"walk",override:true});
profile=memory.tradeoffProfile(150,"walk");
assert.equal(profile.sampleCount,1);
assert.equal(profile.personalized,false,"a single explicit choice must not over-personalize Bay");
assert.equal(memory.get().tradeoffSignals[0].override,true,"explicitly rejecting Bay advice must be retained as a stronger signal");

// Repeated rejection of a second store should raise the savings threshold.
memory.noteTradeoffChoice({choice:"one",recommendedChoice:"split",netSaving:220,grossSaving:420,timeMinutes:25,operationalCost:200,mode:"walk"});
memory.noteTradeoffChoice({choice:"one",recommendedChoice:"split",netSaving:300,grossSaving:500,timeMinutes:30,operationalCost:200,mode:"walk"});
profile=memory.tradeoffProfile(150,"walk");
assert.equal(profile.personalized,true,"consistent repeated choices should activate personalization");
assert.equal(profile.tendency,"convenience","repeated one-store choices should learn a convenience tendency");
assert.ok(profile.thresholdRub>300,"convenience history should require materially more net saving before adding a store");

const neutralCase={oneTotal:5000,splitGoods:4500,oneStores:1,splitStores:2,mode:"walk",assembly:{configured:true,delivery:false,extraStops:1,minutesPerStop:30,timeMinutes:30,timeValueRub:150,transportRub:50,operationalCost:200},confidence:"verified"};
let decision=advisor.evaluate({...neutralCase,state:{preferences:[]}});
assert.equal(decision.choice,"one","learned convenience should flip a near-threshold neutral case to one store");
assert.equal(decision.personalized,true,"decision should disclose that learned history affected it");
assert.match(decision.why,/раньше ты обычно выбирал один магазин/i,"personalized explanation must say why the threshold changed");

// The current task always beats long-term habit.
decision=advisor.evaluate({...neutralCase,state:{preferences:["budget"]}});
assert.equal(decision.choice,"split","explicit budget intent must override convenience history");
assert.equal(decision.personalized,false,"task override must not be presented as historical personalization");

// Learn the opposite behavior in a clean memory: user accepts extra stops for modest net savings.
memory.clear();
for(const netSaving of [100,140,180])memory.noteTradeoffChoice({choice:"split",recommendedChoice:"one",netSaving,grossSaving:netSaving+200,timeMinutes:20,operationalCost:200,mode:"walk",override:true});
profile=memory.tradeoffProfile(150,"walk");
assert.equal(profile.personalized,true);
assert.equal(profile.tendency,"saving","repeated split choices should learn a savings tendency");
assert.ok(profile.thresholdRub<150,"savings history should lower the neutral split threshold");

decision=advisor.evaluate({oneTotal:5000,splitGoods:4700,oneStores:1,splitStores:2,state:{preferences:[]},mode:"walk",assembly:{configured:true,delivery:false,extraStops:1,minutesPerStop:20,timeMinutes:20,timeValueRub:150,transportRub:50,operationalCost:200},confidence:"verified"});
assert.equal(decision.netSaving,100);
assert.equal(decision.choice,"split","learned willingness to travel should make a modest but familiar saving worthwhile");

// Explicit convenience for this task must still beat a historically savings-oriented profile.
decision=advisor.evaluate({...neutralCase,state:{preferences:["convenience"]}});
assert.equal(decision.choice,"one","explicit convenience intent must override savings history");
assert.equal(decision.threshold,400,"convenience override keeps the existing 8%/250 RUB rule");

assert.equal(advisor.explicitChoice("Собрать в одном магазине"),"one");
assert.equal(advisor.explicitChoice("Разнести покупки"),"split");
assert.equal(advisor.explicitChoice("Что лучше: один магазин или два?"),null,"questions must never masquerade as training choices");

memory.clear();
profile=memory.tradeoffProfile(150,"walk");
assert.equal(profile.sampleCount,0,"clearing Bai memory must clear tradeoff history too");
assert.equal(profile.personalized,false);

console.log("Bai tradeoff learning passed: explicit choices build a cautious personalized threshold, current-task intent overrides history, and memory migration remains safe.");
