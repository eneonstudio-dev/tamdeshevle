import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source=fs.readFileSync("bai-runtime-states-v1.js","utf8");
const baiLife=fs.readFileSync("bai-life.js","utf8");
const polish=fs.readFileSync("v2-polish.js","utf8");
new Function(source);

class MutationObserverMock{constructor(fn){this.fn=fn}observe(){}disconnect(){}}
const document={
  body:{},
  head:{appendChild(){}},
  hidden:false,
  querySelector(){return null},
  createElement(){return{dataset:{},textContent:""}},
  addEventListener(){}
};
const context={
  console,
  document,
  navigator:{onLine:true},
  MutationObserver:MutationObserverMock,
  requestAnimationFrame(fn){fn();return 1},
  cancelAnimationFrame(){},
  window:{addEventListener(){}}
};
context.window.window=context.window;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:"bai-runtime-states-v1.js"});

const api=context.window.TDBaiRuntimeStatesV1;
assert.ok(api,"Bay runtime state API must install");
assert.equal(api.classify({online:false,busy:true,userCount:1,lastAssistant:"Не получилось обработать сообщение до конца"}),"offline","offline must win because fresh network work is unavailable");
assert.equal(api.classify({online:true,busy:false,userCount:1,lastAssistant:"Не получилось обработать сообщение до конца"}),"error","assistant failure must become a persistent recoverable error state");
assert.equal(api.classify({online:true,busy:true,userCount:1,lastAssistant:""}),"loading","busy assistant must expose a loading state");
assert.equal(api.classify({online:true,busy:false,userCount:0,lastAssistant:"Что покупаем?"}),"empty","new conversation must offer a purposeful empty state");
assert.equal(api.classify({online:true,busy:false,userCount:1,lastAssistant:"Готово"}),"normal","successful conversation must get out of recovery UI");

assert.match(source,/Повторить/,"error state must offer a retry action");
assert.match(source,/Искать самому/,"error state must preserve self-service fallback");
assert.match(source,/Открыть список/,"offline state must keep a local cart action");
assert.match(source,/Свежие цены, новые рекомендации и переходы в магазины вернутся после подключения/,"offline state must explain the actual network boundary");
assert.match(source,/Разбираю задачу/,"loading state must explain what Bay is doing");
assert.match(source,/С чего начнём\?/,"empty state must provide an intentional start");
assert.match(source,/Собрать корзину/,"empty state must expose a quick shopping task");
assert.match(source,/Что лучше выбрать\?/,"empty state must expose decision help");
assert.match(source,/Проверить скидку/,"empty state must expose discount verification");
assert.match(source,/aria-live","polite/,"state recovery UI must announce changes accessibly");
assert.match(baiLife,/bai-runtime-states-v1\.js\?v=/,"Bay lifecycle must load the Bay recovery state layer");
assert.doesNotMatch(polish,/bai-runtime-states-v1|TDBaiRuntimeStates|bai-runtime/,"generic V2 polish must remain independent from Bay internals");
assert.doesNotMatch(source,/Там дешевле|Тамдешевле|Проще/,"runtime states must not reintroduce a legacy master brand");

console.log("Bay runtime states passed: empty, loading, recoverable error, offline and normal states have clear next actions without coupling generic V2 lifecycle to Bay.");
