import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../backend/bai-agent-core.ts",import.meta.url),"utf8");
const gateIndex=source.indexOf("const gate=domainGate(message)");
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

console.log("Bai Domain Gate boundary passed: server fails closed before reservation/provider and preserves shopping product advice.");