import fs from "node:fs";
import assert from "node:assert/strict";

const touch = fs.readFileSync("touch-layout-fix.css", "utf8");
const home = fs.readFileSync("votonobay-home-lock-v4.css", "utf8");

assert.match(touch, /votonobay-home-lock-v4\.css\?v=20260912-v1/);
assert.ok(
  touch.indexOf("votonobay-home-lock-v4.css") > touch.indexOf("votonobay-motion-guard.css"),
  "home lock must load after the historical visual layers"
);
assert.match(home, /grid-template-areas:"copy bay" "actions bay" "self self" "proof proof"!important/);
assert.match(home, /\.v2-bay-first \.v2-hero-bai\{[\s\S]*position:relative!important/);
assert.match(home, /\.v2-self-search \.v2-search\{[\s\S]*margin:12px 0 0!important/);
assert.match(home, /pointer:coarse/);
assert.match(home, /grid-template-areas:"copy" "bay" "actions" "self"!important/);
assert.match(home, /overflow-x:auto!important/);
assert.doesNotMatch(home, /Сәлам|Салам|Там дешевле|Где дешевле/);

console.log("home visual lock tests: ok");
