import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../bai-session-owner-guard.js",import.meta.url),"utf8");
const storage=new Map([["td:bai-shopping-session:v2",JSON.stringify({history:["legacy"],budget:5000})]]);
const listeners=new Map();
let resets=0;
const context={
  console,
  localStorage:{
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:key=>storage.delete(key)
  },
  addEventListener:(name,fn)=>listeners.set(name,fn),
  TDBaiShoppingAgentKernel:{state:{reset(){resets++;storage.set("td:bai-shopping-session:v2",JSON.stringify({history:[],budget:null}));}}}
};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context);

const fire=detail=>listeners.get("td:auth-state")?.({detail});

fire({session:{user:{id:"user-a"}}});
assert.equal(storage.get("td:bai-shopping-session-owner:v1"),"user-a");
assert.equal(resets,1,"legacy/unowned session must be cleared when first authenticated owner is known");

storage.set("td:bai-shopping-session:v2",JSON.stringify({history:["a-private"],budget:4200}));
fire({session:{user:{id:"user-a"}}});
assert.equal(resets,1,"same owner must keep its active Bai shopping session");
assert.match(storage.get("td:bai-shopping-session:v2"),/a-private/);

fire({session:null});
assert.equal(storage.get("td:bai-shopping-session-owner:v1"),"guest");
assert.equal(resets,2,"sign out must clear the authenticated Bai session");
assert.doesNotMatch(storage.get("td:bai-shopping-session:v2"),/a-private/);

storage.set("td:bai-shopping-session:v2",JSON.stringify({history:["guest-private"],budget:700}));
fire({session:{user:{id:"user-b"}}});
assert.equal(storage.get("td:bai-shopping-session-owner:v1"),"user-b");
assert.equal(resets,3,"guest -> user transition must clear guest Bai state");
assert.doesNotMatch(storage.get("td:bai-shopping-session:v2"),/guest-private/);

storage.set("td:bai-shopping-session:v2",JSON.stringify({history:["b-private"],budget:9000}));
fire({session:{user:{id:"user-a"}}});
assert.equal(storage.get("td:bai-shopping-session-owner:v1"),"user-a");
assert.equal(resets,4,"user B -> user A transition must not leak user B state");
assert.doesNotMatch(storage.get("td:bai-shopping-session:v2"),/b-private/);

assert.equal(context.TDBaiSessionOwnerGuard.status().owner,"user-a");

const observability=fs.readFileSync(new URL("../bai-observability.js",import.meta.url),"utf8");
assert.match(observability,/MAX_EVENTS=100/);
assert.match(observability,/td:bai-telemetry/);
assert.match(observability,/function wrapKernel\(\)/);
assert.match(observability,/function wrapBrain\(\)/);
assert.match(observability,/provider_route/);
assert.match(observability,/breaker_open/);
assert.doesNotMatch(observability,/detail\.text/);
assert.doesNotMatch(observability,/detail\.input/);
assert.doesNotMatch(observability,/detail\.history/);
assert.doesNotMatch(observability,/detail\.payload/);

const traceSource=fs.readFileSync(new URL("../bai-trace-context.js",import.meta.url),"utf8");
assert.match(traceSource,/trace_id/);
assert.match(traceSource,/td:bai-telemetry/);
assert.doesNotMatch(traceSource,/message|history|basket|payload/i,"trace layer must not capture shopping content");

const traceListeners=new Map();
const traceContext={
  console,JSON,Math,Date,setTimeout,clearTimeout,
  crypto:{randomUUID:()=>"12345678-1234-4234-8234-123456789abc"},
  addEventListener:(name,fn)=>traceListeners.set(name,fn),
  TDBaiBrain:{route:async()=>({ok:true,status:"OK",provider:"rules",operations:[{type:"ADD_PRODUCT",value:"milk"}]})},
  TDBaiShoppingAgentKernel:{run:async()=>({ok:true,status:"VERIFIED",actions:[{type:"add_item"}]}),execute:()=>({ok:true,status:"VERIFIED",actions:[{type:"add_item"}]})}
};
traceContext.window=traceContext;traceContext.globalThis=traceContext;
vm.createContext(traceContext);vm.runInContext(traceSource,traceContext);
const routed=await traceContext.TDBaiBrain.route("shopping request",[]);
const executed=await traceContext.TDBaiShoppingAgentKernel.run({text:"shopping request",operations:[]});
assert.match(routed.trace_id,/^bai_/);
assert.equal(executed.trace_id,routed.trace_id,"provider route and verified execution must share one correlation ID");
const telemetry={type:"kernel",stage:"run",status:"VERIFIED"};
traceListeners.get("td:bai-telemetry")?.({detail:telemetry});
assert.equal(telemetry.trace_id,routed.trace_id,"runtime telemetry must carry the same correlation ID without raw request content");

console.log("Bai session isolation passed: account state fails closed and trace-safe observability correlates route and execution without raw shopping content.");
