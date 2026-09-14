import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../backend/bai-agent-core.ts",import.meta.url),"utf8");
const client=fs.readFileSync(new URL("../bai-agent-client.js",import.meta.url),"utf8");
const kernel=fs.readFileSync(new URL("../bai-shopping-agent-kernel.js",import.meta.url),"utf8");
const gateIndex=source.indexOf("const gate=domainGate(message)");
const verticalIndex=source.indexOf("mvpVerticalGate(message)");
const reserveIndex=source.indexOf("reserve_bai_agent_request");
const graphIndex=source.indexOf("graph.invoke");

assert.ok(source.includes("function domainGate"),"Agent Core must own a server-side shopping Domain Gate");
assert.ok(gateIndex>0,"server must evaluate Domain Gate for every parsed message");
assert.ok(reserveIndex>gateIndex,"OUT_OF_SCOPE must fail before request reservation/cost accounting");
assert.ok(graphIndex>gateIndex,"OUT_OF_SCOPE must fail before model graph/provider execution");
assert.ok(source.includes('error:"out_of_scope"')&&source.includes('status:"OUT_OF_SCOPE"'),"server rejection must be structured");
assert.ok(source.includes('trace:["domain_gate"]'),"server rejection must expose a safe boundary trace");
assert.ok(source.includes("SHOP_PRODUCT.test(t)&&/(?:посовет|выбер|подбер|сравн|куп)/"),"product advice must be considered before generic tech-task rejection");
assert.ok(source.includes("NON_SHOP_TASK"),"server must explicitly reject coding/site-building tasks");

// MVP-019: coding remains outside shopping before any provider/cost path.
assert.match(source,/NON_SHOP_TASK=.*react/i,"React/site-building requests must remain explicit non-shopping tasks");

// MVP-020: non-grocery product advice is conceptually shopping, but outside the current grocery/FMCG MVP.
assert.ok(source.includes("function mvpVerticalGate"),"server must own an explicit grocery-MVP vertical gate");
assert.ok(verticalIndex>gateIndex,"vertical gate must run only after the generic shopping Domain Gate");
assert.ok(reserveIndex>verticalIndex,"unsupported MVP categories must fail before request reservation/cost accounting");
assert.ok(source.includes('error:"unsupported_vertical"')&&source.includes('status:"UNSUPPORTED_CATEGORY"'),"unsupported MVP category response must be structured");
assert.ok(source.includes('trace:["domain_gate","vertical_gate"]'),"unsupported category must expose the bounded gate trace");
assert.match(source,/ноутбук\|телефон\|смартфон/i,"server vertical gate must recognize explicit non-grocery shopping categories");
assert.match(kernel,/function mvpVerticalGate/,'browser kernel must mirror the MVP vertical boundary');
assert.match(kernel,/mvpVerticalGate,/,"browser kernel must expose verticalGate to the client");
assert.match(client,/mvpVerticalGate\?\.\(text\)/,"client must apply the same vertical boundary before local/remote model routing");
assert.match(client,/пока работаю с продуктами|продуктов(?:ая|ом) корзин/i,"client must explain the supported grocery MVP instead of becoming a general assistant");

console.log("Bai boundary passed: coding is out-of-scope and non-grocery shopping is stopped by the grocery-MVP vertical gate before provider/cost execution.");