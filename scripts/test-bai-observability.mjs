import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync(new URL("../bai-observability.js",import.meta.url),"utf8");

assert.match(source,/MAX_EVENTS=100/);
assert.match(source,/td:bai-telemetry/);
assert.match(source,/function sanitize\(detail=/);
assert.match(source,/function wrapKernel\(\)/);
assert.match(source,/function wrapBrain\(\)/);
assert.match(source,/provider_route/);
assert.match(source,/breaker_open/);
assert.match(source,/operation_count/);
assert.match(source,/window\.TDBaiObservability=/);
assert.doesNotMatch(source,/detail\.text/);
assert.doesNotMatch(source,/detail\.input/);
assert.doesNotMatch(source,/detail\.history/);
assert.doesNotMatch(source,/detail\.payload/);

console.log("Bai observability contract passed: bounded sanitized kernel/provider telemetry is exposed.");
