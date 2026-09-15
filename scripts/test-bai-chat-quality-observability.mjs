import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
let source=fs.readFileSync(path.join(root,"bai-observability.js"),"utf8");
source=source.replace(/\n\s*import\("\.\/bai-chat-quality-v3\.js[^\n]+\n/,'\n');
const releaseConfig=fs.readFileSync(path.join(root,"supabase-config.js"),"utf8");
assert.match(releaseConfig,/\.\/bai-observability\.js\?v=20260915-chat-quality-v2/,"release must bust the old Bai observability cache key");
assert.doesNotMatch(releaseConfig,/\.\/bai-observability\.js\?v=20260913-observability-v1/,"release must not retain the stale observability v1 cache key");

const store=new Map();
const localStorage={
  getItem:key=>store.has(key)?store.get(key):null,
  setItem:(key,value)=>store.set(key,String(value)),
  removeItem:key=>store.delete(key)
};
const events=[];
const window={
  location:{search:""},localStorage,
  dispatchEvent:event=>{events.push(event);return true},
  addEventListener:()=>{},
  TDBaiShoppingAgentKernel:null,
  TDBaiBrain:null,
  TDBaiAgentClient:{status:()=>({provider:"rules",reason:"fallback"})}
};
window.window=window;
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail}}
const context={window,localStorage,CustomEvent,URLSearchParams,console,Date,Math,JSON,Number,String,Array,Set,Object};
vm.runInNewContext(source,context,{filename:"bai-observability.js"});
const api=window.TDBaiObservability;

assert.equal(api.version,2);
assert.equal(api.debugEnabled(),false);
assert.equal(api.setDebug(true),true);
assert.equal(api.debugEnabled(),true);
assert.equal(api.setDebug(false),false);
assert.equal(api.providerLabel("rules"),"RULES");
assert.equal(api.providerLabel("gemma-browser"),"LOCAL");
assert.equal(api.providerLabel("bai-agent-core"),"SERVER");
assert.equal(api.providerLabel("trained-qwen"),"TRAINED");

for(let i=0;i<55;i++){
  const saved=api.captureFailure({
    request:`case ${i} test@example.com +7 999 123-45-67 token=abcdefghijklmnop`,
    reply:"wrong answer",
    provider:"rules",
    reason:"fallback",
    operations:[{type:"ADD_PRODUCT",value:{secret:"must-not-persist"}}],
    state:{
      budget:5000,peopleCount:2,duration:7,mode:"one",stores:["magnit"],preferences:["healthy"],
      products:[{id:"milk",name:"Sensitive display name",quantity:2}],
      access_token:"must-not-persist",email:"owner@example.com"
    }
  });
  assert.ok(saved);
}

const failures=api.listFailures();
assert.equal(failures.length,50,"local regression queue must be bounded");
const last=failures.at(-1);
assert.equal(last.provider,"rules");
assert.deepEqual(last.operation_types,["ADD_PRODUCT"]);
assert.equal(last.state.budget,5000);
assert.deepEqual(JSON.parse(JSON.stringify(last.state.products)),[{id:"milk",quantity:2}]);
assert.equal("access_token" in last.state,false);
assert.equal("email" in last.state,false);

const raw=store.get("td_bai_regression_candidates_v1")||"";
for(const forbidden of ["test@example.com","owner@example.com","123-45-67","abcdefghijklmnop","must-not-persist","Sensitive display name"]){
  assert.equal(raw.includes(forbidden),false,`must redact/minimize ${forbidden}`);
}
assert.match(raw,/\[email\]/);
assert.match(raw,/\[phone\]/);
assert.match(raw,/\[secret\]/);

const exported=JSON.parse(api.exportFailures());
assert.equal(exported.schema,"votonobay-bai-regression-candidates-v1");
assert.equal(exported.cases.length,50);
api.clearFailures();
assert.equal(api.listFailures().length,0);
assert.ok(events.some(event=>event.type==="td:bai-telemetry"&&event.detail?.type==="regression_candidate"));

console.log("Bay chat-quality local regression capture: PASS");
