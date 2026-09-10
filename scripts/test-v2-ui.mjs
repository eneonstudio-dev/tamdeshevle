import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8"),ui=fs.readFileSync("v2-shell.js","utf8"),css=fs.readFileSync("v2-shell.css","utf8"),bai=fs.readFileSync("bai-assistant.js","utf8");
const historyUi=fs.readFileSync("price-history.js","utf8"),substitutions=fs.readFileSync("smart-substitutions.js","utf8");
assert.match(html,/v2-shell\.css\?v=/);assert.match(html,/v2-shell\.js\?v=/);
for(const component of ["Header","HeroSearch","StoreStrip","ProductGrid","ProductCard","ShoppingList","Footer"])assert.match(ui,new RegExp(`function ${component}\\(`));
for(const action of ["tdV2Search","tdV2Quick","tdV2Menu","tdV2About"])assert.match(ui,new RegExp(`window\\.${action}`));
assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/grid-template-columns:minmax\(0,1fr\) 310px/);
assert.match(css,/\.phone\{max-width:none!important\}/);
assert.match(ui,/демонстрационные и не участвуют в честном рейтинге/);assert.match(ui,/Подтверждённые и предполагаемые цены всегда разделены/);
for(const state of ["idle","greeting","peek","curious","checking","thinking","suspicious","happy","excited","big-saving","confused","scared","playful","sleepy","sleeping","hidden","goodbye"])assert.match(bai,new RegExp(`["']?${state}["']?\\s*:`));
assert.doesNotMatch(bai,/MutationObserver/);assert.match(bai,/Уложить Бая спать/);assert.match(bai,/bai-tail-peek\.webp/);
assert.match(historyUi,/tdHistorySignature/);assert.match(substitutions,/dataset\.signature/);
console.log("V2 UI contract passed: responsive shell, honest data labels and edge-dwelling Bai states are wired.");
