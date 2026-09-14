import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../backend/bai-agent-core.ts",import.meta.url),"utf8");
const browserGate=fs.readFileSync(new URL("../bai-mvp-vertical-gate.js",import.meta.url),"utf8");
const config=fs.readFileSync(new URL("../supabase-config.js",import.meta.url),"utf8");
const gateIndex=source.indexOf("const gate=domainGate(message)");
const verticalIndex=source.indexOf("const vertical=mvpVerticalGate(message)");
const reserveIndex=source.indexOf("reserve_bai_agent_request");
const graphIndex=source.indexOf("graph.invoke");

assert.ok(source.includes("function domainGate"),"Agent Core must own a server-side shopping Domain Gate");
assert.ok(gateIndex>0,"server must evaluate Domain Gate for every parsed message");
assert.ok(reserveIndex>gateIndex,"OUT_OF_SCOPE must fail before request reservation/cost accounting");
assert.ok(graphIndex>gateIndex,"OUT_OF_SCOPE must fail before model graph/provider execution");
assert.ok(source.includes('error:"out_of_scope"')&&source.includes('status:"OUT_OF_SCOPE"'),"server rejection must be structured");
assert.ok(source.includes('trace:["domain_gate"]'),"server rejection must expose a safe boundary trace");
assert.ok(source.includes("SHOP_PRODUCT.test(t)&&PRODUCT_ADVICE.test(t)"),"product advice must be considered before generic tech-task rejection");
assert.ok(source.includes("NON_SHOP_TASK"),"server must explicitly reject coding/site-building tasks");

// MVP-019: coding remains outside shopping before any provider/cost path.
assert.match(source,/NON_SHOP_TASK=.*react/i,"React/site-building requests must remain explicit non-shopping tasks");

// MVP-020: broad shopping intent stays conceptually in-domain, then the grocery/FMCG MVP boundary stops unsupported categories.
assert.ok(source.includes("function mvpVerticalGate"),"server must own an explicit grocery-MVP vertical gate");
assert.ok(verticalIndex>gateIndex,"vertical gate must run only after the generic shopping Domain Gate");
assert.ok(reserveIndex>verticalIndex,"unsupported MVP categories must fail before request reservation/cost accounting");
assert.ok(source.includes('error:"unsupported_vertical"')&&source.includes('status:"UNSUPPORTED_CATEGORY"'),"unsupported MVP category response must be structured");
assert.ok(source.includes('trace:["domain_gate","vertical_gate"]'),"unsupported category must expose the bounded gate trace");
assert.match(source,/ноутбук\|телефон\|смартфон/i,"server vertical gate must recognize explicit non-grocery shopping categories");
assert.match(source,/како\(\?:й\|е\|ую\|ие\).*лучше/,"canonical `Какой ноутбук лучше` phrasing must count as broad product advice before vertical rejection");

assert.ok(config.indexOf("bai-mvp-vertical-gate.js")>config.indexOf("bai-agent-client.js"),"browser vertical gate must load immediately after Agent Client");
assert.match(browserGate,/UNSUPPORTED_MVP_CATEGORY/,"browser gate must expose an explicit unsupported-MVP category code");
assert.match(browserGate,/пока не поддерживаю/i,"browser reply must explain that non-grocery categories are not supported yet");

let innerCalls=0;
const context={console,Date,Math,Number,String,Object,Array,Set,Map,JSON,Promise};
context.window=context;
context.TDBaiShoppingAgentKernel={domainGate:()=>({allowed:false,code:"OUT_OF_SCOPE",reason:"no_shopping_intent"})};
context.TDBaiBrain={route:async()=>{innerCalls+=1;return{ok:true,provider:"inner",operations:[],reply:"inner"}}};
vm.createContext(context);
vm.runInContext(browserGate,context,{filename:"bai-mvp-vertical-gate.js"});

const vertical=context.TDBaiMvpVerticalGate;
assert.ok(vertical,"browser vertical gate API must boot");
assert.equal(vertical.check("Какой ноутбук лучше для программирования?").supported,false,"canonical laptop request must be stopped by MVP vertical boundary");
assert.equal(vertical.check("Какое молоко лучше взять?").supported,true,"grocery advice must stay supported");
assert.equal(context.TDBaiShoppingAgentKernel.domainGate("Какой ноутбук лучше для программирования?").allowed,true,"broad Domain Gate must still recognize the request as shopping before the vertical boundary");
const laptop=await context.TDBaiBrain.route("Какой ноутбук лучше для программирования?",[]);
assert.equal(laptop.status,"UNSUPPORTED_CATEGORY");
assert.equal(laptop.provider,"mvp-vertical-gate");
assert.equal(laptop.operations.length,0,"unsupported category must never produce shopping mutations");
assert.match(laptop.reply,/продукт/i,"user must get an explicit grocery-MVP explanation");
assert.equal(innerCalls,0,"unsupported category must not reach local/remote model routing");
const grocery=await context.TDBaiBrain.route("Какое молоко лучше взять?",[]);
assert.equal(grocery.provider,"inner","grocery request must continue to the normal Bai stack");
assert.equal(innerCalls,1);

console.log("Bai boundary passed: coding is out-of-scope and non-grocery shopping is stopped by the grocery-MVP vertical gate before provider/cost execution.");