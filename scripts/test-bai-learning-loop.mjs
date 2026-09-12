import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../bai-learning-loop.js",import.meta.url),"utf8");
const store=new Map();
const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const window={
  TDBaiBrain:{route:async raw=>({ok:true,provider:"baseline",operations:raw.includes("молоко")?[{type:"ADD_PRODUCT",value:"milk"}]:[],reply:"Готово.",expectsAnswer:false})},
  TDBaiMemory:{learn:()=>({})}
};
const context=vm.createContext({window,localStorage,console,Date,Set,JSON,String,Array,Math,RegExp});
vm.runInContext(source,context,{filename:"bai-learning-loop.js"});

window.TDBaiMemory.learn("добавь молоко",{operations:[{type:"ADD_PRODUCT",value:"milk"}]});
window.TDBaiMemory.learn("нет, добавь воду",{operations:[{type:"ADD_PRODUCT",value:"water"}]});

const learned=await window.TDBaiBrain.route("добавь молоко");
assert.equal(learned.provider,"bai-learning-loop");
assert.deepEqual(JSON.parse(JSON.stringify(learned.operations)),[{type:"ADD_PRODUCT",value:"water"}]);
assert.equal(learned.learning?.applied,true);

const unrelated=await window.TDBaiBrain.route("добавь хлеб");
assert.equal(unrelated.provider,"baseline");

window.TDBaiLearning.clear();
window.TDBaiMemory.learn("добавь молоко для me@example.com",{operations:[{type:"ADD_PRODUCT",value:"milk"}]});
window.TDBaiMemory.learn("нет, добавь воду",{operations:[{type:"ADD_PRODUCT",value:"water"}]});
const exported=window.TDBaiLearning.exportCases();
assert.ok(exported.every(x=>!JSON.stringify(x).includes("me@example.com")),"PII must be redacted");
assert.ok(!source.includes("MutationObserver"),"learning loop must not add DOM observers");
console.log("Bai learning loop regression checks passed");
