import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../bai-memory.js",import.meta.url),"utf8");
const store=new Map();
const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const window={};
const context=vm.createContext({window,localStorage,console,JSON,Math,Number,String,Object,Array,Set,RegExp});
vm.runInContext(source.replace(/import\([^;]+;/g,""),context,{filename:"bai-memory.js"});

const memory=window.TDBaiMemory;
assert.ok(memory?.learn,"Bai memory must expose learn()");

memory.clear();
memory.learn("добавь молоко",{operations:[{type:"ADD_PRODUCT",value:"milk"}]});
assert.equal(memory.signal("milk").added,1,"milk should be learned after add");
assert.ok(memory.get().productsLiked.includes("milk"));
memory.learn("отмени последнее",{operations:[{type:"UNDO"}]});
assert.equal(memory.signal("milk").added,undefined,"undo must roll back learned product signal");
assert.equal(memory.get().productsLiked.includes("milk"),false,"undo must roll back liked product");
assert.equal(memory.get().turns,0,"undo must restore turn counter to previous snapshot");

memory.learn("бюджетно и без готовки",{operations:[{type:"ADD_PREFERENCE",value:"budget"},{type:"SET_COOKING",value:"minimal"},{type:"CHANGE_BUDGET",value:1800}]});
assert.ok(memory.get().preferences.includes("budget"));
assert.equal(memory.get().cooking,"minimal");
assert.equal(memory.get().usualBudget,1800);
memory.learn("назад",{operations:[{type:"UNDO"}]});
assert.equal(memory.get().preferences.includes("budget"),false,"undo must roll back learned preference");
assert.equal(memory.get().cooking,null,"undo must roll back cooking preference");
assert.equal(memory.get().usualBudget,null,"undo must roll back learned budget");

memory.learn("убери сахар",{operations:[{type:"REMOVE_PRODUCT",value:"sugar"}]});
assert.equal(memory.signal("sugar").removed,1);
memory.learn("верни как было",{operations:[{type:"UNDO"}]});
assert.equal(memory.signal("sugar").removed,undefined,"undo must roll back avoidance signal");
assert.equal(memory.get().productsAvoided.includes("sugar"),false);

console.log("Bai memory undo checks passed");
