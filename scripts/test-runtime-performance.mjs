import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const gsap = read("gsap-motion.js");
const polish = read("v2-polish.js");
const product = read("product-ui.js");
const history = read("price-history.js");
const index = read("index.html");

assert.match(index, /<script src="v2-polish\.js\?/, "v2-polish must already be loaded by the page");
assert.match(gsap, /__TDGsapMotionInitialized/, "GSAP motion must be idempotent");
assert.match(gsap, /script\[src\*="\$\{file\}"\]/, "GSAP loader must recognize statically loaded polish scripts");
assert.match(gsap, /link\[href\*="\$\{file\}"\]/, "GSAP loader must recognize statically loaded polish styles");
assert.match(gsap, /if \(document\.hidden \|\| playFrame\) return/, "motion scheduling must pause in hidden tabs");
assert.match(polish, /__TDV2PolishInitialized/, "v2 polish must refuse duplicate initialization");
assert.match(polish, /if\(document\.hidden\|\|headerScrollFrame\) return/, "scroll work must pause while hidden");

assert.match(product, /__TDProductUIInitialized/, "product UI must be idempotent");
assert.match(product, /document\.getElementById\("app"\)/, "product observer must be scoped to app");
assert.match(product, /function needsDecorate\(records\)/, "product observer must filter irrelevant mutations");
assert.match(product, /if\(document\.hidden\|\|frame\)return/, "product decoration must coalesce frames and pause when hidden");
assert.match(product, /observer\.disconnect\(\)/, "product observer must disconnect when paused");
assert.match(product, /visibilitychange/, "product observer must follow tab visibility");
assert.match(product, /pagehide/, "product observer must clean up on page hide");
assert.match(product, /img\.loading="lazy"/, "retailer product images must lazy load");
assert.match(product, /img\.decoding="async"/, "retailer product images must decode asynchronously");
assert.match(product, /fetchpriority","low"/, "retailer product images must use low fetch priority");

assert.match(history, /__TDPriceHistoryInitialized/, "price history must be idempotent");
assert.match(history, /function needsDecorate\(records\)/, "price history observer must ignore its own decoration mutations");
assert.match(history, /document\.getElementById\("app"\)/, "price history observer must stay scoped to app");
assert.match(history, /if\(document\.hidden\|\|frame\)return/, "price history work must pause while hidden");
assert.match(history, /obs\.disconnect\(\)/, "price history observer must disconnect when hidden/pagehide");
assert.match(history, /window\.addEventListener\("pagehide",pause/, "price history must clean up on pagehide");

console.log("Runtime performance guards passed: duplicate init, broad observers, hidden-tab work and image priority are controlled.");
