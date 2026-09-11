import fs from "node:fs";
import assert from "node:assert/strict";

const css = fs.readFileSync("touch-layout-fix.css", "utf8");
const bai = fs.readFileSync("bai-assistant.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.match(css, /hover:none/);
assert.match(css, /pointer:coarse/);
assert.match(css, /max-width:1100px/);
assert.match(css, /body>\.bai-panel\[data-bai-panel="true"\]/);
assert.match(css, /object-fit:contain!important/);
assert.match(css, /repeat\(2,minmax\(0,1fr\)\)/);
assert.match(bai, /document\.body\.appendChild\(panel\)/);
assert.match(bai, /document\.querySelector\('\.bai-panel\[data-bai-panel="true"\]'\)/);
assert.doesNotMatch(bai, /bai\.appendChild\(panel\)/);
assert.match(html, /touch-layout-fix\.css\?v=20260911-v1/);
assert.match(html, /bai-assistant\.js\?v=20260911-touch-v2/);

console.log("touch layout fix tests: ok");
