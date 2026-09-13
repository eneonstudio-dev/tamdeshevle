import fs from "node:fs";
import assert from "node:assert/strict";

const touch = fs.readFileSync("touch-layout-fix.css", "utf8");
const home = fs.readFileSync("votonobay-home-lock-v4.css", "utf8");
const approved = fs.readFileSync("votonobay-generated-home-v5.css", "utf8");
const brand = fs.readFileSync("brand-votonobay-v1.js", "utf8");

assert.match(touch, /votonobay-home-lock-v4\.css\?v=/);
assert.ok(
  touch.indexOf("votonobay-home-lock-v4.css") > touch.indexOf("votonobay-motion-guard.css"),
  "home authority must load after the historical visual layers"
);

// Historical Home remains structurally compatible with the V2 shell.
assert.match(home, /grid-template-areas:"copy bay" "actions bay" "self self"!important/);
assert.match(home, /pointer:coarse/);
assert.match(home, /\.v2-bay-secondary\{[\s\S]*background:transparent!important/);

// Approved handoff layer is deliberately more specific and owns the final Home look.
assert.match(approved, /Approved Roxy handoff/);
assert.match(approved, /html body\.td-votonobay:not\(\.td-votonobay-inner\) \.v2-main/);
assert.match(approved, /\.v2-main>\.v2-basket-card\{display:none!important\}/);
assert.match(approved, /grid-template-areas:"copy bay" "actions bay" "proof bay" "self bay"!important/);
assert.match(approved, /\.roxy-bay-card/);
assert.match(approved, /--roxy-green:#4ff59a/);
assert.match(approved, />\.bai-assistant\{display:none!important\}/);
assert.doesNotMatch(approved, /Там дешевле|ТД↓|white-green|Duolingo/i);

// Brand + hero copy follows the approved Votonobay / Bay-first direction.
assert.match(brand, /VOTONO<b>BAY<\/b>/);
assert.match(brand, /Спросить Бая —<br><em>самый простой путь\.<\/em>/);
assert.match(brand, /Бай подберёт лучшие товары, сравнит варианты, соберёт корзину/);
assert.match(brand, /class=\"roxy-bay-card\"/);
assert.match(brand, /Что решаем сегодня\?/);

console.log("home visual lock tests: approved Roxy Bay-first Home is protected");
